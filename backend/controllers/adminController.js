/*
 * AdminController.js - Back-Office Dashboard API Controls
 * Purpose: Exposes administrative actions for catalog edits, order track revisions, user access controls, and dashboard metrics.
 */

const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const Promo = require('../models/Promo');
const Review = require('../models/Review');
const Settings = require('../models/Settings');
const { validateName, sanitizeInput } = require('../utils/validators');
const { uploadImage } = require('../utils/imageUploader');

const isValidDirectImageUrl = (url) => {
  if (!url) return { valid: false, reason: 'Image URL is required.' };
  url = url.trim();
  
  if (url.startsWith('/uploads/')) {
    return { valid: true };
  }
  
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return { valid: false, reason: 'Product image URL must start with http:// or https://' };
  }
  
  const lowerUrl = url.toLowerCase();
  
  // Reject common search/sharing pages
  if (lowerUrl.includes('google.com/imgres') || (lowerUrl.includes('google.') && lowerUrl.includes('/imgres'))) {
    return { valid: false, reason: 'This is a Google Images search link, not a direct image URL. Please right-click the image and select "Copy image address".' };
  }
  if (lowerUrl.includes('images.app.goo.gl') || lowerUrl.includes('app.goo.gl')) {
    return { valid: false, reason: 'This is a Google Images share link, not a direct image URL. Please right-click the image and select "Copy image address".' };
  }
  if (lowerUrl.includes('drive.google.com')) {
    return { valid: false, reason: 'This is a Google Drive share link, not a direct image URL. Please host the image publicly or upload it directly.' };
  }
  if (lowerUrl.includes('google.com/search') || lowerUrl.includes('google.com/url')) {
    return { valid: false, reason: 'This is a Google search/redirect link, not a direct image URL.' };
  }
  if (lowerUrl.includes('unsplash.com/photos/') || lowerUrl.includes('unsplash.com/collections/')) {
    return { valid: false, reason: 'This is an Unsplash webpage link, not a direct image link. Right-click the image and select "Copy image address".' };
  }
  if (lowerUrl.includes('pinterest.com/pin/') || lowerUrl.includes('pin.it/')) {
    return { valid: false, reason: 'This is a Pinterest webpage link, not a direct image link. Copy the direct image link instead.' };
  }
  
  return { valid: true };
};


/**
 * @desc    Publish a new flower arrangement catalog item
 * @route   POST /api/admin/products
 * @access  Private/Admin
 */
