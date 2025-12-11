


import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVehiculos extends Document {
  patente: string;
  marca: string;
  modelo: string;
  anio: number;
  color?: string;
  valorComercial?: string;
  numeroChasis?: string;
  numeroMotor?: string;
  tipoVehiculo?: string;
}

const VehiculoSchema = new Schema<IVehiculos>({
  patente: { type: String, required: true },
  marca: { type: String, required: true },
  modelo: { type: String, required: true },
  anio: { type: Number, required: true },
  color: { type: String, required: false },
  valorComercial: { type: String, required: false },
  numeroChasis: { type: String, required: false },
  numeroMotor: { type: String },
  tipoVehiculo: { type: String },
}, { timestamps: true });

VehiculoSchema.index({ f_recordatorio: 1, enviado: 1 });

const Vehiculo: Model<IVehiculos> =
  mongoose.models.Vehiculos ||
  mongoose.model<IVehiculos>('Vehiculos', VehiculoSchema);

export default Vehiculo;
