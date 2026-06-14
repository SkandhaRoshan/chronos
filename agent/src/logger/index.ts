import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * @title Core System Logger
 * @dev Standardized Pino instance for structured data streams.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isDevelopment 
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname'
        }
      }
    : undefined
});
