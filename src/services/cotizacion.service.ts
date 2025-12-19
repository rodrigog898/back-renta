import { obtenerDatosVehiculo, actualizarOCrearVehiculo } from "./datavehiculo.service";
import { obtenerDatosAsegurado, actualizarOCrearAsegurado } from "./asegurado.service";
import {existeCotizacionVigente,obtenerCotizacionVigente} from "./cotizacion/caducarCotizaciones.service";

import { AuditContext } from "../middleware/audit";
import Cotizacion from "../models/Cbitacora";
import { AppError } from "../utils/AppError";
import * as Audit from "./audit.service";

export async function obtenerInfoCompletaPatente(patente: string) {
  const patenteNormalizada = patente.toUpperCase().trim();
  console.log("Patente normalizada:", patenteNormalizada);
  if (!patenteNormalizada) {
    return {
      encontrado: false,
      mostrarFormulario: true,
      mensaje: "No se encontraron datos. Ingreso manual habilitado."
    };
  }
      // VALIDACIÓN: verificar si existe una cotización vigente para esta patente
  const existeVigente = await existeCotizacionVigente(patenteNormalizada);
  
  if (existeVigente) {
    const cotizacionExistente = await obtenerCotizacionVigente(patenteNormalizada);
    
    if (cotizacionExistente) {
      throw new AppError(
        `Tu cotización está en proceso aún, por favor intenta con otra patente. (Cotización #${cotizacionExistente.n_cotizacion})`,
        409
      );
    }
  }

  const vehiculo = await obtenerDatosVehiculo(patenteNormalizada);

  if (!vehiculo) {
    return {
      encontrado: false,
      mostrarFormulario: true,
      mensaje: "No se encontraron datos. Ingreso manual habilitado."
    };
  }

  return {
    encontrado: true,
    mostrarFormulario: false,
    vehiculo,
    vigencia: null
  };
}

export async function actualizarVehiculoService(
  datosVehiculo: {
    patente: string;
    marca: string;
    modelo: string;
    anio: number;
    tipoVehiculo?: string;
    color?: string;
    valorComercial?: string;
    numeroChasis?: string;
    numeroMotor?: string;
  },
  auditCtx?: AuditContext
) {
  const resultado = await actualizarOCrearVehiculo(datosVehiculo, auditCtx);

  return {
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
      tipoVehiculo: resultado.vehiculo.tipoVehiculo,
      color: resultado.vehiculo.color,
      valorComercial: resultado.vehiculo.valorComercial,
      numeroChasis: resultado.vehiculo.numeroChasis,
      numeroMotor: resultado.vehiculo.numeroMotor,
    }
  };
}

export async function obtenerInfoCompletaRut(rut: string) {
  const rutNormalizado = rut.trim().replace(/\./g, '').replace(/-/g, '').toUpperCase();

  if (!rutNormalizado) {
    return {
      encontrado: false,
      mostrarFormulario: true,
      mensaje: "No se encontraron datos. Ingreso manual habilitado."
    };
  }

  const asegurado = await obtenerDatosAsegurado(rutNormalizado);

  if (!asegurado) {
    return {
      encontrado: false,
      mostrarFormulario: true,
      mensaje: "No se encontraron datos. Ingreso manual habilitado."
    };
  }

  return {
    encontrado: true,
    mostrarFormulario: false,
    asegurado,
    vigencia: null
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
  const rutNormalizado = rutFinal.trim().replace(/\./g, '').replace(/-/g, '').toUpperCase();

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
    mensaje: resultado.accion === "actualizado"
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
    }
  };
}

