
import jwt, { SignOptions } from 'jsonwebtoken';
import env from '../config/env';

export interface JwtPayload {
  sub: string;
  typ?: 'access' | 'refresh';
  [k: string]: unknown;
}

export function signAccess(payload: Omit<JwtPayload, 'typ'>, expiresIn: string | number = '1h'): string {
  return jwt.sign({ ...payload, typ: 'access' }, env.jwtSecret, { expiresIn } as SignOptions);
}

export function signRefresh(payload: Omit<JwtPayload, 'typ'>, expiresIn: string | number = '7d'): string {
  return jwt.sign({ ...payload, typ: 'refresh' }, env.jwtSecret, { expiresIn } as SignOptions);
}

export function verify<T = JwtPayload>(token: string): T {
  return jwt.verify(token, env.jwtSecret) as T;
}
