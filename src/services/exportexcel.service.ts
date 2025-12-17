import ExcelJS from "exceljs";
import Cotizacion from "../models/Cbitacora";
import User from "../models/User";
import { AuthedRequest } from "../middleware/auth";
import * as Audit from "./audit.service";
import { getAuditContext } from "../middleware/audit";
import { Request } from "express";
import { AppError } from "../utils/AppError";

function capitalizar(texto: string): string {
  if (!texto) return texto;
  return texto
    .toLowerCase()
    .split(' ')
    .map(palabra => palabra.charAt(0).toUpperCase() + palabra.slice(1))
    .join(' ');
}

function normalizeDateStr(d?: string, end = false) {
  if (!d) return undefined;
  const [day, month, year] = d.split("-");
  return `${year}-${month}-${day}T${end ? "23:59:59" : "00:00:00"}`;
}

function buildMatchVisibility(
  user: { id: string; rol?: string } | undefined,
  rut_cliente?: string,
  id_corredor?: string,
  estado?: string
) {
  const rol = (user?.rol || "").toLowerCase();
  const isPrivileged =
    rol === "ejecutivo" || rol === "admin" || rol === "administrator";

  const matchVisibility: Record<string, any> = {};

  if (!isPrivileged && user?.id) {
    matchVisibility.id_corredor = String(user.id);
  }

  if (isPrivileged && id_corredor) {
    matchVisibility.id_corredor = id_corredor;
  }

  const rutOrConditions: any[] = [];
  if (rut_cliente) {
    const rutClean = rut_cliente.replace(/\./g, "").replace(/-/g, "");
    rutOrConditions.push(
      { "cliente.rut_cliente": { $regex: rutClean, $options: "i" } },
      { "cliente.rut_cliente": { $regex: rut_cliente, $options: "i" } }
    );
  }

  const estadoOrConditions: any[] = [];
  if (estado) {
    const estadoLower = estado.toLowerCase();
    const estadoWithSpace = estadoLower.replace(/_/g, " ");
    const estadoWithUnderscore = estadoLower.replace(/\s+/g, "_");
    
    estadoOrConditions.push(
      { estado: { $regex: `^${estadoWithSpace}$`, $options: "i" } },
      { estado: { $regex: `^${estadoWithUnderscore}$`, $options: "i" } },
      { estado: { $regex: `^${estadoLower}$`, $options: "i" } }
    );
  }

  const andConditions: any[] = [];
  if (rutOrConditions.length > 0) {
    andConditions.push({ $or: rutOrConditions });
  }
  if (estadoOrConditions.length > 0) {
    andConditions.push({ $or: estadoOrConditions });
  }

  if (andConditions.length === 1) {
    matchVisibility.$or = andConditions[0].$or;
  } else if (andConditions.length > 1) {
    matchVisibility.$and = andConditions;
  }

  return matchVisibility;
}

function buildDateMatchExpr(date_from?: string, date_to?: string) {
  const fromStr = normalizeDateStr(date_from, false);
  const toStr = normalizeDateStr(date_to, true);

  if (!fromStr && !toStr) return undefined;

  return {
    _fecha_dt: {
      ...(fromStr && { $gte: new Date(fromStr) }),
      ...(toStr && { $lte: new Date(toStr) }),
    },
  };
}

