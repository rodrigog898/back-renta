import fs from "fs";
import path from "path";
import https from "https";
import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "xmldom";
import { Readable } from "stream";
import ConvertAPI from "convertapi";

import Cotizacion from "../models/Cbitacora";
import { AuthedRequest } from "../middleware/auth";
import * as Audit from "./audit.service";
import { getAuditContext } from "../middleware/audit";
import { Request } from "express";
import { AppError } from "../utils/AppError";

const TEMPLATE_PATH = path.resolve(
  process.cwd(),
  "templates/01_VCLDM 2.0 v2 2 - Nuevo formato.docx"
);

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

//helper busqueda
function construirFiltros(identificador: string, userId: string) {
  const filtros: any[] = [];
  const baseFiltro = { id_corredor: userId };

  const numero = Number(identificador);
  if (!isNaN(numero)) filtros.push({ ...baseFiltro, n_cotizacion: numero });

  filtros.push({ ...baseFiltro, n_cotizacion: identificador });

  filtros.push({
    ...baseFiltro,
    $expr: { $eq: [{ $toString: "$n_cotizacion" }, identificador] },
  });

  const formatosFecha = [
    /^\d{2}-\d{2}-\d{4}$/,
    /^\d{4}-\d{2}-\d{2}$/,
    /^\d{2}\/\d{2}\/\d{4}$/,
    /^\d{4}\/\d{2}\/\d{2}$/,
    /^\d{2}\.\d{2}\.\d{4}$/,
    /^\d{4}\.\d{2}\.\d{2}$/,
  ];

  const esFecha = formatosFecha.some((regex) => regex.test(identificador));
  if (esFecha) {
    let fechaNormalizada = identificador;

    if (
      /^\d{4}-\d{2}-\d{2}$/.test(identificador) ||
      /^\d{4}\/\d{2}\/\d{2}$/.test(identificador) ||
      /^\d{4}\.\d{2}\.\d{2}$/.test(identificador)
    ) {
      const sep = identificador.includes("-")
        ? "-"
        : identificador.includes("/")
        ? "/"
        : ".";
      const [anio, mes, dia] = identificador.split(sep);
      fechaNormalizada = `${dia}-${mes}-${anio}`;
    } else if (
      /^\d{2}\/\d{2}\/\d{4}$/.test(identificador) ||
      /^\d{2}\.\d{2}\.\d{4}$/.test(identificador)
    ) {
      fechaNormalizada = identificador.replace(/\//g, "-").replace(/\./g, "-");
    }

    filtros.push({
      ...baseFiltro,
      fecha_cotizacion: { $regex: `^${fechaNormalizada}` },
    });
  }

  return filtros;
}

/* =========================
   Helpers de fechas
========================= */
function formatFechaLargaEsCL(fechaCotizacion: string): string {
  const [soloFecha] = String(fechaCotizacion || "").split(" ");
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(soloFecha);
  if (!m) return "";

  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);

  const meses = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];

  const mesNombre = meses[mm - 1] || "";
  if (!mesNombre || !dd || !yyyy) return "";

  // Lo dejas en el Word como: "SGN/: {{fecha}}"
  return `${dd} de ${mesNombre} de ${yyyy}`;
}

