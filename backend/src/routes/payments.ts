import { Router, Request, Response } from 'express';
import prisma from '../services/db';
import redis from '../services/redis';
import { verifyWebhookSignature } from '../services/payment';
import { markSold, releaseReservation } from '../services/inventory';
import { queueInvoiceGeneration } from '../services/queue';
import {
  notificationsService,
  sendOrderConfirmedSMS,
  notifyWishlistOnRelist
} from '../services/notifications';

const router = Router();

router.post('/webhook', async (req: Request, res: Response) => {
  const signature = req.headers['x-razorpay-signature'] as string;
  
  // Verify signature using the raw body buffer
  // Note: req.body is a raw buffer since we mounted express.raw() on this endpoint in index.ts
  const rawBody = req.body instanceof Buffer ? req.body.toString() : JSON.stringify(req.body);

  // Always respond 200 first to acknowledge receipt to Razorpay
  // Razorpay retries if it doesn't get a 200 response within 5 seconds
  res.status(200).json({ received: true });

  if (!signature) {
    console.warn('⚠️ Razorpay webhook warning: x-razorpay-signature header missing');
    return;
  }

  const isValid = verifyWebhookSignature(rawBody, signature);
  if (!isValid) {
    console.warn('⚠️ Razorpay webhook warning: Invalid signature received');
    return;
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (err: any) {
    console.error('❌ Failed to parse Razorpay webhook JSON payload:', err.message || err);
    return;
  }

  console.log(`🔌 Razorpay Webhook received event: ${event.event}`);

  switch (event.event) {
    case 'payment.captured': {
      const payment = event.payload.payment.entity;
      
      // Find order by razorpayOrderId
      const order = await prisma.order.findUnique({
        where: { razorpayOrderId: payment.order_id },
        include: { user: true, product: true }
      });
      if (!order) {
        console.warn(`⚠️ Order not found for Razorpay order ID: ${payment.order_id}`);
        return;
      }

      // IDEMPOTENCY CHECK — skip if already CONFIRMED
      if (order.status === 'CONFIRMED') {
        console.log(`ℹ️ Webhook idempotency: Order #${order.orderNumber} is already CONFIRMED. Skipping.`);
        return;
      }

      // Transactionally confirm order & mark sold
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'CONFIRMED',
            razorpayPaymentId: payment.id,
            paidAt: new Date(),
          }
        });
        await markSold(order.productId);
      });

      // Fetch completed populated order for notifications
      const populatedOrder = await prisma.order.findUnique({
        where: { id: order.id },
        include: { user: true, product: true, address: true }
      });

      // Queue invoice generation
      await queueInvoiceGeneration(order.id);

      if (populatedOrder) {
        // Send order confirmation email
        notificationsService.sendOrderConfirmationEmail(populatedOrder).catch((err: any) => {
          console.error('❌ Failed to send webhook confirmation email:', err);
        });

        // Send admin notification email
        notificationsService.sendAdminNewOrderEmail(populatedOrder).catch((err: any) => {
          console.error('❌ Failed to send webhook admin notification email:', err);
        });

        // Send SMS
        if (populatedOrder.user.phone) {
          sendOrderConfirmedSMS(
            populatedOrder.user.phone,
            populatedOrder.user.name,
            populatedOrder.orderNumber,
            populatedOrder.product.displayName
          ).catch(err => {
            console.error('❌ Failed to send webhook confirmation SMS:', err);
          });
        }
      }

      // Clear user cart from Redis
      if (redis.isOpen) {
        await redis.del(`cart:${order.userId}`);
      }

      break;
    }

    case 'payment.failed': {
      const payment = event.payload.payment.entity;
      
      const order = await prisma.order.findUnique({
        where: { razorpayOrderId: payment.order_id },
        include: { user: true, product: true }
      });
      if (!order || order.status !== 'PENDING_PAYMENT') return;

      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'PAYMENT_FAILED' }
      });

      // Release reservation
      await releaseReservation(order.productId);

      // Send payment failed email
      notificationsService.sendPaymentFailedEmail(order).catch((err: any) => {
        console.error('❌ Failed to send payment failed email:', err);
      });

      break;
    }

    case 'refund.created': {
      const refund = event.payload.refund.entity;
      
      const order = await prisma.order.findUnique({
        where: { razorpayPaymentId: refund.payment_id },
        include: { user: true, product: true }
      });
      if (!order) return;

      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'REFUNDED' }
      });

      // Relist item if it was never shipped
      if (!order.awbCode) {
        await prisma.product.update({
          where: { id: order.productId },
          data: { status: 'AVAILABLE', soldAt: null }
        });
        
        // Notify wishlisted users
        notifyWishlistOnRelist(order.productId).catch(err => {
          console.error('❌ Failed to notify wishlisted users on relist:', err);
        });
      }

      break;
    }
  }
});

export default router;
