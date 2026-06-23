/*
 * Server.js - Primary Backend Entrypoint
 * Purpose: Connects database, mounts security layers (helmet, cors), defines static file paths, registers modular routers, and initializes port listener loops.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const dotenv = require('dotenv');

// Load environment configurations
dotenv.config();

// Validate required environment variables on startup
const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET'];
if (process.env.NODE_ENV === 'production') {
  requiredEnvVars.push('FRONTEND_URL');
}

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    console.error(`\n==================================================\n[FATAL CONFIG ERROR] Missing Environment Variable: "${varName}"\nPlease define it in your Render settings or local .env file.\n==================================================\n`);
    process.exit(1);
  }
});

// Connect to MongoDB
const connectDB = require('./config/db');

// Initialize Express App
const app = express();

// 1. CORS Configuration (MUST be placed before other middlewares to handle preflight)
const allowedOrigins = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'https://finalyearproject-1-alx4.onrender.com'
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL.replace(/\/$/, ''));
}

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, postman, curl)
    if (!origin) {
      return callback(null, true);
    }
    
    // In development mode, allow all origins
    if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
      return callback(null, true);
    }
    
    // Clean and check if origin is strictly matched in whitelist
    const cleanOrigin = origin.replace(/\/$/, '');
    if (allowedOrigins.indexOf(cleanOrigin) !== -1) {
      return callback(null, true);
    }
    
    // Staging / Evaluator compatibility fallback:
    // Allow any standard local IP ranges or localhost ports
    if (
      cleanOrigin.startsWith('http://localhost:') ||
      cleanOrigin.startsWith('http://127.0.0.1:') ||
      cleanOrigin.startsWith('http://192.168.') ||
      cleanOrigin.startsWith('http://10.') ||
      cleanOrigin.startsWith('http://172.16.')
    ) {
      return callback(null, true);
    }
    
    // Allow matching staging domains
    try {
      const hostname = new URL(cleanOrigin).hostname;
      if (
        (hostname.endsWith('.github.io') ||
         hostname.endsWith('.netlify.app') ||
         hostname.endsWith('.onrender.com')) &&
        (hostname.includes('florish') || hostname.includes('finalproject') || hostname.includes('finalyearproject'))
      ) {
        return callback(null, true);
      }
    } catch (e) {
      // URL parsing failed for origin
    }
    
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept', 'X-Requested-With']
};

app.use(cors(corsOptions));
// Handle explicit OPTIONS preflight for all routes
app.options('*', cors(corsOptions));

// Security Middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false
}));

const mongoSanitize = require('express-mongo-sanitize');
const { xssSanitizer } = require('./middleware/xssMiddleware');
const { generalLimiter } = require('./middleware/rateLimitMiddleware');

app.use(mongoSanitize());
app.use(xssSanitizer);
app.use('/api', generalLimiter);

// HTTP Logger Middleware
if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
  app.use(morgan('dev'));
}

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Declare static folder for uploaded image assets (Multer integration)
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res) => {
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));

// Routes mapping
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/notifications', notificationRoutes);

const Settings = require('./models/Settings');
app.get('/api/settings', async (req, res, next) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

// Base API route checklist
app.get('/', (req, res) => {
  res.send('Florish Backend Running');
});

app.get('/api', (req, res) => {
  res.json({
    status: 'online',
    message: 'Welcome to Florish Floral E-Commerce API endpoint services!'
  });
});

// Fallback middlewares for missing endpoints and global Express throws
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
app.use(notFound);
app.use(errorHandler);

// Port setup
const PORT = process.env.PORT || 5000;

// Connect database and start server listener
connectDB().then(() => {
  const server = app.listen(PORT, () => {
    console.log(`Florish Backend Server successfully listening in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });

  // Capture unhandled promise rejections
  process.on('unhandledRejection', (err, promise) => {
    console.error(`Unhandled Promise Rejection Error: ${err.message}`);
    // Safe close server
    server.close(() => process.exit(1));
  });
}).catch(err => {
  console.error(`Database Connection Startup Error: ${err.message}`);
  process.exit(1);
});
