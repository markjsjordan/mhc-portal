import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const rawUrl = typeof req.originalUrl === 'string' && req.originalUrl !== '' ? req.originalUrl : req.url;
  const safeUrl = rawUrl.split('?')[0];

  // Log request (strip query parameters to prevent PHI leakage)
  logger.info({
    method: req.method,
    url: safeUrl,
    ip: req.ip,
    userId: req.user?.userId,
    userAgent: req.get('user-agent')
  }, 'Incoming request');

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - start;

    const logData = {
      method: req.method,
      url: safeUrl,
      statusCode: res.statusCode,
      duration,
      userId: req.user?.userId
    };

    if (res.statusCode >= 500) {
      logger.error(logData, 'Request failed');
    } else if (res.statusCode >= 400) {
      logger.warn(logData, 'Request error');
    } else {
      logger.info(logData, 'Request completed');
    }

    // Alert on slow requests (>2 seconds)
    if (duration > 2000) {
      logger.warn({ ...logData, duration }, 'Slow request detected');
    }
  });

  next();
}
