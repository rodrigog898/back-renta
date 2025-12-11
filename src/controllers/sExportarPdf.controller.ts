import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import * as ExportarPdfService from "../services/exportpdf.service";
import { AppError } from "../utils/AppError";

export async function exportarCotizacionPdf(req: AuthedRequest, res: Response) {
  const { id } = req.params;

  if (!id) {
    throw new AppError("ID de cotización requerido", 400);
  }

  const buffer = await ExportarPdfService.generarPdfCotizacion(req, id);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=cotizacion_${id}.pdf`);
  res.send(buffer);
}

