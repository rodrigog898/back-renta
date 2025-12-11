import Cotizacion from "../models/Cbitacora";
import { AuthedRequest } from "../middleware/auth";
import * as Audit from "./audit.service";
import { getAuditContext } from "../middleware/audit";
import { Request } from "express";
import { AppError } from "../utils/AppError";

export interface AutocompletadoResult {
  _id: string;
  n_cotizacion: number;
  cliente: {
    nombre: string;
    apellido: string;
    rut_cliente: string;
  };
  vehiculo: {
    marca: string;
    modelo: string;
    patente: string;
  };
  producto: {
    t_producto: string;
  };
  estado: string;
  prima?: number;
  comision?: number;
  prob_cierre?: number;
  label: string;
  subLabel: string;
}

export async function buscarAutocompletado(req: AuthedRequest): Promise<AutocompletadoResult[]> {
  const auditCtx = getAuditContext(req as Request);
  
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("User not authenticated", 401);
    }

    const query = String(req.query.q || "").trim();
    const limit = Math.min(Number(req.query.limit) || 10, 20); 
    if (!query || query.length < 2) {
      try {
        await Audit.log(auditCtx, {
          action: 'autocomplete.search',
          entity: 'Cotizacion',
          entityId: null,
          before: null,
          after: { count: 0 },
          metadata: { query, userId, reason: 'query_too_short' }
        });
      } catch {}
      return [];
    }

    let resultados: any[] = [];
    let queryNumFinal = 0;
    let esBusquedaNumericaFinal = false;
    
    try {
      if (query.toUpperCase().trim() === 'COT' || query.toUpperCase().trim() === 'COT-') {
        resultados = await Cotizacion.find({
          id_corredor: userId
        })
        .select("n_cotizacion cliente vehiculo producto estado prima comision prob_cierre")
        .limit(limit)
        .lean()
        .maxTimeMS(3000);

        await Audit.log(auditCtx, {
          action: 'autocomplete.search.success',
          entity: 'Cotizacion',
          entityId: null,
          before: null,
          after: { count: resultados.length },
          metadata: { query, userId, limit, type: 'all_cotizaciones' }
        });

        return resultados.map((cot: any) => {
          const nombreCompleto = `${cot.cliente.nombre} ${cot.cliente.apellido}`.trim();
          const label = `COT-${cot.n_cotizacion} — ${nombreCompleto}`;
          const subLabel = `${cot.vehiculo.marca} ${cot.vehiculo.modelo} (${cot.vehiculo.patente})`;

          return {
            _id: cot._id.toString(),
            n_cotizacion: cot.n_cotizacion,
            cliente: {
              nombre: cot.cliente.nombre,
              apellido: cot.cliente.apellido,
              rut_cliente: cot.cliente.rut_cliente
            },
            vehiculo: {
              marca: cot.vehiculo.marca,
              modelo: cot.vehiculo.modelo,
              patente: cot.vehiculo.patente
            },
            producto: {
              t_producto: cot.producto.t_producto
            },
            estado: cot.estado,
            prima: cot.prima,
            comision: cot.comision,
            prob_cierre: cot.prob_cierre,
            label,
            subLabel
          };
        });
      }

     
      const nCotizacion = Number(query);
      const cotMatch = query.match(/COT-?(\d+)/i);
      if (!isNaN(nCotizacion) || (cotMatch && cotMatch[1])) {
        const numCot = cotMatch && cotMatch[1] ? Number(cotMatch[1]) : nCotizacion;
        if (!isNaN(numCot)) {
          resultados = await Cotizacion.find({
            id_corredor: userId,
            n_cotizacion: numCot
          })
          .select("n_cotizacion cliente vehiculo producto estado prima comision prob_cierre")
          .limit(limit)
          .lean()
          .maxTimeMS(3000);

          await Audit.log(auditCtx, {
            action: 'autocomplete.search.success',
            entity: 'Cotizacion',
            entityId: null,
            before: null,
            after: { count: resultados.length },
            metadata: { query, userId, limit, type: 'by_cotizacion_number' }
          });

          return resultados.map((cot: any) => {
            const nombreCompleto = `${cot.cliente.nombre} ${cot.cliente.apellido}`.trim();
            const label = `COT-${cot.n_cotizacion} — ${nombreCompleto}`;
            const subLabel = `${cot.vehiculo.marca} ${cot.vehiculo.modelo} (${cot.vehiculo.patente})`;

            return {
              _id: cot._id.toString(),
              n_cotizacion: cot.n_cotizacion,
              cliente: {
                nombre: cot.cliente.nombre,
                apellido: cot.cliente.apellido,
                rut_cliente: cot.cliente.rut_cliente
              },
              vehiculo: {
                marca: cot.vehiculo.marca,
                modelo: cot.vehiculo.modelo,
                patente: cot.vehiculo.patente
              },
              producto: {
                t_producto: cot.producto.t_producto
              },
              estado: cot.estado,
              prima: cot.prima,
              comision: cot.comision,
              prob_cierre: cot.prob_cierre,
              label,
              subLabel
            };
          });
        }
      }

      const queryNum = parseFloat(query.replace(/[^\d.,]/g, '').replace(',', '.'));
      const esBusquedaNumerica = !isNaN(queryNum) && queryNum > 0;
      
      const palabras = query.trim().split(/\s+/).filter(p => p.length > 0);
      const condicionesAnd: any[] = [];

      if (esBusquedaNumerica) {
        condicionesAnd.push({
          $or: [
            { prima: queryNum },
            { comision: queryNum },
            { prob_cierre: queryNum }
          ]
        });
      } else {
        
        palabras.forEach(palabra => {
          const palabraRegex = new RegExp(palabra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "i");
          condicionesAnd.push({
            $or: [
              { "cliente.nombre": palabraRegex },
              { "cliente.apellido": palabraRegex },
              { "cliente.rut_cliente": palabraRegex },
              { "vehiculo.marca": palabraRegex },
              { "vehiculo.modelo": palabraRegex },
              { "vehiculo.patente": palabraRegex },
              { "producto.t_producto": palabraRegex }
            ]
          });
        });
      }
      
      resultados = await Cotizacion.find({
        id_corredor: userId,
        $and: condicionesAnd
      })
      .select("n_cotizacion cliente vehiculo producto estado prima comision prob_cierre")
      .limit(limit)
      .lean()
      .maxTimeMS(3000);
      

      queryNumFinal = queryNum;
      esBusquedaNumericaFinal = esBusquedaNumerica;
      
      await Audit.log(auditCtx, {
        action: 'autocomplete.search.success',
        entity: 'Cotizacion',
        entityId: null,
        before: null,
        after: { count: resultados.length },
        metadata: { query, userId, limit, palabras: palabras.length, type: 'word_by_word' }
      });
    } catch (dbError: any) {
      await Audit.log(auditCtx, {
        action: 'autocomplete.search.error',
        entity: 'Cotizacion',
        entityId: null,
        before: null,
        after: null,
        metadata: { error: dbError.message, operation: 'find', query, userId }
      });
      throw new AppError("Error al buscar cotizaciones", 500);
    }

    
    const detectarCoincidencia = (cot: any, query: string, esBusquedaNumerica: boolean, queryNum: number): string => {
      const queryLower = query.toLowerCase().trim();
      const nombreCompleto = `${cot.cliente.nombre} ${cot.cliente.apellido}`.trim();
      const nombreLower = nombreCompleto.toLowerCase();
      const apellidoLower = cot.cliente.apellido?.toLowerCase() || '';
      const nombreLower2 = cot.cliente.nombre?.toLowerCase() || '';
      
          if (esBusquedaNumerica && queryNum) {
        if (cot.prima === queryNum) {
          return `Coincidencia: Prima mensual: $${cot.prima.toLocaleString('es-CL')}`;
        }
        if (cot.comision === queryNum) {
          return `Coincidencia: Comisión: $${cot.comision.toLocaleString('es-CL')}`;
        }
        if (cot.prob_cierre === queryNum) {
          return `Coincidencia: Probabilidad de cierre: ${cot.prob_cierre}%`;
        }
      }
      
      if (nombreLower.includes(queryLower) || nombreLower2.includes(queryLower) || apellidoLower.includes(queryLower)) {
        return `Coincidencia: ${nombreCompleto}`;
      }
          const marcaLower = cot.vehiculo.marca?.toLowerCase() || '';
      if (marcaLower.includes(queryLower)) {
        return `Coincidencia: ${cot.vehiculo.marca} ${cot.vehiculo.modelo} (${cot.vehiculo.patente})`;
      }
     
      const patenteUpper = cot.vehiculo.patente?.toUpperCase() || '';
      if (patenteUpper.includes(query.toUpperCase())) {
        return `Coincidencia: Patente ${cot.vehiculo.patente} — ${cot.vehiculo.marca} ${cot.vehiculo.modelo}`;
      }
      
      const productLower = cot.producto.t_producto?.toLowerCase() || '';
      if (productLower.includes(queryLower)) {
        return `Coincidencia: Seguro Automotriz ${cot.producto.t_producto}`;
      }
    
      return `${cot.vehiculo.marca} ${cot.vehiculo.modelo} (${cot.vehiculo.patente})`;
    };

    const resultadosFormateados: AutocompletadoResult[] = resultados.map((cot: any) => {
      const nombreCompleto = `${cot.cliente.nombre} ${cot.cliente.apellido}`.trim();
      const label = `COT-${cot.n_cotizacion} — ${nombreCompleto}`;
      const subLabel = detectarCoincidencia(cot, query, esBusquedaNumericaFinal, queryNumFinal);

      return {
        _id: cot._id.toString(),
        n_cotizacion: cot.n_cotizacion,
        cliente: {
          nombre: cot.cliente.nombre,
          apellido: cot.cliente.apellido,
          rut_cliente: cot.cliente.rut_cliente
        },
        vehiculo: {
          marca: cot.vehiculo.marca,
          modelo: cot.vehiculo.modelo,
          patente: cot.vehiculo.patente
        },
        producto: {
          t_producto: cot.producto.t_producto
        },
        estado: cot.estado,
        prima: cot.prima,
        comision: cot.comision,
        prob_cierre: cot.prob_cierre,
        label,
        subLabel
      };
    });

    return resultadosFormateados;
  } catch (error: any) {
    try {
      await Audit.log(auditCtx, {
        action: 'autocomplete.search.error',
        entity: 'Cotizacion',
        entityId: null,
        before: null,
        after: null,
        metadata: { error: error.message, stack: error.stack, query: req.query.q }
      });
    } catch {}

    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Error al buscar autocompletado", error.status || 500);
  }
}

