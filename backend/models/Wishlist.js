/*
 * Wishlist.js - Mongoose Schema representing User Favorite Stems
 * Purpose: Keeps track of user wishlist items array references.
 */

const mongoose = require('mongoose');

const WishlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
      }
    ]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Wishlist', WishlistSchema);
