
import mongoose from 'mongoose';
import AuditLog from '../models/AuditLog';
import { AuditContext } from '../middleware/audit';

interface LogParams {
  action: string;
  entity: string;
  entityId?: string | null;
  before?: Record<string, any> | null;
  after?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
}

export async function log(ctx: AuditContext, params: LogParams) {
  const actorId = ctx.actorId ? new mongoose.Types.ObjectId(ctx.actorId) : undefined;
  await AuditLog.create({
    actorId,
    action: params.action,
    entity: params.entity,
    entityId: params.entityId || null,
    before: params.before || null,
    after: params.after || null,
    metadata: params.metadata || null,
    ip: ctx.ip || null,
    userAgent: ctx.userAgent || null,
    requestId: ctx.requestId || null
  });
}
