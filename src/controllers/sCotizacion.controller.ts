import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import { obtenerInfoCompletaPatente, actualizarVehiculoService } from "../services/sCotizacion.service";
import { AppError } from "../utils/AppError";
import { getAuditContext } from "../middleware/audit";

export async function obtenerDatosPatente(req: AuthedRequest, res: Response) {
  const { patente } = req.params;

  if (!patente) {
    throw new AppError("Debe enviar una patente.", 400);
  }

  const resultado = await obtenerInfoCompletaPatente(patente);
  return res.json(resultado);
}

export async function actualizarVehiculo(req: AuthedRequest, res: Response) {
  const datosVehiculo = req.body;
  const auditCtx = getAuditContext(req);

  if (!datosVehiculo.patente || !datosVehiculo.marca || !datosVehiculo.modelo || !datosVehiculo.anio) {
    throw new AppError("Debe enviar patente, marca, modelo y año.", 400);
  }

  const resultado = await actualizarVehiculoService(datosVehiculo, auditCtx);
  return res.json(resultado);
}
