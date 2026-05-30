import { Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';

export const adminGuard = (req: any, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
  }

  if (!req.user.isAdmin) {
    return next(new AppError('Forbidden: Admin access required', 403, 'FORBIDDEN'));
  }

  next();
};
