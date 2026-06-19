const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a category name'],
      unique: true,
      trim: true
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
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
        message: 'Category image must be a valid format (JPG, JPEG, PNG, WEBP)'
      }
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Category', CategorySchema);
