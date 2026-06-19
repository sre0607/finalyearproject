/*
 * AuthMiddleware.js - Session validation and JWT Token decrypter
 * Purpose: Intercepts inbound calls, extracts authorization header Bearer tokens, and sets active user properties.
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Validates request Bearer token session cache
 */
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header (split "Bearer <token>")
      token = req.headers.authorization.split(' ')[1];

      if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET environment variable is missing');
      }
      // Decode token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from database, excluding hashed password
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ message: 'User account not found' });
      }

      if (req.user.isActive === false) {
        return res.status(403).json({ message: 'Your account has been deactivated. Access denied.' });
      }

      next();
    } catch (error) {
      console.error('Session Token validation error:', error.message);
      return res.status(401).json({ message: 'Not authorized, session token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no session token provided' });
  }
};

module.exports = { protect };
