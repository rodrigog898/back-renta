import axios, { AxiosError, AxiosInstance } from "axios";

export type CatalogoProductos = {
  version: string; // puede ser ""
  fechaCreacion: string | null;
  fechaFinVigencia: string | null;
  recomendacionIA: string;
  planes: Array<{
    id: string;
    nombre: string;
    descripcion: string;
    recomendado: boolean;
    coberturasDestacadas: string[];
    ofertas: Array<{
      ofertaId: string;
      nombre: string;
      deducible: number;
      primaUF: number;
      primaPesos: number;
      recomendado: boolean;
    }>;
    opcionalesDisponibles: Array<{
      opcionalId: string;
      nombre: string;
      opciones: Array<{
        opcionId: string;
        nombre: string;
      }>;
    }>;
  }>;
};

type CatalogoApiResponse = {
  version?: string;
  fechaCreacion?: string;
  fechaFinVigencia?: string;
  recomendacionIA?: string;
  planes?: any[];
};

function parseDateOrNull(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeBaseUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

// Caché en memoria para el catálogo
let catalogoCache: CatalogoProductos | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos en milisegundos

export class ProductosCatalogoService {
  private client: AxiosInstance;

  /**
   * @param sourceUrl URL base del proveedor de catálogo (ENV)
   * @param catalogoPath path del endpoint de catálogo (por defecto "")
   */
  constructor(
    private readonly sourceUrl: string,
    private readonly catalogoPath: string = ""  
  ) {
    if (!sourceUrl) throw new Error("PRODUCTOS_CATALOGO_URL no está configurada");

    this.client = axios.create({
      baseURL: normalizeBaseUrl(sourceUrl),
      timeout: 3000,
      headers: { "Content-Type": "application/json" },
    });
  }

  async obtenerCatalogo(): Promise<CatalogoProductos> {
    // Verificar si hay caché válido
    const now = Date.now();
    if (catalogoCache && (now - cacheTimestamp) < CACHE_DURATION) {
      // Retornar caché si es válido (menos de 5 minutos)
      return catalogoCache;
    }

    try {
      const { data } = await this.client.get<CatalogoApiResponse>(this.catalogoPath);

      const planes = asArray<any>(data.planes).map((plan) => ({
        id: String(plan?.id ?? ""),
        nombre: String(plan?.nombre ?? ""),
        descripcion: String(plan?.descripcion ?? ""),
        recomendado: Boolean(plan?.recomendado),
        coberturasDestacadas: asArray<any>(plan?.coberturasDestacadas).map((x) => String(x)),
        ofertas: asArray<any>(plan?.ofertas).map((oferta) => ({
          ofertaId: String(oferta?.ofertaId ?? ""),
          nombre: String(oferta?.nombre ?? ""),
          deducible: Number(oferta?.deducible ?? 0),
          primaUF: Number(oferta?.primaUF ?? 0),
          primaPesos: Number(oferta?.primaPesos ?? 0),
          recomendado: Boolean(oferta?.recomendado),
        })),
        opcionalesDisponibles: asArray<any>(plan?.opcionalesDisponibles).map((opcional) => ({
          opcionalId: String(opcional?.opcionalId ?? ""),
          nombre: String(opcional?.nombre ?? ""),
          opciones: asArray<any>(opcional?.opciones).map((opcion) => ({
            opcionId: String(opcion?.opcionId ?? ""),
            nombre: String(opcion?.nombre ?? ""),
          })),
        })),
      }));

      const catalogo: CatalogoProductos = {
        version: data.version ?? "",
        fechaCreacion: parseDateOrNull(data.fechaCreacion),
        fechaFinVigencia: parseDateOrNull(data.fechaFinVigencia),
        recomendacionIA: String(data.recomendacionIA ?? ""),
        planes,
      };

      // Guardar en caché
      catalogoCache = catalogo;
      cacheTimestamp = now;

      return catalogo;
    } catch (err) {
      if (catalogoCache && (Date.now() - cacheTimestamp) < CACHE_DURATION * 2) {
        // Permitir usar caché hasta 10 minutos si hay error
        return catalogoCache;
      }

      if (axios.isAxiosError(err)) {
        const e = err as AxiosError;
        const status = e.response?.status;
        const msg = `Error consultando catálogo (${status ?? "sin status"}): ${e.message}`;

        const wrapped: any = new Error(msg);
        wrapped.statusCode = 502; 
        wrapped.originalStatus = status;
        throw wrapped;
      }
      throw err;
    }
  }
}