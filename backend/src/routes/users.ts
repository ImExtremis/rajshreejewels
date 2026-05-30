import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../services/db';
import { auth } from '../middleware/auth';
import { catchAsync, AppError } from '../utils/errors';

const router = Router();

// Enable authorization middleware globally on all user profile endpoints
router.use(auth);

// Zod schemas
const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').optional(),
  phone: z.string().trim().min(10, 'Phone must be at least 10 digits').optional(),
});

const addressSchema = z.object({
  label: z.string().trim().default('Home'),
  name: z.string().trim().min(2, 'Recipient name required'),
  phone: z.string().trim().min(10, 'Phone number required'),
  line1: z.string().trim().min(5, 'Address line 1 must be at least 5 chars'),
  line2: z.string().trim().optional(),
  city: z.string().trim().min(2, 'City required'),
  state: z.string().trim().min(2, 'State required'),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be exactly 6 digits'),
  isDefault: z.boolean().default(false),
});

// ─── GET /users/me ──────────────────────────────────────────
router.get(
  '/me',
  catchAsync(async (req: any, res: Response) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        addresses: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!user) {
      throw new AppError('User profile not found', 404, 'NOT_FOUND');
    }

    // Strip passwordHash from the API response (Security requirement)
    const { passwordHash, ...safeUser } = user;
    res.json(safeUser);
  })
);

// ─── PUT /users/me ──────────────────────────────────────────
router.put(
  '/me',
  catchAsync(async (req: any, res: Response) => {
    const validatedData = updateProfileSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: validatedData,
    });

    const { passwordHash, ...safeUser } = user;
    res.json(safeUser);
  })
);

// ─── POST /users/me/addresses ────────────────────────────────
router.post(
  '/me/addresses',
  catchAsync(async (req: any, res: Response) => {
    const validatedAddress = addressSchema.parse(req.body);
    const userId = req.user.id;

    // Check count of user addresses to handle defaults
    const addressCount = await prisma.address.count({ where: { userId } });
    
    // If it's the first address or user set isDefault to true
    const shouldBeDefault = addressCount === 0 || validatedAddress.isDefault;

    if (shouldBeDefault) {
      // Unset all existing default addresses
      await prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    const newAddress = await prisma.address.create({
      data: {
        ...validatedAddress,
        userId,
        isDefault: shouldBeDefault,
      },
    });

    res.status(201).json(newAddress);
  })
);

// ─── PUT /users/me/addresses/:id ─────────────────────────────
router.put(
  '/me/addresses/:id',
  catchAsync(async (req: any, res: Response) => {
    const addressId = req.params.id;
    const userId = req.user.id;
    const validatedAddress = addressSchema.parse(req.body);

    // Verify ownership of target address
    const existing = await prisma.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!existing) {
      throw new AppError('Address not found', 404, 'NOT_FOUND');
    }

    if (validatedAddress.isDefault) {
      await prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.address.update({
      where: { id: addressId },
      data: validatedAddress,
    });

    res.json(updated);
  })
);

// ─── DELETE /users/me/addresses/:id ──────────────────────────
router.delete(
  '/me/addresses/:id',
  catchAsync(async (req: any, res: Response) => {
    const addressId = req.params.id;
    const userId = req.user.id;

    const existing = await prisma.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!existing) {
      throw new AppError('Address not found', 404, 'NOT_FOUND');
    }

    await prisma.address.delete({ where: { id: addressId } });

    // If we deleted the default address, set the most recent remaining address as default
    if (existing.isDefault) {
      const remaining = await prisma.address.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      if (remaining) {
        await prisma.address.update({
          where: { id: remaining.id },
          data: { isDefault: true },
        });
      }
    }

    res.json({ message: 'Address deleted successfully' });
  })
);

// ─── PUT /users/me/addresses/:id/default ─────────────────────
router.put(
  '/me/addresses/:id/default',
  catchAsync(async (req: any, res: Response) => {
    const addressId = req.params.id;
    const userId = req.user.id;

    const existing = await prisma.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!existing) {
      throw new AppError('Address not found', 404, 'NOT_FOUND');
    }

    // Set all addresses for this user to isDefault: false
    await prisma.address.updateMany({
      where: { userId },
      data: { isDefault: false },
    });

    // Mark this specific address as default
    const updated = await prisma.address.update({
      where: { id: addressId },
      data: { isDefault: true },
    });

    res.json(updated);
  })
);

// ─── GET /users/me/wishlist ──────────────────────────────────
router.get(
  '/me/wishlist',
  catchAsync(async (req: any, res: Response) => {
    const items = await prisma.wishlistItem.findMany({
      where: { userId: req.user.id },
      include: {
        product: {
          include: {
            images: {
              orderBy: { order: 'asc' },
              take: 1,
            }
          }
        }
      },
      orderBy: { addedAt: 'desc' },
    });

    res.json(items.map(item => item.product));
  })
);

