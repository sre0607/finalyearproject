/*
 * Promo.js - Mongoose Schema for Coupon / Promo Codes
 * Purpose: Schema representing database-driven discounts, expirations, and minimum purchases.
 */

const mongoose = require('mongoose');

const PromoSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Please add a promo code'],
      unique: true,
      trim: true,
      uppercase: true,
      match: [/^[A-Z0-9_-]+$/, 'Promo code can only contain letters, numbers, dashes, and underscores']
    },
    discountPercent: {
      type: Number,
      default: 0, // e.g. 10 for 10%
      min: 0,
      max: 100
    },
    isFreeShipping: {
      type: Boolean,
      default: false
    },
    minPurchase: {
      type: Number,
      default: 0
    },
    expiresAt: {
      type: Date,
      required: [true, 'Please specify an expiration date']
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Promo', PromoSchema);
