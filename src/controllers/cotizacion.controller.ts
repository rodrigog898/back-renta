import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import { getAuditContext } from "../middleware/audit";
import { AppError } from "../utils/AppError";

import {
  crearCotizacionInicialService,
  actualizarCotizacionVehiculoService,
  actualizarCotizacionClienteService
} from "../services/cotizacion.service";


export async function crearCotizacionInicial(req: AuthedRequest, res: Response) {
  const idCorredor = req.user?.id;   

  if (!idCorredor) {
    throw new AppError("Unauthorized", 401);
  }

  const auditCtx = getAuditContext(req);
  const cotizacion = await crearCotizacionInicialService(idCorredor, auditCtx);

  return res.status(201).json({
    success: true,
    _id: cotizacion._id,
    n_cotizacion: cotizacion.n_cotizacion,
    estado: cotizacion.estado,
    vehiculo: cotizacion.vehiculo,
    cliente: cotizacion.cliente,
    mensaje: `Cotización #${cotizacion.n_cotizacion} creada exitosamente`,
  });
}

export async function actualizarVehiculoCotizacion(
  req: AuthedRequest,
  res: Response
) {
  const { idCotizacion } = req.params;
  const datosVehiculo = req.body;

  if (!idCotizacion) {
    throw new AppError("El ID de la cotización es requerido", 400);
  }

  const auditCtx = getAuditContext(req);

  const cotizacion = await actualizarCotizacionVehiculoService(
    idCotizacion,
    datosVehiculo,
    auditCtx
  );

  return res.json({
    success: true,
    cotizacion,
    mensaje: "Datos del vehículo actualizados correctamente",
  });
}


export async function actualizarClienteCotizacion(req: AuthedRequest, res: Response) {
  const { idCotizacion } = req.params;
  const body = req.body;

  if (!idCotizacion) throw new AppError("El ID de la cotización es requerido", 400);

  
  const rut = (body?.rut_cliente || body?.rut || "").toString();
  if (!rut.trim()) throw new AppError("Debe enviar rut_cliente o rut", 400);

  const auditCtx = getAuditContext(req);

  const cotizacion = await actualizarCotizacionClienteService(idCotizacion, body, auditCtx);

  return res.json({
    success: true,
    cotizacion,
    mensaje: "Datos del asegurado actualizados correctamente",
  });
}