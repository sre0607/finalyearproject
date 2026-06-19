/*
 * ProductController.js - Inventory Query API Controls
 * Purpose: Connects collections queries, returns matching filter arrays, adds reviews, and exposes edit methods.
 */

const Product = require('../models/Product');
const Review = require('../models/Review');

/**
 * @desc    Fetch all fresh arrangements with search query limits
 * @route   GET /api/products
 * @access  Public
 */
const getProducts = async (req, res, next) => {
  const { category, search, minPrice, maxPrice } = req.query;

  try {
    const query = { isDeleted: { $ne: true }, isHidden: { $ne: true } };

    // Filter by category if provided
    if (category) {
      query.category = category;
    }

    // Filter by price range
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // Search query matching
    if (search) {
      const cleanSearch = String(search).replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
                                        .replace(/<\/?[^>]+(>|$)/g, '')
                                        .trim();
      const sanitizedSearch = cleanSearch.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      query.$or = [
        { name: { $regex: sanitizedSearch, $options: 'i' } },
        { category: { $regex: sanitizedSearch, $options: 'i' } },
        { description: { $regex: sanitizedSearch, $options: 'i' } },
        { deliveryTags: { $regex: sanitizedSearch, $options: 'i' } }
      ];
    }

    const products = await Product.find(query);
    res.json(products);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Fetch product specs by ID
 * @route   GET /api/products/:id
 * @access  Public
 */
const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (product) {
      const reviews = await Review.find({ product: req.params.id, isApproved: true });
      res.json({
        ...product.toObject(),
        reviews
      });
    } else {
      res.status(404);
      throw new Error('Product not found');
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add rating reviews feedback
 * @route   POST /api/products/:id/reviews
 * @access  Private
 */
const createProductReview = async (req, res, next) => {
  const { rating, comment } = req.body;

  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      res.status(404);
      throw new Error('Product not found');
    }

    const alreadyReviewed = await Review.findOne({
      product: req.params.id,
      user: req.user._id
    });

    if (alreadyReviewed) {
      res.status(400);
      throw new Error('You have already reviewed this arrangement');
    }

    const cleanComment = comment ? String(comment).replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
                                                  .replace(/<\/?[^>]+(>|$)/g, '')
                                                  .trim() : '';
    if (!cleanComment) {
      res.status(400);
      throw new Error('Please enter a valid review comment.');
    }

    const numRating = Number(rating);
    if (isNaN(numRating) || numRating < 1 || numRating > 5) {
      res.status(400);
      throw new Error('Please enter a rating between 1 and 5.');
    }

    const review = await Review.create({
      product: req.params.id,
      user: req.user._id,
      name: req.user.name,
      rating: numRating,
      comment: cleanComment
    });

    // Recalculate average rating using only approved reviews
    const reviews = await Review.find({ product: req.params.id, isApproved: true });
    product.reviewsCount = reviews.length;
    product.rating = reviews.length > 0
      ? reviews.reduce((acc, item) => item.rating + acc, 0) / reviews.length
      : 5;

    await product.save();
    res.status(201).json({ message: 'Review successfully added' });
  } catch (error) {
    next(error);
  }
};

const StockSubscription = require('../models/StockSubscription');

/**
 * @desc    Subscribe to back-in-stock notifications for a product
 * @route   POST /api/products/:id/subscribe
 * @access  Private
 */
const subscribeToStock = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      res.status(404);
      throw new Error('Product not found');
    }

    if (product.stock > 0) {
      res.status(400);
      throw new Error('Product is already in stock!');
    }

    await StockSubscription.findOneAndUpdate(
      { user: req.user._id, product: req.params.id },
      { user: req.user._id, product: req.params.id },
      { upsert: true, new: true }
    );

    res.status(201).json({ message: 'Successfully subscribed to stock notifications.' });
  } catch (error) {
    next(error);
  }
};

const getProductSuggestions = async (req, res, next) => {
  const { q } = req.query;
  try {
    if (!q || q.trim() === '') {
      return res.json([]);
    }

    const cleanQuery = String(q).trim();
    const escapedQuery = cleanQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const spaceIgnored = escapedQuery.replace(/\s+/g, '\\s*');
    const searchRegex = new RegExp(spaceIgnored, 'i');

    const query = {
      isDeleted: { $ne: true },
      isHidden: { $ne: true },
      $or: [
        { name: searchRegex },
        { category: searchRegex }
      ]
    };

    const products = await Product.find(query)
      .select('name price image category')
      .limit(8);

    res.json(products);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProductReview,
  subscribeToStock,
  getProductSuggestions
};

