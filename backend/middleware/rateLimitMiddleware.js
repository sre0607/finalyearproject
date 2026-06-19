const rateLimit = require('express-rate-limit');

const skipTest = () => process.env.NODE_ENV === 'test';

// 1. General Limit: Prevents basic request flooding across all API endpoints
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, 
  message: {
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  },
  standardHeaders: true, 
  legacyHeaders: false,
  skip: skipTest
});

// 2. Auth Limit: Block brute force attempts on login and registration
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, 
  message: {
    message: 'Too many authentication attempts. Please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipTest
});

// 3. Search Limit: Throttles search suggestion queries
const searchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60,
  message: {
    message: 'Too many search queries. Please wait a moment before searching again.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipTest
});

// 4. Review Limit: Blocks spam comment flooding
const reviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    message: 'Review posting limit exceeded. Please try again in an hour.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipTest
});

// 5. Order Limit: Prevents checkouts spamming
const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    message: 'Checkout limit reached. Please wait a few moments before trying to complete your purchase.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipTest
});

module.exports = {
  generalLimiter,
  authLimiter,
  searchLimiter,
  reviewLimiter,
  orderLimiter
};
