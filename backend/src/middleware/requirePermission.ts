import { Response, NextFunction } from 'express';
import { hasPermission } from '../services/permissions';
import { Permission } from '../types/permissions';
import prisma from '../services/db';

export function requirePermission(permission: Permission) {
  return async (req: any, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id }
      });

      if (!user) {
        return res.status(401).json({ error: 'UNAUTHORIZED' });
      }

      if (user.isOwner) {
        req.user.isOwner = true; // inject isOwner to request context
        return next();
      }

      const allowed = await hasPermission(req.user.id, permission);
      if (!allowed) {
        return res.status(403).json({ error: 'FORBIDDEN', required: permission });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
