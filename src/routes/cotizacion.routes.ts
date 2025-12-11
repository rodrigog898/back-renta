import { Router } from "express";
import { auth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { obtenerDatosPatente, actualizarVehiculo, obtenerDatosRut, actualizarAsegurado } from "../controllers/cotizacion.controller";

const router = Router();

router.get(
  "/vehiculo/:patente",
  auth,
  asyncHandler(obtenerDatosPatente)
);

router.put(
  "/vehiculo",
  auth,
  asyncHandler(actualizarVehiculo)
);

router.get(
  "/asegurado/:rut",
  auth,
  asyncHandler(obtenerDatosRut)
);

router.put(
  "/asegurado",
  auth,
  asyncHandler(actualizarAsegurado)
);

export default router;
