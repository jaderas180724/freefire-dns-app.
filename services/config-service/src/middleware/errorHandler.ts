import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { logger } from '../utils/logger';

export function errorHandler(
  error: FastifyError,
  _request: FastifyRequest,
  reply: FastifyReply
) {
  logger.error({ err: error }, 'Request error');

  if (error.validation) {
    return reply.status(400).send({
      error: 'Validation Error',
      message: error.message,
      statusCode: 400,
    });
  }

  if (error.statusCode === 429) {
    return reply.status(429).send({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      statusCode: 429,
    });
  }

  const statusCode = error.statusCode || 500;
  return reply.status(statusCode).send({
    error: error.name || 'Internal Server Error',
    message:
      statusCode === 500
        ? 'An internal server error occurred'
        : error.message,
    statusCode,
  });
}
