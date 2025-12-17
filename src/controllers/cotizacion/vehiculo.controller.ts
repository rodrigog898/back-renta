import { Response } from "express";
import { AuthedRequest } from "../../middleware/auth";




import { actualizarVehiculoEnCotizacionService , obtenerInfoCompletaPatente,actualizarVehiculoService, actualizarCotizacionVehiculoService, crearCotizacionInicialService } from "../../services/cotizacion.service";

import { AppError } from "../../utils/AppError";
import { getAuditContext } from "../../middleware/audit";

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

  if (
    !datosVehiculo.patente ||
    !datosVehiculo.marca ||
    !datosVehiculo.modelo ||
    !datosVehiculo.anio
  ) {
    throw new AppError("Debe enviar patente, marca, modelo y año.", 400);
  }

  const resultado = await actualizarVehiculoService(datosVehiculo, auditCtx);
  return res.json(resultado);
}


export async function continuarVehiculoCotizacion(req: AuthedRequest, res: Response) {
  const datos = req.body;
  const auditCtx = getAuditContext(req);

  if (!datos.id_cotizacion) {
    throw new AppError("Debe enviar id_cotizacion.", 400);
  }

  if (!datos.patente || !datos.marca || !datos.modelo || !datos.anio) {
    throw new AppError(
      "Debe enviar patente, marca, modelo y año para asociar el vehículo a la cotización.",
      400
    );
  }

  const resultado = await actualizarVehiculoEnCotizacionService(datos, auditCtx);
  return res.json(resultado);
}


export async function crearCotizacionInicial(req: AuthedRequest, res: Response) {
  try {
    const { idCorredor } = req.body;

    if (!idCorredor) {
      return res.status(400).json({
        success: false,
        message: "El campo idCorredor es requerido",
      });
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
  } catch (error: any) {
    console.error("[crearCotizacionInicial] Error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Error al crear la cotización",
    });
  }
}


export async function actualizarVehiculoCotizacion(req: AuthedRequest, res: Response) {
  try {
    const { idCotizacion } = req.params;
    const datosVehiculo = req.body;

    if (!idCotizacion) {
      return res.status(400).json({
        success: false,
        message: "El ID de la cotización es requerido",
      });
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
  } catch (error: any) {
    console.error("[actualizarVehiculoCotizacion] Error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Error al actualizar el vehículo",
    });
  }
}
