
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAuditLog extends Document {
  actorId?: mongoose.Types.ObjectId | null;
  action: string;              
  entity: string;              
  entityId?: string | null;    
  before?: Record<string, any> | null;
  after?: Record<string, any> | null;
  metadata?: Record<string, any> | null; 
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>({
  actorId: { type: Schema.Types.ObjectId, ref: 'User', required: false, index: true },
  action: { type: String, required: true, index: true },
  entity: { type: String, required: true, index: true },
  entityId: { type: String, required: false, index: true },
  before: { type: Schema.Types.Mixed, required: false },
  after: { type: Schema.Types.Mixed, required: false },
  metadata: { type: Schema.Types.Mixed, required: false },
  ip: { type: String },
  userAgent: { type: String },
  requestId: { type: String, index: true },
  createdAt: { type: Date, default: Date.now, index: true }
}, { minimize: false });

const AuditLog: Model<IAuditLog> = mongoose.models.AuditLog
  || mongoose.model<IAuditLog>('AuditLog', auditLogSchema);

export default AuditLog;
