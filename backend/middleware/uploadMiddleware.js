/*
 * UploadMiddleware.js - Multer Image Uploader Config
 * Purpose: Customizes storage paths for inventory uploads, creates unique timestamp file names, and validates image files.
 */

const multer = require('multer');
const path = require('path');

// Configure Disk Storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Save to backend uploads folder
    cb(null, path.join(__dirname, '../uploads/'));
  },
  filename: function (req, file, cb) {
    // Generate unique timestamp file name
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Validate image file extensions
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp|gif/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type! Only image formats (JPG, PNG, WEBP) are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 5 }, // 5MB limit
  fileFilter: fileFilter
});

module.exports = upload;
