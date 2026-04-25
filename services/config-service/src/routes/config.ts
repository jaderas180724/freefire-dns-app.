import { FastifyInstance, FastifyPluginCallback } from 'fastify';
import { query } from '../utils/database';
import { cacheGet, cacheSet } from '../utils/redis';
import { logger } from '../utils/logger';

export const configRoutes: FastifyPluginCallback = (
  fastify: FastifyInstance,
  _opts,
  done
) => {
  // Internal endpoint: Get project config by proxy subdomain
  // Used by the Go proxy interceptor service
  fastify.get<{ Params: { subdomain: string } }>(
    '/proxy/:subdomain',
    async (request, reply) => {
      const { subdomain } = request.params;

      // Check cache first
      const cached = await cacheGet(`project:subdomain:${subdomain}`);
      if (cached) {
        logger.debug({ subdomain }, 'Config cache hit');
        return reply.send(JSON.parse(cached));
      }

      const projectResult = await query(
        'SELECT * FROM projects WHERE proxy_subdomain = $1',
        [subdomain]
      );

      if (projectResult.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Project not found for subdomain',
          statusCode: 404,
        });
      }

      const project = projectResult.rows[0];

      const keysResult = await query(
        'SELECT key_path FROM target_keys WHERE project_id = $1 AND is_active = true',
        [project.id]
      );

      const config = {
        projectId: project.id,
        masterSwitch: project.master_switch,
        injectionValue: project.injection_value,
        jsonTemplate: project.json_template,
        targetKeys: keysResult.rows.map(
          (row: { key_path: string }) => row.key_path
        ),
      };

      // Cache for 30 seconds
      await cacheSet(
        `project:subdomain:${subdomain}`,
        JSON.stringify(config),
        30
      );

      return reply.send(config);
    }
  );

  // Internal endpoint: Log a proxy request
  fastify.post('/proxy/log', async (request, reply) => {
    const body = request.body as {
      projectId: string;
      method: string;
      url: string;
      statusCode: number;
      wasModified: boolean;
      responseTimeMs: number;
    };

    await query(
      `INSERT INTO request_logs (id, project_id, method, url, status_code, was_modified, response_time_ms)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`,
      [
        body.projectId,
        body.method,
        body.url,
        body.statusCode,
        body.wasModified,
        body.responseTimeMs,
      ]
    );

    return reply.send({ status: 'logged' });
  });

  // Get request logs for a project (authenticated)
  fastify.get<{ Params: { projectId: string }; Querystring: { limit?: string; offset?: string } }>(
    '/logs/:projectId',
    async (request, reply) => {
      const limit = parseInt(request.query.limit || '50', 10);
      const offset = parseInt(request.query.offset || '0', 10);

      const result = await query(
        `SELECT * FROM request_logs 
         WHERE project_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2 OFFSET $3`,
        [request.params.projectId, limit, offset]
      );

      const countResult = await query(
        'SELECT COUNT(*) FROM request_logs WHERE project_id = $1',
        [request.params.projectId]
      );

      return reply.send({
        logs: result.rows,
        total: parseInt(countResult.rows[0].count, 10),
        limit,
        offset,
      });
    }
  );

  done();
};
