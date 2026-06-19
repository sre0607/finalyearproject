/*
 * GenerateToken.js - JWT Session Token Signer
 * Purpose: Signs database user ObjectId coordinates using configured secret keys.
 */

const jwt = require('jsonwebtoken');

/**
 * Encrypts a user ID into a JWT token
 * @param {string} id - Database User ObjectId
 * @returns {string} Encrypted JWT string
 */
const generateToken = (id) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is missing');
  }
  return jwt.sign(
    { id }, 
    process.env.JWT_SECRET, 
    { expiresIn: process.env.JWT_EXPIRE || '30d' }
  );
};

module.exports = generateToken;
