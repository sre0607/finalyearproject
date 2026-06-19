/*
 * Db.js - MongoDB Database Connector with In-Memory Fallback & Auto-Seeding
 * Purpose: Initializes standard connection, falls back to mongodb-memory-server if local/remote MongoDB is unavailable, and auto-seeds database if empty.
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// Load models for auto-seeding
const User = require('../models/User');
const Product = require('../models/Product');
const Promo = require('../models/Promo');
const Category = require('../models/Category');
const Settings = require('../models/Settings');

/**
 * Automatically seeds the database with default categories, products, and users if empty
 */
async function seedIfEmpty() {
  try {
    // 1. Settings seeding
    console.log('[AUTO-SEED] Checking settings...');
    const settingsCount = await Settings.countDocuments();
    if (settingsCount === 0) {
      console.log('[AUTO-SEED] Seeding default settings...');
      await Settings.create({
        brandName: 'Florish',
        supportEmail: 'hello@florish-shop.com',
        allowedPincodes: '400001, 400002, 400003, 400029, 400032',
        salesTax: 8.0,
        shippingCharge: 99
      });
    } else {
      console.log('[AUTO-SEED] Settings already exist. Skipping.');
    }

    // 2. Categories seeding
    console.log('[AUTO-SEED] Checking categories...');
    const categoryCount = await Category.countDocuments();
    if (categoryCount === 0) {
      console.log('[AUTO-SEED] Seeding default categories...');
      const categoriesToSeed = [
        { name: "Bouquets", slug: "bouquets", image: "https://images.unsplash.com/photo-1596436889106-be35e843f974?q=80&w=400" },
        { name: "Roses Collection", slug: "roses", image: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=400" },
        { name: "Indoor Plants", slug: "indoor", image: "https://images.unsplash.com/photo-1596547609652-9cf5d8d76921?q=80&w=400" },
        { name: "Fragrant Lilies", slug: "lilies", image: "https://images.unsplash.com/photo-1508610048659-a06b669e3321?q=80&w=400" },
        { name: "Seasonal Specials", slug: "seasonal", image: "https://images.unsplash.com/photo-1520763185298-1b434c919102?q=80&w=400" },
        { name: "Wedding Collections", slug: "wedding", image: "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=400" },
        { name: "Anniversary Flowers", slug: "anniversary", image: "https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=400" },
        { name: "Birthday Flowers", slug: "birthday", image: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?q=80&w=400" },
        { name: "Luxury Arrangements", slug: "luxury", image: "https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?q=80&w=400" },
        { name: "Gift Combos", slug: "combos", image: "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?q=80&w=400" }
      ];
      await Category.insertMany(categoriesToSeed);
    } else {
      console.log('[AUTO-SEED] Categories already exist. Skipping.');
    }

    // 3. Products seeding
    console.log('[AUTO-SEED] Checking products...');
    const productCount = await Product.countDocuments({ isDeleted: { $ne: true } });
    const sampleDataPath = path.join(__dirname, '../../database/sample-data.json');
    
    if (fs.existsSync(sampleDataPath)) {
      const sampleData = JSON.parse(fs.readFileSync(sampleDataPath, 'utf-8'));
      
      if (productCount === 0) {
        console.log('[AUTO-SEED] Database is empty. Seeding sample data...');
        
        // Hash passwords of sample users before inserting
        const usersToInsert = [];
        for (const u of sampleData.users) {
          const email = u.role === 'admin' ? (process.env.ADMIN_EMAIL || u.email) : u.email;
          const name = u.role === 'admin' ? (process.env.ADMIN_NAME || u.name) : u.name;
          const password = u.role === 'admin' ? (process.env.ADMIN_PASSWORD || 'admin123') : 'user123';
          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash(password, salt);

          usersToInsert.push({
            name,
            email,
            password: hashedPassword,
            role: u.role
          });
        }
        
        const Review = require('../models/Review');
        
        const createdUsers = await User.insertMany(usersToInsert);
        const seededProducts = await Product.insertMany(sampleData.products);
        
        const reviewComments = [
          { rating: 5, comment: "Exquisite blooms! Arrived fresh and stayed beautiful for more than a week.", name: "Emily Watson" },
          { rating: 5, comment: "Perfect arrangement. The colors were vibrant and the fragrance was lovely.", name: "Michael Chang" },
          { rating: 4, comment: "Very beautiful and nicely packed. Delivery was slightly late but customer support was helpful.", name: "Sophia Loren" },
          { rating: 4, comment: "Fresh stems and elegant wrapping. A lovely surprise gift.", name: "David Miller" },
          { rating: 5, comment: "Absolutely loved the quality and service. Will order again!", name: "Sarah Connor" },
          { rating: 3, comment: "Flowers were beautiful, but some rose petals were slightly bruised on arrival.", name: "John Connor" }
        ];

        for (const prod of seededProducts) {
          const r1 = reviewComments[Math.floor(Math.random() * reviewComments.length)];
          let r2 = reviewComments[Math.floor(Math.random() * reviewComments.length)];
          while (r1.comment === r2.comment) {
            r2 = reviewComments[Math.floor(Math.random() * reviewComments.length)];
          }

          // Create dynamic reviews in database linked to the seeded users
          await Review.create({
            product: prod._id,
            user: createdUsers[0]._id,
            name: r1.name,
            rating: r1.rating,
            comment: r1.comment
          });

          await Review.create({
            product: prod._id,
            user: createdUsers[1]._id,
            name: r2.name,
            rating: r2.rating,
            comment: r2.comment
          });

          prod.reviewsCount = 2;
          prod.rating = (r1.rating + r2.rating) / 2;
          await prod.save();
        }
        
        if (sampleData.promos && sampleData.promos.length > 0) {
          await Promo.insertMany(sampleData.promos);
          console.log('[AUTO-SEED] Seeding default promo codes...');
        }
        
        console.log('[AUTO-SEED] Database successfully seeded with sample data, reviews, and promos.');
      } else {
        console.log('[AUTO-SEED] Products already exist. Skipping.');
      }
    } else {
      console.warn('[AUTO-SEED] WARNING: Sample data file not found at:', sampleDataPath);
    }

    // Verify and patch featured products to make sure they have required fields
    const featuredProducts = await Product.find({ isFeatured: true, isDeleted: { $ne: true } });
    for (const prod of featuredProducts) {
      let modified = false;
      if (!prod.image) {
        prod.image = '';
        modified = true;
      }
      if (prod.price === undefined || prod.price === null) {
        prod.price = 29.99;
        modified = true;
      }
      if (!prod.category) {
        prod.category = 'bouquets';
        modified = true;
      }
      if (prod.stock === undefined || prod.stock === null) {
        prod.stock = 10;
        modified = true;
      }
      if (!prod.description) {
        prod.description = 'A beautiful arrangement of fresh flowers.';
        modified = true;
      }
      if (modified) {
        await prod.save();
      }
    }

    // Ensure at least 8 featured products exist and are fully populated
    const finalFeaturedCount = await Product.countDocuments({ isFeatured: true, isDeleted: { $ne: true }, isHidden: { $ne: true } });
    if (finalFeaturedCount < 8) {
      console.log(`[AUTO-SEED] Found only ${finalFeaturedCount} featured products. Flagging more to reach minimum of 8...`);
      const candidates = await Product.find({ 
        isFeatured: { $ne: true }, 
        isDeleted: { $ne: true }, 
        isHidden: { $ne: true },
        image: { $exists: true, $ne: '' },
        price: { $exists: true, $ne: null },
        category: { $exists: true, $ne: '' },
        stock: { $exists: true, $ne: null },
        description: { $exists: true, $ne: '' }
      }).limit(8 - finalFeaturedCount);

      for (const cand of candidates) {
        cand.isFeatured = true;
        await cand.save();
      }
      console.log(`[AUTO-SEED] Flagged ${candidates.length} additional products as featured.`);
    } else {
      console.log(`[AUTO-SEED] Checked featured products: ${finalFeaturedCount} exist.`);
    }

    // Ensure administrator user is seeded automatically if missing
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@florish.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const adminName = process.env.ADMIN_NAME || 'Administrator';

    const adminExists = await User.findOne({ email: adminEmail });
    if (!adminExists) {
      console.log(`[AUTO-SEED] Administrator user (${adminEmail}) not found. Seeding admin automatically...`);
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(adminPassword, salt);
      await User.create({
        name: adminName,
        email: adminEmail,
        password: hashedPassword,
        role: 'admin'
      });
    }

    // 4. Self-healing / Repair of image paths
    console.log('[AUTO-SEED] Auditing and repairing product/category images...');
    const allProducts = await Product.find({});
    let repairedProductsCount = 0;
    const defaultProductImage = 'https://images.unsplash.com/photo-1596436889106-be35e843f974?q=80&w=600';

    for (const prod of allProducts) {
      let changed = false;
      let img = prod.image ? prod.image.trim() : '';

      if (!img) {
        img = defaultProductImage;
        changed = true;
      } else if (!img.startsWith('http://') && !img.startsWith('https://') && !img.startsWith('data:')) {
        // Normalize slashes
        let normalized = img.replace(/\\/g, '/');
        if (normalized.startsWith('uploads/')) {
          normalized = '/' + normalized;
        }
        if (normalized !== img) {
          img = normalized;
          changed = true;
        }
      }

      if (changed) {
        prod.image = img;
        await prod.save();
        repairedProductsCount++;
      }
    }

    const allCategories = await Category.find({});
    let repairedCategoriesCount = 0;
    const defaultCategoryImage = 'https://images.unsplash.com/photo-1596436889106-be35e843f974?q=80&w=400';

    for (const cat of allCategories) {
      let changed = false;
      let img = cat.image ? cat.image.trim() : '';

      if (!img) {
        img = defaultCategoryImage;
        changed = true;
      } else if (!img.startsWith('http://') && !img.startsWith('https://') && !img.startsWith('data:')) {
        // Normalize slashes
        let normalized = img.replace(/\\/g, '/');
        if (normalized.startsWith('uploads/')) {
          normalized = '/' + normalized;
        }
        if (normalized !== img) {
          img = normalized;
          changed = true;
        }
      }

      if (changed) {
        cat.image = img;
        await cat.save();
        repairedCategoriesCount++;
      }
    }
    console.log(`[AUTO-SEED] Image self-healing repair complete: patched ${repairedProductsCount} products and ${repairedCategoriesCount} categories.`);

    console.log('[AUTO-SEED] Seed complete.');
  } catch (err) {
    console.error('[AUTO-SEED] Error during auto-seeding:', err.message);
  }
}

/**
 * Connects to MongoDB cluster with configured fallback paths
 */
const connectDB = async () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const connUri = process.env.MONGO_URI;

  if (!connUri || connUri === 'your_mongodb_connection_string') {
    if (isProduction) {
      console.error('\n[DB CONFIG] FATAL ERROR: MONGO_URI environment variable is missing or unconfigured in production! Failing fast...');
      process.exit(1);
    }
    console.warn('\n[DB CONFIG] MONGO_URI is missing or unconfigured. Falling back to in-memory database...');
    return await connectToMemoryServer();
  }
  
  // Automatically encode password special characters if present in MONGO_URI
  let formattedUri = connUri;
  try {
    if (connUri.startsWith('mongodb://') || connUri.startsWith('mongodb+srv://')) {
      const prefix = connUri.startsWith('mongodb+srv://') ? 'mongodb+srv://' : 'mongodb://';
      const remainder = connUri.substring(prefix.length);
      
      const lastAtIdx = remainder.lastIndexOf('@');
      if (lastAtIdx !== -1) {
        const authPart = remainder.substring(0, lastAtIdx);
        const hostPart = remainder.substring(lastAtIdx + 1);
        
        const colonIdx = authPart.indexOf(':');
        if (colonIdx !== -1) {
          const username = authPart.substring(0, colonIdx);
          const password = authPart.substring(colonIdx + 1);
          
          // Encode special characters inside the password safely
          const encodedPassword = encodeURIComponent(decodeURIComponent(password));
          formattedUri = `${prefix}${username}:${encodedPassword}@${hostPart}`;
        }
      }
    }
  } catch (err) {
    console.error('Error parsing/encoding MONGO_URI password:', err.message);
  }

  try {
    console.log(`Attempting to connect to configured MongoDB...`);
    const conn = await mongoose.connect(formattedUri, {
      serverSelectionTimeoutMS: 5000 // Limit wait to 5 seconds
    });
    console.log(`MongoDB Connected successfully: ${conn.connection.host}`);
    await seedIfEmpty();
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    if (isProduction) {
      console.error('[DB CONFIG] FATAL ERROR: Failed to connect to MongoDB Atlas in production! Failing fast...');
      process.exit(1);
    }
    console.warn('Configured MongoDB connection failed. Falling back to in-memory database for development...');
    await connectToMemoryServer();
  }
};

/**
 * Helper to spin up MongoMemoryServer and connect to it
 */
async function connectToMemoryServer() {
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    
    console.log(`[IN-MEMORY DB] Starting MongoMemoryServer...`);
    const conn = await mongoose.connect(uri);
    console.log(`[IN-MEMORY DB] Connected successfully to in-memory database: ${conn.connection.host}`);
    
    // Auto-seed database
    await seedIfEmpty();
  } catch (err) {
    console.error('[IN-MEMORY DB] FATAL ERROR: Failed to start in-memory database:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
