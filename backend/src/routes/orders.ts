import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import fs from 'fs';
import prisma from '../services/db';
import redis from '../services/redis';
import { auth } from '../middleware/auth';
import { AppError, catchAsync } from '../utils/errors';
import { ItemStatus, PaymentMethod } from '@prisma/client';
import {
  createRazorpayOrder,
  verifyPaymentSignature,
  fetchRazorpayPayment,
  generateOrderNumber
} from '../services/payment';
import { reserveItem, markSold } from '../services/inventory';
import { queueInvoiceGeneration } from '../services/queue';
import {
  notificationsService,
  sendOrderConfirmedSMS,
  sendAdminAlert,
  sendDeliveredEmail,
  sendDeliveredSMS
} from '../services/notifications';
import { config } from '../config';

const router = Router();

const InitiateOrderSchema = z.object({
  productId: z.string().cuid(),
  addressId: z.string().cuid(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional().default(PaymentMethod.UPI),
  buyerNote: z.string().max(500).optional(),
});

const ConfirmPaymentSchema = z.object({
  orderId: z.string().cuid(),
  razorpayPaymentId: z.string(),
  razorpayOrderId: z.string(),
  razorpaySignature: z.string(),
});

async function getSetting(key: string): Promise<string | null> {
  const s = await prisma.siteSetting.findUnique({ where: { key } });
  return s?.value ?? null;
}

async function getShippingCost(priceINR: number): Promise<number> {
  const freeAbove = await getSetting('shipping_free_above_inr');
  const flatRate = await getSetting('shipping_flat_rate_inr');
  if (freeAbove && priceINR >= parseInt(freeAbove, 10)) return 0;
  return parseInt(flatRate || '99', 10);
}

// ─── POST /orders/initiate ──────────────────────────────────
router.post(
  '/initiate',
  auth,
  catchAsync(async (req: any, res: Response) => {
    const { productId, addressId, paymentMethod, buyerNote } = InitiateOrderSchema.parse(req.body);
    const userId = req.user.id;

    // Fetch product
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });
    if (!product) {
      throw new AppError('Product not found', 404, 'NOT_FOUND');
    }
    if (product.status !== ItemStatus.AVAILABLE) {
      return res.status(400).json({ error: 'ITEM_NOT_AVAILABLE', status: product.status });
    }

    // Fetch address and verify ownership
    const address = await prisma.address.findUnique({
      where: { id: addressId }
    });
    if (!address || address.userId !== userId) {
      return res.status(404).json({ error: 'ADDRESS_NOT_FOUND' });
    }

    // 1. Fetch sitewide sale status
    const sale = await prisma.siteSale.findUnique({ where: { id: '1' } });
    const saleActive = sale?.isActive && (
      (!sale.startsAt || sale.startsAt <= new Date()) &&
      (!sale.endsAt || sale.endsAt >= new Date())
    );

    const basePriceINR = saleActive 
      ? Math.floor(product.priceINR * (1 - sale.discountPct / 100)) 
      : product.priceINR;

    // Calculate shipping cost based on the active checkout price
    const shippingINR = await getShippingCost(basePriceINR);

    // 2. Fetch coupon applied in Redis cart (if any) and validate
    let discountINR = 0;
    let shippingCost = shippingINR;
    let couponId = null;
    let couponCode = null;

    if (redis.isOpen) {
      const cartRaw = await redis.get(`cart:${userId}`);
      if (cartRaw) {
        const cart = JSON.parse(cartRaw);
        if (cart.coupon) {
          const coupon = await prisma.coupon.findUnique({
            where: { id: cart.coupon.id }
          });

          if (coupon && coupon.isActive) {
            const now = new Date();
            const validDates = coupon.validFrom <= now && (!coupon.validUntil || coupon.validUntil >= now);
            const validUses = coupon.maxUsesTotal === null || coupon.usedCount < coupon.maxUsesTotal;
            const validMinOrder = basePriceINR >= coupon.minOrderINR;

            const userUses = await prisma.couponUse.count({
              where: { couponId: coupon.id, userId }
            });
            const validUserUses = userUses < coupon.maxUsesPerUser;

            if (validDates && validUses && validMinOrder && validUserUses) {
              couponId = coupon.id;
              couponCode = coupon.code;
              
              if (coupon.type === 'PERCENTAGE') {
                discountINR = Math.floor((basePriceINR * coupon.value) / 100);
              } else if (coupon.type === 'FIXED_INR') {
                discountINR = Math.min(coupon.value, basePriceINR);
              } else if (coupon.type === 'FREE_SHIPPING') {
                shippingCost = 0;
              }
            }
          }
        }
      }
    }

    const totalINR = basePriceINR + shippingCost - discountINR;

    // Reserve item
    try {
      await reserveItem(product.id, userId, 'pending');
    } catch (err: any) {
      if (err.message === 'ITEM_NOT_AVAILABLE') {
        return res.status(400).json({
          error: 'ITEM_JUST_RESERVED',
          message: 'Someone else is checking out this item'
        });
      }
      throw err;
    }

    // Generate human-readable order number
    const orderNumber = await generateOrderNumber();

    // Create Order, CouponUse, and increment coupon count atomically in transaction
    const order = await prisma.$transaction(async (tx) => {
      const ord = await tx.order.create({
        data: {
          orderNumber,
          userId,
          productId: product.id,
          addressId,
          priceINR: basePriceINR,
          shippingINR: shippingCost,
          totalINR,
          couponCode,
          couponDiscount: discountINR > 0 ? discountINR : null,
          couponId,
          status: 'PENDING_PAYMENT',
          buyerNote,
          paymentMethod,
        }
      });

      if (couponId) {
        await tx.coupon.update({
          where: { id: couponId },
          data: { usedCount: { increment: 1 } }
        });

        await tx.couponUse.create({
          data: {
            couponId,
            userId,
            orderId: ord.id
          }
        });
      }

      return ord;
    });

    // Update reservation Redis key to store actual orderId
    if (redis.isOpen) {
      await redis.setEx(`reservation:${product.id}`, 900, order.id);
    }

    // Fetch buyer details
    const dbUser = await prisma.user.findUnique({
      where: { id: userId }
    });
    if (!dbUser) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    // If COD
    if (paymentMethod === PaymentMethod.COD) {
      const codEnabledSetting = await getSetting('cod_enabled');
      if (codEnabledSetting === 'true') {
        // Mark as confirmed and sold immediately
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: 'CONFIRMED',
            paidAt: new Date()
          }
        });

        await markSold(product.id);

        const populatedOrder = await prisma.order.findUnique({
          where: { id: order.id },
          include: { user: true, product: true, address: true }
        });

        // Trigger confirmation emails & SMS
        if (populatedOrder) {
          notificationsService.sendOrderConfirmationEmail(populatedOrder).catch((err: any) => {
            console.error('❌ Failed to send COD confirmation email:', err);
          });
          notificationsService.sendAdminNewOrderEmail(populatedOrder).catch((err: any) => {
            console.error('❌ Failed to send COD admin new order email:', err);
          });
          if (dbUser.phone) {
            sendOrderConfirmedSMS(dbUser.phone, dbUser.name, order.orderNumber, product.displayName).catch((err: any) => {
              console.error('❌ Failed to send COD confirmation SMS:', err);
            });
          }
        }

        // Clear user cart
        if (redis.isOpen) {
          await redis.del(`cart:${userId}`);
        }

        return res.json({
          orderId: order.id,
          paymentMethod: 'COD',
          success: true
        });
      } else {
        // Revert coupon if COD failed
        if (couponId) {
          await prisma.coupon.update({
            where: { id: couponId },
            data: { usedCount: { decrement: 1 } }
          });
          await prisma.couponUse.deleteMany({
            where: { orderId: order.id }
          });
        }
        // Revert reservation
        await prisma.product.update({
          where: { id: product.id },
          data: { status: 'AVAILABLE', reservedAt: null, reservedByUserId: null }
        });
        if (redis.isOpen) {
          await redis.del(`reservation:${product.id}`);
        }
        throw new AppError('Cash on Delivery is currently disabled', 400, 'COD_DISABLED');
      }
    }

    // Check if Razorpay keys are configured
    const isRazorpayConfigured = !!(
      config.RAZORPAY_KEY_ID &&
      config.RAZORPAY_KEY_ID !== 'YOUR_KEY_ID' &&
      !config.RAZORPAY_KEY_ID.startsWith('YOUR_') &&
      !config.RAZORPAY_KEY_ID.includes('placeholder') &&
      config.RAZORPAY_KEY_SECRET &&
      config.RAZORPAY_KEY_SECRET !== 'YOUR_KEY_SECRET' &&
      !config.RAZORPAY_KEY_SECRET.startsWith('YOUR_') &&
      !config.RAZORPAY_KEY_SECRET.includes('placeholder')
    );

    if (!isRazorpayConfigured) {
      const mockRzpOrderId = `mock_order_${order.id}`;
      await prisma.order.update({
        where: { id: order.id },
        data: { razorpayOrderId: mockRzpOrderId }
      });

      return res.json({
        orderId: order.id,
        orderNumber: order.orderNumber,
        razorpayOrderId: mockRzpOrderId,
        razorpayKeyId: 'mock_key',
        amount: totalINR,
        amountPaise: totalINR * 100,
        currency: 'INR',
        productName: product.displayName,
        productImage: product.primaryImageUrl,
        userName: dbUser.name,
        userEmail: dbUser.email,
        userPhone: dbUser.phone || '',
        isMockPayment: true
      });
    }

    // Create Razorpay Order
    let rzpOrder;
    try {
      rzpOrder = await createRazorpayOrder(totalINR, order.id);
    } catch (err: any) {
      // Revert reservation on Razorpay order creation failure
      await prisma.product.update({
        where: { id: product.id },
        data: { status: 'AVAILABLE', reservedAt: null, reservedByUserId: null }
      });
      if (redis.isOpen) {
        await redis.del(`reservation:${product.id}`);
      }
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'PAYMENT_FAILED' }
      });
      // Revert coupon on failure
      if (couponId) {
        await prisma.coupon.update({
          where: { id: couponId },
          data: { usedCount: { decrement: 1 } }
        });
        await prisma.couponUse.deleteMany({
          where: { orderId: order.id }
        });
      }
      throw new AppError(`Razorpay order initiation failed: ${err.message || err}`, 500, 'PAYMENT_INIT_ERROR');
    }

    // Update Order with razorpayOrderId
    await prisma.order.update({
      where: { id: order.id },
      data: { razorpayOrderId: rzpOrder.id }
    });

    res.json({
      orderId: order.id,
      orderNumber: order.orderNumber,
      razorpayOrderId: rzpOrder.id,
      razorpayKeyId: config.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID!,
      amount: totalINR,
      amountPaise: totalINR * 100,
      currency: 'INR',
      productName: product.displayName,
      productImage: product.primaryImageUrl,
      userName: dbUser.name,
      userEmail: dbUser.email,
      userPhone: dbUser.phone || '',
      isMockPayment: false
    });
  })
);

