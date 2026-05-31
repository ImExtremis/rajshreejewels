import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../services/db';
import { catchAsync, AppError } from '../utils/errors';
import { Category, Metal, Finish, ItemStatus } from '@prisma/client';

const router = Router();

// Zod schemas for query validation
const listProductsSchema = z.object({
  category: z.string().optional(),
  metal: z.string().optional(),
  finish: z.string().optional(),
  minPrice: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().nonnegative().optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc']).default('newest'),
  search: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(24),
});

// GET /products - List all AVAILABLE products with filtering, search, pagination
router.get(
  '/',
  catchAsync(async (req: Request, res: Response) => {
    const cleanedQuery = { ...req.query };
    for (const key in cleanedQuery) {
      if (
        cleanedQuery[key] === '' ||
        cleanedQuery[key] === 'ALL' ||
        (key === 'minPrice' && cleanedQuery[key] === '0')
      ) {
        delete cleanedQuery[key];
      }
    }
    const validatedQuery = listProductsSchema.parse(cleanedQuery);
    const { category, metal, finish, minPrice, maxPrice, sort, search, page, limit } = validatedQuery;

    const skip = (page - 1) * limit;

    // Define base filter for Prisma (only AVAILABLE items are listed publicly)
    const whereClause: any = {
      status: ItemStatus.AVAILABLE,
    };

    const validCategories = ['NECKLACE', 'EARRINGS', 'BANGLES', 'BRACELET', 'RING', 'ANKLET', 'MAANG_TIKKA', 'NOSE_PIN', 'PENDANT', 'SET', 'OTHER'];
    const validMetals = ['GOLD_1GRAM', 'SILVER', 'BRASS', 'COPPER', 'ALLOY', 'NONE'];
    const validFinishes = ['GOLD_POLISH', 'SILVER_POLISH', 'ANTIQUE', 'MATTE', 'RHODIUM', 'OXIDISED', 'MEENAKARI', 'KUNDAN', 'NONE'];

    if (category && validCategories.includes(category as string)) {
      whereClause.category = category as Category;
    }
    if (metal && validMetals.includes(metal as string)) {
      whereClause.metal = metal as Metal;
    }
    if (finish && validFinishes.includes(finish as string)) {
      whereClause.finish = finish as Finish;
    }

    // Price range filters
    if (minPrice !== undefined || maxPrice !== undefined) {
      whereClause.priceINR = {};
      if (minPrice !== undefined) whereClause.priceINR.gte = minPrice;
      if (maxPrice !== undefined) whereClause.priceINR.lte = maxPrice;
    }

    // Define sorting
    let orderByClause: any = { listedAt: 'desc' };
    if (sort === 'price_asc') {
      orderByClause = { priceINR: 'asc' };
    } else if (sort === 'price_desc') {
      orderByClause = { priceINR: 'desc' };
    }

    let products = [];
    let totalCount = 0;

    // Full-text search with Postgres ts_vector
    if (search) {
      // In Postgres, to search:
      // We will perform a raw query to fetch matching IDs and then query the database.
      // Coalescing fields to empty strings and joining with space.
      // Since arrays in postgres are not direct strings, array_to_string is used for keywords.
      try {
        const searchResults: Array<{ id: string }> = await prisma.$queryRawUnsafe(`
          SELECT id FROM "Product"
          WHERE to_tsvector('english', 
            coalesce("displayName", '') || ' ' || 
            coalesce("description", '') || ' ' || 
            coalesce(array_to_string("keywords", ' '), '')
          ) @@ websearch_to_tsquery('english', $1)
          AND "status" = 'AVAILABLE'
        `, search);

        const matchedIds = searchResults.map(r => r.id);

        if (matchedIds.length === 0) {
          return res.json({
            products: [],
            pagination: {
              total: 0,
              page,
              limit,
              pages: 0,
            }
          });
        }

        // Apply filters on the matched IDs
        whereClause.id = { in: matchedIds };

        totalCount = await prisma.product.count({ where: whereClause });
        products = await prisma.product.findMany({
          where: whereClause,
          include: {
            images: {
              orderBy: { order: 'asc' }
            }
          },
          orderBy: orderByClause,
          skip,
          take: limit,
        });
      } catch (error: any) {
        // Fallback search using Prisma's standard OR query if tsquery has syntax issue or pg error
        console.warn('⚠️ Full text search failed, falling back to simple search:', error.message);
        const fallbackSearch = `%${search}%`;
        
        whereClause.OR = [
          { displayName: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { keywords: { has: search } }
        ];

        totalCount = await prisma.product.count({ where: whereClause });
        products = await prisma.product.findMany({
          where: whereClause,
          include: {
            images: {
              orderBy: { order: 'asc' }
            }
          },
          orderBy: orderByClause,
          skip,
          take: limit,
        });
      }
    } else {
      // Standard listing without search term
      totalCount = await prisma.product.count({ where: whereClause });
      products = await prisma.product.findMany({
        where: whereClause,
        include: {
          images: {
            orderBy: { order: 'asc' }
          }
        },
        orderBy: orderByClause,
        skip,
        take: limit,
      });
    }

    const salesProducts = await applySitewideSale(products);

    res.json({
      products: salesProducts,
      pagination: {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit),
      }
    });
  })
);

