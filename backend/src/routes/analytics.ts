import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../services/db';
import redis from '../services/redis';
import { catchAsync, AppError } from '../utils/errors';
import { auth } from '../middleware/auth';
import { requirePermission } from '../middleware/requirePermission';
import { ItemStatus } from '@prisma/client';

const router = Router();

// Zod schemas
const TrackViewSchema = z.object({
  productId: z.string(),
  sessionId: z.string().optional().nullable(),
});

// ==========================================
// STOREFRONT ENDPOINT
// ==========================================

// POST /analytics/view - Rate-limited, de-duplicated unique product view logger
router.post(
  '/view',
  catchAsync(async (req: Request, res: Response) => {
    const { productId, sessionId } = TrackViewSchema.parse(req.body);
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || '';

    // Ignore bots
    if (/bot|crawler|spider|crawling/i.test(userAgent)) {
      return res.json({ success: true, ignored: 'bot' });
    }

    const dedupKey = `view_dedup:${productId}:${sessionId || ip}`;

    // Redis-backed unique hour-long de-duplication
    if (redis.isOpen) {
      const exists = await redis.get(dedupKey);
      if (exists) {
        return res.json({ success: true, status: 'deduplicated' });
      }
      // Set de-duplication expire token for 1 hour (3600 seconds)
      await redis.setEx(dedupKey, 3600, '1');
    }

    // Resolve userId if authenticated header is present
    let authUserId: string | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        const { config } = require('../config');
        const token = authHeader.split(' ')[1];
        const payload = jwt.verify(token, config.JWT_SECRET) as any;
        if (payload?.userId) authUserId = payload.userId;
      } catch (_) {}
    }

    // Verify product exists in database to prevent foreign key errors for nonexistent/mock items
    const productExists = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!productExists) {
      return res.json({ success: false, status: 'ignored_nonexistent_product' });
    }

    // Log unique product impression inside PostgreSQL database
    await prisma.productView.create({
      data: {
        productId,
        sessionId: sessionId || ip,
        userId: authUserId
      }
    });

    res.json({ success: true, status: 'recorded' });
  })
);

// ==========================================
// ADMIN DASHBOARD ENDPOINTS
// ==========================================

// GET /analytics/overview - Fetch premium Recharts metrics for dashboard
router.get(
  '/overview',
  auth,
  requirePermission('analytics.view'),
  catchAsync(async (req: Request, res: Response) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 1. Fetch total sales and aggregate orders count (last 30 days)
    const orders = await prisma.order.findMany({
      where: {
        status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] },
        createdAt: { gte: thirtyDaysAgo }
      },
      select: {
        totalINR: true,
        createdAt: true
      }
    });

    // Group sales and revenues by date
    const dailyMap = new Map<string, { date: string; revenue: number; orders: number }>();
    
    // Pre-populate last 30 days
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      dailyMap.set(dateStr, { date: dateStr, revenue: 0, orders: 0 });
    }

    orders.forEach((order) => {
      const dateStr = new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      const record = dailyMap.get(dateStr);
      if (record) {
        record.revenue += order.totalINR;
        record.orders += 1;
      }
    });

    const salesTimeline = Array.from(dailyMap.values());

    // 2. Fetch category sales breakdowns (SOLD products categorised)
    const categorySales = await prisma.product.groupBy({
      by: ['category'],
      where: { status: ItemStatus.SOLD },
      _count: { id: true },
      _sum: { priceINR: true }
    });

    const categoryBreakdown = categorySales.map((c) => ({
      category: c.category.replace('_', ' '),
      count: c._count.id,
      revenue: c._sum.priceINR || 0
    }));

    // 3. Fetch top products by view popularity (unique views)
    const topViews = await prisma.productView.groupBy({
      by: ['productId'],
      _count: { id: true },
      orderBy: { _count: { productId: 'desc' } },
      take: 5
    });

    const topProductViews = await Promise.all(
      topViews.map(async (v) => {
        const prod = await prisma.product.findUnique({
          where: { id: v.productId },
          select: { displayName: true, priceINR: true }
        });
        return {
          productId: v.productId,
          name: prod?.displayName || 'Unknown Jewellery Piece',
          price: prod?.priceINR || 0,
          views: v._count.id
        };
      })
    );

    // 4. Sell-through rates
    const totalInventoryCount = await prisma.product.count({
      where: { status: { in: [ItemStatus.AVAILABLE, ItemStatus.SOLD] } }
    });

    const soldCount = await prisma.product.count({
      where: { status: ItemStatus.SOLD }
    });

    const sellThroughRate = totalInventoryCount > 0 
      ? Math.round((soldCount / totalInventoryCount) * 100)
      : 0;

    // 5. Total highlights summary (Lifetime vs 30 days)
    const lifetimeRevenue = await prisma.order.aggregate({
      where: { status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] } },
      _sum: { totalINR: true }
    });

    const activeListings = await prisma.product.count({
      where: { status: ItemStatus.AVAILABLE }
    });

    res.json({
      summary: {
        totalRevenue: lifetimeRevenue._sum.totalINR || 0,
        activeListings,
        soldCount,
        sellThroughRate,
      },
      salesTimeline,
      categoryBreakdown,
      topProductViews
    });
  })
);

export default router;
