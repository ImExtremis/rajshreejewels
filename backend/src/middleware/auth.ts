import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AppError } from '../utils/errors';
import { JWTPayload } from '../types';

export const auth = (req: any, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Access token is missing or malformed', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new AppError('Access token is missing', 401, 'UNAUTHORIZED');
    }

    const payload = jwt.verify(token, config.JWT_SECRET) as JWTPayload;
    
    // Inject user info into request context
    req.user = {
      id: payload.userId,
      email: payload.email,
      isAdmin: payload.isAdmin,
      // Default placeholder fields that are resolved as needed
      isVerified: true,
    };

    next();
  } catch (err: any) {
    if (err instanceof jwt.TokenExpiredError) {
      next(new AppError('Access token expired', 401, 'TOKEN_EXPIRED'));
    } else if (err instanceof jwt.JsonWebTokenError) {
      next(new AppError('Invalid access token', 401, 'UNAUTHORIZED'));
    } else {
      next(err);
    }
  }
};
