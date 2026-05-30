import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../services/db';
import { catchAsync, AppError } from '../utils/errors';
import { auth } from '../middleware/auth';
import { requirePermission } from '../middleware/requirePermission';
import { ItemStatus } from '@prisma/client';

const router = Router();

// Zod validation schemas
const CollectionSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  slug: z.string().trim().min(2, 'Slug must be at least 2 characters').toLowerCase(),
  description: z.string().trim().optional().nullable(),
  bannerImageUrl: z.string().trim().optional().nullable(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

const ReorderSchema = z.object({
  orders: z.array(z.object({
    id: z.string(),
    sortOrder: z.number().int()
  }))
});

const ReorderProductsSchema = z.object({
  orders: z.array(z.object({
    productId: z.string(),
    sortOrder: z.number().int()
  }))
});

// ==========================================
// PUBLIC ENDPOINTS
// ==========================================

// GET /collections - List all active collections for storefront navigation/home grids
router.get(
  '/',
  catchAsync(async (req: Request, res: Response) => {
    const collections = await prisma.collection.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        products: {
          orderBy: { sortOrder: 'asc' },
          take: 4,
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
        }
      }
    });

    res.json(collections);
  })
);

// GET /tags/all - Get all product tags
router.get(
  '/tags/all',
  catchAsync(async (req: Request, res: Response) => {
    const tags = await prisma.tag.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(tags);
  })
);

// ==========================================
// ADMIN ENDPOINTS (Secured)
// ==========================================

// GET /collections/admin/list - Fetch all collections (including inactive ones)
router.get(
  '/admin/list',
  auth,
  requirePermission('listing.manage_collections'),
  catchAsync(async (req: Request, res: Response) => {
    const collections = await prisma.collection.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: { products: true }
        }
      }
    });
    res.json(collections);
  })
);

// POST /collections - Create a collection
router.post(
  '/',
  auth,
  requirePermission('listing.manage_collections'),
  catchAsync(async (req: Request, res: Response) => {
    const body = CollectionSchema.parse(req.body);

    const existing = await prisma.collection.findUnique({
      where: { slug: body.slug }
    });
    if (existing) {
      throw new AppError('A collection with this URL slug already exists', 400, 'SLUG_EXISTS');
    }

    const collection = await prisma.collection.create({
      data: {
        name: body.name,
        slug: body.slug,
        description: body.description,
        bannerImageUrl: body.bannerImageUrl,
        isActive: body.isActive,
        sortOrder: body.sortOrder,
      }
    });

    res.status(201).json(collection);
  })
);

// PUT /collections/reorder - Reorder collections
router.put(
  '/admin/reorder',
  auth,
  requirePermission('listing.manage_collections'),
  catchAsync(async (req: Request, res: Response) => {
    const { orders } = ReorderSchema.parse(req.body);

    const updates = orders.map((o) =>
      prisma.collection.update({
        where: { id: o.id },
        data: { sortOrder: o.sortOrder }
      })
    );

    await prisma.$transaction(updates);
    res.json({ success: true });
  })
);

// GET /collections/admin/:id - Fetch full collection detail for admin edit
router.get(
  '/admin/detail/:id',
  auth,
  requirePermission('listing.manage_collections'),
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const collection = await prisma.collection.findUnique({
      where: { id },
      include: {
        products: {
          orderBy: { sortOrder: 'asc' },
          include: {
            product: true
          }
        }
      }
    });
    if (!collection) {
      throw new AppError('Collection not found', 404, 'NOT_FOUND');
    }
    res.json(collection);
  })
);

// POST /tags - Admin create tag
router.post(
  '/tags',
  auth,
  requirePermission('listing.manage_tags'),
  catchAsync(async (req: Request, res: Response) => {
    const TagSchema = z.object({
      name: z.string().trim().min(1, 'Tag name required'),
      slug: z.string().trim().min(1, 'Slug required').toLowerCase(),
    });

    const body = TagSchema.parse(req.body);

    const tag = await prisma.tag.upsert({
      where: { slug: body.slug },
      update: {},
      create: {
        name: body.name,
        slug: body.slug
      }
    });

    res.status(201).json(tag);
  })
);

// DELETE /tags/:id - Admin delete tag
router.delete(
  '/tags/:id',
  auth,
  requirePermission('listing.manage_tags'),
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    await prisma.tag.delete({ where: { id } });
    res.json({ success: true });
  })
);

