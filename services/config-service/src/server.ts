import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { authRoutes } from './routes/auth';
import { projectRoutes } from './routes/projects';
import { configRoutes } from './routes/config';
import { profileRoutes } from './routes/profiles';
import { healthRoutes } from './routes/health';
import { metricsPlugin } from './middleware/metrics';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  });

  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'devflow-jwt-secret-change-in-production',
    sign: { expiresIn: '7d' },
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  app.setErrorHandler(errorHandler);

  await app.register(metricsPlugin);
  await app.register(healthRoutes, { prefix: '/' });
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(projectRoutes, { prefix: '/api/v1/projects' });
  await app.register(configRoutes, { prefix: '/api/v1/config' });
  await app.register(profileRoutes, { prefix: '/api/v1/profiles' });

  return app;
}

async function start() {
  try {
    const app = await buildApp();
    await app.listen({ port: PORT, host: HOST });
    logger.info(`Config Service running on ${HOST}:${PORT}`);
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}

start();

export { buildApp };
