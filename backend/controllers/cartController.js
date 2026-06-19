/*
 * CartController.js - Shopping Cart API Controls
 * Purpose: Connects database models to synchronize cart items, adjusts quantities, and adds products.
 */

const Cart = require('../models/Cart');
const Product = require('../models/Product');

/**
 * @desc    Load logged user's shopping cart document
 * @route   GET /api/cart
 * @access  Private
 */
const getCart = async (req, res, next) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id }).populate('items.product');

    if (!cart) {
      // Create empty cart if it doesn't exist
      cart = await Cart.create({ user: req.user._id, items: [] });
    }

    res.json(cart);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add product to cart document
 * @route   POST /api/cart
 * @access  Private
 */
const addToCart = async (req, res, next) => {
  const { productId, quantity } = req.body;

  if (isNaN(quantity) || !Number.isInteger(Number(quantity))) {
    res.status(400);
    return next(new Error('Quantity must be an integer'));
  }

  try {
    let cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
    }

    // Verify product exists and check stock limits
    const product = await Product.findById(productId);
    if (!product) {
      res.status(404);
      throw new Error('Product not found');
    }

    const itemIdx = cart.items.findIndex(item => item.product.toString() === productId);
    const currentQty = itemIdx > -1 ? cart.items[itemIdx].quantity : 0;
    const targetQty = currentQty + Number(quantity);

    if (targetQty > product.stock) {
      res.status(400);
      throw new Error(`Insufficient stock! Only ${product.stock} items are available.`);
    }

    if (itemIdx > -1) {
      if (targetQty <= 0) {
        cart.items.splice(itemIdx, 1); // Delete from cart if quantity falls to zero or below
      } else {
        cart.items[itemIdx].quantity = targetQty;
      }
    } else {
      if (targetQty > 0) {
        cart.items.push({ product: productId, quantity: targetQty });
      }
    }

    await cart.save();
    const updatedCart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    res.json(updatedCart);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Remove item from cart document
 * @route   DELETE /api/cart/:itemId
 * @access  Private
 */
const removeFromCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });

    if (cart) {
      cart.items = cart.items.filter(item => item._id.toString() !== req.params.itemId);
      await cart.save();
      const updatedCart = await Cart.findOne({ user: req.user._id }).populate('items.product');
      res.json(updatedCart);
    } else {
      res.status(404);
      throw new Error('Cart not found');
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCart,
  addToCart,
  removeFromCart
};
