const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const Product = require('./models/Product');
const Category = require('./models/Category');

const getCategoryFallback = (category, isProduct) => {
  const cat = (category || '').toLowerCase().trim();
  if (!isProduct) {
    if (cat.includes('bouquet') || cat === 'bouquets' || cat === 'lilies') return '/assets/fallbacks/bouquets.jpg';
    if (cat.includes('combo') || cat === 'combos') return '/assets/fallbacks/gift-combos.jpg';
    if (cat.includes('luxury') || cat === 'luxury') return '/assets/fallbacks/luxury-arrangements.jpg';
    if (cat.includes('indoor') || cat === 'indoor') return '/assets/fallbacks/indoor-plants.jpg';
    if (cat.includes('birthday') || cat === 'birthday') return '/assets/fallbacks/birthday-flowers.jpg';
    if (cat.includes('anniversary') || cat === 'anniversary' || cat.includes('rose') || cat === 'roses') return '/assets/fallbacks/anniversary-flowers.jpg';
    return '/assets/fallbacks/default-category.jpg';
  } else {
    if (cat.includes('bouquet') || cat === 'bouquets' || cat === 'lilies') return '/assets/fallbacks/bouquets.jpg';
    if (cat.includes('combo') || cat === 'combos') return '/assets/fallbacks/gift-combos.jpg';
    if (cat.includes('luxury') || cat === 'luxury') return '/assets/fallbacks/luxury-arrangements.jpg';
    if (cat.includes('indoor') || cat === 'indoor') return '/assets/fallbacks/indoor-plants.jpg';
    if (cat.includes('birthday') || cat === 'birthday') return '/assets/fallbacks/birthday-flowers.jpg';
    if (cat.includes('anniversary') || cat === 'anniversary' || cat.includes('rose') || cat === 'roses') return '/assets/fallbacks/anniversary-flowers.jpg';
    return '/assets/fallbacks/default-product.jpg';
  }
};

const checkImage = async (name, imageVal, isProduct, category) => {
  const defaultPlaceholder = getCategoryFallback(category, isProduct);

  if (!imageVal || typeof imageVal !== 'string' || imageVal.trim() === '') {
    return { valid: false, reason: 'empty or missing image field', replacement: defaultPlaceholder };
  }

  const trimmed = imageVal.trim();

  // 1. Check for relative uploads
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('uploads/') || trimmed.startsWith('\\uploads\\') || trimmed.startsWith('uploads\\')) {
    let basename = trimmed.split(/[/\\]/).pop();
    const localFilePath = path.join(__dirname, 'uploads', basename);
    if (!fs.existsSync(localFilePath)) {
      return { valid: false, reason: 'missing upload', replacement: defaultPlaceholder };
    }
    return { valid: true, normalized: '/uploads/' + basename };
  }

  // 2. Check for absolute URLs
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    // Check if it points to a local upload served by URL
    if (trimmed.includes('/uploads/')) {
      let basename = trimmed.split('/').pop();
      const localFilePath = path.join(__dirname, 'uploads', basename);
      if (!fs.existsSync(localFilePath)) {
        return { valid: false, reason: 'missing upload', replacement: defaultPlaceholder };
      }
      return { valid: true };
    }

    // Check external URLs (status and content-type)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(trimmed, { method: 'GET', signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.status === 404) {
        return { valid: false, reason: '404', replacement: defaultPlaceholder };
      }
      if (res.status === 403) {
        return { valid: false, reason: '403', replacement: defaultPlaceholder };
      }
      if (res.status !== 200) {
        return { valid: false, reason: `HTTP status code ${res.status}`, replacement: defaultPlaceholder };
      }

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.toLowerCase().startsWith('image/')) {
        return { 
          valid: false, 
          reason: 'non-image content', 
          replacement: defaultPlaceholder 
        };
      }

      return { valid: true };
    } catch (err) {
      clearTimeout(timeoutId);
      return { valid: false, reason: 'dead Unsplash image', replacement: defaultPlaceholder };
    }
  }

  return { valid: false, reason: 'invalid URL', replacement: defaultPlaceholder };
};

