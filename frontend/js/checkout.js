/*
 * Checkout.js - Secure Database Checkout Controller
 * Purpose: Renders checkout summaries from the live cart, checks input parameters, and posts verified orders to the database.
 */

let computedSubtotal = 0;
let computedShipping = 0;
let computedTax = 0;
let computedTotal = 0;
let liveCartData = null;

document.addEventListener('DOMContentLoaded', () => {
  const itemsContainer = document.getElementById('checkout-items-list');
  if (itemsContainer) {
    renderCheckoutSummary();
  }

  // Pre-fill user data from server profile including saved address
  prefillUserProfileData();

  const chkForm = document.getElementById('checkout-form');
  if (chkForm) {
    chkForm.addEventListener('submit', handleCheckoutSubmit);
  }
});

async function renderCheckoutSummary() {
  const itemsContainer = document.getElementById('checkout-items-list');
  if (!itemsContainer) return;

  const token = localStorage.getItem('florish_token');
  if (!token) {
    showNotification('Please login to access checkout.', 'error');
    setTimeout(() => {
      window.location.replace('login.html');
    }, 1000);
    return;
  }

  try {
    const cart = await api.get('/cart');
    liveCartData = cart;

    if (!cart.items || cart.items.length === 0) {
      itemsContainer.innerHTML = '<p class="text-secondary">Your cart is empty! Add items to continue.</p>';
      return;
    }

    itemsContainer.innerHTML = '';
    let subtotal = 0;

    cart.items.forEach(item => {
      const product = item.product;
      if (!product) return;
      
      const itemTotal = product.price * item.quantity;
      subtotal += itemTotal;
      
      const summaryItem = document.createElement('div');
      summaryItem.style.display = 'flex';
      summaryItem.style.justifyContent = 'space-between';
      summaryItem.style.marginBottom = '0.5rem';
      summaryItem.style.fontSize = '0.9rem';
      summaryItem.innerHTML = `
        <span class="text-secondary">${product.name} <strong>x${item.quantity}</strong></span>
        <strong>${formatINR(itemTotal)}</strong>
      `;
      itemsContainer.appendChild(summaryItem);
    });

    let activePromoCode = '';
    let activeDiscount = 0;
    let freeShippingPromo = false;

    const promoJson = sessionStorage.getItem('florish_applied_promo');
    if (promoJson) {
      try {
        const promo = JSON.parse(promoJson);
        if (promo && subtotal >= (promo.minPurchase || 0)) {
          activePromoCode = promo.code;
          activeDiscount = (promo.discountPercent || 0) / 100;
          freeShippingPromo = !!promo.isFreeShipping;
        }
      } catch (e) {
        console.error('Error loading checkout promo:', e);
      }
    }

    const discount = subtotal * activeDiscount;
    const subtotalAfterDiscount = subtotal - discount;

    const taxRate = parseFloat(localStorage.getItem('florish_sales_tax') || '8.0') / 100.0;
    const standardShipping = parseFloat(localStorage.getItem('florish_shipping_charge') || '99');
    const shipping = (subtotalAfterDiscount > 999 || subtotalAfterDiscount === 0 || freeShippingPromo) ? 0 : standardShipping;
    const tax = subtotalAfterDiscount * taxRate;
    const total = subtotalAfterDiscount + shipping + tax;

    computedSubtotal = subtotal;
    computedShipping = shipping;
    computedTax = tax;
    computedTotal = total;

    if (activeDiscount > 0) {
      document.getElementById('summary-subtotal').textContent = formatINR(subtotal);
      const discountRow = document.getElementById('summary-discount-row');
      const discountSpan = document.getElementById('summary-discount');
      if (discountRow && discountSpan) {
        discountRow.style.display = 'flex';
        discountSpan.textContent = `-${formatINR(discount)}`;
      }
    } else {
      document.getElementById('summary-subtotal').textContent = formatINR(subtotal);
      const discountRow = document.getElementById('summary-discount-row');
      if (discountRow) discountRow.style.display = 'none';
    }
    document.getElementById('summary-shipping').textContent = shipping === 0 ? 'Free' : formatINR(shipping);
    document.getElementById('summary-total').textContent = formatINR(total);

    // Calculate dynamic 2-4 days expected delivery range
    const deliveryStart = new Date();
    deliveryStart.setDate(deliveryStart.getDate() + 2);
    const deliveryEnd = new Date();
    deliveryEnd.setDate(deliveryEnd.getDate() + 4);
    const dateOpts = { month: 'short', day: 'numeric' };
    const formattedRange = `${deliveryStart.toLocaleDateString('en-US', dateOpts)} - ${deliveryEnd.toLocaleDateString('en-US', dateOpts)}`;
    const deliverySpan = document.getElementById('summary-delivery-date');
    if (deliverySpan) {
      deliverySpan.textContent = formattedRange;
    }
  } catch (err) {
    console.error('Error loading checkout summary:', err);
    itemsContainer.innerHTML = '<p class="text-secondary">Failed to compile cart summary.</p>';
  }
}

