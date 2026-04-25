import { FastifyInstance, FastifyPluginCallback } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { query } from '../utils/database';
import { cacheDel } from '../utils/redis';
import { authenticate } from '../middleware/auth';

const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  masterSwitch: z.boolean().optional(),
  injectionValue: z.string().optional(),
  jsonTemplate: z.record(z.unknown()).optional(),
});

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function generateProxySubdomain(userId: string, projectId: string): string {
  const uShort = userId.slice(0, 8);
  const pShort = projectId.slice(0, 8);
  return `proxy-u${uShort}-p${pShort}`;
}

export const projectRoutes: FastifyPluginCallback = (
  fastify: FastifyInstance,
  _opts,
  done
) => {
  fastify.addHook('preHandler', authenticate);

  // List projects
  fastify.get('/', async (request, reply) => {
    const result = await query(
      `SELECT p.*, 
        (SELECT COUNT(*) FROM target_keys tk WHERE tk.project_id = p.id) as key_count
       FROM projects p 
       WHERE p.user_id = $1 
       ORDER BY p.created_at DESC`,
      [request.userId]
    );
    return reply.send({ projects: result.rows });
  });

  // Create project
  fastify.post('/', async (request, reply) => {
    const body = createProjectSchema.parse(request.body);
    const id = uuidv4();
    const slug = generateSlug(body.name);
    const proxySubdomain = generateProxySubdomain(request.userId!, id);

    await query(
      `INSERT INTO projects (id, user_id, name, description, slug, proxy_subdomain) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, request.userId, body.name, body.description || '', slug, proxySubdomain]
    );

    const result = await query('SELECT * FROM projects WHERE id = $1', [id]);
    return reply.status(201).send({ project: result.rows[0] });
  });

  // Get project by ID
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const result = await query(
      'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
      [request.params.id, request.userId]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
        statusCode: 404,
      });
    }

    const keys = await query(
      'SELECT * FROM target_keys WHERE project_id = $1 ORDER BY created_at ASC',
      [request.params.id]
    );

    const history = await query(
      'SELECT * FROM injection_history WHERE project_id = $1 ORDER BY used_at DESC LIMIT 20',
      [request.params.id]
    );

    return reply.send({
      project: result.rows[0],
      targetKeys: keys.rows,
      injectionHistory: history.rows,
    });
  });

  // Update project
  fastify.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const body = updateProjectSchema.parse(request.body);
    const projectId = request.params.id;

    const existing = await query(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
      [projectId, request.userId]
    );

    if (existing.rows.length === 0) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
        statusCode: 404,
      });
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (body.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(body.name);
    }
    if (body.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(body.description);
    }
    if (body.masterSwitch !== undefined) {
      updates.push(`master_switch = $${paramIndex++}`);
      values.push(body.masterSwitch);
    }
    if (body.injectionValue !== undefined) {
      updates.push(`injection_value = $${paramIndex++}`);
      values.push(body.injectionValue);

      await query(
        'INSERT INTO injection_history (id, project_id, injection_value) VALUES ($1, $2, $3)',
        [uuidv4(), projectId, body.injectionValue]
      );
    }
    if (body.jsonTemplate !== undefined) {
      updates.push(`json_template = $${paramIndex++}`);
      values.push(JSON.stringify(body.jsonTemplate));
    }

    updates.push(`updated_at = NOW()`);
    values.push(projectId);

    await query(
      `UPDATE projects SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    await cacheDel(`project:${projectId}`);

    const result = await query('SELECT * FROM projects WHERE id = $1', [
      projectId,
    ]);
    return reply.send({ project: result.rows[0] });
  });

  // Delete project
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    async (request, reply) => {
      const result = await query(
        'DELETE FROM projects WHERE id = $1 AND user_id = $2 RETURNING id',
        [request.params.id, request.userId]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Project not found',
          statusCode: 404,
        });
      }

      await cacheDel(`project:${request.params.id}`);
      return reply.send({ message: 'Project deleted successfully' });
    }
  );

  // ─── Target Keys Management ───

  // Add target key
  fastify.post<{ Params: { id: string } }>(
    '/:id/keys',
    async (request, reply) => {
      const projectId = request.params.id;
      const body = z
        .object({
          keyPath: z.string().min(1),
          description: z.string().optional(),
        })
        .parse(request.body);

      const project = await query(
        'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
        [projectId, request.userId]
      );

      if (project.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Project not found',
          statusCode: 404,
        });
      }

      const id = uuidv4();
      await query(
        'INSERT INTO target_keys (id, project_id, key_path, description) VALUES ($1, $2, $3, $4)',
        [id, projectId, body.keyPath, body.description || '']
      );

      await cacheDel(`project:${projectId}`);

      const result = await query('SELECT * FROM target_keys WHERE id = $1', [
        id,
      ]);
      return reply.status(201).send({ targetKey: result.rows[0] });
    }
  );

  // Update target key
  fastify.put<{ Params: { id: string; keyId: string } }>(
    '/:id/keys/:keyId',
    async (request, reply) => {
      const body = z
        .object({
          keyPath: z.string().min(1).optional(),
          description: z.string().optional(),
          isActive: z.boolean().optional(),
        })
        .parse(request.body);

      const project = await query(
        'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
        [request.params.id, request.userId]
      );

      if (project.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Project not found',
          statusCode: 404,
        });
      }

      const updates: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      if (body.keyPath !== undefined) {
        updates.push(`key_path = $${idx++}`);
        values.push(body.keyPath);
      }
      if (body.description !== undefined) {
        updates.push(`description = $${idx++}`);
        values.push(body.description);
      }
      if (body.isActive !== undefined) {
        updates.push(`is_active = $${idx++}`);
        values.push(body.isActive);
      }

      updates.push(`updated_at = NOW()`);
      values.push(request.params.keyId);

      await query(
        `UPDATE target_keys SET ${updates.join(', ')} WHERE id = $${idx}`,
        values
      );

      await cacheDel(`project:${request.params.id}`);

      const result = await query(
        'SELECT * FROM target_keys WHERE id = $1',
        [request.params.keyId]
      );
      return reply.send({ targetKey: result.rows[0] });
    }
  );

  // Delete target key
  fastify.delete<{ Params: { id: string; keyId: string } }>(
    '/:id/keys/:keyId',
    async (request, reply) => {
      await query(
        'DELETE FROM target_keys WHERE id = $1 AND project_id = $2',
        [request.params.keyId, request.params.id]
      );

      await cacheDel(`project:${request.params.id}`);
      return reply.send({ message: 'Target key deleted' });
    }
  );

  done();
};
