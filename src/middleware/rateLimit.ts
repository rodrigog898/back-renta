
import rateLimit from 'express-rate-limit';
import env from '../config/env';

export const apiLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false
});
