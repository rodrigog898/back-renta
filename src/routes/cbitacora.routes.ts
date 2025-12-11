import { Router } from "express";
import { auth } from '../middleware/auth';
import * as CotizacionController from "../controllers/cbitacora.controller";
import * as CseguimientoController from "../controllers/cseguimiento.controller";
import { asyncHandler } from '../middleware/asyncHandler';
import * as BitacoraKPIController from "../controllers/sbitacorakpi.controller";
import * as AutocompletadoController from "../controllers/autocompletado.controller";
const router = Router();

router.get("/", auth, asyncHandler(CotizacionController.list));


router.get("/seguimiento/:id_cotizacion", auth, asyncHandler(CseguimientoController.list));
router.post("/seguimiento/:id_cotizacion", auth, asyncHandler(CseguimientoController.create));


// Ruta para obtener los KPIs en las card de la bitácora
router.get("/kpiscard", auth, asyncHandler(BitacoraKPIController.getKPIs));


// Ruta para el autocompletado en el search de la bitácora
router.get(
  "/autocompletado",
  auth,
  asyncHandler(AutocompletadoController.buscarAutocompletado)
);

export default router;
