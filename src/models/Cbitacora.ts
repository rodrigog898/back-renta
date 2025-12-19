import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICliente {
  rut_cliente: string;
  nombre: string;
  apellido: string;
  correo: string;
  telefono: string;
  sexo: string;
  fecha_nacimiento: string;
  ciudad?: string;
  comuna?: string;
  direccion?: string;
  genero?: string;
}

export interface IVehiculo {
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

export interface IProducto {
  t_producto: string;
  deducible: number;
}

export interface ICondiciones {
  comentario: string;
  tags: string[];
}

export interface ICotizacion extends Document {
  n_cotizacion: number;
  fecha_cotizacion: string;  
  id_corredor: string;

  cliente: ICliente;
  vehiculo: IVehiculo;
  producto: IProducto;
  condiciones?: ICondiciones; 

  prima: number;
  comision: number;
  prob_cierre: number;
  estado: 'EN_PROCESO' | 'CADUCADA';
}

const clienteSchema = new Schema<ICliente>({
  rut_cliente: { type: String, required: true },
  nombre: { type: String, required: true },
  apellido: { type: String, required: true },
  correo: { type: String, required: true },
  telefono: { type: String, required: true },
  sexo: { type: String, required: true },
  fecha_nacimiento: { type: String, required: false },
  ciudad: { type: String, required: false },
  comuna: { type: String, required: false },
  direccion: { type: String, required: false },
  genero: { type: String, required: false },
});

const vehiculoSchema = new Schema<IVehiculo>({
  patente: { type: String, required: true },
  marca: { type: String, required: true },
  modelo: { type: String, required: true },
  anio: { type: Number, required: true },
  color: { type: String, required: false },
  valorComercial: { type: String, required: false },
  numeroChasis: { type: String, required: false },
  numeroMotor: { type: String, required: false },
  tipoVehiculo: { type: String, required: false },
  
});



const productoSchema = new Schema<IProducto>({
  t_producto: { type: String, required: true },
  deducible: { type: Number, required: true },
});


//CONDICIONES EN COTIZACIÓN
const condicionesSchema = new Schema<ICondiciones>({
  comentario: { type: String, default: '', trim: true },
  tags: { type: [String], default: [] }
}, { _id: false });

const cotizacionSchema = new Schema<ICotizacion>(
  {
    n_cotizacion: { type: Number, required: true, index: true },
    fecha_cotizacion: { type: String, required: true },
    id_corredor: { type: String, required: true },

    cliente: { type: clienteSchema, required: false },
    vehiculo: { type: vehiculoSchema, required: false },
    producto: { type: productoSchema, required: false },
    condiciones: { type: condicionesSchema, required: false },

    prima: { type: Number, required: false },
    comision: { type: Number, required: false },
    prob_cierre: { type: Number, required: false },

    estado: { 
     type: String, 
     enum: ['EN_PROCESO', 'CADUCADA'],
     default: 'EN_PROCESO',
     required: true 
   },
  },
  { timestamps: false, versionKey: false }
);

const Cotizacion: Model<ICotizacion> =
  (mongoose.models.Cotizacion as Model<ICotizacion>) ||
  mongoose.model<ICotizacion>('Cotizacion', cotizacionSchema, 'cotizacion'); 

export default Cotizacion;
