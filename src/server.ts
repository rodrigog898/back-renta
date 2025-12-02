
import http from 'http';
import app from './app';
import env from './config/env';
import { connectDB, disconnectDB } from './config/db';
import logger from './logger';

const server = http.createServer(app);

async function start() {
  try {
    await connectDB();
    server.listen(env.port, () => {
      logger.info(`Server running on port ${env.port}`);
    });
  } catch (e) {
    logger.error('Failed to start server', e);
    process.exit(1);
  }
}

const shutdown = async (signal: string) => {
  logger.warn(`Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    try {
      await disconnectDB();
    } finally {
      process.exit(0);
    }
  });
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', err);
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', reason);
});

start();
