import { Router, Request, Response } from 'express';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import prisma from '../services/db';
import { catchAsync, AppError } from '../utils/errors';
import { auth } from '../middleware/auth';
import { requirePermission } from '../middleware/requirePermission';
import { config } from '../config';
import { MessageFrom } from '@prisma/client';

const router = Router();

// Zod schemas
const PostMessageSchema = z.object({
  body: z.string().trim().min(1, 'Message cannot be empty').max(1000, 'Message cannot exceed 1000 characters')
});

// Configure SMTP mail transporter for message alerts
const transporter = nodemailer.createTransport({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  secure: config.SMTP_PORT === 465,
  auth: config.SMTP_USER ? {
    user: config.SMTP_USER,
    pass: config.SMTP_PASS
  } : undefined
});

// GET /messages/order/:orderId - Fetch message thread for an order
router.get(
  '/order/:orderId',
  auth,
  catchAsync(async (req: any, res: Response) => {
    const { orderId } = req.params;
    const userId = req.user.id;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true }
    });

    if (!order) {
      throw new AppError('Order not found', 404, 'NOT_FOUND');
    }

    // Security check: Only the buyer or authorized admin can view order messages
    const isBuyer = order.userId === userId;
    let isAdmin = false;
    
    if (!isBuyer) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user?.isOwner) {
        isAdmin = true;
      } else {
        const { hasPermission } = require('../services/permissions');
        isAdmin = await hasPermission(userId, 'orders.view');
      }

      if (!isAdmin) {
        throw new AppError('Access denied', 403, 'FORBIDDEN');
      }
    }

    const messages = await prisma.orderMessage.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' }
    });

    res.json(messages);
  })
);

// POST /messages/order/:orderId - Send message inside order thread
router.post(
  '/order/:orderId',
  auth,
  catchAsync(async (req: any, res: Response) => {
    const { orderId } = req.params;
    const { body } = PostMessageSchema.parse(req.body);
    const userId = req.user.id;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true, product: true }
    });

    if (!order) {
      throw new AppError('Order not found', 404, 'NOT_FOUND');
    }

    const isBuyer = order.userId === userId;
    let isAdmin = false;
    
    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    if (currentUser?.isOwner) {
      isAdmin = true;
    } else {
      const { hasPermission } = require('../services/permissions');
      isAdmin = await hasPermission(userId, 'orders.view');
    }

    if (!isBuyer && !isAdmin) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }

    // Determine message sender type
    const fromType = isBuyer ? MessageFrom.CUSTOMER : MessageFrom.ADMIN;

    const message = await prisma.orderMessage.create({
      data: {
        orderId,
        fromType,
        fromId: userId,
        body
      }
    });

    // Mark previous incoming messages as read and update order notifications
    if (fromType === MessageFrom.CUSTOMER) {
      // Flag order with unread messages for admin dashboard badge
      await prisma.order.update({
        where: { id: orderId },
        data: { hasUnreadMessages: true }
      });

      // Dispatch alert email to store administrator
      if (config.SMTP_USER) {
        const storeEmail = await prisma.siteSetting.findUnique({ where: { key: 'store_email' } }).then(s => s?.value || config.EMAIL_FROM);
        const mailOptions = {
          from: config.EMAIL_FROM,
          to: storeEmail,
          subject: `💬 New Message on Order ${order.orderNumber}`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; max-width: 600px; border: 1px solid #eee; border-radius: 5px;">
              <h2 style="color: #C9A84C; border-bottom: 1px solid #eee; padding-bottom: 10px;">New Customer Message</h2>
              <p>Customer <strong>${order.user.name}</strong> sent a message regarding order <strong>${order.orderNumber}</strong>:</p>
              <blockquote style="background: #f9f9f9; border-left: 4px solid #C9A84C; padding: 15px; margin: 20px 0; font-style: italic;">
                "${body}"
              </blockquote>
              <p>Product: <strong>${order.product.displayName}</strong></p>
              <p style="margin-top: 30px;">
                <a href="${config.ADMIN_URL}/orders" style="background: #C9A84C; color: #000; padding: 10px 20px; text-decoration: none; font-weight: bold; border-radius: 3px;">
                  Open Admin Dashboard
                </a>
              </p>
            </div>
          `
        };
        transporter.sendMail(mailOptions).catch(err => {
          console.error('❌ Failed to dispatch message SMTP alert:', err.message);
        });
      }
    } else {
      // Admin is replying: Mark all customer messages in this order thread as read
      await prisma.orderMessage.updateMany({
        where: {
          orderId,
          fromType: MessageFrom.CUSTOMER,
          readAt: null
        },
        data: {
          readAt: new Date()
        }
      });

      // Clear the unread messages notification flag
      await prisma.order.update({
        where: { id: orderId },
        data: { hasUnreadMessages: false }
      });

      // Notify customer via email about admin reply
      if (config.SMTP_USER && order.user.email) {
        const mailOptions = {
          from: config.EMAIL_FROM,
          to: order.user.email,
          subject: `✨ New Message from Rajshree Jewels`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; max-width: 600px; border: 1px solid #eee; border-radius: 5px;">
              <h2 style="color: #C9A84C; border-bottom: 1px solid #eee; padding-bottom: 10px;">Response Received</h2>
              <p>Hello ${order.user.name},</p>
              <p>Our operations team has replied to your query regarding order <strong>${order.orderNumber}</strong>:</p>
              <blockquote style="background: #f9f9f9; border-left: 4px solid #C9A84C; padding: 15px; margin: 20px 0; font-style: italic;">
                "${body}"
              </blockquote>
              <p>You can view the full thread and reply by logging into your account gallery.</p>
              <p style="margin-top: 30px;">
                <a href="${config.FRONTEND_URL}/account/orders/${order.id}" style="background: #C9A84C; color: #000; padding: 10px 20px; text-decoration: none; font-weight: bold; border-radius: 3px;">
                  View Order Thread
                </a>
              </p>
            </div>
          `
        };
        transporter.sendMail(mailOptions).catch(err => {
          console.error('❌ Failed to notify customer of admin reply:', err.message);
        });
      }
    }

    res.status(201).json(message);
  })
);

// PUT /messages/order/:orderId/read - Mark messages as read
router.put(
  '/order/:orderId/read',
  auth,
  catchAsync(async (req: any, res: Response) => {
    const { orderId } = req.params;
    const userId = req.user.id;

    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      throw new AppError('Order not found', 404, 'NOT_FOUND');
    }

    const isBuyer = order.userId === userId;
    let isAdmin = false;
    
    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    if (currentUser?.isOwner) {
      isAdmin = true;
    } else {
      const { hasPermission } = require('../services/permissions');
      isAdmin = await hasPermission(userId, 'orders.view');
    }

    if (isAdmin) {
      // Mark customer messages as read
      await prisma.orderMessage.updateMany({
        where: { orderId, fromType: MessageFrom.CUSTOMER, readAt: null },
        data: { readAt: new Date() }
      });
      // Clear order unread flag
      await prisma.order.update({
        where: { id: orderId },
        data: { hasUnreadMessages: false }
      });
    } else if (isBuyer) {
      // Mark admin messages as read
      await prisma.orderMessage.updateMany({
        where: { orderId, fromType: MessageFrom.ADMIN, readAt: null },
        data: { readAt: new Date() }
      });
    }

    res.json({ success: true });
  })
);

export default router;
