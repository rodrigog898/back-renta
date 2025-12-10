import { Response } from 'express';
import { AuthedRequest } from '../middleware/auth';
import * as ModificadorService from '../services/sModificador.service';

export async function getCotizacionParaModificar(req: AuthedRequest, res: Response) {
  const { id } = req.params;
  const cotizacion = await ModificadorService.getCotizacionParaModificar(req, id);
  res.json(cotizacion);
}

