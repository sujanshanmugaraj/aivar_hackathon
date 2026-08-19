import Redis from 'ioredis';
import { config } from './config';
import { logger } from './logger';

let redisInstance: Redis | null = null;

export function getRedis(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      reconnectOnError: (err) => {
        logger.error('Redis reconnect on error', { error: err.message });
        return true;
      },
      lazyConnect: false,
    });

    redisInstance.on('connect', () => logger.info('Redis connected'));
    redisInstance.on('error', (err) => logger.error('Redis error', { error: err.message }));
    redisInstance.on('close', () => logger.warn('Redis connection closed'));
  }
  return redisInstance;
}

export async function closeRedis(): Promise<void> {
  if (redisInstance) {
    await redisInstance.quit();
    redisInstance = null;
  }
}
