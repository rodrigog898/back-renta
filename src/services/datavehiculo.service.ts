import axios from "axios";
import Vehiculo from "../models/vehiculo"; 
import { AppError } from "../utils/AppError";
import * as Audit from "./audit.service";
import { AuditContext } from "../middleware/audit";


export async function obtenerDatosVehiculo(patente: string) {
  const patenteNormalizada = patente.toUpperCase().trim();
  console.log("[obtenerDatosVehiculo] Inicio", {
    patenteEntrada: patente,
    patenteNormalizada,
  });

  try {
    console.log(
      "[obtenerDatosVehiculo] Buscando vehículo en BD (Vehiculos) por patente exacta",
      { patenteNormalizada }
    );

    let vehiculoBD = await Vehiculo.findOne({
      patente: patenteNormalizada,
    }).lean();

    if (!vehiculoBD) {
      console.log(
        "[obtenerDatosVehiculo] No se encontró por match exacto. Probando búsqueda case-insensitive."
      );
      vehiculoBD = await Vehiculo.findOne({
        patente: new RegExp(`^${patenteNormalizada}$`, "i"),
      }).lean();
    }

    if (vehiculoBD) {
      console.log("[obtenerDatosVehiculo] Vehículo encontrado en BD (Vehiculos)", {
        patente: vehiculoBD.patente,
        marca: vehiculoBD.marca,
        modelo: vehiculoBD.modelo,
        anio: vehiculoBD.anio,
      });

      return {
        fuente: "bd" as const,
        patente: vehiculoBD.patente,
        marca: vehiculoBD.marca,
        modelo: vehiculoBD.modelo,
        anio: vehiculoBD.anio,
        tipoVehiculo: vehiculoBD.tipoVehiculo,
        color: vehiculoBD.color,
        valorComercial: vehiculoBD.valorComercial,
        numeroChasis: vehiculoBD.numeroChasis,
        numeroMotor: vehiculoBD.numeroMotor,
      };
    } else {
      console.log("[obtenerDatosVehiculo] Vehículo NO encontrado en BD (Vehiculos)", {
        patenteNormalizada,
      });
    }
  } catch (err) {
    console.error("[obtenerDatosVehiculo] Error consultando BD (Vehiculos)", {
      patenteNormalizada,
      error: err,
    });
  }

 
  try {
    const apiUrl = process.env.VEHICULO_API_URL;
    const url = `${apiUrl}&patente=${encodeURIComponent(patenteNormalizada)}`;

    console.log("[obtenerDatosVehiculo] Consultando API de vehículo", { url });

    const response = await axios.get(url);
    const api = response.data;

    console.log("[obtenerDatosVehiculo] Respuesta API recibida", {
      success: api?.success,
      tieneData: !!api?.data,
    });

    if (!api || api.success !== true || !api.data) {
      console.log("[obtenerDatosVehiculo] API no devolvió datos válidos", {
        patenteNormalizada,
        apiRaw: api,
      });
      return null;
    }

    const datosApi = api.data;
    const patenteApiRaw = datosApi.patente ?? "";
    const patenteApi = patenteApiRaw.toUpperCase().trim();

    console.log("[obtenerDatosVehiculo] Comparando patentes", {
      patenteApi,
      patenteNormalizada,
    });

    if (patenteApi !== patenteNormalizada) {
      console.log(
        "[obtenerDatosVehiculo] Patente de API NO coincide con la solicitada",
        {
          patenteApi,
          patenteNormalizada,
        }
      );
      return null;
    }

    console.log("[obtenerDatosVehiculo] Vehículo encontrado en API", {
      patente: patenteApi,
      marca: datosApi.marca,
      modelo: datosApi.modelo,
      anio: datosApi.anio,
    });


    return {
      fuente: "api" as const,
      patente: patenteNormalizada,
      marca: datosApi.marca,
      modelo: datosApi.modelo,
      anio: datosApi.anio,
      tipoVehiculo: datosApi.tipoVehiculo,
      color: datosApi.color,
      valorComercial: datosApi.valorComercial,
      numeroChasis: datosApi.numeroChasis,
      numeroMotor: datosApi.numeroMotor,
    };
  } catch (err) {
    console.error("[obtenerDatosVehiculo] Error consultando API VEHICULO", {
      patenteNormalizada,
      error: err,
    });
  }

  console.log(
    "[obtenerDatosVehiculo] No se encontraron datos ni en BD ni en API",
    { patenteNormalizada }
  );
  return null;
}


