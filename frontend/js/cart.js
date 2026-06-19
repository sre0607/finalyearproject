/*
 * Cart.js - Live Database Cart Manager
 * Purpose: Synchronizes cart items from backend Express API, renders catalog tables, updates counts, and totals.
 */

// Global promo code states
let activeDiscount = 0;
let freeShippingPromo = false;
let cartSubtotal = 0;

/**
 * Global function to push items to backend cart
 * @param {string} id - Product ObjectId to insert
 * @param {number} qty - Volume to add
 * @param {HTMLButtonElement} btn - Triggering action button for feedback
 */
async function addToCart(id, qty = 1, btn = null) {
  const token = localStorage.getItem('florish_token');
  
  const originalText = btn ? btn.textContent : '🛒 Add to Cart';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Adding to Cart...';
  }

  if (!token) {
    // Guest user - save to local guest cart
    let guestCart = [];
    try {
      guestCart = JSON.parse(localStorage.getItem('florish_guest_cart')) || [];
      if (!Array.isArray(guestCart)) guestCart = [];
    } catch (e) {
      guestCart = [];
    }

    const idx = guestCart.findIndex(item => item.product === id);
    if (idx > -1) {
      guestCart[idx].quantity += qty;
    } else {
      guestCart.push({ product: id, quantity: qty });
    }
    localStorage.setItem('florish_guest_cart', JSON.stringify(guestCart));

    if (typeof updateCartBadge === 'function') {
      await updateCartBadge();
    }
    
    showNotification('Item added to cart (Guest mode)!', 'success');
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
    return;
  }

  try {
    await api.post('/cart', { productId: id, quantity: qty });

    // Sync localStorage cache for header badge indicators
    let localCart = [];
    try {
      localCart = JSON.parse(localStorage.getItem('florish_cart')) || [];
      if (!Array.isArray(localCart)) localCart = [];
    } catch (e) {
      localCart = [];
    }
    const idx = localCart.findIndex(item => item.id === id);
    if (idx > -1) {
      localCart[idx].quantity += qty;
    } else {
      localCart.push({ id, quantity: qty });
    }
    localStorage.setItem('florish_cart', JSON.stringify(localCart));
    
    if (typeof updateCartBadge === 'function') {
      await updateCartBadge();
    }
    
    showNotification('Item added to cart!', 'success');
  } catch (error) {
    console.error(error);
    showNotification(error.message || 'Could not add to cart', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Render cart items if on Cart view
  const cartBody = document.getElementById('cart-items-body');
  if (cartBody) {
    renderCart();
  }



  // Hook Promo Code Apply button
  const couponBtn = document.getElementById('btn-apply-coupon');
  if (couponBtn) {
    couponBtn.addEventListener('click', applyPromoCode);
  }
  const removeCouponBtn = document.getElementById('btn-remove-coupon');
  if (removeCouponBtn) {
    removeCouponBtn.addEventListener('click', removeCoupon);
  }
});

/**
 * Fetch and render user cart items with loading visual feedback
 */
