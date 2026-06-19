/*
 * Product.js - Mongoose Schema for Floral Inventory Items
 * Purpose: Schema representing bouquet variables, prices, categories, SKUs, stock levels, and review linkages.
 */

const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a product name'],
      trim: true,
      unique: true,
      minlength: [3, 'Product name must be at least 3 characters'],
      maxlength: [100, 'Product name cannot exceed 100 characters']
    },
    sku: {
      type: String,
      required: [true, 'Please add a product SKU code'],
      unique: true,
      trim: true
    },
    category: {
      type: String,
      required: [true, 'Please add a product category']
    },
    price: {
      type: Number,
      required: [true, 'Please add a product price'],
      min: [0.01, 'Price must be a positive number greater than 0']
    },
    oldPrice: {
      type: Number,
      default: null,
      min: [0, 'Old price cannot be negative']
    },
    description: {
      type: String,
      required: [true, 'Please add a description'],
      minlength: [10, 'Description must be at least 10 characters long']
    },
    image: {
      type: String,
      default: '',
      validate: {
        validator: function(v) {
          if (!v) return true;
          if (v.startsWith('http://') || v.startsWith('https://')) return true;
          return /\.(jpg|jpeg|png|webp)$/i.test(v);
        },
        message: 'Product image must be a valid format (JPG, JPEG, PNG, WEBP)'
      }
    },
    stock: {
      type: Number,
      required: [true, 'Please add stock levels'],
      min: [0, 'Stock cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Stock must be an integer'
      },
      default: 10
    },
    isFeatured: {
      type: Boolean,
      default: false
    },
    rating: {
      type: Number,
      default: 5
    },
    reviewsCount: {
      type: Number,
      default: 0
    },
    flowerOrigin: {
      type: String,
      default: 'Local Farms'
    },
    stemCount: {
      type: Number,
      default: 12
    },
    vaseSize: {
      type: String,
      default: 'Medium (Included)'
    },
    deliveryTags: {
      type: [String],
      default: ['Same-Day Delivery Available']
    },
    freshnessLabels: {
      type: String,
      default: '7 Days Freshness Guaranteed'
    },
    isDeleted: {
      type: Boolean,
      default: false,
      required: true
    },
    isHidden: {
      type: Boolean,
      default: false,
      required: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Product', ProductSchema);
