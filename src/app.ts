import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { apiLimiter } from './middleware/rateLimit';
import { requestId } from './middleware/requestId';
import { requestTimeout } from './middleware/timeout';
import { errorHandler } from './middleware/errorHandler';

import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import bitacoraKpiRoutes from './routes/cbitacoraKpi.routes';
import editarCotizacionRoutes from './routes/cmodificarCotizacion.routes';
import exportarExcelRoutes from './routes/cExportarExcel.routes';
import exportarPdfRoutes from './routes/cExportarPdf.routes';
import autocompletadoRoutes from './routes/cAutocompletado.routes';
import cBitacoraRoutes from './routes/cbitacoraKpi.routes';
import cCotizacionRoutes from "./routes/cCotizacion.routes";

const app = express();

app.use(requestId);
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(requestTimeout());
app.use('/api', apiLimiter);

app.get('/health/liveness', (_req, res) => res.json({ status: 'ok' }));
app.get('/health/readiness', (_req, res) => res.json({ status: 'ready' }));

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);

app.use('/api/bitacora',
  bitacoraKpiRoutes,
  exportarExcelRoutes,
  autocompletadoRoutes,
  cBitacoraRoutes
);

app.use('/api/cotizaciones',
  cCotizacionRoutes,
  editarCotizacionRoutes,
  exportarPdfRoutes
);

app.use(errorHandler);

export default app;
