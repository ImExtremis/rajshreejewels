import { config } from '../config';

export const logger = {
  info: (message: string, ...meta: any[]) => {
    console.log(`[INFO] ${new Date().toISOString()}: ${message}`, ...meta);
  },
  warn: (message: string, ...meta: any[]) => {
    console.warn(`[WARN] ${new Date().toISOString()}: ${message}`, ...meta);
  },
  error: (message: string, error?: any, ...meta: any[]) => {
    console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, error || '', ...meta);
  },
  debug: (message: string, ...meta: any[]) => {
    if (config.NODE_ENV === 'development') {
      console.log(`[DEBUG] ${new Date().toISOString()}: ${message}`, ...meta);
    }
  }
};
