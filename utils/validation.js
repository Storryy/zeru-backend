const Joi = require('joi');

// Network enum
const NETWORKS = {
  ETHEREUM: 'ethereum',
  POLYGON: 'polygon'
};

// Validation schema for price endpoint
const priceSchema = Joi.object({
  token: Joi.string()
    .pattern(/^0x[a-fA-F0-9]{40}$/)
    .required()
    .messages({
      'string.pattern.base': 'Token address must be a valid Ethereum address (0x followed by 40 hex characters)',
      'any.required': 'Token address is required',
      'string.empty': 'Token address cannot be empty'
    }),
  
  network: Joi.string()
    .valid(NETWORKS.ETHEREUM, NETWORKS.POLYGON)
    .required()
    .messages({
      'any.only': `Network must be either "${NETWORKS.ETHEREUM}" or "${NETWORKS.POLYGON}"`,
      'any.required': 'Network is required',
      'string.empty': 'Network cannot be empty'
    }),
  
  timestamp: Joi.number()
    .integer()
    .min(1000000000) // After 2001-09-09
    .max(Math.floor(Date.now() / 1000) + 86400) // Allow future timestamps up to 24 hours
    .required()
    .messages({
      'number.base': 'Timestamp must be a number',
      'number.integer': 'Timestamp must be an integer',
      'number.min': 'Timestamp is too old (must be after 2001-09-09)',
      'number.max': 'Timestamp cannot be more than 24 hours in the future',
      'any.required': 'Timestamp is required'
    })
});

// Validation schema for schedule endpoint
const scheduleSchema = Joi.object({
  token: Joi.string()
    .pattern(/^0x[a-fA-F0-9]{40}$/)
    .required()
    .messages({
      'string.pattern.base': 'Token address must be a valid Ethereum address (0x followed by 40 hex characters)',
      'any.required': 'Token address is required',
      'string.empty': 'Token address cannot be empty'
    }),
  
  network: Joi.string()
    .valid(NETWORKS.ETHEREUM, NETWORKS.POLYGON)
    .required()
    .messages({
      'any.only': `Network must be either "${NETWORKS.ETHEREUM}" or "${NETWORKS.POLYGON}"`,
      'any.required': 'Network is required',
      'string.empty': 'Network cannot be empty'
    })
});

// Validation middleware function
const validateRequest = (schema) => {
  return (req, res, next) => {
    // For GET requests, validate query parameters; for POST requests, validate body
    let dataToValidate = req.method === 'GET' ? req.query : req.body;
    
    // For GET requests, convert string values to appropriate types
    if (req.method === 'GET') {
      dataToValidate = { ...dataToValidate };
      // Convert timestamp to number if it exists
      if (dataToValidate.timestamp) {
        dataToValidate.timestamp = parseInt(dataToValidate.timestamp, 10);
      }
    }
    
    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false, // Return all validation errors
      stripUnknown: true  // Remove unknown fields
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        error: 'Validation failed',
        details: errorDetails
      });
    }

    // Replace the appropriate property with validated data
    if (req.method === 'GET') {
      req.query = value;
    } else {
      req.body = value;
    }
    next();
  };
};

// Helper function to validate token address format
const isValidTokenAddress = (address) => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

// Helper function to validate timestamp
const isValidTimestamp = (timestamp) => {
  const num = Number(timestamp);
  return Number.isInteger(num) && 
         num >= 1000000000 && 
         num <= Math.floor(Date.now() / 1000) + 86400;
};

module.exports = {
  NETWORKS,
  priceSchema,
  scheduleSchema,
  validateRequest,
  isValidTokenAddress,
  isValidTimestamp
}; 