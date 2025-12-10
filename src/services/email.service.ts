// src/services/email.service.ts
import nodemailer, { Transporter } from 'nodemailer';
import env from '../config/env';
import { retry } from '../utils/retry';
import { CircuitBreaker } from '../utils/circuitBreaker';
import logger from '../logger';

interface SendEmailParams {
  to: string;
  subject: string;
  message: string;
}

class EmailService {
  private transporter: Transporter | null = null;
  private circuitBreaker: CircuitBreaker;
  private isInitialized = false;

  constructor() {
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      halfOpenAfterMs: 30000,
      name: 'email-service'
    });
    this.initialize();
  }

  private initialize(): void {
    try {
      if (!env.smtpHost || !env.smtpUser || !env.smtpPass) {
        logger.warn('[EmailService] SMTP credentials not configured');
        return;
      }

      this.transporter = nodemailer.createTransport({
        host: env.smtpHost,
        port: env.smtpPort,
        secure: env.smtpPort === 465,
        auth: {
          user: env.smtpUser,
          pass: env.smtpPass
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        rateDelta: 1000,
        rateLimit: 10
      });

      this.isInitialized = true;
      logger.info(`[EmailService] Initialized with ${env.smtpHost}:${env.smtpPort}`);
    } catch (error) {
      logger.error('[EmailService] Initialization failed:', error);
      this.isInitialized = false;
    }
  }

  async sendEmail(params: SendEmailParams): Promise<boolean> {
    if (!this.isInitialized || !this.transporter) {
      const err: any = new Error('Email service not initialized');
      err.status = 503;
      err.expose = true;
      throw err;
    }

    if (!params.to || !params.subject || !params.message) {
      const err: any = new Error('Missing required email parameters');
      err.status = 400;
      err.expose = true;
      throw err;
    }

    try {
      await this.circuitBreaker.run(async () => {
        await retry(
          async () => {
            const info = await this.transporter!.sendMail({
              from: `"${env.smtpUser}" <${env.smtpUser}>`,
              to: params.to,
              subject: params.subject,
              text: params.message,
              headers: {
                'X-Priority': '3',
                'X-Mailer': 'NodeMailer'
              }
            });

            logger.info(`[EmailService] Email sent to ${params.to} | MessageId: ${info.messageId}`);
            return info;
          },
          {
            retries: 3,
            minDelayMs: 500,
            maxDelayMs: 3000,
            factor: 2,
            onRetry: (err, attempt) => {
              logger.warn(`[EmailService] Retry #${attempt} for ${params.to}`, (err as any)?.message || err);
            },
            isRetryable: (err: any) => {
              const retryableCodes = ['ECONNECTION', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'];
              return retryableCodes.some(code => err?.message?.includes(code));
            }
          }
        );
      });

      return true;
    } catch (error: any) {
      logger.error(`[EmailService] Failed to send email to ${params.to}:`, error);
      
      if (error.message?.includes('Circuit') && error.message?.includes('OPEN')) {
        const err: any = new Error('Email service temporarily unavailable');
        err.status = 503;
        err.expose = true;
        err.code = 'SERVICE_UNAVAILABLE';
        throw err;
      }

      const err: any = new Error('Failed to send email');
      err.status = 500;
      err.expose = true;
      err.code = 'EMAIL_SEND_FAILED';
      err.details = error.message;
      throw err;
    }
  }

  async verifyConnection(): Promise<boolean> {
    if (!this.isInitialized || !this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      logger.info('[EmailService] Connection verified');
      return true;
    } catch (error) {
      logger.error('[EmailService] Connection verification failed:', error);
      return false;
    }
  }

  getStatus(): { initialized: boolean; host: string; port: number } {
    return {
      initialized: this.isInitialized,
      host: env.smtpHost || 'not-configured',
      port: env.smtpPort
    };
  }
}

// Singleton instance
const emailService = new EmailService();

export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  return emailService.sendEmail(params);
}

export async function verifyConnection(): Promise<boolean> {
  return emailService.verifyConnection();
}

export function getStatus() {
  return emailService.getStatus();
}