
import { Request } from 'express';

export interface AuditContext {
  actorId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

export function getAuditContext(req: Request): AuditContext {
  const actorId = (req as any).user?.id || null;
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || null;
  const userAgent = (req.headers['user-agent'] as string) || null;
  const requestId = (req.headers['x-request-id'] as string) || (resHeader(req, 'x-request-id'));
  return { actorId, ip, userAgent, requestId };
}

function resHeader(req: Request, key: string): string | null {
  try {

    return (req as any).id || null;
  } catch {
    return null;
  }
}
