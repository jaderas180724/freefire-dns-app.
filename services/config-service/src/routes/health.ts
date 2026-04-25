import { FastifyInstance, FastifyPluginCallback } from 'fastify';
import { pool } from '../utils/database';

export const healthRoutes: FastifyPluginCallback = (
  fastify: FastifyInstance,
  _opts,
  done
) => {
  fastify.get('/health', async (_request, reply) => {
    try {
      await pool.query('SELECT 1');
      return reply.send({
        status: 'healthy',
        service: 'config-service',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    } catch {
      return reply.status(503).send({
        status: 'unhealthy',
        service: 'config-service',
        timestamp: new Date().toISOString(),
      });
    }
  });

  done();
};
