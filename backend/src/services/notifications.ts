import nodemailer from 'nodemailer';
import axios from 'axios';
import { config } from '../config';
import prisma from './db';

// Initialize Nodemailer SMTP Transporter
const transporter = nodemailer.createTransport({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  secure: config.SMTP_PORT === 465, // true for 465, false for 587
  auth: config.SMTP_USER && config.SMTP_PASS ? {
    user: config.SMTP_USER,
    pass: config.SMTP_PASS,
  } : undefined,
});

// Helper: Wraps emails in a gorgeous, responsive warm off-white and gold luxury template (Georgia serif / Arial body)
export const getLuxuryEmailHtml = (title: string, bodyContent: string): string => {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #FDFAF5; color: #1a1a1a; -webkit-font-smoothing: antialiased;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FDFAF5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #F5EFE3; border: 1px solid #E2D9C8; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.04);">
                <!-- Header -->
                <tr>
                  <td align="center" style="padding: 40px 40px 20px 40px; border-bottom: 1px solid #E2D9C8;">
                    <h1 style="margin: 0; font-family: Georgia, serif; font-size: 28px; font-weight: 600; letter-spacing: 2px; color: #1a1a1a;">RAJSHREE JEWELS</h1>
                    <p style="margin: 5px 0 0 0; font-family: Arial, sans-serif; font-size: 10px; font-weight: 600; color: #C9A84C; text-transform: uppercase; letter-spacing: 3px;">1-Gram Gold & Antique Jewellery</p>
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="padding: 40px; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1a1a1a;">
                    ${bodyContent}
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td align="center" style="padding: 30px 40px; background-color: #1a1a1a; color: #FDFAF5; font-size: 11px; font-family: Arial, sans-serif; letter-spacing: 0.5px;">
                    <p style="margin: 0 0 8px 0; font-family: Georgia, serif; font-size: 14px; font-weight: bold; color: #C9A84C;">${config.STORE_NAME || 'RAJSHREE JEWELS'}</p>
                    ${process.env.STORE_ADDRESS ? `<p style="margin: 0 0 15px 0; color: #7a6f5e;">${process.env.STORE_ADDRESS}</p>` : ''}
                    <p style="margin: 0; color: #7a6f5e; font-size: 10px;">You are receiving this transactional email as a user of ${config.STORE_NAME || 'Rajshree Jewels'}.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
};

// Generic email sender helper
export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<void> {
  if (!config.SMTP_USER || !config.SMTP_PASS) {
    console.log(`
┌────────────────────────────────────────────────────────┐
│ 📧 EMAIL LOG FALLBACK (SMTP CREDENTIALS MISSING)       │
├────────────────────────────────────────────────────────┤
│ To: ${to}
│ Subject: ${subject}
└────────────────────────────────────────────────────────┘
    `);
    return;
  }

  await transporter.sendMail({
    from: config.EMAIL_FROM,
    to,
    subject,
    html,
  });
}

// MSG91 SMS sender helper
export async function sendSMS(phone: string, templateId: string, vars: Record<string, string>): Promise<void> {
  if (!config.MSG91_AUTH_KEY) {
    console.log(`
┌────────────────────────────────────────────────────────┐
│ 📱 SMS LOG FALLBACK (MSG91_AUTH_KEY MISSING)          │
├────────────────────────────────────────────────────────┤
│ To: 91${phone}
│ Template ID: ${templateId}
│ Variables: ${JSON.stringify(vars)}
└────────────────────────────────────────────────────────┘
    `);
    return;
  }

  try {
    await axios.post('https://api.msg91.com/api/v5/flow/', {
      template_id: templateId,
      short_url: '0',
      recipients: [{ mobiles: `91${phone}`, ...vars }]
    }, {
      headers: { authkey: config.MSG91_AUTH_KEY }
    });
  } catch (err: any) {
    console.error('❌ MSG91 API request failed:', err.message || err);
  }
}