const addProduct = async (req, res, next) => {
  const { name, sku, category, price, description, stock, isFeatured, isHidden } = req.body;

  try {
    const sanitizedName = sanitizeInput(name);
    if (!sanitizedName || sanitizedName.length < 3 || sanitizedName.length > 100 || /<script/i.test(sanitizedName)) {
      res.status(400);
      throw new Error('Product name is required, must be between 3 and 100 characters, and cannot contain scripts.');
    }

    if (!sku || sku.trim() === '' || /<script/i.test(sku)) {
      res.status(400);
      throw new Error('SKU is required and cannot contain scripts.');
    }

    if (!category || category.trim() === '') {
      res.status(400);
      throw new Error('Category is required.');
    }

    if (!description || description.trim().length < 10) {
      res.status(400);
      throw new Error('Description is required and must be at least 10 characters long.');
    }

    let finalImage = '';
    if (req.file) {
      const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];
      const path = require('path');
      const ext = path.extname(req.file.originalname).toLowerCase();
      if (!allowedExts.includes(ext)) {
        res.status(400);
        throw new Error('Product image must be a valid format (JPG, JPEG, PNG, WEBP).');
      }
      finalImage = await uploadImage(req.file);
    } else if (req.body.image) {
      const imageUrl = req.body.image.trim();
      const check = isValidDirectImageUrl(imageUrl);
      if (!check.valid) {
        res.status(400);
        throw new Error(check.reason);
      }
      finalImage = imageUrl;
    }

    const numericPrice = Number(price);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      res.status(400);
      throw new Error('Product price must be a positive number only.');
    }

    if (stock === undefined || stock === null || stock === '') {
      res.status(400);
      throw new Error('Product stock level is required.');
    }
    if (typeof stock !== 'number' && typeof stock !== 'string') {
      res.status(400);
      throw new Error('Product stock level must be a non-negative integer.');
    }
    const stockStr = String(stock).trim();
    if (!/^\d+$/.test(stockStr)) {
      res.status(400);
      throw new Error('Product stock level must be a non-negative integer.');
    }
    const numericStock = Number(stockStr);

    const productExists = await Product.findOne({ sku, isDeleted: { $ne: true } });

    if (productExists) {
      res.status(400);
      throw new Error('Product with this SKU already exists');
    }

    const nameExists = await Product.findOne({ 
      name: { $regex: new RegExp(`^${sanitizedName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') },
      isDeleted: { $ne: true }
    });
    if (nameExists) {
      res.status(400);
      throw new Error('Product with this name already exists');
    }

    const product = await Product.create({
      name: sanitizedName,
      sku: sku.trim(),
      category: category.trim(),
      price: numericPrice,
      description: sanitizeInput(description),
      stock: numericStock,
      isFeatured: isFeatured === 'true' || isFeatured === true,
      isHidden: isHidden === 'true' || isHidden === true,
      image: finalImage
    });

    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Fetch statistical overview metric tallies
 * @route   GET /api/admin/dashboard-stats
 * @access  Private/Admin
 */
const getDashboardStats = async (req, res, next) => {
  try {
    const totalRevenue = await Order.aggregate([
      { $match: { orderStatus: { $ne: 'Cancelled' } } },
      { $group: { _id: null, total: { $sum: { $subtract: ['$totalPrice', { $add: ['$taxPrice', '$shippingPrice'] }] } } } }
    ]);

    const totalOrders = await Order.countDocuments();
    const totalUsers = await User.countDocuments({});
    const totalProducts = await Product.countDocuments();

    const pendingOrders = await Order.countDocuments({ orderStatus: 'Processing' });
    const deliveredOrders = await Order.countDocuments({ orderStatus: 'Delivered' });
    const canceledOrders = await Order.countDocuments({ orderStatus: 'Cancelled' });
    
    // Low stock count (<= 5) for active, visible products
    const lowStockQuery = {
      stock: { $lte: 5 },
      isDeleted: { $ne: true },
      deletedAt: { $exists: false },
      isHidden: { $ne: true },
      name: { $not: /^\[Deleted\]/i }
    };
    const lowStockCount = await Product.countDocuments(lowStockQuery);
    const lowStockProducts = await Product.find(lowStockQuery).select('name stock sku price');

    // Top selling products based on order items
    const topProducts = await Order.aggregate([
      { $match: { orderStatus: { $ne: 'Cancelled' } } },
      { $unwind: '$items' },
      { $group: { 
          _id: '$items.product', 
          name: { $first: '$items.name' }, 
          price: { $first: '$items.price' }, 
          totalSold: { $sum: '$items.quantity' } 
      } },
      { $sort: { totalSold: -1 } },
      { $limit: 5 }
    ]);

    // Latest orders
    const latestOrders = await Order.find({}).sort({ createdAt: -1 }).limit(5).populate('user', 'name email');

    res.json({
      revenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0.00,
      orders: totalOrders,
      users: totalUsers,
      products: totalProducts,
      pendingOrders,
      deliveredOrders,
      canceledOrders,
      lowStockCount,
      lowStockProducts,
      topProducts,
      latestOrders
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Revise delivery status parameter
 * @route   PUT /api/admin/orders/:id/status
 * @access  Private/Admin
 */
const updateOrderStatus = async (req, res, next) => {
  const { status } = req.body;

  try {
    const order = await Order.findById(req.params.id);

    if (order) {
      const oldStatus = order.orderStatus;
      order.orderStatus = status;
      if (status === 'Delivered') {
        order.deliveredAt = Date.now();
        order.paymentStatus = 'paid';
      }
      
      const updatedOrder = await order.save();

      // Trigger order status notification
      if (oldStatus !== status) {
        const Notification = require('../models/Notification');
        await Notification.create({
          user: order.user,
          type: 'order_status',
          title: 'Order Status Update 📦',
          message: `Your order #FL-${order._id.toString().substring(order._id.toString().length - 6).toUpperCase()} is now ${status}!`,
          order: order._id
        });
      }

      res.json(updatedOrder);
    } else {
      res.status(404);
      throw new Error('Order not found');
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Archive a customer order
 * @route   PATCH /api/admin/orders/:id/archive
 * @access  Private/Admin
 */
const archiveOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (order) {
      order.archived = true;
      const updatedOrder = await order.save();
      res.json({ success: true, message: 'Order successfully archived', order: updatedOrder });
    } else {
      res.status(404);
      throw new Error('Order not found');
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update a flower arrangement catalog item
 * @route   PUT /api/admin/products/:id
 * @access  Private/Admin
 */
const updateProduct = async (req, res, next) => {
  const { name, sku, category, price, description, stock, isFeatured, isHidden } = req.body;

  try {
    const product = await Product.findById(req.params.id);

    if (product) {
      const wasOutOfStock = product.stock === 0;

      if (name !== undefined) {
        const sanitizedName = sanitizeInput(name);
        if (!sanitizedName || sanitizedName.length < 3 || sanitizedName.length > 100 || /<script/i.test(sanitizedName)) {
          res.status(400);
          throw new Error('Product name is required, must be between 3 and 100 characters, and cannot contain scripts.');
        }
        const nameExists = await Product.findOne({
          _id: { $ne: product._id },
          name: { $regex: new RegExp(`^${sanitizedName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') },
          isDeleted: { $ne: true }
        });
        if (nameExists) {
          res.status(400);
          throw new Error('Product with this name already exists');
        }
        product.name = sanitizedName;
      }

      if (sku !== undefined) {
        if (!sku || sku.trim() === '' || /<script/i.test(sku)) {
          res.status(400);
          throw new Error('SKU cannot be empty and cannot contain scripts.');
        }
        const skuExists = await Product.findOne({
          _id: { $ne: product._id },
          sku: sku.trim(),
          isDeleted: { $ne: true }
        });
        if (skuExists) {
          res.status(400);
          throw new Error('Product with this SKU already exists');
        }
        product.sku = sku.trim();
      }

      if (category !== undefined) {
        if (!category || category.trim() === '') {
          res.status(400);
          throw new Error('Category cannot be empty.');
        }
        product.category = category.trim();
      }

      if (price !== undefined) {
        const numericPrice = Number(price);
        if (isNaN(numericPrice) || numericPrice <= 0) {
          res.status(400);
          throw new Error('Product price must be a positive number only.');
        }
        product.price = numericPrice;
      }

      if (description !== undefined) {
        if (!description || description.trim().length < 10) {
          res.status(400);
          throw new Error('Description cannot be empty and must be at least 10 characters long.');
        }
        product.description = sanitizeInput(description);
      }



      if (stock !== undefined) {
        if (stock === null || stock === '') {
          res.status(400);
          throw new Error('Product stock level must be a non-negative integer.');
        }
        if (typeof stock !== 'number' && typeof stock !== 'string') {
          res.status(400);
          throw new Error('Product stock level must be a non-negative integer.');
        }
        const stockStr = String(stock).trim();
        if (!/^\d+$/.test(stockStr)) {
          res.status(400);
          throw new Error('Product stock level must be a non-negative integer.');
        }
        product.stock = Number(stockStr);
      }
      product.isFeatured = isFeatured !== undefined ? (isFeatured === 'true' || isFeatured === true) : product.isFeatured;
      product.isHidden = isHidden !== undefined ? (isHidden === 'true' || isHidden === true) : product.isHidden;

      if (req.file) {
        const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];
        const path = require('path');
        const ext = path.extname(req.file.originalname).toLowerCase();
        if (!allowedExts.includes(ext)) {
          res.status(400);
          throw new Error('Product image must be a valid format (JPG, JPEG, PNG, WEBP).');
        }
        product.image = await uploadImage(req.file);
      } else if (req.body.image !== undefined) {
        const imageUrl = req.body.image.trim();
        const check = isValidDirectImageUrl(imageUrl);
        if (!check.valid) {
          res.status(400);
          throw new Error(check.reason);
        }
        product.image = imageUrl;
      }

      const isRestocked = wasOutOfStock && product.stock > 0;
      const updatedProduct = await product.save();

      if (isRestocked) {
        const StockSubscription = require('../models/StockSubscription');
        const Wishlist = require('../models/Wishlist');
        const Notification = require('../models/Notification');

        const subscriptions = await StockSubscription.find({ product: product._id });
        const wishlists = await Wishlist.find({ products: product._id });

        const userIds = new Set();
        subscriptions.forEach(sub => userIds.add(sub.user.toString()));
        wishlists.forEach(wl => userIds.add(wl.user.toString()));

        const notificationsToCreate = [];
        for (const userId of userIds) {
          notificationsToCreate.push({
            user: userId,
            type: 'back_in_stock',
            title: 'Arrangement Restocked! 🌸',
            message: `The floral arrangement "${product.name}" is back in stock! Order now before it sells out again.`,
            product: product._id
          });
        }

        if (notificationsToCreate.length > 0) {
          await Notification.insertMany(notificationsToCreate);
        }

        // Clean up subscriptions
        await StockSubscription.deleteMany({ product: product._id });
      }

      res.json(updatedProduct);
    } else {
      res.status(404);
      throw new Error('Product not found');
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a flower arrangement catalog item
 * @route   DELETE /api/admin/products/:id
 * @access  Private/Admin
 */
const getAllProducts = async (req, res, next) => {
  try {
    const query = { isDeleted: { $ne: true } };
    if (req.query.category) {
      query.category = req.query.category;
    }
    const products = await Product.find(query).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    next(error);
  }
};

const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (product) {
      product.isDeleted = true;
      product.stock = 0;
      
      const uniqueSuffix = Date.now();
      if (!product.sku.startsWith('deleted-')) {
        product.sku = `deleted-${uniqueSuffix}-${product.sku}`;
      }
      if (!product.name.startsWith('[Deleted]')) {
        product.name = `[Deleted] ${product.name} (${uniqueSuffix})`;
      }
      
      await product.save();
      res.json({ message: 'Product successfully soft-deleted from catalog' });
    } else {
      res.status(404);
      throw new Error('Product not found');
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Fetch all registered user accounts
 * @route   GET /api/admin/users
 * @access  Private/Admin
 */
const getAllUsers = async (req, res, next) => {
  const { search } = req.query;
  try {
    let query = { isDeleted: { $ne: true } };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    const users = await User.find(query).select('-password');
    res.json(users);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Toggle user active/blocked status
 * @route   PUT /api/admin/users/:id/toggle
 * @access  Private/Admin
 */
const toggleUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (user) {
      if (user.role === 'admin') {
        res.status(400);
        throw new Error('Cannot block/unblock an administrator');
      }
      user.isActive = !user.isActive;
      await user.save();
      res.json(user);
    } else {
      res.status(404);
      throw new Error('User not found');
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get order history for specific customer
 * @route   GET /api/admin/users/:id/orders
 * @access  Private/Admin
 */
const getUserOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.params.id });
    res.json(orders);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Fetch all customer orders
 * @route   GET /api/admin/orders
 * @access  Private/Admin
 */
const getAllOrders = async (req, res, next) => {
  const { search, status, archiveFilter } = req.query;
  try {
    let query = {};
    if (status) {
      query.orderStatus = status;
    }
    
    // Handle archive filter (default to 'active')
    if (archiveFilter === 'archived') {
      query.archived = true;
    } else if (archiveFilter === 'all') {
      // Show both, do not restrict query on archived
    } else {
      // default to active
      query.archived = { $ne: true };
    }
    
    let orders = await Order.find(query).populate('user', 'name email');

    if (search) {
      const searchLower = search.toLowerCase();
      orders = orders.filter(order => {
        const idMatches = order._id.toString().toLowerCase().includes(searchLower);
        const nameMatches = order.user && order.user.name.toLowerCase().includes(searchLower);
        const emailMatches = order.user && order.user.email.toLowerCase().includes(searchLower);
        return idMatches || nameMatches || emailMatches;
      });
    }

    res.json(orders);
  } catch (error) {
    next(error);
  }
};

// Admin Promo Code Management CRUD
const getAllPromos = async (req, res, next) => {
  try {
    const promos = await Promo.find({}).sort({ createdAt: -1 });
    res.json(promos);
  } catch (error) {
    next(error);
  }
};

const createPromo = async (req, res, next) => {
  const { code, discountPercent, isFreeShipping, minPurchase, expiresAt } = req.body;
  try {
    if (!code || !/^[a-zA-Z0-9_-]+$/.test(code.trim())) {
      res.status(400);
      throw new Error('Promo code is required and can only contain letters, numbers, dashes, and underscores.');
    }

    const numericDiscount = Number(discountPercent);
    if (isNaN(numericDiscount) || numericDiscount < 0 || numericDiscount > 100) {
      res.status(400);
      throw new Error('Discount percentage must be between 0 and 100.');
    }

    const numericMinPurchase = Number(minPurchase);
    if (isNaN(numericMinPurchase) || numericMinPurchase < 0) {
      res.status(400);
      throw new Error('Minimum purchase value cannot be negative.');
    }

    const exists = await Promo.findOne({ code: code.trim().toUpperCase() });
    if (exists) {
      res.status(400);
      throw new Error('Promo code already exists');
    }
    const promo = await Promo.create({
      code: code.trim().toUpperCase(),
      discountPercent: numericDiscount,
      isFreeShipping: !!isFreeShipping,
      minPurchase: numericMinPurchase,
      expiresAt: new Date(expiresAt)
    });

    // Notify all users of the new coupon code (except admins)
    try {
      const Notification = require('../models/Notification');
      const buyers = await User.find({ role: 'user', isBlocked: { $ne: true } });
      const notificationsToCreate = buyers.map(buyer => ({
        user: buyer._id,
        type: 'promo',
        title: 'New Promo Code Available! 🎟️',
        message: `Use code "${promo.code}" to get ${promo.discountPercent}% off on your next purchase! Minimum order value: Rs. ${promo.minPurchase}.`,
      }));
      if (notificationsToCreate.length > 0) {
        await Notification.insertMany(notificationsToCreate);
      }
    } catch (notifyErr) {
      console.error('Error generating promo notifications:', notifyErr);
    }

    res.status(201).json(promo);
  } catch (error) {
    next(error);
  }
};

const updatePromo = async (req, res, next) => {
  const { code, discountPercent, isFreeShipping, minPurchase, expiresAt } = req.body;
  try {
    const promo = await Promo.findById(req.params.id);
    if (promo) {
      if (code !== undefined) {
        if (!code || !/^[a-zA-Z0-9_-]+$/.test(code.trim())) {
          res.status(400);
          throw new Error('Promo code can only contain letters, numbers, dashes, and underscores.');
        }
        promo.code = code.trim().toUpperCase();
      }

      if (discountPercent !== undefined) {
        const numericDiscount = Number(discountPercent);
        if (isNaN(numericDiscount) || numericDiscount < 0 || numericDiscount > 100) {
          res.status(400);
          throw new Error('Discount percentage must be between 0 and 100.');
        }
        promo.discountPercent = numericDiscount;
      }

      if (minPurchase !== undefined) {
        const numericMinPurchase = Number(minPurchase);
        if (isNaN(numericMinPurchase) || numericMinPurchase < 0) {
          res.status(400);
          throw new Error('Minimum purchase value cannot be negative.');
        }
        promo.minPurchase = numericMinPurchase;
      }

      promo.isFreeShipping = isFreeShipping !== undefined ? !!isFreeShipping : promo.isFreeShipping;
      promo.expiresAt = expiresAt ? new Date(expiresAt) : promo.expiresAt;
      
      const updated = await promo.save();
      res.json(updated);
    } else {
      res.status(404);
      throw new Error('Promo not found');
    }
  } catch (error) {
    next(error);
  }
};

const deletePromo = async (req, res, next) => {
  try {
    const promo = await Promo.findById(req.params.id);
    if (promo) {
      await Promo.findByIdAndDelete(req.params.id);
      res.json({ message: 'Promo code deleted successfully' });
    } else {
      res.status(404);
      throw new Error('Promo not found');
    }
  } catch (error) {
    next(error);
  }
};

// Admin Review Moderation
const getAllReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({}).populate('product', 'name sku').sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    next(error);
  }
};

const toggleReviewApproval = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);
    if (review) {
      review.isApproved = !review.isApproved;
      await review.save();

      // Recalculate average rating for the linked product
      const product = await Product.findById(review.product);
      if (product) {
        const approvedReviews = await Review.find({ product: product._id, isApproved: true });
        if (approvedReviews.length > 0) {
          product.reviewsCount = approvedReviews.length;
          product.rating = approvedReviews.reduce((acc, item) => item.rating + acc, 0) / approvedReviews.length;
        } else {
          product.reviewsCount = 0;
          product.rating = 5;
        }
        await product.save();
      }

      res.json(review);
    } else {
      res.status(404);
      throw new Error('Review not found');
    }
  } catch (error) {
    next(error);
  }
};

const deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);
    if (review) {
      const productId = review.product;
      await Review.findByIdAndDelete(req.params.id);

      // Recalculate average rating for the linked product
      const product = await Product.findById(productId);
      if (product) {
        const approvedReviews = await Review.find({ product: productId, isApproved: true });
        if (approvedReviews.length > 0) {
          product.reviewsCount = approvedReviews.length;
          product.rating = approvedReviews.reduce((acc, item) => item.rating + acc, 0) / approvedReviews.length;
        } else {
          product.reviewsCount = 0;
          product.rating = 5;
        }
        await product.save();
      }

      res.json({ message: 'Review deleted successfully' });
    } else {
      res.status(404);
      throw new Error('Review not found');
    }
  } catch (error) {
    next(error);
  }
};

const getSettings = async (req, res, next) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    res.json(settings);
  } catch (error) {
    next(error);
  }
};

const updateSettings = async (req, res, next) => {
  const { brandName, supportEmail, allowedPincodes, salesTax, shippingCharge } = req.body;
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }
    if (brandName !== undefined) {
      if (!brandName || brandName.trim() === '') {
        res.status(400);
        throw new Error('Brand name cannot be empty.');
      }
      settings.brandName = brandName.trim();
    }
    if (supportEmail !== undefined) {
      const { validateEmail } = require('../utils/validators');
      if (!validateEmail(supportEmail.trim())) {
        res.status(400);
        throw new Error('Please enter a valid support email address.');
      }
      settings.supportEmail = supportEmail.trim();
    }
    if (allowedPincodes !== undefined) {
      const pins = allowedPincodes.split(',').map(p => p.trim());
      const isValid = pins.every(pin => /^\d{6}$/.test(pin));
      if (!isValid || pins.length === 0) {
        res.status(400);
        throw new Error('Allowed pincodes must be a comma-separated list of exactly 6-digit numbers.');
      }
      settings.allowedPincodes = pins.join(', ');
    }
    if (salesTax !== undefined) {
      const tax = Number(salesTax);
      if (isNaN(tax) || tax < 0 || tax > 100) {
        res.status(400);
        throw new Error('Sales tax percentage must be a number between 0% and 100%.');
      }
      settings.salesTax = tax;
    }
    if (shippingCharge !== undefined) {
      const shipping = Number(shippingCharge);
      if (isNaN(shipping) || shipping < 0) {
        res.status(400);
        throw new Error('Shipping charge must be a non-negative number.');
      }
      settings.shippingCharge = shipping;
    }

    const updatedSettings = await settings.save();
    res.json(updatedSettings);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Export and download Sales Report as Excel file (.xlsx)
 * @route   GET /api/admin/reports/sales
 * @access  Private/Admin
 */
const exportSalesReport = async (req, res, next) => {
  const ExcelJS = require('exceljs');
  const { type, startDate, endDate } = req.query;
  
  try {
    let dateFilter = {};
    const today = new Date();

    if (type === 'daily') {
      const start = new Date(today.setHours(0,0,0,0));
      const end = new Date(today.setHours(23,59,59,999));
      dateFilter = { createdAt: { $gte: start, $lte: end } };
    } else if (type === 'weekly') {
      const start = new Date(today.setDate(today.getDate() - 7));
      dateFilter = { createdAt: { $gte: start } };
    } else if (type === 'monthly') {
      const start = new Date(today.setDate(today.getDate() - 30));
      dateFilter = { createdAt: { $gte: start } };
    } else if (type === 'custom') {
      if (!startDate || !endDate) {
        res.status(400);
        throw new Error('Please select both start and end dates for a custom report');
      }
      const start = new Date(startDate);
      start.setHours(0,0,0,0);
      const end = new Date(endDate);
      end.setHours(23,59,59,999);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        res.status(400);
        throw new Error('Invalid date parameters provided');
      }
      if (start > end) {
        res.status(400);
        throw new Error('Start date must be before or equal to end date');
      }

      const todayMax = new Date();
      todayMax.setHours(23, 59, 59, 999);
      if (start > todayMax || end > todayMax) {
        res.status(400);
        throw new Error('Future dates are not allowed for sales reports');
      }

      dateFilter = { createdAt: { $gte: start, $lte: end } };
    }

    const orders = await Order.find(dateFilter)
      .populate('user', 'name email')
      .populate('items.product', 'category');

    let totalSales = 0;
    let totalRevenue = 0;
    let totalQty = 0;
    let nonCancelledCount = 0;
    const productSalesCount = {};

    orders.forEach(order => {
      if (order.orderStatus !== 'Cancelled') {
        totalSales += order.totalPrice;
        totalRevenue += order.totalPrice - (order.taxPrice + order.shippingPrice);
        nonCancelledCount++;
        
        order.items.forEach(item => {
          totalQty += item.quantity;
          productSalesCount[item.name] = (productSalesCount[item.name] || 0) + item.quantity;
        });
      }
    });

    const averageOrderValue = nonCancelledCount > 0 ? (totalSales / nonCancelledCount) : 0;

    let topProduct = 'N/A';
    let maxSold = 0;
    for (const prod in productSalesCount) {
      if (productSalesCount[prod] > maxSold) {
        maxSold = productSalesCount[prod];
        topProduct = `${prod} (${maxSold} sold)`;
      }
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sales Report');

    // Title Row (merged across 24 columns)
    sheet.mergeCells('A1:X1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'FLORISH SALES PERFORMANCE REPORT';
    titleCell.font = { name: 'Arial', family: 4, size: 16, bold: true, color: { argb: 'FF1B4332' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).height = 30;

    // Subtitle Row
    sheet.mergeCells('A2:X2');
    const subtitleCell = sheet.getCell('A2');
    const filterInfo = startDate && endDate ? `${startDate} to ${endDate}` : (type || 'FULL').toUpperCase();
    subtitleCell.value = `Filter Mode: ${filterInfo} | Generation Date: ${new Date().toLocaleDateString('en-IN')}`;
    subtitleCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF555555' } };
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(2).height = 20;

    // Summary Card 1: Total Sales
    sheet.mergeCells('A4:C4');
    sheet.getCell('A4').value = 'TOTAL SALES';
    sheet.getCell('A4').font = { size: 9, bold: true, color: { argb: 'FF666666' } };
    sheet.getCell('A4').alignment = { horizontal: 'center', vertical: 'middle' };
    
    sheet.mergeCells('A5:C5');
    sheet.getCell('A5').value = totalSales;
    sheet.getCell('A5').font = { size: 14, bold: true, color: { argb: 'FF1B4332' } };
    sheet.getCell('A5').alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getCell('A5').numFmt = '₹#,##0.00';

    // Summary Card 2: Orders Processed
    sheet.mergeCells('E4:G4');
    sheet.getCell('E4').value = 'TOTAL ORDERS';
    sheet.getCell('E4').font = { size: 9, bold: true, color: { argb: 'FF666666' } };
    sheet.getCell('E4').alignment = { horizontal: 'center', vertical: 'middle' };

    sheet.mergeCells('E5:G5');
    sheet.getCell('E5').value = orders.length;
    sheet.getCell('E5').font = { size: 14, bold: true, color: { argb: 'FF1B4332' } };
    sheet.getCell('E5').alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getCell('E5').numFmt = '#,##0';

    // Summary Card 3: Total Items Sold
    sheet.mergeCells('I4:K4');
    sheet.getCell('I4').value = 'TOTAL ITEMS SOLD';
    sheet.getCell('I4').font = { size: 9, bold: true, color: { argb: 'FF666666' } };
    sheet.getCell('I4').alignment = { horizontal: 'center', vertical: 'middle' };

    sheet.mergeCells('I5:K5');
    sheet.getCell('I5').value = totalQty;
    sheet.getCell('I5').font = { size: 14, bold: true, color: { argb: 'FF1B4332' } };
    sheet.getCell('I5').alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getCell('I5').numFmt = '#,##0';

    // Summary Card 4: Top Selling Product
    sheet.mergeCells('M4:P4');
    sheet.getCell('M4').value = 'TOP SELLING PRODUCT';
    sheet.getCell('M4').font = { size: 9, bold: true, color: { argb: 'FF666666' } };
    sheet.getCell('M4').alignment = { horizontal: 'center', vertical: 'middle' };

    sheet.mergeCells('M5:P5');
    sheet.getCell('M5').value = topProduct;
    sheet.getCell('M5').font = { size: 10, bold: true, color: { argb: 'FF1B4332' } };
    sheet.getCell('M5').alignment = { horizontal: 'center', vertical: 'middle' };

    // Format all summary cards background and border
    const cardRanges = ['A4:C5', 'E4:G5', 'I4:K5', 'M4:P5'];
    cardRanges.forEach(range => {
      const parts = range.split(':');
      const startCol = parts[0].charCodeAt(0) - 65 + 1;
      const startRow = parseInt(parts[0].substring(1));
      const endCol = parts[1].charCodeAt(0) - 65 + 1;
      const endRow = parseInt(parts[1].substring(1));

      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          const cell = sheet.getCell(r, c);
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF4F9F4' }
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD2E2D2' } },
            left: { style: 'thin', color: { argb: 'FFD2E2D2' } },
            bottom: { style: 'thin', color: { argb: 'FFD2E2D2' } },
            right: { style: 'thin', color: { argb: 'FFD2E2D2' } }
          };
        }
      }
    });

    sheet.getRow(4).height = 18;
    sheet.getRow(5).height = 25;

    // Header values (24 Columns)
    const headers = [
      'Order ID', 'Invoice Number', 'Order Date', 'Customer Name', 'Customer Email', 
      'Customer Phone', 'Shipping Address', 'Product Name', 'Product Category', 
      'Quantity', 'Unit Price (₹)', 'Subtotal (₹)', 'Discount (₹)', 
      'Tax (₹)', 'Shipping Charge (₹)', 'Final Total (₹)', 
      'Payment Method', 'Payment Status', 'Order Status', 'Order Source',
      'Promo Code Used', 'Cancellation Status', 'Delivery Estimate', 'Admin Notes'
    ];
    const headerRow = sheet.getRow(7);
    headerRow.values = headers;
    headerRow.font = { name: 'Arial', family: 4, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1B4332' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 25;

    let currentRow = 8;
    orders.forEach(order => {
      const displayId = order._id.toString().substring(order._id.toString().length - 6).toUpperCase();
      const invoiceNo = `FL-${displayId}`;
      const dateStr = new Date(order.createdAt).toISOString().substring(0, 10);
      const clientName = order.user ? order.user.name : 'Guest';
      const clientEmail = order.user ? order.user.email : (order.shippingAddress?.email || 'N/A');
      const clientPhone = order.shippingAddress ? order.shippingAddress.phone : 'N/A';
      
      let fullAddress = 'N/A';
      if (order.shippingAddress) {
        const addr = order.shippingAddress;
        fullAddress = `${addr.address}, ${addr.city} - ${addr.pincode}`;
      }

      order.items.forEach(item => {
        const row = sheet.getRow(currentRow);
        
        let category = 'General';
        if (item.product && item.product.category) {
          category = item.product.category;
        }
        
        const itemSubtotal = item.price * item.quantity;

        row.values = [
          order._id.toString(),
          invoiceNo,
          dateStr,
          clientName,
          clientEmail,
          clientPhone,
          fullAddress,
          item.name,
          category,
          item.quantity,
          item.price,
          itemSubtotal,
          order.discountPrice || 0,
          order.taxPrice || 0,
          order.shippingPrice || 0,
          order.totalPrice,
          order.paymentMethod.toUpperCase(),
          order.paymentStatus.toUpperCase(),
          order.orderStatus,
          'Web', // Order Source
          order.promoCode || 'None', // Promo Code Used
          order.orderStatus === 'Cancelled' ? 'Yes' : 'No', // Cancellation Status
          order.deliveredAt ? new Date(order.deliveredAt).toISOString().substring(0, 10) : '3-5 Business Days', // Delivery Estimate
          'None' // Admin Notes
        ];

        row.font = { name: 'Arial', size: 9 };
        row.alignment = { vertical: 'middle' };
        
        // Zebra striping
        if (currentRow % 2 === 0) {
          for (let i = 1; i <= 24; i++) {
            row.getCell(i).fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF9FBF9' }
            };
          }
        }

        // Borders
        for (let i = 1; i <= 24; i++) {
          row.getCell(i).border = {
            bottom: { style: 'thin', color: { argb: 'FFEAEAEA' } }
          };
        }

        // Cell formatting
        row.getCell(10).numFmt = '#,##0';
        row.getCell(11).numFmt = '₹#,##0.00';
        row.getCell(12).numFmt = '₹#,##0.00';
        row.getCell(13).numFmt = '₹#,##0.00';
        row.getCell(14).numFmt = '₹#,##0.00';
        row.getCell(15).numFmt = '₹#,##0.00';
        row.getCell(16).numFmt = '₹#,##0.00';

        currentRow++;
      });
    });

    // Freeze top 7 rows (Title, subtitle, summary card, card values, empty row, header row)
    sheet.views = [
      { state: 'frozen', xSplit: 0, ySplit: 7, activeCell: 'A8' }
    ];

    // Enable filtering across the header and data rows
    if (currentRow > 8) {
      sheet.autoFilter = {
        from: { row: 7, column: 1 },
        to: { row: currentRow - 1, column: 24 }
      };
    }

    // Dynamic width auto-fit (ignoring rows 1-6 title/summaries to prevent extra wide columns)
    sheet.columns.forEach((column, colIdx) => {
      let maxLength = 0;
      for (let r = 7; r < currentRow; r++) {
        const cellValue = sheet.getCell(r, colIdx + 1).value;
        const cellLen = cellValue ? cellValue.toString().length : 0;
        if (cellLen > maxLength) {
          maxLength = cellLen;
        }
      }
      column.width = Math.max(maxLength + 4, 12);
    });

    const fileToday = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Florish_Sales_Report_${fileToday}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Deactivate and soft delete a user account
 * @route   DELETE /api/admin/users/:id
 * @access  Private/Admin
 */
const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    if (user._id.toString() === req.user._id.toString()) {
      res.status(400);
      throw new Error('Cannot delete your own administrator account');
    }

    if (user.role === 'admin') {
      res.status(400);
      throw new Error('Cannot delete an administrator account');
    }

    // Soft delete / deactivate user account
    user.isDeleted = true;
    user.isActive = false;
    await user.save();

    res.json({ message: 'User deactivated and deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addProduct,
  getAllProducts,
  getDashboardStats,
  updateOrderStatus,
  updateProduct,
  deleteProduct,
  getAllUsers,
  toggleUserStatus,
  getUserOrders,
  getAllOrders,
  archiveOrder,
  getAllPromos,
  createPromo,
  updatePromo,
  deletePromo,
  getAllReviews,
  toggleReviewApproval,
  deleteReview,
  getSettings,
  updateSettings,
  exportSalesReport,
  deleteUser
};