async function renderCart(showSpinner = true) {
  const cartBody = document.getElementById('cart-items-body');
  if (!cartBody) return;

  const token = localStorage.getItem('florish_token');
  if (!token) {
    await renderGuestCart(showSpinner);
    return;
  }

  // Loading indicator row
  if (showSpinner) {
    cartBody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center" style="padding: 4rem 2rem;">
          <div style="display: inline-block; width: 35px; height: 35px;" class="spinner"></div>
          <p class="text-secondary" style="margin-top: 0.5rem;">Loading your shopping cart...</p>
        </td>
      </tr>
    `;
  }

  try {
    const cart = await api.get('/cart');
    const baseServerUrl = API_BASE_URL.replace('/api', '');

    if (!cart.items || cart.items.length === 0) {
      cartBody.innerHTML = `
        <tr class="empty-cart-row">
          <td colspan="5" class="text-center" style="padding: 4rem 2rem;">
            <span style="font-size: 3.5rem;">🛒</span>
            <p class="text-secondary" style="margin-top: 1rem; margin-bottom: var(--space-md);">Your shopping cart is currently empty!</p>
            <a href="shop.html" class="btn btn-primary">Browse Floral Catalog</a>
          </td>
        </tr>
      `;
      // Clear localStorage cache for badges
      localStorage.setItem('florish_cart', JSON.stringify([]));
      if (typeof updateCartBadge === 'function') {
        await updateCartBadge();
      }
      updateSummary(0);
      return;
    }

    cartBody.innerHTML = '';
    let subtotal = 0;

    // Refresh local cart cache for badges
    const localCartCache = cart.items.map(item => ({
      id: item.product ? item.product._id : '',
      quantity: item.quantity
    }));
    localStorage.setItem('florish_cart', JSON.stringify(localCartCache));
    if (typeof updateCartBadge === 'function') {
      await updateCartBadge();
    }

    cart.items.forEach(item => {
      const product = item.product;
      if (!product) return;

      const itemTotal = product.price * item.quantity;
      subtotal += itemTotal;

      const imageUrl = getSafeImageUrl(product.image, product.category, product.name);

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>
          <div class="cart-item">
            <img src="${imageUrl}" alt="${product.name}" onerror="this.onerror=null; this.src=getSafeImageUrl(null, '${product.category}', '${product.name}');" />
            <div style="text-align: left;">
              <span class="cart-item-name">${product.name}</span>
              <div class="cart-item-category" style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">${product.category}</div>
            </div>
          </div>
        </td>
        <td>${formatINR(product.price)}</td>
        <td>
          <div class="quantity-selector" style="max-width: 130px;">
            <button class="qty-btn" onclick="adjustLiveQty('${product._id}', -1, this)">-</button>
            <input type="text" class="qty-input" value="${item.quantity}" readonly />
            <button class="qty-btn" onclick="adjustLiveQty('${product._id}', 1, this)">+</button>
          </div>
        </td>
        <td>${formatINR(itemTotal)}</td>
        <td>
          <button class="cart-remove-btn" onclick="removeLiveCartItem('${item._id}', this)">Remove</button>
        </td>
      `;
      cartBody.appendChild(row);
    });

    cartSubtotal = subtotal;

    // Load active promo from storage if exists
    const promoJson = sessionStorage.getItem('florish_applied_promo');
    if (promoJson) {
      try {
        const promo = JSON.parse(promoJson);
        if (promo) {
          if (subtotal >= (promo.minPurchase || 0)) {
            activeDiscount = (promo.discountPercent || 0) / 100;
            freeShippingPromo = !!promo.isFreeShipping;
            const input = document.getElementById('coupon-input');
            if (input) input.value = promo.code || '';
          } else {
            // subtotal fell below minPurchase
            sessionStorage.removeItem('florish_applied_promo');
            activeDiscount = 0;
            freeShippingPromo = false;
          }
        }
      } catch (e) {
        console.error('Error restoring applied promo:', e);
      }
    }

    updateSummary(subtotal);
    syncPromoButtonState();
  } catch (err) {
    console.error('Error loading cart:', err);
    cartBody.innerHTML = `
      <tr class="empty-cart-row">
        <td colspan="5" class="text-center" style="padding: 3rem; color: var(--error);">
          <p>Failed to load cart items from server. Please reload the page.</p>
        </td>
      </tr>
    `;
  }
}

/**
 * Increments or decrements cart item quantity on backend
 */
async function adjustLiveQty(productId, direction, btn) {
  const container = btn ? btn.closest('.quantity-selector') : null;
  const buttons = container ? container.querySelectorAll('.qty-btn') : [];
  buttons.forEach(b => b.disabled = true);

  try {
    await api.post('/cart', { productId, quantity: direction });
    await renderCart(false); // Smooth update
  } catch (err) {
    console.error(err);
    showNotification(err.message || 'Failed to adjust quantity', 'error');
  } finally {
    buttons.forEach(b => b.disabled = false);
  }
}

/**
 * Removes item completely from user cart
 */
async function removeLiveCartItem(itemId, btn) {
  const originalText = btn ? btn.textContent : 'Remove';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Removing...';
  }

  try {
    await api.delete(`/cart/${itemId}`);
    showNotification('Item removed from cart.', 'success');
    await renderCart(false); // Smooth update
  } catch (err) {
    console.error(err);
    showNotification(err.message || 'Failed to remove item', 'error');
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
}

/**
 * Calculates subtotals, shipping threshold, tax ratios, and updates summary nodes
 */
