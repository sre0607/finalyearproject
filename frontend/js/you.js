/*
 * You.js - Client-Side Controller for Personal Account Dashboard
 * Purpose: Populates customer profile details, default shipping address, wishlist items, in-app alerts,
 *          previously purchased products (Buy Again), category recommendations, and manages order cancellations.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('florish_token');
  if (!token) {
    showNotification('Please login to access your profile dashboard.', 'error');
    setTimeout(() => {
      window.location.replace('login.html');
    }, 1200);
    return;
  }

  // Hook form submissions
  const profileForm = document.getElementById('form-profile-details');
  if (profileForm) {
    profileForm.addEventListener('submit', handleProfileSubmit);
    setupProfileValidation();
  }

  const addressForm = document.getElementById('form-profile-address');
  if (addressForm) {
    addressForm.addEventListener('submit', handleAddressSubmit);
    setupAddressValidation();
  }

  const readAllBtn = document.getElementById('btn-inbox-read-all');
  if (readAllBtn) {
    readAllBtn.addEventListener('click', markAllAlertsRead);
  }

  const alertsWrapper = document.getElementById('stat-alerts-wrapper');
  if (alertsWrapper) {
    alertsWrapper.addEventListener('click', () => {
      const section = document.getElementById('you-notifications');
      if (section) section.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // Load and populate dashboard panels
  await loadUserProfile();
  await loadUserOrders();
  await loadUserWishlist();
  await loadUserNotifications();
  await loadShoppingRecommendations();
});

/**
 * Fetch and render user profile settings & saved address
 */
async function loadUserProfile() {
  try {
    const user = await api.get('/auth/profile');
    if (!user) return;

    // Greeting Banner details
    const lblGreeting = document.getElementById('lbl-greeting-name');
    if (lblGreeting) {
      lblGreeting.textContent = `Hello, ${user.name}!`;
    }
    const avatar = document.getElementById('lbl-avatar');
    if (avatar && user.name) {
      avatar.textContent = user.name.charAt(0).toUpperCase();
    }

    // Populate basic settings fields
    const txtName = document.getElementById('profile-name');
    const txtEmail = document.getElementById('profile-email');
    if (txtName) txtName.value = user.name || '';
    if (txtEmail) txtEmail.value = user.email || '';

    // Populate default shipping coordinates if present
    if (user.address) {
      const addr = user.address;
      const txtFirst = document.getElementById('addr-first-name');
      const txtLast = document.getElementById('addr-last-name');
      const txtAddr = document.getElementById('addr-line');
      const txtCity = document.getElementById('addr-city');
      const txtPin = document.getElementById('addr-pincode');
      const txtPhone = document.getElementById('addr-phone');

      if (txtFirst) txtFirst.value = addr.firstName || '';
      if (txtLast) txtLast.value = addr.lastName || '';
      if (txtAddr) txtAddr.value = addr.addressLine || '';
      if (txtCity) txtCity.value = addr.city || '';
      if (txtPin) txtPin.value = addr.pincode || '';
      if (txtPhone) txtPhone.value = addr.phone || '';
    }
    if (typeof validateProfileFormGlobal === 'function') validateProfileFormGlobal();
    if (typeof validateAddressFormGlobal === 'function') validateAddressFormGlobal();
  } catch (err) {
    console.error('Error fetching user profile specs:', err);
    showNotification('Failed to sync profile settings.', 'error');
  }
}

/**
 * Fetch and render customer orders list & buy again grids
 */
