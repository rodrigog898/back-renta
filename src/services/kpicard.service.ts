import { AuthedRequest } from '../middleware/auth';
import Cotizacion from '../models/Cbitacora';
import * as Audit from './audit.service';
import { getAuditContext } from '../middleware/audit';
import { Request } from 'express';
import { AppError } from '../utils/AppError';

interface KPIMetric {
  valor: number;
  variacion: number;
}

export interface DashboardKPIs {
  cotizaciones: KPIMetric;
  emitidas: KPIMetric;
  pendientes: KPIMetric;
  comision: KPIMetric;
  conversion: KPIMetric;
  cierre: KPIMetric;
}


function parseFecha(fecha: string): Date {

  const [fechaPart, horaPart] = fecha.split(" ");
  const [dd, mm, yyyy] = fechaPart.split("-").map(Number);
  return new Date(yyyy, mm - 1, dd, ...horaPart.split(":").map(Number));
}

function calcularVariacion(actual: number, anterior: number): number {
  if (anterior === 0) {
    return actual > 0 ? 100 : 0;
  }
  return Number((((actual - anterior) / anterior) * 100).toFixed(2));
}


function getRangoMesActual(): { desde: string; hasta: string } {
  const ahora = new Date();
  const primerDia = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const dia = String(primerDia.getDate()).padStart(2, '0');
  const mes = String(primerDia.getMonth() + 1).padStart(2, '0');
  const anio = primerDia.getFullYear();
  const desde = `${dia}-${mes}-${anio} 00:00:00`;
  
  const hoyDia = String(ahora.getDate()).padStart(2, '0');
  const hoyMes = String(ahora.getMonth() + 1).padStart(2, '0');
  const hoyAnio = ahora.getFullYear();
  const hasta = `${hoyDia}-${hoyMes}-${hoyAnio} 23:59:59`;
  
  return { desde, hasta };
}


function getRangoMesAnterior(): { desde: string; hasta: string } {
  const ahora = new Date();
  const mesAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
  const ultimoDiaMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth(), 0);
  
  const diaDesde = String(mesAnterior.getDate()).padStart(2, '0');
  const mesDesde = String(mesAnterior.getMonth() + 1).padStart(2, '0');
  const anioDesde = mesAnterior.getFullYear();
  const desde = `${diaDesde}-${mesDesde}-${anioDesde} 00:00:00`;
  
  const diaHasta = String(ultimoDiaMesAnterior.getDate()).padStart(2, '0');
  const mesHasta = String(ultimoDiaMesAnterior.getMonth() + 1).padStart(2, '0');
  const anioHasta = ultimoDiaMesAnterior.getFullYear();
  const hasta = `${diaHasta}-${mesHasta}-${anioHasta} 23:59:59`;
  
  return { desde, hasta };
}

function filtrarPorFecha(datos: any[], desde?: string, hasta?: string): any[] {
  const d = desde ? parseFecha(desde) : null;
  const h = hasta ? parseFecha(hasta) : null;

  return datos.filter(c => {
    const f = parseFecha(c.fecha_cotizacion);

    if (d && f < d) return false;
    if (h && f > h) return false;
    return true;
  });
}


