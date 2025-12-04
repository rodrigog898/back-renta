import { Router } from "express";
import { auth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import * as ExportarPdfController from "../controllers/sExportarPdf.controller";

const router = Router();

router.get(
  "/:id/exportar-pdf",
  auth,
  asyncHandler(ExportarPdfController.exportarCotizacionPdf)
);

export default router;
