
import dotenv from 'dotenv';
dotenv.config();

export interface EnvConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  mongoUri: string;
  mongoPool: number;
  jwtSecret: string;
  requestTimeoutMs: number;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFromName?: string; 
 }
const env: EnvConfig = {
  nodeEnv: (process.env.NODE_ENV as any) || 'development',
  port: Number(process.env.PORT || 3000),
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/app',
  mongoPool: Number(process.env.MONGO_POOL || 10),
  jwtSecret: process.env.JWT_SECRET || 'sadsadsadsa',
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS || 10000),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 100),
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpFromName: process.env.SMTP_FROM_NAME || 'Sistema de Cotizaciones'
};

export default env;
