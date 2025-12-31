import { Response } from "express";
import { AuthedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/AppError";
import { obtenerCotizacionCompletaPorId } from "../../services/cotizacion.service";
import { ProductosCatalogoService } from "../../services/cotizacion/producto.service";

export async function obtenerProductosCotizacion(
  req: AuthedRequest,
  res: Response
) {
  const { idCotizacion } = req.params;

  if (!idCotizacion) {
    throw new AppError("idCotizacion requerido", 400);
  }

  const cotizacion = await obtenerCotizacionCompletaPorId(idCotizacion);
  const productosApiUrl = process.env.PRODUCTOS_API_URL || process.env.PRODUCTOS_CATALOGO_URL;
  
  if (!productosApiUrl) {
    throw new AppError("PRODUCTOS_API_URL no está configurada", 500);
  }

  const catalogoService = new ProductosCatalogoService(productosApiUrl);
  const catalogo = await catalogoService.obtenerCatalogo();

  return res.json({
    idCotizacion,
    catalogo,
    producto: cotizacion.producto || null,
  });
}

