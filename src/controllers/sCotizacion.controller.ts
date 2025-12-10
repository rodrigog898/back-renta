import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import { obtenerInfoCompletaPatente } from "../services/sCotizacion.service";
import { actualizarOCrearVehiculo } from "../services/sVehiculo.service";
import { AppError } from "../utils/AppError";
import { getAuditContext } from "../middleware/audit";

export async function obtenerDatosPatente(req: AuthedRequest, res: Response) {
  const { patente } = req.params;

  if (!patente) {
    throw new AppError("Debe enviar una patente.", 400);
  }

  const datos = await obtenerInfoCompletaPatente(patente.toUpperCase());

  if (!datos) {
    return res.json({
      encontrado: false,
      mostrarFormulario: true,
      mensaje: "No se encontraron datos. Ingreso manual habilitado."
    });
  }

  return res.json({
    encontrado: true,
    mostrarFormulario: false,
    vehiculo: datos.vehiculo,
    vigencia: null
  });
}

export async function actualizarVehiculo(req: AuthedRequest, res: Response) {
  const datosVehiculo = req.body;
  const auditCtx = getAuditContext(req);

  if (!datosVehiculo.patente || !datosVehiculo.marca || !datosVehiculo.modelo || !datosVehiculo.anio) {
    throw new AppError("Debe enviar patente, marca, modelo y año.", 400);
  }

  const resultado = await actualizarOCrearVehiculo(datosVehiculo, auditCtx);

  return res.json({
    success: true,
    accion: resultado.accion,
    mensaje: resultado.accion === "actualizado" 
      ? "Vehículo actualizado exitosamente" 
      : "Vehículo creado exitosamente",
    vehiculo: {
      fuente: "bd",
      patente: resultado.vehiculo.patente,
      marca: resultado.vehiculo.marca,
      modelo: resultado.vehiculo.modelo,
      anio: resultado.vehiculo.anio,
      tipo: resultado.vehiculo.tipo,
      color: resultado.vehiculo.color,
      valor_comercial: resultado.vehiculo.valor_comercial,
      chasis: resultado.vehiculo.chasis,
      motor: resultado.vehiculo.motor,
      kilometraje: resultado.vehiculo.kilometraje || null
    }
  });
}