// ─── POST /orders/confirm-payment ───────────────────────────
router.post(
  '/confirm-payment',
  auth,
  catchAsync(async (req: any, res: Response) => {
    const { orderId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = ConfirmPaymentSchema.parse(req.body);
    const userId = req.user.id;

    // Fetch order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true, product: true }
    });

    if (!order) {
      throw new AppError('Order not found', 404, 'NOT_FOUND');
    }

    if (order.userId !== userId) {
      throw new AppError('Unauthorized access to order', 403, 'FORBIDDEN');
    }

    if (order.status === 'CONFIRMED') {
      // Idempotency check: if already confirmed by webhook, return success directly
      return res.json({ success: true, orderId: order.id, orderNumber: order.orderNumber });
    }

    if (order.status !== 'PENDING_PAYMENT') {
      throw new AppError('Order is not in PENDING_PAYMENT status', 400, 'BAD_REQUEST');
    }

    const isMock = razorpayOrderId.startsWith('mock_order_') || razorpaySignature === 'mock_signature';

    if (!isMock) {
      // Verify HMAC signature
      const isValidSignature = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
      if (!isValidSignature) {
        return res.status(400).json({ error: 'INVALID_SIGNATURE' });
      }

      // Amount validation
      try {
        const rzpPayment = await fetchRazorpayPayment(razorpayPaymentId);
        // Razorpay returns amount in paise
        const rzpAmountINR = Number((rzpPayment as any).amount) / 100;
        if (rzpAmountINR !== order.totalINR) {
          console.error(`⚠️ ALERT: Razorpay payment amount mismatch! Rzp: ${rzpAmountINR} INR, Order: ${order.totalINR} INR. Order ID: ${order.id}`);
          // Do not block, log and investigate as Razorpay captured the paid amount on their end.
        }
      } catch (err: any) {
        console.error('⚠️ Could not verify payment amount with Razorpay API:', err.message || err);
      }
    }

    // Process transaction: Confirm order and mark item sold
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'CONFIRMED',
          razorpayPaymentId,
          razorpaySignature,
          paidAt: new Date(),
        }
      });

      await markSold(order.productId);
    });

    // Queue invoice generation job
    await queueInvoiceGeneration(order.id);

    // Fetch completely populated order for notifications
    const populatedOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true, product: true, address: true }
    });

    if (populatedOrder) {
      // Trigger order confirmation email
      notificationsService.sendOrderConfirmationEmail(populatedOrder).catch((err: any) => {
        console.error('❌ Failed to send confirmation email:', err);
      });
      // Trigger admin new order email
      notificationsService.sendAdminNewOrderEmail(populatedOrder).catch((err: any) => {
        console.error('❌ Failed to send admin new order email:', err);
      });
      // Trigger SMS
      if (populatedOrder.user.phone) {
        sendOrderConfirmedSMS(populatedOrder.user.phone, populatedOrder.user.name, order.orderNumber, populatedOrder.product.displayName).catch((err: any) => {
          console.error('❌ Failed to send confirmation SMS:', err);
        });
      }
    }

    // Clear user cart
    if (redis.isOpen) {
      await redis.del(`cart:${userId}`);
    }

    res.json({ success: true, orderId: order.id, orderNumber: order.orderNumber });
  })
);

