import { obtenerDatosVehiculo } from "./sVehiculo.service";

export async function obtenerInfoCompletaPatente(patente: string) {
  const vehiculo = await obtenerDatosVehiculo(patente);

  if (!vehiculo) {
    return null;
  }

  return {
    patente: patente.toUpperCase(),
    vehiculo,
    vigencia: null
  };
}