async function loadUserOrders() {
  const container = document.getElementById('orders-dashboard-list');
  if (!container) return;

  try {
    const orders = await api.get('/orders/myorders');
    
    // Update stats count
    const statOrders = document.getElementById('stat-orders-count');
    if (statOrders) statOrders.textContent = orders.length;

    if (!orders || orders.length === 0) {
      container.innerHTML = `
        <div class="empty-state-you">
          <p class="text-secondary" style="margin-bottom: var(--space-md);">You haven't placed any floral orders yet!</p>
          <a href="shop.html" class="btn btn-primary btn-sm">Explore Flower Collections</a>
        </div>
      `;
      return;
    }

    // Sort orders in descending chronological order
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    container.innerHTML = '';
    const uniquePurchasedProductIds = new Set();
    const baseServerUrl = API_BASE_URL.replace('/api', '');

    orders.forEach(order => {
      const displayId = order._id.toString().substring(order._id.toString().length - 6).toUpperCase();
      const dateStr = new Date(order.createdAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });

      // Accumulate product references for the "Buy Again" logic
      order.items.forEach(item => {
        if (item.product) {
          uniquePurchasedProductIds.add(item.product.toString());
        }
      });

      // Status badge styling
      let statusClass = 'badge-processing';
      if (order.orderStatus === 'Shipped') statusClass = 'badge-success';
      if (order.orderStatus === 'Delivered') statusClass = 'badge-success';
      if (order.orderStatus === 'Cancelled') statusClass = 'badge-error';

      const itemsHtml = order.items.map(item => `
        <div class="order-item-row">
          <strong>${item.name}</strong> <span class="text-secondary">x${item.quantity}</span> - ${formatINR(item.price)} each
        </div>
      `).join('');

      const card = document.createElement('div');
      card.className = 'order-dashboard-card';
      card.innerHTML = `
        <div class="order-card-header">
          <div class="order-header-info">
            <div>
              <span>Date Placed:</span><br>
              <strong>${dateStr}</strong>
            </div>
            <div>
              <span>Order ID:</span><br>
              <strong>#FL-${displayId}</strong>
            </div>
            <div>
              <span>Payment Mode:</span><br>
              <strong>${order.paymentMethod === 'cod' ? 'COD' : 'Online'}</strong>
            </div>
            <div>
              <span>Total Price:</span><br>
              <strong style="color: var(--primary);">${formatINR(order.totalPrice)}</strong>
            </div>
          </div>
          <div>
            <span class="admin-badge ${statusClass}">${order.orderStatus}</span>
          </div>
        </div>
        <div class="order-card-body">
          <div class="order-items-detail">
            ${itemsHtml}
          </div>
          <div class="order-actions">
            <button class="btn btn-outline btn-sm" onclick="downloadInvoice('${order._id}', this)">📄 Download Invoice</button>
            ${order.orderStatus === 'Processing' 
              ? `<button class="btn btn-outline btn-sm" style="color: var(--error); border-color: var(--error);" onclick="cancelOrder('${order._id}', this)">Cancel Order</button>`
              : ''
            }
          </div>
        </div>
      `;
      container.appendChild(card);
    });

    // Populate Buy Again Grid if past purchases exist
    if (uniquePurchasedProductIds.size > 0) {
      await populateBuyAgain(Array.from(uniquePurchasedProductIds));
    }

  } catch (err) {
    console.error('Error rendering orders list:', err);
    container.innerHTML = '<p class="text-secondary text-center">Could not load recent orders.</p>';
  }
}

/**
 * Generate Buy Again section from previously ordered product IDs
 */
