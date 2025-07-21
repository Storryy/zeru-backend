const { Worker } = require('bullmq');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const { createAlchemyInstance } = require('../alchemy');
const { createBullMQConnection } = require('../bullmq-redis');
const { setCachedPrice } = require('../../utils/cache');

dayjs.extend(utc);

class HistoryWorker {
  constructor() {
    this.worker = new Worker('history-fetcher', this.processJob.bind(this), {
      connection: createBullMQConnection(),
      concurrency: 5,
      limiter: {
        max: 290,
        duration: 3600000,
      },
    });

    this.setupEventListeners();
  }

  async processJob(job) {
    const { token, network, timestamp, jobType } = job.data;
    
    try {
      console.log(`Processing ${jobType} for ${token} on ${network} at ${timestamp}`);
      
      if (jobType === 'fetch-daily-price') {
        return await this.fetchDailyPrice(job.data);
      } else if (jobType === 'schedule-batch') {
        return await this.scheduleBatch(job.data);
      }
      
    } catch (error) {
      console.error(`Job ${job.id} failed:`, error);
      throw error;
    }
  }

  async fetchDailyPrice({ token, network, timestamp }) {
    try {
      const alchemy = createAlchemyInstance(network);
      
      const response = await alchemy.prices.getHistoricalPriceByAddress(
        this.getNetworkEnum(network),
        token,
        timestamp,
        timestamp,
        'DAY'
      );

      if (!response.prices || response.prices.length === 0) {
        throw new Error(`No price data found for ${token} at ${timestamp}`);
      }

      const priceData = response.prices[0];
      
      await this.storePriceData({
        token,
        network,
        timestamp,
        price: priceData.price,
        source: 'alchemy'
      });

      await setCachedPrice(token, network, timestamp, {
        price: priceData.price,
        source: 'alchemy',
        fetchedAt: Date.now()
      });

      return {
        success: true,
        token,
        network,
        timestamp,
        price: priceData.price
      };

    } catch (error) {
      if (error.code === 429) {
        console.log(`Rate limited for ${token}, will retry with backoff`);
        throw new Error('Rate limited by Alchemy API');
      }
      throw error;
    }
  }

  async scheduleBatch({ token, network, startDate, endDate, totalDays }) {
    const historyQueue = require('../queues/historyQueue');
    
    console.log(`Creating ${totalDays} daily jobs for ${token}`);
    
    const jobs = [];
    const start = dayjs.unix(startDate);
    
    for (let i = 0; i < totalDays; i++) {
      const dayTimestamp = start.add(i, 'day').unix();
      
      jobs.push({
        name: 'fetch-daily-price',
        data: {
          token,
          network,
          timestamp: dayTimestamp,
          jobType: 'fetch-daily-price'
        },
        opts: {
          jobId: `price-${token}-${network}-${dayTimestamp}`,
          delay: i * 100,
        }
      });
    }

    await historyQueue.addBulk(jobs);
    
    return {
      success: true,
      jobsScheduled: jobs.length,
      token,
      network
    };
  }

  async storePriceData(data) {
    console.log('Storing price data:', data);
    // TODO: Add MongoDB implementation
  }

  getNetworkEnum(network) {
    const networks = {
      'ethereum': 'ETH_MAINNET',
      'polygon': 'POLYGON_MAINNET',
      'arbitrum': 'ARB_MAINNET',
      'optimism': 'OPT_MAINNET'
    };
    return networks[network.toLowerCase()] || 'ETH_MAINNET';
  }

  setupEventListeners() {
    this.worker.on('completed', (job, returnvalue) => {
      console.log(`✅ Job ${job.id} completed:`, returnvalue.token);
    });

    this.worker.on('failed', (job, err) => {
      console.log(`❌ Job ${job.id} failed:`, err.message);
    });

    this.worker.on('stalled', (jobId) => {
      console.log(`⚠️  Job ${jobId} stalled`);
    });

    process.on('SIGTERM', async () => {
      console.log('Shutting down worker gracefully...');
      await this.close();
    });
  }

  async close() {
    await this.worker.close();
  }
}

module.exports = HistoryWorker;
