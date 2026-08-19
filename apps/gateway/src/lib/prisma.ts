import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' },
    ],
  });

  if (process.env.NODE_ENV === 'development') {
    (client.$on as any)('query', (e: { query: string; duration: number }) => {
      logger.debug('Prisma query', { query: e.query, duration: e.duration });
    });
  }

  (client.$on as any)('error', (e: { message: string }) => {
    logger.error('Prisma error', { message: e.message });
  });

  return client;
}

// Prevent multiple instances in dev (hot-reload)
export const prisma: PrismaClient =
  global.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}