// Payment simulator tab states
let selectedPaymentTab = 'card';

document.addEventListener('DOMContentLoaded', () => {
  const cancelPaymentBtn = document.getElementById('btn-cancel-payment');
  if (cancelPaymentBtn) {
    cancelPaymentBtn.addEventListener('click', closePaymentModal);
  }

  const submitPaymentBtn = document.getElementById('btn-submit-payment');
  if (submitPaymentBtn) {
    submitPaymentBtn.addEventListener('click', handlePaymentSubmit);
  }

  const cardTabBtn = document.getElementById('tab-card-btn');
  const upiTabBtn = document.getElementById('tab-upi-btn');
  if (cardTabBtn) {
    cardTabBtn.addEventListener('click', () => switchPaymentTab('card'));
  }
  if (upiTabBtn) {
    upiTabBtn.addEventListener('click', () => switchPaymentTab('upi'));
  }

  // Auto format card number input spaces
  const cardInput = document.getElementById('txt-card-number');
  if (cardInput) {
    cardInput.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
      let parts = [];
      for (let i = 0, len = value.length; i < len; i += 4) {
        parts.push(value.substring(i, i + 4));
      }
      e.target.value = parts.join(' ');
    });
  }

  // Auto format expiry MM/YY input
  const expiryInput = document.getElementById('txt-card-expiry');
  if (expiryInput) {
    expiryInput.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\D/g, '');
      if (value.length > 2) {
        e.target.value = value.substring(0, 2) + '/' + value.substring(2, 4);
      } else {
        e.target.value = value;
      }
    });
  }
});

function openPaymentModal() {
  const modal = document.getElementById('payment-modal');
  const amountSpan = document.getElementById('lbl-payment-amount');
  if (modal && amountSpan) {
    amountSpan.textContent = formatINR(computedTotal);
    modal.style.display = 'flex';
    
    // Reset payment forms
    document.getElementById('txt-card-number').value = '';
    document.getElementById('txt-card-expiry').value = '';
    document.getElementById('txt-card-cvv').value = '';
    document.getElementById('txt-upi-id').value = '';
    switchPaymentTab('card');
  }
}

function closePaymentModal() {
  const modal = document.getElementById('payment-modal');
  if (modal) modal.style.display = 'none';
}

function switchPaymentTab(tab) {
  selectedPaymentTab = tab;
  const cardBtn = document.getElementById('tab-card-btn');
  const upiBtn = document.getElementById('tab-upi-btn');
  const cardForm = document.getElementById('payment-card-form');
  const upiForm = document.getElementById('payment-upi-form');

  if (tab === 'card') {
    cardBtn.style.borderBottom = '2px solid var(--primary)';
    cardBtn.style.color = 'var(--primary)';
    upiBtn.style.borderBottom = 'none';
    upiBtn.style.color = 'var(--text-secondary)';
    cardForm.style.display = 'block';
    upiForm.style.display = 'none';
  } else {
    upiBtn.style.borderBottom = '2px solid var(--primary)';
    upiBtn.style.color = 'var(--primary)';
    cardBtn.style.borderBottom = 'none';
    cardBtn.style.color = 'var(--text-secondary)';
    cardForm.style.display = 'none';
    upiForm.style.display = 'block';
  }
}

