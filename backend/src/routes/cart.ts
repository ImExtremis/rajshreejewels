import { Router, Request, Response } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import redis from '../services/redis';
import prisma from '../services/db';
import { config } from '../config';
import { catchAsync, AppError } from '../utils/errors';
import { JWTPayload } from '../types';
import { ItemStatus } from '@prisma/client';
import { auth } from '../middleware/auth';
import { optionalAuth } from '../middleware/optionalAuth';

const router = Router();

const CART_TTL = 604800; // 7 days in seconds

interface CartItem {
  productId: string;
  addedAt: string;
}

interface CartCoupon {
  id: string;
  code: string;
  type: string;
  value: number;
}

interface Cart {
  items: CartItem[];
  updatedAt: string;
  coupon?: CartCoupon | null;
}

// Helper: Fetches cart from Redis
const getCart = async (key: string): Promise<Cart> => {
  if (!redis.isOpen) {
    return { items: [], updatedAt: new Date().toISOString() };
  }
  const raw = await redis.get(key);
  if (!raw) {
    return { items: [], updatedAt: new Date().toISOString() };
  }
  // Refresh TTL on every access
  await redis.expire(key, CART_TTL);
  return JSON.parse(raw) as Cart;
};

// Helper: Saves cart in Redis using atomic transaction
const saveCart = async (key: string, cart: Cart): Promise<void> => {
  if (!redis.isOpen) return;
  const transaction = redis.multi();
  transaction.setEx(key, CART_TTL, JSON.stringify(cart));
  await transaction.exec();
};

// ─── GET /cart ──────────────────────────────────────────────
router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const sessionId = req.headers['x-session-id'] as string | undefined;

    // No auth, no session — return empty cart gracefully
    if (!userId && !sessionId) {
      return res.json({ items: [], updatedAt: new Date().toISOString() });
    }

    const cartKey = userId ? `cart:${userId}` : `cart:guest:${sessionId}`;
    
    let cart: Cart = { items: [], updatedAt: new Date().toISOString() };
    
    try {
      const raw = await redis.get(cartKey);
      if (raw) cart = JSON.parse(raw) as Cart;
    } catch {
      return res.json({ items: [], updatedAt: new Date().toISOString() });
    }

    if (!cart.items || cart.items.length === 0) {
      return res.json({ items: [], updatedAt: cart.updatedAt });
    }

    // Enrich with product data
    const enriched = await Promise.all(
      cart.items.map(async (item: any) => {
        try {
          const product = await prisma.product.findUnique({
            where: { id: item.productId },
            select: {
              id: true,
              slug: true,
              displayName: true,
              priceINR: true,
              originalPriceINR: true,
              primaryImageUrl: true,
              status: true,
              category: true,
            }
          });
          if (!product) return null;
          return {
            productId: item.productId,
            addedAt: item.addedAt,
            product,
            cartError: product.status !== 'AVAILABLE' ? 'ITEM_SOLD' : null,
          };
        } catch {
          return null;
        }
      })
    );

    return res.json({
      items: enriched.filter(Boolean),
      updatedAt: cart.updatedAt,
      coupon: cart.coupon,
    });
  } catch (err) {
    console.error('Cart GET error:', err);
    return res.status(500).json({ error: 'CART_ERROR', message: 'Failed to load cart' });
  }
});

// ─── POST /cart/add ─────────────────────────────────────────
router.post(
  '/add',
  auth,
  catchAsync(async (req: any, res: Response) => {
    const { productId } = z.object({ productId: z.string() }).parse(req.body);
    const key = `cart:${req.user.id}`;

    // Verify product exists and is AVAILABLE
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new AppError('Product not found', 404, 'NOT_FOUND');
    }

    if (product.status !== ItemStatus.AVAILABLE) {
      throw new AppError('This piece is no longer available for purchase', 400, 'PRODUCT_UNAVAILABLE');
    }

    const cart = await getCart(key);

    // Verify product is not already in the cart (each piece is unique)
    const exists = cart.items.some((item) => item.productId === productId);
    if (exists) {
      throw new AppError('This piece is already in your cart', 400, 'ALREADY_IN_CART');
    }

    cart.items.push({
      productId,
      addedAt: new Date().toISOString(),
    });
    cart.updatedAt = new Date().toISOString();

    await saveCart(key, cart);

    res.json(cart);
  })
);

// ─── DELETE /cart/remove/:productId ─────────────────────────
router.delete(
  '/remove/:productId',
  auth,
  catchAsync(async (req: any, res: Response) => {
    const { productId } = req.params;
    const key = `cart:${req.user.id}`;

    const cart = await getCart(key);

    const exists = cart.items.some((item) => item.productId === productId);
    if (!exists) {
      throw new AppError('Product is not in your cart', 404, 'NOT_FOUND');
    }

    cart.items = cart.items.filter((item) => item.productId !== productId);
    cart.updatedAt = new Date().toISOString();

    await saveCart(key, cart);

    res.json(cart);
  })
);

