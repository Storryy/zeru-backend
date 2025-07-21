const express = require('express');
const router = express.Router();
const pRetry = require('p-retry').default;
const { AbortError } = require('p-retry');
const { createAlchemyInstance } = require('../lib/alchemy');
const { interpolatePrice } = require('../utils/interpolate');
const { getCachedPrice, setCachedPrice } = require('../utils/cache');
const { validateRequest, priceSchema, NETWORKS } = require('../utils/validation');
const { Network } = require('alchemy-sdk');

// Configuration
const RETRY_OPTIONS = {
  retries: 3,
  factor: 2,
  minTimeout: 1000,
  maxTimeout: 10000
};

// Helper Functions
const getNetworkName = (network) => {
  return network === NETWORKS.ETHEREUM ? Network.ETH_MAINNET : Network.MATIC_MAINNET;
};

const generateTimeRange = (timestamp) => {
  const startDate = new Date((timestamp - 600) * 1000).toISOString();
  const endDate = new Date((timestamp + 600) * 1000).toISOString();
  return { startDate, endDate };
};

const isRetryableError = (error) => {
  const message = error.message || '';
  return message.includes('429:') || // Rate limit
         message.includes('500:') || // Server error
         message.includes('502:') || // Bad gateway
         message.includes('503:') || // Service unavailable
         message.includes('timeout') ||
         message.includes('network');
};

const isBadRequestError = (error) => {
  return error.message && error.message.includes('400:');
};

// API Functions
const fetchPriceDataWithRetry = async (alchemy, networkName, token, startDate, endDate) => {
  return pRetry(async () => {
    try {
      const priceData = await alchemy.prices.getHistoricalPriceByAddress(
        networkName,
        token,
        startDate,
        endDate,
        '5m'
      );
      
      if (!priceData || !priceData.data || priceData.data.length === 0) {
        throw new Error('No data available for this timestamp');
      }
      
      return priceData;
    } catch (error) {
      if (isBadRequestError(error)) {
        throw new AbortError(`Bad request - token not found: ${token}`);
      }
      
      if (isRetryableError(error)) {
        throw error;
      }
      
      if (error.message.includes('No data available for this timestamp')) {
        throw new AbortError('No data available for this timestamp');
      }
      throw new AbortError(`Non-retryable error: ${error.message}`);
    }
  }, RETRY_OPTIONS);
};

const handleCacheHit = (cachedResult, token, network, timestamp) => {
  return {
    price: cachedResult.price,
    source: 'cache'
  };
};

const fetchAndProcessPrice = async (token, network, timestamp) => {
  const alchemy = createAlchemyInstance(network);
  const { startDate, endDate } = generateTimeRange(timestamp);
  const networkName = getNetworkName(network);
  
  const priceData = await fetchPriceDataWithRetry(alchemy, networkName, token, startDate, endDate);
  const interpolatedPrice = interpolatePrice(priceData, timestamp);
  
  return {
    price: interpolatedPrice.price,
    source: interpolatedPrice.source
  };
};



// Error Handling
const handleError = (err, token, network, timestamp) => {
  console.error('Price API Error:', err.message);
  
  // Retry error
  if (err.name === 'RetryError') {
    return {
      status: 503,
      error: 'Service temporarily unavailable after multiple retry attempts',
      details: err.message
    };
  }
  
  // Abort error (non-retryable)
  if (err.name === 'AbortError' || err.message.includes('Bad request - token not found')) {
    if (err.message.includes('token not found')) {
      return {
        status: 404,
        error: 'Token not found on the specified network',
        details: {
          token,
          network,
          message: 'The token address does not exist or is not supported on this network'
        }
      };
    }
    if (err.message.includes('No data available for this timestamp')) {
      return {
        status: 404,
        error: 'No data available for this timestamp',
        details: {
          token,
          network,
          timestamp,
          message: 'Historical price data is not available for the specified timestamp'
        }
      };
    }
    return {
      status: 400,
      error: 'Bad request',
      details: err.message
    };
  }
  
  // Specific Alchemy errors
  if (err.message && err.message.includes('400:')) {
    const errorMatch = err.message.match(/400: \{"error":\{"message":"([^"]+)"\}/);
    const errorMessage = errorMatch ? errorMatch[1] : 'Bad request';
    
    if (errorMessage.includes('Token not found')) {
      return {
        status: 404,
        error: 'Token not found on the specified network',
        details: {
          token,
          network,
          message: errorMessage
        }
      };
    }
    
    return {
      status: 400,
      error: 'Bad request',
      details: errorMessage
    };
  }
  
  // Check for specific error messages
  if (err.message && err.message.includes('No data available for this timestamp')) {
    return {
      status: 404,
      error: 'No data available for this timestamp',
      details: {
        token,
        network,
        timestamp,
        message: 'Historical price data is not available for the specified timestamp'
      }
    };
  }
  
  // Generic server error
  return {
    status: 500,
    error: 'Internal server error',
    details: err.message
  };
};

// Main Route Handler
router.get('/', validateRequest(priceSchema), async (req, res) => {
  const { token, network, timestamp } = req.query;
  
  // Convert timestamp to number if it's a string
  const numericTimestamp = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;

  try {
    // Check cache first
    const cachedResult = await getCachedPrice(token, network, numericTimestamp);
    if (cachedResult) {
      return res.json(handleCacheHit(cachedResult, token, network, numericTimestamp));
    }

    // Fetch and process price data
    const result = await fetchAndProcessPrice(token, network, numericTimestamp);
    
    // Cache the result
    await setCachedPrice(token, network, numericTimestamp, result);

    return res.json(result);

  } catch (err) {
    const errorResponse = handleError(err, token, network, numericTimestamp);
    return res.status(errorResponse.status).json({
      error: errorResponse.error,
      details: errorResponse.details
    });
  }
});

module.exports = router;




