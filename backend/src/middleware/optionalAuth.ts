import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { JWTPayload } from '../types';

export const optionalAuth = (req: any, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token) {
        const payload = jwt.verify(token, config.JWT_SECRET) as JWTPayload;
        req.user = {
          id: payload.userId,
          email: payload.email,
          isAdmin: payload.isAdmin,
          isVerified: true,
        };
      }
    }
  } catch (err) {
    // Ignore invalid tokens and let the request proceed as guest
  }
  next();
};