export async function actualizarOCrearVehiculo(
  datosVehiculo: {
    patente: string;
    marca: string;
    modelo: string;
    anio: number;
    color?: string;
    valorComercial?: string;
    numeroChasis?: string;
    numeroMotor?: string;
    tipoVehiculo?: string;
  },
  auditCtx?: AuditContext
) {
  const patenteNormalizada = datosVehiculo.patente.toUpperCase().trim();

  const datosActualizados = {
    patente: patenteNormalizada,
    marca: datosVehiculo.marca,
    modelo: datosVehiculo.modelo,
    anio: datosVehiculo.anio,
    tipoVehiculo: datosVehiculo.tipoVehiculo,
    color: datosVehiculo.color,
    valorComercial: datosVehiculo.valorComercial,
    numeroChasis: datosVehiculo.numeroChasis,
    numeroMotor: datosVehiculo.numeroMotor,
  };

  try {
    const vehiculoExistente = await Vehiculo.findOne({
      patente: new RegExp(`^${patenteNormalizada}$`, "i"),
    }).lean();

    if (vehiculoExistente) {
      const before = {
        patente: vehiculoExistente.patente,
        marca: vehiculoExistente.marca,
        modelo: vehiculoExistente.modelo,
        anio: vehiculoExistente.anio,
        color: vehiculoExistente.color,
        valorComercial: vehiculoExistente.valorComercial,
        numeroChasis: vehiculoExistente.numeroChasis,
        numeroMotor: vehiculoExistente.numeroMotor,
        tipoVehiculo: vehiculoExistente.tipoVehiculo,
      };

      const vehiculoActualizado = await Vehiculo.findOneAndUpdate(
        { patente: vehiculoExistente.patente },
        { $set: datosActualizados },
        { new: true, runValidators: true }
      ).lean();

      if (!vehiculoActualizado) {
        throw new AppError(
          "Error al actualizar el vehículo en la base de datos",
          500
        );
      }

      if (auditCtx) {
        try {
          await Audit.log(auditCtx, {
            action: "vehiculo.update",
            entity: "Vehiculos",
            entityId: String(vehiculoActualizado._id),
            before,
            after: {
              patente: vehiculoActualizado.patente,
              marca: vehiculoActualizado.marca,
              modelo: vehiculoActualizado.modelo,
              anio: vehiculoActualizado.anio,
              color: vehiculoActualizado.color,
              valorComercial: vehiculoActualizado.valorComercial,
              numeroChasis: vehiculoActualizado.numeroChasis,
              numeroMotor: vehiculoActualizado.numeroMotor,
              tipoVehiculo: vehiculoActualizado.tipoVehiculo,
            },
            metadata: { patente: patenteNormalizada },
          });
        } catch (e) {
          console.error(
            "[actualizarOCrearVehiculo] Error registrando auditoría de actualización de vehículo:",
            e
          );
        }
      }

      return {
        accion: "actualizado" as const,
        vehiculo: vehiculoActualizado,
      };
    }

    const vehiculoCreadoDoc = await Vehiculo.create(datosActualizados);
    const vehiculoCreado = vehiculoCreadoDoc.toObject();

    if (auditCtx) {
      try {
        await Audit.log(auditCtx, {
          action: "vehiculo.create",
          entity: "Vehiculos",
          entityId: String(vehiculoCreadoDoc._id),
          before: null,
          after: {
            patente: vehiculoCreado.patente,
            marca: vehiculoCreado.marca,
            modelo: vehiculoCreado.modelo,
            anio: vehiculoCreado.anio,
            color: vehiculoCreado.color,
            valorComercial: vehiculoCreado.valorComercial,
            numeroChasis: vehiculoCreado.numeroChasis,
            numeroMotor: vehiculoCreado.numeroMotor,
            tipoVehiculo: vehiculoCreado.tipoVehiculo,
          },
          metadata: { patente: patenteNormalizada },
        });
      } catch (e) {
        console.error(
          "[actualizarOCrearVehiculo] Error registrando auditoría de creación de vehículo:",
          e
        );
      }
    }

    return {
      accion: "creado" as const,
      vehiculo: vehiculoCreado,
    };
  } catch (err: any) {
    console.error("Error actualizando/creando vehículo:", err);

    if (auditCtx) {
      try {
        await Audit.log(auditCtx, {
          action: "vehiculo.update.error",
          entity: "Vehiculos",
          entityId: null,
          before: null,
          after: null,
          metadata: {
            error: err.message,
            patente: patenteNormalizada,
            stack: err.stack,
          },
        });
      } catch (e) {
        console.error(
          "[actualizarOCrearVehiculo] Error registrando auditoría de error de vehículo:",
          e
        );
      }
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
