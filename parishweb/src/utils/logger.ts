import pino from 'pino';
import type { Logger } from 'pino';
import type { Request, Response, NextFunction } from 'express';

type LogContext = Record<string, unknown>;
type LoggedRequest = Request & { log: Logger; requestId: string };

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

  if (!isDevelopment) {
    return pino(baseConfig);
  }

  return pino({
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
  });
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
  const loggedRequest = req as LoggedRequest;
  loggedRequest.log = logger.child({ requestId });
  loggedRequest.requestId = requestId;

  // Log incoming request
  loggedRequest.log.info({
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
  res.json = function(data: unknown) {
    const duration = Date.now() - startTime;

    // Log response
    loggedRequest.log.info({
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
  res.send = function(data: unknown) {
    const duration = Date.now() - startTime;

    if (res.statusCode >= 400) {
      loggedRequest.log.warn({
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
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
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
    [key: string]: unknown;
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
    [key: string]: unknown;
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
export function logAuth(action: string, details: LogContext) {
  logger.info({
    type: 'auth',
    action,
    ...details,
  });
}

/**
 * Log email operations
 */
export function logEmail(action: string, details: { to?: string; subject?: string; [key: string]: unknown }) {
  logger.info({
    type: 'email',
    action,
    ...details,
  });
}

/**
 * Create a child logger with context
 */
export function createContextLogger(context: LogContext) {
  return logger.child(context);
}
