/*
 * Settings.js - Mongoose Schema for Store Configurations
 * Purpose: Schema representing core brand name, support email, allowed pincodes, tax rates, and shipping fees.
 */

const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema(
  {
    brandName: {
      type: String,
      required: [true, 'Please add a brand name'],
      default: 'Florish',
      trim: true
    },
    supportEmail: {
      type: String,
      required: [true, 'Please add a support email'],
      default: 'hello@florish-shop.com',
      trim: true
    },
    allowedPincodes: {
      type: String,
      required: [true, 'Please add allowed pincodes'],
      default: '400001, 400002, 400003, 400029, 400032',
      trim: true,
      validate: {
        validator: function(v) {
          if (!v) return false;
          return v.split(',').every(pin => /^\d{6}$/.test(pin.trim()));
        },
        message: 'Allowed pincodes must be a comma-separated list of exactly 6-digit numbers.'
      }
    },
    salesTax: {
      type: Number,
      required: [true, 'Please add sales tax percentage'],
      default: 8.0,
      min: [0, 'Tax percentage cannot be negative'],
      max: [100, 'Tax percentage cannot exceed 100%']
    },
    shippingCharge: {
      type: Number,
      required: [true, 'Please add shipping charges'],
      default: 99,
      min: [0, 'Shipping charge cannot be negative']
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Settings', SettingsSchema);
