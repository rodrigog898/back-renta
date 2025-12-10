import { obtenerDatosVehiculo, actualizarOCrearVehiculo } from "./sVehiculo.service";
import { AuditContext } from "../middleware/audit";

export async function obtenerInfoCompletaPatente(patente: string) {
  const patenteNormalizada = patente.toUpperCase().trim();
  
  if (!patenteNormalizada) {
    return {
      encontrado: false,
      mostrarFormulario: true,
      mensaje: "No se encontraron datos. Ingreso manual habilitado."
    };
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
    tipo?: string;
    color?: string;
    valor_comercial?: string;
    chasis?: string;
    motor?: string;
    kilometraje?: number;
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
      tipo: resultado.vehiculo.tipo,
      color: resultado.vehiculo.color,
      valor_comercial: resultado.vehiculo.valor_comercial,
      chasis: resultado.vehiculo.chasis,
      motor: resultado.vehiculo.motor,
      kilometraje: resultado.vehiculo.kilometraje || null
    }
  };
}
