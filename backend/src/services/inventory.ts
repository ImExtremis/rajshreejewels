import prisma from './db';
import redis from './redis';

const RESERVATION_TTL_SECONDS = 900; // 15 minutes

export async function reserveItem(productId: string, userId: string, orderId: string): Promise<boolean> {
  return await prisma.$transaction(async (tx) => {
    const product: any = await tx.$queryRawUnsafe(`
      SELECT id, status FROM "Product" 
      WHERE id = $1 AND status = 'AVAILABLE'
      FOR UPDATE NOWAIT
    `, productId);
    
    if (!product || product.length === 0) {
      throw new Error('ITEM_NOT_AVAILABLE');
    }
    
    await tx.product.update({
      where: { id: productId },
      data: {
        status: 'RESERVED',
        reservedAt: new Date(),
        reservedByUserId: userId,
      }
    });
    
    if (redis.isOpen) {
      await redis.setEx(
        `reservation:${productId}`,
        RESERVATION_TTL_SECONDS,
        orderId
      );
    }
    
    return true;
  });
}

export async function releaseExpiredReservations(): Promise<void> {
  const expiredProducts = await prisma.product.findMany({
    where: {
      status: 'RESERVED',
      reservedAt: {
        lt: new Date(Date.now() - RESERVATION_TTL_SECONDS * 1000)
      }
    }
  });
  
  for (const product of expiredProducts) {
    const order = await prisma.order.findFirst({
      where: { productId: product.id, status: 'PENDING_PAYMENT' }
    });

    if (order && order.couponId) {
      try {
        await prisma.coupon.update({
          where: { id: order.couponId },
          data: { usedCount: { decrement: 1 } }
        });
        await prisma.couponUse.deleteMany({
          where: { orderId: order.id }
        });
      } catch (err: any) {
        console.error('❌ Failed to revert coupon on expired reservation:', err.message);
      }
    }

    await prisma.$transaction([
      prisma.product.update({
        where: { id: product.id },
        data: { status: 'AVAILABLE', reservedAt: null, reservedByUserId: null }
      }),
      prisma.order.updateMany({
        where: { productId: product.id, status: 'PENDING_PAYMENT' },
        data: { status: 'PAYMENT_FAILED' }
      })
    ]);
  }
}

export async function releaseReservation(productId: string): Promise<void> {
  const order = await prisma.order.findFirst({
    where: { productId, status: 'PENDING_PAYMENT' }
  });

  if (order && order.couponId) {
    try {
      await prisma.coupon.update({
        where: { id: order.couponId },
        data: { usedCount: { decrement: 1 } }
      });
      await prisma.couponUse.deleteMany({
        where: { orderId: order.id }
      });
    } catch (err: any) {
      console.error('❌ Failed to revert coupon on released reservation:', err.message);
    }
  }

  await prisma.$transaction([
    prisma.product.update({
      where: { id: productId },
      data: { status: 'AVAILABLE', reservedAt: null, reservedByUserId: null }
    }),
    prisma.order.updateMany({
      where: { productId, status: 'PENDING_PAYMENT' },
      data: { status: 'PAYMENT_FAILED' }
    })
  ]);
  
  if (redis.isOpen) {
    await redis.del(`reservation:${productId}`);
  }
}

export async function markSold(productId: string): Promise<void> {
  await prisma.product.update({
    where: { id: productId },
    data: { status: 'SOLD', soldAt: new Date() }
  });
  
  if (redis.isOpen) {
    await redis.del(`reservation:${productId}`);
  }
}
