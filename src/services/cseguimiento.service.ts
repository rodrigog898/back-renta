import Seguimiento, { ISeguimiento } from "../models/Cseguimiento";
import { Types } from "mongoose";

export interface ListSegParams {
  id_cotizacion: string;
}

export interface CreateSegParams {
  id_cotizacion: string;
  type: 'llamada' | 'correo' | 'nota' | 'recordatorio';
  descripcion: string;
  f_recordatorio?: string;
  id_user: string;
}

export async function listByCotizacion(params: ListSegParams) {
  return Seguimiento
    .find({ id_cotizacion: params.id_cotizacion })
    .sort({ createdAt: -1 })
    .lean();
}

export async function create(params: CreateSegParams) {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const f_creacion = `${day}-${month}-${year} ${hours}:${minutes}`;

  return Seguimiento.create({
    id_cotizacion: params.id_cotizacion,
    type: params.type,
    descripcion: params.descripcion,
    f_creacion,
    f_recordatorio: params.f_recordatorio || null,
    id_user: params.id_user
  });
}