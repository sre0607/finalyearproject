/*
 * UserController.js - Profile management API Controls
 * Purpose: Handles client updates, security overrides, password resets, and user settings queries.
 */

const User = require('../models/User');
const {
  validateEmail,
  validatePasswordStrength,
  validateName,
  validatePhone,
  validatePincode,
  validateAddress,
  sanitizeInput
} = require('../utils/validators');

/**
 * @desc    Update customer profile details
 * @route   PUT /api/users/profile
 * @access  Private
 */
const updateUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      if (req.body.name) {
        const sanitizedName = sanitizeInput(req.body.name);
        if (!validateName(sanitizedName)) {
          res.status(400);
          throw new Error('Name must be between 2 and 50 characters, and cannot contain scripts.');
        }
        user.name = sanitizedName;
      }
      
      if (req.body.email && req.body.email.trim().toLowerCase() !== user.email) {
        const normalizedEmail = req.body.email.trim().toLowerCase();
        if (!validateEmail(normalizedEmail)) {
          res.status(400);
          throw new Error('Please enter a valid email address.');
        }
        const emailExists = await User.findOne({ email: normalizedEmail });
        if (emailExists) {
          res.status(400);
          throw new Error('Email address is already in use by another user');
        }
        user.email = normalizedEmail;
      }

      if (req.body.password) {
        if (!validatePasswordStrength(req.body.password)) {
          res.status(400);
          throw new Error('Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character.');
        }
        user.password = req.body.password;
      }

      if (req.body.address) {
        const { firstName, lastName, addressLine, city, pincode, phone } = req.body.address;
        
        const sanitizedFirst = sanitizeInput(firstName);
        const sanitizedLast = sanitizeInput(lastName);
        if (!validateName(sanitizedFirst) || !validateName(sanitizedLast)) {
          res.status(400);
          throw new Error('First and last name in address are required, must be between 2 and 50 characters.');
        }

        if (!validateAddress(addressLine)) {
          res.status(400);
          throw new Error('Street address is required and must be at least 5 characters long.');
        }

        if (!city || city.trim() === '') {
          res.status(400);
          throw new Error('City is required.');
        }

        if (!validatePhone(phone)) {
          res.status(400);
          throw new Error('Phone number must be a valid 10-digit Indian phone number starting with 6-9.');
        }

        if (!validatePincode(pincode)) {
          res.status(400);
          throw new Error('Pincode must be exactly 6 digits.');
        }

        user.address = {
          firstName: sanitizedFirst,
          lastName: sanitizedLast,
          addressLine: addressLine.trim(),
          city: city.trim(),
          pincode: pincode.trim(),
          phone: phone.trim()
        };
      }

      const updatedUser = await user.save();

      res.json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        address: updatedUser.address
      });
    } else {
      res.status(404);
      throw new Error('User account not found');
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  updateUserProfile
};