async function handlePaymentSubmit() {
  const paymentDetails = {};
  if (selectedPaymentTab === 'card') {
    const cardNum = document.getElementById('txt-card-number').value.trim();
    const cardExp = document.getElementById('txt-card-expiry').value.trim();
    const cardCvv = document.getElementById('txt-card-cvv').value.trim();

    if (!cardNum || !cardExp || !cardCvv) {
      showNotification('Please fill in all card payment fields.', 'error');
      return;
    }
    if (cardNum.replace(/\s/g, '').length < 16) {
      showNotification('Please enter a valid 16-digit card number.', 'error');
      return;
    }
    if (!/^\d{2}\/\d{2}$/.test(cardExp)) {
      showNotification('Please enter expiry date in MM/YY format.', 'error');
      return;
    }
    if (cardCvv.length < 3) {
      showNotification('Please enter a valid 3-digit CVV.', 'error');
      return;
    }
    paymentDetails.cardNum = cardNum;
    paymentDetails.cardExp = cardExp;
    paymentDetails.cardCvv = cardCvv;
  } else {
    const upiId = document.getElementById('txt-upi-id').value.trim();
    if (!upiId || !upiId.includes('@')) {
      showNotification('Please enter a valid UPI ID (e.g. name@bank).', 'error');
      return;
    }
    paymentDetails.upiId = upiId;
  }

  // Simulate payment processing
  const payBtn = document.getElementById('btn-submit-payment');
  const cancelBtn = document.getElementById('btn-cancel-payment');
  const originalText = payBtn.textContent;
  
  payBtn.disabled = true;
  cancelBtn.disabled = true;
  payBtn.textContent = 'Processing...';

  try {
    const response = await api.post('/orders/process-payment', {
      paymentMethod: 'online',
      paymentDetails,
      amount: computedTotal
    });

    payBtn.textContent = 'Authorized!';
    setTimeout(async () => {
      closePaymentModal();
      payBtn.disabled = false;
      cancelBtn.disabled = false;
      payBtn.textContent = originalText;
      // Proceed with placement on backend using token signature
      await processOrderPlacement('online', response.paymentToken);
    }, 500);
  } catch (err) {
    console.error(err);
    showNotification(err.message || 'Payment authorization failed.', 'error');
    payBtn.disabled = false;
    cancelBtn.disabled = false;
    payBtn.textContent = originalText;
  }
}

async function handleCheckoutSubmit(e) {
  e.preventDefault();
  
  const token = localStorage.getItem('florish_token');
  if (!token) {
    showNotification('Please login to place your order.', 'error');
    setTimeout(() => { window.location.href = 'login.html'; }, 1000);
    return;
  }

  if (!liveCartData || !liveCartData.items || liveCartData.items.length === 0) {
    showNotification('Cannot place order. Your shopping cart is empty!', 'error');
    return;
  }

  // Validate inputs
  if (typeof validateCheckoutInputs === 'function' && !validateCheckoutInputs()) {
    return;
  }

  const paymentChoice = document.querySelector('input[name="payment_choice"]:checked');
  const paymentMethod = paymentChoice ? paymentChoice.value : 'cod';

  if (paymentMethod === 'online') {
    openPaymentModal();
  } else {
    if (confirm('Are you sure you want to place this Cash on Delivery (COD) order?')) {
      await processOrderPlacement('cod');
    }
  }
}

