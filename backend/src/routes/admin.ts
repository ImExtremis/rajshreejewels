import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../services/db';
import redis from '../services/redis';
import { auth } from '../middleware/auth';
import { ItemStatus, OrderStatus } from '@prisma/client';
import { z } from 'zod';
import { initiateRazorpayRefund } from '../services/payment';
import { notificationsService, notifyWishlistOnRelist, sendShippedSMS } from '../services/notifications';
import { AppError, catchAsync } from '../utils/errors';
import { shiprocketService } from '../services/shiprocket';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { processProductImages, cleanupTempFiles } from '../services/imageProcessor';
import { sanitiseHtml, stripHtml } from '../utils/sanitiser';
import { triggerRevalidation } from '../services/revalidator';
import { config } from '../config';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { requirePermission } from '../middleware/requirePermission';
import { ALL_PERMISSIONS, OWNER_ONLY_PERMISSIONS } from '../types/permissions';
import { resolvePermissions, hasPermission } from '../services/permissions';

const router = Router();

// Ensure uploads directory exists
const UPLOAD_DIR = '/tmp/admin-uploads/';
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

const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Helper: Owner Check
const requireOwner = async (req: any, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || !user.isOwner) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Owner access required' });
    }
    next();
  } catch (err) {
    next(err);
  }
};

// Helper: Blur customer details
async function blurCustomerDetails(orders: any[], userId: string) {
  const allowed = await hasPermission(userId, 'orders.view_customer');
  if (!allowed) {
    for (const order of orders) {
      if (order.user) {
        order.user.name = '••••••';
        order.user.email = '••••••@••••.com';
        order.user.phone = '••••••••••';
      }
      if (order.address) {
        order.address.name = '••••••';
        order.address.phone = '••••••••••';
        order.address.line1 = '••••••';
        order.address.line2 = '••••••';
        order.address.city = '••••••';
        order.address.state = '••••••';
      }
    }
  }
}

// ─── PART 1: FIRST-TIME ADMIN SETUP ──────────────────────────

// GET /api/v1/admin/setup/status — no auth — returns { setupComplete: boolean }
router.get(
  '/setup/status',
  catchAsync(async (req: Request, res: Response) => {
    const ownerExists = await prisma.user.findFirst({
      where: { isOwner: true }
    });
    res.json({ setupComplete: !!ownerExists });
  })
);

// GET /api/v1/admin/init — Combined setup status, dashboard stats, and user profile in a single call
router.get(
  '/init',
  auth,
  catchAsync(async (req: any, res: Response) => {
    // 1. Fetch user profile + permissions
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });
    if (!user || !user.isAdmin) {
      throw new AppError('Forbidden: Admin access required', 403, 'FORBIDDEN');
    }
    const resolvedPermissions = await resolvePermissions(user.id);
    const userProfile = {
      id: user.id,
      name: user.name,
      email: user.email,
      isOwner: user.isOwner,
      permissions: resolvedPermissions
    };

    // 2. Fetch setup status
    const ownerExists = await prisma.user.findFirst({
      where: { isOwner: true }
    });
    const setupStatus = { setupComplete: !!ownerExists };

    // 3. Fetch dashboard stats (if permitted, otherwise empty/skipped)
    let dashboardStats = null;
    const canViewAnalytics = user.isOwner || resolvedPermissions?.['analytics.view'] === true;
    if (canViewAnalytics) {
      const todayStart = startOfDay(new Date());

      const [
        totalOrders,
        confirmedOrders,
        revenueTodayAgg,
        revenueTotalAgg,
        pendingShipments,
        newOrdersToday,
        availableItems,
        soldItems,
        unverifiedCustomersCount,
      ] = await Promise.all([
        prisma.order.count(),
        prisma.order.count({ where: { status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED'] } } }),
        prisma.order.aggregate({
          where: {
            status: 'CONFIRMED',
            paidAt: { gte: todayStart }
          },
          _sum: { totalINR: true }
        }),
        prisma.order.aggregate({
          where: { status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] } },
          _sum: { totalINR: true }
        }),
        prisma.order.count({ where: { status: 'CONFIRMED' } }),
        prisma.order.count({
          where: { createdAt: { gte: todayStart } }
        }),
        prisma.product.count({ where: { status: 'AVAILABLE' } }),
        prisma.product.count({ where: { status: 'SOLD' } }),
        prisma.user.count({ where: { isAdmin: false, isOwner: false, isVerified: false } }),
      ]);

      const recentOrders = await prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            include: {
              images: {
                orderBy: { order: 'asc' },
                take: 1
              }
            }
          },
          user: true,
          address: true
        }
      });

      await blurCustomerDetails(recentOrders, req.user.id);

      const unrepliedMessages = await prisma.orderMessage.count({
        where: { fromType: 'CUSTOMER', readAt: null }
      });

      dashboardStats = {
        revenue: {
          today: revenueTodayAgg._sum.totalINR || 0,
          total: revenueTotalAgg._sum.totalINR || 0
        },
        orders: {
          total: totalOrders,
          today: newOrdersToday,
          pendingShipment: pendingShipments,
          active: confirmedOrders
        },
        inventory: {
          available: availableItems,
          sold: soldItems
        },
        recentOrders,
        unrepliedMessages,
        unverifiedCustomersCount
      };
    }

    res.json({
      user: userProfile,
      setupStatus,
      dashboardStats
    });
  })
);

// POST /api/v1/admin/setup/create-owner — no auth
router.post(
  '/setup/create-owner',
  catchAsync(async (req: Request, res: Response) => {
    // Prevent race conditions
    const ownerExists = await prisma.user.findFirst({
      where: { isOwner: true }
    });
    if (ownerExists) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Owner account already configured' });
    }

    const createOwnerSchema = z.object({
      name: z.string().min(2),
      email: z.string().email(),
      username: z.string().regex(/^[a-zA-Z0-9_]+$/).min(3).max(20),
      password: z.string().min(10),
      confirmPassword: z.string()
    });

    const body = createOwnerSchema.parse(req.body);
    if (body.password !== body.confirmPassword) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Passwords do not match' });
    }

    const passwordHash = await bcrypt.hash(body.password, 12);

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        passwordHash,
        isAdmin: true,
        isVerified: true,
        isOwner: true,
      }
    });

    await prisma.adminUser.create({
      data: {
        userId: user.id,
        username: body.username.toLowerCase().trim(),
        permissionOverrides: {}
      }
    });

    const payload = { userId: user.id, email: user.email, isAdmin: true, isOwner: true };
    const accessToken = jwt.sign(payload, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN as any });
    const refreshToken = jwt.sign(payload, config.JWT_REFRESH_SECRET, { expiresIn: config.JWT_REFRESH_EXPIRES_IN as any });

    await prisma.session.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isAdmin: true,
        isOwner: true
      }
    });
  })
);

// PUT /api/v1/admin/profile/password — auth required
router.put(
  '/profile/password',
  auth,
  catchAsync(async (req: any, res: Response) => {
    const passwordSchema = z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(10, 'Password must be at least 10 characters'),
    });

    const { currentPassword, newPassword } = passwordSchema.parse(req.body);
    const userId = req.user.id;

    // Retrieve user
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) {
      throw new AppError('User not found', 404);
    }

    // Verify current password
    const isMatched = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatched) {
      return res.status(400).json({ error: 'INCORRECT_CURRENT_PASSWORD', message: 'Current password entered is incorrect' });
    }

    // Hash new password
    const newHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    // Invalidate all other sessions (delete all session tokens for this user)
    await prisma.session.deleteMany({
      where: { userId }
    });

    res.json({ success: true, message: 'Password updated successfully' });
  })
);

