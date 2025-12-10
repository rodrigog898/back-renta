import { Router } from "express";
import { auth } from "../middleware/auth";
import * as ModificarCotizacionController from "../controllers/sModificarCotizacion.controller";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();

router.get(
  "/editar-cotizacion/:id",
  auth,
  asyncHandler(ModificarCotizacionController.getCotizacionParaModificar)
);

export default router;
