import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import * as AutocompletadoService from "../services/autocompletado.service";

export async function buscarAutocompletado(req: AuthedRequest, res: Response) {
  const resultados = await AutocompletadoService.buscarAutocompletado(req);
  res.json(resultados);
}