export async function exportarBitacora(req: AuthedRequest) {
  const auditCtx = getAuditContext(req as Request);
  
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      throw new AppError("Usuario no autenticado", 401);
    }

    let usuario;
    try {
      usuario = await User.findById(userId).maxTimeMS(5000);
    } catch (dbError: any) {
      await Audit.log(auditCtx, {
        action: 'excel.export.error',
        entity: 'User',
        entityId: userId,
        before: null,
        after: null,
        metadata: { error: dbError.message, operation: 'findById.user' }
      });
      throw new AppError("Error al obtener información del usuario", 500);
    }

    const nombreUsuario = usuario 
      ? `${usuario.nombre || ""} ${usuario.apellido || ""}`.trim() || usuario.email || "Usuario"
      : "Usuario";

    const matchVisibility = buildMatchVisibility(
      req.user,
      req.query.rut_cliente as string | undefined,
      req.query.id_corredor as string | undefined,
      req.query.estado as string | undefined
    );

    const searchConditions: any[] = [];
    const searchTerm = req.query.search as string | undefined;
    if (searchTerm && searchTerm.trim()) {
      const term = searchTerm.trim();
      searchConditions.push(
        { "cliente.nombre": { $regex: term, $options: "i" } },
        { "cliente.apellido": { $regex: term, $options: "i" } },
        { "vehiculo.patente": { $regex: term, $options: "i" } }
      );

      const cleanSearch = term
        .replace(/COT-?/gi, "")
        .replace(/\s+/g, "")
        .replace(/-/g, "");

      if (/^\d+$/.test(cleanSearch)) {
        const numSearch = parseInt(cleanSearch, 10);
        searchConditions.push({ n_cotizacion: numSearch });
      }
    }

    if (req.query.cliente) {
      const search = String(req.query.cliente);
      searchConditions.push(
        { "cliente.nombre": { $regex: search, $options: "i" } },
        { "cliente.apellido": { $regex: search, $options: "i" } }
      );
    }

    if (req.query.vehiculo) {
      const search = String(req.query.vehiculo);
      searchConditions.push(
        { "vehiculo.marca": { $regex: search, $options: "i" } },
        { "vehiculo.modelo": { $regex: search, $options: "i" } },
        { "vehiculo.patente": { $regex: search, $options: "i" } }
      );
    }

    const dateFrom = req.query.desde as string | undefined;
    const dateTo = req.query.hasta as string | undefined;
    const dateMatchExpr = buildDateMatchExpr(dateFrom, dateTo);

    const pipeline: any[] = [
      { $match: { ...matchVisibility } },
      ...(searchConditions.length > 0
        ? [{ $match: { $or: searchConditions } }]
        : []),
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
      ...(dateMatchExpr ? [{ $match: dateMatchExpr }] : []),
      { $sort: { _fecha_dt: -1, _id: -1 } },
    ];

    let datos: any[] = [];
    try {
      const results = await Cotizacion.aggregate(pipeline).allowDiskUse(true);
      datos = results;
    } catch (dbError: any) {
      await Audit.log(auditCtx, {
        action: 'excel.export.error',
        entity: 'Cotizacion',
        entityId: null,
        before: null,
        after: null,
        metadata: { error: dbError.message, operation: 'aggregate', pipeline }
      });
      throw new AppError("Error al obtener datos de cotizaciones", 500);
    }

  const sortStr = String(req.query.sort || "");
  const dirStr = String(req.query.dir || "");
  
  if (sortStr && dirStr) {
    const mapaOrden: Record<string, string> = {
      cliente: "cliente.nombre",
      vehiculo: "vehiculo.marca",
      producto: "producto.t_producto",
      prima: "prima",
      comision: "comision",
      prob_cierre: "prob_cierre",
      estado: "estado",
      fecha: "_fecha_dt",
      n_cotizacion: "n_cotizacion"
    };

    const campos = sortStr.split(",");
    const dirs = dirStr.split(",");
    const ordenamientos: Array<{ campo: string; dir: number }> = [];

    campos.forEach((campo, index) => {
      const direccion = dirs[index]?.trim() || "asc";
      const dirNum = direccion === "desc" ? -1 : 1;
      const campoReal = mapaOrden[campo.trim()];
      if (campoReal) ordenamientos.push({ campo: campoReal, dir: dirNum });
    });

    if (ordenamientos.length > 0) {
      const obtenerValor = (obj: any, campo: string): any => {
        const partes = campo.split(".");
        let valor: any = obj;
        for (const p of partes) {
          if (valor === null || valor === undefined) return "";
          valor = valor[p];
        }
        return valor === null || valor === undefined ? "" : valor;
      };

      datos.sort((a, b) => {
        for (const orden of ordenamientos) {
          let valA = obtenerValor(a, orden.campo);
          let valB = obtenerValor(b, orden.campo);

          let diff = 0;
          if (valA instanceof Date && valB instanceof Date) {
            diff = valA.getTime() - valB.getTime();
          } else if (typeof valA === "number" && typeof valB === "number") {
            diff = valA - valB;
          } else {
            const strA = String(valA || "");
            const strB = String(valB || "");
            diff = strA.localeCompare(strB, "es", { sensitivity: "base", numeric: true });
          }

          if (diff !== 0) {
            return diff * orden.dir;
          }
        }
        return 0;
      });
    }
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Bitácora");

  const fechaActual = new Date();
  const dia = String(fechaActual.getDate()).padStart(2, '0');
  const mes = String(fechaActual.getMonth() + 1).padStart(2, '0');
  const anio = fechaActual.getFullYear();
  const hora = String(fechaActual.getHours()).padStart(2, '0');
  const minuto = String(fechaActual.getMinutes()).padStart(2, '0');
  const fechaFormateada = `${dia}/${mes}/${anio} ${hora}:${minuto}`;

  const titleRow = sheet.addRow([`Reporte de Bitácora de Cotizaciones`]);
  titleRow.getCell(1).font = { bold: true, size: 16, color: { argb: 'FF1F2937' } };
  titleRow.height = 25;
  sheet.mergeCells(1, 1, 1, 21);
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

  const userRow = sheet.addRow([`Generado por: ${nombreUsuario}`]);
  userRow.getCell(1).font = { size: 11, color: { argb: 'FF6B7280' } };
  sheet.mergeCells(2, 1, 2, 21);
  
  const dateRow = sheet.addRow([`Fecha de generación: ${fechaFormateada}`]);
  dateRow.getCell(1).font = { size: 11, color: { argb: 'FF6B7280' } };
  sheet.mergeCells(3, 1, 3, 21);
  
  sheet.addRow([]);

  const headerRow = sheet.addRow([
    "N° Cotización",
    "Fecha Cotización",
    "ID Corredor",
    "RUT",
    "Nombre",
    "Apellido",
    "Correo",
    "Teléfono",
    "Sexo",
    "Fecha de Nacimiento",
    "Marca",
    "Modelo",
    "Año",
    "Patente",
    "Kilometraje",
    "Producto",
    "Deducible",
    "Prima",
    "Comisión",
    "Prob. Cierre",
    "Estado"
  ]);

  headerRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF374151' }
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF1F2937' } },
      left: { style: 'thin', color: { argb: 'FF1F2937' } },
      bottom: { style: 'thin', color: { argb: 'FF1F2937' } },
      right: { style: 'thin', color: { argb: 'FF1F2937' } }
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  headerRow.height = 30;

  
  datos.forEach((cot, index) => {
    const row = sheet.addRow([
      cot.n_cotizacion,
      cot.fecha_cotizacion,
      cot.id_corredor,
      cot.cliente.rut_cliente,
      capitalizar(cot.cliente.nombre),
      capitalizar(cot.cliente.apellido),
      cot.cliente.correo,
      cot.cliente.telefono,
      capitalizar(cot.cliente.sexo),
      cot.cliente.fecha_nacimiento,
      capitalizar(cot.vehiculo.marca),
      capitalizar(cot.vehiculo.modelo),
      cot.vehiculo.anio,
      cot.vehiculo.patente,
      cot.vehiculo.kilometraje || "",
      capitalizar(cot.producto.t_producto),
      cot.producto.deducible,
      cot.prima,
      cot.comision,
      cot.prob_cierre,
      capitalizar(cot.estado)
    ]);

    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
      };
      cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

      if (index % 2 === 0) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF9FAFB' }
        };
      }
    });

    const deducibleCell = row.getCell(17);
    deducibleCell.numFmt = '#,##0';
    deducibleCell.alignment = { vertical: 'middle', horizontal: 'right' };

    const primaCell = row.getCell(18);
    primaCell.numFmt = '"$"#,##0.00';
    primaCell.alignment = { vertical: 'middle', horizontal: 'right' };

    const comisionCell = row.getCell(19);
    comisionCell.numFmt = '"$"#,##0';
    comisionCell.alignment = { vertical: 'middle', horizontal: 'right' };

    const probCierreCell = row.getCell(20);
    probCierreCell.numFmt = '0.00%';
    probCierreCell.alignment = { vertical: 'middle', horizontal: 'right' };

    const kilometrajeCell = row.getCell(15);
    kilometrajeCell.numFmt = '#,##0';
    kilometrajeCell.alignment = { vertical: 'middle', horizontal: 'right' };

    row.height = 20;
  });

  sheet.columns = [
    { width: 15 },
    { width: 20 },
    { width: 25 },
    { width: 18 },
    { width: 20 },
    { width: 20 },
    { width: 30 },
    { width: 18 },
    { width: 12 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 10 },
    { width: 12 },
    { width: 15 },
    { width: 35 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 15 }
  ];

  sheet.views = [
    {
      state: 'frozen',
      ySplit: 5,
      topLeftCell: 'A6',
      activeCell: 'A6'
    }
  ];

    let buffer;
    try {
      buffer = await workbook.xlsx.writeBuffer();
    } catch (excelError: any) {
      await Audit.log(auditCtx, {
        action: 'excel.export.error',
        entity: 'Excel',
        entityId: null,
        before: null,
        after: null,
        metadata: { error: excelError.message, operation: 'writeBuffer', registros: datos.length }
      });
      throw new AppError("Error al generar archivo Excel", 500);
    }

    try {
      await Audit.log(auditCtx, {
        action: 'excel.export.success',
        entity: 'Excel',
        entityId: null,
        before: null,
        after: { registros: datos.length, usuario: nombreUsuario },
        metadata: { userId }
      });
    } catch {}

    return buffer;
  } catch (error: any) {
    try {
      await Audit.log(auditCtx, {
        action: 'excel.export.error',
        entity: 'Excel',
        entityId: null,
        before: null,
        after: null,
        metadata: { error: error.message, stack: error.stack }
      });
    } catch {}

    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Error al exportar Excel", error.status || 500);
  }
}