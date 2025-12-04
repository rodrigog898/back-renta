import PDFDocument from "pdfkit";
import Cotizacion from "../models/sBitacora";
import { AuthedRequest } from "../middleware/auth";
import * as Audit from "./audit.service";
import { getAuditContext } from "../middleware/audit";
import { Request } from "express";

export async function generarPdfCotizacion(req: AuthedRequest, cotizacionId: string) {
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
      cot = await Cotizacion.findOne({
        _id: cotizacionId,
        id_corredor: userId
      }).lean().maxTimeMS(5000);
    } catch (dbError: any) {
      await Audit.log(auditCtx, {
        action: 'pdf.export.error',
        entity: 'Cotizacion',
        entityId: cotizacionId,
        before: null,
        after: null,
        metadata: { error: dbError.message, operation: 'findOne' }
      });
      const err: any = new Error("Error al buscar cotización");
      err.status = 500;
      throw err;
    }

    if (!cot) {
      await Audit.log(auditCtx, {
        action: 'pdf.export.notfound',
        entity: 'Cotizacion',
        entityId: cotizacionId,
        before: null,
        after: null,
        metadata: { userId }
      });
      const err: any = new Error("Cotización no encontrada o no pertenece al usuario");
      err.status = 404;
      throw err;
    }

    let buffer: Buffer;
    try {
      buffer = await new Promise<Buffer>((resolve, reject) => {
        const doc = new PDFDocument({
          margin: 40,
          size: "A4"
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // 1. ENCABEZADO
        doc
          .fontSize(22)
          .text("Cotización de Seguro", { align: "center" })
          .moveDown(1);

        // Línea separadora
        doc
          .moveTo(40, doc.y)
          .lineTo(550, doc.y)
          .strokeColor("#999")
          .stroke()
          .moveDown();

        // 2. DATOS DEL CLIENTE
        doc
          .fontSize(14)
          .fillColor("#333")
          .text("Datos del Cliente", { underline: true })
          .moveDown(0.5);

        doc
          .fontSize(12)
          .fillColor("#000")
          .text(`Nombre: ${cot.cliente.nombre} ${cot.cliente.apellido}`)
          .text(`RUT: ${cot.cliente.rut_cliente}`)
          .text(`Correo: ${cot.cliente.correo}`)
          .text(`Teléfono: ${cot.cliente.telefono}`)
          .moveDown(1);

        // 3. BIEN ASEGURADO
        doc
          .fontSize(14)
          .fillColor("#333")
          .text("Bien Asegurado", { underline: true })
          .moveDown(0.5);

        doc
          .fontSize(12)
          .fillColor("#000")
          .text(`Marca: ${cot.vehiculo.marca}`)
          .text(`Modelo: ${cot.vehiculo.modelo}`)
          .text(`Año: ${cot.vehiculo.anio}`)
          .text(`Patente: ${cot.vehiculo.patente}`)
          .text(`Kilometraje: ${cot.vehiculo.kilometraje} km`)
          .moveDown(1);

        // 4. PRODUCTO Y COBERTURAS
        doc
          .fontSize(14)
          .fillColor("#333")
          .text("Producto y Coberturas", { underline: true })
          .moveDown(0.5);

        doc
          .fontSize(12)
          .fillColor("#000")
          .text(`Producto: ${cot.producto.t_producto}`)
          .text(`Deducible: $${cot.producto.deducible.toLocaleString('es-CL')}`)
          .moveDown(1);

        // 5. MONTOS
        doc
          .fontSize(14)
          .fillColor("#333")
          .text("Montos", { underline: true })
          .moveDown(0.5);

        doc
          .fontSize(12)
          .fillColor("#000")
          .text(`Prima: $${cot.prima.toLocaleString('es-CL')}`)
          .text(`Comisión: $${cot.comision.toLocaleString('es-CL')}`)
          .text(`Probabilidad de Cierre: ${(cot.prob_cierre * 100).toFixed(2)}%`)
          .moveDown(2);

        // Pie de página
        doc
          .fontSize(10)
          .fillColor("#777")
          .text("Documento generado automáticamente por Renta Nacional", 40, 780, {
            align: "center"
          });

        doc.end();
      });
    } catch (pdfError: any) {
      await Audit.log(auditCtx, {
        action: 'pdf.export.error',
        entity: 'PDF',
        entityId: cotizacionId,
        before: null,
        after: null,
        metadata: { error: pdfError.message, operation: 'generatePDF' }
      });
      const err: any = new Error("Error al generar PDF");
      err.status = 500;
      throw err;
    }

    // Log de éxito
    try {
      await Audit.log(auditCtx, {
        action: 'pdf.export.success',
        entity: 'PDF',
        entityId: cotizacionId,
        before: null,
        after: { n_cotizacion: cot.n_cotizacion, cliente: `${cot.cliente.nombre} ${cot.cliente.apellido}` },
        metadata: { userId, size: buffer.length }
      });
    } catch {}

    return buffer;
  } catch (error: any) {
    // Log de error general
    try {
      await Audit.log(auditCtx, {
        action: 'pdf.export.error',
        entity: 'PDF',
        entityId: cotizacionId,
        before: null,
        after: null,
        metadata: { error: error.message, stack: error.stack }
      });
    } catch {}

    const err: any = error.status ? error : new Error("Error al exportar PDF");
    err.status = error.status || 500;
    throw err;
  }
}
