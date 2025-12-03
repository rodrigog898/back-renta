// src/routes/Cotizacionbitacora
import { Router } from "express";
import { auth } from '../middleware/auth';
import * as CotizacionController from "../controllers/cbitacora.controller";
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.get("/", auth, asyncHandler(CotizacionController.list));
export default router;