// GET /collections/:slug - Fetch single collection detail with all available items
router.get(
  '/:slug',
  catchAsync(async (req: Request, res: Response) => {
    const { slug } = req.params;

    const collection = await prisma.collection.findUnique({
      where: { slug },
      include: {
        products: {
          orderBy: { sortOrder: 'asc' },
          include: {
            product: {
              include: {
                images: {
                  orderBy: { order: 'asc' }
                }
              }
            }
          }
        }
      }
    });

    if (!collection || !collection.isActive) {
      throw new AppError('Collection not found', 404, 'NOT_FOUND');
    }

    // Filter to only return AVAILABLE products
    const availableProducts = collection.products
      .filter((cp) => cp.product.status === ItemStatus.AVAILABLE)
      .map((cp) => ({
        ...cp.product,
        collectionSortOrder: cp.sortOrder
      }));

    res.json({
      ...collection,
      products: availableProducts
    });
  })
);

// GET /tags/:slug - Fetch products by tag
router.get(
  '/tags/:slug',
  catchAsync(async (req: Request, res: Response) => {
    const { slug } = req.params;
    const tag = await prisma.tag.findUnique({
      where: { slug },
      include: {
        products: {
          include: {
            product: {
              include: {
                images: {
                  orderBy: { order: 'asc' }
                }
              }
            }
          }
        }
      }
    });

    if (!tag) {
      throw new AppError('Tag not found', 404, 'NOT_FOUND');
    }

    const availableProducts = tag.products
      .filter((tp) => tp.product.status === ItemStatus.AVAILABLE)
      .map((tp) => tp.product);

    res.json({
      ...tag,
      products: availableProducts
    });
  })
);

// PUT /collections/:id - Update a collection
router.put(
  '/:id',
  auth,
  requirePermission('listing.manage_collections'),
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const body = CollectionSchema.parse(req.body);

    const existing = await prisma.collection.findFirst({
      where: { slug: body.slug, NOT: { id } }
    });
    if (existing) {
      throw new AppError('A collection with this URL slug already exists', 400, 'SLUG_EXISTS');
    }

    const collection = await prisma.collection.update({
      where: { id },
      data: {
        name: body.name,
        slug: body.slug,
        description: body.description,
        bannerImageUrl: body.bannerImageUrl,
        isActive: body.isActive,
        sortOrder: body.sortOrder,
      }
    });

    res.json(collection);
  })
);

// DELETE /collections/:id - Delete a collection
router.delete(
  '/:id',
  auth,
  requirePermission('listing.manage_collections'),
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    await prisma.collection.delete({ where: { id } });
    res.json({ success: true });
  })
);

// POST /collections/:id/products - Add product(s) to a collection
router.post(
  '/:id/products',
  auth,
  requirePermission('listing.manage_collections'),
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { productIds } = z.object({ productIds: z.array(z.string()) }).parse(req.body);

    // Get max sortOrder currently in collection
    const currentMax = await prisma.collectionProduct.aggregate({
      where: { collectionId: id },
      _max: { sortOrder: true }
    });
    let startSort = (currentMax._max.sortOrder ?? -1) + 1;

    const inserts = productIds.map((pId, idx) =>
      prisma.collectionProduct.upsert({
        where: {
          collectionId_productId: { collectionId: id, productId: pId }
        },
        update: {},
        create: {
          collectionId: id,
          productId: pId,
          sortOrder: startSort + idx
        }
      })
    );

    await prisma.$transaction(inserts);
    res.json({ success: true });
  })
);

// PUT /collections/:id/products/reorder - Reorder products in a collection
router.put(
  '/:id/products/reorder',
  auth,
  requirePermission('listing.manage_collections'),
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { orders } = ReorderProductsSchema.parse(req.body);

    const updates = orders.map((o) =>
      prisma.collectionProduct.update({
        where: {
          collectionId_productId: { collectionId: id, productId: o.productId }
        },
        data: { sortOrder: o.sortOrder }
      })
    );

    await prisma.$transaction(updates);
    res.json({ success: true });
  })
);

// DELETE /collections/:id/products/:productId - Remove a product from a collection
router.delete(
  '/:id/products/:productId',
  auth,
  requirePermission('listing.manage_collections'),
  catchAsync(async (req: Request, res: Response) => {
    const { id, productId } = req.params;

    await prisma.collectionProduct.delete({
      where: {
        collectionId_productId: { collectionId: id, productId }
      }
    });

    res.json({ success: true });
  })
);

export default router;
