import Razorpay from 'razorpay';
import crypto from 'crypto';
import prisma from './db';
import { config } from '../config';

const razorpay = new Razorpay({
  key_id: config.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID!,
  key_secret: config.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET!,
});

// Create a Razorpay order — amount must be in PAISE (multiply INR × 100)
export async function createRazorpayOrder(amountINR: number, receipt: string) {
  return await razorpay.orders.create({
    amount: Math.round(amountINR * 100),        // CRITICAL: paise, not rupees
    currency: 'INR',
    receipt,                        // Use our internal order ID
    payment_capture: true,          // Auto-capture on payment
  });
}

// Fetch a payment from Razorpay API to verify details (e.g. amount)
export async function fetchRazorpayPayment(paymentId: string) {
  return await razorpay.payments.fetch(paymentId);
}

// Verify payment signature — HMAC SHA256
export function verifyPaymentSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string
): boolean {
  const body = razorpayOrderId + '|' + razorpayPaymentId;
  const expectedSignature = crypto
    .createHmac('sha256', config.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET!)
    .update(body)
    .digest('hex');
  return expectedSignature === razorpaySignature;
}

// Verify webhook signature
export function verifyWebhookSignature(
  rawBody: string,
  razorpaySignature: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', config.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest('hex');
  return expectedSignature === razorpaySignature;
}

// Initiate refund
export async function initiateRazorpayRefund(
  paymentId: string,
  amountINR: number,
  notes: Record<string, string>
) {
  return await razorpay.payments.refund(paymentId, {
    amount: Math.round(amountINR * 100),        // paise
    notes,
  });
}

// Sequential order number generator
export async function generateOrderNumber(): Promise<string> {
  // Ensure the sequence row exists
  await prisma.$executeRaw`
    INSERT INTO "OrderSequence" (id, "lastVal") VALUES (1, 0)
    ON CONFLICT (id) DO NOTHING
  `;

  // Atomic increment using Prisma raw SQL
  const result = await prisma.$queryRaw<{ lastVal: number }[]>`
    UPDATE "OrderSequence" SET "lastVal" = "lastVal" + 1 WHERE id = 1
    RETURNING "lastVal"
  `;
  
  const seq = result[0]?.lastVal ?? 1;
  const year = new Date().getFullYear();
  return `ORD-${year}-${String(seq).padStart(4, '0')}`;  // e.g. ORD-2026-0001
}

// Sequential invoice number generator
export async function generateInvoiceNumber(): Promise<string> {
  // Ensure the sequence row exists
  await prisma.$executeRaw`
    INSERT INTO "InvoiceSequence" (id, "lastVal") VALUES (1, 0)
    ON CONFLICT (id) DO NOTHING
  `;

  // Atomic increment using Prisma raw SQL
  const result = await prisma.$queryRaw<{ lastVal: number }[]>`
    UPDATE "InvoiceSequence" SET "lastVal" = "lastVal" + 1 WHERE id = 1
    RETURNING "lastVal"
  `;
  
  const seq = result[0]?.lastVal ?? 1;
  const year = new Date().getFullYear();
  return `INV-${year}-${String(seq).padStart(4, '0')}`;  // e.g. INV-2026-0001
}
