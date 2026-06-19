/*
 * Products.js - Product Catalog Builder and Grid Injector
 * Purpose: Simulates dynamic floral inventory lists, creates HTML product-card structures, and handles quick filters.
 */

// Products.js - Dynamic Product Catalog Rendering and Interactions

document.addEventListener('DOMContentLoaded', async () => {
  // Auto-inject featured items on Homepage
  const featuredGrid = document.getElementById('featured-products-grid');
  if (featuredGrid) {
    // Show premium skeleton loaders
    featuredGrid.innerHTML = `
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    `;

    try {
      const allProducts = await api.get('/products');
      const featuredItems = allProducts.filter(item => item.isFeatured);
      renderProducts(featuredItems, featuredGrid);
    } catch (err) {
      console.error('Error loading featured products:', {
        message: err.message,
        stack: err.stack,
        endpoint: '/products'
      });
      featuredGrid.innerHTML = `
        <div class="skeleton-card" style="opacity: 0.4; filter: grayscale(1);"></div>
        <div class="skeleton-card" style="opacity: 0.4; filter: grayscale(1);"></div>
        <div class="skeleton-card" style="opacity: 0.4; filter: grayscale(1);"></div>
        <div class="skeleton-card" style="opacity: 0.4; filter: grayscale(1);"></div>
        <div class="error-card" style="grid-column: 1/-1; padding: 2.5rem; text-align: center; background: var(--surface-color); border: 1px solid var(--border-color); border-radius: var(--radius-md); box-shadow: var(--shadow-md); margin-top: 1rem; position: relative; z-index: 10;">
          <div style="font-size: 2.5rem; margin-bottom: 1rem;">🌸</div>
          <h3 style="color: var(--text-color); margin-bottom: 0.5rem; font-family: var(--font-header);">Could Not Load Featured Arrangements</h3>
          <p style="color: var(--text-muted); margin-bottom: 1.5rem; max-width: 500px; margin-left: auto; margin-right: auto; line-height: 1.6;">
            We're having trouble connecting to our florist database right now. Please check your connection or reload the page.
          </p>
          <button id="retry-featured-btn" class="btn btn-primary" style="padding: 0.75rem 2rem; border-radius: var(--radius-sm); font-weight: bold; cursor: pointer; transition: all 0.2s ease;">
            🔄 Retry Loading
          </button>
        </div>
      `;
      const retryBtn = document.getElementById('retry-featured-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => {
          window.location.reload();
        });
      }
    }
  }
});

/**
 * Builds HTML blocks and injects them into specific containers
 * @param {Array} items - List of products to render
 * @param {HTMLElement} gridElement - Target HTML grid
 */
function renderProducts(items, gridElement) {
  gridElement.innerHTML = '';

  if (items.length === 0) {
    // Return empty results state helper (handled inside filter.js for shop, fallback here)
    gridElement.innerHTML = `<p class="text-secondary text-center" style="grid-column: 1/-1; padding: 2rem;">No items match your criteria.</p>`;
    return;
  }

  const baseServerUrl = API_BASE_URL.replace('/api', '');

  items.forEach(product => {
    const id = product._id || product.id;
    const ratingVal = product.rating !== undefined ? product.rating : 5;
    const starsSymbol = '★'.repeat(Math.round(ratingVal)) + '☆'.repeat(5 - Math.round(ratingVal));
    const stars = `<span style="color: var(--accent); font-weight: bold; margin-right: 0.25rem;">${Number(ratingVal).toFixed(1)}</span><span style="color: var(--accent);">${starsSymbol}</span>`;
    const reviewsCount = product.reviewsCount !== undefined ? product.reviewsCount : 0;
    
    // Discount calculations
    const discountBadge = product.oldPrice 
      ? `<div class="badge-discount">-${Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)}%</div>` 
      : '';
    const oldPriceMarkup = product.oldPrice ? `<span class="price-old">${formatINR(product.oldPrice)}</span>` : '';

    // Stock badges and action rules
    let stockBadge = '';
    let stockText = '';
    let isOutOfStock = false;

    if (product.stock === 0) {
      stockBadge = `<div class="badge-stock out-of-stock">Out of Stock</div>`;
      stockText = `<div class="card-stock-text" style="color: var(--error);">Out of Stock</div>`;
      isOutOfStock = true;
    } else if (product.stock !== undefined && product.stock > 0 && product.stock <= 5) {
      stockBadge = `<div class="badge-stock low-stock">Only ${product.stock} Left</div>`;
      stockText = `<div class="card-stock-text" style="color: var(--warning);">Only ${product.stock} left!</div>`;
    } else {
      stockText = `<div class="card-stock-text" style="color: var(--success);">In Stock</div>`;
    }

    const addToCartDisabled = isOutOfStock ? 'disabled' : '';
    const addToCartText = isOutOfStock ? 'Sold Out' : '🛒 Add';

    const imageUrl = getSafeImageUrl(product.image, product.category, product.name);

    const card = document.createElement('div');
    card.className = 'product-card animate-fade-in';
    card.innerHTML = `
      ${discountBadge}
      ${stockBadge}
      <div class="card-image-wrapper">
        <img src="${imageUrl}" alt="${product.name}" class="product-card-img" onerror="this.onerror=null; this.src=getSafeImageUrl(null, '${product.category}', '${product.name}');" />
        <div class="card-actions-overlay">
          <button class="overlay-btn" onclick="addToWishlist('${id}')" title="Add to Wishlist">❤️</button>
          <button class="overlay-btn" onclick="quickView('${id}')" title="Quick View">👁️</button>
        </div>
      </div>
      <div class="card-content">
        <span class="card-category">${product.category}</span>
        <h3 class="card-title"><a href="product-details.html?id=${id}">${product.name}</a></h3>
        <div class="card-rating">${stars} <span class="rating-text">(${reviewsCount})</span></div>
        ${stockText}
        <div class="card-footer-price">
          <div class="price-container">
            ${oldPriceMarkup}
            <span class="price-current">${formatINR(product.price)}</span>
          </div>
          <button class="btn btn-primary btn-sm" onclick="handleAddToCartClick('${id}', this)" ${addToCartDisabled}>${addToCartText}</button>
        </div>
      </div>
    `;
    gridElement.appendChild(card);
  });
}

// Interceptor function to handle cart clicks safely
async function handleAddToCartClick(productId, btn) {
  const token = localStorage.getItem('florish_token');
  if (!token) {
    showNotification('Please login to start shopping and adding items to your cart.', 'error');
    setTimeout(() => { window.location.href = 'login.html'; }, 1000);
    return;
  }

  const originalText = btn ? btn.textContent : '🛒 Add';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Adding...';
  }

  try {
    await api.post('/cart', { productId, quantity: 1 });
    
    // Add local trigger to update badge count
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
    
    if (typeof updateCartBadge === 'function') {
      await updateCartBadge();
    }

    showNotification('Item added to cart!', 'success');
  } catch (err) {
    console.error(err);
    showNotification(err.message || 'Could not add item to cart', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
}

// Global simulation actions
async function addToWishlist(prodId) {
  const token = localStorage.getItem('florish_token');
  if (!token) {
    showNotification('Please login to save items to your wishlist.', 'error');
    setTimeout(() => { window.location.href = 'login.html'; }, 1000);
    return;
  }

  try {
    await api.post('/wishlist', { productId: prodId });
    showNotification('Added to your Wishlist!', 'success');
  } catch (error) {
    showNotification(error.message || 'Item already in Wishlist!', 'error');
  }
}

function quickView(prodId) {
  window.location.href = `product-details.html?id=${prodId}`;
}
