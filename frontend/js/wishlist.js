/*
 * Wishlist.js - Live Database Wishlist Manager
 * Purpose: Loads saved product ObjectIds from database, dynamically builds wishlist grids, and coordinates cart transfers.
 */

document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('wishlist-items-grid');
  if (grid) {
    renderWishlist();
  }
});

async function renderWishlist() {
  const grid = document.getElementById('wishlist-items-grid');
  if (!grid) return;

  const token = localStorage.getItem('florish_token');
  if (!token) {
    grid.innerHTML = `
      <div class="text-center" style="grid-column: 1 / -1; padding: 4rem 2rem;">
        <span style="font-size: 3.5rem;">❤️</span>
        <p class="text-secondary" style="margin-top: 1rem; margin-bottom: var(--space-md);">Please login to view your wishlist collection!</p>
        <a href="login.html" class="btn btn-primary">Login to Account</a>
      </div>
    `;
    return;
  }

  try {
    const wishlist = await api.get('/wishlist');
    const baseServerUrl = API_BASE_URL.replace('/api', '');

    if (!wishlist.products || wishlist.products.length === 0) {
      grid.innerHTML = `
        <div class="text-center" style="grid-column: 1 / -1; padding: 4rem 2rem;">
          <span style="font-size: 3.5rem;">❤️</span>
          <p class="text-secondary" style="margin-top: 1rem; margin-bottom: var(--space-md);">Your wishlist is currently empty!</p>
          <a href="shop.html" class="btn btn-primary">Browse Floral Catalog</a>
        </div>
      `;
      return;
    }

    grid.innerHTML = '';
    
    wishlist.products.forEach(product => {
      if (!product) return;
      const id = product._id || product.id;

      const imageUrl = getSafeImageUrl(product.image, product.category, product.name);

      const card = document.createElement('div');
      card.className = 'product-card hover-lift animate-fade-in';
      card.innerHTML = `
        <div class="card-image-wrapper">
          <img src="${imageUrl}" alt="${product.name}" class="product-card-img" onerror="this.onerror=null; this.src=getSafeImageUrl(null, '${product.category}', '${product.name}');" />
        </div>
        <div class="card-content">
          <span class="card-category">${product.category}</span>
          <h3 class="card-title"><a href="product-details.html?id=${id}">${product.name}</a></h3>
          <div class="card-footer-price">
            <span class="price-current">${formatINR(product.price)}</span>
            <div style="display: flex; gap: 0.25rem;">
              <button class="btn btn-primary btn-sm" onclick="moveFromWishlistToCart('${id}')" ${product.stock === 0 ? 'disabled style="opacity: 0.6; cursor: not-allowed;"' : ''}>${product.stock === 0 ? 'Sold Out' : '🛒 Add'}</button>
              <button class="btn btn-outline btn-sm" style="padding: 0.4rem 0.6rem !important;" onclick="removeFromWishlist('${id}')" title="Remove">❌</button>
            </div>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });
  } catch (err) {
    console.error('Error rendering wishlist:', err);
    grid.innerHTML = '<p class="text-secondary text-center" style="grid-column: 1 / -1; padding: 2rem;">Could not load wishlist.</p>';
  }
}

async function removeFromWishlist(id) {
  try {
    await api.delete(`/wishlist/${id}`);
    showNotification('Item removed from wishlist.', 'success');
    renderWishlist();
  } catch (err) {
    console.error(err);
    showNotification('Failed to remove item.', 'error');
  }
}

async function moveFromWishlistToCart(id) {
  try {
    // Add to cart
    await api.post('/cart', { productId: id, quantity: 1 });
    
    // Remove from wishlist
    await api.delete(`/wishlist/${id}`);
    
    // Sync cart badge indicator cache
    let localCart = [];
    try {
      localCart = JSON.parse(localStorage.getItem('florish_cart')) || [];
      if (!Array.isArray(localCart)) localCart = [];
    } catch (e) {
      localCart = [];
    }
    const idx = localCart.findIndex(item => item.id === id);
    if (idx > -1) {
      localCart[idx].quantity += 1;
    } else {
      localCart.push({ id, quantity: 1 });
    }
    localStorage.setItem('florish_cart', JSON.stringify(localCart));
    if (typeof updateCartBadge === 'function') updateCartBadge();

    showNotification('Moved to your cart!', 'success');
    renderWishlist();
  } catch (err) {
    console.error(err);
    showNotification(err.message || 'Failed to move item to cart.', 'error');
  }
}
