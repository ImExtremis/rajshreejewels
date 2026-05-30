import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../services/db';
import redis from '../services/redis';
import { config } from '../config';
import { catchAsync, AppError } from '../utils/errors';
import { notificationsService } from '../services/notifications';
import { JWTPayload } from '../types';

const router = Router();

// Zod validation schemas
const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().trim().email('Invalid email address'),
  phone: z.string().trim().min(10, 'Phone must be at least 10 digits').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const verifyEmailSchema = z.object({
  userId: z.string(),
  otp: z.string().length(6, 'OTP must be exactly 6 digits'),
});

const loginSchema = z.object({
  login: z.string().trim().optional(),
  email: z.string().trim().email('Invalid email address').optional(),
  password: z.string(),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

const googleCallbackSchema = z.object({
  googleId: z.string(),
  email: z.string().trim().email('Invalid email address'),
  name: z.string().trim(),
});

// Helper: Helper to parse HttpOnly cookies manually
const getRefreshTokenFromCookie = (req: Request): string | undefined => {
  if (!req.headers.cookie) return undefined;
  const cookies = Object.fromEntries(
    req.headers.cookie.split('; ').map((c) => {
      const parts = c.split('=');
      return [parts[0], parts.slice(1).join('=')];
    })
  );
  return cookies.refreshToken;
};

// Helper: Token generators
const generateAccessToken = (userId: string, email: string, isAdmin: boolean, isOwner: boolean = false): string => {
  const payload: JWTPayload = { userId, email, isAdmin, isOwner };
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN as any });
};

const generateRefreshToken = (userId: string, email: string, isAdmin: boolean, isOwner: boolean = false): string => {
  const payload: JWTPayload = { userId, email, isAdmin, isOwner };
  return jwt.sign(payload, config.JWT_REFRESH_SECRET, { expiresIn: config.JWT_REFRESH_EXPIRES_IN as any });
};

// Helper: Cookie setter options
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};

// ─── POST /auth/register ────────────────────────────────────
router.post(
  '/register',
  catchAsync(async (req: Request, res: Response) => {
    const { name, email, phone, password } = registerSchema.parse(req.body);

    // Before creating a new user — check if unverified user exists with this email
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      if (existing.isVerified) {
        throw new AppError('An account with this email or phone number already exists', 400, 'EMAIL_EXISTS');
      }

      // Hash password with bcryptjs
      const passwordHash = await bcrypt.hash(password, 12);
      
      // Unverified user exists — they abandoned registration
      // Update their details and resend OTP (don't create duplicate)
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: {
          name,
          phone,
          passwordHash,
        }
      });
      
      // Per new flow — log them in immediately
      const accessToken = generateAccessToken(updated.id, updated.email, updated.isAdmin, updated.isOwner);
      const refreshToken = generateRefreshToken(updated.id, updated.email, updated.isAdmin, updated.isOwner);

      // Save session in DB
      await prisma.session.create({
        data: {
          userId: updated.id,
          token: refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      // Set refresh token in HttpOnly cookie
      res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);

      // Generate OTP code
      const otp = crypto.randomInt(100000, 999999).toString();

      // Cache in Redis
      if (redis.isOpen) {
        await redis.setEx(`otp:${updated.id}`, 600, otp);
      } else {
        console.warn(`⚠️ Redis offline. Register OTP for user ${updated.id} logged to terminal: ${otp}`);
      }

      // Send verification email
      notificationsService.sendVerificationEmail(updated.email, updated.name, otp).catch((err: any) => {
        console.error('❌ Failed to send verification email in background:', err.message);
      });

      return res.status(201).json({
        accessToken,
        user: {
          id: updated.id,
          name: updated.name,
          email: updated.email,
          phone: updated.phone,
          isAdmin: updated.isAdmin,
          isOwner: updated.isOwner,
          isVerified: updated.isVerified,
        },
        debugOtp: config.NODE_ENV === 'development' ? otp : undefined,
      });
    }

    // No existing user with email — check phone collision if phone is provided
    if (phone) {
      const existingPhone = await prisma.user.findFirst({
        where: { phone },
      });
      if (existingPhone) {
        throw new AppError('An account with this email or phone number already exists', 400, 'EMAIL_EXISTS');
      }
    }

    // Hash password with bcryptjs
    const passwordHash = await bcrypt.hash(password, 12);

    // Create unverified user record
    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        passwordHash,
        isVerified: false,
      },
    });

    // Generate cryptographically random 6-digit OTP code (crypto.randomInt)
    const otp = crypto.randomInt(100000, 999999).toString();

    // Cache in Redis under otp:{userId} with 10 min TTL
    if (redis.isOpen) {
      await redis.setEx(`otp:${user.id}`, 600, otp);
    } else {
      console.warn(`⚠️ Redis offline. Register OTP for user ${user.id} logged to terminal: ${otp}`);
    }

    // Send verification email via notificationsService in background (fire-and-forget)
    notificationsService.sendVerificationEmail(email, name, otp).catch((err: any) => {
      console.error('❌ Failed to send verification email in background:', err.message);
    });

    // Generate session tokens to log user in immediately
    const accessToken = generateAccessToken(user.id, user.email, user.isAdmin, user.isOwner);
    const refreshToken = generateRefreshToken(user.id, user.email, user.isAdmin, user.isOwner);

    // Save session in DB
    await prisma.session.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Set refresh token in HttpOnly cookie
    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);

    res.status(201).json({
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isAdmin: user.isAdmin,
        isOwner: user.isOwner,
        isVerified: user.isVerified,
      },
      debugOtp: config.NODE_ENV === 'development' ? otp : undefined,
    });
  })
);

