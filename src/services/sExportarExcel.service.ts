import ExcelJS from "exceljs";
import Cotizacion from "../models/sBitacora";
import User from "../models/User";
import { AuthedRequest } from "../middleware/auth";
import * as Audit from "./audit.service";
import { getAuditContext } from "../middleware/audit";
import { Request } from "express";

function capitalizar(texto: string): string {
  if (!texto) return texto;
  return texto
    .toLowerCase()
    .split(' ')
    .map(palabra => palabra.charAt(0).toUpperCase() + palabra.slice(1))
    .join(' ');
}

function normalizarFecha(fecha: string): string {
  return fecha.replace(/(\d{2})-(\d{2})-(\d{4})/, "$3-$2-$1");
}

export async function exportarBitacora(req: AuthedRequest) {
  const auditCtx = getAuditContext(req as Request);
  
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      const err: any = new Error("Usuario no autenticado");
      err.status = 401;
      throw err;
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
      const err: any = new Error("Error al obtener información del usuario");
      err.status = 500;
      throw err;
    }

    const nombreUsuario = usuario 
      ? `${usuario.nombre || ""} ${usuario.apellido || ""}`.trim() || usuario.email || "Usuario"
      : "Usuario";

    const filtros: any = { id_corredor: userId };

    if (req.query.estado) filtros.estado = req.query.estado;

    if (req.query.n_cotizacion) {
      filtros.n_cotizacion = Number(req.query.n_cotizacion);
    }

    if (req.query.cliente) {
      const search = String(req.query.cliente);
      filtros.$and = filtros.$and || [];
      filtros.$and.push({
        $or: [
          { "cliente.nombre": { $regex: search, $options: "i" } },
          { "cliente.apellido": { $regex: search, $options: "i" } }
        ]
      });
    }

    if (req.query.vehiculo) {
      const search = String(req.query.vehiculo);
      filtros.$and = filtros.$and || [];
      filtros.$and.push({
        $or: [
          { "vehiculo.marca": { $regex: search, $options: "i" } },
          { "vehiculo.modelo": { $regex: search, $options: "i" } },
          { "vehiculo.patente": { $regex: search, $options: "i" } }
        ]
      });
    }

    let datos: any[] = [];
    try {
      datos = await Cotizacion.find(filtros).lean().maxTimeMS(10000);
    } catch (dbError: any) {
      await Audit.log(auditCtx, {
        action: 'excel.export.error',
        entity: 'Cotizacion',
        entityId: null,
        before: null,
        after: null,
        metadata: { error: dbError.message, operation: 'find', filtros }
      });
      const err: any = new Error("Error al obtener datos de cotizaciones");
      err.status = 500;
      throw err;
    }
  
  if (req.query.desde || req.query.hasta) {
    datos = datos.filter((cot) => {
      const fechaNorm = normalizarFecha(cot.fecha_cotizacion);
      if (req.query.desde) {
        const d = normalizarFecha(String(req.query.desde));
        if (fechaNorm < d) return false;
      }
      if (req.query.hasta) {
        const h = normalizarFecha(String(req.query.hasta));
        if (fechaNorm > h) return false;
      }
      return true;
    });
  }

  const mapaOrden: Record<string, string> = {
    cliente: "cliente.nombre",
    vehiculo: "vehiculo.marca",
    producto: "producto.t_producto",
    prima: "prima",
    comision: "comision",
    prob_cierre: "prob_cierre",
    estado: "estado",
    fecha: "fecha_cotizacion",
    n_cotizacion: "n_cotizacion"
  };

  const sortStr = String(req.query.sort || "");
  const dirStr = String(req.query.dir || "");
  const ordenamientos: Array<{ campo: string; dir: number }> = [];

  if (sortStr && dirStr) {
    const campos = sortStr.split(",");
    const dirs = dirStr.split(",");

    campos.forEach((campo, index) => {
      const direccion = dirs[index]?.trim() || "asc";
      const dirNum = direccion === "desc" ? -1 : 1;

      const campoReal = mapaOrden[campo.trim()];
      if (campoReal) ordenamientos.push({ campo: campoReal, dir: dirNum });
    });
  }

  if (ordenamientos.length === 0) {
    ordenamientos.push({ campo: "fecha_cotizacion", dir: -1 });
  }

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

      if (orden.campo === "fecha_cotizacion") {
        valA = valA ? normalizarFecha(String(valA)) : "";
        valB = valB ? normalizarFecha(String(valB)) : "";
      }

      let diff = 0;
      if (typeof valA === "number" && typeof valB === "number") {
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
      cot.vehiculo.kilometraje,
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
      const err: any = new Error("Error al generar archivo Excel");
      err.status = 500;
      throw err;
    }

    try {
      await Audit.log(auditCtx, {
        action: 'excel.export.success',
        entity: 'Excel',
        entityId: null,
        before: null,
        after: { registros: datos.length, usuario: nombreUsuario },
        metadata: { filtros, userId }
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

    const err: any = error.status ? error : new Error("Error al exportar Excel");
    err.status = error.status || 500;
    throw err;
  }
}
