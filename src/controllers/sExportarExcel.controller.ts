import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import * as ExportarExcelService from "../services/sExportarExcel.service";

export async function exportarBitacora(req: AuthedRequest, res: Response) {
  const buffer = await ExportarExcelService.exportarBitacora(req);

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=bitacora.xlsx"
  );

  res.send(buffer);
}
