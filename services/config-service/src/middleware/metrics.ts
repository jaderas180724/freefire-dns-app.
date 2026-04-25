import { FastifyInstance, FastifyPluginCallback } from 'fastify';
import client from 'prom-client';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const metricsPlugin: FastifyPluginCallback = (
  fastify: FastifyInstance,
  _opts,
  done
) => {
  fastify.addHook('onRequest', async (request) => {
    (request as unknown as Record<string, unknown>).__startTime = process.hrtime.bigint();
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const startTime = (request as unknown as Record<string, unknown>).__startTime as bigint;
    if (startTime) {
      const duration =
        Number(process.hrtime.bigint() - startTime) / 1_000_000_000;
      const route = request.routeOptions?.url || request.url;
      const labels = {
        method: request.method,
        route,
        status_code: reply.statusCode.toString(),
      };
      httpRequestDuration.observe(labels, duration);
      httpRequestsTotal.inc(labels);
    }
  });

  fastify.get('/metrics', async (_request, reply) => {
    reply.header('Content-Type', register.contentType);
    return register.metrics();
  });

  done();
};
