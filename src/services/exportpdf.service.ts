import PDFDocument from "pdfkit";
import Cotizacion from "../models/Cbitacora";
import { AuthedRequest } from "../middleware/auth";
import * as Audit from "./audit.service";
import { getAuditContext } from "../middleware/audit";
import { Request } from "express";
import { AppError } from "../utils/AppError";



function construirFiltros(identificador: string, userId: string) {
  const filtros: any[] = [];
  const baseFiltro = { id_corredor: userId };
  
  const numero = Number(identificador);
  if (!isNaN(numero)) {
    filtros.push({ ...baseFiltro, n_cotizacion: numero });
  }
  
  filtros.push({ ...baseFiltro, n_cotizacion: identificador });
  
  filtros.push({
    ...baseFiltro,
    $expr: { $eq: [{ $toString: "$n_cotizacion" }, identificador] }
  });
  
  const formatosFecha = [
    /^\d{2}-\d{2}-\d{4}$/,
    /^\d{4}-\d{2}-\d{2}$/,
    /^\d{2}\/\d{2}\/\d{4}$/,
    /^\d{4}\/\d{2}\/\d{2}$/,
    /^\d{2}\.\d{2}\.\d{4}$/,
    /^\d{4}\.\d{2}\.\d{2}$/
  ];
  
  const esFecha = formatosFecha.some(regex => regex.test(identificador));
  if (esFecha) {
    let fechaNormalizada = identificador;
    if (/^\d{4}-\d{2}-\d{2}$/.test(identificador) || /^\d{4}\/\d{2}\/\d{2}$/.test(identificador) || /^\d{4}\.\d{2}\.\d{2}$/.test(identificador)) {
      const separador = identificador.includes('-') ? '-' : identificador.includes('/') ? '/' : '.';
      const [anio, mes, dia] = identificador.split(separador);
      fechaNormalizada = `${dia}-${mes}-${anio}`;
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(identificador) || /^\d{2}\.\d{2}\.\d{4}$/.test(identificador)) {
      fechaNormalizada = identificador.replace(/\//g, '-').replace(/\./g, '-');
    }
    filtros.push({ ...baseFiltro, fecha_cotizacion: { $regex: `^${fechaNormalizada}` } });
  }
  
  return filtros;
}


export async function generarPdfCotizacion(req: AuthedRequest, identificador: string) {
  const auditCtx = getAuditContext(req as Request);

  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("User not authenticated", 401);
    }
    const filtros = construirFiltros(identificador, userId);

    let cot: any = null;
    let ultimoError: any = null;

    for (const filtro of filtros) {
      try {
        cot = await Cotizacion.findOne(filtro).lean().maxTimeMS(5000);
        if (cot) break;
      } catch (dbError: any) {
        ultimoError = dbError;
      }
    }

    if (!cot) {
      await Audit.log(auditCtx, {
        action: "pdf.export.notfound",
        entity: "Cotizacion",
        entityId: identificador,
        metadata: { filtros }
      });
      if (ultimoError) {
        await Audit.log(auditCtx, {
          action: "pdf.export.error",
          entity: "Cotizacion",
          entityId: identificador,
          metadata: { error: ultimoError.message, stack: ultimoError.stack }
        });
        throw new AppError(`Error al buscar cotización: ${ultimoError.message}`, 500);
      }
      throw new AppError("Cotización no encontrada o no pertenece al usuario", 404);
    }

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: "A4" });
      const chunks: Buffer[] = [];

      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.fontSize(22).text("Cotización de Seguro", { align: "center" }).moveDown();

      doc
        .moveTo(40, doc.y)
        .lineTo(550, doc.y)
        .strokeColor("#999")
        .stroke()
        .moveDown();

      doc.fontSize(14).text("Datos del Cliente", { underline: true }).moveDown(0.5);

      doc.fontSize(12).text(`Nombre: ${cot.cliente.nombre} ${cot.cliente.apellido}`);
      doc.text(`RUT: ${cot.cliente.rut_cliente}`);
      doc.text(`Correo: ${cot.cliente.correo}`);
      doc.text(`Teléfono: ${cot.cliente.telefono}`).moveDown();

      doc.fontSize(14).text("Bien Asegurado", { underline: true }).moveDown(0.5);

      doc.fontSize(12).text(`Marca: ${cot.vehiculo.marca}`);
      doc.text(`Modelo: ${cot.vehiculo.modelo}`);
      doc.text(`Año: ${cot.vehiculo.anio}`);
      doc.text(`Patente: ${cot.vehiculo.patente}`);
      if (cot.vehiculo.kilometraje)
        doc.text(`Kilometraje: ${cot.vehiculo.kilometraje} km`).moveDown();

      doc.fontSize(14).text("Producto y Coberturas", { underline: true }).moveDown(0.5);

      doc.fontSize(12).text(`Producto: ${cot.producto.t_producto}`);
      doc.text(`Deducible: ${cot.producto.deducible}`).moveDown();

      doc.fontSize(14).text("Montos", { underline: true }).moveDown(0.5);

      doc.fontSize(12).text(`Prima: ${cot.prima}`);
      doc.text(`Comisión: ${cot.comision}`);
      doc.text(`Probabilidad de cierre: ${(cot.prob_cierre * 100).toFixed(2)}%`).moveDown(2);

      doc.fontSize(10).fillColor("#777").text(
        "Documento generado automáticamente por Renta Nacional",
        40,
        780,
        { align: "center" }
      );

      doc.end();
    });

    await Audit.log(auditCtx, {
      action: "pdf.export.success",
      entity: "PDF",
      entityId: identificador,
      metadata: { size: buffer.length }
    });

    return buffer;
  } catch (err: any) {
    await Audit.log(auditCtx, {
      action: "pdf.export.error",
      entity: "PDF",
      entityId: identificador,
      metadata: { error: err.message }
    });

    throw err instanceof AppError ? err : new AppError("Error al exportar PDF", 500);
  }
}