
import { Request, Response, NextFunction } from 'express';
import { verify, JwtPayload } from '../utils/jwt';

export interface AuthedRequest extends Request {
  user?: { id: string };
}

export function auth(req: AuthedRequest, res: Response, next: NextFunction) {
  const hdr = req.headers['authorization'];
  if (!hdr || !hdr.toString().startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const token = hdr.toString().slice(7);
  try {
    const payload = verify<JwtPayload>(token);
    req.user = { id: String(payload.sub) };
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}