async function populateBuyAgain(productIds) {
  const container = document.getElementById('buy-again-products-grid');
  const section = document.getElementById('you-buy-again');
  if (!container || !section) return;

  try {
    const allProducts = await api.get('/products');
    const baseServerUrl = API_BASE_URL.replace('/api', '');

    // Map matched inventory items
    const purchasedProducts = productIds
      .map(id => allProducts.find(p => p._id === id || p.id === id))
      .filter(p => p !== undefined && !p.isDeleted && !p.isHidden)
      .slice(0, 4); // Limit to top 4 items

    if (purchasedProducts.length === 0) {
      section.style.display = 'none';
      return;
    }

    container.innerHTML = '';
    section.style.display = 'block';

    purchasedProducts.forEach(product => {
      const id = product._id || product.id;
      const imageUrl = getSafeImageUrl(product.image, product.category, product.name);

      const card = document.createElement('div');
      card.className = 'product-card hover-lift animate-fade-in';
      card.style.padding = '1rem';
      card.innerHTML = `
        <div class="card-image-wrapper" style="height: 140px;">
          <img src="${imageUrl}" alt="${product.name}" class="product-card-img" onerror="this.onerror=null; this.src=getSafeImageUrl(null, '${product.category}', '${product.name}');" />
        </div>
        <div class="card-content" style="padding: 0.5rem 0 0 0;">
          <span class="card-category" style="font-size: 0.75rem;">${product.category}</span>
          <h4 style="font-size: 0.95rem; margin: 0.25rem 0; font-family: var(--font-header); height: 35px; overflow: hidden;"><a href="product-details.html?id=${id}">${product.name}</a></h4>
          <div class="card-footer-price" style="margin-top: 0.5rem;">
            <span class="price-current" style="font-size: 1rem;">${formatINR(product.price)}</span>
            <button class="btn btn-primary btn-sm" style="padding: 0.35rem 0.6rem; font-size: 0.8rem;" onclick="buyAgainAddToCart('${id}', this)" ${product.stock === 0 ? 'disabled' : ''}>
              ${product.stock === 0 ? 'Sold Out' : '🛒 Buy Again'}
            </button>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error('Error populating Buy Again grid:', err);
  }
}

/**
 * Buy Again One-Click re-add action
 */
async function buyAgainAddToCart(productId, btn) {
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Adding...';

  try {
    await api.post('/cart', { productId, quantity: 1 });
    
    // Sync header badge indicator
    let localCart = [];
    try {
      localCart = JSON.parse(localStorage.getItem('florish_cart')) || [];
      if (!Array.isArray(localCart)) localCart = [];
    } catch (e) {
      localCart = [];
    }
    const idx = localCart.findIndex(i => i.id === productId);
    if(idx > -1) {
      localCart[idx].quantity += 1;
    } else {
      localCart.push({ id: productId, quantity: 1 });
    }
    localStorage.setItem('florish_cart', JSON.stringify(localCart));
    if (typeof updateCartBadge === 'function') updateCartBadge();

    showNotification('Item added back to your cart!', 'success');
  } catch (err) {
    console.error(err);
    showNotification(err.message || 'Could not add item to cart', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

/**
 * Fetch and render user wishlist items
 */
async function loadUserWishlist() {
  const container = document.getElementById('wishlist-products-grid');
  if (!container) return;

  try {
    const wishlist = await api.get('/wishlist');
    
    // Update stats count
    const statWishlist = document.getElementById('stat-wishlist-count');
    const products = wishlist.products || [];
    if (statWishlist) statWishlist.textContent = products.length;

    if (!products || products.length === 0) {
      container.innerHTML = `
        <div class="empty-state-you" style="grid-column: 1 / -1;">
          <p>Your wishlist is currently empty!</p>
          <a href="shop.html" class="btn btn-primary btn-sm" style="margin-top: 0.5rem;">Browse Floral Catalog</a>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    const baseServerUrl = API_BASE_URL.replace('/api', '');

    products.forEach(product => {
      if (!product) return;
      const id = product._id || product.id;
      const imageUrl = getSafeImageUrl(product.image, product.category, product.name);

      const isOutOfStock = product.stock === 0;
      const badgeMarkup = isOutOfStock 
        ? `<div style="background: var(--error); color: white; position: absolute; top: 8px; left: 8px; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: bold;">Sold Out</div>` 
        : '';

      const card = document.createElement('div');
      card.className = 'product-card hover-lift animate-fade-in';
      card.style.padding = '1rem';
      card.style.position = 'relative';
      card.innerHTML = `
        ${badgeMarkup}
        <div class="card-image-wrapper" style="height: 140px;">
          <img src="${imageUrl}" alt="${product.name}" class="product-card-img" onerror="this.onerror=null; this.src=getSafeImageUrl(null, '${product.category}', '${product.name}');" />
        </div>
        <div class="card-content" style="padding: 0.5rem 0 0 0;">
          <span class="card-category" style="font-size: 0.75rem;">${product.category}</span>
          <h4 style="font-size: 0.95rem; margin: 0.25rem 0; font-family: var(--font-header); height: 35px; overflow: hidden;"><a href="product-details.html?id=${id}">${product.name}</a></h4>
          <div class="card-footer-price" style="margin-top: 0.5rem;">
            <span class="price-current" style="font-size: 1rem;">${formatINR(product.price)}</span>
            <div style="display: flex; gap: 0.2rem;">
              <button class="btn btn-primary btn-sm" style="padding: 0.35rem 0.5rem; font-size: 0.8rem;" onclick="wishlistAddToCart('${id}', this)" ${isOutOfStock ? 'disabled style="opacity: 0.6; cursor: not-allowed;"' : ''}>
                ${isOutOfStock ? 'Sold Out' : '🛒 Add'}
              </button>
              <button class="btn btn-outline btn-sm" style="padding: 0.35rem 0.5rem; font-size: 0.8rem;" onclick="deleteWishlistItem('${id}', this)" title="Remove Item">❌</button>
            </div>
          </div>
        </div>
      `;
      container.appendChild(card);
    });

  } catch (err) {
    console.error('Error rendering user wishlist grid:', err);
    container.innerHTML = '<p class="text-secondary text-center" style="grid-column: 1 / -1;">Could not load saved wishlist items.</p>';
  }
}

/**
 * Add wishlist item to shopping cart
 */
async function wishlistAddToCart(productId, btn) {
  try {
    await api.post('/cart', { productId, quantity: 1 });
    await api.delete(`/wishlist/${productId}`);
    
    // Sync cart badge cache
    let localCart = [];
    try {
      localCart = JSON.parse(localStorage.getItem('florish_cart')) || [];
      if (!Array.isArray(localCart)) localCart = [];
    } catch (e) {
      localCart = [];
    }
    const idx = localCart.findIndex(i => i.id === productId);
    if(idx > -1) {
      localCart[idx].quantity += 1;
    } else {
      localCart.push({ id: productId, quantity: 1 });
    }
    localStorage.setItem('florish_cart', JSON.stringify(localCart));
    if (typeof updateCartBadge === 'function') updateCartBadge();

    showNotification('Item moved to your cart!', 'success');
    await loadUserWishlist(); // Refresh grid
  } catch (err) {
    console.error(err);
    showNotification(err.message || 'Could not move item to cart', 'error');
  }
}

/**
 * Remove wishlist item completely
 */
async function deleteWishlistItem(productId, btn) {
  try {
    await api.delete(`/wishlist/${productId}`);
    showNotification('Item removed from wishlist.', 'success');
    await loadUserWishlist(); // Refresh grid
  } catch (err) {
    console.error(err);
    showNotification('Could not remove item from wishlist.', 'error');
  }
}

/**
 * Fetch and render inbox notifications feed
 */
async function loadUserNotifications() {
  const container = document.getElementById('inbox-dashboard-list');
  if (!container) return;

  try {
    const notifications = await api.get('/notifications');
    
    // Calculate and populate stats counts
    let unreadCount = 0;
    notifications.forEach(n => { if (!n.isRead) unreadCount++; });
    
    const statAlerts = document.getElementById('stat-alerts-count');
    if (statAlerts) statAlerts.textContent = unreadCount;

    if (!notifications || notifications.length === 0) {
      container.innerHTML = `
        <div class="empty-state-you">
          <p>You have no alerts in your inbox.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    notifications.forEach(n => {
      let icon = '🔔';
      let actionHtml = '';

      if (n.type === 'back_in_stock') {
        icon = '🌸';
        if (n.product) {
          actionHtml = `<span class="inbox-action-btn" onclick="window.location.href='product-details.html?id=${n.product}'">View Item</span>`;
        }
      } else if (n.type === 'order_status') {
        icon = '📦';
        actionHtml = `<span class="inbox-action-btn" onclick="scrollToSection('you-orders')">Track Order</span>`;
      } else if (n.type === 'promo') {
        icon = '🎟️';
        actionHtml = `<span class="inbox-action-btn" onclick="window.location.href='shop.html'">Shop Promo</span>`;
      }

      const dateStr = new Date(n.createdAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });

      const card = document.createElement('div');
      card.className = `inbox-card ${n.isRead ? '' : 'unread'}`;
      card.id = `inbox-alert-${n._id}`;
      card.innerHTML = `
        <div class="inbox-icon">${icon}</div>
        <div class="inbox-body">
          <div class="inbox-title">${n.title}</div>
          <div class="inbox-msg">${n.message}</div>
          <div class="inbox-meta">
            <span>${dateStr}</span>
            ${actionHtml}
          </div>
        </div>
        ${!n.isRead ? `<div class="inbox-dot" onclick="markAlertAsRead('${n._id}')" title="Mark Read"></div>` : ''}
      `;
      container.appendChild(card);
    });

  } catch (err) {
    console.error('Error rendering notifications feed:', err);
    container.innerHTML = '<p class="text-secondary text-center">Could not load notifications inbox.</p>';
  }
}

/**
 * Mark a single inbox notification as read
 */
async function markAlertAsRead(id) {
  try {
    await api.put(`/notifications/${id}/read`);
    const card = document.getElementById(`inbox-alert-${id}`);
    if (card) {
      card.classList.remove('unread');
      const dot = card.querySelector('.inbox-dot');
      if (dot) dot.remove();
    }
    // Update count in header
    await loadUserNotifications();
    if (typeof updateNotificationsBadge === 'function') {
      updateNotificationsBadge();
    }
  } catch (err) {
    console.error(err);
  }
}

/**
 * Mark all inbox alerts as read
 */
async function markAllAlertsRead() {
  const btn = document.getElementById('btn-inbox-read-all');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '...';
  }

  try {
    await api.put('/notifications/read-all');
    showNotification('Marked all alerts as read!', 'success');
    await loadUserNotifications();
    if (typeof updateNotificationsBadge === 'function') {
      updateNotificationsBadge();
    }
  } catch (err) {
    console.error(err);
    showNotification('Failed to mark alerts as read', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Mark All Read';
    }
  }
}

/**
 * Load same-category shopping recommendations based on browsing history
 */
async function loadShoppingRecommendations() {
  const container = document.getElementById('recommendations-products-grid');
  const section = document.getElementById('you-recommendations');
  if (!container || !section) return;

  try {
    let viewedIds = [];
    try {
      viewedIds = JSON.parse(localStorage.getItem('florish_recently_viewed')) || [];
      if (!Array.isArray(viewedIds)) viewedIds = [];
    } catch (e) {
      viewedIds = [];
    }

    const allProducts = await api.get('/products');
    const baseServerUrl = API_BASE_URL.replace('/api', '');

    let targetCategory = '';
    let excludedProductId = '';

    if (viewedIds.length > 0) {
      // Find category of the last viewed product
      const lastViewed = allProducts.find(p => p._id === viewedIds[0] || p.id === viewedIds[0]);
      if (lastViewed) {
        targetCategory = lastViewed.category;
        excludedProductId = lastViewed._id || lastViewed.id;
      }
    }

    // Fallback category if no browsing history: use first category from wishlist
    if (!targetCategory) {
      try {
        const wishlist = await api.get('/wishlist');
        if (wishlist.products && wishlist.products.length > 0) {
          targetCategory = wishlist.products[0].category;
          excludedProductId = wishlist.products[0]._id || wishlist.products[0].id;
        }
      } catch (e) {}
    }

    // Final fallback: use a default category (e.g. bouquets)
    if (!targetCategory) {
      targetCategory = 'bouquets';
    }

    // Filter products matching category, excluding viewed item
    const recommended = allProducts
      .filter(p => p.category === targetCategory && (p._id || p.id) !== excludedProductId && !p.isDeleted && !p.isHidden)
      .slice(0, 4); // Limit to top 4 recommendations

    if (recommended.length === 0) {
      // If no recommendations in same category, show any featured items
      const featured = allProducts
        .filter(p => p.isFeatured && (p._id || p.id) !== excludedProductId && !p.isDeleted && !p.isHidden)
        .slice(0, 4);
      if (featured.length > 0) {
        renderRecommendationsGrid(featured, container, section, baseServerUrl);
      } else {
        section.style.display = 'none';
      }
    } else {
      renderRecommendationsGrid(recommended, container, section, baseServerUrl);
    }

  } catch (err) {
    console.error('Error generating shopping recommendations:', err);
    section.style.display = 'none';
  }
}

function renderRecommendationsGrid(products, grid, section, baseServerUrl) {
  grid.innerHTML = '';
  section.style.display = 'block';

  products.forEach(p => {
    const id = p._id || p.id;
    const imageUrl = getSafeImageUrl(p.image, p.category, p.name);

    const card = document.createElement('div');
    card.className = 'product-card hover-lift animate-fade-in';
    card.style.padding = '1rem';
    card.innerHTML = `
      <div class="card-image-wrapper" style="height: 140px;">
        <img src="${imageUrl}" alt="${p.name}" class="product-card-img" onerror="this.onerror=null; this.src=getSafeImageUrl(null, '${p.category}', '${p.name}');" />
      </div>
      <div class="card-content" style="padding: 0.5rem 0 0 0;">
        <span class="card-category" style="font-size: 0.75rem;">${p.category}</span>
        <h4 style="font-size: 0.95rem; margin: 0.25rem 0; font-family: var(--font-header); height: 35px; overflow: hidden;"><a href="product-details.html?id=${id}">${p.name}</a></h4>
        <div class="card-footer-price" style="margin-top: 0.5rem;">
          <span class="price-current" style="font-size: 1rem;">${formatINR(p.price)}</span>
          <button class="btn btn-primary btn-sm" style="padding: 0.35rem 0.6rem; font-size: 0.8rem;" onclick="buyAgainAddToCart('${id}', this)" ${p.stock === 0 ? 'disabled' : ''}>
            ${p.stock === 0 ? 'Sold Out' : '🛒 Add'}
          </button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

/**
 * Handle basic profile settings updates
 */
async function handleProfileSubmit(e) {
  e.preventDefault();

  const name = document.getElementById('profile-name').value.trim();
  const email = document.getElementById('profile-email').value.trim();
  const password = document.getElementById('profile-password').value;
  const confirmPassword = document.getElementById('profile-confirm-password').value;

  if (!name) {
    showNotification('Name is a required field.', 'error');
    return;
  }
  if (name.length < 2 || name.length > 50) {
    showNotification('Name must be between 2 and 50 characters.', 'error');
    return;
  }
  if (/<script/i.test(name)) {
    showNotification('Script injection is not allowed in name.', 'error');
    return;
  }

  const emailVal = email.toLowerCase();
  if (!emailVal) {
    showNotification('Email is a required field.', 'error');
    return;
  }
  if (typeof validateEmailPattern === 'function' && !validateEmailPattern(emailVal)) {
    showNotification('Please enter a valid email address.', 'error');
    return;
  }

  if (password) {
    if (typeof validatePasswordStrengthPattern === 'function' && !validatePasswordStrengthPattern(password)) {
      showNotification('Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character.', 'error');
      return;
    }
    if (password !== confirmPassword) {
      showNotification('Passwords do not match.', 'error');
      return;
    }
  }

  const btn = document.getElementById('btn-save-profile');
  btn.disabled = true;
  btn.textContent = 'Saving Settings...';

  try {
    const payload = { name, email: emailVal };
    if (password) {
      payload.password = password;
    }

    const updatedUser = await api.put('/users/profile', payload);
    
    // Sync localStorage session cache
    localStorage.setItem('florish_user', JSON.stringify({
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role
    }));

    // Update greeting
    const lblGreeting = document.getElementById('lbl-greeting-name');
    if (lblGreeting) lblGreeting.textContent = `Hello, ${updatedUser.name}!`;

    // Clear password fields
    document.getElementById('profile-password').value = '';
    document.getElementById('profile-confirm-password').value = '';

    showNotification('Profile settings saved successfully!', 'success');
  } catch (err) {
    console.error(err);
    showNotification(err.message || 'Failed to update profile details', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Profile Settings';
  }
}

/**
 * Handle default shipping address updates
 */
async function handleAddressSubmit(e) {
  e.preventDefault();

  const firstName = document.getElementById('addr-first-name').value.trim();
  const lastName = document.getElementById('addr-last-name').value.trim();
  const addressLine = document.getElementById('addr-line').value.trim();
  const city = document.getElementById('addr-city').value.trim();
  const pincode = document.getElementById('addr-pincode').value.trim();
  const phone = document.getElementById('addr-phone').value.trim();

  if (!firstName || !lastName || !addressLine || !city || !pincode || !phone) {
    showNotification('Please fill in all default delivery address fields.', 'error');
    return;
  }

  if (firstName.length < 2 || firstName.length > 50 || lastName.length < 2 || lastName.length > 50) {
    showNotification('First and last name must be between 2 and 50 characters.', 'error');
    return;
  }

  if (/<script/i.test(firstName) || /<script/i.test(lastName)) {
    showNotification('Script injection is not allowed in name fields.', 'error');
    return;
  }

  if (addressLine.length < 5) {
    showNotification('Street address must be at least 5 characters long.', 'error');
    return;
  }

  // Validate phone: 10 digit Indian mobile starting with 6-9
  if (!/^[6-9]\d{9}$/.test(phone)) {
    showNotification('Phone number must be a valid 10-digit Indian phone number starting with 6-9.', 'error');
    return;
  }

  // Validate pincode: 6 digits numeric
  if (!/^\d{6}$/.test(pincode)) {
    showNotification('Pincode must be exactly 6 digits.', 'error');
    return;
  }

  // Check pincode against allowed list from settings
  const allowedListStr = localStorage.getItem('florish_allowed_pincodes') || '400001, 400002, 400003, 400029, 400032';
  const allowedList = allowedListStr.split(',').map(p => p.trim());
  if (!allowedList.includes(pincode)) {
    showNotification(`Sorry, we do not deliver to pincode ${pincode}. Supported pincodes: ${allowedListStr}`, 'error');
    return;
  }

  const btn = document.getElementById('btn-save-address');
  btn.disabled = true;
  btn.textContent = 'Saving Address...';

  try {
    const address = { firstName, lastName, addressLine, city, pincode, phone };
    await api.put('/users/profile', { address });
    
    showNotification('Default delivery address saved successfully!', 'success');
  } catch (err) {
    console.error(err);
    showNotification(err.message || 'Failed to update default address.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Delivery Address';
  }
}

/**
 * Handle processing order cancellation
 */
async function cancelOrder(orderId, btn) {
  if (!confirm('Are you sure you want to cancel this order?')) return;

  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Cancelling...';

  try {
    await api.put(`/orders/${orderId}/cancel`);
    showNotification('Order successfully cancelled.', 'success');
    await loadUserOrders(); // Reload orders and stats
  } catch (err) {
    console.error(err);
    showNotification(err.message || 'Failed to cancel order.', 'error');
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

/**
 * Direct file download trigger for invoice PDF
 */
async function downloadInvoice(orderId, btn) {
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Preparing PDF...';

  try {
    const token = localStorage.getItem('florish_token');
    const response = await fetch(`${API_BASE_URL}/orders/${orderId}/invoice`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Failed to generate PDF invoice');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // Friendly filename
    const displayId = orderId.substring(orderId.length - 6).toUpperCase();
    a.download = `Florish_Invoice_Order${displayId}.pdf`;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    a.remove();
    window.URL.revokeObjectURL(url);
    showNotification('Invoice PDF downloaded successfully!', 'success');
  } catch (err) {
    console.error(err);
    showNotification(err.message || 'Failed to download invoice', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

// Global functions exposed to inline clicks
window.downloadInvoice = downloadInvoice;
window.cancelOrder = cancelOrder;
window.buyAgainAddToCart = buyAgainAddToCart;
window.wishlistAddToCart = wishlistAddToCart;
window.deleteWishlistItem = deleteWishlistItem;

let validateProfileFormGlobal = null;
let validateAddressFormGlobal = null;

function setupProfileValidation() {
  const nameInput = document.getElementById('profile-name');
  const emailInput = document.getElementById('profile-email');
  const passwordInput = document.getElementById('profile-password');
  const confirmPasswordInput = document.getElementById('profile-confirm-password');
  const submitBtn = document.getElementById('btn-save-profile');

  const validateForm = () => {
    let isValid = true;
    if (nameInput) {
      const val = nameInput.value.trim();
      if (!val || val.length < 2 || val.length > 50 || /<script/i.test(val)) isValid = false;
    }
    if (emailInput) {
      const val = emailInput.value.trim().toLowerCase();
      if (!val || !validateEmailPattern(val)) isValid = false;
    }
    if (passwordInput && passwordInput.value) {
      const val = passwordInput.value;
      if (!validatePasswordStrengthPattern(val)) isValid = false;
      if (confirmPasswordInput && confirmPasswordInput.value !== val) isValid = false;
    }
    if (submitBtn) submitBtn.disabled = !isValid;
  };

  validateProfileFormGlobal = validateForm;

  const validateField = (inputEl) => {
    if (!inputEl) return;
    const val = inputEl.value;
    const valTrim = val.trim();

    if (inputEl === nameInput) {
      if (!valTrim) {
        showInlineError(nameInput, 'Name is required.');
      } else if (valTrim.length < 2) {
        showInlineError(nameInput, 'Name must be at least 2 characters long.');
      } else if (valTrim.length > 50) {
        showInlineError(nameInput, 'Name cannot exceed 50 characters.');
      } else if (/<script/i.test(valTrim)) {
        showInlineError(nameInput, 'Script injection is not allowed.');
      } else {
        clearInlineError(nameInput);
      }
    } else if (inputEl === emailInput) {
      if (!valTrim) {
        showInlineError(emailInput, 'Email address is required.');
      } else if (!validateEmailPattern(valTrim)) {
        showInlineError(emailInput, 'Please enter a valid email address.');
      } else {
        clearInlineError(emailInput);
      }
    } else if (inputEl === passwordInput && val) {
      if (!validatePasswordStrengthPattern(val)) {
        showInlineError(passwordInput, 'Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character.');
      } else {
        clearInlineError(passwordInput);
      }
    } else if (inputEl === confirmPasswordInput && passwordInput.value) {
      if (val !== passwordInput.value) {
        showInlineError(confirmPasswordInput, 'Passwords do not match.');
      } else {
        clearInlineError(confirmPasswordInput);
      }
    }
  };

  const inputs = [nameInput, emailInput, passwordInput, confirmPasswordInput];
  inputs.forEach(input => {
    if (!input) return;
    input.addEventListener('blur', () => validateField(input));
    input.addEventListener('input', () => validateForm());
    input.addEventListener('change', () => {
      validateField(input);
      validateForm();
    });
  });

  validateForm();
}

function setupAddressValidation() {
  const firstNameInput = document.getElementById('addr-first-name');
  const lastNameInput = document.getElementById('addr-last-name');
  const addressLineInput = document.getElementById('addr-line');
  const cityInput = document.getElementById('addr-city');
  const pincodeInput = document.getElementById('addr-pincode');
  const phoneInput = document.getElementById('addr-phone');
  const submitBtn = document.getElementById('btn-save-address');

  const validateForm = () => {
    let isValid = true;
    if (firstNameInput) {
      const val = firstNameInput.value.trim();
      if (!val || val.length < 2 || val.length > 50 || /<script/i.test(val)) isValid = false;
    }
    if (lastNameInput) {
      const val = lastNameInput.value.trim();
      if (!val || val.length < 2 || val.length > 50 || /<script/i.test(val)) isValid = false;
    }
    if (addressLineInput) {
      const val = addressLineInput.value.trim();
      if (!val || val.length < 5) isValid = false;
    }
    if (cityInput && !cityInput.value.trim()) isValid = false;
    if (phoneInput) {
      const val = phoneInput.value.trim();
      if (!val || !/^[6-9]\d{9}$/.test(val)) isValid = false;
    }
    if (pincodeInput) {
      const val = pincodeInput.value.trim();
      if (!val || !/^\d{6}$/.test(val)) {
        isValid = false;
      } else {
        const allowedListStr = localStorage.getItem('florish_allowed_pincodes') || '400001, 400002, 400003, 400029, 400032';
        const allowedList = allowedListStr.split(',').map(p => p.trim());
        if (!allowedList.includes(val)) isValid = false;
      }
    }
    if (submitBtn) submitBtn.disabled = !isValid;
  };

  validateAddressFormGlobal = validateForm;

  const validateField = (inputEl) => {
    if (!inputEl) return;
    const val = inputEl.value.trim();

    if (inputEl === firstNameInput) {
      if (!val) {
        showInlineError(firstNameInput, 'First name is required.');
      } else if (val.length < 2 || val.length > 50) {
        showInlineError(firstNameInput, 'First name must be between 2 and 50 characters.');
      } else if (/<script/i.test(val)) {
        showInlineError(firstNameInput, 'Script injection is not allowed.');
      } else {
        clearInlineError(firstNameInput);
      }
    } else if (inputEl === lastNameInput) {
      if (!val) {
        showInlineError(lastNameInput, 'Last name is required.');
      } else if (val.length < 2 || val.length > 50) {
        showInlineError(lastNameInput, 'Last name must be between 2 and 50 characters.');
      } else if (/<script/i.test(val)) {
        showInlineError(lastNameInput, 'Script injection is not allowed.');
      } else {
        clearInlineError(lastNameInput);
      }
    } else if (inputEl === addressLineInput) {
      if (!val) {
        showInlineError(addressLineInput, 'Street address is required.');
      } else if (val.length < 5) {
        showInlineError(addressLineInput, 'Street address must be at least 5 characters long.');
      } else {
        clearInlineError(addressLineInput);
      }
    } else if (inputEl === cityInput) {
      if (!val) {
        showInlineError(cityInput, 'City is required.');
      } else {
        clearInlineError(cityInput);
      }
    } else if (inputEl === phoneInput) {
      if (!val) {
        showInlineError(phoneInput, 'Phone number is required.');
      } else if (!/^[6-9]\d{9}$/.test(val)) {
        showInlineError(phoneInput, 'Phone number must be a valid 10-digit Indian phone number starting with 6-9.');
      } else {
        clearInlineError(phoneInput);
      }
    } else if (inputEl === pincodeInput) {
      if (!val) {
        showInlineError(pincodeInput, 'Pincode is required.');
      } else if (!/^\d{6}$/.test(val)) {
        showInlineError(pincodeInput, 'Pincode must be exactly 6 digits.');
      } else {
        const allowedListStr = localStorage.getItem('florish_allowed_pincodes') || '400001, 400002, 400003, 400029, 400032';
        const allowedList = allowedListStr.split(',').map(p => p.trim());
        if (!allowedList.includes(val)) {
          showInlineError(pincodeInput, `Sorry, we do not deliver to pincode ${val}. Supported areas: ${allowedListStr}`);
        } else {
          clearInlineError(pincodeInput);
        }
      }
    }
  };

  const inputs = [firstNameInput, lastNameInput, addressLineInput, cityInput, pincodeInput, phoneInput];
  inputs.forEach(input => {
    if (!input) return;
    input.addEventListener('blur', () => validateField(input));
    input.addEventListener('input', () => validateForm());
    input.addEventListener('change', () => {
      validateField(input);
      validateForm();
    });
  });

  validateForm();
}
window.markAlertAsRead = markAlertAsRead;