export const notificationsService = {
  sendEmail,
  // 1. sendVerificationEmail — Sends 6-digit verification code OTP
  sendVerificationEmail: async (to: string, name: string, otp: string): Promise<void> => {
    const title = 'Verify Your Email — Rajshree Jewels';
    const html = getLuxuryEmailHtml(
      title,
      `
        <p style="margin-top: 0;">Dear ${name},</p>
        <p>Thank you for choosing Rajshree Jewels. To finalize your account setup and enable checkouts, please verify your email address using the secure code below:</p>
        <div style="margin: 30px 0; text-align: center;">
          <span style="display: inline-block; background-color: #1a1a1a; color: #C9A84C; font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 6px; padding: 15px 30px; border-radius: 4px; border: 1px solid #C9A84C;">
            ${otp}
          </span>
        </div>
        <p>This code is valid for <strong>10 minutes</strong>. If you did not request this verification, please disregard this email or contact support.</p>
        <p style="margin-bottom: 0; margin-top: 30px; color: #7a6f5e;">Warm regards,<br><strong>— Rajshree Jewels Team</strong></p>
      `
    );

    await sendEmail({ to, subject: title, html });
  },

  // 2. sendPasswordResetEmail — Sends password reset link callback URL
  sendPasswordResetEmail: async (to: string, name: string, resetUrl: string): Promise<void> => {
    const title = 'Reset Your Password — Rajshree Jewels';
    const html = getLuxuryEmailHtml(
      title,
      `
        <p style="margin-top: 0;">Dear ${name},</p>
        <p>We received a request to reset the password linked to your Rajshree Jewels account. Click the elegant button below to establish a new password:</p>
        <div style="margin: 30px 0; text-align: center;">
          <a href="${resetUrl}" style="display: inline-block; background-color: #C9A84C; color: #1a1a1a; text-decoration: none; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; padding: 15px 35px; border-radius: 4px; transition: all 0.3s;">
            Reset Password
          </a>
        </div>
        <p>This secure reset link is valid for <strong>1 hour</strong>. If you did not make this request, your password will remain secure and you can ignore this communication.</p>
        <p style="margin-bottom: 0; margin-top: 30px; color: #7a6f5e;">Warm regards,<br><strong>— Rajshree Jewels Team</strong></p>
      `
    );

    await sendEmail({ to, subject: title, html });
  },

  // 3. sendOrderConfirmationEmail — Confirms successful checkout with details
  sendOrderConfirmationEmail: async (order: any): Promise<void> => {
    const to = order.user.email;
    const name = order.user.name;
    const title = `Order #${order.orderNumber} Confirmed ✓`;
    
    const html = getLuxuryEmailHtml(
      title,
      `
        <p style="margin-top: 0;">Dear ${name},</p>
        <p>We are delighted to confirm your order of handcrafted premium jewellery. We are carefully packaging your unique piece and will dispatch it shortly.</p>
        
        <div style="margin: 25px 0; padding: 20px; background-color: #FDFAF5; border: 1px solid #E2D9C8; border-radius: 4px;">
          <h4 style="margin: 0 0 10px 0; font-family: Georgia, serif; color: #C9A84C; border-bottom: 1px solid #E2D9C8; padding-bottom: 5px;">ORDER SUMMARY</h4>
          <p style="margin: 5px 0;"><strong>Order Number:</strong> #${order.orderNumber}</p>
          <p style="margin: 5px 0;"><strong>Item:</strong> ${order.product.displayName}</p>
          <div style="margin: 15px 0;">
            <img src="${order.product.primaryImageUrl}" alt="${order.product.displayName}" style="max-width: 150px; border-radius: 4px; border: 1px solid #E2D9C8;" />
          </div>
          <p style="margin: 5px 0;"><strong>Price:</strong> Rs. ${order.priceINR.toLocaleString('en-IN')}</p>
          <p style="margin: 5px 0;"><strong>Shipping:</strong> ${order.shippingINR === 0 ? 'FREE' : 'Rs. ' + order.shippingINR.toLocaleString('en-IN')}</p>
          <p style="margin: 5px 0;"><strong>Total Paid:</strong> Rs. ${order.totalINR.toLocaleString('en-IN')}</p>
          <p style="margin: 10px 0 0 0;"><strong>Estimated Dispatch:</strong> Within 2-3 business days</p>
        </div>

        <p style="text-align: center; margin: 30px 0;">
          <a href="${config.FRONTEND_URL}/account/orders/${order.id}" style="display: inline-block; background-color: #C9A84C; color: #1a1a1a; text-decoration: none; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; padding: 12px 30px; border-radius: 4px;">
            Track Order
          </a>
        </p>
        
        <p style="margin-bottom: 0; margin-top: 30px; color: #7a6f5e;">Warm regards,<br><strong>— Rajshree Jewels Team</strong></p>
      `
    );

    await sendEmail({ to, subject: title, html });
  },

  // 4. sendPaymentFailedEmail — Informs customer of checkout/payment failure
  sendPaymentFailedEmail: async (order: any): Promise<void> => {
    const to = order.user.email;
    const name = order.user.name;
    const title = `Your payment could not be processed — Order #${order.orderNumber}`;
    
    const html = getLuxuryEmailHtml(
      title,
      `
        <p style="margin-top: 0;">Dear ${name},</p>
        <p>We are sorry, but your payment for order <strong>#${order.orderNumber}</strong> could not be processed successfully. As a result, the reserved item has been released back to our inventory.</p>
        
        <div style="margin: 25px 0; padding: 20px; background-color: #FDFAF5; border: 1px solid #E2D9C8; border-radius: 4px;">
          <h4 style="margin: 0 0 10px 0; font-family: Georgia, serif; color: #C9A84C; border-bottom: 1px solid #E2D9C8; padding-bottom: 5px;">RELEASED ITEM</h4>
          <p style="margin: 5px 0;"><strong>Item:</strong> ${order.product.displayName}</p>
          <p style="margin: 5px 0;"><strong>Price:</strong> Rs. ${order.priceINR.toLocaleString('en-IN')}</p>
        </div>

        <p>If you'd like to attempt the purchase again, please visit the product page. Since our pieces are completely unique and one-of-a-kind, it may still be available if another shopper has not checked it out yet:</p>
        
        <p style="text-align: center; margin: 30px 0;">
          <a href="${config.FRONTEND_URL}/shop/${order.product.slug}" style="display: inline-block; background-color: #C9A84C; color: #1a1a1a; text-decoration: none; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; padding: 12px 30px; border-radius: 4px;">
            Try Again
          </a>
        </p>
        
        <p style="margin-bottom: 0; margin-top: 30px; color: #7a6f5e;">Warm regards,<br><strong>— Rajshree Jewels Team</strong></p>
      `
    );

    await sendEmail({ to, subject: title, html });
  },

  // 5. sendRefundInitiatedEmail — Notifies that a refund has been initiated
  sendRefundInitiatedEmail: async (order: any): Promise<void> => {
    const to = order.user.email;
    const name = order.user.name;
    const title = `Refund Initiated — Rs. ${order.totalINR.toLocaleString('en-IN')}`;
    
    const html = getLuxuryEmailHtml(
      title,
      `
        <p style="margin-top: 0;">Dear ${name},</p>
        <p>We have initiated a refund of <strong>Rs. ${order.totalINR.toLocaleString('en-IN')}</strong> for your order <strong>#${order.orderNumber}</strong>.</p>
        
        <div style="margin: 25px 0; padding: 20px; background-color: #FDFAF5; border: 1px solid #E2D9C8; border-radius: 4px;">
          <h4 style="margin: 0 0 10px 0; font-family: Georgia, serif; color: #C9A84C; border-bottom: 1px solid #E2D9C8; padding-bottom: 5px;">REFUND DETAILS</h4>
          <p style="margin: 5px 0;"><strong>Refunded Amount:</strong> Rs. ${order.totalINR.toLocaleString('en-IN')}</p>
          <p style="margin: 5px 0;"><strong>Payment Transaction ID:</strong> ${order.razorpayPaymentId || 'N/A'}</p>
          <p style="margin: 5px 0;"><strong>Estimated Timeline:</strong> 5-7 business days to reflect in your original payment account.</p>
        </div>

        <p>If you have any questions or require further assistance, please feel free to reach out to our customer care team.</p>
        
        <p style="margin-bottom: 0; margin-top: 30px; color: #7a6f5e;">Warm regards,<br><strong>— Rajshree Jewels Team</strong></p>
      `
    );

    await sendEmail({ to, subject: title, html });
  },

  // 6. sendShippingNotificationEmail — Standard shipping tracking link details
  sendShippingNotificationEmail: async (order: any, awbCode?: string): Promise<void> => {
    const to = order.user.email;
    const name = order.user.name;
    const orderNumber = order.orderNumber;
    const title = `Your order is on the way! 🚚 — #${orderNumber}`;
    const trackingAwb = awbCode || order.awbCode;

    const html = getLuxuryEmailHtml(
      title,
      `
        <p style="margin-top: 0;">Dear ${name},</p>
        <p>Splendid news! Your unique handcrafted jewellery piece is on the way. We have carefully packaged your item and handed it over to our courier partner.</p>
        
        <div style="margin: 25px 0; padding: 20px; background-color: #FDFAF5; border: 1px solid #E2D9C8; border-radius: 4px;">
          <h4 style="margin: 0 0 10px 0; font-family: Georgia, serif; color: #C9A84C; border-bottom: 1px solid #E2D9C8; padding-bottom: 5px;">SHIPPING DETAILS</h4>
          <p style="margin: 5px 0;"><strong>Item:</strong> ${order.product.displayName}</p>
          <div style="margin: 15px 0;">
            <img src="${order.product.primaryImageUrl}" alt="${order.product.displayName}" style="max-width: 150px; border-radius: 4px; border: 1px solid #E2D9C8;" />
          </div>
          <p style="margin: 5px 0;"><strong>Courier Partner:</strong> ${order.courierName || 'Shiprocket Partner'}</p>
          <p style="margin: 5px 0;"><strong>AWB Tracking Code:</strong> ${trackingAwb}</p>
          <p style="margin: 5px 0;"><strong>Estimated Delivery:</strong> 3-7 business days</p>
        </div>

        <div style="margin: 30px 0; text-align: center;">
          <a href="${order.trackingUrl}" style="display: inline-block; background-color: #C9A84C; color: #1a1a1a; text-decoration: none; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; padding: 15px 35px; border-radius: 4px; border: 1px solid #C9A84C; transition: all 0.3s;">
            Track Your Order
          </a>
        </div>

        <p style="margin-bottom: 0; margin-top: 30px; color: #7a6f5e;">Warm regards,<br><strong>— Rajshree Jewels Team</strong></p>
      `
    );

    await sendEmail({ to, subject: title, html });
  },

  // 7. sendDeliveredEmail — Informs customer that the order has been delivered successfully
  sendDeliveredEmail: async (order: any): Promise<void> => {
    const to = order.user.email;
    const name = order.user.name;
    const orderNumber = order.orderNumber;
    const title = `Your order has been delivered ✓ — #${orderNumber}`;

    const html = getLuxuryEmailHtml(
      title,
      `
        <p style="margin-top: 0;">Dear ${name},</p>
        <p>We hope you love it! We are thrilled to let you know that your handcrafted piece has been successfully delivered. We hope this exquisite jewellery brings you immense joy and elegance.</p>
        
        <div style="margin: 25px 0; padding: 20px; background-color: #FDFAF5; border: 1px solid #E2D9C8; border-radius: 4px;">
          <h4 style="margin: 0 0 10px 0; font-family: Georgia, serif; color: #C9A84C; border-bottom: 1px solid #E2D9C8; padding-bottom: 5px;">DELIVERED CREATION</h4>
          <p style="margin: 5px 0;"><strong>Item:</strong> ${order.product.displayName}</p>
          <div style="margin: 15px 0;">
            <img src="${order.product.primaryImageUrl}" alt="${order.product.displayName}" style="max-width: 150px; border-radius: 4px; border: 1px solid #E2D9C8;" />
          </div>
          <p style="margin: 5px 0;"><strong>Order Number:</strong> #${orderNumber}</p>
          <p style="margin: 5px 0;"><strong>Delivered On:</strong> ${order.deliveredAt ? new Date(order.deliveredAt).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN')}</p>
        </div>

        ${process.env.STORE_INSTAGRAM ? `<p><strong>Share Your Look:</strong> We would love to see how you style your new ${config.STORE_NAME || 'Rajshree Jewels'} piece! Share a picture on Instagram and tag us at <a href="${process.env.STORE_INSTAGRAM}" style="color: #C9A84C; font-weight: bold;">Instagram</a> to get featured!</p>` : ''}

        ${process.env.STORE_WHATSAPP ? `<p><strong>Need help or have questions?</strong> Reach out to us anytime directly on WhatsApp: <a href="https://wa.me/91${process.env.STORE_WHATSAPP}" style="color: #C9A84C; font-weight: bold; text-decoration: none;">Contact us on WhatsApp</a></p>` : ''}

        <p style="margin-bottom: 0; margin-top: 30px; color: #7a6f5e;">Warm regards,<br><strong>— ${config.STORE_NAME || 'Rajshree Jewels'} Team</strong></p>
      `
    );

    await sendEmail({ to, subject: title, html });
  },

  // 8. sendAdminNewOrderEmail — Alerts store owner of a new confirmed purchase order
  sendAdminNewOrderEmail: async (order: any): Promise<void> => {
    const to = config.SMTP_USER || process.env.SMTP_USER || 'admin@rajshreejewels.com';
    const orderNumber = order.orderNumber;
    const totalINR = order.totalINR;
    const title = `🛍 New Order #${orderNumber} — ₹${totalINR}`;

    const html = getLuxuryEmailHtml(
      title,
      `
        <p style="margin-top: 0;">Hello Owner,</p>
        <p>Congratulations! A new order has been placed and payment is confirmed. Please review the details below to prepare for shipment:</p>
        
        <div style="margin: 25px 0; padding: 20px; background-color: #FDFAF5; border: 1px solid #E2D9C8; border-radius: 4px; font-family: monospace;">
          <h4 style="margin: 0 0 10px 0; font-family: Georgia, serif; color: #C9A84C; border-bottom: 1px solid #E2D9C8; padding-bottom: 5px;">ORDER DETAILS</h4>
          <p style="margin: 5px 0;"><strong>Order ID:</strong> ${order.id}</p>
          <p style="margin: 5px 0;"><strong>Order Number:</strong> #${orderNumber}</p>
          <p style="margin: 5px 0;"><strong>Item Name:</strong> ${order.product.displayName}</p>
          <p style="margin: 5px 0;"><strong>Product SKU/ID:</strong> ${order.product.id}</p>
          <p style="margin: 5px 0;"><strong>Price Paid:</strong> ₹${order.priceINR}</p>
          <p style="margin: 5px 0;"><strong>Shipping:</strong> ₹${order.shippingINR}</p>
          <p style="margin: 5px 0;"><strong>Total Revenue:</strong> ₹${totalINR}</p>
          <p style="margin: 5px 0;"><strong>Payment Method:</strong> ${order.paymentMethod}</p>
          <p style="margin: 5px 0;"><strong>Razorpay Payment ID:</strong> ${order.razorpayPaymentId || 'COD / None'}</p>
        </div>

        <div style="margin: 25px 0; padding: 20px; background-color: #FDFAF5; border: 1px solid #E2D9C8; border-radius: 4px; font-family: monospace;">
          <h4 style="margin: 0 0 10px 0; font-family: Georgia, serif; color: #C9A84C; border-bottom: 1px solid #E2D9C8; padding-bottom: 5px;">BUYER & SHIPPING INFORMATION</h4>
          <p style="margin: 5px 0;"><strong>Buyer Name:</strong> ${order.user.name}</p>
          <p style="margin: 5px 0;"><strong>Email:</strong> ${order.user.email}</p>
          <p style="margin: 5px 0;"><strong>Phone:</strong> ${order.address.phone}</p>
          <p style="margin: 5px 0;"><strong>Address Line 1:</strong> ${order.address.line1}</p>
          <p style="margin: 5px 0;"><strong>Address Line 2:</strong> ${order.address.line2 || 'N/A'}</p>
          <p style="margin: 5px 0;"><strong>City:</strong> ${order.address.city}</p>
          <p style="margin: 5px 0;"><strong>State:</strong> ${order.address.state}</p>
          <p style="margin: 5px 0;"><strong>Pincode:</strong> ${order.address.pincode}</p>
          <p style="margin: 5px 0;"><strong>Buyer Note:</strong> ${order.buyerNote || 'None'}</p>
        </div>

        <p style="text-align: center; margin: 30px 0;">
          <a href="${config.ADMIN_URL}/orders" style="display: inline-block; background-color: #C9A84C; color: #1a1a1a; text-decoration: none; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; padding: 12px 30px; border-radius: 4px;">
            Open Admin Dashboard
          </a>
        </p>
      `
    );

    await sendEmail({ to, subject: title, html });
  },
};

