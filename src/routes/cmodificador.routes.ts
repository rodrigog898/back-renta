import { Router } from "express";
import { auth } from "../middleware/auth";
import * as ModificadorController from "../controllers/sModificador.controller";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();

router.get(
  "/:id/modificar",
  auth,
  asyncHandler(ModificadorController.getCotizacionParaModificar)
);

export default router;
