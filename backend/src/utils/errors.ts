import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { config } from '../config';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 400, code: string = 'BAD_REQUEST', isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = err.statusCode || 500;
  let errorCode = err.code || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'An unexpected error occurred';

  if (err instanceof ZodError) {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
  }

  // Build error response
  const errorResponse: { error: string; code: string; stack?: string } = {
    error: message,
    code: errorCode,
  };

  // Only leak stack trace in development
  if (config.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }

  // Log severe errors
  if (statusCode === 500) {
    console.error('💥 Server Error:', err);
  }

  res.status(statusCode).json(errorResponse);
};

export const catchAsync = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
};
