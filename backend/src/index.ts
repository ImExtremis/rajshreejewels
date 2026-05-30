import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { errorHandler } from './utils/errors';
import { apiLimiter } from './middleware/rateLimiter';
import prisma from './services/db';
import redis from './services/redis';
import { sendEmail, getLuxuryEmailHtml } from './services/notifications';

// Router imports
import authRouter from './routes/auth';
import productsRouter from './routes/products';
import cartRouter from './routes/cart';
import ordersRouter from './routes/orders';
import usersRouter from './routes/users';
import adminRouter from './routes/admin';
import paymentsRouter from './routes/payments';
import listingRouter from './routes/listing';
import settingsRouter from './routes/settings';
import collectionsRouter from './routes/collections';
import analyticsRouter from './routes/analytics';
import messagesRouter from './routes/messages';


const app = express();

// helmet — sets security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https://checkout.razorpay.com"],
      scriptSrc: ["'self'", "https://checkout.razorpay.com"],
      frameSrc: ["https://api.razorpay.com"],
    }
  },
  crossOriginOpenerPolicy: process.env.NODE_ENV === 'production' 
    ? { policy: 'same-origin' } 
    : false,
  crossOriginEmbedderPolicy: false,  // Needed for Razorpay
}));

const localIpRegex = /^https?:\/\/(?:localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(?::\d+)?$/;

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    const allowed = [
      process.env.FRONTEND_URL,
      process.env.ADMIN_URL,
    ].filter(Boolean);
    if (allowed.includes(origin) || localIpRegex.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));