// ─── POST /auth/verify-email ────────────────────────────────
router.post(
  '/verify-email',
  catchAsync(async (req: Request, res: Response) => {
    const { userId, otp } = verifyEmailSchema.parse(req.body);

    if (!redis.isOpen) {
      throw new AppError('Caching server is currently offline. Verification unavailable.', 500, 'CACHE_OFFLINE');
    }

    // Retrieve OTP from Redis
    const cachedOtp = await redis.get(`otp:${userId}`);
    if (!cachedOtp) {
      throw new AppError('OTP expired or invalid session', 400, 'OTP_EXPIRED');
    }

    if (cachedOtp !== otp) {
      throw new AppError('Incorrect OTP entered', 400, 'OTP_INVALID');
    }

    // Update user as verified and delete Redis key
    const user = await prisma.user.update({
      where: { id: userId },
      data: { isVerified: true },
    });
    await redis.del(`otp:${userId}`);

    // Generate session tokens to log user in immediately
    const accessToken = generateAccessToken(user.id, user.email, user.isAdmin, user.isOwner);
    const refreshToken = generateRefreshToken(user.id, user.email, user.isAdmin, user.isOwner);

    // Save session in DB
    await prisma.session.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Set refresh token in HttpOnly cookie
    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);

    res.json({
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isAdmin: user.isAdmin,
        isOwner: user.isOwner,
        isVerified: user.isVerified,
      },
    });
  })
);

// ─── POST /auth/resend-otp ──────────────────────────────────
router.post(
  '/resend-otp',
  catchAsync(async (req: Request, res: Response) => {
    const { userId } = z.object({ userId: z.string() }).parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (user.isVerified) {
      return res.status(400).json({ error: 'User is already verified', code: 'ALREADY_VERIFIED' });
    }

    const otp = crypto.randomInt(100000, 999999).toString();

    if (redis.isOpen) {
      await redis.setEx(`otp:${user.id}`, 600, otp);
    } else {
      console.warn(`Fallback OTP: ${otp}`);
    }

    notificationsService.sendVerificationEmail(user.email, user.name, otp).catch((err: any) => {
      console.error('❌ Failed to resend verification email in background:', err.message);
    });

    res.json({
      success: true,
      message: 'Verification OTP resent successfully',
      debugOtp: config.NODE_ENV === 'development' ? otp : undefined,
    });
  })
);

// ─── POST /auth/login ───────────────────────────────────────
router.post(
  '/login',
  catchAsync(async (req: Request, res: Response) => {
    const { login, email, password } = loginSchema.parse(req.body);
    const identifier = login || email;

    if (!identifier) {
      throw new AppError('Email or username is required', 400, 'BAD_REQUEST');
    }

    const isEmail = identifier.includes('@');

    let user = null;
    if (isEmail) {
      user = await prisma.user.findUnique({ where: { email: identifier.toLowerCase() } });
    } else {
      // Find by username via AdminUser record
      const adminUser = await prisma.adminUser.findUnique({
        where: { username: identifier },
        include: { user: true }
      });
      user = adminUser?.user;
    }

    if (!user || !user.passwordHash) {
      throw new AppError('Incorrect email or password details', 401, 'INVALID_CREDENTIALS');
    }

    // Check password hash
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new AppError('Incorrect email or password details', 401, 'INVALID_CREDENTIALS');
    }

    // Generate access & refresh tokens
    const accessToken = generateAccessToken(user.id, user.email, user.isAdmin, user.isOwner);
    const refreshToken = generateRefreshToken(user.id, user.email, user.isAdmin, user.isOwner);

    // Save Session in database
    await prisma.session.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);

    res.json({
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isAdmin: user.isAdmin,
        isOwner: user.isOwner,
        isVerified: user.isVerified,
      },
    });
  })
);

