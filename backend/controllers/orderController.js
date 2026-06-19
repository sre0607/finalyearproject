/*
 * OrderController.js - Secure Invoices checkout API Controls
 * Purpose: Handles checkout submissions, updates stock counts, and generates user orders lists.
 */

const Order = require('../models/Order');
const Product = require('../models/Product');
const Promo = require('../models/Promo');
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');
const {
  validateEmail,
  validateName,
  validatePhone,
  validatePincode,
  validateAddress,
  sanitizeInput
} = require('../utils/validators');

/**
 * @desc    Submit a new customer order invoice
 * @route   POST /api/orders
 * @access  Private
 */
const addOrderItems = async (req, res, next) => {
  const {
    orderItems,
    shippingAddress,
    paymentMethod,
    taxPrice,
    shippingPrice,
    totalPrice,
    promoCode
  } = req.body;

  if (!shippingAddress) {
    res.status(400);
    return next(new Error('Shipping address is required!'));
  }

  const { firstName, lastName, address, city, pincode, phone, email } = shippingAddress;

  const sanitizedFirst = sanitizeInput(firstName);
  const sanitizedLast = sanitizeInput(lastName);
  if (!validateName(sanitizedFirst) || !validateName(sanitizedLast)) {
    res.status(400);
    return next(new Error('First and last name in shipping address must be between 2 and 50 characters, and cannot contain scripts.'));
  }

  if (!validateAddress(address)) {
    res.status(400);
    return next(new Error('Street address is required and must be at least 5 characters long.'));
  }

  if (!city || city.trim() === '') {
    res.status(400);
    return next(new Error('City is required.'));
  }

  if (!validatePhone(phone)) {
    res.status(400);
    return next(new Error('Phone number must be a valid 10-digit Indian mobile number starting with 6-9.'));
  }

  if (!validatePincode(pincode)) {
    res.status(400);
    return next(new Error('Pincode must be exactly 6 digits.'));
  }

  const normalizedEmail = email ? email.trim().toLowerCase() : '';
  if (!validateEmail(normalizedEmail)) {
    res.status(400);
    return next(new Error('Please enter a valid email address.'));
  }

  // Update shippingAddress references with sanitized / normalized values
  shippingAddress.firstName = sanitizedFirst;
  shippingAddress.lastName = sanitizedLast;
  shippingAddress.address = address.trim();
  shippingAddress.city = city.trim();
  shippingAddress.pincode = pincode.trim();
  shippingAddress.phone = phone.trim();
  shippingAddress.email = normalizedEmail;

  if (!orderItems || orderItems.length === 0) {
    res.status(400);
    return next(new Error('No items ordered!'));
  }

  const mongoose = require('mongoose');
  let session = null;
  let useTransactions = true;

  try {
    const topologyType = mongoose.connection?.client?.topology?.description?.type;
    if (topologyType === 'Single') {
      useTransactions = false;
    }
  } catch (err) {
    useTransactions = false;
  }

  if (useTransactions) {
    try {
      session = await mongoose.startSession();
      session.startTransaction();
    } catch (err) {
      session = null;
      useTransactions = false;
    }
  }

  try {
    const sessionOpts = useTransactions ? { session } : {};

    // 1. Verify stock availability for all items, validate quantity, and calculate subtotal
    let calculatedSubtotal = 0;
    for (const item of orderItems) {
      // Validate quantity: positive integer >= 1
      const qty = Number(item.quantity);
      if (!item.quantity || isNaN(qty) || !Number.isInteger(qty) || qty < 1) {
        res.status(400);
        throw new Error(`Invalid item quantity specified for "${item.name || 'product'}". Quantity must be a positive integer >= 1.`);
      }

      const product = await Product.findById(item.product).session(useTransactions ? session : null);
      if (!product) {
        res.status(404);
        throw new Error(`Product not found for ID: ${item.product}`);
      }
      if (product.stock < qty) {
        res.status(400);
        throw new Error(`Insufficient stock for "${product.name}"! Only ${product.stock} items are available.`);
      }
      calculatedSubtotal += product.price * qty;
    }

    // 2. Validate promo code & compute discount
    let activeDiscountPercent = 0;
    let activeIsFreeShipping = false;
    if (promoCode) {
      const promo = await Promo.findOne({ code: promoCode.toUpperCase() }).session(useTransactions ? session : null);
      if (promo) {
        if (promo.expiresAt < Date.now()) {
          res.status(400);
          throw new Error('This promo code has expired.');
        }
        if (calculatedSubtotal < promo.minPurchase) {
          res.status(400);
          throw new Error(`Minimum purchase of Rs. ${promo.minPurchase} required for this promo.`);
        }
        activeDiscountPercent = promo.discountPercent;
        activeIsFreeShipping = promo.isFreeShipping;
      } else {
        res.status(400);
        throw new Error('Invalid promo code.');
      }
    }

    const discountAmount = calculatedSubtotal * (activeDiscountPercent / 100);
    const subtotalAfterDiscount = calculatedSubtotal - discountAmount;

    const Settings = require('../models/Settings');
    let settings = await Settings.findOne().session(useTransactions ? session : null);
    if (!settings) {
      settings = { salesTax: 8.0, shippingCharge: 99 };
    }
    const salesTaxRate = settings.salesTax / 100;
    const standardShippingFee = settings.shippingCharge;

    // Validate delivery pincode against settings allowed list
    if (settings.allowedPincodes && shippingAddress && shippingAddress.pincode) {
      const allowedList = settings.allowedPincodes.split(',').map(p => p.trim());
      if (allowedList.length > 0 && !allowedList.includes(shippingAddress.pincode.trim())) {
        res.status(400);
        throw new Error(`Sorry, we do not deliver to pincode ${shippingAddress.pincode}. Supported pincodes: ${settings.allowedPincodes}`);
      }
    }

    // Shipping logic: free if over ₹999 OR free shipping promo applied
    const expectedShipping = (subtotalAfterDiscount > 999 || subtotalAfterDiscount === 0 || activeIsFreeShipping) ? 0 : standardShippingFee;
    const expectedTax = subtotalAfterDiscount * salesTaxRate;
    const expectedTotal = subtotalAfterDiscount + expectedShipping + expectedTax;

    // Validate pricing signatures (checking tolerance of 0.05)
    if (Math.abs(expectedTotal - Number(totalPrice)) > 0.05 ||
        Math.abs(expectedShipping - Number(shippingPrice)) > 0.05 ||
        Math.abs(expectedTax - Number(taxPrice)) > 0.05) {
      res.status(400);
      throw new Error(`Pricing signature verification failed. Computed Total: Rs. ${expectedTotal.toFixed(2)}, Client Total: Rs. ${Number(totalPrice).toFixed(2)}`);
    }

    // Validate Payment Token for online payments
    let orderPaymentStatus = 'pending';
    if (paymentMethod === 'online') {
      const { paymentToken } = req.body;
      if (!paymentToken) {
        res.status(400);
        throw new Error('Payment token is missing. Online orders require server-signed payment verification.');
      }

      try {
        const decoded = jwt.verify(paymentToken, process.env.JWT_SECRET);
        if (decoded.userId !== req.user._id.toString()) {
          res.status(400);
          throw new Error('Payment token verification failed: User ID mismatch.');
        }
        if (Math.abs(decoded.amount - Number(totalPrice)) > 0.05) {
          res.status(400);
          throw new Error(`Payment token verification failed: Paid amount Rs. ${decoded.amount.toFixed(2)} does not match order total Rs. ${Number(totalPrice).toFixed(2)}.`);
        }
        orderPaymentStatus = 'paid';
      } catch (err) {
        res.status(400);
        throw new Error(err.message || 'Invalid or expired payment verification token. Please try processing payment again.');
      }
    }

    // 3. Create order document
    const order = new Order({
      user: req.user._id,
      items: orderItems,
      shippingAddress,
      paymentMethod,
      paymentStatus: orderPaymentStatus,
      taxPrice: Number(taxPrice),
      shippingPrice: Number(shippingPrice),
      totalPrice: Number(totalPrice),
      promoCode: promoCode || '',
      discountPrice: Number(discountAmount)
    });

    const createdOrder = await order.save(sessionOpts);

    // 4. Deduct inventory levels
    for (const item of orderItems) {
      const product = await Product.findById(item.product).session(useTransactions ? session : null);
      if (product) {
        if (product.stock < item.quantity) {
          res.status(400);
          throw new Error(`Insufficient stock for "${product.name}"! Only ${product.stock} items are available.`);
        }
        product.stock -= item.quantity;
        await product.save(sessionOpts);
      }
    }

    // 5. Central Clear Cart hook
    const Cart = require('../models/Cart');
    await Cart.findOneAndUpdate(
      { user: req.user._id },
      { items: [] },
      sessionOpts
    );

    if (useTransactions && session) {
      await session.commitTransaction();
    }

    res.status(201).json(createdOrder);
  } catch (error) {
    if (useTransactions && session) {
      await session.abortTransaction();
    }
    next(error);
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

/**
 * @desc    Load user order history list
 * @route   GET /api/orders/myorders
 * @access  Private
 */
const getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user._id });
    res.json(orders);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Fetch specific invoice specifications by ID
 * @route   GET /api/orders/:id
 * @access  Private
 */
const getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email');

    if (order) {
      res.json(order);
    } else {
      res.status(404);
      throw new Error('Order not found');
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Validate promotional discount coupon code
 * @route   POST /api/orders/validate-promo
 * @access  Private
 */
const validatePromoCode = async (req, res, next) => {
  const { code, subtotal } = req.body;

  try {
    if (!code) {
      res.status(400);
      throw new Error('Please enter a promo code');
    }

    const promo = await Promo.findOne({ code: code.toUpperCase() });

    if (!promo) {
      res.status(400);
      throw new Error('Invalid promo code. Please try another one.');
    }

    // Check expiration
    if (promo.expiresAt < Date.now()) {
      res.status(400);
      throw new Error('This promo code has expired.');
    }

    // Check minimum purchase rules
    if (Number(subtotal) < promo.minPurchase) {
      res.status(400);
      throw new Error(`Minimum purchase of Rs. ${promo.minPurchase} required to use this promo code.`);
    }

    res.json({
      code: promo.code,
      discountPercent: promo.discountPercent,
      isFreeShipping: promo.isFreeShipping,
      minPurchase: promo.minPurchase
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Simulate and authorize online card/UPI payment securely, returning a signed token
 * @route   POST /api/orders/process-payment
 * @access  Private
 */
const processPayment = async (req, res, next) => {
  const { paymentMethod, paymentDetails, amount } = req.body;

  try {
    if (paymentMethod !== 'online') {
      res.status(400);
      throw new Error('Only online payment methods can be processed via this gateway.');
    }

    if (!amount || Number(amount) <= 0) {
      res.status(400);
      throw new Error('Invalid payment amount specified.');
    }

    if (!paymentDetails) {
      res.status(400);
      throw new Error('Payment details are required.');
    }

    // Perform validation on payment fields
    if (paymentDetails.cardNum) {
      const cardNum = paymentDetails.cardNum.replace(/\s/g, '');
      if (cardNum.length < 16 || !/^\d+$/.test(cardNum)) {
        res.status(400);
        throw new Error('Invalid card number: Must be exactly 16 digits.');
      }
      if (!/^\d{2}\/\d{2}$/.test(paymentDetails.cardExp)) {
        res.status(400);
        throw new Error('Invalid expiry date: Use MM/YY format.');
      }
      if (!paymentDetails.cardCvv || paymentDetails.cardCvv.length < 3 || !/^\d+$/.test(paymentDetails.cardCvv)) {
        res.status(400);
        throw new Error('Invalid CVV code.');
      }
    } else if (paymentDetails.upiId) {
      if (!paymentDetails.upiId.includes('@')) {
        res.status(400);
        throw new Error('Invalid UPI ID: Format must be name@bank.');
      }
    } else {
      res.status(400);
      throw new Error('Missing card payment or UPI identifier.');
    }

    // Generate signed authorization JWT token
    const paymentToken = jwt.sign(
      {
        userId: req.user._id,
        amount: Number(amount),
        status: 'authorized',
        timestamp: Date.now()
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.status(200).json({
      success: true,
      message: 'Payment authorized and verified on server.',
      paymentToken
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Cancel a processing order by the customer
 * @route   PUT /api/orders/:id/cancel
 * @access  Private
 */
const cancelOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      res.status(404);
      throw new Error('Order not found');
    }

    // Verify order belongs to the user
    if (order.user.toString() !== req.user._id.toString()) {
      res.status(401);
      throw new Error('Not authorized to cancel this order');
    }

    // Verify order status is Processing
    if (order.orderStatus !== 'Processing') {
      res.status(400);
      throw new Error(`Order cannot be cancelled because its status is '${order.orderStatus}'`);
    }

    // Change status to Cancelled
    order.orderStatus = 'Cancelled';

    // Restore product stock levels
    for (const item of order.items) {
      const product = await Product.findById(item.product);
      if (product) {
        product.stock += item.quantity;
        await product.save();
      }
    }

    const updatedOrder = await order.save();
    res.json(updatedOrder);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Generate and download PDF invoice for an order
 * @route   GET /api/orders/:id/invoice
 * @access  Private
 */
const getOrderInvoice = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email');

    if (!order) {
      res.status(404);
      throw new Error('Order not found');
    }

    // Security: Owner or Admin only
    if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      res.status(403);
      throw new Error('Not authorized to access this invoice.');
    }

    // Create a PDF document
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });

    // Set HTTP response headers
    const displayId = order._id.toString().substring(order._id.toString().length - 6).toUpperCase();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Florish_Invoice_Order${displayId}.pdf`);

    // Pipe PDF generation stream directly to response
    doc.pipe(res);

    // Dynamically register Arial/Arial-Bold if available on Windows to support the ₹ character
    let fontRegular = 'Helvetica';
    let fontBold = 'Helvetica-Bold';
    let currencySymbol = 'Rs. ';

    try {
      const fs = require('fs');
      if (fs.existsSync('C:/Windows/Fonts/arial.ttf') && fs.existsSync('C:/Windows/Fonts/arialbd.ttf')) {
        doc.registerFont('Arial', 'C:/Windows/Fonts/arial.ttf');
        doc.registerFont('Arial-Bold', 'C:/Windows/Fonts/arialbd.ttf');
        fontRegular = 'Arial';
        fontBold = 'Arial-Bold';
        currencySymbol = '₹';
      }
    } catch (err) {
      console.warn('Could not register Arial system font:', err.message);
    }

    // Color Palette
    const primaryColor = '#1b4332'; // Deep Forest Green
    const textColor = '#333333'; // Charcoal
    const mutedColor = '#666666'; // Gray
    const lightBg = '#f4f9f4'; // Light green tint background

    // Header Title
    doc.fillColor(primaryColor)
       .font(fontBold)
       .fontSize(28)
       .text('Florish', 50, 45);

    doc.fillColor(mutedColor)
       .font(fontBold)
       .fontSize(12)
       .text('INVOICE / RECEIPT', 380, 50, { align: 'right' });

    // Separator line
    doc.strokeColor('#e2e8f0')
       .lineWidth(1)
       .moveTo(50, 85)
       .lineTo(562, 85)
       .stroke();

    // Invoice Metadata Block
    const orderDate = new Date(order.createdAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    doc.fillColor(textColor)
       .fontSize(9)
       .font(fontBold)
       .text('Invoice Details:', 50, 100);

    doc.font(fontRegular)
       .fillColor(mutedColor)
       .text('Invoice No:', 50, 115)
       .fillColor(textColor)
       .font(fontBold)
       .text(`FL-${displayId}`, 130, 115)
       .font(fontRegular)
       .fillColor(mutedColor)
       .text('Order Reference:', 50, 130)
       .fillColor(textColor)
       .text(`${order._id}`, 130, 130)
       .fillColor(mutedColor)
       .text('Date Placed:', 50, 145)
       .fillColor(textColor)
       .text(`${orderDate}`, 130, 145);

    // Fulfillment Details
    doc.fillColor(textColor)
       .font(fontBold)
       .text('Order Summary:', 350, 100);

    doc.font(fontRegular)
       .fillColor(mutedColor)
       .text('Fulfillment:', 350, 115)
       .fillColor(textColor)
       .font(fontBold)
       .text(`${order.orderStatus}`, 440, 115)
       .font(fontRegular)
       .fillColor(mutedColor)
       .text('Payment Mode:', 350, 130)
       .fillColor(textColor)
       .text(`${order.paymentMethod === 'cod' ? 'Cash on Delivery (COD)' : 'Online Payment'}`, 440, 130)
       .fillColor(mutedColor)
       .text('Payment Status:', 350, 145)
       .fillColor(textColor)
       .font(fontBold)
       .text(`${order.paymentStatus.toUpperCase()}`, 440, 145);

    // Separator line
    doc.strokeColor('#e2e8f0')
       .lineWidth(1)
       .moveTo(50, 170)
       .lineTo(562, 170)
       .stroke();

    // Recipient address
    doc.fillColor(textColor)
       .font(fontBold)
       .fontSize(10)
       .text('Recipient Information:', 50, 185);

    doc.font(fontRegular)
       .fontSize(9)
       .text(`${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`, 50, 200)
       .text(`${order.shippingAddress.address}`, 50, 212)
       .text(`${order.shippingAddress.city} - ${order.shippingAddress.pincode}`, 50, 224)
       .text(`Phone: ${order.shippingAddress.phone}`, 50, 236)
       .text(`Email: ${order.shippingAddress.email}`, 50, 248);

    // Items table header
    let currentY = 280;

    doc.rect(50, currentY, 512, 20)
       .fill(lightBg);

    doc.fillColor(textColor)
       .font(fontBold)
       .fontSize(9)
       .text('Item Description', 60, currentY + 6)
       .text('Qty', 350, currentY + 6, { align: 'center', width: 30 })
       .text('Unit Price', 400, currentY + 6, { align: 'right', width: 70 })
       .text('Total Price', 480, currentY + 6, { align: 'right', width: 70 });

    currentY += 20;

    // Item Rows
    let subtotal = 0;
    doc.font(fontRegular).fontSize(9);

    order.items.forEach(item => {
      const itemTotal = item.price * item.quantity;
      subtotal += itemTotal;

      // Check for page overflow (LETTER page height is 792, footer is at 712)
      if (currentY > 600) {
        doc.addPage();
        currentY = 50;

        doc.rect(50, currentY, 512, 20)
           .fill(lightBg);

        doc.fillColor(textColor)
           .font(fontBold)
           .fontSize(9)
           .text('Item Description', 60, currentY + 6)
           .text('Qty', 350, currentY + 6, { align: 'center', width: 30 })
           .text('Unit Price', 400, currentY + 6, { align: 'right', width: 70 })
           .text('Total Price', 480, currentY + 6, { align: 'right', width: 70 });

        currentY += 20;
        doc.font(fontRegular).fontSize(9);
      }

      doc.strokeColor('#f1f5f9')
         .lineWidth(1)
         .moveTo(50, currentY + 20)
         .lineTo(562, currentY + 20)
         .stroke();

      doc.fillColor(textColor)
         .text(item.name, 60, currentY + 6, { width: 270, height: 12, ellipsis: true })
         .text(item.quantity.toString(), 350, currentY + 6, { align: 'center', width: 30 })
         .text(`${currencySymbol}${item.price.toFixed(2)}`, 400, currentY + 6, { align: 'right', width: 70 })
         .text(`${currencySymbol}${itemTotal.toFixed(2)}`, 480, currentY + 6, { align: 'right', width: 70 });

      currentY += 20;
    });

    currentY += 15;

    const summaryXLabel = 350;
    const summaryXVal = 470;
    const summaryWidth = 92;

    doc.fillColor(mutedColor);

    // Subtotal Row
    doc.text('Subtotal:', summaryXLabel, currentY, { align: 'right', width: 110 })
       .fillColor(textColor)
       .text(`${currencySymbol}${subtotal.toFixed(2)}`, summaryXVal, currentY, { align: 'right', width: summaryWidth });
    currentY += 16;

    // Discount Row (if any)
    if (order.discountPrice > 0) {
      doc.fillColor(mutedColor)
         .text(`Discount (${order.promoCode || 'PROMO'}):`, summaryXLabel, currentY, { align: 'right', width: 110 })
         .fillColor('#15803d')
         .text(`-${currencySymbol}${order.discountPrice.toFixed(2)}`, summaryXVal, currentY, { align: 'right', width: summaryWidth });
      currentY += 16;
    }

    // Shipping Row
    doc.fillColor(mutedColor)
       .text('Shipping:', summaryXLabel, currentY, { align: 'right', width: 110 })
       .fillColor(textColor)
       .text(order.shippingPrice === 0 ? 'Free' : `${currencySymbol}${order.shippingPrice.toFixed(2)}`, summaryXVal, currentY, { align: 'right', width: summaryWidth });
    currentY += 16;

    // Tax Row
    doc.fillColor(mutedColor)
       .text('Sales Tax:', summaryXLabel, currentY, { align: 'right', width: 110 })
       .fillColor(textColor)
       .text(`${currencySymbol}${order.taxPrice.toFixed(2)}`, summaryXVal, currentY, { align: 'right', width: summaryWidth });
    currentY += 20;

    // Grand Total Row
    doc.strokeColor('#e2e8f0')
       .lineWidth(1)
       .moveTo(350, currentY - 4)
       .lineTo(562, currentY - 4)
       .stroke();

    doc.fillColor(textColor)
       .font(fontBold)
       .fontSize(11)
       .text('Total Invoice Price:', summaryXLabel, currentY, { align: 'right', width: 110 })
       .fillColor(primaryColor)
       .fontSize(11)
       .text(`${currencySymbol}${order.totalPrice.toFixed(2)}`, summaryXVal, currentY, { align: 'right', width: summaryWidth });

    // Footer Block
    const pageHeight = doc.page.height;
    const footerY = pageHeight - 80;

    doc.strokeColor('#e2e8f0')
       .lineWidth(1)
       .moveTo(50, footerY - 10)
       .lineTo(562, footerY - 10)
       .stroke();

    doc.font(fontRegular)
       .fontSize(8)
       .fillColor(mutedColor)
       .text('Thank you for shopping at Florish!', 50, footerY, { align: 'center', width: 512 })
       .text('We guarantee 7 days of freshness for all hand-tied arrangements.', 50, footerY + 12, { align: 'center', width: 512 })
       .fillColor('#2d6a4f')
       .text('For support or customer queries, please contact hello@florish-shop.com', 50, footerY + 24, { align: 'center', width: 512 });

    // Finalize PDF
    doc.end();

  } catch (error) {
    next(error);
  }
};

module.exports = {
  addOrderItems,
  getMyOrders,
  getOrderById,
  validatePromoCode,
  processPayment,
  cancelOrder,
  getOrderInvoice
};
