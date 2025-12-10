import axios from "axios";
import Cotizacion from "../models/sBitacora";
import { AppError } from "../utils/AppError";
import * as Audit from "./audit.service";
import { AuditContext } from "../middleware/audit";

export async function obtenerDatosVehiculo(patente: string) {
  const patenteNormalizada = patente.toUpperCase().trim();

  try {
    let cotizacionBD = await Cotizacion.findOne({ 
      "vehiculo.patente": patenteNormalizada 
    }).lean();
    
    if (!cotizacionBD) {
      cotizacionBD = await Cotizacion.findOne({ 
        "vehiculo.patente": new RegExp(`^${patenteNormalizada}$`, "i") 
      }).lean();
    }

    if (cotizacionBD && cotizacionBD.vehiculo) {
      const vehiculo = cotizacionBD.vehiculo;
      return {
        fuente: "bd",
        patente: vehiculo.patente,
        marca: vehiculo.marca,
        modelo: vehiculo.modelo,
        anio: vehiculo.anio,
        tipo: vehiculo.tipo || vehiculo.tipoVehiculo,
        color: vehiculo.color,
        valor_comercial: vehiculo.valor_comercial,
        chasis: vehiculo.chasis || vehiculo.numeroChasis,
        motor: vehiculo.motor || vehiculo.numeroMotor,
        kilometraje: vehiculo.kilometraje || null
      };
    }
  } catch (err) {
    console.error("Error consultando BD:", err);
  }

  try {
    const apiUrl = process.env.VEHICULO_API_URL || 'http://localhost:5000/api/vehiculo';
    const url = `${apiUrl}?patente=${patenteNormalizada}`;
    
    const response = await axios.get(url);

    const api = response.data;

    if (!api || api.success !== true || !api.data) {
      return null;
    }

    const datosApi = api.data;
    const patenteApi = datosApi.patente?.toUpperCase().trim();

    if (patenteApi !== patenteNormalizada) {
      return null;
    }

    return {
      fuente: "api",
      patente: patenteNormalizada,
      marca: datosApi.marca,
      modelo: datosApi.modelo,
      anio: datosApi.anio,
      tipo: datosApi.tipoVehiculo,
      color: datosApi.color,
      valor_comercial: datosApi.valorComercial,
      chasis: datosApi.numeroChasis,
      motor: datosApi.numeroMotor
    };

  } catch (err) {
  }

  return null;
}

export async function actualizarOCrearVehiculo(
  datosVehiculo: {
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
  },
  auditCtx?: AuditContext
) {
  const patenteNormalizada = datosVehiculo.patente.toUpperCase().trim();

  try {
    const cotizacionExistente = await Cotizacion.findOne({ 
      "vehiculo.patente": new RegExp(`^${patenteNormalizada}$`, "i") 
    }).lean();

    const datosActualizados = {
      patente: patenteNormalizada,
      marca: datosVehiculo.marca,
      modelo: datosVehiculo.modelo,
      anio: datosVehiculo.anio,
      tipo: datosVehiculo.tipo,
      color: datosVehiculo.color,
      valor_comercial: datosVehiculo.valor_comercial,
      chasis: datosVehiculo.chasis,
      motor: datosVehiculo.motor,
      kilometraje: datosVehiculo.kilometraje || 0
    };

    if (cotizacionExistente && cotizacionExistente.vehiculo) {
      const before = {
        patente: cotizacionExistente.vehiculo.patente,
        marca: cotizacionExistente.vehiculo.marca,
        modelo: cotizacionExistente.vehiculo.modelo,
        anio: cotizacionExistente.vehiculo.anio
      };

      const cotizacionActualizada = await Cotizacion.findByIdAndUpdate(
        cotizacionExistente._id,
        { $set: { vehiculo: datosActualizados } },
        { new: true, runValidators: true }
      ).lean();

      if (!cotizacionActualizada || !cotizacionActualizada.vehiculo) {
        throw new AppError("Error al actualizar el vehículo en la base de datos", 500);
      }

      if (auditCtx) {
        try {
          await Audit.log(auditCtx, {
            action: 'vehiculo.update',
            entity: 'Cotizacion',
            entityId: String(cotizacionActualizada._id),
            before,
            after: {
              patente: cotizacionActualizada.vehiculo.patente,
              marca: cotizacionActualizada.vehiculo.marca,
              modelo: cotizacionActualizada.vehiculo.modelo,
              anio: cotizacionActualizada.vehiculo.anio
            },
            metadata: { patente: patenteNormalizada }
          });
        } catch {}
      }

      return {
        accion: "actualizado",
        vehiculo: cotizacionActualizada.vehiculo
      };
    } else {
      return {
        accion: "no_encontrado",
        vehiculo: datosActualizados
      };
    }
  } catch (err: any) {
    console.error("Error actualizando/creando vehículo:", err);
    
    if (auditCtx) {
      try {
        await Audit.log(auditCtx, {
          action: 'vehiculo.update.error',
          entity: 'Cotizacion',
          entityId: null,
          before: null,
          after: null,
          metadata: { 
            error: err.message, 
            patente: patenteNormalizada,
            stack: err.stack 
          }
        });
      } catch {}
    }
    
    if (err instanceof AppError) {
      throw err;
    }
    
    throw new AppError(
      err.message || "Error al guardar el vehículo en la base de datos",
      500
    );
  }
}

