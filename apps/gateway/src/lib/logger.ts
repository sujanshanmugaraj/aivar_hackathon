import winston from 'winston';

const { combine, timestamp, json, colorize, simple, errors } = winston.format;

const isDev = process.env.NODE_ENV !== 'production';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'ISO' }),
    json()
  ),
  defaultMeta: { service: 'aegis-waf-gateway' },
  transports: [
    new winston.transports.Console({
      format: isDev
        ? combine(colorize(), simple())
        : combine(timestamp(), json()),
    }),
  ],
});

// Structured audit-specific logger (never colorised)
export const auditLogger = winston.createLogger({
  level: 'info',
  format: combine(timestamp({ format: 'ISO' }), json()),
  defaultMeta: { service: 'aegis-waf-audit' },
  transports: [new winston.transports.Console()],
});
