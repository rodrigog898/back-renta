
import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const status = err.status || err.statusCode || 500;
  const payload = {
    message: err.expose ? err.message : 'Internal Server Error',
    code: err.code,
    requestId: (req as any).id
  };
  if (process.env.NODE_ENV !== 'production') {
    (payload as any).stack = err.stack;
  }
  res.status(status).json(payload);
}