function calcularVigencia15Dias(fechaCotizacion: string): string {
  const [soloFecha] = String(fechaCotizacion || "").split(" ");
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(soloFecha);
  if (!m) return "";

  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);

  const inicio = new Date(yyyy, mm - 1, dd);
  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + 15);

  const pad2 = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) =>
    `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;

  return `${fmt(inicio)} al ${fmt(fin)}`;
}

/* =========================
   Mapeo de datos a tags Word
========================= */
function mapearDatosCotizacion(cot: any): Record<string, any> {
  const nombreCliente = [cot?.cliente?.nombre, cot?.cliente?.apellido]
    .filter(Boolean)
    .join(" ")
    .trim();

  const fechaLarga = cot?.fecha_cotizacion
    ? formatFechaLargaEsCL(cot.fecha_cotizacion)
    : "";

  const vigencia = cot?.fecha_cotizacion
    ? calcularVigencia15Dias(cot.fecha_cotizacion)
    : "";

  return {
    // Página 1
    fecha: fechaLarga,
    numero_cotizacion: cot?.n_cotizacion != null ? String(cot.n_cotizacion) : "",
    nombre_cliente: nombreCliente,

    // Página 2 (pendientes)
    nombre_contratante: "",
    rut_contratante: "",

    asegurado_nombre: nombreCliente,
    asegurado_rut: cot?.cliente?.rut_cliente ? String(cot.cliente.rut_cliente) : "",

    vigencia,
    uso_especifico: cot?.uso_especifico || cot?.vehiculo?.uso_especifico || "",

    corredor_nombre: cot?.corredor_nombre || "",
    corredor_rut: cot?.corredor_rut || "",

    // comisión tal cual venga
    comision: cot?.comision != null ? String(cot.comision) : "",

    // Vehículo (solo si existen tags)
    tipo_vehiculo: cot?.vehiculo?.tipoVehiculo || "",
    marca: cot?.vehiculo?.marca || "",
    modelo: cot?.vehiculo?.modelo || "",
    anio: cot?.vehiculo?.anio != null ? String(cot.vehiculo.anio) : "",
    patente: cot?.vehiculo?.patente || "",
  };
}

/* =========================
   Relleno DOCX (Content Controls)
========================= */
function reemplazarContenidoControl(sdt: any, valor: string, doc: Document) {
  const sdtContent = sdt.getElementsByTagName("w:sdtContent")[0];
  if (!sdtContent) {
    console.log(`[PDF] Content Control sin w:sdtContent`);
    return;
  }

  const v = valor ?? "";
  
  // Buscar todos los elementos w:t existentes dentro del Content Control
  const textNodes = sdtContent.getElementsByTagName("w:t");
  
  if (textNodes.length > 0) {
    // Si hay elementos w:t existentes, modificar su contenido
    for (let i = 0; i < textNodes.length; i++) {
      const t = textNodes[i];
      // Limpiar contenido existente (text nodes)
      while (t.firstChild) {
        t.removeChild(t.firstChild);
      }
      // Agregar nuevo texto
      t.appendChild(doc.createTextNode(v));
      
      // Preservar espacios si es necesario
      if (v.startsWith(" ") || v.endsWith(" ")) {
        t.setAttribute("xml:space", "preserve");
      } else {
        t.removeAttribute("xml:space");
      }
    }
  } else {
    // Si no hay elementos w:t, buscar o crear estructura completa
    let p = sdtContent.getElementsByTagName("w:p")[0];
    if (!p) {
      p = doc.createElementNS(W_NS, "p");
      sdtContent.appendChild(p);
    }
    
    let r = p.getElementsByTagName("w:r")[0];
    if (!r) {
      r = doc.createElementNS(W_NS, "r");
      p.appendChild(r);
    }
    
    let t = r.getElementsByTagName("w:t")[0];
    if (!t) {
      t = doc.createElementNS(W_NS, "t");
      r.appendChild(t);
    }
    
    // Limpiar y agregar nuevo texto
    while (t.firstChild) {
      t.removeChild(t.firstChild);
    }
    t.appendChild(doc.createTextNode(v));
    
    if (v.startsWith(" ") || v.endsWith(" ")) {
      t.setAttribute("xml:space", "preserve");
    }
  }
  
  console.log(`[PDF] Contenido reemplazado: "${v}"`);
}

function procesarXml(xml: string, datos: Record<string, any>): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");

  const sdts = doc.getElementsByTagName("w:sdt");
  console.log(`[PDF] Encontrados ${sdts.length} Content Controls`);
  
  for (let i = 0; i < sdts.length; i++) {
    const sdt = sdts[i];

    // El tag está dentro de w:sdtPr, no directamente en w:sdt
    const sdtPr = sdt.getElementsByTagName("w:sdtPr")[0];
    if (!sdtPr) {
      console.log(`[PDF] Content Control ${i} sin w:sdtPr`);
      continue;
    }

    const tagEls = sdtPr.getElementsByTagName("w:tag");
    if (tagEls.length === 0) {
      console.log(`[PDF] Content Control ${i} sin w:tag`);
      continue;
    }

    const tag =
      tagEls[0].getAttribute("w:val") ||
      tagEls[0].getAttribute("val") ||
      "";
    
    console.log(`[PDF] Tag encontrado: "${tag}"`);

    if (!tag) continue;

    if (Object.prototype.hasOwnProperty.call(datos, tag)) {
      const valor = String(datos[tag] ?? "");
      console.log(`[PDF] Reemplazando tag "${tag}" con valor: "${valor}"`);
      reemplazarContenidoControl(sdt, valor, doc);
    } else {
      console.log(`[PDF] Tag "${tag}" no encontrado en datos`);
    }
  }

  return new XMLSerializer().serializeToString(doc);
}

async function rellenarContentControls(
  templatePath: string,
  datos: Record<string, any>
): Promise<Buffer> {
  if (!fs.existsSync(templatePath)) {
    throw new AppError(`Plantilla no encontrada: ${templatePath}`, 500);
  }

  const content = fs.readFileSync(templatePath);
  const zip = await JSZip.loadAsync(content);

  // document + headers + footers (dinámico)
  const xmlPaths = Object.keys(zip.files).filter((p) =>
    /^word\/(document|header\d+|footer\d+)\.xml$/.test(p)
  );

  if (xmlPaths.length === 0) {
    throw new AppError("Plantilla DOCX inválida: no se encontraron XML de Word", 500);
  }

  for (const p of xmlPaths) {
    const f = zip.file(p);
    if (!f) continue;
    const xml = await f.async("text");
    zip.file(p, procesarXml(xml, datos));
  }

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

/* =========================
   DOCX -> PDF (ConvertAPI)
========================= */
function bufferToStream(buf: Buffer): Readable {
  return Readable.from(buf);
}

function downloadToBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });
}

async function convertirDocxAPdf(docxBuffer: Buffer): Promise<Buffer> {
  const token = process.env.CONVERT_API_TOKEN;
  if (!token) {
    throw new AppError("Falta CONVERT_API_TOKEN en .env", 500);
  }

  const convertapi = new ConvertAPI(token);

  // Subir DOCX en memoria
  const uploaded = await convertapi.upload(bufferToStream(docxBuffer), "cotizacion.docx");

  // Convertir (input format = docx)
  const result = await convertapi.convert("pdf", { File: uploaded }, "docx");

  const url = result?.files?.[0]?.url;
  if (!url) throw new AppError("ConvertAPI no devolvió URL de PDF", 500);

  // Descargar PDF a memoria
  return downloadToBuffer(url);
}

/* =========================
   API pública (solo PDF)
========================= */
export async function generarPdfCotizacion(
  req: AuthedRequest,
  identificador: string
): Promise<Buffer> {
  const auditCtx = getAuditContext(req as Request);

  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError("User not authenticated", 401);

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
        action: "pdf.preview.notfound",
        entity: "Cotizacion",
        entityId: identificador,
        metadata: { filtros, userId },
      });

      if (ultimoError) {
        throw new AppError(`Error al buscar cotización: ${ultimoError.message}`, 500);
      }

      throw new AppError("Cotización no encontrada o no pertenece al usuario", 404);
    }

    await Audit.log(auditCtx, {
      action: "pdf.preview.start",
      entity: "Cotizacion",
      entityId: String(cot._id),
      metadata: { n_cotizacion: cot.n_cotizacion },
    });

    const datos = mapearDatosCotizacion(cot);
    console.log("[PDF] Datos mapeados:", JSON.stringify(datos, null, 2));
    const docx = await rellenarContentControls(TEMPLATE_PATH, datos);
    const pdf = await convertirDocxAPdf(docx);

    await Audit.log(auditCtx, {
      action: "pdf.preview.success",
      entity: "PDF",
      entityId: identificador,
      metadata: { size: pdf.length, n_cotizacion: cot.n_cotizacion },
    });

    return pdf;
  } catch (err: any) {
    await Audit.log(auditCtx, {
      action: "pdf.preview.error",
      entity: "PDF",
      entityId: identificador,
      metadata: { error: err.message, stack: err.stack },
    });

    throw err instanceof AppError ? err : new AppError("Error al generar PDF", 500);
  }
}
