const IORedis = require('ioredis');

// Create IORedis connection specifically for BullMQ
const createBullMQConnection = () => {
  return new IORedis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    username: 'default',
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null, // Required for BullMQ workers
    retryStrategy: (times) => Math.min(times * 50, 2000), // Exponential backoff
  });
};

module.exports = { createBullMQConnection };