// ─── GET /orders/my ─────────────────────────────────────────
router.get(
  '/my',
  auth,
  catchAsync(async (req: any, res: Response) => {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      include: {
        product: {
          include: {
            images: {
              orderBy: { order: 'asc' },
              take: 1
            }
          }
        },
        address: true,
        invoice: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(orders);
  })
);

// ─── POST /orders/shiprocket-webhook ─────────────────────────
// NOTE: This route MUST be defined before /:id to prevent 'shiprocket-webhook' matching as an order ID
router.post(
  '/shiprocket-webhook',
  catchAsync(async (req: Request, res: Response) => {
    // Log the request and acknowledge immediately
    console.log('📬 Shiprocket Webhook Event received:', JSON.stringify(req.body));
    res.status(200).json({ received: true });

    const { awb, current_status } = req.body;
    if (!awb) return;

    const order = await prisma.order.findFirst({
      where: { awbCode: awb },
      include: { user: true, product: true, address: true }
    });

    if (!order) {
      console.warn(`⚠️ Shiprocket Webhook: No order found for AWB: ${awb}`);
      return;
    }

    switch (current_status) {
      case 'PICKUP SCHEDULED':
      case 'PICKUP GENERATED':
        await prisma.order.update({
          where: { id: order.id },
          data: { status: 'PROCESSING' }
        });
        console.log(`📦 Order ${order.orderNumber} status updated to PROCESSING`);
        break;

      case 'IN TRANSIT':
      case 'OUT FOR DELIVERY':
        // Status already SHIPPED — no DB change needed
        console.log(`🚚 Order ${order.orderNumber} is in transit (AWB: ${awb})`);
        break;

      case 'DELIVERED':
        const deliveredOrder = await prisma.order.update({
          where: { id: order.id },
          data: { status: 'DELIVERED', deliveredAt: new Date() },
          include: { user: true, product: true, address: true }
        });
        console.log(`✅ Order ${order.orderNumber} status updated to DELIVERED`);
        
        // Send email and SMS
        await sendDeliveredEmail(deliveredOrder).catch((err: any) => {
          console.error('❌ Failed to send Delivered Email:', err);
        });
        if (order.user.phone) {
          await sendDeliveredSMS(order.user.phone, order.user.name, order.orderNumber).catch((err: any) => {
            console.error('❌ Failed to send Delivered SMS:', err);
          });
        }
        break;

      case 'UNDELIVERED':
      case 'DELIVERY FAILED':
        console.warn(`❌ Order ${order.orderNumber} delivery failed!`);
        await sendAdminAlert(
          `Delivery failed — Order ${order.orderNumber}`,
          `AWB: ${awb}\nBuyer: ${order.user.name}\nPhone: ${order.user.phone}\nAddress: ${order.address.line1}, ${order.address.city}, ${order.address.state} - ${order.address.pincode}`
        );
        break;

      case 'RTO INITIATED':
      case 'RTO':
        await prisma.order.update({
          where: { id: order.id },
          data: { status: 'CANCELLED' }
        });
        console.warn(`↩️ Order ${order.orderNumber} RTO initiated!`);
        await sendAdminAlert(
          `RTO Initiated — Order ${order.orderNumber}`,
          `Item is being returned. AWB: ${awb}. Relist manually once received.`
        );
        break;
      
      default:
        console.log(`ℹ️ Unhandled Shiprocket status: ${current_status} for AWB: ${awb}`);
        break;
    }
  })
);

// ─── GET /orders/:id/invoice ────────────────────────────────
router.get(
  '/:id/invoice',
  auth,
  catchAsync(async (req: any, res: Response) => {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { invoice: true }
    });

    if (!order) {
      throw new AppError('Order not found', 404, 'NOT_FOUND');
    }

    // Auth check: User must own the order or be admin
    if (order.userId !== req.user.id && !req.user.isAdmin) {
      throw new AppError('Unauthorized access to invoice', 403, 'FORBIDDEN');
    }

    if (!order.invoice) {
      return res.status(202).json({ error: 'INVOICE_NOT_READY' });
    }

    const pdfPath = order.invoice.pdfPath;
    if (!fs.existsSync(pdfPath)) {
      console.error(`❌ Invoice PDF file not found on disk at: ${pdfPath}`);
      return res.status(404).json({ error: 'INVOICE_FILE_NOT_FOUND' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Invoice-${order.invoice.invoiceNo}.pdf`);
    fs.createReadStream(pdfPath).pipe(res);
  })
);

// ─── GET /orders/:id ────────────────────────────────────────
router.get(
  '/:id',
  auth,
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
        address: true,
        invoice: true
      }
    });

    if (!order) {
      throw new AppError('Order not found', 404, 'NOT_FOUND');
    }

    // User must own the order or be an admin
    if (order.userId !== req.user.id && !req.user.isAdmin) {
      throw new AppError('Unauthorized access to order details', 403, 'FORBIDDEN');
    }

    res.json(order);
  })
);

export default router;
