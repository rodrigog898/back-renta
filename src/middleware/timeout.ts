
import { Request, Response, NextFunction } from 'express';
import env from '../config/env';

export function requestTimeout(ms = env.requestTimeoutMs) {
  return function (req: Request, res: Response, next: NextFunction) {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(503).json({ error: 'Request timeout' });
      }
    }, ms);
    res.on('finish', () => clearTimeout(timer));
    next();
  };
}
