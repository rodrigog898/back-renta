import { Request, Response } from 'express';
import * as AuthService from '../services/auth.service';
import * as Audit from '../services/audit.service';
import { getAuditContext } from '../middleware/audit';

export async function register(req: Request, res: Response) {
  const { email, password } = req.body as { email: string; password: string };
  const ctx = getAuditContext(req);
  const tokens = await AuthService.register(email, password, ctx);

  await Audit.log(ctx, {
    action: 'auth.register',
    entity: 'User',
    entityId: null,
    before: null,
    after: null,
    metadata: { email }
  });

  res.status(201).json(tokens);
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body as { email: string; password: string };
  const result = await AuthService.login(email, password);

  await Audit.log(getAuditContext(req), {
    action: 'auth.login',
    entity: 'User',
    entityId: null,
    before: null,
    after: null,
    metadata: { email }
  });

  res.json(result);
}

export async function refresh(req: Request, res: Response) {
  const { refreshToken } = req.body as { refreshToken: string };
  if (!refreshToken) return res.status(400).json({ message: 'refreshToken is required' });
  const tokens = await AuthService.refresh(refreshToken);

  await Audit.log(getAuditContext(req), {
    action: 'auth.refresh',
    entity: 'User',
    entityId: null,
    before: null,
    after: null
  });

  res.json(tokens);
}
