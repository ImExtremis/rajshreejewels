import Bull from 'bull';
import { config } from '../config';

// Initialize Bull queues using REDIS_URL
export const listingQueue = new Bull('listing-enhance', config.REDIS_URL);

export const reservationQueue = new Bull('reservation-release', config.REDIS_URL);

export const invoiceQueue = new Bull('invoice-generation', config.REDIS_URL);
export const cleanupQueue = new Bull('inactive-cleanup', config.REDIS_URL);

export async function queueInvoiceGeneration(orderId: string) {
  await invoiceQueue.add({ orderId });
}

