import { Request, Response, NextFunction } from 'express';
import { redis } from '../services/redis';
import { AppError } from '../utils/errors';

// Simple in-memory fallback store
const memoryStore = new Map<string, { count: number; resetTime: number }>();

export const rateLimiter = (limit: number = 30, windowSeconds: number = 60) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `ratelimit:${req.originalUrl}:${ip}`;

    try {
      // Check if Redis is connected
      if (redis.isOpen) {
        const current = await redis.incr(key);
        if (current === 1) {
          await redis.expire(key, windowSeconds);
        }
        if (current > limit) {
          throw new AppError('Too many requests, please try again later.', 429, 'TOO_MANY_REQUESTS');
        }
      } else {
        // In-memory fallback
        const now = Date.now();
        const record = memoryStore.get(key);

        if (!record || now > record.resetTime) {
          memoryStore.set(key, {
            count: 1,
            resetTime: now + windowSeconds * 1000,
          });
        } else {
          record.count += 1;
          if (record.count > limit) {
            throw new AppError('Too many requests, please try again later.', 429, 'TOO_MANY_REQUESTS');
          }
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

export const apiLimiter = rateLimiter(30, 60); // 30 requests per minute
export const authLimiter = rateLimiter(10, 60); // 10 requests per minute