function updateSummary(subtotal) {
  const lblSub = document.getElementById('lbl-subtotal');
  const lblShipping = document.getElementById('lbl-shipping');
  const lblTax = document.getElementById('lbl-tax');
  const lblTotal = document.getElementById('lbl-total');

  if (!lblSub) return;

  // Apply promo discounts
  let discount = 0;
  if (activeDiscount > 0) {
    discount = subtotal * activeDiscount;
  }
  const subtotalAfterDiscount = subtotal - discount;

  // Shipping logic: free if over ₹999 OR free shipping promo applied
  const shipping = (subtotalAfterDiscount > 999 || subtotalAfterDiscount === 0 || freeShippingPromo) ? 0 : 99;
  const tax = subtotalAfterDiscount * 0.08;
  const total = subtotalAfterDiscount + shipping + tax;

  if (activeDiscount > 0) {
    lblSub.innerHTML = `${formatINR(subtotal)} <span style="color: var(--success); font-size: 0.85rem; font-weight: 600;">(-${formatINR(discount)})</span>`;
  } else {
    lblSub.textContent = formatINR(subtotal);
  }
  
  lblShipping.textContent = shipping === 0 ? 'Free' : formatINR(shipping);
  lblTax.textContent = formatINR(tax);
  lblTotal.textContent = formatINR(total);
}

// Toggle and synchronize applied promo coupon button states
function syncPromoButtonState() {
  const applyBtn = document.getElementById('btn-apply-coupon');
  const removeBtn = document.getElementById('btn-remove-coupon');
  const input = document.getElementById('coupon-input');
  const promoJson = sessionStorage.getItem('florish_applied_promo');

  if (promoJson) {
    if (input) {
      const promo = JSON.parse(promoJson);
      input.value = promo.code || '';
      input.disabled = true;
    }
    if (applyBtn) applyBtn.style.display = 'none';
    if (removeBtn) removeBtn.style.display = 'inline-block';
  } else {
    if (input) {
      input.disabled = false;
    }
    if (applyBtn) {
      applyBtn.style.display = 'inline-block';
      applyBtn.textContent = 'Apply';
      applyBtn.disabled = false;
      applyBtn.style.backgroundColor = '';
      applyBtn.style.color = '';
      applyBtn.style.borderColor = '';
    }
    if (removeBtn) removeBtn.style.display = 'none';
  }
}

function removeCoupon() {
  sessionStorage.removeItem('florish_applied_promo');
  activeDiscount = 0;
  freeShippingPromo = false;
  
  const input = document.getElementById('coupon-input');
  if (input) {
    input.value = '';
    input.disabled = false;
  }
  
  showNotification('Coupon removed successfully!', 'success');
  updateSummary(cartSubtotal);
  syncPromoButtonState();
}

/**
 * Handles applying promo discount codes via backend validator API
 */
async function applyPromoCode() {
  const input = document.getElementById('coupon-input');
  if (!input) return;
  const code = input.value.trim().toUpperCase();

  if (!code) {
    showNotification('Please enter a promo code.', 'error');
    return;
  }

  const applyBtn = document.getElementById('btn-apply-coupon');
  const originalText = applyBtn ? applyBtn.textContent : 'Apply';
  if (applyBtn) {
    applyBtn.disabled = true;
    applyBtn.textContent = '...';
  }

  try {
    const data = await api.post('/orders/validate-promo', { code, subtotal: cartSubtotal });
    
    // Store in sessionStorage for persistence to checkout page
    sessionStorage.setItem('florish_applied_promo', JSON.stringify({
      code: data.code,
      discountPercent: data.discountPercent,
      isFreeShipping: data.isFreeShipping,
      minPurchase: data.minPurchase
    }));

    activeDiscount = (data.discountPercent || 0) / 100;
    freeShippingPromo = !!data.isFreeShipping;
    
    showNotification(`Promo code "${data.code}" applied!`, 'success');
    updateSummary(cartSubtotal);
    syncPromoButtonState();
  } catch (err) {
    console.error(err);
    showNotification(err.message || 'Invalid promo code.', 'error');
    // Wipes out invalid stored promo code if there is any
    sessionStorage.removeItem('florish_applied_promo');
    activeDiscount = 0;
    freeShippingPromo = false;
    updateSummary(cartSubtotal);
    syncPromoButtonState();
  } finally {
    if (applyBtn && applyBtn.textContent !== 'Applied') {
      applyBtn.disabled = false;
      applyBtn.textContent = originalText;
    }
  }
}

/**
 * Fetch and render guest local cart items
 */
