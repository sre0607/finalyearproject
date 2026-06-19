/*
 * OrderRoutes.js - Secure Checkout Orders Routes Map
 * Purpose: Declares secure paths to finalize orders and get personal history.
 */

const express = require('express');
const router = express.Router();
const {
  addOrderItems,
  getMyOrders,
  getOrderById,
  validatePromoCode,
  processPayment,
  cancelOrder,
  getOrderInvoice
} = require('../controllers/orderController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect); // Secure all order requests

const { orderLimiter } = require('../middleware/rateLimitMiddleware');

router.post('/', orderLimiter, addOrderItems);
router.post('/process-payment', processPayment);
router.post('/validate-promo', validatePromoCode);
router.get('/myorders', getMyOrders);
router.put('/:id/cancel', cancelOrder);
router.get('/:id/invoice', getOrderInvoice);
router.get('/:id', getOrderById);

module.exports = router;
