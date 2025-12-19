import e, { Router } from "express";
import { auth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";

// VEHÍCULO
import {
  obtenerDatosPatente,
  actualizarVehiculo,
} from "../controllers/cotizacion/vehiculo.controller";

// ASEGURADO
import { obtenerDatosRut, actualizarAsegurado } from "../controllers/cotizacion/asegurado.controller";


// COTIZACIÓN
import {crearCotizacionInicial,actualizarVehiculoCotizacion,actualizarClienteCotizacion,obtenerCotizacionPorPatente} from "../controllers/cotizacion.controller";


// CONDICIONES
import { guardarCondiciones } from "../controllers/cotizacion/condiciones.controller";

const router = Router();

// --- Vehículo ---
router.get("/vehiculo/:patente", auth, asyncHandler(obtenerDatosPatente));
router.put("/vehiculo", auth, asyncHandler(actualizarVehiculo));

router.get("/asegurado/:rut", auth, asyncHandler(obtenerDatosRut));
router.put("/asegurado", auth, asyncHandler(actualizarAsegurado));

// --- Cotización ---
router.post("/", auth, asyncHandler(crearCotizacionInicial));
router.put("/:idCotizacion/vehiculo", auth, asyncHandler(actualizarVehiculoCotizacion));
router.put("/:idCotizacion/cliente", auth, asyncHandler(actualizarClienteCotizacion));

// -- Condiciones ---
router.put("/:idCotizacion/condiciones", auth, asyncHandler(guardarCondiciones));

// validacion de paso
router.get("/patente/:patente", auth, asyncHandler(obtenerCotizacionPorPatente));


export default router;
