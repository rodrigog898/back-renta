import { Response } from "express";
import Seguimiento from "../models/Cseguimiento";
import { AuthedRequest } from "../middleware/auth";

export async function crearRecordatorio(req: AuthedRequest, res: Response) {
  try {
    const userId = req.user!.id;

    const { id_cotizacion, type, descripcion, f_recordatorio } = req.body;

    if (!id_cotizacion || !f_recordatorio) {
      return res.status(400).json({
        message: "id_cotizacion y f_recordatorio son requeridos",
      });
    }

    const recordatorio = await Seguimiento.create({
      id_cotizacion,
      type,
      descripcion,
      f_recordatorio: new Date(f_recordatorio),
      id_user: userId,
      enviado: false,
    });

    return res.status(201).json(recordatorio);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error al crear recordatorio" });
  }
}


