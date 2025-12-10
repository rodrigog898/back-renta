import { Router } from "express";
import { auth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import * as BitacoraController from "../controllers/sBitacora.controller";

const router = Router();

router.get("/bitacora", auth, asyncHandler(BitacoraController.listarBitacora));

export default router;
