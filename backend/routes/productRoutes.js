/*
 * ProductRoutes.js - Product Catalog Routes Map
 * Purpose: Declares paths for search inventory, spec retrievals, and rating insertions.
 */

const express = require('express');
const router = express.Router();
const { getProducts, getProductById, createProductReview, subscribeToStock, getProductSuggestions } = require('../controllers/productController');
const { protect } = require('../middleware/authMiddleware');

const { searchLimiter, reviewLimiter } = require('../middleware/rateLimitMiddleware');

// Conditionally apply searchLimiter only if a search query is present
const conditionalSearchLimiter = (req, res, next) => {
  if (req.query.search) {
    return searchLimiter(req, res, next);
  }
  next();
};

router.get('/', conditionalSearchLimiter, getProducts);
router.get('/suggestions', getProductSuggestions);
router.get('/:id', getProductById);
router.post('/:id/reviews', protect, reviewLimiter, createProductReview);
router.post('/:id/subscribe', protect, subscribeToStock);

module.exports = router;
