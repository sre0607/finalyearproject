const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const Product = require('../models/Product');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { uploadImage } = require('../utils/imageUploader');

const isValidDirectImageUrl = (url) => {
  if (!url) return { valid: false, reason: 'Image URL is required.' };
  url = url.trim();
  
  if (url.startsWith('/uploads/')) {
    return { valid: true };
  }
  
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return { valid: false, reason: 'Category image URL must start with http:// or https://' };
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


// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
router.get('/', async (req, res, next) => {
  try {
    const categories = await Category.find({}).sort({ name: 1 });
    const categoriesWithCount = await Promise.all(
      categories.map(async (cat) => {
        const count = await Product.countDocuments({ category: cat.slug, isDeleted: { $ne: true } });
        return {
          ...cat.toObject(),
          productsCount: count
        };
      })
    );
    res.json(categoriesWithCount);
  } catch (error) {
    next(error);
  }
});

// @desc    Create a category
// @route   POST /api/categories
// @access  Private/Admin
router.post('/', protect, admin, upload.single('image'), async (req, res, next) => {
  const { name, slug } = req.body;

  try {
    if (!name || name.trim() === '' || /<script/i.test(name)) {
      res.status(400);
      throw new Error('Category name is required and cannot contain script injection.');
    }

    if (!slug || slug.trim() === '' || !/^[a-z0-9-]+$/.test(slug.toLowerCase().trim())) {
      res.status(400);
      throw new Error('Category slug is required and can only contain letters, numbers, and dashes.');
    }

    const nameExists = await Category.findOne({ name: { $regex: new RegExp(`^${name.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') } });
    if (nameExists) {
      res.status(400);
      throw new Error('Category with this name already exists.');
    }

    const categoryExists = await Category.findOne({ slug: slug.toLowerCase().trim() });
    if (categoryExists) {
      res.status(400);
      throw new Error('Category with this slug already exists.');
    }

    let finalImage = '';
    if (req.file) {
      const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];
      const path = require('path');
      const ext = path.extname(req.file.originalname).toLowerCase();
      if (!allowedExts.includes(ext)) {
        res.status(400);
        throw new Error('Category image must be a valid format (JPG, JPEG, PNG, WEBP).');
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

    const category = await Category.create({
      name: name.trim(),
      slug: slug.toLowerCase().trim(),
      image: finalImage || undefined
    });

    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
});

// @desc    Update a category
// @route   PUT /api/categories/:id
// @access  Private/Admin
router.put('/:id', protect, admin, upload.single('image'), async (req, res, next) => {
  const { name, slug } = req.body;

  try {
    const category = await Category.findById(req.params.id);

    if (category) {
      const oldSlug = category.slug;
      
      if (name !== undefined) {
        if (!name || name.trim() === '' || /<script/i.test(name)) {
          res.status(400);
          throw new Error('Category name cannot be empty and cannot contain script injection.');
        }
        const nameExists = await Category.findOne({
          _id: { $ne: category._id },
          name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
        });
        if (nameExists) {
          res.status(400);
          throw new Error('Category with this name already exists.');
        }
        category.name = name.trim();
      }

      if (slug !== undefined) {
        if (!slug || slug.trim() === '' || !/^[a-z0-9-]+$/.test(slug.toLowerCase().trim())) {
          res.status(400);
          throw new Error('Category slug cannot be empty and can only contain letters, numbers, and dashes.');
        }
        const slugExists = await Category.findOne({
          _id: { $ne: category._id },
          slug: slug.toLowerCase().trim()
        });
        if (slugExists) {
          res.status(400);
          throw new Error('Category with this slug already exists.');
        }
        category.slug = slug.toLowerCase().trim();
      }

      let finalImage = category.image;
      if (req.file) {
        const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];
        const path = require('path');
        const ext = path.extname(req.file.originalname).toLowerCase();
        if (!allowedExts.includes(ext)) {
          res.status(400);
          throw new Error('Category image must be a valid format (JPG, JPEG, PNG, WEBP).');
        }
        finalImage = await uploadImage(req.file);
      } else if (req.body.image !== undefined) {
        const imageUrl = req.body.image.trim();
        const check = isValidDirectImageUrl(imageUrl);
        if (!check.valid) {
          res.status(400);
          throw new Error(check.reason);
        }
        finalImage = imageUrl;
      }

      category.image = finalImage;

      const updatedCategory = await category.save();

      // If the slug changed, update all products assigned to the old slug!
      if (slug && slug.toLowerCase().trim() !== oldSlug) {
        await Product.updateMany({ category: oldSlug }, { category: slug.toLowerCase().trim() });
      }

      res.json(updatedCategory);
    } else {
      res.status(404);
      throw new Error('Category not found');
    }
  } catch (error) {
    next(error);
  }
});

// @desc    Delete a category
// @route   DELETE /api/categories/:id
// @access  Private/Admin
router.delete('/:id', protect, admin, async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);

    if (category) {
      // Check if products exist in this category
      const productCount = await Product.countDocuments({ category: category.slug, isDeleted: { $ne: true } });
      if (productCount > 0) {
        res.status(400);
        throw new Error('This category contains products. Move them or delete them first.');
      }

      await Category.findByIdAndDelete(req.params.id);
      res.json({ message: 'Category removed successfully' });
    } else {
      res.status(404);
      throw new Error('Category not found');
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
