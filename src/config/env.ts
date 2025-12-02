
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
}

const env: EnvConfig = {
  nodeEnv: (process.env.NODE_ENV as any) || 'development',
  port: Number(process.env.PORT || 3000),
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/app',
  mongoPool: Number(process.env.MONGO_POOL || 10),
  jwtSecret: process.env.JWT_SECRET || 'sadsadsadsa',
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS || 10000),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 100)
};

export default env;
