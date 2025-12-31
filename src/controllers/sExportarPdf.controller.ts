import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import { AppError } from "../utils/AppError";
import * as ExportPdfService from "../services/exportpdf.service";


export async function exportarCotizacionPdf(req: AuthedRequest, res: Response) {
  try {
    const { id } = req.params;
    if (!id) throw new AppError("ID de cotización requerido", 400);

    const buffer = await ExportPdfService.generarPdfCotizacion(req, id);
    if (!buffer || buffer.length === 0) throw new AppError("PDF generado vacío", 500);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="cotizacion-${id}.pdf"`);

   
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    res.setHeader("Content-Length", buffer.length);
    return res.status(200).send(buffer);
  } catch (error: any) {
    console.error("Error en exportarCotizacionPdf:", error);

    const status = error?.statusCode ?? error?.status ?? 500;
    const message =
      error instanceof AppError ? error.message : "Error al visualizar PDF de cotización";

    return res.status(status).json({ success: false, error: message });
  }
}
