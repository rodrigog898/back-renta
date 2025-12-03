// src/services/cotizacion.service.ts
import { Types } from "mongoose";
import Cotizacion from "../models/Cbitacora";

export interface ListCotParams {
  user: { id: string | Types.ObjectId; rol?: string };
  page?: number;
  limit?: number;
  date_from?: string; // dd-mm-yyyy
  date_to?: string;   // dd-mm-yyyy
  rut_cliente?: string;
  id_corredor?: string;
  estado?: string;
  search?: string; // búsqueda general (nombre, apellido, patente, n_cotizacion)
}

function toInt(v: any, def: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
}

// "dd-mm-yyyy" → "dd-mm-yyyy 00:00:00"/"23:59:59"
function normalizeDateStr(d?: string, end = false) {
  if (!d) return undefined;
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(d.trim());
  if (!m) return undefined;
  return `${m[1]}-${m[2]}-${m[3]} ${end ? "23:59:59" : "00:00:00"}`;
}

/**
 * Lista paginada de cotizaciones con:
 * - visibilidad por rol (corredor: solo sus docs; ejecutivo/admin: todos)
 * - filtros múltiples: fecha, RUT, corredor, estado, búsqueda general
 * - orden: más recientes primero
 */
export async function listCbitacoraPaged(params: ListCotParams) {
  const page = toInt(params.page, 1);
  const limit = Math.min(toInt(params.limit, 20), 200);

  const rol = (params.user?.rol || "").toLowerCase();
  const isPrivileged = rol === "ejecutivo" || rol === "admin" || rol === "administrator";

  // Visibilidad: si NO es privilegiado, ve solo sus propias cotizaciones
  const matchVisibility: Record<string, any> = {};
  if (!isPrivileged && params.user?.id) {
    matchVisibility.id_corredor = String(params.user.id);
  }

  // --- FILTROS ADICIONALES ---
  
  // Filtro por RUT de cliente (búsqueda flexible - con o sin formato)
  if (params.rut_cliente) {
    const rutClean = params.rut_cliente.replace(/\./g, '').replace(/-/g, '');
    // Buscar tanto el RUT limpio como el RUT con formato
    matchVisibility.$or = [
      { "cliente.rut_cliente": { $regex: rutClean, $options: "i" } },
      { "cliente.rut_cliente": { $regex: params.rut_cliente, $options: "i" } }
    ];
  }

  // Filtro por corredor (solo para roles privilegiados)
  if (isPrivileged && params.id_corredor) {
    matchVisibility.id_corredor = params.id_corredor;
  }

  // Filtro por estado
  if (params.estado) {
    const estadoNormalized = params.estado.toLowerCase().replace(/_/g, ' ');
    matchVisibility.estado = { 
      $regex: `^${estadoNormalized}$`, 
      $options: "i" 
    };
  }

  // Búsqueda general (nombre, apellido, patente, n_cotizacion)
  // Esto permite buscar por cualquiera de estos campos
  const searchConditions: any[] = [];
  if (params.search && params.search.trim()) {
    const searchTerm = params.search.trim();
    
    searchConditions.push(
      { "cliente.nombre": { $regex: searchTerm, $options: "i" } },
      { "cliente.apellido": { $regex: searchTerm, $options: "i" } },
      { "vehiculo.patente": { $regex: searchTerm, $options: "i" } },
      { "n_cotizacion": { $regex: searchTerm, $options: "i" } }
    );

    // Búsqueda por n_cotizacion (puede ser número o string)
    // Ejemplos: 202405270276, "2024-05-270276", "COT-2024-270276"
    
    // Limpiar el término de búsqueda (quitar COT-, guiones, espacios)
    const cleanSearch = searchTerm.replace(/COT-?/gi, '').replace(/\s+/g, '').replace(/-/g, '');
    
    // Buscar como número
    if (/^\d+$/.test(cleanSearch)) {
      const numSearch = parseInt(cleanSearch, 10);
      searchConditions.push(
        { n_cotizacion: numSearch },
        { n_cotizacion: cleanSearch }
      );
    }
    
    // Buscar como string con diferentes formatos
    searchConditions.push(
      { n_cotizacion: { $regex: cleanSearch, $options: "i" } },
      { n_cotizacion: { $regex: searchTerm, $options: "i" } }
    );
    
    // Si tiene guiones, buscar el formato completo
    if (searchTerm.includes('-')) {
      searchConditions.push(
        { n_cotizacion: { $regex: searchTerm.replace(/\s+/g, ''), $options: "i" } }
      );
    }
  }

  // Rango de fechas (opcional)
  const fromStr = normalizeDateStr(params.date_from, false);
  const toStr = normalizeDateStr(params.date_to, true);

  const dateMatchExpr =
    fromStr || toStr
      ? {
          $expr: {
            $and: [
              fromStr
                ? {
                    $gte: [
                      {
                        $dateFromString: {
                          dateString: "$fecha_cotizacion",
                          format: "%d-%m-%Y %H:%M:%S",
                          onError: null,
                          onNull: null,
                        },
                      },
                      {
                        $dateFromString: {
                          dateString: fromStr,
                          format: "%d-%m-%Y %H:%M:%S",
                          onError: null,
                          onNull: null,
                        },
                      },
                    ],
                  }
                : true,
              toStr
                ? {
                    $lte: [
                      {
                        $dateFromString: {
                          dateString: "$fecha_cotizacion",
                          format: "%d-%m-%Y %H:%M:%S",
                          onError: null,
                          onNull: null,
                        },
                      },
                      {
                        $dateFromString: {
                          dateString: toStr,
                          format: "%d-%m-%Y %H:%M:%S",
                          onError: null,
                          onNull: null,
                        },
                      },
                    ],
                  }
                : true,
            ],
          },
        }
      : null;

  const skip = (page - 1) * limit;

  const pipeline: any[] = [
    // Match inicial: visibilidad + filtros básicos
    { $match: { ...matchVisibility } },
    
    // Búsqueda general (si existe)
    ...(searchConditions.length > 0 
      ? [{ $match: { $or: searchConditions } }] 
      : []),
    
    // Filtro de fechas (si existe)
    ...(dateMatchExpr ? [{ $match: dateMatchExpr }] : []),
    
    // Campo auxiliar para ordenar por fecha real
    {
      $addFields: {
        _fecha_dt: {
          $dateFromString: {
            dateString: "$fecha_cotizacion",
            format: "%d-%m-%Y %H:%M:%S",
            onError: null,
            onNull: null,
          },
        },
      },
    },
    { $sort: { _fecha_dt: -1, _id: -1 } },
    {
      $facet: {
        data: [{ $skip: skip }, { $limit: limit }],
        total: [{ $count: "count" }],
      },
    },
  ];

  const [res] = await Cotizacion.aggregate(pipeline).allowDiskUse(true);
  const total = (res?.total?.[0]?.count as number) || 0;
  const data = res?.data || [];

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit || 1)),
      hasNext: page * limit < total,
      hasPrev: page > 1,
      filters: {
        date_from: params.date_from || null,
        date_to: params.date_to || null,
        rut_cliente: params.rut_cliente || null,
        id_corredor: params.id_corredor || null,
        estado: params.estado || null,
        search: params.search || null,
      },
      rol: rol || null,
    },
  };
}