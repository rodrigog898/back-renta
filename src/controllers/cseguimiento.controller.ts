import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import * as SeguimientoService from "../services/cseguimiento.service";
import Seguimiento from "../models/Cseguimiento";
import { getAuditContext } from "../middleware/audit";
import * as Audit from "../services/audit.service";
import { diffObjects } from "../utils/diff";

export async function list(req: AuthedRequest, res: Response) {
  try {
    const { id_cotizacion } = req.params;

    if (!id_cotizacion) {
      return res.status(400).json({ ok: false, message: "id_cotizacion requerido" });
    }

    const data = await SeguimientoService.listByCotizacion({ id_cotizacion });

    return res.json({ ok: true, data });
  } catch (err: any) {
    console.error("Error en list seguimientos:", err);
    return res.status(500).json({
      ok: false,
      message: err?.message || "Server error"
    });
  }
}

export async function create(req: AuthedRequest, res: Response) {
  try {
    const { id_cotizacion } = req.params;
    const { type, descripcion, f_recordatorio } = req.body;

    if (!id_cotizacion) {
      return res.status(400).json({ ok: false, message: "id_cotizacion requerido" });
    }

    if (!type) {
      return res.status(400).json({ ok: false, message: "type requerido" });
    }

    if (!descripcion) {
      return res.status(400).json({ ok: false, message: "descripcion requerida" });
    }

    const id_user = req.user?.id || 'unknown';

    const seguimiento = await SeguimientoService.create({
      id_cotizacion,
      type,
      descripcion,
      f_recordatorio,
      id_user
    });

    const ctx = getAuditContext(req);
    await Audit.log(ctx, {
      action: 'seguimiento.create',
      entity: 'Seguimiento',
      entityId: String(seguimiento._id),
      before: null,
      after: seguimiento.toObject(),
      metadata: { type, id_cotizacion }
    });

    return res.status(201).json({
      ok: true,
      data: seguimiento,
      message: `${type} registrado exitosamente`
    });
  } catch (err: any) {
    console.error("Error en create seguimiento:", err);
    return res.status(500).json({
      ok: false,
      message: err?.message || "Server error"
    });
  }
}