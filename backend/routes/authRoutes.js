/*
 * AuthRoutes.js - Authentication Routes Map
 * Purpose: Declares register/login HTTP endpoints and attaches protection filters.
 */

const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getUserProfile, forgotPassword, resetPassword } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { validateRegister, validateLogin } = require('../middleware/validationMiddleware');

const { authLimiter } = require('../middleware/rateLimitMiddleware');

router.post('/register', authLimiter, validateRegister, registerUser);
router.post('/login', authLimiter, validateLogin, loginUser);
router.get('/profile', protect, getUserProfile);
router.post('/forgotpassword', authLimiter, forgotPassword);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/resetpassword/:token', authLimiter, resetPassword);
router.post('/reset-password/:token', authLimiter, resetPassword);

module.exports = router;
