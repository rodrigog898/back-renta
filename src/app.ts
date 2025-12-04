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
import bitacoraRoutes from './routes/cbitacora.routes';
import cotizacionesRoutes from './routes/cmodificador.routes';
import exportarExcelRoutes from './routes/cExportarExcel.routes';
import exportarPdfRoutes from './routes/cExportarPdf.routes';
import autocompletadoRoutes from './routes/cAutocompletado.routes';

const app = express();

app.use(requestId);
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(requestTimeout());
app.use('/api', apiLimiter);

// Health endpoints
app.get('/health/liveness', (_req, res) => res.json({ status: 'ok' }));
app.get('/health/readiness', (_req, res) => res.json({ status: 'ready' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/bitacora', bitacoraRoutes, exportarExcelRoutes, autocompletadoRoutes);
app.use('/api/cotizaciones', cotizacionesRoutes, exportarPdfRoutes);




app.use(errorHandler);

export default app;