export async function getKPIs(req: AuthedRequest): Promise<DashboardKPIs> {
  const auditCtx = getAuditContext(req as Request);
  
  try {
    const userId = req.user?.id;


    console.log("User ID for KPI retrieval:", userId);
    if (!userId) {
      throw new AppError("User not authenticated", 401);
    }

    const id_corredor = userId;

    const rangoActual = getRangoMesActual();
    const rangoAnterior = getRangoMesAnterior();

    
    let todosDatos: any[] = [];
    try {
      todosDatos = await Cotizacion.find({ id_corredor: id_corredor }).lean().maxTimeMS(10000);
    } catch (dbError: any) {
      await Audit.log(auditCtx, {
        action: 'kpi.query.error',
        entity: 'Cotizacion',
        entityId: null,
        before: null,
        after: null,
        metadata: { error: dbError.message, operation: 'find.all' }
      });
      throw new AppError("Error al obtener datos", 500);
    }

    
    let datosActual: any[] = [];
    let datosAnterior: any[] = [];
    
    try {
      datosActual = filtrarPorFecha(todosDatos, rangoActual.desde, rangoActual.hasta);
      datosAnterior = filtrarPorFecha(todosDatos, rangoAnterior.desde, rangoAnterior.hasta);
    } catch (filterError: any) {
      await Audit.log(auditCtx, {
        action: 'kpi.filter.error',
        entity: 'Cotizacion',
        entityId: null,
        before: null,
        after: null,
        metadata: { error: filterError.message, operation: 'filtrarPorFecha' }
      });
      throw new AppError("Error al filtrar datos por fecha", 500);
    }

   
    let cotizacionesActual = 0;
    let emisionesActual = 0;
    let pendientesActual = 0;
    let comisionesActual = 0;
    let conversionActual = 0;
    let cierreActual = 0;

    try {
      cotizacionesActual = datosActual.length;
      emisionesActual = datosActual.filter(c => ["CERRADA", "EMITIDA", "FINALIZADA"].includes(c.estado)).length;
      pendientesActual = datosActual.filter(c => ["EN_PROCESO", "PENDIENTE", "EN PROCESO"].includes(c.estado)).length;
      comisionesActual = datosActual.reduce((sum, c) => sum + (c.comision || 0), 0);
      conversionActual = cotizacionesActual > 0 ? Number(((emisionesActual / cotizacionesActual) * 100).toFixed(2)) : 0;
      cierreActual = datosActual.length > 0 
        ? Number((datosActual.reduce((sum, c) => sum + (c.prob_cierre || 0), 0) / datosActual.length * 100).toFixed(2))
        : 0;
    } catch (calcError: any) {
      await Audit.log(auditCtx, {
        action: 'kpi.calculate.error',
        entity: 'Dashboard',
        entityId: null,
        before: null,
        after: null,
        metadata: { error: calcError.message, operation: 'calcular.actual', periodo: 'mes_actual' }
      });
      throw new AppError("Error al calcular KPIs del mes actual", 500);
    }

   
    let cotizacionesAnterior = 0;
    let emisionesAnterior = 0;
    let pendientesAnterior = 0;
    let comisionesAnterior = 0;
    let conversionAnterior = 0;
    let cierreAnterior = 0;

    try {
      cotizacionesAnterior = datosAnterior.length;
      emisionesAnterior = datosAnterior.filter(c => ["CERRADA", "EMITIDA", "FINALIZADA"].includes(c.estado)).length;
      pendientesAnterior = datosAnterior.filter(c => ["EN_PROCESO", "PENDIENTE", "EN PROCESO"].includes(c.estado)).length;
      comisionesAnterior = datosAnterior.reduce((sum, c) => sum + (c.comision || 0), 0);
      conversionAnterior = cotizacionesAnterior > 0 ? Number(((emisionesAnterior / cotizacionesAnterior) * 100).toFixed(2)) : 0;
      cierreAnterior = datosAnterior.length > 0
        ? Number((datosAnterior.reduce((sum, c) => sum + (c.prob_cierre || 0), 0) / datosAnterior.length * 100).toFixed(2))
        : 0;
    } catch (calcError: any) {
      await Audit.log(auditCtx, {
        action: 'kpi.calculate.error',
        entity: 'Dashboard',
        entityId: null,
        before: null,
        after: null,
        metadata: { error: calcError.message, operation: 'calcular.anterior', periodo: 'mes_anterior' }
      });
      throw new AppError("Error al calcular KPIs del mes anterior", 500);
    }

    
    let variacionCotizaciones = 0;
    let variacionEmitidas = 0;
    let variacionPendientes = 0;
    let variacionComisiones = 0;
    let variacionConversion = 0;
    let variacionCierre = 0;

    try {
      variacionCotizaciones = calcularVariacion(cotizacionesActual, cotizacionesAnterior);
      variacionEmitidas = calcularVariacion(emisionesActual, emisionesAnterior);
      variacionPendientes = calcularVariacion(pendientesActual, pendientesAnterior);
      variacionComisiones = calcularVariacion(comisionesActual, comisionesAnterior);
      variacionConversion = calcularVariacion(conversionActual, conversionAnterior);
      variacionCierre = calcularVariacion(cierreActual, cierreAnterior);
    } catch (varError: any) {
      await Audit.log(auditCtx, {
        action: 'kpi.variacion.error',
        entity: 'Dashboard',
        entityId: null,
        before: null,
        after: null,
        metadata: { error: varError.message, operation: 'calcularVariacion' }
      });
      
      variacionCotizaciones = 0;
      variacionEmitidas = 0;
      variacionPendientes = 0;
      variacionComisiones = 0;
      variacionConversion = 0;
      variacionCierre = 0;
    }

    const result = {
      cotizaciones: { valor: cotizacionesActual, variacion: variacionCotizaciones },
      emitidas: { valor: emisionesActual, variacion: variacionEmitidas },
      pendientes: { valor: pendientesActual, variacion: variacionPendientes },
      comision: { valor: comisionesActual, variacion: variacionComisiones },
      conversion: { valor: conversionActual, variacion: variacionConversion },
      cierre: { valor: cierreActual, variacion: variacionCierre }
    };

    try {
      await Audit.log(auditCtx, {
        action: 'kpi.get',
        entity: 'Dashboard',
        entityId: null,
        before: null,
        after: result,
        metadata: { 
          userId: id_corredor,
          periodoActual: rangoActual,
          periodoAnterior: rangoAnterior,
          totalDatos: todosDatos.length,
          datosActual: datosActual.length,
          datosAnterior: datosAnterior.length
        }
      });
    } catch {}

    return result;
  } catch (error: any) {
    try {
      await Audit.log(auditCtx, {
        action: 'kpi.get.error',
        entity: 'Dashboard',
        entityId: null,
        before: null,
        after: null,
        metadata: { error: error.message, stack: error.stack }
      });
    } catch {}

    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Error al obtener KPIs", error.status || 500);
  }
}
