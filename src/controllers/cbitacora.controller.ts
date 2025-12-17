import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import * as CotizacionService from "../services/cbitacora.service";
import { AppError } from "../utils/AppError";

export async function list(req: AuthedRequest, res: Response) {
  try {
    const { 
      page, 
      limit, 
      date_from, 
      date_to,
      rut_cliente,
      id_corredor,
      estado,
      search
    } = req.query as Record<string, string | undefined>;

    const user = req.user!;
    const result = await CotizacionService.listCbitacoraPaged({
      user: {
        id: user.id,
        rol: user.rol,
      },
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      date_from: date_from,
      date_to: date_to,
      rut_cliente: rut_cliente,
      id_corredor: id_corredor,
      estado: estado,
      search: search,
    });

    return res.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("Error en list cotizaciones:", err);
    return res.status(500).json({ 
      ok: false, 
      message: err?.message || "Server error" 
    });
  }
}


export async function ordenarGrillaBitacora(
  req: AuthedRequest,
  res: Response
) {
  try {
    const user = req.user;
    if (!user) {
      throw new AppError("User not authenticated", 401);  
    }

    const {
      sortBy,
      sortDir,
      page,
      limit,
      id_corredor,
      date_from,
      date_to,
      rut_cliente,
      estado, 
      search
      
    } = req.query as Record<string, string | undefined>;

    const result = await CotizacionService.ordenarCbitacoraPaged({
      user: {
        id: user.id,
        rol: user.rol
      },
      page,
      limit,
      sortBy,
      sortDir,
      id_corredor,
      date_from,
      date_to,
      rut_cliente,
      estado,
      search
      
    });

    return res.json({
      ok: true,
      ...result
    });
  } catch (err: any) {
    console.error("Error en ordenarGrillaBitacora:", err);

    const status =
      err instanceof AppError && (err as any).statusCode
        ? (err as any).statusCode
        : 500;

    return res.status(status).json({
      ok: false,
      message: err?.message || "Server error"
    });
  }
}