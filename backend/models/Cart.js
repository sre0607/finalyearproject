/*
 * Cart.js - Mongoose Schema representing User Shopping Carts
 * Purpose: Defines relational schemas maps, tracks specific user item counts, and totals.
 */

const mongoose = require('mongoose');

const CartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1'],
    validate: {
      validator: Number.isInteger,
      message: 'Quantity must be an integer'
    },
    default: 1
  }
});

const CartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    items: [CartItemSchema]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Cart', CartSchema);