// ─── POST /auth/refresh ─────────────────────────────────────
router.post(
  '/refresh',
  catchAsync(async (req: Request, res: Response) => {
    const refreshToken = getRefreshTokenFromCookie(req);
    if (!refreshToken) {
      throw new AppError('Refresh token is missing', 401, 'UNAUTHORIZED');
    }

    try {
      // Verify JWT signature
      const payload = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET) as JWTPayload;

      // Verify Session exists in database and is not expired
      const session = await prisma.session.findUnique({
        where: { token: refreshToken },
      });

      if (!session || session.expiresAt < new Date()) {
        if (session) await prisma.session.delete({ where: { id: session.id } });
        throw new AppError('Session expired or invalid', 401, 'UNAUTHORIZED');
      }

      const accessToken = generateAccessToken(payload.userId, payload.email, payload.isAdmin, payload.isOwner || false);

      res.json({ accessToken });
    } catch (err) {
      throw new AppError('Invalid refresh token session', 401, 'UNAUTHORIZED');
    }
  })
);

// ─── POST /auth/logout ──────────────────────────────────────
router.post(
  '/logout',
  catchAsync(async (req: Request, res: Response) => {
    const refreshToken = getRefreshTokenFromCookie(req);
    if (refreshToken) {
      // Purge session token from database
      await prisma.session.deleteMany({ where: { token: refreshToken } });
    }

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    res.json({ message: 'Logged out' });
  })
);

// ─── POST /auth/forgot-password ─────────────────────────────
router.post(
  '/forgot-password',
  catchAsync(async (req: Request, res: Response) => {
    const { email } = forgotPasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    
    // Always return success to prevent user email enumeration scans (Security rule)
    if (!user) {
      return res.json({ message: 'If that email exists, a reset link has been sent' });
    }

    // Generate signed JWT reset token (1h TTL)
    const resetToken = jwt.sign({ userId: user.id }, config.JWT_SECRET, { expiresIn: '1h' });

    if (redis.isOpen) {
      await redis.setEx(`reset:${user.id}`, 3600, 'true');
    }

    // Send reset link email
    const resetUrl = `${config.FRONTEND_URL}/auth/reset-password?token=${resetToken}`;
    try {
      await notificationsService.sendPasswordResetEmail(user.email, user.name, resetUrl);
    } catch (err: any) {
      console.error('❌ Failed to send reset password email:', err.message);
    }

    res.json({ message: 'If that email exists, a reset link has been sent' });
  })
);

// ─── POST /auth/reset-password ──────────────────────────────
router.post(
  '/reset-password',
  catchAsync(async (req: Request, res: Response) => {
    const { token, newPassword } = resetPasswordSchema.parse(req.body);

    if (!redis.isOpen) {
      throw new AppError('Caching server is currently offline. Reset unavailable.', 500, 'CACHE_OFFLINE');
    }

    try {
      const payload = jwt.verify(token, config.JWT_SECRET) as { userId: string };
      const userId = payload.userId;

      // Verify that reset session key exists in Redis
      const resetKeyActive = await redis.get(`reset:${userId}`);
      if (!resetKeyActive) {
        throw new AppError('Password reset link expired or has already been used', 400, 'RESET_EXPIRED');
      }

      // Hash password and save details
      const newHash = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newHash },
      });

      // Clear all active sessions across all devices (Security requirement)
      await prisma.session.deleteMany({ where: { userId } });

      // Clean up Redis
      await redis.del(`reset:${userId}`);

      res.json({ message: 'Password reset successful' });
    } catch (err) {
      throw new AppError('Reset token signature validation failed', 400, 'INVALID_RESET_TOKEN');
    }
  })
);

// ─── POST /auth/google/callback ─────────────────────────────
router.post(
  '/google/callback',
  catchAsync(async (req: Request, res: Response) => {
    const { googleId, email, name } = googleCallbackSchema.parse(req.body);

    // Look up user by googleId or email
    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId }, { email }] },
    });

    if (user) {
      // Link googleId if email matched but googleId was missing
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId, isVerified: true },
        });
      }
    } else {
      // Create verified Google account user
      user = await prisma.user.create({
        data: {
          name,
          email,
          googleId,
          isVerified: true, // Google OAuth accounts are automatically verified
        },
      });
    }

    // Log user in
    const accessToken = generateAccessToken(user.id, user.email, user.isAdmin, user.isOwner);
    const refreshToken = generateRefreshToken(user.id, user.email, user.isAdmin, user.isOwner);

    await prisma.session.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);

    res.json({
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isAdmin: user.isAdmin,
        isOwner: user.isOwner,
      },
    });
  })
);

export default router;
