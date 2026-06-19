const express = require('express');
const router = express.Router();
const { 
  addProduct, 
  getAllProducts, 
  getDashboardStats, 
  updateOrderStatus,
  updateProduct,
  deleteProduct,
  getAllUsers,
  toggleUserStatus,
  getUserOrders,
  getAllOrders,
  archiveOrder,
  getAllPromos,
  createPromo,
  updatePromo,
  deletePromo,
  getAllReviews,
  toggleReviewApproval,
  deleteReview,
  getSettings,
  updateSettings,
  exportSalesReport,
  deleteUser
} = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.use(protect);
router.use(admin); // Restrict entirely to Admins

router.get('/reports/sales', exportSalesReport);
router.get('/products', getAllProducts);
router.post('/products', upload.single('image'), addProduct);
router.put('/products/:id', upload.single('image'), updateProduct);
router.delete('/products/:id', deleteProduct);
router.get('/dashboard-stats', getDashboardStats);
router.get('/users', getAllUsers);
router.put('/users/:id/toggle', toggleUserStatus);
router.delete('/users/:id', deleteUser);
router.get('/users/:id/orders', getUserOrders);
router.get('/orders', getAllOrders);
router.put('/orders/:id/status', updateOrderStatus);
router.patch('/orders/:id/archive', archiveOrder);

// Promos CRUD
router.get('/promos', getAllPromos);
router.post('/promos', createPromo);
router.put('/promos/:id', updatePromo);
router.delete('/promos/:id', deletePromo);

// Reviews Moderation
router.get('/reviews', getAllReviews);
router.put('/reviews/:id/approve', toggleReviewApproval);
router.delete('/reviews/:id', deleteReview);

// Settings CRUD
router.get('/settings', getSettings);
router.put('/settings', updateSettings);

module.exports = router;
