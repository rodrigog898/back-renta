import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import * as BitacoraService from "../services/sBitacora.service";

export async function listarBitacora(req: AuthedRequest, res: Response) {
  const resultado = await BitacoraService.listarBitacora(req);
  res.json(resultado);
}
