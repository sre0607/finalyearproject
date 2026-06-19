/*
 * Cloudinary.js - Image Hosting Integration
 * Purpose: Connects to Cloudinary Cloud API for hosting product and profile graphics securely.
 */

const cloudinary = require('cloudinary').v2;

// Configure Cloudinary variables from .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'your_cloudinary_name',
  api_key: process.env.CLOUDINARY_API_KEY || 'your_cloudinary_api_key',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'your_cloudinary_api_secret'
});

module.exports = cloudinary;
