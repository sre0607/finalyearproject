/*
 * Seeder.js - Database Seeder Utility
 * Purpose: Connects to MongoDB, wipes collections, hashes sample passwords, and inserts initial users/products catalog.
 * Usage:
 *   - Import: node seeder.js -i
 *   - Destroy: node seeder.js -d
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

// Load environment variables
dotenv.config();

// Load models
const User = require('./models/User');
const Product = require('./models/Product');
const Cart = require('./models/Cart');
const Order = require('./models/Order');
const Wishlist = require('./models/Wishlist');
const Review = require('./models/Review');
const Promo = require('./models/Promo');

// Connect to Database
const connUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/florish';

const connectDB = async () => {
  try {
    await mongoose.connect(connUri);
    console.log('Database connected for seeding...');
  } catch (error) {
    console.error(`Database Connection Error during seeding: ${error.message}`);
    process.exit(1);
  }
};

// Import sample data
const importData = async () => {
  try {
    // Connect to database
    await connectDB();

    // Clear existing collections
    await User.deleteMany();
    await Product.deleteMany();
    await Cart.deleteMany();
    await Order.deleteMany();
    await Wishlist.deleteMany();
    await Review.deleteMany();
    await Promo.deleteMany();
    console.log('Prior records deleted...');

    // Load sample data file
    const sampleDataPath = path.join(__dirname, '../database/sample-data.json');
    const sampleData = JSON.parse(fs.readFileSync(sampleDataPath, 'utf-8'));

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

    // Insert users and products
    const createdUsers = await User.insertMany(usersToInsert);
    console.log(`${createdUsers.length} Users successfully imported.`);

    const createdProducts = await Product.insertMany(sampleData.products);
    console.log(`${createdProducts.length} Products successfully imported.`);

    const reviewComments = [
      { rating: 5, comment: "Exquisite blooms! Arrived fresh and stayed beautiful for more than a week.", name: "Emily Watson" },
      { rating: 5, comment: "Perfect arrangement. The colors were vibrant and the fragrance was lovely.", name: "Michael Chang" },
      { rating: 4, comment: "Very beautiful and nicely packed. Delivery was slightly late but customer support was helpful.", name: "Sophia Loren" },
      { rating: 4, comment: "Fresh stems and elegant wrapping. A lovely surprise gift.", name: "David Miller" },
      { rating: 5, comment: "Absolutely loved the quality and service. Will order again!", name: "Sarah Connor" },
      { rating: 3, comment: "Flowers were beautiful, but some rose petals were slightly bruised on arrival.", name: "John Connor" }
    ];

    for (const prod of createdProducts) {
      const r1 = reviewComments[Math.floor(Math.random() * reviewComments.length)];
      let r2 = reviewComments[Math.floor(Math.random() * reviewComments.length)];
      while (r1.comment === r2.comment) {
        r2 = reviewComments[Math.floor(Math.random() * reviewComments.length)];
      }

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
      console.log(`${sampleData.promos.length} Promos successfully imported.`);
    }

    console.log('Data and reviews successfully seeded!');
    process.exit(0);
  } catch (error) {
    console.error(`Error importing sample data: ${error.message}`);
    process.exit(1);
  }
};

// Wipe database records
const destroyData = async () => {
  try {
    await connectDB();

    await User.deleteMany();
    await Product.deleteMany();
    await Cart.deleteMany();
    await Order.deleteMany();
    await Wishlist.deleteMany();
    await Review.deleteMany();
    await Promo.deleteMany();

    console.log('Database records completely wiped!');
    process.exit(0);
  } catch (error) {
    console.error(`Error destroying database data: ${error.message}`);
    process.exit(1);
  }
};

// Determine CLI execution command flags
if (process.argv[2] === '-i') {
  importData();
} else if (process.argv[2] === '-d') {
  destroyData();
} else {
  console.log('Please run seeder with correct execution arguments:');
  console.log('  Import database: node seeder.js -i');
  console.log('  Destroy database: node seeder.js -d');
  process.exit(0);
}
