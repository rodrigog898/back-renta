import axios from "axios";
import Vehiculo from "../models/Vehiculo";
import { AppError } from "../utils/AppError";
import * as Audit from "./audit.service";
import { AuditContext } from "../middleware/audit";

export async function obtenerDatosVehiculo(patente: string) {
  const patenteNormalizada = patente.toUpperCase().trim();

  try {
    let vehiculoBD = await Vehiculo.findOne({ patente: patenteNormalizada }).lean();
    
    if (!vehiculoBD) {
      vehiculoBD = await Vehiculo.findOne({ patente: new RegExp(`^${patenteNormalizada}$`, "i") }).lean();
    }

    if (vehiculoBD) {
      return {
        fuente: "bd",
        patente: vehiculoBD.patente,
        marca: vehiculoBD.marca,
        modelo: vehiculoBD.modelo,
        anio: vehiculoBD.anio,
        tipo: vehiculoBD.tipo,
        color: vehiculoBD.color,
        valor_comercial: vehiculoBD.valor_comercial,
        chasis: vehiculoBD.chasis,    
        motor: vehiculoBD.motor,      
        kilometraje: vehiculoBD.kilometraje || null
      };
    }
  } catch (err) {
    console.error("Error consultando BD:", err);
  }

  try {
    const apiUrl = process.env.VEHICULO_API_URL || 'http://localhost:5000/api/vehiculo';
    const url = `${apiUrl}?patente=${patenteNormalizada}`;
    
    console.log(`[API] Consultando: ${url}`);
    const response = await axios.get(url);

    const api = response.data;
    console.log(`[API] Respuesta recibida:`, JSON.stringify(api, null, 2));

    if (!api || api.success !== true || !api.data) {
      console.log(`[API] Respuesta inválida o sin datos. success: ${api?.success}, tiene data: ${!!api?.data}`);
      return null;
    }

    const datosApi = api.data;
    const patenteApi = datosApi.patente?.toUpperCase().trim();

    console.log(`[API] Patente recibida: "${patenteApi}", esperada: "${patenteNormalizada}"`);

    if (patenteApi !== patenteNormalizada) {
      console.log("[API] Patente no coincide. API entregó datos genéricos. Se descarta.");
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
    console.log("Error consultando API externa:", err);
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
    const vehiculoExistente = await Vehiculo.findOne({ 
      patente: new RegExp(`^${patenteNormalizada}$`, "i") 
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
      kilometraje: datosVehiculo.kilometraje
    };

    if (vehiculoExistente) {
      const before = {
        patente: vehiculoExistente.patente,
        marca: vehiculoExistente.marca,
        modelo: vehiculoExistente.modelo,
        anio: vehiculoExistente.anio
      };

      const vehiculoActualizado = await Vehiculo.findByIdAndUpdate(
        vehiculoExistente._id,
        { $set: datosActualizados },
        { new: true, runValidators: true }
      ).lean();

      if (!vehiculoActualizado) {
        throw new AppError("Error al actualizar el vehículo en la base de datos", 500);
      }

      if (auditCtx) {
        try {
          await Audit.log(auditCtx, {
            action: 'vehiculo.update',
            entity: 'Vehiculo',
            entityId: String(vehiculoActualizado._id),
            before,
            after: {
              patente: vehiculoActualizado.patente,
              marca: vehiculoActualizado.marca,
              modelo: vehiculoActualizado.modelo,
              anio: vehiculoActualizado.anio
            },
            metadata: { patente: patenteNormalizada }
          });
        } catch {}
      }

      return {
        accion: "actualizado",
        vehiculo: vehiculoActualizado
      };
    } else {
      const nuevoVehiculo = await Vehiculo.create(datosActualizados);
      const vehiculoCreado = await Vehiculo.findById(nuevoVehiculo._id).lean();

      if (!vehiculoCreado) {
        throw new AppError("Error al crear el vehículo en la base de datos", 500);
      }

      if (auditCtx) {
        try {
          await Audit.log(auditCtx, {
            action: 'vehiculo.create',
            entity: 'Vehiculo',
            entityId: String(vehiculoCreado._id),
            before: null,
            after: {
              patente: vehiculoCreado.patente,
              marca: vehiculoCreado.marca,
              modelo: vehiculoCreado.modelo,
              anio: vehiculoCreado.anio
            },
            metadata: { patente: patenteNormalizada }
          });
        } catch {}
      }

      return {
        accion: "creado",
        vehiculo: vehiculoCreado
      };
    }
  } catch (err: any) {
    console.error("Error actualizando/creando vehículo:", err);
    
    if (auditCtx) {
      try {
        await Audit.log(auditCtx, {
          action: 'vehiculo.update.error',
          entity: 'Vehiculo',
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

