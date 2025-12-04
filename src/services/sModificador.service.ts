import { AuthedRequest } from '../middleware/auth';
import Cotizacion from '../models/sBitacora';
import * as Audit from './audit.service';
import { getAuditContext } from '../middleware/audit';
import { Request } from 'express';

export async function getCotizacionParaModificar(req: AuthedRequest, cotizacionId: string) {
  const auditCtx = getAuditContext(req as Request);
  
  try {
    const userId = req.user?.id;
    if (!userId) {
      const err: any = new Error("User not authenticated");
      err.status = 401;
      throw err;
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
      const err: any = new Error("Error al buscar cotización");
      err.status = 500;
      throw err;
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
      const err: any = new Error("Cotización no encontrada");
      err.status = 404;
      throw err;
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
      const err: any = new Error("No tienes permiso para modificar esta cotización");
      err.status = 403;
      throw err;
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
      const err: any = new Error("La cotización ya fue emitida y no puede modificarse");
      err.status = 400;
      throw err;
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
      const err: any = new Error("La cotización esta fuera de vigencia");
      err.status = 400;
      throw err;
    }

    // Log de éxito
    try {
      await Audit.log(auditCtx, {
        action: 'cotizacion.get.modificar',
        entity: 'Cotizacion',
        entityId: cotizacionId,
        before: null,
        after: { id: cot._id, estado: cot.estado, n_cotizacion: cot.n_cotizacion },
        metadata: { userId }
      });
    } catch {}

    return cot;
  } catch (error: any) {
    // Log de error general
    try {
      await Audit.log(auditCtx, {
        action: 'cotizacion.get.modificar.error',
        entity: 'Cotizacion',
        entityId: cotizacionId,
        before: null,
        after: null,
        metadata: { error: error.message, stack: error.stack }
      });
    } catch {}

    const err: any = error.status ? error : new Error("Error al obtener cotización para modificar");
    err.status = error.status || 500;
    throw err;
  }
}