async function processOrderPlacement(paymentMethod, paymentToken = undefined) {
  const submitBtn = document.getElementById('btn-place-order');
  const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Confirm & Place Order';
  
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<div style="display: inline-block; width: 18px; height: 18px; border-width: 2px; vertical-align: middle; margin-right: 8px;" class="spinner"></div> Processing Order...`;
  }

  try {
    const orderItems = liveCartData.items.map(item => ({
      product: item.product._id,
      name: item.product.name,
      price: item.product.price,
      quantity: item.quantity
    }));

    const shippingAddress = {
      firstName: document.getElementById('txt-first-name').value,
      lastName: document.getElementById('txt-last-name').value,
      address: document.getElementById('txt-address').value,
      city: document.getElementById('txt-city').value,
      pincode: document.getElementById('txt-pincode').value,
      phone: document.getElementById('txt-phone').value,
      email: document.getElementById('txt-email').value
    };

    // Retrieve applied promo code from sessionStorage if present
    let promoCode = undefined;
    const promoJson = sessionStorage.getItem('florish_applied_promo');
    if (promoJson) {
      try {
        const promo = JSON.parse(promoJson);
        if (promo && computedSubtotal >= (promo.minPurchase || 0)) {
          promoCode = promo.code;
        }
      } catch (e) {}
    }

    const orderData = {
      orderItems,
      shippingAddress,
      paymentMethod,
      taxPrice: computedTax,
      shippingPrice: computedShipping,
      totalPrice: computedTotal,
      promoCode: promoCode,
      paymentToken: paymentToken
    };

    console.log('Dispatching order to API database:', orderData);
    
    // Save order in backend
    const createdOrder = await api.post('/orders', orderData);
    
    showNotification('Order placed successfully!', 'success');
    
    // Clear localStorage cart cache & sessionStorage promo
    localStorage.removeItem('florish_cart');
    sessionStorage.removeItem('florish_applied_promo');
    if (typeof updateCartBadge === 'function') {
      updateCartBadge();
    }
    
    // Redirect to orders success confirmation view
    setTimeout(() => {
      window.location.href = `order-confirmation.html?id=${createdOrder._id}`;
    }, 1000);
  } catch (err) {
    console.error(err);
    showNotification(err.message || 'Failed to complete order submission.', 'error');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  }
}

async function prefillUserProfileData() {
  const token = localStorage.getItem('florish_token');
  if (!token) return;

  try {
    const user = await api.get('/auth/profile');
    if (user) {
      if (user.name) {
        const names = user.name.trim().split(/\s+/);
        const first = names[0] || '';
        const last = names.slice(1).join(' ') || '';
        
        const txtFirst = document.getElementById('txt-first-name');
        const txtLast = document.getElementById('txt-last-name');
        if (txtFirst && !txtFirst.value) txtFirst.value = first;
        if (txtLast && !txtLast.value) txtLast.value = last;
      }
      const txtEmail = document.getElementById('txt-email');
      if (txtEmail && !txtEmail.value) txtEmail.value = user.email || '';

      if (user.address) {
        const addr = user.address;
        const txtFirst = document.getElementById('txt-first-name');
        const txtLast = document.getElementById('txt-last-name');
        const txtAddress = document.getElementById('txt-address');
        const txtCity = document.getElementById('txt-city');
        const txtPincode = document.getElementById('txt-pincode');
        const txtPhone = document.getElementById('txt-phone');

        if (addr.firstName && txtFirst) txtFirst.value = addr.firstName;
        if (addr.lastName && txtLast) txtLast.value = addr.lastName;
        if (addr.addressLine && txtAddress) txtAddress.value = addr.addressLine;
        if (addr.city && txtCity) txtCity.value = addr.city;
        if (addr.pincode && txtPincode) txtPincode.value = addr.pincode;
        if (addr.phone && txtPhone) txtPhone.value = addr.phone;
      }
    }
  } catch (e) {
    console.error('Error pre-filling user checkout info from server:', e);
  }
}
