import { Router } from "express";
import { auth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import * as ExportarController from "../controllers/sExportarExcel.controller";

const router = Router();

router.get(
  "/exportar-excel",
  auth,
  asyncHandler(ExportarController.exportarBitacora)
);

export default router;
