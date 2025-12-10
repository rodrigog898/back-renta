import { obtenerDatosVehiculo } from "./sVehiculo.service";
// import { validarSeguroVigente } from "./sSeguroVigente.service"; // cuando me la apsen agregar 

export async function obtenerInfoCompletaPatente(patente: string) {
  const vehiculo = await obtenerDatosVehiculo(patente);

  if (!vehiculo) {
    return null;
  }

  // const vigencia = await validarSeguroVigente(patente); pendiente

  return {
    patente: patente.toUpperCase(),
    vehiculo,
    vigencia: null // temporal
  };
}