async function renderGuestCart(showSpinner = true) {
  const cartBody = document.getElementById('cart-items-body');
  if (!cartBody) return;

  let guestCart = [];
  try {
    guestCart = JSON.parse(localStorage.getItem('florish_guest_cart')) || [];
    if (!Array.isArray(guestCart)) guestCart = [];
  } catch (e) {
    guestCart = [];
  }

  if (guestCart.length === 0) {
    cartBody.innerHTML = `
      <tr class="empty-cart-row">
        <td colspan="5" class="text-center" style="padding: 4rem 2rem;">
          <span style="font-size: 3.5rem;">🛒</span>
          <p class="text-secondary" style="margin-top: 1rem; margin-bottom: var(--space-md);">Your shopping cart is currently empty!</p>
          <a href="shop.html" class="btn btn-primary">Browse Floral Catalog</a>
        </td>
      </tr>
    `;
    if (typeof updateCartBadge === 'function') {
      await updateCartBadge();
    }
    updateSummary(0);
    return;
  }

  if (showSpinner) {
    cartBody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center" style="padding: 4rem 2rem;">
          <div style="display: inline-block; width: 35px; height: 35px;" class="spinner"></div>
          <p class="text-secondary" style="margin-top: 0.5rem;">Loading your shopping cart...</p>
        </td>
      </tr>
    `;
  }

  try {
    cartBody.innerHTML = '';
    let subtotal = 0;
    const baseServerUrl = API_BASE_URL.replace('/api', '');

    for (const item of guestCart) {
      const product = await api.get(`/products/${item.product}`);
      if (!product) continue;

      const itemTotal = product.price * item.quantity;
      subtotal += itemTotal;

      const imageUrl = getSafeImageUrl(product.image, product.category, product.name);

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>
          <div class="cart-item">
            <img src="${imageUrl}" alt="${product.name}" onerror="this.onerror=null; this.src=getSafeImageUrl(null, '${product.category}', '${product.name}');" />
            <div style="text-align: left;">
              <span class="cart-item-name">${product.name}</span>
              <div class="cart-item-category" style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">${product.category}</div>
            </div>
          </div>
        </td>
        <td>${formatINR(product.price)}</td>
        <td>
          <div class="quantity-selector" style="max-width: 130px;">
            <button class="qty-btn" onclick="adjustGuestQty('${product._id}', -1, this)">-</button>
            <input type="text" class="qty-input" value="${item.quantity}" readonly />
            <button class="qty-btn" onclick="adjustGuestQty('${product._id}', 1, this)">+</button>
          </div>
        </td>
        <td>${formatINR(itemTotal)}</td>
        <td>
          <button class="cart-remove-btn" onclick="removeGuestCartItem('${product._id}', this)">Remove</button>
        </td>
      `;
      cartBody.appendChild(row);
    }

    cartSubtotal = subtotal;
    updateSummary(subtotal);
    
    // Disable/dim coupon input for guest checkout
    const promoSection = document.querySelector('.promo-code-section');
    if (promoSection) {
      promoSection.style.opacity = '0.6';
      promoSection.style.pointerEvents = 'none';
      const input = document.getElementById('coupon-input');
      if (input) input.placeholder = 'Login to use promo codes';
    }
  } catch (err) {
    console.error('Error rendering guest cart:', err);
    cartBody.innerHTML = `
      <tr class="empty-cart-row">
        <td colspan="5" class="text-center" style="padding: 3rem; color: var(--error);">
          <p>Failed to load guest cart items. Please reload the page.</p>
        </td>
      </tr>
    `;
  }
}

/**
 * Adjust live quantity in local guest cart
 */
async function adjustGuestQty(productId, direction, btn) {
  let guestCart = JSON.parse(localStorage.getItem('florish_guest_cart')) || [];
  const idx = guestCart.findIndex(item => item.product === productId);
  if (idx > -1) {
    const targetQty = guestCart[idx].quantity + direction;
    if (targetQty <= 0) {
      guestCart.splice(idx, 1);
    } else {
      try {
        const product = await api.get(`/products/${productId}`);
        if (targetQty > product.stock) {
          showNotification(`Insufficient stock! Only ${product.stock} items are available.`, 'error');
          return;
        }
        guestCart[idx].quantity = targetQty;
      } catch (e) {
        guestCart[idx].quantity = targetQty;
      }
    }
    localStorage.setItem('florish_guest_cart', JSON.stringify(guestCart));
    if (typeof updateCartBadge === 'function') {
      await updateCartBadge();
    }
    await renderCart(false);
  }
}

/**
 * Remove product from guest cart
 */
async function removeGuestCartItem(productId, btn) {
  let guestCart = JSON.parse(localStorage.getItem('florish_guest_cart')) || [];
  guestCart = guestCart.filter(item => item.product !== productId);
  localStorage.setItem('florish_guest_cart', JSON.stringify(guestCart));
  showNotification('Item removed from cart.', 'success');
  if (typeof updateCartBadge === 'function') {
    await updateCartBadge();
  }
  await renderCart(false);
}
