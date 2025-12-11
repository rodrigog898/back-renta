import axios from "axios";
import Cotizacion from "../models/Cbitacora";
import { AppError } from "../utils/AppError";
import * as Audit from "./audit.service";
import { AuditContext } from "../middleware/audit";

export async function obtenerDatosAsegurado(rut: string) {
  const rutNormalizado = rut.trim().replace(/\./g, '').replace(/-/g, '').toUpperCase();
  const rutConGuion = rutNormalizado.length > 8 
    ? `${rutNormalizado.slice(0, -1)}-${rutNormalizado.slice(-1)}`
    : rutNormalizado;

  try {
    const cotizaciones = await Cotizacion.find({ "cliente.rut_cliente": { $exists: true } }).lean();
    
    let cotizacionBD = cotizaciones.find(cot => {
      if (!cot.cliente || !cot.cliente.rut_cliente) return false;
      const rutBD = String(cot.cliente.rut_cliente).replace(/\./g, '').replace(/-/g, '').toUpperCase();
      return rutBD === rutNormalizado;
    });

    if (cotizacionBD && cotizacionBD.cliente) {
      const cliente = cotizacionBD.cliente;
      return {
        fuente: "bd",
        rut_cliente: rutNormalizado,
        nombre: cliente.nombre,
        apellido: cliente.apellido,
        correo: cliente.correo,
        telefono: cliente.telefono,
        sexo: cliente.sexo,
        fecha_nacimiento: cliente.fecha_nacimiento,
        ciudad: cliente.ciudad,
        comuna: cliente.comuna,
        direccion: cliente.direccion,
        genero: cliente.genero
      };
    }
  } catch (err) {
    console.error("Error consultando BD:", err);
  }

  try {
    const apiUrl = process.env.PERSONAS_API_URL;
    if (!apiUrl) {
      throw new AppError("PERSONAS_API_URL no está configurada.", 500);
    }
    
    let url = apiUrl;
    if (apiUrl.includes('rut=')) {
      url = apiUrl.replace(/rut=[^&]*/, `rut=${rutConGuion}`);
    } else {
      const separator = apiUrl.includes('?') ? '&' : '?';
      url = `${apiUrl}${separator}rut=${rutConGuion}`;
    }
    
    const response = await axios.get(url);

    const api = response.data;

    if (!api || api.success !== true || !api.data) {
      return null;
    }

    const datosApi = api.data;
    const rutApi = datosApi.rut?.trim().replace(/\./g, '').replace(/-/g, '').toUpperCase();

    if (rutApi !== rutNormalizado) {
      return null;
    }

    return {
      fuente: "api",
      rut_cliente: rutNormalizado,
      nombre: datosApi.nombre,
      apellido: datosApi.apellido,
      correo: datosApi.email || datosApi.correo,
      telefono: datosApi.telefono,
      sexo: datosApi.sexo || (datosApi.genero === 'Masculino' ? 'M' : datosApi.genero === 'Femenino' ? 'F' : ''),
      fecha_nacimiento: datosApi.fecha_nacimiento || datosApi.fechaNacimiento || '',
      ciudad: datosApi.ciudad,
      comuna: datosApi.comuna,
      direccion: datosApi.direccion,
      genero: datosApi.genero
    };

  } catch (err) {
  }

  return null;
}

export async function actualizarOCrearAsegurado(
  datosAsegurado: {
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
  },
  auditCtx?: AuditContext
) {
  const rutNormalizado = datosAsegurado.rut_cliente.trim().replace(/\./g, '').replace(/-/g, '').toUpperCase();

  try {
    const cotizaciones = await Cotizacion.find({ "cliente.rut_cliente": { $exists: true } }).lean();
    
    const cotizacionExistente = cotizaciones.find(cot => {
      if (!cot.cliente || !cot.cliente.rut_cliente) return false;
      const rutBD = String(cot.cliente.rut_cliente).replace(/\./g, '').replace(/-/g, '').toUpperCase();
      return rutBD === rutNormalizado;
    });

    const datosActualizados = {
      rut_cliente: rutNormalizado,
      nombre: datosAsegurado.nombre,
      apellido: datosAsegurado.apellido,
      correo: datosAsegurado.correo,
      telefono: datosAsegurado.telefono,
      sexo: datosAsegurado.sexo,
      fecha_nacimiento: datosAsegurado.fecha_nacimiento,
      ciudad: datosAsegurado.ciudad,
      comuna: datosAsegurado.comuna,
      direccion: datosAsegurado.direccion,
      genero: datosAsegurado.genero
    };

    if (cotizacionExistente && cotizacionExistente.cliente) {
      const before = {
        rut_cliente: cotizacionExistente.cliente.rut_cliente,
        nombre: cotizacionExistente.cliente.nombre,
        apellido: cotizacionExistente.cliente.apellido,
        correo: cotizacionExistente.cliente.correo
      };

      const cotizacionActualizada = await Cotizacion.findByIdAndUpdate(
        cotizacionExistente._id,
        { $set: { cliente: datosActualizados } },
        { new: true, runValidators: true }
      ).lean();

      if (!cotizacionActualizada || !cotizacionActualizada.cliente) {
        throw new AppError("Error al actualizar el asegurado en la base de datos", 500);
      }

      if (auditCtx) {
        try {
          await Audit.log(auditCtx, {
            action: 'asegurado.update',
            entity: 'Cotizacion',
            entityId: String(cotizacionActualizada._id),
            before,
            after: {
              rut_cliente: cotizacionActualizada.cliente.rut_cliente,
              nombre: cotizacionActualizada.cliente.nombre,
              apellido: cotizacionActualizada.cliente.apellido,
              correo: cotizacionActualizada.cliente.correo
            },
            metadata: { rut: rutNormalizado }
          });
        } catch {}
      }

      return {
        accion: "actualizado",
        asegurado: cotizacionActualizada.cliente
      };
    } else {
      return {
        accion: "no_encontrado",
        asegurado: datosActualizados
      };
    }
  } catch (err: any) {
    console.error("Error actualizando/creando asegurado:", err);
    
    if (auditCtx) {
      try {
        await Audit.log(auditCtx, {
          action: 'asegurado.update.error',
          entity: 'Cotizacion',
          entityId: null,
          before: null,
          after: null,
          metadata: { 
            error: err.message, 
            rut: rutNormalizado,
            stack: err.stack 
          }
        });
      } catch {}
    }
    
    if (err instanceof AppError) {
      throw err;
    }
    
    throw new AppError(
      err.message || "Error al guardar el asegurado en la base de datos",
      500
    );
  }
}

