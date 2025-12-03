// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { verify, JwtPayload } from '../utils/jwt';
import User from '../models/User';

export interface AuthedRequest extends Request {
  user?: { id: string; rol?: string; email?: string };
}

export async function auth(req: AuthedRequest, res: Response, next: NextFunction) {
  const hdr = req.headers['authorization'];
  if (!hdr || !hdr.toString().startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const token = hdr.toString().slice(7);

  try {
    const payload = verify<JwtPayload>(token);
    const userId = String(payload.sub);

    const u = await User.findById(userId).select('email rol').lean();
    if (!u) return res.status(401).json({ message: 'User not found' });

    req.user = { id: userId, email: u.email, rol: (u.rol || '').toLowerCase() };
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}
