import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICliente {
  rut_cliente: string;
  nombre: string;
  apellido: string;
  correo: string;
  telefono: string;
  sexo: string;
  fecha_nacimiento: string; // dd-mm-yyyy
}

export interface IVehiculo {
  marca: string;
  modelo: string;
  anio: number;
  patente: string;
  kilometraje: number;
}

export interface IProducto {
  t_producto: string;
  deducible: number;
}

export interface ICotizacion extends Document {
  n_cotizacion: number;
  fecha_cotizacion: string;  // dd-mm-yyyy hh:mm:ss
  id_corredor: string;

  cliente: ICliente;
  vehiculo: IVehiculo;
  producto: IProducto;

  prima: number;
  comision: number;
  prob_cierre: number;
  estado: string;

  createdAt: Date;
  updatedAt: Date;
}

const clienteSchema = new Schema<ICliente>({
  rut_cliente: { type: String, required: true },
  nombre: { type: String, required: true },
  apellido: { type: String, required: true },
  correo: { type: String, required: true },
  telefono: { type: String, required: true },
  sexo: { type: String, required: true },
  fecha_nacimiento: { type: String, required: true },
});

const vehiculoSchema = new Schema<IVehiculo>({
  marca: { type: String, required: true },
  modelo: { type: String, required: true },
  anio: { type: Number, required: true },
  patente: { type: String, required: true },
  kilometraje: { type: Number, required: true },
});

const productoSchema = new Schema<IProducto>({
  t_producto: { type: String, required: true },
  deducible: { type: Number, required: true },
});

const cotizacionSchema = new Schema<ICotizacion>(
  {
    n_cotizacion: { type: Number, required: true, index: true },
    fecha_cotizacion: { type: String, required: true },
    id_corredor: { type: String, required: true },

    cliente: { type: clienteSchema, required: true },
    vehiculo: { type: vehiculoSchema, required: true },
    producto: { type: productoSchema, required: true },

    prima: { type: Number, required: true },
    comision: { type: Number, required: true },
    prob_cierre: { type: Number, required: true },

    estado: { type: String, required: true },
  },
  { timestamps: true }
);

const Cotizacion: Model<ICotizacion> =
  mongoose.models.Cotizacion ||
  mongoose.model<ICotizacion>('Cotizacion', cotizacionSchema, 'renen');

  export default Cotizacion;