// ─── POST /users/me/wishlist ─────────────────────────────────
router.post(
  '/me/wishlist',
  catchAsync(async (req: any, res: Response) => {
    const { productId } = z.object({ productId: z.string() }).parse(req.body);
    const userId = req.user.id;

    // Verify product exists
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new AppError('Product not found', 404, 'NOT_FOUND');
    }

    // Upsert wishlist entry (ignore duplicates via database unique index constraint match check)
    const wish = await prisma.wishlistItem.upsert({
      where: {
        userId_productId: { userId, productId },
      },
      create: { userId, productId },
      update: {}, // no-op if exists
    });

    res.status(201).json(wish);
  })
);

// ─── DELETE /users/me/wishlist/:productId ────────────────────
router.delete(
  '/me/wishlist/:productId',
  catchAsync(async (req: any, res: Response) => {
    const { productId } = req.params;
    const userId = req.user.id;

    const existing = await prisma.wishlistItem.findFirst({
      where: { userId, productId },
    });

    if (!existing) {
      throw new AppError('Wishlist item not found', 404, 'NOT_FOUND');
    }

    await prisma.wishlistItem.delete({
      where: {
        userId_productId: { userId, productId }
      }
    });

    res.json({ message: 'Removed from wishlist successfully' });
  })
);

// ─── GET /users/me/payment-methods ───────────────────────────
router.get(
  '/me/payment-methods',
  catchAsync(async (req: any, res: Response) => {
    const userId = req.user.id;

    // Fetch saved UPIs
    const savedUpis = await prisma.savedUPI.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    // Also get distinct payment methods from user's recent orders (to show "Last Used" indicators)
    const recentOrders = await prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        paymentMethod: true,
        createdAt: true,
      },
    });

    // Extract unique payment methods
    const uniqueMethodsMap = new Map();
    recentOrders.forEach(o => {
      if (!uniqueMethodsMap.has(o.paymentMethod)) {
        uniqueMethodsMap.set(o.paymentMethod, o.createdAt);
      }
    });
    
    const recentUsedMethods = Array.from(uniqueMethodsMap.entries()).map(([method, lastUsed]) => ({
      method,
      lastUsed,
    }));

    res.json({
      savedUpis,
      recentUsedMethods,
    });
  })
);

// ─── POST /users/me/payment-methods ──────────────────────────
router.post(
  '/me/payment-methods',
  catchAsync(async (req: any, res: Response) => {
    const userId = req.user.id;
    const { upiId, label } = z.object({
      upiId: z.string().trim().regex(/^[\w.-]+@[\w.-]+$/, 'Please enter a valid UPI ID (e.g. user@okaxis)'),
      label: z.string().trim().max(30, 'Label too long').optional(),
    }).parse(req.body);

    // Check if user already has this saved UPI
    const existing = await prisma.savedUPI.findFirst({
      where: { userId, upiId },
    });
    if (existing) {
      throw new AppError('This UPI ID is already saved', 400, 'ALREADY_EXISTS');
    }

    // Check saved upi count to determine if this should be default
    const count = await prisma.savedUPI.count({ where: { userId } });
    const isDefault = count === 0;

    const newUpi = await prisma.savedUPI.create({
      data: {
        userId,
        upiId,
        label: label || null,
        isDefault,
      },
    });

    res.status(201).json(newUpi);
  })
);

// ─── DELETE /users/me/payment-methods/:id ─────────────────────
router.delete(
  '/me/payment-methods/:id',
  catchAsync(async (req: any, res: Response) => {
    const upiId = req.params.id;
    const userId = req.user.id;

    // Verify ownership
    const existing = await prisma.savedUPI.findFirst({
      where: { id: upiId, userId },
    });
    if (!existing) {
      throw new AppError('Payment method not found', 404, 'NOT_FOUND');
    }

    await prisma.savedUPI.delete({
      where: { id: upiId },
    });

    // If we deleted the default method, promote another one if exists
    if (existing.isDefault) {
      const another = await prisma.savedUPI.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      if (another) {
        await prisma.savedUPI.update({
          where: { id: another.id },
          data: { isDefault: true },
        });
      }
    }

    res.json({ message: 'Payment method deleted successfully' });
  })
);

// ─── PUT /users/me/payment-methods/:id/default ────────────────
router.put(
  '/me/payment-methods/:id/default',
  catchAsync(async (req: any, res: Response) => {
    const upiId = req.params.id;
    const userId = req.user.id;

    // Verify ownership
    const existing = await prisma.savedUPI.findFirst({
      where: { id: upiId, userId },
    });
    if (!existing) {
      throw new AppError('Payment method not found', 404, 'NOT_FOUND');
    }

    // Reset default flags
    await prisma.savedUPI.updateMany({
      where: { userId },
      data: { isDefault: false },
    });

    // Set default
    const updated = await prisma.savedUPI.update({
      where: { id: upiId },
      data: { isDefault: true },
    });

    res.json(updated);
  })
);

export default router;
