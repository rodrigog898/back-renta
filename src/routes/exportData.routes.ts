import { Router } from "express";
import { auth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import * as ExportarPdfController from "../controllers/sExportarPdf.controller";
import * as ExportarController from "../controllers/sExportarExcel.controller";

const router = Router();

router.get(
  "/:id/export-pdf",
  auth,
  asyncHandler(ExportarPdfController.exportarCotizacionPdf)
);


router.get(
  "/export-excel",
  auth,
  asyncHandler(ExportarController.exportarBitacora)
);

export default router;
