import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  ADMIN_URL: z.string().url().default('http://localhost:3001'),
  REVALIDATE_SECRET: z.string().default('rajshree_revalidate_secret_2026'),
  
  DATABASE_URL: z.string(),
  DB_USER: z.string(),
  DB_PASSWORD: z.string(),
  
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_PASSWORD: z.string().optional(),
  
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  
  RAZORPAY_KEY_ID: z.string().optional().default(''),
  RAZORPAY_KEY_SECRET: z.string().optional().default(''),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(''),
  
  OPENAI_API_KEY: z.string().optional().default(''),
  
  SHIPROCKET_EMAIL: z.string().optional().default(''),
  SHIPROCKET_PASSWORD: z.string().optional().default(''),
  
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  EMAIL_FROM: z.string().default('Rajshree Jewels <yourstore@gmail.com>'),
  
  MSG91_AUTH_KEY: z.string().optional().default(''),
  MSG91_SENDER_ID: z.string().default('RJSHRE'),
  MSG91_TEMPLATE_ID_ORDER: z.string().optional().default(''),
  MSG91_TEMPLATE_ID_SHIPPED: z.string().optional().default(''),
  MSG91_TEMPLATE_ID_DELIVERED: z.string().optional().default(''),
  
  STORE_NAME: z.string().default('Rajshree Jewels'),
  STORE_TAGLINE: z.string().default('1-Gram Gold, Imitation & Fashion Jewellery'),
  SHIPROCKET_PICKUP_LOCATION: z.string().default('Primary'),
  SHIPROCKET_PICKUP_PINCODE: z.string().optional().default('302001'),
  STORE_PHONE: z.string().optional().default(''),
  STORE_WHATSAPP: z.string().optional().default(''),
  STORE_ADDRESS: z.string().optional().default(''),
  STORE_INSTAGRAM: z.string().optional().default(''),
  STORE_FACEBOOK: z.string().optional().default(''),
});

const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Environment configuration validation failed:', parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
export type Config = z.infer<typeof configSchema>;
