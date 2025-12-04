import Cotizacion from "../models/sBitacora";
import { AuthedRequest } from "../middleware/auth";
import * as Audit from "./audit.service";
import { getAuditContext } from "../middleware/audit";
import { Request } from "express";

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
  label: string; 
}

export async function buscarAutocompletado(req: AuthedRequest): Promise<AutocompletadoResult[]> {
  const auditCtx = getAuditContext(req as Request);
  
  try {
    const userId = req.user?.id;
    if (!userId) {
      const err: any = new Error("User not authenticated");
      err.status = 401;
      throw err;
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
    try {
      const searchRegex = new RegExp(query, "i");
      
      const condiciones: any[] = [
        { "cliente.nombre": searchRegex },
        { "cliente.apellido": searchRegex },
        { "cliente.rut_cliente": searchRegex },
        { "vehiculo.marca": searchRegex },
        { "vehiculo.modelo": searchRegex },
        { "vehiculo.patente": searchRegex },
        { "producto.t_producto": searchRegex       }
      ];

      const nCotizacion = Number(query);
      if (!isNaN(nCotizacion)) {
        condiciones.push({ n_cotizacion: nCotizacion });
      }

      const cotMatch = query.match(/COT-?(\d+)/i);
      if (cotMatch && cotMatch[1]) {
        const numCot = Number(cotMatch[1]);
        if (!isNaN(numCot)) {
          condiciones.push({ n_cotizacion: numCot });
        }
      }

      if (query.toUpperCase().trim() === 'COT' || query.toUpperCase().trim() === 'COT-') {
        resultados = await Cotizacion.find({
          id_corredor: userId
        })
        .select("n_cotizacion cliente vehiculo producto estado")
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
          const vehiculoCompleto = `${cot.vehiculo.marca} ${cot.vehiculo.modelo}`.trim();
          const label = `COT-${cot.n_cotizacion} - ${nombreCompleto} - ${vehiculoCompleto}`;

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
            label
          };
        });
      }
      
      resultados = await Cotizacion.find({
        id_corredor: userId,
        $or: condiciones
      })
      .select("n_cotizacion cliente vehiculo producto estado")
      .limit(limit)
      .lean()
      .maxTimeMS(3000);

      await Audit.log(auditCtx, {
        action: 'autocomplete.search.success',
        entity: 'Cotizacion',
        entityId: null,
        before: null,
        after: { count: resultados.length },
        metadata: { query, userId, limit }
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
      const err: any = new Error("Error al buscar cotizaciones");
      err.status = 500;
      throw err;
    }

    const resultadosFormateados: AutocompletadoResult[] = resultados.map((cot: any) => {
      const nombreCompleto = `${cot.cliente.nombre} ${cot.cliente.apellido}`.trim();
      const vehiculoCompleto = `${cot.vehiculo.marca} ${cot.vehiculo.modelo}`.trim();
      
      const label = `COT-${cot.n_cotizacion} - ${nombreCompleto} - ${vehiculoCompleto}`;

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
        label
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

    const err: any = error.status ? error : new Error("Error al buscar autocompletado");
    err.status = error.status || 500;
    throw err;
  }
}

