import { User } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        phone?: string | null;
        isAdmin: boolean;
        isVerified: boolean;
        isOwner?: boolean;
      };
    }
  }
}

export interface JWTPayload {
  userId: string;
  email: string;
  isAdmin: boolean;
  isOwner?: boolean;
}

export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}
