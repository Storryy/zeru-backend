const { Queue } = require('bullmq');
const { createBullMQConnection } = require('../bullmq-redis');

const historyQueue = new Queue('history-fetcher', {
  connection: createBullMQConnection(),
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 100,
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
  settings: {
    stalledInterval: 30000,
    maxStalledCount: 3,
  }
});

module.exports = historyQueue;
