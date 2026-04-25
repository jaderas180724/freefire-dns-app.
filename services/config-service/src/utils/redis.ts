import { createClient } from 'redis';
import { logger } from './logger';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const redisClient = createClient({ url: redisUrl });

redisClient.on('error', (err) => {
  logger.error('Redis Client Error', err);
});

redisClient.on('connect', () => {
  logger.info('Connected to Redis');
});

let isConnected = false;

export async function getRedis() {
  if (!isConnected) {
    await redisClient.connect();
    isConnected = true;
  }
  return redisClient;
}

export async function cacheGet(key: string): Promise<string | null> {
  const client = await getRedis();
  return client.get(key);
}

export async function cacheSet(
  key: string,
  value: string,
  ttlSeconds = 300
): Promise<void> {
  const client = await getRedis();
  await client.set(key, value, { EX: ttlSeconds });
}

export async function cacheDel(key: string): Promise<void> {
  const client = await getRedis();
  await client.del(key);
}

export { redisClient };
