import Redis from 'redis';

let redisClient: Redis.RedisClientType | null = null;

/**
 * Initialize Redis client for general use
 * Supports both local Redis and Upstash Redis (TLS)
 */
export const initRedis = async (): Promise<Redis.RedisClientType | null> => {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl === undefined || redisUrl === '') {
    console.log('Redis not configured, using in-memory fallback');
    return null;
  }

  try {
    // Determine if TLS is required based on URL protocol
    // Upstash uses rediss:// for TLS connections
    const useTLS = redisUrl.startsWith('rediss://');

    const clientOptions: Redis.RedisClientOptions = {
      url: redisUrl,
    };

    // Enable TLS with strict certificate verification for Upstash and other cloud Redis providers
    if (useTLS) {
      const caCert = process.env.REDIS_CA_CERT ?? process.env.DB_CA_CERT;
      clientOptions.socket = {
        tls: true,
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2',
        ...(caCert !== undefined && caCert !== '' ? { ca: caCert } : {}),
      };
    }

    const client = Redis.createClient(clientOptions);

    client.on('error', (err) => {
      console.error('Redis client error:', err);
    });

    client.on('connect', () => {
      console.log(`Redis connected successfully (TLS: ${useTLS})`);
    });

    client.on('reconnecting', () => {
      console.log('Redis reconnecting...');
    });

    await client.connect();
    console.log('Redis connection established');

    // Only assign after successful connection
    redisClient = client as Redis.RedisClientType;
    return redisClient;
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    console.log('Continuing without Redis - rate limiting will use in-memory store');
    return null;
  }
};

export const getRedisClient = (): Redis.RedisClientType | null => redisClient;
