
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export function requestId(req: Request, res: Response, next: NextFunction) {
  const id = req.headers['x-request-id'] as string || uuidv4();
  res.setHeader('x-request-id', id);
  (req as any).id = id;
  next();
}
