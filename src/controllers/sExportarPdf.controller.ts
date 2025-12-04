import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import * as ExportarPdfService from "../services/sExportarPdf.service";

export async function exportarCotizacionPdf(req: AuthedRequest, res: Response) {
  const { id } = req.params;

  if (!id) {
    const err: any = new Error("ID de cotización requerido");
    err.status = 400;
    throw err;
  }

  const buffer = await ExportarPdfService.generarPdfCotizacion(req, id);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=cotizacion_${id}.pdf`);
  res.send(buffer);
}

