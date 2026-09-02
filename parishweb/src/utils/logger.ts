import pino from 'pino';
import type { Request, Response, NextFunction } from 'express';

/**
 * Configure and create logger instance
 * Uses pino for structured logging with optional pretty printing in development
 */
const createLogger = () => {
  const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
  const isProduction = process.env.NODE_ENV === 'production';

  const baseConfig = {
    level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  if (isDevelopment) {
    // Development: pretty-print logs to console
    return pino(
      {
        ...baseConfig,
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
            singleLine: false,
          },
        },
      }
    );
  } else {
    // Production: structured JSON logs
    return pino(baseConfig);
  }
};

export const logger = createLogger();

/**
 * Express middleware for request/response logging
 * Logs incoming requests and outgoing responses with timing information
 */
export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const requestId = generateRequestId();

  // Attach logger and requestId to request object
  (req as any).log = logger.child({ requestId });
  (req as any).requestId = requestId;

  // Log incoming request
  (req as any).log.info({
    type: 'request',
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Capture original res.json
  const originalJson = res.json.bind(res);

  // Override res.json to log response
  res.json = function(data: any) {
    const duration = Date.now() - startTime;

    // Log response
    (req as any).log.info({
      type: 'response',
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      bodySize: JSON.stringify(data).length,
    });

    return originalJson(data);
  };

  // Handle errors in next middleware
  const originalSend = res.send.bind(res);
  res.send = function(data: any) {
    const duration = Date.now() - startTime;

    if (res.statusCode >= 400) {
      (req as any).log.warn({
        type: 'response',
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration: `${duration}ms`,
      });
    }

    return originalSend(data);
  };

  next();
}

/**
 * Generate unique request ID for tracing
 */
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Log database queries and performance
 */
export function logDatabaseQuery(query: string, duration: number, rowCount?: number) {
  logger.debug({
    type: 'database',
    query: query.substring(0, 200), // First 200 chars
    duration: `${duration}ms`,
    rowCount: rowCount || 0,
  });
}

/**
 * Log errors with full context
 */
export function logError(
  error: Error,
  context: {
    endpoint?: string;
    userId?: string;
    action?: string;
    [key: string]: any;
  } = {}
) {
  logger.error({
    type: 'error',
    message: error.message,
    stack: error.stack,
    ...context,
  });
}

/**
 * Log business events (bookings, signups, etc.)
 */
export function logEvent(
  eventType: string,
  data: {
    userId?: string;
    [key: string]: any;
  }
) {
  logger.info({
    type: 'event',
    eventType,
    ...data,
  });
}

/**
 * Log performance metrics
 */
export function logMetric(
  metricName: string,
  value: number,
  unit: string = 'ms'
) {
  logger.info({
    type: 'metric',
    metricName,
    value,
    unit,
  });
}

/**
 * Log authentication events
 */
export function logAuth(action: string, details: { [key: string]: any }) {
  logger.info({
    type: 'auth',
    action,
    ...details,
  });
}

/**
 * Log email operations
 */
export function logEmail(action: string, details: { to?: string; subject?: string; [key: string]: any }) {
  logger.info({
    type: 'email',
    action,
    ...details,
  });
}

/**
 * Create a child logger with context
 */
export function createContextLogger(context: { [key: string]: any }) {
  return logger.child(context);
}
