import { Router } from "express";
import { auth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { obtenerDatosPatente, actualizarVehiculo, obtenerDatosRut, actualizarAsegurado } from "../controllers/sCotizacion.controller";

const router = Router();

router.get(
  "/nueva-cotizacion/vehiculo/:patente",
  auth,
  asyncHandler(obtenerDatosPatente)
);

router.put(
  "/nueva-cotizacion/vehiculo",
  auth,
  asyncHandler(actualizarVehiculo)
);

router.get(
  "/nueva-cotizacion/asegurado/:rut",
  auth,
  asyncHandler(obtenerDatosRut)
);

router.put(
  "/nueva-cotizacion/asegurado",
  auth,
  asyncHandler(actualizarAsegurado)
);

export default router;
