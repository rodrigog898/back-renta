
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVehiculo extends Document {
  patente: string;
  marca: string;
  modelo: string;
  anio: number;
  tipo?: string;
  color?: string;
  valor_comercial?: string;
  chasis?: string;       
  motor?: string;       
  kilometraje?: number;
  createdAt: Date;
  updatedAt: Date;
}

const vehiculoSchema = new Schema<IVehiculo>(
  {
    patente: { type: String, required: true, unique: true, index: true },
    marca: { type: String, required: true },
    modelo: { type: String, required: true },
    anio: { type: Number, required: true },
    tipo: { type: String },
    color: { type: String },
    valor_comercial: { type: String },

    chasis: { type: String },  
    motor: { type: String },   

    kilometraje: { type: Number }
  },
  { timestamps: true }
);

const Vehiculo: Model<IVehiculo> =
  mongoose.models.Vehiculo ||
  mongoose.model<IVehiculo>('Vehiculo', vehiculoSchema, 'vehiculo');

export default Vehiculo;
