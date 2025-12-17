import { obtenerDatosAsegurado, actualizarOCrearAsegurado } from "../asegurado.service";
import { AuditContext } from "../../middleware/audit";
import { AppError } from "../../utils/AppError";

export async function obtenerInfoCompletaRut(rut: string) {
  const rutNormalizado = rut
    .trim()
    .replace(/\./g, "")
    .replace(/-/g, "")
    .toUpperCase();

  if (!rutNormalizado) {
    return {
      encontrado: false,
      mostrarFormulario: true,
      mensaje: "No se encontraron datos. Ingreso manual habilitado.",
    };
  }

  const asegurado = await obtenerDatosAsegurado(rutNormalizado);

  if (!asegurado) {
    return {
      encontrado: false,
      mostrarFormulario: true,
      mensaje: "No se encontraron datos. Ingreso manual habilitado.",
    };
  }

  return {
    encontrado: true,
    mostrarFormulario: false,
    asegurado,
    vigencia: null,
  };
}

export async function actualizarAseguradoService(
  datosAsegurado: {
    rut_cliente?: string;
    rut?: string;
    nombre: string;
    apellido: string;
    correo: string;
    telefono: string;
    sexo?: string;
    genero?: string;
    fecha_nacimiento?: string;
    ciudad?: string;
    comuna?: string;
    direccion?: string;
  },
  auditCtx?: AuditContext
) {
  const rutFinal = datosAsegurado.rut_cliente || datosAsegurado.rut || "";
  const rutNormalizado = rutFinal
    .trim()
    .replace(/\./g, "")
    .replace(/-/g, "")
    .toUpperCase();

  if (!rutNormalizado) {
    throw new AppError("El RUT es obligatorio.", 400);
  }

  const datosParaBD = {
    rut_cliente: rutNormalizado,
    nombre: datosAsegurado.nombre,
    apellido: datosAsegurado.apellido,
    correo: datosAsegurado.correo,
    telefono: datosAsegurado.telefono,
    sexo: datosAsegurado.sexo || datosAsegurado.genero || "",
    fecha_nacimiento: datosAsegurado.fecha_nacimiento || "",
    ciudad: datosAsegurado.ciudad || "",
    comuna: datosAsegurado.comuna || "",
    direccion: datosAsegurado.direccion || "",
    genero: datosAsegurado.genero,
  };

  const resultado = await actualizarOCrearAsegurado(datosParaBD, auditCtx);

  return {
    success: true,
    accion: resultado.accion,
    mensaje:
      resultado.accion === "actualizado"
        ? "Asegurado actualizado exitosamente"
        : "Asegurado creado exitosamente",
    asegurado: {
      rut_cliente: resultado.asegurado.rut_cliente,
      nombre: resultado.asegurado.nombre,
      apellido: resultado.asegurado.apellido,
      correo: resultado.asegurado.correo,
      telefono: resultado.asegurado.telefono,
      sexo: resultado.asegurado.sexo,
      fecha_nacimiento: resultado.asegurado.fecha_nacimiento,
      ciudad: resultado.asegurado.ciudad,
      comuna: resultado.asegurado.comuna,
      direccion: resultado.asegurado.direccion,
      genero: resultado.asegurado.genero,
    },
  };
}