// Helper function to dynamically apply sitewide sale discount to products
async function applySitewideSale(products: any | any[]) {
  const sale = await prisma.siteSale.findUnique({ where: { id: '1' } });
  const saleActive = sale?.isActive && (
    (!sale.startsAt || sale.startsAt <= new Date()) &&
    (!sale.endsAt || sale.endsAt >= new Date())
  );

  const apply = (p: any) => {
    if (!p) return p;
    if (!saleActive) return p;
    return {
      ...p,
      originalPriceINR: p.originalPriceINR || p.priceINR,
      priceINR: Math.floor(p.priceINR * (1 - sale.discountPct / 100)),
      saleActive: true,
      saleLabel: sale.label,
      saleDiscountPct: sale.discountPct,
    };
  };

  if (Array.isArray(products)) {
    return products.map(apply);
  }
  return apply(products);
}

// GET /products/category/:category - List products by category specifically
router.get(
  '/category/:category',
  catchAsync(async (req: Request, res: Response) => {
    const categoryParam = req.params.category.toUpperCase();
    
    // Validate category parameter
    const categoryParsed = z.nativeEnum(Category).safeParse(categoryParam);
    if (!categoryParsed.success) {
      throw new AppError('Invalid category value', 400, 'INVALID_CATEGORY');
    }

    const products = await prisma.product.findMany({
      where: {
        category: categoryParsed.data,
        status: ItemStatus.AVAILABLE,
      },
      include: {
        images: {
          orderBy: { order: 'asc' }
        }
      },
      orderBy: { listedAt: 'desc' }
    });

    const salesProducts = await applySitewideSale(products);

    res.json({
      products: salesProducts,
      count: products.length
    });
  })
);

// GET /products/:slug - Fetch single product by URL slug
router.get(
  '/:slug',
  catchAsync(async (req: Request, res: Response) => {
    const { slug } = req.params;

    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        images: {
          orderBy: { order: 'asc' }
        }
      }
    });

    if (!product) {
      throw new AppError('Product not found', 404, 'NOT_FOUND');
    }

    const salesProduct = await applySitewideSale(product);
    res.json(salesProduct);
  })
);

// GET /products/id/:id - Fetch single product by ID
router.get(
  '/id/:id',
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        images: {
          orderBy: { order: 'asc' }
        }
      }
    });

    if (!product) {
      throw new AppError('Product not found', 404, 'NOT_FOUND');
    }

    const salesProduct = await applySitewideSale(product);
    res.json(salesProduct);
  })
);

export default router;

