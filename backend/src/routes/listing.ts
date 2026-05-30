import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import prisma from '../services/db';
import { auth } from '../middleware/auth';
import { requirePermission } from '../middleware/requirePermission';
import { listingQueue } from '../services/queue';
import { cleanupTempFiles } from '../services/imageProcessor';
import { triggerRevalidation } from '../services/revalidator';
import { Category, Metal, Finish } from '@prisma/client';
import { config } from '../config';

const router = Router();

// Ensure uploads directory exists
const UPLOAD_DIR = '/tmp/listing-uploads/';
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer storage engine configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Multer middleware setup
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('INVALID_FILE_TYPE'));
    }
  }
});

// Helper: Magic Bytes Validation (JPEG, PNG, WebP)
function validateMagicBytes(filePath: string): boolean {
  try {
    const buffer = Buffer.alloc(4);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 4, 0);
    fs.closeSync(fd);

    const hex = buffer.toString('hex').toUpperCase();
    const isJpeg = hex.startsWith('FFD8FF');
    const isPng = hex.startsWith('89504E47');
    const isWebp = hex.startsWith('52494646'); // RIFF header for WebP
    return isJpeg || isPng || isWebp;
  } catch (err) {
    console.error('❌ Error reading magic bytes:', err);
    return false;
  }
}

// Zod Validation Schema matching backend enums
const ListingSchema = z.object({
  name: z.string().min(3).max(200),
  category: z.nativeEnum(Category),
  metal: z.nativeEnum(Metal),
  finish: z.nativeEnum(Finish),
  weightGrams: z.coerce.number().positive().optional(),
  stoneType: z.string().max(100).optional(),
  occasion: z.string().max(200).optional(),
  priceINR: z.coerce.number().int().positive(),
  originalPriceINR: z.coerce.number().int().positive().optional(),
});

// 1. POST /api/v1/listing/new — Create draft and queue AI job
router.post('/new', auth, requirePermission('listing.create'), (req: any, res: Response, next: NextFunction) => {
  upload.array('images', 6)(req, res, async (err) => {
    if (err) {
      if (err.message === 'INVALID_FILE_TYPE' || err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ error: 'INVALID_FILE_TYPE' });
      }
      return next(err);
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'At least one photo is required' });
    }

    // Validate Magic Bytes of uploaded files
    for (const file of files) {
      if (!validateMagicBytes(file.path)) {
        cleanupTempFiles(files.map(f => f.path));
        return res.status(400).json({ error: 'INVALID_FILE_TYPE' });
      }
    }

    try {
      // Validate inputs
      const body = ListingSchema.parse(req.body);

      // Create product in DB with UNLISTED state
      const draftSlug = `draft-${crypto.randomBytes(8).toString('hex')}`;
      const product = await prisma.product.create({
        data: {
          name: body.name,
          displayName: body.name, // Placeholder displayName
          shortDesc: '',
          description: '',
          slug: draftSlug,
          category: body.category,
          metal: body.metal,
          finish: body.finish,
          weightGrams: body.weightGrams ?? null,
          stoneType: body.stoneType ?? null,
          occasion: body.occasion ?? null,
          priceINR: body.priceINR,
          originalPriceINR: body.originalPriceINR ?? null,
          primaryImageUrl: '',
          rawInputData: body as any,
          status: 'UNLISTED',
        }
      });

      // Queue the Bull AI Enhancement job
      const job = await listingQueue.add({
        productId: product.id,
        input: {
          ...body,
          imagePaths: files.map(f => f.path)
        }
      });

      return res.status(201).json({
        jobId: job.id,
        productId: product.id,
        status: 'processing'
      });

    } catch (validationErr: any) {
      cleanupTempFiles(files.map(f => f.path));
      return res.status(400).json({ error: validationErr.message || validationErr });
    }
  });
});

// 2. GET /api/v1/listing/status/:jobId — Poll job progress
router.get('/status/:jobId', auth, requirePermission('listing.create'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId } = req.params;
    const job = await listingQueue.getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const state = await job.getState();
    const productId = job.data.productId;

    if (state === 'completed') {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: { images: true }
      });

      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      return res.json({
        status: 'done',
        productId,
        preview: {
          displayName: product.displayName,
          shortDesc: product.shortDesc,
          description: product.description,
          metaTitle: product.metaTitle,
          keywords: product.keywords,
          images: product.images.map(img => ({
            urlThumb: img.urlThumb,
            urlMedium: img.urlMedium
          }))
        }
      });
    }

    if (state === 'failed') {
      return res.json({
        status: 'failed',
        productId,
        error: job.failedReason || 'AI_SERVICE_UNAVAILABLE'
      });
    }

    // Status mapping for pending/processing
    return res.json({
      status: state === 'active' ? 'processing' : 'pending',
      productId
    });

  } catch (err) {
    next(err);
  }
});

// 3. POST /api/v1/listing/publish/:productId — Set live AVAILABLE
router.post('/publish/:productId', auth, requirePermission('listing.publish'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { productId } = req.params;
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (product.status !== 'UNLISTED' || !product.aiEnhanced) {
      return res.status(400).json({ error: 'Product must be UNLISTED and aiEnhanced to be published' });
    }

    const { displayName, description } = req.body;

    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: {
        displayName: displayName || product.displayName,
        description: description || product.description,
        status: 'AVAILABLE',
        listedAt: new Date(),
      }
    });

    // Trigger on-demand ISR storefront revalidation
    triggerRevalidation(updatedProduct.slug);

    return res.json({
      success: true,
      slug: updatedProduct.slug,
      url: `${config.FRONTEND_URL}/shop/${updatedProduct.slug}`
    });

  } catch (err) {
    next(err);
  }
});

// 4. PUT /api/v1/listing/re-enhance/:productId — Re-queue Bull job
router.put('/re-enhance/:productId', auth, requirePermission('listing.re_enhance_ai'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { productId } = req.params;
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (product.status !== 'UNLISTED') {
      return res.status(400).json({ error: 'Only draft items (UNLISTED) can be re-enhanced' });
    }

    // Resolve original image paths
    let imagePaths: string[] = [];
    const productImages = await prisma.productImage.findMany({
      where: { productId }
    });

    if (productImages.length > 0) {
      imagePaths = productImages.map(img => img.urlFull.replace('/images/products/', '/data/images/products/'));
    } else if (product.rawInputData && typeof product.rawInputData === 'object') {
      const rawData = product.rawInputData as any;
      if (Array.isArray(rawData.imagePaths)) {
        imagePaths = rawData.imagePaths;
      }
    }

    if (imagePaths.length === 0) {
      return res.status(400).json({ error: 'No image source files found for re-enhancement' });
    }

    const rawData = product.rawInputData as any;
    const job = await listingQueue.add({
      productId: product.id,
      input: {
        name: rawData.name || product.name,
        category: rawData.category || product.category,
        metal: rawData.metal || product.metal,
        finish: rawData.finish || product.finish,
        weightGrams: rawData.weightGrams || product.weightGrams,
        stoneType: rawData.stoneType || product.stoneType,
        occasion: rawData.occasion || product.occasion,
        priceINR: rawData.priceINR || product.priceINR,
        originalPriceINR: rawData.originalPriceINR || product.originalPriceINR,
        imagePaths
      }
    });

    return res.json({
      jobId: job.id,
      status: 'processing'
    });

  } catch (err) {
    next(err);
  }
});

export default router;
