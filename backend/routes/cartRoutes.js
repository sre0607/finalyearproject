/*
 * CartRoutes.js - Shopping Cart Routes Map
 * Purpose: Declares secure paths to sync shopping carts.
 */

const express = require('express');
const router = express.Router();
const { getCart, addToCart, removeFromCart } = require('../controllers/cartController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect); // Secure all cart operations

router.route('/')
  .get(getCart)
  .post(addToCart);

router.route('/:itemId')
  .delete(removeFromCart);

module.exports = router;
