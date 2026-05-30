import { createClient } from 'redis';
import { config } from '../config';

const client = createClient({
  url: config.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 3) {
        console.warn('⚠️ Redis connection attempts exhausted. Proceeding in offline in-memory fallback mode.');
        return false;
      }
      return 3000; // retry after 3 seconds
    }
  }
});

client.on('error', (err) => {
  console.error('❌ Redis Client Error:', err.message || err);
});

client.on('connect', () => {
  console.log('🔌 Redis connected successfully');
});

// Immediately invoke connection
if (process.env.NODE_ENV !== 'test') {
  client.connect().catch((err) => {
    console.error('⚠️ Redis connection failed. Local execution will proceed with in-memory caching.', err.message || err);
  });
}

export const redis = client;
export default redis;