// Named exports for extra convenience
export const sendShippingNotificationEmail = notificationsService.sendShippingNotificationEmail;
export const sendDeliveredEmail = notificationsService.sendDeliveredEmail;
export const sendAdminNewOrderEmail = notificationsService.sendAdminNewOrderEmail;

// sendAdminAlert — Alerts the store owner via email
export async function sendAdminAlert(subject: string, body: string): Promise<void> {
  await sendEmail({
    to: config.SMTP_USER || process.env.SMTP_USER!,  // Send to store owner's email
    subject: `[STORE ALERT] ${subject}`,
    html: `<pre style="font-family: monospace">${body}</pre>`
  });
}

// 7. notifyWishlistOnRelist — Sends email notifications to users who have wishlisted a relisted product
export async function notifyWishlistOnRelist(productId: string): Promise<void> {
  const wishlisted = await prisma.wishlistItem.findMany({
    where: { productId },
    include: { user: true, product: true }
  });

  for (const item of wishlisted) {
    const title = `${item.product.displayName} is available again! — Rajshree Jewels`;
    const html = getLuxuryEmailHtml(
      title,
      `
        <p style="margin-top: 0;">Hi ${item.user.name},</p>
        <p>Good news! A handcrafted piece you wishlisted — <strong>${item.product.displayName}</strong> — is available again for purchase.</p>
        <p>Because each of our jewellery items is absolutely unique and completely one-of-a-kind, we wanted to let you know first before someone else claims it!</p>
        
        <p style="text-align: center; margin: 30px 0;">
          <a href="${config.FRONTEND_URL}/shop/${item.product.slug}" style="display: inline-block; background-color: #C9A84C; color: #1a1a1a; text-decoration: none; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; padding: 12px 30px; border-radius: 4px;">
            View Creation
          </a>
        </p>
        
        <p style="margin-bottom: 0; margin-top: 30px; color: #7a6f5e;">Warm regards,<br><strong>— Rajshree Jewels Team</strong></p>
      `
    );

    await sendEmail({ to: item.user.email, subject: title, html });
  }
}

