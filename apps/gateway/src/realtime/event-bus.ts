import Redis from 'ioredis';
import { AuditEventPayload, WsEvent } from '../types';
import { logger } from '../lib/logger';
import { config } from '../lib/config';

// Separate publisher and subscriber connections (required by ioredis)
let publisher: Redis | null = null;
let subscriber: Redis | null = null;

const CHANNEL = 'aegis:events';
const wsClients = new Set<{ send: (data: string) => void; readyState: number }>();

export function initEventBus(): void {
  publisher = new Redis(config.REDIS_URL);
  subscriber = new Redis(config.REDIS_URL);

  subscriber.subscribe(CHANNEL, (err) => {
    if (err) logger.error('EventBus subscribe error', { error: err.message });
    else logger.info('EventBus subscribed to channel', { channel: CHANNEL });
  });

  subscriber.on('message', (_channel: string, message: string) => {
    // Fan-out to all connected WebSocket clients
    const deadClients: typeof wsClients extends Set<infer T> ? T[] : never[] = [];

    wsClients.forEach((client) => {
      if (client.readyState === 1 /* OPEN */) {
        try {
          client.send(message);
        } catch {
          deadClients.push(client as any);
        }
      } else {
        deadClients.push(client as any);
      }
    });

    // Cleanup dead connections
    deadClients.forEach((c) => wsClients.delete(c as any));
  });
}

/**
 * Publish a WAF event to all connected dashboard clients.
 */
export async function publishEvent(payload: AuditEventPayload): Promise<void> {
  if (!publisher) return;

  const event: WsEvent = {
    type: payload.decision as WsEvent['type'],
    payload,
  };

  try {
    await publisher.publish(CHANNEL, JSON.stringify(event));
  } catch (err) {
    logger.error('EventBus publish error', { error: (err as Error).message });
  }
}

/**
 * Register a WebSocket client for live events.
 */
export function registerWsClient(client: {
  send: (data: string) => void;
  readyState: number;
}): void {
  wsClients.add(client);
  logger.debug('WS client registered', { totalClients: wsClients.size });
}

/**
 * Deregister a WebSocket client.
 */
export function deregisterWsClient(client: {
  send: (data: string) => void;
  readyState: number;
}): void {
  wsClients.delete(client);
  logger.debug('WS client deregistered', { totalClients: wsClients.size });
}

export function getConnectedClients(): number {
  return wsClients.size;
}
