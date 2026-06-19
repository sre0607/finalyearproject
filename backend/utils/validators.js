/*
 * Validators.js - Server-Side Request Validators
 * Purpose: Evaluates field configurations, sanitizes string entries, and checks structure before saving.
 */

/**
 * Checks email patterns
 * @param {string} email - Inbound text
 * @returns {boolean} Verified status
 */
const validateEmail = (email) => {
  const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
};

const validatePasswordStrength = (password) => {
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  return password && password.length >= 8 && hasUppercase && hasLowercase && hasNumber && hasSpecial;
};

const validateName = (name) => {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  return trimmed.length >= 2 && trimmed.length <= 50 && !/<script/i.test(trimmed);
};

const validatePhone = (phone) => {
  if (!phone) return false;
  const cleanPhone = String(phone).trim();
  return /^[6-9]\d{9}$/.test(cleanPhone);
};

const validatePincode = (pincode) => {
  if (!pincode) return false;
  const cleanPin = String(pincode).trim();
  return /^\d{6}$/.test(cleanPin);
};

const validateAddress = (address) => {
  if (!address || typeof address !== 'string') return false;
  return address.trim().length >= 5;
};

const sanitizeInput = (str) => {
  if (typeof str !== 'string') return '';
  return str.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
            .replace(/<\/?[^>]+(>|$)/g, '')
            .trim();
};

module.exports = {
  validateEmail,
  validatePasswordStrength,
  validateName,
  validatePhone,
  validatePincode,
  validateAddress,
  sanitizeInput
};
