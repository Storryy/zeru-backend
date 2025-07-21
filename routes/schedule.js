const express = require('express');
const router = express.Router();
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const { createAlchemyInstance } = require('../lib/alchemy');
const { validateRequest, scheduleSchema } = require('../utils/validation');
const historyQueue = require('../lib/queues/historyQueue');

dayjs.extend(utc);

router.post('/', validateRequest(scheduleSchema), async (req, res) => {
  const { token, network } = req.body;

  try {
    const alchemy = createAlchemyInstance(network);
    
    // Get token birthday (your existing logic)
    const firstTx = await alchemy.core.getAssetTransfers({
      contractAddresses: [token],
      category: ["erc20"],
      order: "asc",
      maxCount: 1,
      withMetadata: true
    });

    if (!firstTx.transfers?.length) {
      return res.status(404).json({ error: 'No transfers found' });
    }

    const creationDate = firstTx.transfers[0].metadata.blockTimestamp;
    
    // Calculate daily timestamps from creation to now
    const startDate = dayjs(creationDate).utc().startOf('day');
    const endDate = dayjs().utc().startOf('day');
    const totalDays = endDate.diff(startDate, 'day') + 1;

    // Add batch job to BullMQ queue
    const batchJob = await historyQueue.add(
      'schedule-batch',
      {
        token,
        network,
        creationDate: creationDate,
        startDate: startDate.unix(),
        endDate: endDate.unix(),
        totalDays,
        jobType: 'schedule-batch'
      },
      {
        jobId: `batch-${token}-${network}`,
        priority: 10
      }
    );

    return res.json({
      success: true,
      creationDate,
      totalDays,
      batchJobId: batchJob.id,
      message: `Scheduled ${totalDays} daily price fetches for ${token} on ${network}`
    });

  } catch (err) {
    console.error('Schedule API Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