const defaultCategories = [
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

async function run() {
  let mongoUri = process.env.MONGO_URI;
  let usingMemoryDb = false;

  if (!mongoUri || mongoUri === 'your_mongodb_connection_string') {
    console.warn('MONGO_URI is missing. Falling back to in-memory database...');
    usingMemoryDb = true;
  }

  try {
    if (usingMemoryDb) {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongoServer = await MongoMemoryServer.create();
      mongoUri = mongoServer.getUri();
      console.log('Connecting to fallback in-memory database...');
      await mongoose.connect(mongoUri);
      console.log('Connected to fallback in-memory database!');
    } else {
      try {
        console.log('Connecting to database...');
        await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
        console.log('Connected to MongoDB successfully!');
      } catch (connErr) {
        console.warn('Configured MongoDB connection failed. Falling back to in-memory database...');
        usingMemoryDb = true;
        const { MongoMemoryServer } = require('mongodb-memory-server');
        const mongoServer = await MongoMemoryServer.create();
        mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);
        console.log('Connected to fallback in-memory database!');
      }
    }

    // For local testing in memory, seed with valid and broken records
    if (usingMemoryDb) {
      console.log('Seeding in-memory database with test records...');
      // 1. Seed Categories
      await Category.deleteMany({});
      const categoriesToSeed = [...defaultCategories];
      // Add a broken category
      categoriesToSeed.push({
        name: "Broken Category Link",
        slug: "broken-cat",
        image: "https://images.unsplash.com/photo-broken-link-12345"
      });
      await Category.insertMany(categoriesToSeed);

      // 2. Seed Products
      await Product.deleteMany({});
      const sampleDataPath = path.join(__dirname, '../database/sample-data.json');
      if (fs.existsSync(sampleDataPath)) {
        const sampleData = JSON.parse(fs.readFileSync(sampleDataPath, 'utf-8'));
        const productsToSeed = [...sampleData.products];
        
        // Add a few broken products for audit check
        productsToSeed.push({
          name: "Dead Unsplash Image Product",
          sku: "TEST-SKU-1",
          category: "bouquets",
          price: 10.00,
          description: "Dead unsplash image test description here",
          image: "https://images.unsplash.com/photo-broken-link-54321"
        });
        productsToSeed.push({
          name: "Non-Image HTML Page Product",
          sku: "TEST-SKU-2",
          category: "bouquets",
          price: 20.00,
          description: "HTML content type test description here",
          image: "https://example.com"
        });
        productsToSeed.push({
          name: "Missing Upload Product",
          sku: "TEST-SKU-3",
          category: "bouquets",
          price: 30.00,
          description: "Missing relative upload test description here",
          image: "/uploads/missing-test-file-999.jpg"
        });
        productsToSeed.push({
          name: "Malformed URL Product",
          sku: "TEST-SKU-4",
          category: "bouquets",
          price: 40.00,
          description: "Malformed URL test description here",
          image: "invalid-url-format-text.jpg"
        });

        await Product.insertMany(productsToSeed);
      }
    }

    const categories = await Category.find({});
    const products = await Product.find({});

    let totalCategoriesScanned = 0;
    let totalProductsScanned = 0;
    let brokenImagesFound = 0;
    let recordsRepaired = 0;

    const repairedOutput = [];

    console.log('\n========================================');
    console.log('         IMAGE AUDIT REPORT             ');
    console.log('========================================');

    // Audit Categories
    for (const cat of categories) {
      totalCategoriesScanned++;
      const check = await checkImage(cat.name, cat.image, false, cat.slug || cat.name);
      const status = check.valid ? 'VALID' : 'BROKEN';

      console.log(`Name: ${cat.name}`);
      console.log(`Collection: Category`);
      console.log(`Image URL: ${cat.image || 'N/A'}`);
      console.log(`Status: ${status}`);
      if (!check.valid) {
        console.log(`Reason: ${check.reason}`);
      }
      console.log('----------------------------------------');

      if (!check.valid) {
        brokenImagesFound++;
        const oldImage = cat.image || '';
        
        // Repair
        cat.image = check.replacement;
        if (check.normalized) {
          cat.image = check.normalized;
        }
        await cat.save();
        recordsRepaired++;

        repairedOutput.push({
          name: cat.name,
          collection: 'Category',
          oldImage: oldImage,
          newImage: cat.image,
          reason: check.reason
        });
      }
    }

    // Audit Products
    for (const prod of products) {
      totalProductsScanned++;
      const check = await checkImage(prod.name, prod.image, true, prod.category);
      const status = check.valid ? 'VALID' : 'BROKEN';

      console.log(`Name: ${prod.name}`);
      console.log(`Collection: Product`);
      console.log(`Image URL: ${prod.image || 'N/A'}`);
      console.log(`Status: ${status}`);
      if (!check.valid) {
        console.log(`Reason: ${check.reason}`);
      }
      console.log('----------------------------------------');

      if (!check.valid) {
        brokenImagesFound++;
        const oldImage = prod.image || '';

        // Repair
        prod.image = check.replacement;
        if (check.normalized) {
          prod.image = check.normalized;
        }
        await prod.save();
        recordsRepaired++;

        repairedOutput.push({
          name: prod.name,
          collection: 'Product',
          oldImage: oldImage,
          newImage: prod.image,
          reason: check.reason
        });
      }
    }

    if (repairedOutput.length > 0) {
      console.log('\n========================================');
      console.log('         REPAIRED RECORDS               ');
      console.log('========================================');
      repairedOutput.forEach(rec => {
        console.log(`Name: ${rec.name}`);
        console.log(`Collection: ${rec.collection}`);
        console.log(`Old Image URL: ${rec.oldImage || 'N/A'}`);
        console.log(`New Image URL: ${rec.newImage}`);
        console.log(`Failure Reason: ${rec.reason}`);
        console.log('----------------------------------------');
      });
    }

    console.log('\n========================================');
    console.log('         AUDIT & REPAIR SUMMARY         ');
    console.log('========================================');
    console.log(`- total categories scanned: ${totalCategoriesScanned}`);
    console.log(`- total products scanned: ${totalProductsScanned}`);
    console.log(`- broken images found: ${brokenImagesFound}`);
    console.log(`- records repaired: ${recordsRepaired}`);
    console.log('========================================');

    await mongoose.disconnect();
    console.log('\nDatabase disconnected. Audit completed!');
  } catch (error) {
    console.error('Database connection or repair error:', error);
    process.exit(1);
  }
}

run();
