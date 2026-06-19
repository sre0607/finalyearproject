const fs = require('fs');
const cloudinary = require('../config/cloudinary');

/**
 * Uploads a local file (from Multer storage) to Cloudinary if configured.
 * Otherwise, falls back to returning the local relative path.
 * Automatically deletes the temporary local file if uploaded to Cloudinary.
 * 
 * @param {Object} file - The req.file object from Multer
 * @returns {Promise<string>} The image URL/path to save in the database
 */
const uploadImage = async (file) => {
  if (!file) return undefined;

  const isCloudinaryConfigured = 
    process.env.CLOUDINARY_CLOUD_NAME && 
    process.env.CLOUDINARY_API_KEY && 
    process.env.CLOUDINARY_API_SECRET &&
    process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloudinary_name';

  if (isCloudinaryConfigured) {
    try {
      const result = await cloudinary.uploader.upload(file.path, {
        folder: 'florish',
        use_filename: true,
        unique_filename: true
      });

      // Delete the local file asynchronously since it's uploaded to Cloudinary
      fs.unlink(file.path, (err) => {
        if (err) console.error('[UPLOADER] Failed to delete local temp file:', err.message);
      });

      return result.secure_url;
    } catch (err) {
      console.error('[UPLOADER] Cloudinary upload error, falling back to local file:', err.message);
      return `/uploads/${file.filename}`;
    }
  }

  // Fallback to local server path
  return `/uploads/${file.filename}`;
};

module.exports = { uploadImage };