app.use('/api/v1/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global rate limiting
app.use('/api/', apiLimiter);

// Health check endpoint (checks DB and Redis status)
app.get('/api/v1/health', async (req, res) => {
  const dbOk = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
  const redisOk = await redis.ping().then(r => r === 'PONG').catch(() => false);
  const status = dbOk && redisOk ? 'ok' : 'degraded';
  res.status(dbOk ? 200 : 503).json({
    status,
    db: dbOk ? 'ok' : 'error',
    redis: redisOk ? 'ok' : 'error',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', async (req, res) => {
  const dbOk = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
  const redisOk = await redis.ping().then(r => r === 'PONG').catch(() => false);
  const status = dbOk && redisOk ? 'ok' : 'degraded';
  res.status(dbOk ? 200 : 503).json({
    status,
    db: dbOk ? 'ok' : 'error',
    redis: redisOk ? 'ok' : 'error',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Mounting API routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/products', productsRouter);
app.use('/api/v1/cart', cartRouter);
app.use('/api/v1/orders', ordersRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/payments', paymentsRouter);
app.use('/api/v1/listing', listingRouter);
app.use('/api/v1/settings', settingsRouter);
app.use('/api/v1/collections', collectionsRouter);
app.use('/api/v1/analytics', analyticsRouter);
app.use('/api/v1/messages', messagesRouter);

// Contact form submission endpoint
app.post('/api/v1/contact', async (req, res, next) => {
  try {
    const { name, email, message } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }
    if (!email || typeof email !== 'string' || !email.trim() || !email.includes('@')) {
      res.status(400).json({ error: 'A valid email address is required' });
      return;
    }
    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    const title = `New Contact Form Inquiry — ${name.trim()}`;
    const emailBody = `
      <p style="margin-top: 0;">You have received a new contact inquiry from the Rajshree Jewels storefront:</p>
      <div style="margin: 20px 0; padding: 20px; background-color: #FDFAF5; border: 1px solid #E2D9C8; border-radius: 4px;">
        <h4 style="margin: 0 0 10px 0; font-family: Georgia, serif; color: #C9A84C; border-bottom: 1px solid #E2D9C8; padding-bottom: 5px;">INQUIRY DETAILS</h4>
        <p style="margin: 5px 0;"><strong>Name:</strong> ${name.trim()}</p>
        <p style="margin: 5px 0;"><strong>Email:</strong> <a href="mailto:${email.trim()}" style="color: #C9A84C; text-decoration: none;">${email.trim()}</a></p>
        <p style="margin: 15px 0 5px 0;"><strong>Message:</strong></p>
        <p style="margin: 5px 0; white-space: pre-wrap; font-style: italic; background-color: #fff; padding: 12px; border: 1px solid #E2D9C8; border-radius: 4px;">${message.trim()}</p>
      </div>
      <p style="margin-top: 20px; color: #7a6f5e; font-size: 11px;">To reply, simply click on the customer's email address above.</p>
    `;

    const htmlContent = getLuxuryEmailHtml(title, emailBody);
    
    // Send to store owner (SMTP_USER)
    const recipient = config.SMTP_USER || 'yourstore@gmail.com';
    await sendEmail({
      to: recipient,
      subject: title,
      html: htmlContent,
    });

    res.status(200).json({ success: true, message: 'Message sent successfully' });
  } catch (err: any) {
    next(err);
  }
});

// Global Error Handler
app.use(errorHandler);

// Start server
app.listen(config.PORT, async () => {
  console.log(`🚀 Rajshree Jewels API Server running on port ${config.PORT} in ${config.NODE_ENV} mode`);

  // Seed default site settings if they don't exist
  try {
    const defaultSettings = [
      { key: 'store_name', value: 'My Jewellery Store' },
      { key: 'store_tagline', value: 'Handcrafted Jewellery, One of a Kind' },
      { key: 'store_phone', value: '' },
      { key: 'store_email', value: '' },
      { key: 'store_whatsapp', value: '' },
      { key: 'store_address', value: '' },
      { key: 'shipping_free_above_inr', value: '999' },
      { key: 'shipping_flat_rate_inr', value: '99' },
      { key: 'cod_enabled', value: 'false' },
      { key: 'announcement_banner', value: '' },
      { key: 'instagram_url', value: '' },
      { key: 'facebook_url', value: '' },
    ];

    await Promise.all(defaultSettings.map(s =>
      prisma.siteSetting.upsert({
        where: { key: s.key },
        update: {},             // Never overwrite existing values on restart
        create: s,
      })
    ));
    console.log('✅ Site settings database seeding completed');
  } catch (err: any) {
    console.error('❌ Failed to seed default settings:', err.message || err);
  }

  // Initialize reservation-release repeats and event listener
  try {
    const { reservationQueue, invoiceQueue, cleanupQueue } = require('./services/queue');
    const { releaseExpiredReservations } = require('./services/inventory');
    const { generateInvoice } = require('./services/invoice');

    // Register repeating job to run every 2 minutes
    await reservationQueue.add({}, { repeat: { every: 2 * 60 * 1000 } });
    reservationQueue.process(async () => {
      await releaseExpiredReservations();
    });
    console.log('⏰ Reservation release repeating job registered (every 2 minutes)');

    // Register weekly unverified user cleanup job (Sundays at 3 AM)
    await cleanupQueue.add({}, { repeat: { cron: '0 3 * * 0' } });
    cleanupQueue.process(async () => {
      try {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

        const staleUsers = await prisma.user.findMany({
          where: {
            isVerified: false,
            createdAt: { lt: threeMonthsAgo },
            orders: { none: {} },
          }
        });

        console.log(`⏰ Weekly cleanup: Found ${staleUsers.length} unverified inactive stale users to delete.`);
        for (const user of staleUsers) {
          await prisma.user.delete({ where: { id: user.id } });
        }
        console.log('✅ Weekly cleanup complete.');
      } catch (err: any) {
        console.error('❌ Failed weekly stale user cleanup job:', err.message || err);
      }
    });
    console.log('⏰ Weekly unverified inactive users cleanup job registered (every Sunday at 3 AM)');

    // Register invoice generation queue processor
    invoiceQueue.process(async (job: any) => {
      try {
        await generateInvoice(job.data.orderId);
      } catch (err: any) {
        console.error(`❌ Invoice generation failed for order ${job.data.orderId}:`, err.message || err);
        throw err;
      }
    });
    console.log('📄 Invoice generation queue processor registered');

    // Enable Redis keyspace notifications for expired keys (run on startup)
    if (redis.isOpen) {
      await redis.configSet('notify-keyspace-events', 'Ex');
      console.log('🔔 Redis keyspace notifications enabled');

      // Create duplicate subscriber client
      const subscriber = redis.duplicate();
      await subscriber.connect();

      await subscriber.subscribe('__keyevent@0__:expired', async (message) => {
        if (message.startsWith('reservation:')) {
          console.log(`⏰ Redis expired event received for: ${message}`);
          try {
            await releaseExpiredReservations();
          } catch (err: any) {
            console.error('❌ Failed to release expired reservations:', err.message || err);
          }
        }
      });
      console.log('👂 Subscribed to Redis __keyevent@0__:expired channel');
    }
  } catch (err: any) {
    console.error('⚠️ Startup setup failed:', err.message || err);
  }
});