// ─── GET /admin/dashboard ───────────────────────────────────
router.get(
  '/dashboard',
  auth,
  requirePermission('analytics.view'),
  catchAsync(async (req: any, res: Response) => {
    const todayStart = startOfDay(new Date());

    const [
      totalOrders,
      confirmedOrders,
      revenueTodayAgg,
      revenueTotalAgg,
      pendingShipments,
      newOrdersToday,
      availableItems,
      soldItems,
      unverifiedCustomersCount,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED'] } } }),
      prisma.order.aggregate({
        where: {
          status: 'CONFIRMED',
          paidAt: { gte: todayStart }
        },
        _sum: { totalINR: true }
      }),
      prisma.order.aggregate({
        where: { status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] } },
        _sum: { totalINR: true }
      }),
      prisma.order.count({ where: { status: 'CONFIRMED' } }),
      prisma.order.count({
        where: { createdAt: { gte: todayStart } }
      }),
      prisma.product.count({ where: { status: 'AVAILABLE' } }),
      prisma.product.count({ where: { status: 'SOLD' } }),
      prisma.user.count({ where: { isAdmin: false, isOwner: false, isVerified: false } }),
    ]);

    const recentOrders = await prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          include: {
            images: {
              orderBy: { order: 'asc' },
              take: 1
            }
          }
        },
        user: true,
        address: true
      }
    });

    await blurCustomerDetails(recentOrders, req.user.id);

    // Unread message count
    const unrepliedMessages = await prisma.orderMessage.count({
      where: { fromType: 'CUSTOMER', readAt: null }
    });

    res.json({
      revenue: {
        today: revenueTodayAgg._sum.totalINR || 0,
        total: revenueTotalAgg._sum.totalINR || 0
      },
      orders: {
        total: totalOrders,
        today: newOrdersToday,
        pendingShipment: pendingShipments,
        active: confirmedOrders
      },
      inventory: {
        available: availableItems,
        sold: soldItems
      },
      recentOrders,
      unrepliedMessages,
      unverifiedCustomersCount
    });
  })
);

// ─── GET /admin/orders ──────────────────────────────────────
router.get(
  '/orders',
  auth,
  requirePermission('orders.view'),
  catchAsync(async (req: any, res: Response) => {
    const status = req.query.status as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;

    const skip = (page - 1) * limit;

    const where: any = {};
    if (status && status !== 'All' && status !== 'undefined') {
      where.status = status as OrderStatus;
    }

    if (search && search.trim() !== '') {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { address: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            include: {
              images: {
                orderBy: { order: 'asc' },
                take: 1
              }
            }
          },
          user: true,
          address: true
        }
      }),
      prisma.order.count({ where })
    ]);

    await blurCustomerDetails(orders, req.user.id);

    res.json({
      orders,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  })
);

// ─── GET /admin/orders/:id ──────────────────────────────────
router.get(
  '/orders/:id',
  auth,
  requirePermission('orders.view'),
  catchAsync(async (req: any, res: Response) => {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        product: {
          include: {
            images: {
              orderBy: { order: 'asc' }
            }
          }
        },
        user: true,
        address: true,
        invoice: true
      }
    });

    if (!order) {
      throw new AppError('Order not found', 404, 'NOT_FOUND');
    }

    const wrapped = [order];
    await blurCustomerDetails(wrapped, req.user.id);

    res.json(wrapped[0]);
  })
);

const legalTransitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['PAYMENT_FAILED', 'CONFIRMED', 'CANCELLED', 'REFUNDED'],
  PAYMENT_FAILED: ['REFUNDED'],
  CONFIRMED: ['PROCESSING', 'SHIPPED', 'CANCELLED', 'REFUNDED'],
  PROCESSING: ['SHIPPED', 'CANCELLED', 'REFUNDED'],
  SHIPPED: ['DELIVERED', 'CANCELLED', 'REFUNDED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: ['REFUNDED'],
  REFUNDED: []
};

// ─── PUT /admin/orders/:id/status ───────────────────────────
router.put(
  '/orders/:id/status',
  auth,
  requirePermission('orders.update_status'),
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, adminNote } = z.object({
      status: z.nativeEnum(OrderStatus),
      adminNote: z.string().optional()
    }).parse(req.body);

    const order = await prisma.order.findUnique({
      where: { id }
    });

    if (!order) {
      throw new AppError('Order not found', 404, 'NOT_FOUND');
    }

    const allowed = legalTransitions[order.status] || [];
    if (!allowed.includes(status) && order.status !== status) {
      throw new AppError(`Forbidden status transition from ${order.status} to ${status}`, 400, 'FORBIDDEN_TRANSITION');
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        status,
        adminNote: adminNote !== undefined ? adminNote : order.adminNote,
        deliveredAt: status === 'DELIVERED' ? new Date() : order.deliveredAt
      },
      include: { product: true, user: true, address: true }
    });

    if (status === 'CANCELLED' && !order.awbCode) {
      await prisma.product.update({
        where: { id: order.productId },
        data: { status: 'AVAILABLE', soldAt: null }
      });
      await notifyWishlistOnRelist(order.productId);
    }

    if (status === 'CANCELLED' && order.shiprocketOrderId) {
      try {
        await shiprocketService.cancelShiprocketOrder(order.shiprocketOrderId);
      } catch (err: any) {
        console.error(`⚠️ Failed to cancel order ${order.orderNumber} in Shiprocket:`, err.message);
      }
    }

    res.json(updatedOrder);
  })
);

// ─── PUT /admin/orders/:id/shipping ─────────────────────────
router.put(
  '/orders/:id/shipping',
  auth,
  requirePermission('orders.manual_shipping'),
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { awbCode, courierName, trackingUrl } = z.object({
      awbCode: z.string().min(3),
      courierName: z.string().min(2),
      trackingUrl: z.string().url().optional()
    }).parse(req.body);

    const order = await prisma.order.findUnique({
      where: { id }
    });

    if (!order) {
      throw new AppError('Order not found', 404, 'NOT_FOUND');
    }

    const finalTrackingUrl = trackingUrl || `https://shiprocket.co/tracking/${awbCode}`;

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        awbCode,
        courierName,
        trackingUrl: finalTrackingUrl,
        status: 'SHIPPED',
        shippedAt: new Date()
      },
      include: { product: true, user: true, address: true }
    });

    await notificationsService.sendShippingNotificationEmail(updatedOrder, awbCode);

    if (updatedOrder.user.phone) {
      await sendShippedSMS(
        updatedOrder.user.phone,
        updatedOrder.user.name,
        updatedOrder.orderNumber,
        courierName,
        finalTrackingUrl
      ).catch(err => {
        console.error('❌ Failed to send manual Shipped SMS:', err);
      });
    }

    res.json(updatedOrder);
  })
);

// ─── GET /admin/orders/:id/couriers ─────────────────────────
router.get(
  '/orders/:id/couriers',
  auth,
  requirePermission('orders.book_courier'),
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: { product: true, address: true }
    });

    if (!order) {
      throw new AppError('Order not found', 404, 'NOT_FOUND');
    }

    const weightGrams = order.product.weightGrams ?? 100;
    const weightKg = (weightGrams / 1000) + 0.1;
    const codRequired = order.paymentMethod === 'COD';
    const pickupPincode = process.env.SHIPROCKET_PICKUP_PINCODE || '302001';
    const deliveryPincode = order.address.pincode;

    try {
      const couriers = await shiprocketService.getAvailableCouriers(
        pickupPincode,
        deliveryPincode,
        weightKg,
        codRequired
      );

      if (couriers.length === 0) {
        return res.status(200).json({
          error: 'PINCODE_NOT_SERVICEABLE',
          pincode: deliveryPincode,
          message: 'No couriers service this pincode via Shiprocket. Book manually.'
        });
      }

      const recommended = shiprocketService.selectBestCourier(couriers, codRequired);

      res.json({ couriers, recommended });
    } catch (err: any) {
      console.error('❌ Shiprocket serviceability error:', err.message || err);
      return res.status(200).json({
        error: 'PINCODE_NOT_SERVICEABLE',
        pincode: deliveryPincode,
        message: err.message || 'No couriers service this pincode via Shiprocket. Book manually.'
      });
    }
  })
);

