import { FastifyReply, FastifyRequest } from 'fastify';

export interface JWTPayload {
  id: string;
  email: string;
  name: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    userEmail?: string;
  }
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const decoded = await request.jwtVerify<JWTPayload>();
    request.userId = decoded.id;
    request.userEmail = decoded.email;
  } catch (err) {
    reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
      statusCode: 401,
    });
  }
}
