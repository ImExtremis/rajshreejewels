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
    const range = (req.query.range as string) || '30days';
    const fromStr = req.query.from as string;
    const toStr = req.query.to as string;

    let startDate = new Date();
    let endDate = new Date();
    let groupMode: 'day' | 'month' = 'day';

    if (range === '30days') {
      startDate.setDate(startDate.getDate() - 30);
      groupMode = 'day';
    } else if (range === 'thismonth') {
      startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      groupMode = 'day';
    } else if (range === 'lastmonth') {
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      groupMode = 'day';
    } else if (range === 'thisyear') {
      startDate = new Date(startDate.getFullYear(), 0, 1);
      groupMode = 'month';
    } else if (range === 'alltime') {
      startDate = new Date(2020, 0, 1); // Earliest catalog setup date
      groupMode = 'month';
    } else if (range === 'custom' && fromStr && toStr) {
      startDate = new Date(fromStr);
      endDate = new Date(toStr);
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      groupMode = diffDays > 90 ? 'month' : 'day';
    } else {
      startDate.setDate(startDate.getDate() - 30);
      groupMode = 'day';
    }

    // 1. Fetch total sales and aggregate orders count within range
    const orders = await prisma.order.findMany({
      where: {
        status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] },
        createdAt: { gte: startDate, lte: endDate }
      },
      select: {
        totalINR: true,
        createdAt: true,
        productId: true
      }
    });

    // Group sales and revenues by date
    const dailyMap = new Map<string, { date: string; revenue: number; orders: number }>();
    const monthlyMap = new Map<string, { date: string; revenue: number; orders: number }>();

    if (groupMode === 'day') {
      let current = new Date(startDate);
      while (current <= endDate) {
        const dateStr = current.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        dailyMap.set(dateStr, { date: dateStr, revenue: 0, orders: 0 });
        current.setDate(current.getDate() + 1);
      }

      orders.forEach((order) => {
        const dateStr = new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        const record = dailyMap.get(dateStr);
        if (record) {
          record.revenue += order.totalINR;
          record.orders += 1;
        }
      });
    } else {
      let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      while (current <= endDate) {
        const dateStr = current.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
        monthlyMap.set(dateStr, { date: dateStr, revenue: 0, orders: 0 });
        current.setMonth(current.getMonth() + 1);
      }

      orders.forEach((order) => {
        const dateStr = new Date(order.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
        const record = monthlyMap.get(dateStr);
        if (record) {
          record.revenue += order.totalINR;
          record.orders += 1;
        }
      });
    }

    const salesTimeline = groupMode === 'day' ? Array.from(dailyMap.values()) : Array.from(monthlyMap.values());

    // 2. Fetch category sales breakdowns in the active range
    const rangeProductIds = orders.map(o => o.productId);
    const rangeProducts = await prisma.product.findMany({
      where: { id: { in: rangeProductIds } },
      select: { id: true, category: true }
    });

    const categoryMap = new Map<string, { category: string; count: number; revenue: number }>();
    orders.forEach(order => {
      const p = rangeProducts.find(prod => prod.id === order.productId);
      if (p) {
        const cat = p.category.replace('_', ' ');
        const existing = categoryMap.get(cat) || { category: cat, count: 0, revenue: 0 };
        existing.count += 1;
        existing.revenue += order.totalINR;
        categoryMap.set(cat, existing);
      }
    });
    const categoryBreakdown = Array.from(categoryMap.values());

    // 3. Fetch top products by view popularity (unique views) in the range
    const topViews = await prisma.productView.groupBy({
      by: ['productId'],
      where: { viewedAt: { gte: startDate, lte: endDate } },
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

    // 5. Total highlights summary (Lifetime vs Range)
    const lifetimeRevenue = await prisma.order.aggregate({
      where: { status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] } },
      _sum: { totalINR: true }
    });

    const activeListings = await prisma.product.count({
      where: { status: ItemStatus.AVAILABLE }
    });

    const totalCustomers = await prisma.user.count({ where: { isAdmin: false } });
    const newCustomersInRange = await prisma.user.count({
      where: {
        isAdmin: false,
        createdAt: { gte: startDate, lte: endDate }
      }
    });

    const buyerOrdersCount = await prisma.order.groupBy({
      by: ['userId'],
      _count: { id: true },
      where: {
        status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] },
        createdAt: { gte: startDate, lte: endDate }
      }
    });
    const repeatBuyersCount = buyerOrdersCount.filter(b => b._count.id > 1).length;

    res.json({
      summary: {
        totalRevenue: lifetimeRevenue._sum.totalINR || 0,
        rangeRevenue: orders.reduce((sum, o) => sum + o.totalINR, 0),
        activeListings,
        soldCount,
        sellThroughRate,
        totalCustomers,
        newCustomers: newCustomersInRange,
        repeatBuyers: repeatBuyersCount,
        ordersCount: orders.length,
        avgOrderValue: orders.length > 0 ? Math.round(orders.reduce((sum, o) => sum + o.totalINR, 0) / orders.length) : 0
      },
      salesTimeline,
      categoryBreakdown,
      topProductViews
    });
  })
);

export default router;
