import { Response } from "express";
import { AuthedRequest } from "../../middleware/auth";




import { AppError } from "../../utils/AppError";
import { getAuditContext } from "../../middleware/audit";
import { obtenerInfoCompletaRut  } from "../../services/cotizacion.service";
import { actualizarOCrearAsegurado } from "../../services/asegurado.service";
export async function obtenerDatosRut(req: AuthedRequest, res: Response) {
  const { rut } = req.params;

  if (!rut) {
    throw new AppError("Debe enviar un RUT.", 400);
  }

  const resultado = await obtenerInfoCompletaRut(rut);
  return res.json(resultado);
}

export async function actualizarAsegurado(req: AuthedRequest, res: Response) {
  const datosAsegurado = req.body;
  const auditCtx = getAuditContext(req);

  if (
    !datosAsegurado.rut ||
    !datosAsegurado.nombre ||
    !datosAsegurado.apellido ||
    !datosAsegurado.correo
  ) {
    throw new AppError("Debe enviar RUT, nombre, apellido y correo.", 400);
  }

  const resultado = await actualizarOCrearAsegurado(datosAsegurado, auditCtx);
  return res.json(resultado);
}
