// src/services/cotizacion.service.ts
import { Types } from "mongoose";
import Cotizacion from "../models/Cbitacora";

export interface ListCotParams {
  user: { id: string | Types.ObjectId; rol?: string };
  page?: number;
  limit?: number;
  date_from?: string; 
  date_to?: string;   
  rut_cliente?: string;
  id_corredor?: string;
  estado?: string;
  search?: string; 
}

function toInt(v: any, def: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
}

function normalizeDateStr(d?: string, end = false) {
  if (!d) return undefined;
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(d.trim());
  if (!m) return undefined;
  return `${m[1]}-${m[2]}-${m[3]} ${end ? "23:59:59" : "00:00:00"}`;
}


export async function listCbitacoraPaged(params: ListCotParams) {
  const page = toInt(params.page, 1);
  const limit = Math.min(toInt(params.limit, 20), 200);

  const rol = (params.user?.rol || "").toLowerCase();
  const isPrivileged = rol === "ejecutivo" || rol === "admin" || rol === "administrator";

  const matchVisibility: Record<string, any> = {};
  if (!isPrivileged && params.user?.id) {
    matchVisibility.id_corredor = String(params.user.id);
  }

  if (params.rut_cliente) {
    const rutClean = params.rut_cliente.replace(/\./g, '').replace(/-/g, '');
    matchVisibility.$or = [
      { "cliente.rut_cliente": { $regex: rutClean, $options: "i" } },
      { "cliente.rut_cliente": { $regex: params.rut_cliente, $options: "i" } }
    ];
  }

  if (isPrivileged && params.id_corredor) {
    matchVisibility.id_corredor = params.id_corredor;
  }

  if (params.estado) {
    const estadoNormalized = params.estado.toLowerCase().replace(/_/g, ' ');
    matchVisibility.estado = { 
      $regex: `^${estadoNormalized}$`, 
      $options: "i" 
    };
  }

  const searchConditions: any[] = [];
  if (params.search && params.search.trim()) {
    const searchTerm = params.search.trim();
    
    searchConditions.push(
      { "cliente.nombre": { $regex: searchTerm, $options: "i" } },
      { "cliente.apellido": { $regex: searchTerm, $options: "i" } },
      { "vehiculo.patente": { $regex: searchTerm, $options: "i" } },
      { "n_cotizacion": { $regex: searchTerm, $options: "i" } }
    );


    const cleanSearch = searchTerm.replace(/COT-?/gi, '').replace(/\s+/g, '').replace(/-/g, '');
    
    if (/^\d+$/.test(cleanSearch)) {
      const numSearch = parseInt(cleanSearch, 10);
      searchConditions.push(
        { n_cotizacion: numSearch },
        { n_cotizacion: cleanSearch }
      );
    }
    
    searchConditions.push(
      { n_cotizacion: { $regex: cleanSearch, $options: "i" } },
      { n_cotizacion: { $regex: searchTerm, $options: "i" } }
    );
    
    if (searchTerm.includes('-')) {
      searchConditions.push(
        { n_cotizacion: { $regex: searchTerm.replace(/\s+/g, ''), $options: "i" } }
      );
    }
  }

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
    { $match: { ...matchVisibility } },
    
    ...(searchConditions.length > 0 
      ? [{ $match: { $or: searchConditions } }] 
      : []),
    
    ...(dateMatchExpr ? [{ $match: dateMatchExpr }] : []),
    
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