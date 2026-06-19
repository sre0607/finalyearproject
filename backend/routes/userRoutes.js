/*
 * UserRoutes.js - User Profile Routes Map
 * Purpose: Declares secure paths to edit email coordinates or passwords.
 */

const express = require('express');
const router = express.Router();
const { updateUserProfile } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.put('/profile', protect, updateUserProfile);

module.exports = router;
