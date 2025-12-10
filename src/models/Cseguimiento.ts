import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISeguimiento extends Document {
  id_cotizacion: string;
  type?: string;
  descripcion?: string;
  f_creacion?: Date;
  f_recordatorio?: Date;
  id_user: string; 
  enviado?: boolean;
  enviado_at?: Date; 
  error_envio?: string; 
}

const seguimientoSchema = new Schema<ISeguimiento>({
  id_cotizacion: { type: String, required: true },
  type: { type: String },
  descripcion: { type: String },
  f_creacion: { type: Date, default: Date.now },
  f_recordatorio: { type: Date, required: true },
  id_user: { type: String, required: true },
  enviado: { type: Boolean, default: false },
  enviado_at: { type: Date },
  error_envio: { type: String },
}, { timestamps: true });

seguimientoSchema.index({ f_recordatorio: 1, enviado: 1 });

const Seguimiento: Model<ISeguimiento> =
  mongoose.models.Seguimiento ||
  mongoose.model<ISeguimiento>('Seguimiento', seguimientoSchema);

export default Seguimiento;
