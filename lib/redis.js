const { createClient } = require('redis');

const client = createClient({
  socket: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
  },
  username: 'default',
  password: process.env.REDIS_PASSWORD,
});

client.on('error', (err) => {
    console.error('❌ Redis connection error:', err);
  });
  
  client.on('connect', () => {
    console.log('✅ Connected to Redis Cloud');
  });
  
  (async () => {
    await client.connect();
  })();
  
  module.exports = client;
  