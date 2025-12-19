import { Response } from 'express';
import { AuthedRequest } from '../../middleware/auth';
import { getAuditContext } from '../../middleware/audit';
import { insertarCondicionesService } from '../../services/cotizacion/condiciones.service';
import { AppError } from '../../utils/AppError';


// GUARDAR CONDICIONES EN COTIZACIÓN

export async function guardarCondiciones(
  req: AuthedRequest,
  res: Response
) {
  const { idCotizacion } = req.params;

  if (!idCotizacion) {
    throw new AppError('idCotizacion requerido', 400);
  }

  // OBTENER CONTEXTO DE AUDITORÍA
  const auditCtx = getAuditContext(req);

  // GUARDAR CONDICIONES EN COTIZACIÓN
 
  const condiciones = await insertarCondicionesService(
    idCotizacion,
    req.body,
    auditCtx
  );

  return res.json({
    success: true,
    condiciones
  });
}
