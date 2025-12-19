import { AppError } from '../../utils/AppError';
import Cotizacion from '../../models/Cbitacora';
import * as Audit from '../audit.service';
import { AuditContext } from '../../middleware/audit';

// GUARDAR CONDICIONES EN COTIZACIÓN
export async function insertarCondicionesService(
  id_cotizacion: string,
  datosCondiciones: {
    comentario?: string;
    tags?: string[];
  },
  auditCtx?: AuditContext
) {
  if (!id_cotizacion) {
    throw new AppError('id_cotizacion requerido', 400);
  }


  // NORMALIZAR Y VALIDAR DATOS
  const datos = {
    comentario:
      typeof datosCondiciones.comentario === 'string'
        ? datosCondiciones.comentario.trim()
        : '',
    tags: Array.isArray(datosCondiciones.tags)
      ? datosCondiciones.tags.map(t => t.trim()).filter(t => t.length > 0)
      : []
  };


  // VERIFICAR QUE LA COTIZACIÓN EXISTA 
  const cotizacionAntes = await Cotizacion.findById(id_cotizacion).lean();
  if (!cotizacionAntes) {
    throw new AppError('Cotización no encontrada', 404);
  }


  // ACTUALIZAR CONDICIONES EN EL DOCUMENTO DE COTIZACIÓN 
  const cotizacionActualizada = await Cotizacion.findByIdAndUpdate(
    id_cotizacion,
    { $set: { condiciones: datos } },
    { new: true, lean: true }
  );

  if (!cotizacionActualizada || !cotizacionActualizada.condiciones) {
    throw new AppError('No se pudieron guardar las condiciones', 500);
  }
  // REGISTRAR AUDITORÍA
  if (auditCtx) {
    try {
      await Audit.log(auditCtx, {
        action: 'condiciones.insertar',
        entity: 'Cotizacion',
        entityId: id_cotizacion,
        before: cotizacionAntes.condiciones || null,
        after: cotizacionActualizada.condiciones,
        metadata: { id_cotizacion }
      });
    } catch (e) {
      console.error('[insertarCondicionesService] Audit error:', e);
    }
  }

  return cotizacionActualizada.condiciones;
}
