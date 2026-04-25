import { FastifyInstance, FastifyPluginCallback } from 'fastify';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { query } from '../utils/database';
import { authenticate } from '../middleware/auth';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const authRoutes: FastifyPluginCallback = (
  fastify: FastifyInstance,
  _opts,
  done
) => {
  // Register
  fastify.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const { email, password, name } = body;

    const existing = await query('SELECT id FROM users WHERE email = $1', [
      email,
    ]);
    if (existing.rows.length > 0) {
      return reply.status(409).send({
        error: 'Conflict',
        message: 'Email already registered',
        statusCode: 409,
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const id = uuidv4();

    await query(
      'INSERT INTO users (id, email, password_hash, name, provider) VALUES ($1, $2, $3, $4, $5)',
      [id, email, passwordHash, name, 'local']
    );

    const token = fastify.jwt.sign({ id, email, name });

    return reply.status(201).send({
      user: { id, email, name },
      token,
    });
  });

  // Login
  fastify.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const { email, password } = body;

    const result = await query(
      'SELECT id, email, name, password_hash FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid credentials',
        statusCode: 401,
      });
    }

    const user = result.rows[0];

    if (!user.password_hash) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Account uses OAuth login',
        statusCode: 401,
      });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid credentials',
        statusCode: 401,
      });
    }

    const token = fastify.jwt.sign({
      id: user.id,
      email: user.email,
      name: user.name,
    });

    return reply.send({
      user: { id: user.id, email: user.email, name: user.name },
      token,
    });
  });

  // OAuth callback (Google/GitHub)
  fastify.post('/oauth/callback', async (request, reply) => {
    const body = z
      .object({
        provider: z.enum(['google', 'github']),
        providerId: z.string(),
        email: z.string().email(),
        name: z.string(),
        avatarUrl: z.string().optional(),
      })
      .parse(request.body);

    let result = await query(
      'SELECT id, email, name FROM users WHERE provider = $1 AND provider_id = $2',
      [body.provider, body.providerId]
    );

    let user;
    if (result.rows.length === 0) {
      const existingEmail = await query(
        'SELECT id FROM users WHERE email = $1',
        [body.email]
      );
      if (existingEmail.rows.length > 0) {
        return reply.status(409).send({
          error: 'Conflict',
          message: 'Email already registered with a different provider',
          statusCode: 409,
        });
      }

      const id = uuidv4();
      await query(
        'INSERT INTO users (id, email, name, avatar_url, provider, provider_id) VALUES ($1, $2, $3, $4, $5, $6)',
        [id, body.email, body.name, body.avatarUrl || null, body.provider, body.providerId]
      );
      user = { id, email: body.email, name: body.name };
    } else {
      user = result.rows[0];
    }

    const token = fastify.jwt.sign({
      id: user.id,
      email: user.email,
      name: user.name,
    });

    return reply.send({ user, token });
  });

  // Get current user
  fastify.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const result = await query(
      'SELECT id, email, name, avatar_url, provider, created_at FROM users WHERE id = $1',
      [request.userId]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'User not found',
        statusCode: 404,
      });
    }

    return reply.send({ user: result.rows[0] });
  });

  done();
};
