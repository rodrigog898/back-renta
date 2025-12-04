import { Router } from "express";
import { auth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import * as AutocompletadoController from "../controllers/sAutocompletado.controller";

const router = Router();

router.get(
  "/autocompletado",
  auth,
  asyncHandler(AutocompletadoController.buscarAutocompletado)
);

export default router;