// ─── POST /cart/clear ───────────────────────────────────────
router.post(
  '/clear',
  auth,
  catchAsync(async (req: any, res: Response) => {
    const key = `cart:${req.user.id}`;

    if (redis.isOpen) {
      await redis.del(key);
    }

    res.json({ success: true });
  })
);

// ─── POST /cart/merge ───────────────────────────────────────
router.post(
  '/merge',
  auth,
  catchAsync(async (req: any, res: Response) => {
    const { guestSessionId } = z.object({ guestSessionId: z.string() }).parse(req.body);
    const userKey = `cart:${req.user.id}`;
    const guestKey = `cart:guest:${guestSessionId}`;

    const userCart = await getCart(userKey);
    const guestCart = await getCart(guestKey);

    if (guestCart.items.length === 0) {
      return res.json(userCart);
    }

    // Merge guest cart items into user cart items (ignoring duplicate IDs if any)
    guestCart.items.forEach((guestItem) => {
      const exists = userCart.items.some((userItem) => userItem.productId === guestItem.productId);
      if (!exists) {
        userCart.items.push(guestItem);
      }
    });

    userCart.updatedAt = new Date().toISOString();

    // Save user cart and purge guest cart key in Redis
    await saveCart(userKey, userCart);
    if (redis.isOpen) {
      await redis.del(guestKey);
    }

    res.json(userCart);
  })
);

// ─── POST /cart/apply-coupon ────────────────────────────────
router.post(
  '/apply-coupon',
  auth,
  catchAsync(async (req: any, res: Response) => {
    const { code } = z.object({ code: z.string() }).parse(req.body);
    const key = `cart:${req.user.id}`;
    const userId = req.user.id;

    const uppercaseCode = code.toUpperCase();

    // 1. Fetch Coupon
    const coupon = await prisma.coupon.findUnique({
      where: { code: uppercaseCode }
    });

    if (!coupon) {
      throw new AppError('Coupon not found', 404, 'COUPON_NOT_FOUND');
    }

    // 2. Validate Coupon
    const now = new Date();
    if (!coupon.isActive) {
      throw new AppError('Coupon is inactive', 400, 'COUPON_EXPIRED');
    }
    if (coupon.validFrom > now || (coupon.validUntil && coupon.validUntil < now)) {
      throw new AppError('Coupon is expired', 400, 'COUPON_EXPIRED');
    }
    if (coupon.maxUsesTotal !== null && coupon.usedCount >= coupon.maxUsesTotal) {
      throw new AppError('Coupon is exhausted', 400, 'COUPON_EXHAUSTED');
    }

    // 3. Validate user usage count
    const userUses = await prisma.couponUse.count({
      where: { couponId: coupon.id, userId }
    });
    if (userUses >= coupon.maxUsesPerUser) {
      throw new AppError('You have already used this coupon maximum times', 400, 'COUPON_ALREADY_USED');
    }

    // 4. Fetch Cart and calculate subtotal
    const cart = await getCart(key);
    if (cart.items.length === 0) {
      throw new AppError('Cart is empty', 400, 'CART_EMPTY');
    }

    const productIds = cart.items.map(item => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } }
    });
    const subtotal = products.reduce((sum, p) => sum + p.priceINR, 0);

    if (subtotal < coupon.minOrderINR) {
      throw new AppError(`Minimum order value of ₹${coupon.minOrderINR} required`, 400, 'MIN_ORDER_NOT_MET');
    }

    // Calculate discount
    let discountINR = 0;
    let shippingINR = 0;
    
    const settings = await prisma.siteSetting.findMany({
      where: { key: { in: ['shipping_free_above_inr', 'shipping_flat_rate_inr'] } }
    });
    const freeAbove = parseInt(settings.find(s => s.key === 'shipping_free_above_inr')?.value || '999');
    const flatRate = parseInt(settings.find(s => s.key === 'shipping_flat_rate_inr')?.value || '99');
    
    if (subtotal < freeAbove) {
      shippingINR = flatRate;
    }

    if (coupon.type === 'PERCENTAGE') {
      discountINR = Math.floor((subtotal * coupon.value) / 100);
    } else if (coupon.type === 'FIXED_INR') {
      discountINR = Math.min(coupon.value, subtotal);
    } else if (coupon.type === 'FREE_SHIPPING') {
      shippingINR = 0;
    }

    const finalTotal = subtotal + shippingINR - discountINR;

    cart.coupon = {
      id: coupon.id,
      code: coupon.code,
      type: coupon.type,
      value: coupon.value
    };
    await saveCart(key, cart);

    res.json({
      valid: true,
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      discountINR,
      finalTotal
    });
  })
);

// ─── DELETE /cart/remove-coupon ─────────────────────────────
router.delete(
  '/remove-coupon',
  auth,
  catchAsync(async (req: any, res: Response) => {
    const key = `cart:${req.user.id}`;
    const cart = await getCart(key);
    
    if (cart.coupon) {
      delete cart.coupon;
      await saveCart(key, cart);
    }

    res.json({ success: true });
  })
);

export default router;
