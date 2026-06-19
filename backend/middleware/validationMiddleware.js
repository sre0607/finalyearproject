/*
 * ValidationMiddleware.js - Server-Side Auth Fields Validator
 * Purpose: Checks inputs for login/register requests prior to running controller workflows.
 */

const { validateEmail, validatePasswordStrength } = require('../utils/validators');

/**
 * Validates registration input attributes
 */
const validateRegister = (req, res, next) => {
  const { name, email, password } = req.body;

  if (!name || name.trim() === '') {
    res.status(400);
    return next(new Error('Please add a name'));
  }

  if (name.trim().length < 3) {
    res.status(400);
    return next(new Error('Name must be at least 3 characters long'));
  }

  if (!email || !validateEmail(email)) {
    res.status(400);
    return next(new Error('Please enter a valid email address'));
  }

  if (!password || !validatePasswordStrength(password)) {
    res.status(400);
    return next(new Error('Password must be at least 8 characters long and contain at least one letter and one number'));
  }

  next();
};

/**
 * Validates login input attributes
 */
const validateLogin = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !validateEmail(email)) {
    res.status(400);
    return next(new Error('Please enter a valid email address'));
  }

  if (!password || password.trim() === '') {
    res.status(400);
    return next(new Error('Please enter your password'));
  }

  next();
};

module.exports = {
  validateRegister,
  validateLogin
};
