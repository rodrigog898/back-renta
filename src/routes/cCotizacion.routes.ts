import { Router } from "express";
import { auth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { obtenerDatosPatente, actualizarVehiculo } from "../controllers/sCotizacion.controller";

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

export default router;
