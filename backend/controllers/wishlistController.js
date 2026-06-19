/*
 * WishlistController.js - Wishlist Favorite Collections API Controls
 * Purpose: Connects database models to synchronize favorited items, adds items, and removes items.
 */

const Wishlist = require('../models/Wishlist');

/**
 * @desc    Load logged user's wishlist document
 * @route   GET /api/wishlist
 * @access  Private
 */
const getWishlist = async (req, res, next) => {
  try {
    let wishlist = await Wishlist.findOne({ user: req.user._id }).populate('products');

    if (!wishlist) {
      wishlist = await Wishlist.create({ user: req.user._id, products: [] });
    }

    res.json(wishlist);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add product to wishlist document
 * @route   POST /api/wishlist
 * @access  Private
 */
const addToWishlist = async (req, res, next) => {
  const { productId } = req.body;

  try {
    let wishlist = await Wishlist.findOne({ user: req.user._id });

    if (!wishlist) {
      wishlist = await Wishlist.create({ user: req.user._id, products: [] });
    }

    if (!wishlist.products.includes(productId)) {
      wishlist.products.push(productId);
      await wishlist.save();
    }

    const updatedWishlist = await Wishlist.findOne({ user: req.user._id }).populate('products');
    res.json(updatedWishlist);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Remove product from wishlist document
 * @route   DELETE /api/wishlist/:productId
 * @access  Private
 */
const removeFromWishlist = async (req, res, next) => {
  try {
    const wishlist = await Wishlist.findOne({ user: req.user._id });

    if (wishlist) {
      wishlist.products = wishlist.products.filter(id => id.toString() !== req.params.productId);
      await wishlist.save();
      
      const updatedWishlist = await Wishlist.findOne({ user: req.user._id }).populate('products');
      res.json(updatedWishlist);
    } else {
      res.status(404);
      throw new Error('Wishlist not found');
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist
};