// ─── POST /admin/orders/:id/book-courier ────────────────────
router.post(
  '/orders/:id/book-courier',
  auth,
  requirePermission('orders.book_courier'),
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { courierOverride } = z.object({
      courierOverride: z.number().optional()
    }).parse(req.body);

    try {
      await shiprocketService.bookShipment(id, courierOverride);
      
      const updatedOrder = await prisma.order.findUnique({
        where: { id },
        include: { product: true, user: true, address: true }
      });
      res.json(updatedOrder);
    } catch (err: any) {
      res.status(400).json({
        error: 'SHIPROCKET_BOOKING_FAILED',
        details: err.message || err
      });
    }
  })
);

// ─── GET /admin/orders/:id/invoice ──────────────────────────
router.get(
  '/orders/:id/invoice',
  auth,
  requirePermission('finance.view_invoices'),
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { invoice: true }
    });

    if (!order) {
      throw new AppError('Order not found', 404, 'NOT_FOUND');
    }

    if (!order.invoice) {
      return res.status(202).json({ error: 'INVOICE_NOT_READY' });
    }

    const pdfPath = order.invoice.pdfPath;
    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({ error: 'INVOICE_FILE_NOT_FOUND' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Invoice-${order.invoice.invoiceNo}.pdf`);
    fs.createReadStream(pdfPath).pipe(res);
  })
);

// ─── GET /admin/products ────────────────────────────────────
router.get(
  '/products',
  auth,
  requirePermission('listing.edit'),
  catchAsync(async (req: Request, res: Response) => {
    const statusQuery = req.query.status as string | undefined;
    const search = req.query.search as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 24;

    const skip = (page - 1) * limit;

    const where: any = {};
    if (statusQuery && statusQuery !== 'All' && statusQuery !== 'undefined') {
      where.status = statusQuery as ItemStatus;
    }

    if (search && search.trim() !== '') {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { listedAt: 'desc' },
        skip,
        take: limit,
        include: {
          images: {
            orderBy: { order: 'asc' }
          },
          tags: { include: { tag: true } }
        }
      }),
      prisma.product.count({ where })
    ]);

    res.json({
      products,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  })
);

// ─── POST /admin/products ───────────────────────────────────
router.post(
  '/products',
  auth,
  requirePermission('listing.create'),
  catchAsync(async (req: Request, res: Response) => {
    const createSchema = z.object({
      name: z.string().min(3),
      category: z.string(),
      metal: z.string(),
      finish: z.string(),
      weightGrams: z.number().nullable().optional(),
      stoneType: z.string().nullable().optional(),
      occasion: z.string().nullable().optional(),
      priceINR: z.number().int().positive(),
      originalPriceINR: z.number().int().positive().nullable().optional(),
      status: z.enum(['AVAILABLE', 'UNLISTED', 'SOLD']).default('UNLISTED'),
    });

    const body = createSchema.parse(req.body);

    const slug = `prod-${Date.now()}-${Math.round(Math.random() * 1000)}`;

    const newProduct = await prisma.product.create({
      data: {
        name: body.name,
        displayName: body.name,
        slug,
        category: body.category as any,
        metal: body.metal as any,
        finish: body.finish as any,
        weightGrams: body.weightGrams ?? null,
        stoneType: body.stoneType ?? null,
        occasion: body.occasion ?? null,
        priceINR: body.priceINR,
        originalPriceINR: body.originalPriceINR ?? null,
        status: body.status,
        primaryImageUrl: '',
        description: '',
        shortDesc: '',
      }
    });

    res.status(201).json(newProduct);
  })
);

// ─── PUT /admin/products/:id ────────────────────────────────
router.put(
  '/products/:id',
  auth,
  requirePermission('listing.edit'),
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    const updateSchema = z.object({
      displayName: z.string().min(3),
      description: z.string(),
      shortDesc: z.string().max(55),
      priceINR: z.number().int().positive(),
      originalPriceINR: z.number().int().positive().nullable(),
      metaTitle: z.string(),
      metaDescription: z.string(),
      keywords: z.array(z.string()),
      occasion: z.string().nullable().optional(),
      status: z.enum(['AVAILABLE', 'SOLD', 'UNLISTED']),
    }).partial();

    const data = updateSchema.parse(req.body);

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new AppError('Product not found', 404, 'NOT_FOUND');
    }

    const sanitisedData: any = { ...data };
    if (data.displayName !== undefined) sanitisedData.displayName = stripHtml(data.displayName);
    if (data.shortDesc !== undefined) sanitisedData.shortDesc = stripHtml(data.shortDesc);
    if (data.description !== undefined) sanitisedData.description = sanitiseHtml(data.description);
    if (data.metaTitle !== undefined) sanitisedData.metaTitle = stripHtml(data.metaTitle);
    if (data.metaDescription !== undefined) sanitisedData.metaDescription = stripHtml(data.metaDescription);
    if (data.occasion !== undefined) sanitisedData.occasion = data.occasion ? stripHtml(data.occasion) : null;
    if (data.keywords !== undefined) {
      sanitisedData.keywords = data.keywords.map(kw => stripHtml(kw)).filter(Boolean);
    }

    const updated = await prisma.product.update({
      where: { id },
      data: sanitisedData,
      include: { images: true }
    });

    triggerRevalidation(updated.slug);

    res.json(updated);
  })
);

// ─── PUT /admin/products/:id/status ─────────────────────────
router.put(
  '/products/:id/status',
  auth,
  requirePermission('listing.relist'),
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = z.object({
      status: z.enum(['AVAILABLE', 'UNLISTED'])
    }).parse(req.body);

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new AppError('Product not found', 404, 'NOT_FOUND');
    }

    const wasSoldOrUnlisted = product.status === 'SOLD' || product.status === 'UNLISTED';

    const updated = await prisma.product.update({
      where: { id },
      data: {
        status,
        soldAt: status === 'AVAILABLE' ? null : product.soldAt
      }
    });

    if (status === 'AVAILABLE' && wasSoldOrUnlisted) {
      await notifyWishlistOnRelist(id);
    }

    triggerRevalidation(updated.slug);

    res.json(updated);
  })
);

// ─── DELETE /admin/products/:id ─────────────────────────────
router.delete(
  '/products/:id',
  auth,
  requirePermission('listing.delete'),
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: { images: true }
    });
    if (!product) {
      throw new AppError('Product not found', 404, 'NOT_FOUND');
    }

    const orderCount = await prisma.order.count({ where: { productId: id } });
    if (orderCount > 0) {
      return res.status(409).json({
        error: 'PRODUCT_HAS_ORDERS',
        message: 'This product has order history and cannot be permanently deleted. Unlist it instead to hide it from the storefront.'
      });
    }

    for (const image of product.images) {
      for (const urlPath of [image.urlThumb, image.urlMedium, image.urlFull]) {
        if (!urlPath) continue;
        const fullDiskPath = urlPath.replace('/images/products/', '/data/images/products/');
        try {
          if (fs.existsSync(fullDiskPath)) {
            fs.unlinkSync(fullDiskPath);
          }
        } catch (err: any) {
          console.error(`Failed to delete image file ${fullDiskPath}:`, err.message);
        }
      }
    }

    await prisma.product.delete({ where: { id } });

    triggerRevalidation(product.slug);

    res.json({ success: true });
  })
);

// ─── GET /admin/settings ────────────────────────────────────
router.get(
  '/settings',
  auth,
  requirePermission('settings.store'),
  catchAsync(async (req: Request, res: Response) => {
    const settings = await prisma.siteSetting.findMany();
    const settingsMap = settings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);

    res.json(settingsMap);
  })
);

// ─── PUT /admin/settings ────────────────────────────────────
router.put(
  '/settings',
  auth,
  requirePermission('settings.store'),
  catchAsync(async (req: Request, res: Response) => {
    const settings = z.record(z.string()).parse(req.body);

    const upserts = Object.entries(settings).map(([key, value]) => {
      return prisma.siteSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value }
      });
    });

    await prisma.$transaction(upserts);

    const updatedSettings = await prisma.siteSetting.findMany();
    const settingsMap = updatedSettings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);

    res.json(settingsMap);
  })
);

// ─── POST /admin/orders/:id/refund ──────────────────────────
router.post(
  '/orders/:id/refund',
  auth,
  requirePermission('finance.issue_refund'),
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { reason } = z.object({
      reason: z.string().min(5).max(500)
    }).parse(req.body);

    const order = await prisma.order.findUnique({
      where: { id },
      include: { user: true, product: true }
    });

    if (!order) {
      throw new AppError('Order not found', 404, 'NOT_FOUND');
    }

    if (order.status !== 'CONFIRMED' && order.status !== 'SHIPPED') {
      throw new AppError('Cannot refund orders that are not CONFIRMED or SHIPPED', 400, 'BAD_REQUEST');
    }

    let refundId = 'MANUAL_COD_REFUND';

    if (order.paymentMethod !== 'COD' && order.razorpayPaymentId) {
      const refundResult = await initiateRazorpayRefund(order.razorpayPaymentId, order.totalINR, {
        reason,
        orderId: order.id
      });
      refundId = refundResult.id;
    }

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: { status: 'REFUNDED' },
      include: { user: true, product: true }
    });

    if (!order.awbCode) {
      await prisma.product.update({
        where: { id: order.productId },
        data: {
          status: 'AVAILABLE',
          soldAt: null
        }
      });

      await notifyWishlistOnRelist(order.productId);
    }

    await notificationsService.sendRefundInitiatedEmail(updatedOrder);

    res.json(updatedOrder);
  })
);

// ─── POST /admin/products/:id/images ─────────────────────────
router.post(
  '/products/:id/images',
  auth,
  requirePermission('listing.edit'),
  (req: any, res: Response, next: NextFunction) => {
    upload.array('images', 6)(req, res, async (err) => {
      if (err) {
        if (err.message === 'INVALID_FILE_TYPE' || err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({ error: 'INVALID_FILE_TYPE' });
        }
        return next(err);
      }

      const { id } = req.params;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'At least one photo is required' });
      }

      try {
        const product = await prisma.product.findUnique({ where: { id } });
        if (!product) {
          cleanupTempFiles(files.map(f => f.path));
          return res.status(404).json({ error: 'Product not found' });
        }

        const processed = await processProductImages(id, files.map(f => f.path), product.displayName);
        cleanupTempFiles(files.map(f => f.path));

        const existingCount = await prisma.productImage.count({ where: { productId: id } });

        const dbImages = processed.map((img, index) => ({
          productId: id,
          url: img.url,
          urlThumb: img.urlThumb,
          urlMedium: img.urlMedium,
          urlFull: img.urlFull,
          order: existingCount + index,
          altText: img.altText,
        }));

        await prisma.productImage.createMany({ data: dbImages });

        if ((!product.primaryImageUrl || product.primaryImageUrl === '') && dbImages.length > 0) {
          await prisma.product.update({
            where: { id },
            data: { primaryImageUrl: dbImages[0].urlMedium }
          });
        }

        const updatedImages = await prisma.productImage.findMany({
          where: { productId: id },
          orderBy: { order: 'asc' }
        });

        triggerRevalidation(product.slug);

        res.status(201).json(updatedImages);
      } catch (dbErr: any) {
        cleanupTempFiles(files.map(f => f.path));
        next(dbErr);
      }
    });
  }
);

// ─── DELETE /admin/products/:id/images/:imageId ──────────────
router.delete(
  '/products/:id/images/:imageId',
  auth,
  requirePermission('listing.edit'),
  catchAsync(async (req: Request, res: Response) => {
    const { id, imageId } = req.params;

    const imageRecord = await prisma.productImage.findFirst({
      where: { id: imageId, productId: id }
    });

    if (!imageRecord) {
      throw new AppError('Image not found', 404, 'NOT_FOUND');
    }

    const sizes = [imageRecord.urlThumb, imageRecord.urlMedium, imageRecord.urlFull];
    for (const urlPath of sizes) {
      if (urlPath) {
        const fullDiskPath = urlPath.replace('/images/products/', '/data/images/products/');
        try {
          if (fs.existsSync(fullDiskPath)) {
            fs.unlinkSync(fullDiskPath);
          }
        } catch (err: any) {
          console.error(`⚠️ Failed to delete image file ${fullDiskPath}:`, err.message);
        }
      }
    }

    await prisma.productImage.delete({ where: { id: imageId } });

    const remaining = await prisma.productImage.findMany({
      where: { productId: id },
      orderBy: { order: 'asc' }
    });

    if (remaining.length > 0) {
      const updates = remaining.map((img, index) => {
        return prisma.productImage.update({
          where: { id: img.id },
          data: { order: index }
        });
      });
      await prisma.$transaction(updates);

      await prisma.product.update({
        where: { id },
        data: { primaryImageUrl: remaining[0].urlMedium }
      });
    } else {
      await prisma.product.update({
        where: { id },
        data: { primaryImageUrl: '' }
      });
    }

    // Revalidate using product slug (fetch since product is not in scope here)
    const productForSlug = await prisma.product.findUnique({
      where: { id },
      select: { slug: true }
    });
    if (productForSlug) {
      triggerRevalidation(productForSlug.slug);
    }

    res.json({ success: true, remainingCount: remaining.length });
  })
);

// ─── PUT /admin/products/:id/images/reorder ──────────────────
router.put(
  '/products/:id/images/reorder',
  auth,
  requirePermission('listing.reorder_images'),
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { imageOrder } = z.object({
      imageOrder: z.array(z.string())
    }).parse(req.body);

    const updates = imageOrder.map((imageId, index) => {
      return prisma.productImage.update({
        where: { id: imageId, productId: id },
        data: { order: index }
      });
    });

    await prisma.$transaction(updates);

    const firstImage = await prisma.productImage.findFirst({
      where: { productId: id },
      orderBy: { order: 'asc' }
    });

    if (firstImage) {
      await prisma.product.update({
        where: { id },
        data: { primaryImageUrl: firstImage.urlMedium }
      });
    }

    const updatedImages = await prisma.productImage.findMany({
      where: { productId: id },
      orderBy: { order: 'asc' }
    });

    // Use the actual product slug for ISR revalidation (not the product ID)
    const productForSlug = await prisma.product.findUnique({
      where: { id },
      select: { slug: true }
    });
    if (productForSlug) {
      triggerRevalidation(productForSlug.slug);
    }

    res.json(updatedImages);
  })
);

// ─── PART 2.5: USER & ROLE MANAGEMENT ROUTES ──────────────────

// GET /admin/users — owner only
router.get(
  '/users',
  auth,
  requireOwner,
  catchAsync(async (req: Request, res: Response) => {
    const users = await prisma.user.findMany({
      where: { isAdmin: true },
      include: {
        adminUser: true,
        userRoles: { include: { role: true } }
      }
    });

    const resolved = await Promise.all(
      users.map(async (u) => {
        const perms = await resolvePermissions(u.id);
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          isAdmin: u.isAdmin,
          isOwner: u.isOwner,
          createdAt: u.createdAt,
          adminUser: u.adminUser,
          roles: u.userRoles.map(ur => ur.role),
          permissions: perms
        };
      })
    );

    res.json(resolved);
  })
);

// POST /admin/users/invite — owner only
router.post(
  '/users/invite',
  auth,
  requireOwner,
  catchAsync(async (req: Request, res: Response) => {
    const inviteSchema = z.object({
      name: z.string().min(2),
      email: z.string().email(),
      username: z.string().regex(/^[a-zA-Z0-9_]+$/).min(3).max(20),
      roleIds: z.array(z.string())
    });

    const body = inviteSchema.parse(req.body);

    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: body.email.toLowerCase().trim(), mode: 'insensitive' } },
          { adminUser: { username: { equals: body.username.toLowerCase().trim(), mode: 'insensitive' } } }
        ]
      }
    });
    if (existing) {
      return res.status(400).json({ error: 'EMAIL_OR_USERNAME_EXISTS', message: 'User already exists' });
    }

    const tempPassword = crypto.randomBytes(8).toString('hex') + '1aA!';
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email.toLowerCase().trim(),
        passwordHash,
        isAdmin: true,
        isVerified: true,
        isOwner: false,
      }
    });

    await prisma.adminUser.create({
      data: {
        userId: user.id,
        username: body.username.toLowerCase().trim(),
        permissionOverrides: {}
      }
    });

    const userRolesData = body.roleIds.map(roleId => ({
      userId: user.id,
      roleId
    }));
    if (userRolesData.length > 0) {
      await prisma.userRole.createMany({ data: userRolesData });
    }

    // Send email notification
    try {
      await notificationsService.sendEmail({
        to: body.email,
        subject: 'Welcome to Rajshree Jewels Team — Administrative Invite',
        html: `<h1>Welcome to the team, ${body.name}!</h1>
               <p>You have been invited as an Administrator. Here are your credentials:</p>
               <p><strong>Username:</strong> ${body.username}</p>
               <p><strong>Email:</strong> ${body.email}</p>
               <p><strong>Temporary Password:</strong> ${tempPassword}</p>
               <p>Please log in at <a href="${config.ADMIN_URL}">${config.ADMIN_URL}</a> and change your password immediately.</p>`
      });
    } catch (err: any) {
      console.error('❌ Failed to send invite email:', err.message);
    }

    res.status(201).json({ success: true, userId: user.id });
  })
);

// PUT /admin/users/:id/roles — owner only
router.put(
  '/users/:id/roles',
  auth,
  requireOwner,
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { roleIds } = z.object({
      roleIds: z.array(z.string())
    }).parse(req.body);

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) return res.status(404).json({ error: 'USER_NOT_FOUND' });
    if (targetUser.isOwner) return res.status(403).json({ error: 'FORBIDDEN', message: 'Cannot modify owner roles' });

    await prisma.userRole.deleteMany({ where: { userId: id } });

    const userRolesData = roleIds.map(roleId => ({
      userId: id,
      roleId
    }));
    if (userRolesData.length > 0) {
      await prisma.userRole.createMany({ data: userRolesData });
    }

    res.json({ success: true });
  })
);

// PUT /admin/users/:id/overrides — owner only
router.put(
  '/users/:id/overrides',
  auth,
  requireOwner,
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { overrides } = z.object({
      overrides: z.record(z.boolean())
    }).parse(req.body);

    // Validate no OWNER_ONLY_PERMISSIONS are overridden
    for (const ownerPerm of OWNER_ONLY_PERMISSIONS) {
      if (overrides[ownerPerm] === true) {
        return res.status(400).json({ error: 'INVALID_OVERRIDE', message: `Cannot override owner-only permission: ${ownerPerm}` });
      }
    }

    const targetUser = await prisma.user.findUnique({ where: { id }, include: { adminUser: true } });
    if (!targetUser) return res.status(404).json({ error: 'USER_NOT_FOUND' });
    if (targetUser.isOwner) return res.status(403).json({ error: 'FORBIDDEN', message: 'Cannot override owner permissions' });

    await prisma.adminUser.update({
      where: { userId: id },
      data: { permissionOverrides: overrides }
    });

    res.json({ success: true });
  })
);

// DELETE /admin/users/:id — owner only
router.delete(
  '/users/:id',
  auth,
  requireOwner,
  catchAsync(async (req: any, res: Response) => {
    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(400).json({ error: 'SELF_DELETE', message: 'Cannot delete own account' });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) return res.status(404).json({ error: 'USER_NOT_FOUND' });
    if (targetUser.isOwner) return res.status(403).json({ error: 'FORBIDDEN', message: 'Cannot delete owner account' });

    await prisma.user.delete({ where: { id } });

    res.json({ success: true });
  })
);

// GET /admin/roles — owner only
router.get(
  '/roles',
  auth,
  requireOwner,
  catchAsync(async (req: Request, res: Response) => {
    const roles = await prisma.role.findMany({
      include: {
        _count: { select: { users: true } }
      },
      orderBy: { name: 'asc' }
    });
    res.json(roles);
  })
);

// POST /admin/roles — owner only
router.post(
  '/roles',
  auth,
  requireOwner,
  catchAsync(async (req: Request, res: Response) => {
    const roleSchema = z.object({
      name: z.string().min(2),
      description: z.string().optional(),
      color: z.string().default('#888'),
      permissions: z.record(z.boolean())
    });

    const body = roleSchema.parse(req.body);

    // Validate no OWNER_ONLY_PERMISSIONS set to true
    for (const ownerPerm of OWNER_ONLY_PERMISSIONS) {
      if (body.permissions[ownerPerm] === true) {
        return res.status(400).json({ error: 'INVALID_ROLE_PERMISSIONS', message: `Roles cannot hold owner-only permission: ${ownerPerm}` });
      }
    }

    const role = await prisma.role.create({
      data: {
        name: body.name,
        description: body.description,
        color: body.color,
        permissions: body.permissions
      }
    });

    res.status(201).json(role);
  })
);

// PUT /admin/roles/:id — owner only
router.put(
  '/roles/:id',
  auth,
  requireOwner,
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const roleSchema = z.object({
      name: z.string().min(2),
      description: z.string(),
      color: z.string(),
      permissions: z.record(z.boolean())
    }).partial();

    const body = roleSchema.parse(req.body);

    if (body.permissions) {
      for (const ownerPerm of OWNER_ONLY_PERMISSIONS) {
        if (body.permissions[ownerPerm] === true) {
          return res.status(400).json({ error: 'INVALID_ROLE_PERMISSIONS', message: `Roles cannot hold owner-only permission: ${ownerPerm}` });
        }
      }
    }

    const role = await prisma.role.update({
      where: { id },
      data: body
    });

    res.json(role);
  })
);

// DELETE /admin/roles/:id — owner only
router.delete(
  '/roles/:id',
  auth,
  requireOwner,
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;

    const userCount = await prisma.userRole.count({
      where: { roleId: id }
    });

    if (userCount > 0) {
      return res.status(400).json({ error: 'ROLE_IN_USE', userCount });
    }

    await prisma.role.delete({ where: { id } });

    res.json({ success: true });
  })
);


// ─── PART 3.2: ADMIN COUPON ROUTES ───────────────────────────

// GET /admin/coupons
router.get(
  '/coupons',
  auth,
  requirePermission('finance.manage_coupons'),
  catchAsync(async (req: Request, res: Response) => {
    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(coupons);
  })
);

// POST /admin/coupons
router.post(
  '/coupons',
  auth,
  requirePermission('finance.manage_coupons'),
  catchAsync(async (req: Request, res: Response) => {
    const couponSchema = z.object({
      code: z.string().min(3).toUpperCase(),
      description: z.string().optional(),
      type: z.enum(['PERCENTAGE', 'FIXED_INR', 'FREE_SHIPPING']),
      value: z.number().int().nonnegative(),
      minOrderINR: z.number().int().nonnegative().default(0),
      maxUsesTotal: z.number().int().nullable().optional(),
      maxUsesPerUser: z.number().int().default(1),
      validFrom: z.string().optional(),
      validUntil: z.string().nullable().optional(),
    });

    const body = couponSchema.parse(req.body);

    const existing = await prisma.coupon.findUnique({ where: { code: body.code } });
    if (existing) {
      return res.status(400).json({ error: 'COUPON_EXISTS', message: 'Coupon code already exists' });
    }

    const coupon = await prisma.coupon.create({
      data: {
        code: body.code,
        description: body.description,
        type: body.type,
        value: body.value,
        minOrderINR: body.minOrderINR,
        maxUsesTotal: body.maxUsesTotal,
        maxUsesPerUser: body.maxUsesPerUser,
        validFrom: body.validFrom ? new Date(body.validFrom) : new Date(),
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
      }
    });

    res.status(201).json(coupon);
  })
);

// PUT /admin/coupons/:id
router.put(
  '/coupons/:id',
  auth,
  requirePermission('finance.manage_coupons'),
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const couponSchema = z.object({
      description: z.string().optional(),
      type: z.enum(['PERCENTAGE', 'FIXED_INR', 'FREE_SHIPPING']),
      value: z.number().int().nonnegative(),
      minOrderINR: z.number().int().nonnegative(),
      maxUsesTotal: z.number().int().nullable().optional(),
      maxUsesPerUser: z.number().int(),
      validFrom: z.string(),
      validUntil: z.string().nullable().optional(),
      isActive: z.boolean(),
    });

    const body = couponSchema.parse(req.body);

    const coupon = await prisma.coupon.update({
      where: { id },
      data: {
        description: body.description,
        type: body.type,
        value: body.value,
        minOrderINR: body.minOrderINR,
        maxUsesTotal: body.maxUsesTotal,
        maxUsesPerUser: body.maxUsesPerUser,
        validFrom: new Date(body.validFrom),
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
        isActive: body.isActive
      }
    });

    res.json(coupon);
  })
);

// DELETE /admin/coupons/:id (Soft delete/deactivate)
router.delete(
  '/coupons/:id',
  auth,
  requirePermission('finance.manage_coupons'),
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    await prisma.coupon.update({
      where: { id },
      data: { isActive: false }
    });
    res.json({ success: true });
  })
);

// GET /admin/coupons/:id/uses
router.get(
  '/coupons/:id/uses',
  auth,
  requirePermission('finance.manage_coupons'),
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const uses = await prisma.couponUse.findMany({
      where: { couponId: id },
      include: {
        order: true,
        user: { select: { name: true, email: true } }
      },
      orderBy: { usedAt: 'desc' }
    });
    res.json(uses);
  })
);

// ─── PART 3.3: SITEWIDE SALE ─────────────────────────────────

// PUT /admin/settings/sale
router.put(
  '/settings/sale',
  auth,
  requirePermission('finance.manage_sales'),
  catchAsync(async (req: Request, res: Response) => {
    const saleSchema = z.object({
      isActive: z.boolean(),
      label: z.string(),
      discountPct: z.number().int().min(1).max(90),
      bannerText: z.string().nullable().optional(),
      startsAt: z.string().nullable().optional(),
      endsAt: z.string().nullable().optional(),
    });

    const body = saleSchema.parse(req.body);

    const sale = await prisma.siteSale.upsert({
      where: { id: '1' },
      update: {
        isActive: body.isActive,
        label: body.label,
        discountPct: body.discountPct,
        bannerText: body.bannerText,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
      },
      create: {
        id: '1',
        isActive: body.isActive,
        label: body.label,
        discountPct: body.discountPct,
        bannerText: body.bannerText,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
      }
    });

    // Revalidate product pages
    try {
      await triggerRevalidation('all'); 
    } catch (err: any) {
      console.error('⚠️ Next.js storefront revalidation failed:', err.message);
    }

    res.json(sale);
  })
);

// ─── PART 4.2: PRODUCT COLLECTIONS & TAGS ────────────────────

// GET /admin/collections
router.get(
  '/collections',
  auth,
  requirePermission('listing.manage_collections'),
  catchAsync(async (req: Request, res: Response) => {
    const collections = await prisma.collection.findMany({
      include: {
        products: {
          include: { product: true },
          orderBy: { sortOrder: 'asc' }
        }
      },
      orderBy: { sortOrder: 'asc' }
    });
    res.json(collections);
  })
);

// POST /admin/collections
router.post(
  '/collections',
  auth,
  requirePermission('listing.manage_collections'),
  catchAsync(async (req: Request, res: Response) => {
    const collectionSchema = z.object({
      name: z.string().min(2),
      slug: z.string().min(2),
      description: z.string().optional(),
      bannerImageUrl: z.string().optional(),
    });

    const body = collectionSchema.parse(req.body);

    const existing = await prisma.collection.findFirst({
      where: { OR: [{ name: body.name }, { slug: body.slug }] }
    });
    if (existing) {
      return res.status(400).json({ error: 'COLLECTION_EXISTS', message: 'Collection name or slug already exists' });
    }

    const lastCol = await prisma.collection.findFirst({ orderBy: { sortOrder: 'desc' } });
    const sortOrder = lastCol ? lastCol.sortOrder + 1 : 0;

    const collection = await prisma.collection.create({
      data: {
        name: body.name,
        slug: body.slug,
        description: body.description,
        bannerImageUrl: body.bannerImageUrl,
        sortOrder
      }
    });

    res.status(201).json(collection);
  })
);

// PUT /admin/collections/:id
router.put(
  '/collections/:id',
  auth,
  requirePermission('listing.manage_collections'),
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const collectionSchema = z.object({
      name: z.string().min(2),
      slug: z.string().min(2),
      description: z.string().optional(),
      bannerImageUrl: z.string().optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().int().optional(),
    });

    const body = collectionSchema.parse(req.body);

    const collection = await prisma.collection.update({
      where: { id },
      data: body
    });

    res.json(collection);
  })
);

// DELETE /admin/collections/:id
router.delete(
  '/collections/:id',
  auth,
  requirePermission('listing.manage_collections'),
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    await prisma.collection.delete({ where: { id } });
    res.json({ success: true });
  })
);

// POST /admin/collections/:id/products — { productIds: string[] } — add products
router.post(
  '/collections/:id/products',
  auth,
  requirePermission('listing.manage_collections'),
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { productIds } = z.object({
      productIds: z.array(z.string())
    }).parse(req.body);

    const existingCount = await prisma.collectionProduct.count({ where: { collectionId: id } });

    const collectionProducts = productIds.map((productId, index) => ({
      collectionId: id,
      productId,
      sortOrder: existingCount + index
    }));

    await prisma.collectionProduct.createMany({
      data: collectionProducts,
      skipDuplicates: true
    });

    res.json({ success: true });
  })
);

// DELETE /admin/collections/:id/products/:productId
router.delete(
  '/collections/:id/products/:productId',
  auth,
  requirePermission('listing.manage_collections'),
  catchAsync(async (req: Request, res: Response) => {
    const { id, productId } = req.params;
    await prisma.collectionProduct.delete({
      where: {
        collectionId_productId: {
          collectionId: id,
          productId
        }
      }
    });
    res.json({ success: true });
  })
);

// PUT /admin/collections/:id/products/reorder — { productOrder: string[] }
router.put(
  '/collections/:id/products/reorder',
  auth,
  requirePermission('listing.manage_collections'),
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { productOrder } = z.object({
      productOrder: z.array(z.string())
    }).parse(req.body);

    const updates = productOrder.map((productId, index) => {
      return prisma.collectionProduct.update({
        where: {
          collectionId_productId: {
            collectionId: id,
            productId
          }
        },
        data: { sortOrder: index }
      });
    });

    await prisma.$transaction(updates);

    res.json({ success: true });
  })
);

// GET /admin/tags
router.get(
  '/tags',
  auth,
  requirePermission('listing.manage_tags'),
  catchAsync(async (req: Request, res: Response) => {
    const tags = await prisma.tag.findMany({
      include: {
        _count: { select: { products: true } }
      },
      orderBy: { name: 'asc' }
    });
    res.json(tags);
  })
);

// POST /admin/tags — { name, slug }
router.post(
  '/tags',
  auth,
  requirePermission('listing.manage_tags'),
  catchAsync(async (req: Request, res: Response) => {
    const tagSchema = z.object({
      name: z.string().min(1),
      slug: z.string().min(1)
    });

    const body = tagSchema.parse(req.body);

    const existing = await prisma.tag.findFirst({
      where: { OR: [{ name: body.name }, { slug: body.slug }] }
    });

    if (existing) {
      return res.status(400).json({ error: 'TAG_EXISTS', message: 'Tag already exists' });
    }

    const tag = await prisma.tag.create({
      data: {
        name: body.name,
        slug: body.slug
      }
    });

    res.status(201).json(tag);
  })
);

// DELETE /admin/tags/:id — only if no products tagged
router.delete(
  '/tags/:id',
  auth,
  requirePermission('listing.manage_tags'),
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;

    const count = await prisma.productTag.count({ where: { tagId: id } });
    if (count > 0) {
      return res.status(400).json({ error: 'TAG_IN_USE', message: 'Cannot delete tag in use' });
    }

    await prisma.tag.delete({ where: { id } });
    res.json({ success: true });
  })
);

// PUT /admin/products/:id/tags — { tagIds: string[] } — replace all tags on product
router.put(
  '/products/:id/tags',
  auth,
  requirePermission('listing.manage_tags'),
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { tagIds } = z.object({
      tagIds: z.array(z.string())
    }).parse(req.body);

    await prisma.productTag.deleteMany({ where: { productId: id } });

    const productTags = tagIds.map(tagId => ({
      productId: id,
      tagId
    }));

    if (productTags.length > 0) {
      await prisma.productTag.createMany({ data: productTags });
    }

    res.json({ success: true });
  })
);


// ─── PART 5.2: INTERNAL ANALYTICS ROUTES ──────────────────────

// GET /admin/analytics/overview
router.get(
  '/analytics/overview',
  auth,
  requirePermission('analytics.view'),
  catchAsync(async (req: Request, res: Response) => {
    const fromStr = req.query.from as string;
    const toStr = req.query.to as string;

    const fromDate = fromStr ? new Date(fromStr) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = toStr ? new Date(toStr) : new Date();

    const [
      orders,
      totalCustomers,
      newCustomers,
      products,
      views
    ] = await Promise.all([
      prisma.order.findMany({
        where: {
          createdAt: { gte: fromDate, lte: toDate },
          status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] }
        },
        orderBy: { createdAt: 'asc' }
      }),
      prisma.user.count({ where: { isAdmin: false } }),
      prisma.user.count({
        where: {
          isAdmin: false,
          createdAt: { gte: fromDate, lte: toDate }
        }
      }),
      prisma.product.findMany({
        include: {
          views: true
        }
      }),
      prisma.productView.findMany({
        where: { viewedAt: { gte: fromDate, lte: toDate } }
      })
    ]);

    // Calculate revenue
    const totalRev = orders.reduce((sum, o) => sum + o.totalINR, 0);
    const avgOrderVal = orders.length > 0 ? Math.floor(totalRev / orders.length) : 0;

    // Daily revenue & orders charts
    const dailyMap: Record<string, { date: string; amount: number; count: number }> = {};
    let temp = new Date(fromDate);
    while (temp <= toDate) {
      const dStr = temp.toISOString().split('T')[0];
      dailyMap[dStr] = { date: dStr, amount: 0, count: 0 };
      temp.setDate(temp.getDate() + 1);
    }

    for (const order of orders) {
      const dStr = order.createdAt.toISOString().split('T')[0];
      if (dailyMap[dStr]) {
        dailyMap[dStr].amount += order.totalINR;
        dailyMap[dStr].count += 1;
      }
    }

    const revenueChart = Object.values(dailyMap).map(v => ({ date: v.date, amount: v.amount }));
    const ordersChart = Object.values(dailyMap).map(v => ({ date: v.date, count: v.count }));

    // Inventory metrics
    const totalListed = products.length;
    const totalSold = products.filter(p => p.status === 'SOLD').length;
    const totalAvailable = products.filter(p => p.status === 'AVAILABLE').length;
    const sellThroughRate = totalListed > 0 ? Math.floor((totalSold / totalListed) * 100) : 0;

    // Top products by views
    const sortedProducts = [...products]
      .map(p => ({
        productId: p.id,
        displayName: p.displayName || p.name,
        primaryImageUrl: p.primaryImageUrl,
        views: p.views.length,
        status: p.status
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);

    // Category breakdown
    const categoryMap: Record<string, { category: string; sold: number; revenue: number }> = {};
    for (const order of orders) {
      // Fetch product to know its category
      const product = products.find(p => p.id === order.productId);
      if (product) {
        const cat = product.category;
        if (!categoryMap[cat]) {
          categoryMap[cat] = { category: cat, sold: 0, revenue: 0 };
        }
        categoryMap[cat].sold += 1;
        categoryMap[cat].revenue += order.totalINR;
      }
    }

    // Repeat Buyers count
    const buyerOrdersCount = await prisma.order.groupBy({
      by: ['userId'],
      _count: { id: true },
      where: { status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] } }
    });
    const repeatBuyersCount = buyerOrdersCount.filter(b => b._count.id > 1).length;

    res.json({
      revenue: {
        total: totalRev,
        thisMonth: totalRev, // approximate in range
        lastMonth: 0, // mock comparison
        avgOrderValue: avgOrderVal,
        chart: revenueChart
      },
      orders: {
        total: orders.length,
        thisMonth: orders.length,
        byStatus: [],
        chart: ordersChart
      },
      inventory: {
        totalListed,
        totalSold,
        totalAvailable,
        sellThroughRate
      },
      topProducts: sortedProducts,
      categoryBreakdown: Object.values(categoryMap),
      customers: {
        total: totalCustomers,
        newThisMonth: newCustomers,
        repeatBuyers: repeatBuyersCount
      }
    });
  })
);

// GET /admin/analytics/products
router.get(
  '/analytics/products',
  auth,
  requirePermission('analytics.view'),
  catchAsync(async (req: Request, res: Response) => {
    const products = await prisma.product.findMany({
      include: {
        views: true,
        orders: {
          where: { status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] } }
        }
      }
    });

    const analyticsData = products.map(p => {
      let daysListed = 0;
      if (p.status === 'SOLD' && p.soldAt) {
        daysListed = Math.ceil((p.soldAt.getTime() - p.listedAt.getTime()) / (1000 * 60 * 60 * 24));
      } else {
        daysListed = Math.ceil((Date.now() - p.listedAt.getTime()) / (1000 * 60 * 60 * 24));
      }

      return {
        id: p.id,
        name: p.displayName || p.name,
        slug: p.slug,
        category: p.category,
        priceINR: p.priceINR,
        status: p.status,
        views: p.views.length,
        sold: p.status === 'SOLD',
        daysListedBeforeSold: daysListed >= 0 ? daysListed : 0,
        listedAt: p.listedAt
      };
    });

    // Default sort by views desc
    analyticsData.sort((a, b) => b.views - a.views);

    res.json(analyticsData);
  })
);

// GET /admin/analytics/customers
router.get(
  '/analytics/customers',
  auth,
  requirePermission('customers.view'),
  catchAsync(async (req: Request, res: Response) => {
    const customers = await prisma.user.findMany({
      where: { isAdmin: false },
      include: {
        orders: {
          where: { status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] } }
        }
      }
    });

    const data = customers.map(c => {
      const totalSpend = c.orders.reduce((sum, o) => sum + o.totalINR, 0);
      const lastOrder = c.orders.length > 0 ? c.orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] : null;

      return {
        id: c.id,
        name: c.name,
        email: c.email,
        orderCount: c.orders.length,
        totalSpend,
        lastOrderDate: lastOrder ? lastOrder.createdAt : null
      };
    });

    data.sort((a, b) => b.totalSpend - a.totalSpend);

    res.json(data);
  })
);

// GET /admin/me — Returns profile + resolved permissions for currently logged-in administrator
router.get(
  '/me',
  auth,
  catchAsync(async (req: any, res: Response) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });
    if (!user || !user.isAdmin) {
      throw new AppError('Forbidden: Admin access required', 403, 'FORBIDDEN');
    }
    const resolved = await resolvePermissions(user.id);
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      isOwner: user.isOwner,
      permissions: resolved
    });
  })
);

// ─── ADMIN CUSTOMER MANAGEMENT ENDPOINTS ───────────────────

// GET /admin/customers
router.get(
  '/customers',
  auth,
  requirePermission('customers.view'),
  catchAsync(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const sort = req.query.sort as string || 'newest';

    const whereClause: any = {
      isAdmin: false,
      isOwner: false,
    };

    if (search && search.trim() !== '') {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Fetch matching customers
    const allMatchingUsers = await prisma.user.findMany({
      where: whereClause,
      include: {
        _count: { select: { orders: true } },
        orders: {
          where: { status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] } },
          select: { totalINR: true, createdAt: true },
        }
      }
    });

    const customersData = allMatchingUsers.map(user => {
      const orderCount = user._count.orders;
      const totalSpent = user.orders.reduce((sum, o) => sum + o.totalINR, 0);
      const lastOrder = user.orders.length > 0 
        ? user.orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
        : null;

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isVerified: user.isVerified,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt,
        orderCount,
        totalSpent,
        lastOrderAt: lastOrder ? lastOrder.createdAt : null,
      };
    });

    // Sort
    if (sort === 'newest') {
      customersData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } else if (sort === 'oldest') {
      customersData.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    } else if (sort === 'most_orders') {
      customersData.sort((a, b) => b.orderCount - a.orderCount);
    } else if (sort === 'most_spent') {
      customersData.sort((a, b) => b.totalSpent - a.totalSpent);
    }

    const total = customersData.length;
    const startIndex = (page - 1) * limit;
    const paginatedCustomers = customersData.slice(startIndex, startIndex + limit);

    // Dynamic stats summary
    const totalCustomers = await prisma.user.count({ where: { isAdmin: false, isOwner: false } });
    const verifiedCustomers = await prisma.user.count({ where: { isAdmin: false, isOwner: false, isVerified: true } });
    const unverifiedCustomers = await prisma.user.count({ where: { isAdmin: false, isOwner: false, isVerified: false } });
    
    const startOfCurrentMonth = new Date();
    startOfCurrentMonth.setDate(1);
    startOfCurrentMonth.setHours(0, 0, 0, 0);
    const newThisMonth = await prisma.user.count({
      where: {
        isAdmin: false,
        isOwner: false,
        createdAt: { gte: startOfCurrentMonth }
      }
    });

    res.json({
      customers: paginatedCustomers,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      stats: {
        total: totalCustomers,
        verified: verifiedCustomers,
        unverified: unverifiedCustomers,
        newThisMonth
      }
    });
  })
);

// GET /admin/customers/:id
router.get(
  '/customers/:id',
  auth,
  requirePermission('customers.view'),
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        addresses: true,
        wishlist: {
          include: {
            product: {
              include: {
                images: {
                  orderBy: { order: 'asc' },
                  take: 1
                }
              }
            }
          }
        },
        orders: {
          orderBy: { createdAt: 'desc' },
          include: {
            product: true
          }
        }
      }
    });

    if (!user) {
      throw new AppError('Customer not found', 404, 'NOT_FOUND');
    }

    const validOrders = user.orders.filter(o => ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(o.status));
    const totalSpent = validOrders.reduce((sum, o) => sum + o.totalINR, 0);
    const lastOrderDate = user.orders.length > 0 ? user.orders[0].createdAt : null;

    res.json({
      customer: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isVerified: user.isVerified,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt,
        totalSpent,
        lastOrderDate,
      },
      orders: user.orders.map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        productName: o.product.displayName || o.product.name,
        amount: o.totalINR,
        status: o.status,
        date: o.createdAt,
      })),
      addresses: user.addresses,
      wishlist: user.wishlist.map(w => ({
        id: w.id,
        productId: w.productId,
        productName: w.product.displayName || w.product.name,
        price: w.product.priceINR,
        image: w.product.images[0]?.urlThumb || w.product.primaryImageUrl,
      })),
    });
  })
);

// PUT /admin/customers/:id
router.put(
  '/customers/:id',
  auth,
  requirePermission('customers.view_full_data'),
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const bodySchema = z.object({
      name: z.string().optional(),
      phone: z.string().nullable().optional(),
      isVerified: z.boolean().optional(),
    });
    const { name, phone, isVerified } = bodySchema.parse(req.body);

    const updated = await prisma.user.update({
      where: { id },
      data: {
        name,
        phone,
        isVerified,
      }
    });

    res.json(updated);
  })
);

// DELETE /admin/customers/:id
router.delete(
  '/customers/:id',
  auth,
  catchAsync(async (req: any, res: Response) => {
    const hasManage = await hasPermission(req.user.id, 'customers.view_full_data');
    const isOwner = req.user.isOwner;
    if (!isOwner && !hasManage) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Owner or customers.manage permission required' });
    }

    const { id } = req.params;
    const force = req.query.force === 'true';

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        _count: { select: { orders: true } },
      }
    });

    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    const orderCount = user._count.orders;

    if (orderCount > 0 && !force) {
      return res.status(400).json({
        error: 'CUSTOMER_HAS_ORDERS',
        orderCount,
        message: `Deleting this customer will orphan ${orderCount} orders. Confirm?`
      });
    }

    if (orderCount > 0) {
      // Anonymise their orders to preserve records for accounting
      let anonymisedUser = await prisma.user.findUnique({ where: { email: 'anonymised@rajshreejewels.com' } });
      if (!anonymisedUser) {
        anonymisedUser = await prisma.user.create({
          data: {
            name: 'Anonymised Customer',
            email: 'anonymised@rajshreejewels.com',
            isVerified: true,
          }
        });
      }

      let dummyAddress = await prisma.address.findFirst({ where: { userId: anonymisedUser.id } });
      if (!dummyAddress) {
        dummyAddress = await prisma.address.create({
          data: {
            userId: anonymisedUser.id,
            name: 'Anonymised Recipient',
            phone: '0000000000',
            line1: 'Anonymised Address',
            city: 'Anonymised',
            state: 'Anonymised',
            pincode: '000000',
          }
        });
      }

      await prisma.order.updateMany({
        where: { userId: id },
        data: {
          userId: anonymisedUser.id,
          addressId: dummyAddress.id,
        }
      });
    }

    // Delete the customer record (which cascades addresses, wishlists, and sessions)
    await prisma.user.delete({
      where: { id }
    });

    res.json({ success: true, message: 'Customer deleted and orders anonymised.' });
  })
);

// POST /admin/customers/:id/verify
router.post(
  '/customers/:id/verify',
  auth,
  requirePermission('customers.view'),
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updated = await prisma.user.update({
      where: { id },
      data: { isVerified: true },
    });
    res.json(updated);
  })
);

// POST /admin/customers/:id/send-verification
router.post(
  '/customers/:id/send-verification',
  auth,
  requirePermission('customers.view'),
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    const otp = crypto.randomInt(100000, 999999).toString();

    if (redis.isOpen) {
      await redis.setEx(`otp:${user.id}`, 600, otp);
    } else {
      console.warn(`Fallback OTP: ${otp}`);
    }

    notificationsService.sendVerificationEmail(user.email, user.name, otp).catch((err: any) => {
      console.error('❌ Failed to send verification email in background:', err.message);
    });

    res.json({
      success: true,
      message: 'Verification email sent successfully',
      debugOtp: config.NODE_ENV === 'development' ? otp : undefined,
    });
  })
);

export default router;
