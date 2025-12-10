import { Router } from "express";
import { auth } from '../middleware/auth';
import * as CotizacionController from "../controllers/cbitacora.controller";
import * as CseguimientoController from "../controllers/cseguimiento.controller";
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.get("/", auth, asyncHandler(CotizacionController.list));
router.get("/seguimiento/:id_cotizacion", auth, asyncHandler(CseguimientoController.list));
router.post("/seguimiento/:id_cotizacion", auth, asyncHandler(CseguimientoController.create));




export default router;