// 8. sendOrderConfirmedSMS — Sends SMS using MSG91 flow API
export async function sendOrderConfirmedSMS(phone: string, name: string, orderNumber: string, itemName: string): Promise<void> {
  const templateId = config.MSG91_TEMPLATE_ID_ORDER || process.env.MSG91_TEMPLATE_ID_ORDER!;
  if (!templateId) {
    console.log(`⚠️ SMS send skipped: MSG91_TEMPLATE_ID_ORDER is not configured`);
    return;
  }

  await sendSMS(phone, templateId, {
    name,
    order_number: orderNumber,
    item_name: itemName,
    store_name: config.STORE_NAME || 'Rajshree Jewels'
  });
}

// 9. sendShippedSMS — Sends SMS when an order is shipped
export async function sendShippedSMS(
  phone: string,
  name: string,
  orderNumber: string,
  courierName: string,
  trackingUrl: string
): Promise<void> {
  const templateId = config.MSG91_TEMPLATE_ID_SHIPPED || process.env.MSG91_TEMPLATE_ID_SHIPPED!;
  if (!templateId) {
    console.log(`⚠️ SMS send skipped: MSG91_TEMPLATE_ID_SHIPPED is not configured`);
    return;
  }

  await sendSMS(phone, templateId, {
    name,
    order_number: orderNumber,
    courier_name: courierName,
    tracking_url: trackingUrl
  });
}

// 10. sendDeliveredSMS — Sends SMS when an order is delivered
export async function sendDeliveredSMS(
  phone: string,
  name: string,
  orderNumber: string
): Promise<void> {
  const templateId = config.MSG91_TEMPLATE_ID_DELIVERED || process.env.MSG91_TEMPLATE_ID_DELIVERED!;
  if (!templateId) {
    console.log(`⚠️ SMS send skipped: MSG91_TEMPLATE_ID_DELIVERED is not configured`);
    return;
  }

  await sendSMS(phone, templateId, {
    name,
    order_number: orderNumber,
    store_name: config.STORE_NAME || 'Rajshree Jewels'
  });
}

export default notificationsService;
