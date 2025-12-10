import { AuthedRequest } from '../middleware/auth';
import Cotizacion from '../models/sBitacora';
import * as Audit from './audit.service';
import { getAuditContext } from '../middleware/audit';
import { Request } from 'express';
import { AppError } from '../utils/AppError';

export async function getCotizacionParaModificar(req: AuthedRequest, cotizacionId: string) {
  const auditCtx = getAuditContext(req as Request);
  
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("User not authenticated", 401);
    }

    let cot;
    try {
      cot = await Cotizacion.findById(cotizacionId).maxTimeMS(5000);
    } catch (dbError: any) {
      await Audit.log(auditCtx, {
        action: 'cotizacion.get.error',
        entity: 'Cotizacion',
        entityId: cotizacionId,
        before: null,
        after: null,
        metadata: { error: dbError.message, operation: 'findById' }
      });
      throw new AppError("Error al buscar cotización", 500);
    }

    if (!cot) {
      await Audit.log(auditCtx, {
        action: 'cotizacion.get.notfound',
        entity: 'Cotizacion',
        entityId: cotizacionId,
        before: null,
        after: null,
        metadata: { userId }
      });
      throw new AppError("Cotización no encontrada", 404);
    }

    if (cot.id_corredor !== userId) {
      await Audit.log(auditCtx, {
        action: 'cotizacion.get.unauthorized',
        entity: 'Cotizacion',
        entityId: cotizacionId,
        before: null,
        after: null,
        metadata: { userId, ownerId: cot.id_corredor }
      });
      throw new AppError("No tienes permiso para editar esta cotización", 403);
    }

    const estadosEmitidos = ["EMITIDA", "FINALIZADA", "CERRADA", "FINALIZADO", "CERRADO", "EMITIDO"];
    if (estadosEmitidos.includes(cot.estado)) {
      await Audit.log(auditCtx, {
        action: 'cotizacion.modify.rejected.estado',
        entity: 'Cotizacion',
        entityId: cotizacionId,
        before: null,
        after: null,
        metadata: { estado: cot.estado, userId }
      });
      throw new AppError("La cotización ya fue emitida y no puede editarse", 400);
    }

    const fecha = new Date(
      cot.fecha_cotizacion.replace(/(\d{2})-(\d{2})-(\d{4})/, "$3-$2-$1")
    );

    const limite = new Date(fecha);
    limite.setDate(limite.getDate() + 15);

    if (new Date() > limite) {
      await Audit.log(auditCtx, {
        action: 'cotizacion.modify.rejected.vigencia',
        entity: 'Cotizacion',
        entityId: cotizacionId,
        before: null,
        after: null,
        metadata: { fechaCotizacion: cot.fecha_cotizacion, limite: limite.toISOString(), userId }
      });
      throw new AppError("La cotización esta fuera de vigencia", 400);
    }

    try {
      await Audit.log(auditCtx, {
        action: 'cotizacion.get.editar',
        entity: 'Cotizacion',
        entityId: cotizacionId,
        before: null,
        after: { id: cot._id, estado: cot.estado, n_cotizacion: cot.n_cotizacion },
        metadata: { userId }
      });
    } catch {}

    return cot;
  } catch (error: any) {
    try {
      await Audit.log(auditCtx, {
        action: 'cotizacion.get.editar.error',
        entity: 'Cotizacion',
        entityId: cotizacionId,
        before: null,
        after: null,
        metadata: { error: error.message, stack: error.stack }
      });
    } catch {}

    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Error al obtener cotización para editar", error.status || 500);
  }
}
