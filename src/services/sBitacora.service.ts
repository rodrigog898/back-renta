import Cotizacion from "../models/sBitacora";
import { AuthedRequest } from "../middleware/auth";

function normalizarFecha(fecha: string) {
  return fecha.replace(/(\d{2})-(\d{2})-(\d{4})/, "$3-$2-$1");
}

export async function listarBitacora(req: AuthedRequest) {
  const userId = req.user?.id;
  if (!userId) throw new Error("Usuario no autenticado");


  const filtros: any = { id_corredor: userId };

  if (req.query.estado) filtros.estado = req.query.estado;

  if (req.query.cliente) {
    const s = String(req.query.cliente);
    filtros.$and = filtros.$and || [];
    filtros.$and.push({
      $or: [
        { "cliente.nombre": { $regex: s, $options: "i" } },
        { "cliente.apellido": { $regex: s, $options: "i" } }
      ]
    });
  }

  if (req.query.vehiculo) {
    const s = String(req.query.vehiculo);
    filtros.$and = filtros.$and || [];
    filtros.$and.push({
      $or: [
        { "vehiculo.marca": { $regex: s, $options: "i" } },
        { "vehiculo.modelo": { $regex: s, $options: "i" } }
      ]
    });
  }

  
  let datos = await Cotizacion.find(filtros).lean();

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
    const campos = sortStr.split(",").map((t) => t.trim());
    const dirs = dirStr.split(",").map((t) => t.trim());

    campos.forEach((campo, i) => {
      const campoReal = mapaOrden[campo];
      if (!campoReal) return;
      const direccion = dirs[i] === "desc" ? -1 : 1;

      ordenamientos.push({ campo: campoReal, dir: direccion });
    });
  }

  
  if (ordenamientos.length === 0) {
    ordenamientos.push({ campo: "fecha_cotizacion", dir: -1 });
  }

  datos.sort((a: any, b: any) => {
    for (const orden of ordenamientos) {
      const partes = orden.campo.split(".");
      let valA: any = a;
      let valB: any = b;

      for (const p of partes) {
        valA = valA?.[p];
        valB = valB?.[p];
      }

      if (orden.campo === "fecha_cotizacion") {
        valA = valA ? normalizarFecha(String(valA)) : "";
        valB = valB ? normalizarFecha(String(valB)) : "";
      }

      if (valA == null) valA = "";
      if (valB == null) valB = "";

      let salida = 0;

      if (typeof valA === "number" && typeof valB === "number") {
        salida = valA - valB;
      } else {
        salida = String(valA).localeCompare(String(valB), "es", {
          numeric: true,
          sensitivity: "base"
        });
      }

      if (salida !== 0) return salida * orden.dir;
    }

    return 0;
  });
  
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 50;
  const total = datos.length;
  const skip = (page - 1) * limit;

  return {
    datos: datos.slice(skip, skip + limit),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}
