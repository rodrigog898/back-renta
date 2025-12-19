
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
import cbitacoraRoutes from './routes/cbitacora.routes';
import emailroutes from './routes/email.routes';
import { startReminderCron } from './cron/email.cron';
import { startCaducarCotizacionesCron } from './cron/cCaducidad.cron';
import cotizacionroutes from './routes/cotizacion.routes';
import exportdataroutes from './routes/exportData.routes';

const app = express();

app.use(requestId);
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(requestTimeout());
startReminderCron();
startCaducarCotizacionesCron();
app.use('/api', apiLimiter);

app.get('/health/liveness', (_req, res) => res.json({ status: 'ok' }));
app.get('/health/readiness', (_req, res) => res.json({ status: 'ready' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/bitacora', cbitacoraRoutes, exportdataroutes ); 
app.use('/api/email', emailroutes);
app.use('/api/cotizacion', cotizacionroutes);


app.use(errorHandler);

export default app;