export async function actualizarVehiculoEnCotizacionService(
  datos: {
    id_cotizacion: string;
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
  if (!datos.id_cotizacion) {
    throw new AppError("Debe enviar id_cotizacion.", 400);
  }

  const before = await Cotizacion.findById(datos.id_cotizacion).lean();

  let vehiculoBD: any = null;
  const tieneNA =
    datos.color === "N/A" ||
    datos.valorComercial === "N/A" ||
    datos.numeroChasis === "N/A" ||
    datos.numeroMotor === "N/A" ||
    datos.tipoVehiculo === "N/A";

  if (tieneNA) {
    try {
      vehiculoBD = await obtenerDatosVehiculo(datos.patente);
    } catch (e) {
      console.error("[actualizarVehiculoEnCotizacionService] Error buscando vehículo en BD:", e);
    }
  }

  const obtenerValorReal = (valor: string | undefined, campoBD: string): string | undefined => {
    if (!valor || valor.trim() === "" || valor.toUpperCase() === "N/A") {
      if (vehiculoBD && vehiculoBD[campoBD]) {
        return vehiculoBD[campoBD];
      }
      return undefined; 
    }
    return valor; 
  };

  const vehiculoCompleto: any = {
    patente: datos.patente,
    marca: datos.marca,
    modelo: datos.modelo,
    anio: datos.anio,
  };

  const colorReal = obtenerValorReal(datos.color, "color");
  if (colorReal !== undefined) {
    vehiculoCompleto.color = colorReal;
  }

  const valorComercialReal = obtenerValorReal(datos.valorComercial, "valorComercial");
  if (valorComercialReal !== undefined) {
    vehiculoCompleto.valorComercial = valorComercialReal;
  }

  const numeroChasisReal = obtenerValorReal(datos.numeroChasis, "numeroChasis");
  if (numeroChasisReal !== undefined) {
    vehiculoCompleto.numeroChasis = numeroChasisReal;
  }

  const numeroMotorReal = obtenerValorReal(datos.numeroMotor, "numeroMotor");
  if (numeroMotorReal !== undefined) {
    vehiculoCompleto.numeroMotor = numeroMotorReal;
  }

  const tipoVehiculoReal = obtenerValorReal(datos.tipoVehiculo, "tipoVehiculo");
  if (tipoVehiculoReal !== undefined) {
    vehiculoCompleto.tipoVehiculo = tipoVehiculoReal;
  }

  delete vehiculoCompleto._id;
  delete vehiculoCompleto.id;

  const cotizacionActualizada = await Cotizacion.findByIdAndUpdate(
    datos.id_cotizacion,
    {
      $set: { vehiculo: vehiculoCompleto },
      $unset: {
        "vehiculo._id": "",
        "vehiculo.id": ""
      }
    },
    { new: true, lean: true }
  );

  if (!cotizacionActualizada) {
    throw new AppError("No se encontró la cotización a actualizar.", 404);
  }

  if (auditCtx) {
    try {
      await Audit.log(auditCtx, {
        action: "cotizacion.vehiculo.update",
        entity: "Cotizacion",
        entityId: String(cotizacionActualizada._id),
        before: before?.vehiculo ?? null,
        after: cotizacionActualizada.vehiculo ?? null,
        metadata: {
          id_cotizacion: datos.id_cotizacion,
          patente: datos.patente,
        },
      });
    } catch (e) {
      console.error(
        "[actualizarVehiculoEnCotizacionService] Error registrando auditoría:",
        e
      );
    }
  }

  return {
    success: true,
    mensaje: "Vehículo asociado a la cotización correctamente",
    cotizacion: cotizacionActualizada,
  };
}


export async function actualizarCotizacionClienteService(
  idCotizacion: string,
  datosCliente: {
    rut_cliente?: string;
    rut?: string;
    nombre?: string;
    apellido?: string;
    correo?: string;
    telefono?: string;
    sexo?: string;
    genero?: string;
    fecha_nacimiento?: string;
    ciudad?: string;
    comuna?: string;
    direccion?: string;
  },
  auditCtx?: AuditContext
) {
  if (!idCotizacion) {
    throw new AppError("Falta id de la cotización.", 400);
  }

  const cotizacionAntes = await Cotizacion.findById(idCotizacion).lean();
  if (!cotizacionAntes) {
    throw new AppError("Cotización no encontrada.", 404);
  }
    
    

  const rutNormalizado = normalizarRut(datosCliente.rut_cliente || datosCliente.rut || "");
  if (!rutNormalizado) {
    throw new AppError("El RUT es obligatorio.", 400);
  }

  const clienteActualizado = {
    rut_cliente: rutNormalizado,
    nombre: (datosCliente.nombre ?? cotizacionAntes.cliente?.nombre ?? "-").toString(),
    apellido: (datosCliente.apellido ?? cotizacionAntes.cliente?.apellido ?? "-").toString(),
    correo: (datosCliente.correo ?? cotizacionAntes.cliente?.correo ?? "-").toString(),
    telefono: (datosCliente.telefono ?? cotizacionAntes.cliente?.telefono ?? "-").toString(),
    sexo: ((datosCliente.sexo ?? datosCliente.genero) ?? cotizacionAntes.cliente?.sexo ?? "-").toString(),
    fecha_nacimiento: (datosCliente.fecha_nacimiento ?? cotizacionAntes.cliente?.fecha_nacimiento ?? "01-01-1900").toString(),
    ciudad: (datosCliente.ciudad ?? cotizacionAntes.cliente?.ciudad ?? "").toString(),
    comuna: (datosCliente.comuna ?? cotizacionAntes.cliente?.comuna ?? "").toString(),
    direccion: (datosCliente.direccion ?? cotizacionAntes.cliente?.direccion ?? "").toString(),
    genero: (datosCliente.genero ?? cotizacionAntes.cliente?.genero ?? "").toString(),
  };

  const cotizacionActualizada = await Cotizacion.findByIdAndUpdate(
    idCotizacion,
    { $set: { cliente: clienteActualizado } },
    { new: true, runValidators: true }
  ).lean();

  if (!cotizacionActualizada) {
    throw new AppError("No se pudo actualizar la cotización.", 500);
  }

  if (auditCtx) {
    try {
      await Audit.log(auditCtx, {
        action: "cotizacion.update.cliente",
        entity: "Cotizacion",
        entityId: String(idCotizacion),
        before: cotizacionAntes?.cliente ?? null,
        after: cotizacionActualizada?.cliente ?? null,
        metadata: {
          n_cotizacion: cotizacionAntes.n_cotizacion,
          paso: "cliente",
          rut: rutNormalizado,
        },
      });
    } catch (e) {
      console.error("[actualizarCotizacionClienteService] Error registrando auditoría:", e);
    }
  }

  return cotizacionActualizada;
}

export async function crearCotizacionInicialService(
  idCorredor: string,
  auditCtx?: AuditContext
) {
  if (!idCorredor) {
    throw new AppError("Falta id_corredor para crear la cotización.", 400)
  }

  const ultima = await Cotizacion.findOne().sort({ n_cotizacion: -1 }).lean()
  const siguienteNumero = ultima ? (ultima.n_cotizacion || 1000) + 1 : 1001

  const fecha = formatearFechaActual()


  const doc = await Cotizacion.create({
    n_cotizacion: siguienteNumero,
    fecha_cotizacion: fecha,
    id_corredor: idCorredor,

    cliente: {
      rut_cliente: "-",
      nombre: "-",
      apellido: "-",
      correo: "-",
      telefono: "-",
      sexo: "-",
      fecha_nacimiento: "01-01-1900",
      ciudad: "",
      comuna: "",
      direccion: "",
      genero: ""
    },

    vehiculo: {
      patente: "-",
      marca: "-",
      modelo: "-",
      anio: 1900,
      color: "",
      valorComercial: "",
      numeroChasis: "",
      numeroMotor: "",
      tipoVehiculo: ""
    },

    producto: {
      t_producto: "Pendiente",
      deducible: 0
    },

    prima: 0,
    comision: 0,
    prob_cierre: 0,
    estado: "EN_PROCESO"
  })

  const cotizacion = doc.toObject()

  if (auditCtx) {
    try {
      await Audit.log(auditCtx, {
        action: "cotizacion.create",
        entity: "Cotizacion",
        entityId: String(doc._id),
        before: null,
        after: cotizacion,
        metadata: {
          n_cotizacion: siguienteNumero,
          id_corredor: idCorredor
        }
      })
    } catch (e) {
      console.error("[crearCotizacionInicialService] Error registrando auditoría:", e)
    }
  }

  return cotizacion
}


export async function actualizarCotizacionVehiculoService(
  idCotizacion: string,
  datosVehiculo: {
    patente?: string
    marca?: string
    modelo?: string
    anio?: number
    color?: string
    valor_comercial?: string
    valorComercial?: string
    chasis?: string
    numeroChasis?: string
    motor?: string
    numeroMotor?: string
    tipo?: string
    tipoVehiculo?: string
  },
  auditCtx?: AuditContext
) {
  if (!idCotizacion) {
    throw new AppError("Falta id de la cotización.", 400)
  }

  const cotizacionAntes = await Cotizacion.findById(idCotizacion).lean()

  if (!cotizacionAntes) {
    throw new AppError("Cotización no encontrada.", 404)
  }
    


  const vehiculoActualizado = {
    patente: datosVehiculo.patente || cotizacionAntes.vehiculo?.patente || "-",
    marca: datosVehiculo.marca || cotizacionAntes.vehiculo?.marca || "-",
    modelo: datosVehiculo.modelo || cotizacionAntes.vehiculo?.modelo || "-",
    anio: datosVehiculo.anio || cotizacionAntes.vehiculo?.anio || 1900,
    color: datosVehiculo.color || cotizacionAntes.vehiculo?.color || "",
    valorComercial: datosVehiculo.valor_comercial || datosVehiculo.valorComercial || cotizacionAntes.vehiculo?.valorComercial || "",
    numeroChasis: datosVehiculo.chasis || datosVehiculo.numeroChasis || cotizacionAntes.vehiculo?.numeroChasis || "",
    numeroMotor: datosVehiculo.motor || datosVehiculo.numeroMotor || cotizacionAntes.vehiculo?.numeroMotor || "",
    tipoVehiculo: datosVehiculo.tipo || datosVehiculo.tipoVehiculo || cotizacionAntes.vehiculo?.tipoVehiculo || ""
  }

  const cotizacionActualizada = await Cotizacion.findByIdAndUpdate(
    idCotizacion,
    { $set: { vehiculo: vehiculoActualizado } },
    { new: true, runValidators: true }
  ).lean()

  if (auditCtx) {
    try {
      await Audit.log(auditCtx, {
        action: "cotizacion.update.vehiculo",
        entity: "Cotizacion",
        entityId: idCotizacion,
        before: { vehiculo: cotizacionAntes.vehiculo },
        after: { vehiculo: vehiculoActualizado },
        metadata: {
          n_cotizacion: cotizacionAntes.n_cotizacion,
          paso: "vehiculo"
        }
      })
    } catch (e) {
      console.error("[actualizarCotizacionVehiculoService] Error registrando auditoría:", e)
    }
  }

  return cotizacionActualizada
}


// Obtener cotización completa por ID, para luego de cliquear en el modal redirija a el paso que quedo.
export async function obtenerCotizacionCompletaPorId(idCotizacion: string) {
  if (!idCotizacion) {
    throw new AppError("Falta id de la cotización.", 400);
  }

  const cotizacion = await Cotizacion.findById(idCotizacion).lean();

  if (!cotizacion) {
    throw new AppError("Cotización no encontrada.", 404);
  }

  return cotizacion;
}

// Obtener cotización completa por patente
export async function obtenerCotizacionCompletaPorPatente(patente: string) {
  const patenteNormalizada = patente.toUpperCase().trim();

  if (!patenteNormalizada) {
    throw new AppError("La patente es obligatoria.", 400);
  }

  const cotizacion = await Cotizacion.findOne({
    'vehiculo.patente': patenteNormalizada,
    estado: { $nin: ['CADUCADA'] }
  }).lean();

  if (!cotizacion) {
    throw new AppError("No se encontró una cotización vigente para esta patente.", 404);
  }

  return cotizacion;
}

// Determinar el paso actual de una cotización basado en sus datos
export function determinarPasoActual(cotizacion: any): number {
  if (!cotizacion) {
    return 1;
  }

  // Paso 1: Vehículo - verificar si tiene datos válidos (no "-" o vacío)
  const tieneVehiculo = cotizacion.vehiculo && 
    cotizacion.vehiculo.patente && 
    cotizacion.vehiculo.patente !== "-" &&
    cotizacion.vehiculo.marca &&
    cotizacion.vehiculo.marca !== "-";

  if (!tieneVehiculo) {
    return 1;
  }

  // Paso 2: Asegurado - verificar si tiene datos válidos (no "-" o vacío)
  const tieneAsegurado = cotizacion.cliente && 
    cotizacion.cliente.rut_cliente && 
    cotizacion.cliente.rut_cliente !== "-" &&
    cotizacion.cliente.nombre &&
    cotizacion.cliente.nombre !== "-" &&
    cotizacion.cliente.correo &&
    cotizacion.cliente.correo !== "-";

  if (!tieneAsegurado) {
    return 2;
  }

  // Paso 3: Requisitos - verificar si tiene condiciones
  const tieneCondiciones = cotizacion.condiciones && (
    (cotizacion.condiciones.comentario && cotizacion.condiciones.comentario.trim() !== "") ||
    (cotizacion.condiciones.tags && cotizacion.condiciones.tags.length > 0)
  );

  if (!tieneCondiciones) {
    return 3;
  }

  // Paso 4: Productos - verificar si tiene producto configurado
  const tieneProducto = cotizacion.producto && 
    cotizacion.producto.t_producto && 
    cotizacion.producto.t_producto !== "Pendiente";

  if (!tieneProducto) {
    return 4;
  }

  // Si tiene todo, está en el paso 4 (último paso)
  return 4;
}


function formatearFechaActual(): string {
  const hoy = new Date()
  const dia = String(hoy.getDate()).padStart(2, '0')
  const mes = String(hoy.getMonth() + 1).padStart(2, '0')
  const anio = hoy.getFullYear()
  const hora = String(hoy.getHours()).padStart(2, '0')
  const minutos = String(hoy.getMinutes()).padStart(2, '0')
  const segundos = String(hoy.getSeconds()).padStart(2, '0')
  return `${dia}-${mes}-${anio} ${hora}:${minutos}:${segundos}`
}


function normalizarRut(value: string): string {
  return (value || "").trim().replace(/\./g, "").replace(/-/g, "").toUpperCase();
}
