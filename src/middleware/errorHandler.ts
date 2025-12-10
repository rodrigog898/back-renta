import { Request, Response, NextFunction } from 'express';
import env from '../config/env';

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const status = err.status || err.statusCode || 500;
  const payload = {
    message: err.expose !== false ? err.message : 'Internal Server Error',
    code: err.code || String(status),
    requestId: (req as any).id
  };
  if (env.nodeEnv !== 'production') {
    (payload as any).stack = err.stack;
  }
  res.status(status).json(payload);
}
