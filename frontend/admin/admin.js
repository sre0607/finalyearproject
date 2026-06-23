/*
 * Admin.js - Backoffice Dashboard API Controller
 * Purpose: Handles backoffice security verification, stats updates, user list generation, and catalog revisions.
 */

// Verify logged user is Admin
let adminUser = null;
try {
  adminUser = JSON.parse(localStorage.getItem('florish_user'));
} catch (e) {
  adminUser = null;
}
const adminToken = localStorage.getItem('florish_token');

if (!adminToken || !adminUser || adminUser.role !== 'admin') {
  window.location.replace('login.html');
}

// Shared image helper definition for admin pages
function getSafeImageUrl(imageUrl, category, name, isCategory = false) {
  try {
    const cat = (category || '').toLowerCase().trim();
    
    // Resolve path prefix depending on if we are in admin subfolder
    const isSubDir = window.location.pathname.includes('/admin/');
    const pathPrefix = isSubDir ? '../' : '';

    let fallback = isCategory ? (pathPrefix + 'assets/fallbacks/default-category.jpg') : (pathPrefix + 'assets/fallbacks/default-product.jpg');
    
    if (cat === 'category') {
      fallback = pathPrefix + 'assets/fallbacks/default-category.jpg';
    } else if (cat.includes('bouquet') || cat === 'lilies' || cat === 'bouquets') {
      fallback = pathPrefix + 'assets/fallbacks/bouquets.jpg';
    } else if (cat.includes('combo') || cat === 'combos') {
      fallback = pathPrefix + 'assets/fallbacks/gift-combos.jpg';
    } else if (cat.includes('luxury') || cat === 'luxury') {
      fallback = pathPrefix + 'assets/fallbacks/luxury-arrangements.jpg';
    } else if (cat.includes('indoor') || cat === 'indoor') {
      fallback = pathPrefix + 'assets/fallbacks/indoor-plants.jpg';
    } else if (cat.includes('birthday') || cat === 'birthday') {
      fallback = pathPrefix + 'assets/fallbacks/birthday-flowers.jpg';
    } else if (cat.includes('anniversary') || cat === 'anniversary' || cat.includes('rose') || cat === 'roses') {
      fallback = pathPrefix + 'assets/fallbacks/anniversary-flowers.jpg';
    } else if (cat === 'default-category') {
      fallback = pathPrefix + 'assets/fallbacks/default-category.jpg';
    } else if (cat === 'default-product') {
      fallback = pathPrefix + 'assets/fallbacks/default-product.jpg';
    }

    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '';

    const reportDiagnostics = (statusText) => {
      if (isDev) {
        console.warn(`[DIAGNOSTICS] Image Load Failed:
Product/Category Name: ${name || 'N/A'}
Image URL: ${imageUrl || 'null'}
HTTP Status: ${statusText}
Fallback Used: ${fallback}`);
      }
    };

    if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim() === '' || imageUrl.includes('photo-broken-link')) {
      reportDiagnostics('null/empty/broken URL');
      return fallback;
    }

    const trimmed = imageUrl.trim();
    let resolvedUrl = trimmed;

    if (trimmed.startsWith('/uploads/') || trimmed.startsWith('uploads/')) {
      const base = trimmed.startsWith('/uploads/') ? trimmed : '/' + trimmed;
      const localCheck = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '' || window.location.hostname.startsWith('192.168.') || window.location.hostname.startsWith('10.') || window.location.hostname.startsWith('172.16.') || window.location.hostname.endsWith('.local') || window.location.hostname.includes('localhost');
      const fallbackUrl = localCheck ? 'http://localhost:5000/api' : 'https://finalproject-9pgj.onrender.com/api';
      const apiBase = window.API_BASE_URL || (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : fallbackUrl);
      const baseServerUrl = apiBase.replace('/api', '');
      resolvedUrl = `${baseServerUrl}${base}`;
    }

    // Perform async head check in background in dev mode to log HTTP status
    if (isDev && (resolvedUrl.startsWith('http://') || resolvedUrl.startsWith('https://'))) {
      fetch(resolvedUrl, { method: 'HEAD' })
        .then(res => {
          if (!res.ok) {
            reportDiagnostics(res.status);
          }
        })
        .catch(err => {
          reportDiagnostics(`Fetch error (${err.message})`);
        });
    }

    return resolvedUrl;
  } catch (err) {
    console.error('Error inside getSafeImageUrl:', err);
    const isSubDir = window.location.pathname.includes('/admin/');
    const pathPrefix = isSubDir ? '../' : '';
    return isCategory ? (pathPrefix + 'assets/fallbacks/default-category.jpg') : (pathPrefix + 'assets/fallbacks/default-product.jpg');
  }
}
window.getSafeImageUrl = getSafeImageUrl;

document.addEventListener('DOMContentLoaded', () => {
  // Dynamic Sidebar Injector
  const sidebar = document.querySelector('.admin-sidebar');
  if (sidebar) {
    const activePage = window.location.pathname.split('/').pop() || 'dashboard.html';
    sidebar.innerHTML = `
      <div class="admin-logo">🌱 Florish Admin</div>
      <nav class="admin-menu">
        <a href="dashboard.html" class="admin-menu-link ${activePage === 'dashboard.html' ? 'active' : ''}">📊 Dashboard</a>
        <a href="products.html" class="admin-menu-link ${activePage === 'products.html' ? 'active' : ''}">🌸 Inventory Items</a>
        <a href="add-product.html" class="admin-menu-link ${activePage === 'add-product.html' ? 'active' : ''}">➕ Add Product</a>
        <a href="categories.html" class="admin-menu-link ${activePage === 'categories.html' ? 'active' : ''}">🏷️ Categories</a>
        <a href="orders.html" class="admin-menu-link ${activePage === 'orders.html' ? 'active' : ''}">🛒 Client Orders</a>
        <a href="users.html" class="admin-menu-link ${activePage === 'users.html' ? 'active' : ''}">👥 User Accounts</a>
        <a href="reviews.html" class="admin-menu-link ${activePage === 'reviews.html' ? 'active' : ''}">💬 Feedback Reviews</a>
        <a href="promos.html" class="admin-menu-link ${activePage === 'promos.html' ? 'active' : ''}">🎟️ Coupon Codes</a>
        <a href="settings.html" class="admin-menu-link ${activePage === 'settings.html' ? 'active' : ''}">⚙️ Core Settings</a>
        <a href="../index.html" class="admin-menu-link" style="margin-top: 3rem;">🏠 Public Site</a>
      </nav>
    `;
  }

  // 1. Dashboard statistics loader
  const metricsSection = document.querySelector('.admin-metrics');
  if (metricsSection) {
    loadDashboardStats();
    initSalesReportExport();
  }

  // 2. Products inventory table loader
  const productsTable = document.querySelector('.admin-table tbody');
  const path = window.location.pathname;
  
  if (productsTable && path.includes('products.html')) {
    loadInventoryProducts();
  }

  // 3. User Accounts directory loader
  if (path.includes('users.html')) {
    loadCustomerDirectory();
    const searchBtn = document.getElementById('btn-search-users');
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        const query = document.getElementById('user-search-input').value;
        loadCustomerDirectory(query);
      });
    }
  }

  // 4. Client Orders tracker loader
  if (path.includes('orders.html')) {
    loadClientOrdersTracker();
    const reportBtn = document.getElementById('btn-orders-download-report');
    if (reportBtn) {
      reportBtn.addEventListener('click', openOrdersReportModal);
    }
    const searchBtn = document.getElementById('btn-search-orders');
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        const search = document.getElementById('order-search-input').value;
        const status = document.getElementById('order-status-filter').value;
        const archive = document.getElementById('order-archive-filter') ? document.getElementById('order-archive-filter').value : 'active';
        loadClientOrdersTracker(search, status, archive);
      });
    }
  }

  // 5. Categories Page Loader
  if (path.includes('categories.html')) {
    loadCategoriesList();
    const addCatBtn = document.getElementById('btn-add-category');
    if (addCatBtn) {
      addCatBtn.addEventListener('click', openAddCategoryModal);
    }
  }

  // 6. Promos Page Loader
  if (path.includes('promos.html')) {
    loadPromosList();
    const addPromoBtn = document.getElementById('btn-add-promo');
    if (addPromoBtn) {
      addPromoBtn.addEventListener('click', openAddPromoModal);
    }
  }

  // 7. Reviews Page Loader
  if (path.includes('reviews.html')) {
    loadReviewsList();
  }

  // 8. Add Product form handler
  const addForm = document.getElementById('admin-add-product-form');
  if (addForm) {
    addForm.addEventListener('submit', handleAddProductSubmit);
    setupAddProductValidation();
    
    // Add image source selector and preview listeners
    const imageSourceSelect = document.getElementById('add-prod-image-source');
    const imageFileInput = document.getElementById('add-prod-image');
    const imageUrlInput = document.getElementById('add-prod-image-url');
    const fileGroup = document.getElementById('add-image-file-group');
    const urlGroup = document.getElementById('add-image-url-group');
    const previewGroup = document.getElementById('add-image-preview-group');
    const previewContainer = document.getElementById('add-image-preview-container');
    const previewImg = document.getElementById('add-image-preview');

    if (imageSourceSelect && fileGroup && urlGroup) {
      imageSourceSelect.addEventListener('change', () => {
        const mode = imageSourceSelect.value;
        if (mode === 'upload') {
          fileGroup.style.display = 'block';
          urlGroup.style.display = 'none';
          imageFileInput.setAttribute('required', 'true');
          imageUrlInput.removeAttribute('required');
          imageUrlInput.value = '';
          
          if (imageFileInput.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
              previewImg.src = e.target.result;
              previewGroup.style.display = 'block';
            };
            reader.readAsDataURL(imageFileInput.files[0]);
          } else {
            previewGroup.style.display = 'none';
          }
        } else {
          fileGroup.style.display = 'none';
          urlGroup.style.display = 'block';
          imageUrlInput.setAttribute('required', 'true');
          imageFileInput.removeAttribute('required');
          imageFileInput.value = '';
          
          const urlVal = imageUrlInput.value.trim();
          if (urlVal && (urlVal.startsWith('http://') || urlVal.startsWith('https://'))) {
            previewImg.src = urlVal;
            previewGroup.style.display = 'block';
          } else {
            previewGroup.style.display = 'none';
          }
        }
        if (typeof validateAddProductForm === 'function') {
          validateAddProductForm();
        }
      });
    }

    if (imageFileInput && previewGroup && previewImg) {
      imageFileInput.addEventListener('change', () => {
        const file = imageFileInput.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            previewImg.src = e.target.result;
            previewGroup.style.display = 'block';
          };
          reader.readAsDataURL(file);
        } else {
          previewGroup.style.display = 'none';
        }
      });
    }

    if (imageUrlInput && previewGroup && previewImg) {
      const updateUrlPreview = () => {
        const urlVal = imageUrlInput.value.trim();
        if (urlVal && (urlVal.startsWith('http://') || urlVal.startsWith('https://'))) {
          previewImg.src = urlVal;
          previewGroup.style.display = 'block';
        } else {
          previewGroup.style.display = 'none';
        }
      };
      imageUrlInput.addEventListener('input', updateUrlPreview);
      imageUrlInput.addEventListener('change', updateUrlPreview);
    }
  }
  const addProdCatDropdown = document.getElementById('add-prod-cat');
  if (addProdCatDropdown && path.includes('add-product.html')) {
    populateCategoryDropdown(addProdCatDropdown);
  }

  // 9. Admin Logout Handler
  const logoutBtn = document.getElementById('admin-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('florish_token');
      localStorage.removeItem('florish_user');
      showNotification('Successfully logged out from backoffice.', 'success');
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 1000);
    });
  }
});

/**
 * Standard utility to show customized notification toast banners in backoffice
 */
function showNotification(msg, type = 'success') {
  const banner = document.createElement('div');
  banner.className = `form-alert form-alert-${type} animate-fade-in`;
  banner.style.position = 'fixed';
  banner.style.bottom = '20px';
  banner.style.right = '20px';
  banner.style.zIndex = '99999';
  banner.innerHTML = `<span>${type === 'success' ? '✔' : '✖'}</span> ${msg}`;

  document.body.appendChild(banner);

  setTimeout(() => {
    banner.remove();
  }, 4000);
}

/**
 * Fetch and bind statistics to Dashboard metrics
 */
async function loadDashboardStats() {
  try {
    const stats = await api.get('/admin/dashboard-stats');
    const metricCards = document.querySelectorAll('.metric-card');

    if (metricCards.length >= 6) {
      metricCards[0].querySelector('.metric-value').textContent = formatINR(stats.revenue);
      metricCards[1].querySelector('.metric-value').textContent = stats.orders;
      metricCards[2].querySelector('.metric-value').textContent = stats.users;
      metricCards[3].querySelector('.metric-value').textContent = stats.products;
      metricCards[4].querySelector('.metric-value').textContent = stats.pendingOrders;
      metricCards[5].querySelector('.metric-value').textContent = stats.lowStockCount;
    }

    // Dynamic Low Stock Alert Banner
    const lowStockProducts = stats.lowStockProducts || [];
    const metricsSection = document.querySelector('.admin-metrics');
    
    // Remove existing alerts if any
    const existingAlert = document.getElementById('admin-low-stock-alert');
    if (existingAlert) existingAlert.remove();
    const existingDeletedAlert = document.getElementById('admin-deleted-low-stock-alert');
    if (existingDeletedAlert) existingDeletedAlert.remove();

    if (metricsSection && lowStockProducts.length > 0) {
      const alertDiv = document.createElement('div');
      alertDiv.id = 'admin-low-stock-alert';
      alertDiv.className = 'admin-card animate-pulse';
      alertDiv.style.backgroundColor = 'hsl(38, 92%, 96%)';
      alertDiv.style.borderColor = 'var(--warning)';
      alertDiv.style.borderWidth = '1px';
      alertDiv.style.borderStyle = 'solid';
      alertDiv.style.color = 'hsl(38, 92%, 25%)';
      alertDiv.style.marginBottom = 'var(--space-lg)';
      alertDiv.style.padding = 'var(--space-md)';
      alertDiv.style.borderRadius = 'var(--radius-md)';
      alertDiv.style.width = '100%';
      
      const itemsList = lowStockProducts.map(p => `<strong>${p.name}</strong> (${p.stock} left)`).join(', ');
      alertDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem; text-align: left;">
          <span style="font-size: 1.25rem;">⚠️</span>
          <span><strong>Low Stock Warning:</strong> The following arrangements are running low: ${itemsList}. Please restock soon.</span>
        </div>
      `;
      metricsSection.parentNode.insertBefore(alertDiv, metricsSection);
    }

    // Populate top-selling products list
    const topList = document.getElementById('top-selling-list');
    if (topList) {
      topList.innerHTML = '';
      if (!stats.topProducts || stats.topProducts.length === 0) {
        topList.innerHTML = '<li style="padding: 1rem 0; color: var(--text-muted); text-align: center;">No sales data available.</li>';
      } else {
        stats.topProducts.forEach(prod => {
          const li = document.createElement('li');
          li.style.padding = '0.75rem 0';
          li.style.borderBottom = '1px solid var(--border-color)';
          li.style.display = 'flex';
          li.style.justifyContent = 'space-between';
          li.style.alignItems = 'center';
          li.innerHTML = `
            <div>
              <span style="font-weight: 600; color: var(--primary);">${prod.name}</span>
              <div style="font-size: 0.8rem; color: var(--text-muted);">${formatINR(prod.price)} each</div>
            </div>
            <span class="badge badge-success" style="font-size: 0.85rem; padding: 0.25rem 0.5rem;">${prod.totalSold} sold</span>
          `;
          topList.appendChild(li);
        });
      }
    }

    // Populate recent orders in dashboard
    const tbody = document.querySelector('.admin-table tbody');
    if (tbody) {
      tbody.innerHTML = '';

      const orders = stats.latestOrders || [];
      if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No transactions recorded yet.</td></tr>';
        return;
      }

      orders.forEach(order => {
        const id = order._id.substring(order._id.length - 6).toUpperCase();
        const items = order.items.map(i => `${i.name} x${i.quantity}`).join(', ');
        
        let statusClass = 'badge-pending';
        if (order.orderStatus === 'Delivered') statusClass = 'badge-success';
        else if (order.orderStatus === 'Shipped') statusClass = 'badge-success';
        else if (order.orderStatus === 'Cancelled') statusClass = 'badge-error';

        const row = document.createElement('tr');
        row.innerHTML = `
          <td>#${id}</td>
          <td>${order.user ? order.user.name : 'Guest'}</td>
          <td>${items}</td>
          <td>${formatINR(order.totalPrice)}</td>
          <td><span class="admin-badge ${statusClass}">${order.orderStatus}</span></td>
          <td><button class="btn btn-outline btn-sm" onclick="openAdminOrderModal('${order._id}')">Details</button></td>
        `;
        tbody.appendChild(row);
      });
    }
  } catch (err) {
    console.error('Error loading dashboard stats:', err);
  }
}

/**
 * Fetch and bind products list to inventory table view
 */
async function loadInventoryProducts() {
  const tbody = document.querySelector('.admin-table tbody');
  if (!tbody) return;

  try {
    const products = await api.get('/admin/products');
    const baseServerUrl = API_BASE_URL.replace('/api', '');
    tbody.innerHTML = '';

    if (products.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">Inventory catalog is currently empty.</td></tr>';
      return;
    }

    products.forEach(p => {
      let imageUrl;
      try {
        imageUrl = typeof getSafeImageUrl === 'function' 
          ? getSafeImageUrl(p.image, p.category, p.name) 
          : '../assets/fallbacks/default-product.jpg';
      } catch (err) {
        console.error('Error resolving image URL for product:', p.name, err);
        imageUrl = '../assets/fallbacks/default-product.jpg';
      }

      const row = document.createElement('tr');
      row.innerHTML = `
        <td><img src="${imageUrl}" style="width: 50px; height: 50px; object-fit: cover; border-radius: var(--radius-sm);" onerror="this.onerror=null; this.src=(typeof getSafeImageUrl === 'function') ? getSafeImageUrl(null, '${p.category ? p.category.replace(/'/g, "\\'") : ''}', '${p.name ? p.name.replace(/'/g, "\\'") : ''}') : '../assets/fallbacks/default-product.jpg';" /></td>
        <td>${p.sku}</td>
        <td>
          <div style="font-weight: 600;">${p.name}</div>
          <div style="margin-top: 4px; display: flex; gap: 4px;">
            ${p.isFeatured ? '<span style="background: var(--primary); color: white; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px;">Featured</span>' : ''}
            ${p.isHidden ? '<span style="background: var(--error); color: white; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px;">Hidden</span>' : '<span style="background: #28a745; color: white; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px;">Visible</span>'}
          </div>
        </td>
        <td>${p.category}</td>
        <td>${formatINR(p.price)}</td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="openEditProductModal('${p._id}', '${p.name.replace(/'/g, "\\'").replace(/"/g, '&quot;')}', '${p.sku}', '${p.category}', ${p.price}, ${p.stock || 10}, '${p.description.replace(/'/g, "\\'").replace(/"/g, '&quot;')}', ${p.isFeatured || false}, ${p.isHidden || false}, '${p.image || ''}')">Edit</button>
          <button class="btn btn-outline btn-sm" style="color: var(--error); border-color: var(--error);" onclick="confirmDeleteProduct('${p._id}')">Delete</button>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error('Error loading inventory:', err);
    tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="color:var(--error);">Failed to load inventory.</td></tr>';
  }
}

/**
 * Fetch and list users in customer directory view
 */
async function loadCustomerDirectory(searchQuery = '') {
  const tbody = document.querySelector('.admin-table tbody');
  if (!tbody) return;

  try {
    const endpoint = searchQuery ? `/admin/users?search=${encodeURIComponent(searchQuery)}` : '/admin/users';
    const users = await api.get(endpoint);
    tbody.innerHTML = '';

    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center">No registered customers match your query.</td></tr>';
      return;
    }

    users.forEach(u => {
      const date = new Date(u.createdAt).toLocaleDateString();
      const roleBadge = u.role === 'admin'
        ? `<span class="admin-badge" style="background-color: hsl(var(--primary-hue), 50%, 85%); color: var(--primary);">Admin</span>`
        : `<span class="admin-badge" style="background-color: hsl(210, 16%, 90%); color: var(--text-secondary);">Customer</span>`;

      const statusBadge = u.isActive === false
        ? `<span class="admin-badge badge-danger">Blocked</span>`
        : `<span class="admin-badge badge-success">Active</span>`;

      const toggleActionText = u.isActive === false ? 'Unblock' : 'Block';
      const toggleActionColor = u.isActive === false ? 'var(--success)' : 'var(--error)';

      const actionBtn = u.role === 'admin'
        ? `<button class="btn btn-outline btn-sm" disabled style="opacity: 0.5;">System Lock</button>`
        : `<button class="btn btn-outline btn-sm" style="color: ${toggleActionColor}; border-color: ${toggleActionColor};" onclick="toggleUserActivation('${u._id}', '${u.name.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')">${toggleActionText}</button>
           <button class="btn btn-outline btn-sm" onclick="viewUserOrderHistory('${u._id}', '${u.name.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')">Orders</button>
           <button class="btn btn-outline btn-sm" style="color: var(--error); border-color: var(--error); background-color: transparent;" onclick="deleteUserAccount('${u._id}', '${u.name.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')">Delete</button>`;

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${u.name}</td>
        <td>${u.email}</td>
        <td>${roleBadge}</td>
        <td>${statusBadge}</td>
        <td>${actionBtn}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error('Error loading users:', err);
    tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="color:var(--error);">Failed to load customer directory.</td></tr>';
  }
}

/**
 * Fetch and list client transactions in orders tracker view
 */
async function loadClientOrdersTracker(searchQuery = '', statusQuery = '', archiveFilter = 'active') {
  const tbody = document.querySelector('.admin-table tbody');
  if (!tbody) return;

  try {
    let endpoint = '/admin/orders';
    const params = [];
    if (searchQuery) params.push(`search=${encodeURIComponent(searchQuery)}`);
    if (statusQuery) params.push(`status=${encodeURIComponent(statusQuery)}`);
    if (archiveFilter) params.push(`archiveFilter=${encodeURIComponent(archiveFilter)}`);
    if (params.length > 0) endpoint += `?${params.join('&')}`;

    const orders = await api.get(endpoint);
    tbody.innerHTML = '';

    if (orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">No orders match your filter query.</td></tr>';
      return;
    }

    // Sort orders newest first
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    orders.forEach(o => {
      const orderId = o._id;
      const displayId = orderId.substring(orderId.length - 6).toUpperCase();
      const client = o.user ? o.user.name : 'Guest';
      const items = o.items.map(i => `${i.name} x${i.quantity}`).join(', ');

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>#${displayId}</td>
        <td>${client}</td>
        <td>${items}</td>
        <td>${formatINR(o.totalPrice)}</td>
        <td>
          <select class="form-control" style="width: auto; padding: 0.25rem 0.5rem;" onchange="handleUpdateOrderStatus('${orderId}', this.value)">
            <option value="Processing" ${o.orderStatus === 'Processing' ? 'selected' : ''}>Processing</option>
            <option value="Shipped" ${o.orderStatus === 'Shipped' ? 'selected' : ''}>Shipped</option>
            <option value="Delivered" ${o.orderStatus === 'Delivered' ? 'selected' : ''}>Delivered</option>
            <option value="Cancelled" ${o.orderStatus === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
          </select>
        </td>
        <td>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <button class="btn btn-outline btn-sm" style="padding: 0.25rem 0.5rem;" onclick="openAdminOrderModal('${orderId}')">Details</button>
            ${!o.archived ? `<button class="btn btn-outline btn-sm" style="padding: 0.25rem 0.5rem; color: var(--error); border-color: var(--error);" onclick="archiveAdminOrder('${orderId}')">Archive</button>` : ''}
            <button class="btn btn-primary btn-sm" style="padding: 0.25rem 0.5rem;" onclick="downloadAdminInvoice('${orderId}', this)">📄 PDF</button>
          </div>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error('Error loading orders tracker:', err);
    tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="color:var(--error);">Failed to load orders tracker.</td></tr>';
  }
}

async function archiveAdminOrder(orderId) {
  const confirmArchive = confirm("Archive this order?\nThe order will be hidden from active orders but retained for reporting and audit purposes.");
  if (!confirmArchive) return;

  try {
    const res = await api.patch(`/admin/orders/${orderId}/archive`);
    if (res.success || res.order) {
      if (typeof showNotification === 'function') {
        showNotification('Order successfully archived.', 'success');
      } else {
        alert('Order successfully archived.');
      }
      const search = document.getElementById('order-search-input') ? document.getElementById('order-search-input').value : '';
      const status = document.getElementById('order-status-filter') ? document.getElementById('order-status-filter').value : '';
      const archive = document.getElementById('order-archive-filter') ? document.getElementById('order-archive-filter').value : 'active';
      loadClientOrdersTracker(search, status, archive);
    } else {
      if (typeof showNotification === 'function') {
        showNotification('Failed to archive order.', 'error');
      } else {
        alert('Failed to archive order.');
      }
    }
  } catch (err) {
    console.error('Error archiving order:', err);
    if (typeof showNotification === 'function') {
      showNotification(err.message || 'Error archiving order.', 'error');
    } else {
      alert(err.message || 'Error archiving order.');
    }
  }
}
window.archiveAdminOrder = archiveAdminOrder;

/**
 * Handle new product creation form submits
 */
async function handleAddProductSubmit(e) {
  e.preventDefault();
  
  const form = document.getElementById('admin-add-product-form');
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn ? submitBtn.textContent : 'Save & Publish';

  const name = document.getElementById('add-prod-name').value.trim();
  const sku = document.getElementById('add-prod-sku').value.trim();
  const category = document.getElementById('add-prod-cat').value;
  const priceVal = document.getElementById('add-prod-price').value.trim();
  const stockVal = document.getElementById('add-prod-stock').value.trim();
  const description = document.getElementById('add-prod-desc').value.trim();

  if (!name || !sku || !category || !priceVal || !stockVal) {
    showNotification('All required fields must be completed.', 'error');
    return;
  }

  if (name.length < 2 || name.length > 50) {
    showNotification('Product name must be between 2 and 50 characters.', 'error');
    return;
  }

  if (/<script/i.test(name) || /<script/i.test(description) || /<script/i.test(sku)) {
    showNotification('Script injection is not allowed.', 'error');
    return;
  }

  const price = Number(priceVal);
  if (isNaN(price) || price <= 0) {
    showNotification('Product price must be a positive number only.', 'error');
    return;
  }

  const stock = Number(stockVal);
  if (isNaN(stock) || !Number.isInteger(stock) || stock < 0) {
    showNotification('Product stock level must be a non-negative integer.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('name', name);
  formData.append('sku', sku);
  formData.append('category', category);
  formData.append('price', price);
  formData.append('stock', stock);
  formData.append('description', description);
  formData.append('isFeatured', document.getElementById('add-prod-featured').checked);
  formData.append('isHidden', document.getElementById('add-prod-hidden').checked);

  const imageSourceSelect = document.getElementById('add-prod-image-source');
  const imageSource = imageSourceSelect ? imageSourceSelect.value : 'upload';

  if (imageSource === 'upload') {
    const fileInput = document.getElementById('add-prod-image');
    if (fileInput && fileInput.files[0]) {
      formData.append('image', fileInput.files[0]);
    } else {
      showNotification('Product image is required.', 'error');
      return;
    }
  } else {
    const urlInput = document.getElementById('add-prod-image-url');
    const imageUrl = urlInput ? urlInput.value.trim() : '';
    if (imageUrl) {
      formData.append('image', imageUrl);
    } else {
      showNotification('Product image URL is required.', 'error');
      return;
    }
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Publishing...';
  }

  try {
    await api.upload('/admin/products', formData);
    showNotification('Product arrangement successfully added and published to the catalog!', 'success');
    form.reset();
    const previewContainer = document.getElementById('add-image-preview-group');
    if (previewContainer) previewContainer.style.display = 'none';
  } catch (err) {
    console.error(err);
    showNotification(err.message || 'Failed to publish new arrangement.', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }
}

/**
 * Confirm delete product via visual modal prompt
 */
function confirmDeleteProduct(productId) {
  // Build and show dynamically injected confirmation modal
  const modalDiv = document.createElement('div');
  modalDiv.id = 'admin-delete-modal';
  modalDiv.style.position = 'fixed';
  modalDiv.style.top = '0';
  modalDiv.style.left = '0';
  modalDiv.style.width = '100vw';
  modalDiv.style.height = '100vh';
  modalDiv.style.backgroundColor = 'rgba(0,0,0,0.5)';
  modalDiv.style.display = 'flex';
  modalDiv.style.alignItems = 'center';
  modalDiv.style.justifyContent = 'center';
  modalDiv.style.zIndex = '99999';

  modalDiv.innerHTML = `
    <div class="admin-card" style="width: 100%; max-width: 400px; margin: 1rem; padding: var(--space-xl); background: var(--surface-color); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); text-align: center;">
      <h3 style="color: var(--error); margin-bottom: var(--space-md);">Confirm Deletion</h3>
      <p style="margin-bottom: var(--space-lg); font-size: 0.95rem;">Are you sure you want to permanently delete this product from the inventory catalog?</p>
      <div style="display: flex; gap: var(--space-md); justify-content: center;">
        <button class="btn btn-outline" style="min-width: 100px;" onclick="document.getElementById('admin-delete-modal').remove()">Cancel</button>
        <button class="btn btn-secondary" style="background-color: var(--error); color: white; min-width: 100px;" id="btn-confirm-delete">Delete</button>
      </div>
    </div>
  `;

  document.body.appendChild(modalDiv);

  document.getElementById('btn-confirm-delete').addEventListener('click', async () => {
    try {
      await api.delete(`/admin/products/${productId}`);
      showNotification('Product successfully removed from catalog!', 'success');
      modalDiv.remove();
      loadInventoryProducts();
    } catch (err) {
      console.error(err);
      showNotification(err.message || 'Failed to remove product.', 'error');
      modalDiv.remove();
    }
  });
}

/**
 * Handle changing order status parameters
 */
async function handleUpdateOrderStatus(orderId, newStatus) {
  try {
    await api.put(`/admin/orders/${orderId}/status`, { status: newStatus });
    showNotification(`Order delivery status updated to ${newStatus}!`, 'success');
    
    // Reload tracking trackers if in orders tracker view
    const productsTable = document.querySelector('.admin-table tbody');
    if (productsTable && window.location.pathname.includes('orders.html')) {
      loadClientOrdersTracker();
    } else {
      loadDashboardStats();
    }
  } catch (err) {
    console.error(err);
    showNotification(err.message || 'Failed to update order status.', 'error');
  }
}

/**
 * Open admin-specific modal detail view for recipient shipping parameters and invoice calculations
 */
async function openAdminOrderModal(orderId) {
  const modalDiv = document.createElement('div');
  modalDiv.id = 'admin-order-modal';
  modalDiv.style.position = 'fixed';
  modalDiv.style.top = '0';
  modalDiv.style.left = '0';
  modalDiv.style.width = '100vw';
  modalDiv.style.height = '100vh';
  modalDiv.style.backgroundColor = 'rgba(0,0,0,0.5)';
  modalDiv.style.display = 'flex';
  modalDiv.style.alignItems = 'center';
  modalDiv.style.justifyContent = 'center';
  modalDiv.style.zIndex = '99999';
  
  modalDiv.innerHTML = `
    <div class="admin-card" style="width: 100%; max-width: 550px; margin: 1rem; padding: var(--space-xl); position: relative; background: var(--surface-color); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);">
      <button style="position: absolute; top: var(--space-md); right: var(--space-md); font-size: 1.5rem; cursor: pointer; color: var(--text-secondary);" onclick="document.getElementById('admin-order-modal').remove()">✖</button>
      <h2 style="margin-bottom: var(--space-md); color: var(--primary); font-size: 1.35rem;">Order Invoice Specs</h2>
      <div id="admin-order-modal-body">
        <div class="text-center" style="padding: 2rem 0;">
          <div style="display: inline-block; width: 30px; height: 30px;" class="spinner"></div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modalDiv);
  
  try {
    const order = await api.get(`/orders/${orderId}`);
    const formattedId = order._id.substring(order._id.length - 6).toUpperCase();
    const date = new Date(order.createdAt).toLocaleDateString();
    
    let subtotal = 0;
    let itemsHtml = order.items.map(i => {
      const itemTotal = i.price * i.quantity;
      subtotal += itemTotal;
      return `
        <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:0.25rem;">
          <span>${i.name} <strong>x${i.quantity}</strong></span>
          <strong>${formatINR(itemTotal)}</strong>
        </div>
      `;
    }).join('');

    let discountHtml = '';
    if (order.discountPrice > 0) {
      discountHtml = `
        <div style="font-size: 0.85rem; display: flex; justify-content: space-between; color: var(--success); font-weight: 600;">
          <span>Discount (${order.promoCode || 'PROMO'})</span>
          <span>-${formatINR(order.discountPrice)}</span>
        </div>
      `;
    }

    // Compute expected delivery date range
    const dStart = new Date(order.createdAt);
    dStart.setDate(dStart.getDate() + 2);
    const dEnd = new Date(order.createdAt);
    dEnd.setDate(dEnd.getDate() + 4);
    const estRange = `${dStart.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})} - ${dEnd.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}`;
    
    document.getElementById('admin-order-modal-body').innerHTML = `
      <div style="font-size: 0.85rem; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; text-align: left;">
        <p>Order Reference: <strong>#FL-${formattedId}</strong></p>
        <p>Order Status: <strong>${order.orderStatus}</strong></p>
        <p>Date Placed: <strong>${date}</strong></p>
      </div>
      
      <div style="grid-template-columns: 1fr 1fr; display: grid; gap: var(--space-md); text-align: left; margin-bottom: 1rem;">
        <div>
          <h4 style="font-family: var(--font-primary); font-size: 0.85rem; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 0.25rem;">Recipient Address</h4>
          <p style="font-size:0.85rem; font-weight:500;">${order.shippingAddress.firstName} ${order.shippingAddress.lastName}</p>
          <p style="font-size:0.8rem; color:var(--text-secondary);">${order.shippingAddress.address}</p>
          <p style="font-size:0.8rem; color:var(--text-secondary);">${order.shippingAddress.city} - ${order.shippingAddress.pincode}</p>
          <p style="font-size:0.8rem; color:var(--text-secondary); margin-top:0.25rem;">📞 ${order.shippingAddress.phone}</p>
          <p style="font-size:0.8rem; color:var(--text-secondary);">✉ ${order.shippingAddress.email}</p>
          <p style="font-size:0.8rem; color:var(--primary); font-weight: 600; margin-top:0.5rem;">Est. Delivery: ${estRange}</p>
        </div>
        <div>
          <h4 style="font-family: var(--font-primary); font-size: 0.85rem; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 0.25rem;">Payment Info</h4>
          <p style="font-size:0.85rem; font-weight:600; text-transform: uppercase; color: var(--primary);">${order.paymentMethod === 'cod' ? 'Cash on Delivery (COD)' : 'Card / UPI Instant'}</p>
          <p style="font-size:0.8rem; color:var(--text-secondary); margin-top:0.5rem; text-transform: capitalize;">Status: <strong>${order.paymentStatus}</strong></p>
        </div>
      </div>

      <div style="background-color: var(--bg-color); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: var(--space-md); text-align: left;">
        <h4 style="font-family: var(--font-primary); font-size: 0.8rem; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 0.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.25rem;">Invoice Breakdown</h4>
        ${itemsHtml}
        <div style="border-top: 1px dashed var(--border-color); margin-top: 0.5rem; padding-top: 0.5rem; font-size: 0.85rem; display: flex; justify-content: space-between; color: var(--text-secondary);">
          <span>Subtotal</span>
          <span>${formatINR(subtotal)}</span>
        </div>
        ${discountHtml}
        <div style="font-size: 0.85rem; display: flex; justify-content: space-between; color: var(--text-secondary);">
          <span>Shipping</span>
          <span>${order.shippingPrice === 0 ? 'Free' : formatINR(order.shippingPrice)}</span>
        </div>
        <div style="font-size: 0.85rem; display: flex; justify-content: space-between; color: var(--text-secondary);">
          <span>Taxes (8%)</span>
          <span>${formatINR(order.taxPrice)}</span>
        </div>
        <div style="border-top: 1px solid var(--border-color); margin-top: 0.5rem; padding-top: 0.5rem; font-size: 1.05rem; font-weight: 700; color: var(--primary); display: flex; justify-content: space-between;">
          <span>Total Price</span>
          <span>${formatINR(order.totalPrice)}</span>
        </div>
      </div>
      <div style="margin-top: 1.5rem; text-align: right;">
        <button id="btn-admin-download-invoice" class="btn btn-primary" style="padding: 0.5rem 1.25rem;" onclick="downloadAdminInvoice('${order._id}', this)">
          📄 Download Invoice PDF
        </button>
      </div>
    `;
  } catch (err) {
    console.error(err);
    document.getElementById('admin-order-modal-body').innerHTML = `<p style="color:var(--error); font-size:0.9rem;">Failed to retrieve order specs.</p>`;
  }
}

/**
 * Edit Product modal builder
 */
function openEditProductModal(id, name, sku, category, price, stock, desc, isFeatured = false, isHidden = false, currentImage = '') {
  // Build and show dynamically injected dialog modal to preserve CSS stylesheets
  const modalDiv = document.createElement('div');
  modalDiv.id = 'admin-edit-modal';
  modalDiv.style.position = 'fixed';
  modalDiv.style.top = '0';
  modalDiv.style.left = '0';
  modalDiv.style.width = '100vw';
  modalDiv.style.height = '100vh';
  modalDiv.style.backgroundColor = 'rgba(0,0,0,0.5)';
  modalDiv.style.display = 'flex';
  modalDiv.style.alignItems = 'center';
  modalDiv.style.justifyContent = 'center';
  modalDiv.style.zIndex = '99999';

  const baseServerUrl = API_BASE_URL.replace('/api', '');
  const isUrlMode = currentImage && (currentImage.startsWith('http://') || currentImage.startsWith('https://'));

  modalDiv.innerHTML = `
    <div class="admin-card" style="width: 100%; max-width: 600px; margin: 1rem; padding: var(--space-xl); position: relative; background: var(--surface-color); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); text-align: left;">
      <button style="position: absolute; top: var(--space-md); right: var(--space-md); font-size: 1.5rem; cursor: pointer; color: var(--text-secondary);" onclick="document.getElementById('admin-edit-modal').remove()">✖</button>
      <h2 style="margin-bottom: var(--space-md); color: var(--primary); font-size: 1.35rem;">Update Product Specifications</h2>
      <form id="admin-edit-product-form">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md);">
          <div class="form-group">
            <label class="form-label">Product Name</label>
            <input type="text" id="edit-prod-name" class="form-control" value="${name}" required />
          </div>
          <div class="form-group">
            <label class="form-label">SKU Code</label>
            <input type="text" id="edit-prod-sku" class="form-control" value="${sku}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Category</label>
            <select id="edit-prod-cat" class="form-control" required>
              <option value="">Loading categories...</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Price ($)</label>
            <input type="number" step="0.01" id="edit-prod-price" class="form-control" value="${price}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Stock levels</label>
            <input type="number" id="edit-prod-stock" class="form-control" min="0" step="1" value="${stock}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Image Source</label>
            <select id="edit-prod-image-source" class="form-control">
              <option value="upload" ${!isUrlMode ? 'selected' : ''}>Upload from device</option>
              <option value="url" ${isUrlMode ? 'selected' : ''}>Paste image URL</option>
            </select>
          </div>
          <div class="form-group" id="edit-image-file-group" style="${!isUrlMode ? '' : 'display: none;'}">
            <label class="form-label">Replace Image File</label>
            <input type="file" id="edit-prod-image" class="form-control" style="padding: 0.25rem;" accept="image/*" />
          </div>
          <div class="form-group" id="edit-image-url-group" style="${isUrlMode ? '' : 'display: none;'}">
            <label class="form-label">Image URL</label>
            <input type="url" id="edit-prod-image-url" class="form-control" placeholder="https://example.com/image.jpg" value="${isUrlMode ? currentImage : ''}" />
          </div>
          <div class="form-group" id="edit-image-preview-group" style="grid-column: span 2; ${currentImage ? 'display: block;' : 'display: none;'} margin-top: -10px;">
            <label class="form-label">Image Preview</label>
            <div id="edit-image-preview-container" style="margin-top: 8px;">
              <img id="edit-image-preview" src="${(typeof getSafeImageUrl === 'function') ? getSafeImageUrl(currentImage, category, name) : '../assets/fallbacks/default-product.jpg'}" style="max-height: 80px; border-radius: 4px; border: 1px solid var(--border-color); object-fit: cover;" onerror="this.onerror=null; this.src=(typeof getSafeImageUrl === 'function') ? getSafeImageUrl(null, '${category ? category.replace(/'/g, "\\'") : ''}', '${name ? name.replace(/'/g, "\\'") : ''}') : '../assets/fallbacks/default-product.jpg';" />
            </div>
          </div>
          <div class="form-group" style="display: flex; gap: var(--space-md); align-items: center; height: 100%; margin-top: 1.5rem;">
            <label style="display: flex; align-items: center; gap: 6px; font-weight: 500; cursor: pointer;">
              <input type="checkbox" id="edit-prod-featured" ${isFeatured ? 'checked' : ''} /> Featured
            </label>
            <label style="display: flex; align-items: center; gap: 6px; font-weight: 500; cursor: pointer;">
              <input type="checkbox" id="edit-prod-hidden" ${isHidden ? 'checked' : ''} /> Hidden
            </label>
          </div>
          <div class="form-group" style="grid-column: span 2;">
            <label class="form-label">Description</label>
            <textarea id="edit-prod-desc" class="form-control" rows="3" required>${desc}</textarea>
          </div>
        </div>
        <button type="submit" class="btn btn-primary" style="margin-top: var(--space-md); width:100%;">Save Specifications</button>
      </form>
    </div>
  `;

  document.body.appendChild(modalDiv);
  populateCategoryDropdown(document.getElementById('edit-prod-cat'), category);

  const editImageSourceSelect = document.getElementById('edit-prod-image-source');
  const editFileInput = document.getElementById('edit-prod-image');
  const editImageUrlInput = document.getElementById('edit-prod-image-url');
  const editFileGroup = document.getElementById('edit-image-file-group');
  const editUrlGroup = document.getElementById('edit-image-url-group');
  const editPreviewGroup = document.getElementById('edit-image-preview-group');
  const editPreviewImg = document.getElementById('edit-image-preview');

  if (editImageSourceSelect && editFileGroup && editUrlGroup) {
    editImageSourceSelect.addEventListener('change', () => {
      const mode = editImageSourceSelect.value;
      if (mode === 'upload') {
        editFileGroup.style.display = 'block';
        editUrlGroup.style.display = 'none';
        
        if (editFileInput.files[0]) {
          const reader = new FileReader();
          reader.onload = (e) => {
            editPreviewImg.src = e.target.result;
            editPreviewGroup.style.display = 'block';
          };
          reader.readAsDataURL(editFileInput.files[0]);
        } else if (currentImage && !currentImage.startsWith('http://') && !currentImage.startsWith('https://')) {
          editPreviewImg.src = baseServerUrl + currentImage;
          editPreviewGroup.style.display = 'block';
        } else {
          editPreviewGroup.style.display = 'none';
        }
      } else {
        editFileGroup.style.display = 'none';
        editUrlGroup.style.display = 'block';
        
        const urlVal = editImageUrlInput.value.trim();
        if (urlVal && (urlVal.startsWith('http://') || urlVal.startsWith('https://'))) {
          editPreviewImg.src = urlVal;
          editPreviewGroup.style.display = 'block';
        } else if (currentImage && (currentImage.startsWith('http://') || currentImage.startsWith('https://'))) {
          editPreviewImg.src = currentImage;
          editPreviewGroup.style.display = 'block';
        } else {
          editPreviewGroup.style.display = 'none';
        }
      }
      validateEditProductForm();
    });
  }

  if (editFileInput && editPreviewGroup && editPreviewImg) {
    editFileInput.addEventListener('change', () => {
      const file = editFileInput.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          editPreviewImg.src = e.target.result;
          editPreviewGroup.style.display = 'block';
        };
        reader.readAsDataURL(file);
      } else {
        if (currentImage && editImageSourceSelect.value === 'upload') {
          editPreviewImg.src = currentImage.startsWith('http') ? currentImage : baseServerUrl + currentImage;
          editPreviewGroup.style.display = 'block';
        } else {
          editPreviewGroup.style.display = 'none';
        }
      }
    });
  }

  if (editImageUrlInput && editPreviewGroup && editPreviewImg) {
    const updateEditUrlPreview = () => {
      const urlVal = editImageUrlInput.value.trim();
      if (urlVal && (urlVal.startsWith('http://') || urlVal.startsWith('https://'))) {
        editPreviewImg.src = urlVal;
        editPreviewGroup.style.display = 'block';
      } else {
        if (currentImage && editImageSourceSelect.value === 'url') {
          editPreviewImg.src = currentImage;
          editPreviewGroup.style.display = 'block';
        } else {
          editPreviewGroup.style.display = 'none';
        }
      }
    };
    editImageUrlInput.addEventListener('input', updateEditUrlPreview);
    editImageUrlInput.addEventListener('change', updateEditUrlPreview);
  }

  const nameEl = document.getElementById('edit-prod-name');
  const skuEl = document.getElementById('edit-prod-sku');
  const catEl = document.getElementById('edit-prod-cat');
  const priceEl = document.getElementById('edit-prod-price');
  const stockEl = document.getElementById('edit-prod-stock');
  const descEl = document.getElementById('edit-prod-desc');
  const editForm = document.getElementById('admin-edit-product-form');
  const editSubmitBtn = editForm.querySelector('button[type="submit"]');

  const validateEditProductForm = () => {
    let isValid = true;
    if (nameEl) {
      const val = nameEl.value.trim();
      if (!val || val.length < 3 || val.length > 100 || /<script/i.test(val)) isValid = false;
    }
    if (skuEl) {
      const val = skuEl.value.trim();
      if (!val || /<script/i.test(val)) isValid = false;
    }
    if (catEl && !catEl.value) isValid = false;
    if (priceEl) {
      const price = Number(priceEl.value.trim());
      if (isNaN(price) || price <= 0) isValid = false;
    }
    if (stockEl) {
      const stock = Number(stockEl.value.trim());
      if (isNaN(stock) || !Number.isInteger(stock) || stock < 0) isValid = false;
    }

    const mode = editImageSourceSelect ? editImageSourceSelect.value : 'upload';
    if (mode === 'url') {
      const val = editImageUrlInput ? editImageUrlInput.value.trim() : '';
      if (!val || !isValidDirectImageUrl(val).valid) {
        isValid = false;
      }
    } else {
      if (editFileInput && editFileInput.files[0]) {
        if (!/\.(jpg|jpeg|png|webp)$/i.test(editFileInput.files[0].name)) isValid = false;
      }
    }

    if (descEl && descEl.value.trim().length < 10) isValid = false;

    if (editSubmitBtn) editSubmitBtn.disabled = !isValid;
  };

  const validateField = (inputEl) => {
    if (!inputEl) return;
    const val = inputEl.value.trim();
    if (inputEl === nameEl) {
      if (!val) {
        showInlineError(nameEl, 'Product name is required.');
      } else if (val.length < 3 || val.length > 100) {
        showInlineError(nameEl, 'Product name must be between 3 and 100 characters.');
      } else if (/<script/i.test(val)) {
        showInlineError(nameEl, 'Script injection is not allowed.');
      } else {
        clearInlineError(nameEl);
      }
    } else if (inputEl === skuEl) {
      if (!val) {
        showInlineError(skuEl, 'SKU code is required.');
      } else if (/<script/i.test(val)) {
        showInlineError(skuEl, 'Script injection is not allowed.');
      } else {
        clearInlineError(skuEl);
      }
    } else if (inputEl === priceEl) {
      const p = Number(val);
      if (!val) {
        showInlineError(priceEl, 'Price is required.');
      } else if (isNaN(p) || p <= 0) {
        showInlineError(priceEl, 'Price must be a positive number greater than 0.');
      } else {
        clearInlineError(priceEl);
      }
    } else if (inputEl === stockEl) {
      const s = Number(val);
      if (!val) {
        showInlineError(stockEl, 'Stock level is required.');
      } else if (isNaN(s) || !Number.isInteger(s) || s < 0) {
        showInlineError(stockEl, 'Stock must be a non-negative integer.');
      } else {
        clearInlineError(stockEl);
      }
    } else if (inputEl === editFileInput) {
      const mode = editImageSourceSelect ? editImageSourceSelect.value : 'upload';
      if (mode === 'upload' && editFileInput.files[0]) {
        if (!/\.(jpg|jpeg|png|webp)$/i.test(editFileInput.files[0].name)) {
          showInlineError(editFileInput, 'Image must be a valid format (JPG, JPEG, PNG, WEBP).');
        } else {
          clearInlineError(editFileInput);
        }
      } else {
        clearInlineError(editFileInput);
      }
    } else if (inputEl === editImageUrlInput) {
      const mode = editImageSourceSelect ? editImageSourceSelect.value : 'upload';
      if (mode === 'url') {
        const check = isValidDirectImageUrl(val);
        if (!val) {
          showInlineError(editImageUrlInput, 'Image URL is required.');
        } else if (!check.valid) {
          showInlineError(editImageUrlInput, check.reason);
        } else {
          clearInlineError(editImageUrlInput);
        }
      } else {
        clearInlineError(editImageUrlInput);
      }
    } else if (inputEl === descEl) {
      if (!val) {
        showInlineError(descEl, 'Description is required.');
      } else if (val.length < 10) {
        showInlineError(descEl, 'Description must be at least 10 characters long.');
      } else {
        clearInlineError(descEl);
      }
    }
  };

  const editInputs = [nameEl, skuEl, catEl, priceEl, stockEl, editFileInput, editImageUrlInput, descEl];
  editInputs.forEach(input => {
    if (!input) return;
    input.addEventListener('blur', () => validateField(input));
    input.addEventListener('input', () => validateEditProductForm());
    input.addEventListener('change', () => {
      validateField(input);
      validateEditProductForm();
    });
  });

  if (editImageSourceSelect) {
    editImageSourceSelect.addEventListener('change', () => {
      clearInlineError(editFileInput);
      clearInlineError(editImageUrlInput);
      validateField(editFileInput);
      validateField(editImageUrlInput);
      validateEditProductForm();
    });
  }

  validateEditProductForm();

  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;

    const name = document.getElementById('edit-prod-name').value.trim();
    const sku = document.getElementById('edit-prod-sku').value.trim();
    const category = document.getElementById('edit-prod-cat').value;
    const priceVal = document.getElementById('edit-prod-price').value.trim();
    const stockVal = document.getElementById('edit-prod-stock').value.trim();
    const description = document.getElementById('edit-prod-desc').value.trim();

    if (!name || !sku || !category || !priceVal || !stockVal) {
      showNotification('All required fields must be completed.', 'error');
      return;
    }

    if (name.length < 2 || name.length > 50) {
      showNotification('Product name must be between 2 and 50 characters.', 'error');
      return;
    }

    if (/<script/i.test(name) || /<script/i.test(description) || /<script/i.test(sku)) {
      showNotification('Script injection is not allowed.', 'error');
      return;
    }

    const price = Number(priceVal);
    if (isNaN(price) || price <= 0) {
      showNotification('Product price must be a positive number only.', 'error');
      return;
    }

    const stock = Number(stockVal);
    if (isNaN(stock) || !Number.isInteger(stock) || stock < 0) {
      showNotification('Product stock level must be a non-negative integer.', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('name', name);
    formData.append('sku', sku);
    formData.append('category', category);
    formData.append('price', price);
    formData.append('stock', stock);
    formData.append('description', description);
    formData.append('isFeatured', document.getElementById('edit-prod-featured').checked);
    formData.append('isHidden', document.getElementById('edit-prod-hidden').checked);

    const mode = editImageSourceSelect ? editImageSourceSelect.value : 'upload';
    if (mode === 'upload') {
      const fileInput = document.getElementById('edit-prod-image');
      if (fileInput && fileInput.files[0]) {
        formData.append('image', fileInput.files[0]);
      }
    } else {
      const urlInput = document.getElementById('edit-prod-image-url');
      const imageUrl = urlInput ? urlInput.value.trim() : '';
      if (imageUrl) {
        formData.append('image', imageUrl);
      }
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';
    }

    try {
      await api.upload(`/admin/products/${id}`, formData, 'PUT');

      showNotification('Product arrangements details successfully updated!', 'success');
      modalDiv.remove();
      loadInventoryProducts();
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  });
}

async function populateCategoryDropdown(selectElement, selectedValue = '') {
  try {
    const categories = await api.get('/categories');
    selectElement.innerHTML = '';
    categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.slug;
      option.textContent = cat.name;
      if (cat.slug === selectedValue) {
        option.selected = true;
      }
      selectElement.appendChild(option);
    });
  } catch (err) {
    console.error('Error loading category options:', err);
  }
}

async function loadCategoriesList() {
  const tbody = document.querySelector('#categories-table tbody');
  if (!tbody) return;

  try {
    const categories = await api.get('/categories');
    tbody.innerHTML = '';

    if (categories.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center">No categories found.</td></tr>';
      return;
    }

    categories.forEach(cat => {
      let catImageUrl;
      try {
        catImageUrl = typeof getSafeImageUrl === 'function'
          ? getSafeImageUrl(cat.image, cat.slug, cat.name, true)
          : '../assets/fallbacks/default-category.jpg';
      } catch (err) {
        console.error('Error resolving category image URL:', cat.name, err);
        catImageUrl = '../assets/fallbacks/default-category.jpg';
      }

      const row = document.createElement('tr');
      row.innerHTML = `
        <td><img src="${catImageUrl}" style="width: 50px; height: 50px; object-fit: cover; border-radius: var(--radius-sm);" onerror="this.onerror=null; this.src=(typeof getSafeImageUrl === 'function') ? getSafeImageUrl(null, '${cat.slug ? cat.slug.replace(/'/g, "\\'") : ''}', '${cat.name ? cat.name.replace(/'/g, "\\'") : ''}', true) : '../assets/fallbacks/default-category.jpg';" /></td>
        <td><strong>${cat.name} (${cat.productsCount || 0})</strong></td>
        <td><code>${cat.slug}</code></td>
        <td><span class="admin-badge badge-info" style="font-weight: 600;">${cat.productsCount || 0}</span></td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="viewCategoryProducts('${cat.slug}', '${cat.name.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')">View Products</button>
          <button class="btn btn-outline btn-sm" onclick="openEditCategoryModal('${cat._id}', '${cat.name.replace(/'/g, "\\'").replace(/"/g, '&quot;')}', '${cat.slug}', '${cat.image}')">Edit</button>
          <button class="btn btn-outline btn-sm" style="color: var(--error); border-color: var(--error);" onclick="confirmDeleteCategory('${cat._id}')">Delete</button>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error('Error loading categories:', err);
    tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="color:var(--error);">Failed to load categories.</td></tr>';
  }
}

async function viewCategoryProducts(categorySlug, categoryName) {
  const modalDiv = document.createElement('div');
  modalDiv.id = 'admin-products-view-modal';
  modalDiv.style.position = 'fixed';
  modalDiv.style.top = '0';
  modalDiv.style.left = '0';
  modalDiv.style.width = '100vw';
  modalDiv.style.height = '100vh';
  modalDiv.style.backgroundColor = 'rgba(0,0,0,0.5)';
  modalDiv.style.display = 'flex';
  modalDiv.style.alignItems = 'center';
  modalDiv.style.justifyContent = 'center';
  modalDiv.style.zIndex = '99999';

  modalDiv.innerHTML = `
    <div class="admin-card" style="width: 100%; max-width: 800px; margin: 1rem; padding: var(--space-xl); background: var(--surface-color); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); max-height: 90vh; display: flex; flex-direction: column;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-lg);">
        <h3 style="margin: 0; color: var(--primary);">Products in ${categoryName}</h3>
        <button class="btn btn-outline btn-sm" onclick="document.getElementById('admin-products-view-modal').remove()">✕ Close</button>
      </div>
      <div style="flex: 1; overflow-y: auto; margin-bottom: var(--space-lg);" id="category-products-list-container">
        <table class="admin-table" style="width:100%;">
          <thead>
            <tr>
              <th>Thumbnail</th>
              <th>SKU</th>
              <th>Name</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="6" class="text-center">Loading products...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.body.appendChild(modalDiv);

  try {
    const products = await api.get(`/admin/products?category=${categorySlug}`);
    const tbody = modalDiv.querySelector('tbody');
    tbody.innerHTML = '';
    
    if (products.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">No products found in this category.</td></tr>';
      return;
    }

    const baseServerUrl = API_BASE_URL.replace('/api', '');
    products.forEach(p => {
      let imageUrl;
      try {
        imageUrl = typeof getSafeImageUrl === 'function'
          ? getSafeImageUrl(p.image, p.category, p.name)
          : '../assets/fallbacks/default-product.jpg';
      } catch (err) {
        console.error('Error resolving product image URL in viewCategoryProducts:', p.name, err);
        imageUrl = '../assets/fallbacks/default-product.jpg';
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><img src="${imageUrl}" style="width: 40px; height: 40px; object-fit: cover; border-radius: var(--radius-sm);" onerror="this.onerror=null; this.src=(typeof getSafeImageUrl === 'function') ? getSafeImageUrl(null, '${p.category ? p.category.replace(/'/g, "\\'") : ''}', '${p.name ? p.name.replace(/'/g, "\\'") : ''}') : '../assets/fallbacks/default-product.jpg';" /></td>
        <td><code>${p.sku}</code></td>
        <td><strong>${p.name}</strong></td>
        <td>${formatINR(p.price)}</td>
        <td>${p.stock}</td>
        <td>
          ${p.isHidden ? '<span class="admin-badge" style="background: var(--error); color: white;">Hidden</span>' : '<span class="admin-badge" style="background: #28a745; color: white;">Visible</span>'}
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Error loading category products:', err);
    modalDiv.querySelector('tbody').innerHTML = '<tr><td colspan="6" class="text-center" style="color:var(--error);">Failed to load products.</td></tr>';
  }
}
window.viewCategoryProducts = viewCategoryProducts;

function openAddCategoryModal() {
  const modalDiv = document.createElement('div');
  modalDiv.id = 'admin-category-modal';
  modalDiv.style.position = 'fixed';
  modalDiv.style.top = '0';
  modalDiv.style.left = '0';
  modalDiv.style.width = '100vw';
  modalDiv.style.height = '100vh';
  modalDiv.style.backgroundColor = 'rgba(0,0,0,0.5)';
  modalDiv.style.display = 'flex';
  modalDiv.style.alignItems = 'center';
  modalDiv.style.justifyContent = 'center';
  modalDiv.style.zIndex = '99999';

  modalDiv.innerHTML = `
    <div class="admin-card" style="width: 100%; max-width: 450px; margin: 1rem; padding: var(--space-xl); position: relative; background: var(--surface-color); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);">
      <button style="position: absolute; top: var(--space-md); right: var(--space-md); font-size: 1.5rem; cursor: pointer; color: var(--text-secondary); background: none; border: none;" onclick="document.getElementById('admin-category-modal').remove()">✖</button>
      <h2 style="margin-bottom: var(--space-md); color: var(--primary); font-size: 1.35rem;">Add New Category</h2>
      <form id="admin-category-form">
        <div class="form-group" style="margin-bottom: var(--space-md);">
          <label class="form-label">Category Name *</label>
          <input type="text" id="cat-name" class="form-control" placeholder="e.g. Exotic Orchids" required />
        </div>
        <div class="form-group" style="margin-bottom: var(--space-md);">
          <label class="form-label">Category Slug *</label>
          <input type="text" id="cat-slug" class="form-control" placeholder="e.g. orchids" required />
        </div>
        <div class="form-group" style="margin-bottom: var(--space-md);">
          <label class="form-label">Image Source *</label>
          <select id="cat-image-source" class="form-control" required>
            <option value="upload">Upload from device</option>
            <option value="url">Paste image URL</option>
          </select>
        </div>
        <div class="form-group" id="cat-image-file-group" style="margin-bottom: var(--space-md);">
          <label class="form-label">Category Image File *</label>
          <input type="file" id="cat-image" class="form-control" style="padding: 0.25rem;" accept="image/*" required />
        </div>
        <div class="form-group" id="cat-image-url-group" style="margin-bottom: var(--space-md); display: none;">
          <label class="form-label">Category Image URL *</label>
          <input type="url" id="cat-image-url" class="form-control" placeholder="https://example.com/image.jpg" />
        </div>
        <div class="form-group" id="cat-image-preview-group" style="margin-bottom: var(--space-md); display: none; margin-top: -10px;">
          <label class="form-label">Image Preview</label>
          <div id="cat-image-preview-container" style="margin-top: 8px;">
            <img id="cat-image-preview" src="" style="max-height: 80px; border-radius: 4px; border: 1px solid var(--border-color); object-fit: cover;" onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\' viewBox=\'0 0 100 100\'><rect width=\'100%\' height=\'100%\' fill=\'%23f3f4f6\'/><text x=\'50%\' y=\'50%\' dominant-baseline=\'middle\' text-anchor=\'middle\' font-family=\'sans-serif\' font-size=\'10\' fill=\'%239ca3af\'>No Image</text></svg>';" />
          </div>
        </div>
        <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: var(--space-md);">Create Category</button>
      </form>
    </div>
  `;

  document.body.appendChild(modalDiv);

  const nameInput = document.getElementById('cat-name');
  const slugInput = document.getElementById('cat-slug');
  nameInput.addEventListener('input', () => {
    slugInput.value = nameInput.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    validateCategoryForm();
  });

  const imageSourceSelect = document.getElementById('cat-image-source');
  const catFileInput = document.getElementById('cat-image');
  const catImageUrlInput = document.getElementById('cat-image-url');
  const fileGroup = document.getElementById('cat-image-file-group');
  const urlGroup = document.getElementById('cat-image-url-group');
  const previewGroup = document.getElementById('cat-image-preview-group');
  const previewImg = document.getElementById('cat-image-preview');

  if (imageSourceSelect && fileGroup && urlGroup) {
    imageSourceSelect.addEventListener('change', () => {
      const mode = imageSourceSelect.value;
      if (mode === 'upload') {
        fileGroup.style.display = 'block';
        urlGroup.style.display = 'none';
        catFileInput.setAttribute('required', 'true');
        catImageUrlInput.removeAttribute('required');
        catImageUrlInput.value = '';
        
        if (catFileInput.files[0]) {
          const reader = new FileReader();
          reader.onload = (e) => {
            previewImg.src = e.target.result;
            previewGroup.style.display = 'block';
          };
          reader.readAsDataURL(catFileInput.files[0]);
        } else {
          previewGroup.style.display = 'none';
        }
      } else {
        fileGroup.style.display = 'none';
        urlGroup.style.display = 'block';
        catImageUrlInput.setAttribute('required', 'true');
        catFileInput.removeAttribute('required');
        catFileInput.value = '';
        
        const urlVal = catImageUrlInput.value.trim();
        if (urlVal && (urlVal.startsWith('http://') || urlVal.startsWith('https://'))) {
          previewImg.src = urlVal;
          previewGroup.style.display = 'block';
        } else {
          previewGroup.style.display = 'none';
        }
      }
      validateCategoryForm();
    });
  }

  if (catFileInput && previewGroup && previewImg) {
    catFileInput.addEventListener('change', () => {
      const file = catFileInput.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          previewImg.src = e.target.result;
          previewGroup.style.display = 'block';
        };
        reader.readAsDataURL(file);
      } else {
        previewGroup.style.display = 'none';
      }
    });
  }

  if (catImageUrlInput && previewGroup && previewImg) {
    const updateUrlPreview = () => {
      const urlVal = catImageUrlInput.value.trim();
      if (urlVal && (urlVal.startsWith('http://') || urlVal.startsWith('https://'))) {
        previewImg.src = urlVal;
        previewGroup.style.display = 'block';
      } else {
        previewGroup.style.display = 'none';
      }
    };
    catImageUrlInput.addEventListener('input', updateUrlPreview);
    catImageUrlInput.addEventListener('change', updateUrlPreview);
  }

  const catForm = document.getElementById('admin-category-form');
  const submitBtn = catForm.querySelector('button[type="submit"]');

  const validateCategoryForm = () => {
    let isValid = true;
    if (nameInput) {
      const val = nameInput.value.trim();
      if (!val || /<script/i.test(val)) isValid = false;
    }
    if (slugInput) {
      const val = slugInput.value.trim();
      if (!val || !/^[a-z0-9-]+$/.test(val)) isValid = false;
    }

    const mode = imageSourceSelect ? imageSourceSelect.value : 'upload';
    if (mode === 'upload') {
      if (catFileInput) {
        const file = catFileInput.files[0];
        if (!file || !/\.(jpg|jpeg|png|webp)$/i.test(file.name)) isValid = false;
      } else {
        isValid = false;
      }
    } else {
      if (catImageUrlInput) {
        const val = catImageUrlInput.value.trim();
        if (!val || !isValidDirectImageUrl(val).valid) isValid = false;
      } else {
        isValid = false;
      }
    }
    if (submitBtn) submitBtn.disabled = !isValid;
  };

  const validateField = (inputEl) => {
    if (!inputEl) return;
    const val = inputEl.value.trim();
    if (inputEl === nameInput) {
      if (!val) {
        showInlineError(nameInput, 'Category name is required.');
      } else if (/<script/i.test(val)) {
        showInlineError(nameInput, 'Script injection is not allowed.');
      } else {
        clearInlineError(nameInput);
      }
    } else if (inputEl === slugInput) {
      if (!val) {
        showInlineError(slugInput, 'Category slug is required.');
      } else if (!/^[a-z0-9-]+$/.test(val)) {
        showInlineError(slugInput, 'Slug must contain only lowercase letters, numbers, and dashes.');
      } else {
        clearInlineError(slugInput);
      }
    } else if (inputEl === catFileInput) {
      const mode = imageSourceSelect ? imageSourceSelect.value : 'upload';
      if (mode === 'upload') {
        const file = catFileInput.files[0];
        if (!file) {
          showInlineError(catFileInput, 'Category image file is required.');
        } else if (!/\.(jpg|jpeg|png|webp)$/i.test(file.name)) {
          showInlineError(catFileInput, 'Image must be a valid format (JPG, JPEG, PNG, WEBP).');
        } else {
          clearInlineError(catFileInput);
        }
      } else {
        clearInlineError(catFileInput);
      }
    } else if (inputEl === catImageUrlInput) {
      const mode = imageSourceSelect ? imageSourceSelect.value : 'upload';
      if (mode === 'url') {
        const check = isValidDirectImageUrl(val);
        if (!val) {
          showInlineError(catImageUrlInput, 'Category image URL is required.');
        } else if (!check.valid) {
          showInlineError(catImageUrlInput, check.reason);
        } else {
          clearInlineError(catImageUrlInput);
        }
      } else {
        clearInlineError(catImageUrlInput);
      }
    }
  };

  [nameInput, slugInput, catFileInput, catImageUrlInput].forEach(input => {
    if (!input) return;
    input.addEventListener('blur', () => validateField(input));
    input.addEventListener('input', () => validateCategoryForm());
    input.addEventListener('change', () => {
      validateField(input);
      validateCategoryForm();
    });
  });

  if (imageSourceSelect) {
    imageSourceSelect.addEventListener('change', () => {
      clearInlineError(catFileInput);
      clearInlineError(catImageUrlInput);
      validateField(catFileInput);
      validateField(catImageUrlInput);
      validateCategoryForm();
    });
  }

  validateCategoryForm();

  catForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameInput.value;
    const slug = slugInput.value;

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating...';

    const formData = new FormData();
    formData.append('name', name);
    formData.append('slug', slug);

    const mode = imageSourceSelect ? imageSourceSelect.value : 'upload';
    if (mode === 'upload') {
      if (catFileInput.files[0]) {
        formData.append('image', catFileInput.files[0]);
      }
    } else {
      const urlVal = catImageUrlInput.value.trim();
      if (urlVal) {
        formData.append('image', urlVal);
      }
    }

    try {
      await api.upload('/categories', formData, 'POST');
      showNotification('Category created successfully!', 'success');
      modalDiv.remove();
      loadCategoriesList();
    } catch (err) {
      showNotification(err.message || 'Failed to create category', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
}

function openEditCategoryModal(id, name, slug, image) {
  const modalDiv = document.createElement('div');
  modalDiv.id = 'admin-category-modal';
  modalDiv.style.position = 'fixed';
  modalDiv.style.top = '0';
  modalDiv.style.left = '0';
  modalDiv.style.width = '100vw';
  modalDiv.style.height = '100vh';
  modalDiv.style.backgroundColor = 'rgba(0,0,0,0.5)';
  modalDiv.style.display = 'flex';
  modalDiv.style.alignItems = 'center';
  modalDiv.style.justifyContent = 'center';
  modalDiv.style.zIndex = '99999';

  const baseServerUrl = API_BASE_URL.replace('/api', '');
  const isUrlMode = image && (image.startsWith('http://') || image.startsWith('https://'));
  const catImageUrl = (image && (image.startsWith('http://') || image.startsWith('https://') || image.startsWith('data:')))
    ? image
    : (image ? `${baseServerUrl}${image}` : '');

  modalDiv.innerHTML = `
    <div class="admin-card" style="width: 100%; max-width: 450px; margin: 1rem; padding: var(--space-xl); position: relative; background: var(--surface-color); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); text-align: left;">
      <button style="position: absolute; top: var(--space-md); right: var(--space-md); font-size: 1.5rem; cursor: pointer; color: var(--text-secondary); background: none; border: none;" onclick="document.getElementById('admin-category-modal').remove()">✖</button>
      <h2 style="margin-bottom: var(--space-md); color: var(--primary); font-size: 1.35rem;">Edit Category</h2>
      <form id="admin-category-form">
        <div class="form-group" style="margin-bottom: var(--space-md);">
          <label class="form-label">Category Name *</label>
          <input type="text" id="cat-name" class="form-control" value="${name}" required />
        </div>
        <div class="form-group" style="margin-bottom: var(--space-md);">
          <label class="form-label">Category Slug *</label>
          <input type="text" id="cat-slug" class="form-control" value="${slug}" required />
        </div>
        <div class="form-group" style="margin-bottom: var(--space-md);">
          <label class="form-label">Image Source</label>
          <select id="edit-cat-image-source" class="form-control">
            <option value="upload" ${!isUrlMode ? 'selected' : ''}>Upload from device</option>
            <option value="url" ${isUrlMode ? 'selected' : ''}>Paste image URL</option>
          </select>
        </div>
        <div class="form-group" id="edit-cat-image-file-group" style="margin-bottom: var(--space-md); ${!isUrlMode ? '' : 'display: none;'}">
          <label class="form-label">Replace Image File</label>
          <input type="file" id="cat-image" class="form-control" style="padding: 0.25rem;" accept="image/*" />
        </div>
        <div class="form-group" id="edit-cat-image-url-group" style="margin-bottom: var(--space-md); ${isUrlMode ? '' : 'display: none;'}">
          <label class="form-label">Image URL</label>
          <input type="url" id="cat-image-url" class="form-control" placeholder="https://example.com/image.jpg" value="${isUrlMode ? image : ''}" />
        </div>
        <div class="form-group" id="edit-cat-image-preview-group" style="margin-bottom: var(--space-md); ${image ? 'display: block;' : 'display: none;'} margin-top: -10px;">
          <label class="form-label">Image Preview</label>
          <div id="cat-image-preview-container" style="margin-top: 8px;">
            <img id="cat-image-preview" src="${(typeof getSafeImageUrl === 'function') ? getSafeImageUrl(image, slug, name, true) : '../assets/fallbacks/default-category.jpg'}" style="max-height: 80px; border-radius: 4px; border: 1px solid var(--border-color); object-fit: cover;" onerror="this.onerror=null; this.src=(typeof getSafeImageUrl === 'function') ? getSafeImageUrl(null, '${slug ? slug.replace(/'/g, "\\'") : ''}', '${name ? name.replace(/'/g, "\\'") : ''}', true) : '../assets/fallbacks/default-category.jpg';" />
          </div>
        </div>
        <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: var(--space-md);">Save Category</button>
      </form>
    </div>
  `;

  document.body.appendChild(modalDiv);

  const editImageSourceSelect = document.getElementById('edit-cat-image-source');
  const catFileInput = document.getElementById('cat-image');
  const catImageUrlInput = document.getElementById('cat-image-url');
  const editFileGroup = document.getElementById('edit-cat-image-file-group');
  const editUrlGroup = document.getElementById('edit-cat-image-url-group');
  const editPreviewGroup = document.getElementById('edit-cat-image-preview-group');
  const editPreviewImg = document.getElementById('cat-image-preview');

  if (editImageSourceSelect && editFileGroup && editUrlGroup) {
    editImageSourceSelect.addEventListener('change', () => {
      const mode = editImageSourceSelect.value;
      if (mode === 'upload') {
        editFileGroup.style.display = 'block';
        editUrlGroup.style.display = 'none';
        
        if (catFileInput.files[0]) {
          const reader = new FileReader();
          reader.onload = (e) => {
            editPreviewImg.src = e.target.result;
            editPreviewGroup.style.display = 'block';
          };
          reader.readAsDataURL(catFileInput.files[0]);
        } else if (image && !image.startsWith('http://') && !image.startsWith('https://')) {
          editPreviewImg.src = baseServerUrl + image;
          editPreviewGroup.style.display = 'block';
        } else {
          editPreviewGroup.style.display = 'none';
        }
      } else {
        editFileGroup.style.display = 'none';
        editUrlGroup.style.display = 'block';
        
        const urlVal = catImageUrlInput.value.trim();
        if (urlVal && (urlVal.startsWith('http://') || urlVal.startsWith('https://'))) {
          editPreviewImg.src = urlVal;
          editPreviewGroup.style.display = 'block';
        } else if (image && (image.startsWith('http://') || image.startsWith('https://'))) {
          editPreviewImg.src = image;
          editPreviewGroup.style.display = 'block';
        } else {
          editPreviewGroup.style.display = 'none';
        }
      }
      validateEditCategoryForm();
    });
  }

  if (catFileInput && editPreviewGroup && editPreviewImg) {
    catFileInput.addEventListener('change', () => {
      const file = catFileInput.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          editPreviewImg.src = e.target.result;
          editPreviewGroup.style.display = 'block';
        };
        reader.readAsDataURL(file);
      } else {
        if (image && editImageSourceSelect.value === 'upload') {
          editPreviewImg.src = image.startsWith('http') ? image : baseServerUrl + image;
          editPreviewGroup.style.display = 'block';
        } else {
          editPreviewGroup.style.display = 'none';
        }
      }
    });
  }

  if (catImageUrlInput && editPreviewGroup && editPreviewImg) {
    const updateEditUrlPreview = () => {
      const urlVal = catImageUrlInput.value.trim();
      if (urlVal && (urlVal.startsWith('http://') || urlVal.startsWith('https://'))) {
        editPreviewImg.src = urlVal;
        editPreviewGroup.style.display = 'block';
      } else {
        if (image && editImageSourceSelect.value === 'url') {
          editPreviewImg.src = image;
          editPreviewGroup.style.display = 'block';
        } else {
          editPreviewGroup.style.display = 'none';
        }
      }
    };
    catImageUrlInput.addEventListener('input', updateEditUrlPreview);
    catImageUrlInput.addEventListener('change', updateEditUrlPreview);
  }

  const nameInput = document.getElementById('cat-name');
  const slugInput = document.getElementById('cat-slug');
  const catForm = document.getElementById('admin-category-form');
  const submitBtn = catForm.querySelector('button[type="submit"]');

  const validateEditCategoryForm = () => {
    let isValid = true;
    if (nameInput) {
      const val = nameInput.value.trim();
      if (!val || /<script/i.test(val)) isValid = false;
    }
    if (slugInput) {
      const val = slugInput.value.trim();
      if (!val || !/^[a-z0-9-]+$/.test(val)) isValid = false;
    }

    const mode = editImageSourceSelect ? editImageSourceSelect.value : 'upload';
    if (mode === 'url') {
      const val = catImageUrlInput ? catImageUrlInput.value.trim() : '';
      if (!val || !isValidDirectImageUrl(val).valid) {
        isValid = false;
      }
    } else {
      if (catFileInput && catFileInput.files[0]) {
        if (!/\.(jpg|jpeg|png|webp)$/i.test(catFileInput.files[0].name)) isValid = false;
      }
    }
    if (submitBtn) submitBtn.disabled = !isValid;
  };

  const validateField = (inputEl) => {
    if (!inputEl) return;
    const val = inputEl.value.trim();
    if (inputEl === nameInput) {
      if (!val) {
        showInlineError(nameInput, 'Category name is required.');
      } else if (/<script/i.test(val)) {
        showInlineError(nameInput, 'Script injection is not allowed.');
      } else {
        clearInlineError(nameInput);
      }
    } else if (inputEl === slugInput) {
      if (!val) {
        showInlineError(slugInput, 'Category slug is required.');
      } else if (!/^[a-z0-9-]+$/.test(val)) {
        showInlineError(slugInput, 'Slug must contain only lowercase letters, numbers, and dashes.');
      } else {
        clearInlineError(slugInput);
      }
    } else if (inputEl === catFileInput) {
      const mode = editImageSourceSelect ? editImageSourceSelect.value : 'upload';
      if (mode === 'upload' && catFileInput.files[0]) {
        if (!/\.(jpg|jpeg|png|webp)$/i.test(catFileInput.files[0].name)) {
          showInlineError(catFileInput, 'Image must be a valid format (JPG, JPEG, PNG, WEBP).');
        } else {
          clearInlineError(catFileInput);
        }
      } else {
        clearInlineError(catFileInput);
      }
    } else if (inputEl === catImageUrlInput) {
      const mode = editImageSourceSelect ? editImageSourceSelect.value : 'upload';
      if (mode === 'url') {
        const check = isValidDirectImageUrl(val);
        if (!val) {
          showInlineError(catImageUrlInput, 'Category image URL is required.');
        } else if (!check.valid) {
          showInlineError(catImageUrlInput, check.reason);
        } else {
          clearInlineError(catImageUrlInput);
        }
      } else {
        clearInlineError(catImageUrlInput);
      }
    }
  };

  const editInputs = [nameInput, slugInput, catFileInput, catImageUrlInput];
  editInputs.forEach(input => {
    if (!input) return;
    input.addEventListener('blur', () => validateField(input));
    input.addEventListener('input', () => validateEditCategoryForm());
    input.addEventListener('change', () => {
      validateField(input);
      validateEditCategoryForm();
    });
  });

  if (editImageSourceSelect) {
    editImageSourceSelect.addEventListener('change', () => {
      clearInlineError(catFileInput);
      clearInlineError(catImageUrlInput);
      validateField(catFileInput);
      validateField(catImageUrlInput);
      validateEditCategoryForm();
    });
  }

  validateEditCategoryForm();

  catForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const updatedName = document.getElementById('cat-name').value;
    const updatedSlug = document.getElementById('cat-slug').value;

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    const formData = new FormData();
    formData.append('name', updatedName);
    formData.append('slug', updatedSlug);

    const mode = editImageSourceSelect ? editImageSourceSelect.value : 'upload';
    if (mode === 'upload') {
      if (catFileInput.files[0]) {
        formData.append('image', catFileInput.files[0]);
      }
    } else {
      const urlVal = catImageUrlInput.value.trim();
      if (urlVal) {
        formData.append('image', urlVal);
      }
    }

    try {
      await api.upload(`/categories/${id}`, formData, 'PUT');
      showNotification('Category updated successfully!', 'success');
      modalDiv.remove();
      loadCategoriesList();
    } catch (err) {
      showNotification(err.message || 'Failed to update category', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
}

function confirmDeleteCategory(categoryId) {
  const modalDiv = document.createElement('div');
  modalDiv.id = 'admin-delete-modal';
  modalDiv.style.position = 'fixed';
  modalDiv.style.top = '0';
  modalDiv.style.left = '0';
  modalDiv.style.width = '100vw';
  modalDiv.style.height = '100vh';
  modalDiv.style.backgroundColor = 'rgba(0,0,0,0.5)';
  modalDiv.style.display = 'flex';
  modalDiv.style.alignItems = 'center';
  modalDiv.style.justifyContent = 'center';
  modalDiv.style.zIndex = '99999';

  modalDiv.innerHTML = `
    <div class="admin-card" style="width: 100%; max-width: 400px; margin: 1rem; padding: var(--space-xl); background: var(--surface-color); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); text-align: center;">
      <h3 style="color: var(--error); margin-bottom: var(--space-md);">Confirm Category Deletion</h3>
      <p style="margin-bottom: var(--space-lg); font-size: 0.95rem;">Are you sure you want to permanently delete this category? This operation will be rejected if the category currently contains products.</p>
      <div style="display: flex; gap: var(--space-md); justify-content: center;">
        <button class="btn btn-outline" style="min-width: 100px;" onclick="document.getElementById('admin-delete-modal').remove()">Cancel</button>
        <button class="btn btn-secondary" style="background-color: var(--error); color: white; min-width: 100px;" id="btn-confirm-delete">Delete</button>
      </div>
    </div>
  `;

  document.body.appendChild(modalDiv);

  document.getElementById('btn-confirm-delete').addEventListener('click', async () => {
    try {
      await api.delete(`/categories/${categoryId}`);
      showNotification('Category deleted successfully!', 'success');
      modalDiv.remove();
      loadCategoriesList();
    } catch (err) {
      showNotification(err.message || 'Failed to delete category.', 'error');
      modalDiv.remove();
    }
  });
}

async function loadPromosList() {
  const tbody = document.querySelector('#promos-table tbody');
  if (!tbody) return;

  try {
    const promos = await api.get('/admin/promos');
    tbody.innerHTML = '';

    if (promos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">No promo coupon codes created yet.</td></tr>';
      return;
    }

    promos.forEach(p => {
      const expiry = new Date(p.expiresAt).toLocaleDateString();
      const freeShippingBadge = p.isFreeShipping 
        ? '<span class="admin-badge badge-success">Yes</span>' 
        : '<span class="admin-badge" style="background-color: hsl(210, 16%, 90%); color: var(--text-secondary);">No</span>';

      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${p.code}</strong></td>
        <td>${p.discountPercent}%</td>
        <td>${formatINR(p.minPurchase)}</td>
        <td>${freeShippingBadge}</td>
        <td>${expiry}</td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="openEditPromoModal('${p._id}', '${p.code}', ${p.discountPercent}, ${p.isFreeShipping}, ${p.minPurchase}, '${p.expiresAt}')">Edit</button>
          <button class="btn btn-outline btn-sm" style="color: var(--error); border-color: var(--error);" onclick="confirmDeletePromo('${p._id}')">Delete</button>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error('Error loading promos:', err);
    tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="color:var(--error);">Failed to load coupon codes.</td></tr>';
  }
}

function openAddPromoModal() {
  const modalDiv = document.createElement('div');
  modalDiv.id = 'admin-promo-modal';
  modalDiv.style.position = 'fixed';
  modalDiv.style.top = '0';
  modalDiv.style.left = '0';
  modalDiv.style.width = '100vw';
  modalDiv.style.height = '100vh';
  modalDiv.style.backgroundColor = 'rgba(0,0,0,0.5)';
  modalDiv.style.display = 'flex';
  modalDiv.style.alignItems = 'center';
  modalDiv.style.justifyContent = 'center';
  modalDiv.style.zIndex = '99999';

  modalDiv.innerHTML = `
    <div class="admin-card" style="width: 100%; max-width: 450px; margin: 1rem; padding: var(--space-xl); position: relative; background: var(--surface-color); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);">
      <button style="position: absolute; top: var(--space-md); right: var(--space-md); font-size: 1.5rem; cursor: pointer; color: var(--text-secondary); background: none; border: none;" onclick="document.getElementById('admin-promo-modal').remove()">✖</button>
      <h2 style="margin-bottom: var(--space-md); color: var(--primary); font-size: 1.35rem;">Add New Coupon</h2>
      <form id="admin-promo-form">
        <div class="form-group" style="margin-bottom: var(--space-md);">
          <label class="form-label">Coupon Code *</label>
          <input type="text" id="promo-code" class="form-control" style="text-transform: uppercase;" placeholder="FLORISH10" required />
        </div>
        <div class="form-group" style="margin-bottom: var(--space-md);">
          <label class="form-label">Discount Percent (%) *</label>
          <input type="number" id="promo-discount" class="form-control" min="0" max="100" placeholder="10" required />
        </div>
        <div class="form-group" style="margin-bottom: var(--space-md);">
          <label class="form-label">Minimum Purchase Value ($) *</label>
          <input type="number" id="promo-min" class="form-control" min="0" placeholder="0" required />
        </div>
        <div class="form-group" style="margin-bottom: var(--space-md); display: flex; align-items: center; gap: 0.5rem;">
          <input type="checkbox" id="promo-shipping" style="width: auto; height: auto;" />
          <label class="form-label" for="promo-shipping" style="margin: 0;">Include Free Shipping</label>
        </div>
        <div class="form-group" style="margin-bottom: var(--space-md);">
          <label class="form-label">Expiration Date *</label>
          <input type="date" id="promo-expiry" class="form-control" required />
        </div>
        <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: var(--space-md);">Create Promo Code</button>
      </form>
    </div>
  `;

  document.body.appendChild(modalDiv);

  document.getElementById('admin-promo-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('promo-code').value.toUpperCase().trim();
    const discountPercent = document.getElementById('promo-discount').value;
    const minPurchase = document.getElementById('promo-min').value;
    const isFreeShipping = document.getElementById('promo-shipping').checked;
    const expiresAt = document.getElementById('promo-expiry').value;

    if (!/^[A-Z0-9_-]+$/.test(code)) {
      showNotification('Promo code can only contain letters, numbers, dashes, and underscores.', 'error');
      return;
    }

    try {
      await api.post('/admin/promos', { code, discountPercent, minPurchase, isFreeShipping, expiresAt });
      showNotification('Promo coupon created successfully!', 'success');
      modalDiv.remove();
      loadPromosList();
    } catch (err) {
      showNotification(err.message || 'Failed to create promo code', 'error');
    }
  });
}

function openEditPromoModal(id, code, discountPercent, isFreeShipping, minPurchase, expiresAt) {
  const modalDiv = document.createElement('div');
  modalDiv.id = 'admin-promo-modal';
  modalDiv.style.position = 'fixed';
  modalDiv.style.top = '0';
  modalDiv.style.left = '0';
  modalDiv.style.width = '100vw';
  modalDiv.style.height = '100vh';
  modalDiv.style.backgroundColor = 'rgba(0,0,0,0.5)';
  modalDiv.style.display = 'flex';
  modalDiv.style.alignItems = 'center';
  modalDiv.style.justifyContent = 'center';
  modalDiv.style.zIndex = '99999';

  const expiryDate = new Date(expiresAt).toISOString().split('T')[0];

  modalDiv.innerHTML = `
    <div class="admin-card" style="width: 100%; max-width: 450px; margin: 1rem; padding: var(--space-xl); position: relative; background: var(--surface-color); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);">
      <button style="position: absolute; top: var(--space-md); right: var(--space-md); font-size: 1.5rem; cursor: pointer; color: var(--text-secondary); background: none; border: none;" onclick="document.getElementById('admin-promo-modal').remove()">✖</button>
      <h2 style="margin-bottom: var(--space-md); color: var(--primary); font-size: 1.35rem;">Edit Coupon</h2>
      <form id="admin-promo-form">
        <div class="form-group" style="margin-bottom: var(--space-md);">
          <label class="form-label">Coupon Code *</label>
          <input type="text" id="promo-code" class="form-control" style="text-transform: uppercase;" value="${code}" required />
        </div>
        <div class="form-group" style="margin-bottom: var(--space-md);">
          <label class="form-label">Discount Percent (%) *</label>
          <input type="number" id="promo-discount" class="form-control" min="0" max="100" value="${discountPercent}" required />
        </div>
        <div class="form-group" style="margin-bottom: var(--space-md);">
          <label class="form-label">Minimum Purchase Value ($) *</label>
          <input type="number" id="promo-min" class="form-control" min="0" value="${minPurchase}" required />
        </div>
        <div class="form-group" style="margin-bottom: var(--space-md); display: flex; align-items: center; gap: 0.5rem;">
          <input type="checkbox" id="promo-shipping" style="width: auto; height: auto;" ${isFreeShipping ? 'checked' : ''} />
          <label class="form-label" for="promo-shipping" style="margin: 0;">Include Free Shipping</label>
        </div>
        <div class="form-group" style="margin-bottom: var(--space-md);">
          <label class="form-label">Expiration Date *</label>
          <input type="date" id="promo-expiry" class="form-control" value="${expiryDate}" required />
        </div>
        <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: var(--space-md);">Save Promo Coupon</button>
      </form>
    </div>
  `;

  document.body.appendChild(modalDiv);

  document.getElementById('admin-promo-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const updatedCode = document.getElementById('promo-code').value.toUpperCase().trim();
    const updatedDiscountPercent = document.getElementById('promo-discount').value;
    const updatedMinPurchase = document.getElementById('promo-min').value;
    const updatedIsFreeShipping = document.getElementById('promo-shipping').checked;
    const updatedExpiresAt = document.getElementById('promo-expiry').value;

    if (!/^[A-Z0-9_-]+$/.test(updatedCode)) {
      showNotification('Promo code can only contain letters, numbers, dashes, and underscores.', 'error');
      return;
    }

    try {
      await api.put(`/admin/promos/${id}`, { code: updatedCode, discountPercent: updatedDiscountPercent, minPurchase: updatedMinPurchase, isFreeShipping: updatedIsFreeShipping, expiresAt: updatedExpiresAt });
      showNotification('Promo coupon updated successfully!', 'success');
      modalDiv.remove();
      loadPromosList();
    } catch (err) {
      showNotification(err.message || 'Failed to update promo code', 'error');
    }
  });
}

function confirmDeletePromo(promoId) {
  const modalDiv = document.createElement('div');
  modalDiv.id = 'admin-delete-modal';
  modalDiv.style.position = 'fixed';
  modalDiv.style.top = '0';
  modalDiv.style.left = '0';
  modalDiv.style.width = '100vw';
  modalDiv.style.height = '100vh';
  modalDiv.style.backgroundColor = 'rgba(0,0,0,0.5)';
  modalDiv.style.display = 'flex';
  modalDiv.style.alignItems = 'center';
  modalDiv.style.justifyContent = 'center';
  modalDiv.style.zIndex = '99999';

  modalDiv.innerHTML = `
    <div class="admin-card" style="width: 100%; max-width: 400px; margin: 1rem; padding: var(--space-xl); background: var(--surface-color); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); text-align: center;">
      <h3 style="color: var(--error); margin-bottom: var(--space-md);">Confirm Coupon Deletion</h3>
      <p style="margin-bottom: var(--space-lg); font-size: 0.95rem;">Are you sure you want to permanently delete this promo coupon code?</p>
      <div style="display: flex; gap: var(--space-md); justify-content: center;">
        <button class="btn btn-outline" style="min-width: 100px;" onclick="document.getElementById('admin-delete-modal').remove()">Cancel</button>
        <button class="btn btn-secondary" style="background-color: var(--error); color: white; min-width: 100px;" id="btn-confirm-delete">Delete</button>
      </div>
    </div>
  `;

  document.body.appendChild(modalDiv);

  document.getElementById('btn-confirm-delete').addEventListener('click', async () => {
    try {
      await api.delete(`/admin/promos/${promoId}`);
      showNotification('Promo coupon deleted successfully!', 'success');
      modalDiv.remove();
      loadPromosList();
    } catch (err) {
      showNotification(err.message || 'Failed to delete promo coupon.', 'error');
      modalDiv.remove();
    }
  });
}

async function loadReviewsList() {
  const tbody = document.querySelector('#reviews-table tbody');
  if (!tbody) return;

  try {
    const reviews = await api.get('/admin/reviews');
    tbody.innerHTML = '';

    if (reviews.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">No reviews submitted yet.</td></tr>';
      return;
    }

    reviews.forEach(r => {
      const statusBadge = r.isApproved 
        ? '<span class="admin-badge badge-success">Approved</span>' 
        : '<span class="admin-badge badge-danger">Hidden</span>';

      const toggleText = r.isApproved ? 'Hide' : 'Approve';
      const toggleColor = r.isApproved ? 'var(--warning)' : 'var(--success)';

      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${r.product ? r.product.name : 'Unknown'}</strong> <div style="font-size:0.75rem; color:var(--text-muted);">${r.product ? r.product.sku : ''}</div></td>
        <td>${r.name}</td>
        <td><span style="color: gold; font-weight: bold;">★</span> ${r.rating} / 5</td>
        <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${r.comment.replace(/"/g, '&quot;')}">${r.comment}</td>
        <td>${statusBadge}</td>
        <td>
          <button class="btn btn-outline btn-sm" style="color: ${toggleColor}; border-color: ${toggleColor};" onclick="toggleReviewApprovalStatus('${r._id}')">${toggleText}</button>
          <button class="btn btn-outline btn-sm" style="color: var(--error); border-color: var(--error);" onclick="confirmDeleteReview('${r._id}')">Delete</button>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error('Error loading reviews:', err);
    tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="color:var(--error);">Failed to load reviews.</td></tr>';
  }
}

async function toggleReviewApprovalStatus(reviewId) {
  try {
    await api.put(`/admin/reviews/${reviewId}/approve`, {});
    showNotification('Review moderation status updated!', 'success');
    loadReviewsList();
  } catch (err) {
    showNotification(err.message || 'Failed to update review status.', 'error');
  }
}

function confirmDeleteReview(reviewId) {
  const modalDiv = document.createElement('div');
  modalDiv.id = 'admin-delete-modal';
  modalDiv.style.position = 'fixed';
  modalDiv.style.top = '0';
  modalDiv.style.left = '0';
  modalDiv.style.width = '100vw';
  modalDiv.style.height = '100vh';
  modalDiv.style.backgroundColor = 'rgba(0,0,0,0.5)';
  modalDiv.style.display = 'flex';
  modalDiv.style.alignItems = 'center';
  modalDiv.style.justifyContent = 'center';
  modalDiv.style.zIndex = '99999';

  modalDiv.innerHTML = `
    <div class="admin-card" style="width: 100%; max-width: 400px; margin: 1rem; padding: var(--space-xl); background: var(--surface-color); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); text-align: center;">
      <h3 style="color: var(--error); margin-bottom: var(--space-md);">Confirm Review Deletion</h3>
      <p style="margin-bottom: var(--space-lg); font-size: 0.95rem;">Are you sure you want to permanently delete this customer review?</p>
      <div style="display: flex; gap: var(--space-md); justify-content: center;">
        <button class="btn btn-outline" style="min-width: 100px;" onclick="document.getElementById('admin-delete-modal').remove()">Cancel</button>
        <button class="btn btn-secondary" style="background-color: var(--error); color: white; min-width: 100px;" id="btn-confirm-delete">Delete</button>
      </div>
    </div>
  `;

  document.body.appendChild(modalDiv);

  document.getElementById('btn-confirm-delete').addEventListener('click', async () => {
    try {
      await api.delete(`/admin/reviews/${reviewId}`);
      showNotification('Review deleted successfully!', 'success');
      modalDiv.remove();
      loadReviewsList();
    } catch (err) {
      showNotification(err.message || 'Failed to delete review.', 'error');
      modalDiv.remove();
    }
  });
}

async function toggleUserActivation(userId, userName) {
  const confirmText = `Are you sure you want to block/unblock user ${userName}?`;
  if (!confirm(confirmText)) return;

  try {
    await api.put(`/admin/users/${userId}/toggle`, {});
    showNotification(`User status changed successfully!`, 'success');
    loadCustomerDirectory();
  } catch (err) {
    showNotification(err.message || 'Failed to update user status.', 'error');
  }
}

async function viewUserOrderHistory(userId, userName) {
  const modalDiv = document.createElement('div');
  modalDiv.id = 'admin-order-modal';
  modalDiv.style.position = 'fixed';
  modalDiv.style.top = '0';
  modalDiv.style.left = '0';
  modalDiv.style.width = '100vw';
  modalDiv.style.height = '100vh';
  modalDiv.style.backgroundColor = 'rgba(0,0,0,0.5)';
  modalDiv.style.display = 'flex';
  modalDiv.style.alignItems = 'center';
  modalDiv.style.justifyContent = 'center';
  modalDiv.style.zIndex = '99999';

  modalDiv.innerHTML = `
    <div class="admin-card" style="width: 100%; max-width: 600px; margin: 1rem; padding: var(--space-xl); position: relative; background: var(--surface-color); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);">
      <button style="position: absolute; top: var(--space-md); right: var(--space-md); font-size: 1.5rem; cursor: pointer; color: var(--text-secondary); background: none; border: none;" onclick="document.getElementById('admin-order-modal').remove()">✖</button>
      <h2 style="margin-bottom: var(--space-md); color: var(--primary); font-size: 1.35rem;">Order History: ${userName}</h2>
      <div id="admin-order-modal-body" style="max-height: 400px; overflow-y: auto;">
        <div class="text-center" style="padding: 2rem 0;">
          <div style="display: inline-block; width: 30px; height: 30px;" class="spinner"></div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modalDiv);

  try {
    const orders = await api.get(`/admin/users/${userId}/orders`);
    const modalBody = document.getElementById('admin-order-modal-body');
    modalBody.innerHTML = '';

    if (orders.length === 0) {
      modalBody.innerHTML = '<p class="text-center" style="padding: 2rem 0; color: var(--text-muted);">No orders recorded for this user.</p>';
      return;
    }

    orders.forEach(order => {
      const formattedId = order._id.substring(order._id.length - 6).toUpperCase();
      const date = new Date(order.createdAt).toLocaleDateString();
      const items = order.items.map(i => `${i.name} (x${i.quantity})`).join(', ');

      const orderDiv = document.createElement('div');
      orderDiv.style.borderBottom = '1px solid var(--border-color)';
      orderDiv.style.padding = '0.75rem 0';
      orderDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; font-size: 0.9rem; font-weight: 600; margin-bottom: 0.25rem;">
          <span>Order #FL-${formattedId}</span>
          <span class="admin-badge ${order.orderStatus === 'Delivered' ? 'badge-success' : 'badge-pending'}">${order.orderStatus}</span>
        </div>
        <div style="font-size: 0.85rem; color: var(--text-secondary); display: flex; justify-content: space-between;">
          <span>${items}</span>
          <strong>${formatINR(order.totalPrice)}</strong>
        </div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">Placed on: ${date}</div>
      `;
      modalBody.appendChild(orderDiv);
    });
  } catch (err) {
    document.getElementById('admin-order-modal-body').innerHTML = '<p style="color:var(--error); font-size:0.9rem;">Failed to retrieve customer order history.</p>';
  }
}

// Bind to window scope
window.populateCategoryDropdown = populateCategoryDropdown;
window.loadCategoriesList = loadCategoriesList;
window.openAddCategoryModal = openAddCategoryModal;
window.openEditCategoryModal = openEditCategoryModal;
window.confirmDeleteCategory = confirmDeleteCategory;
window.loadPromosList = loadPromosList;
window.openAddPromoModal = openAddPromoModal;
window.openEditPromoModal = openEditPromoModal;
window.confirmDeletePromo = confirmDeletePromo;
window.loadReviewsList = loadReviewsList;
window.toggleReviewApprovalStatus = toggleReviewApprovalStatus;
window.confirmDeleteReview = confirmDeleteReview;
window.toggleUserActivation = toggleUserActivation;
window.viewUserOrderHistory = viewUserOrderHistory;
window.downloadAdminInvoice = downloadAdminInvoice;

/**
 * Trigger invoice download for administrator
 */
async function downloadAdminInvoice(orderId, btn) {
  const token = localStorage.getItem('florish_token');
  if (!token) {
    if (typeof showNotification === 'function') {
      showNotification('Please login to download the invoice.', 'error');
    } else {
      alert('Please login to download the invoice.');
    }
    return;
  }

  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span style="display:inline-block; width:12px; height:12px; border: 2px solid white; border-radius:50%; border-top-color:transparent; animation: spin 0.8s linear infinite; margin-right:5px; vertical-align: middle;"></span> Downloading...';

  try {
    const response = await fetch(`${API_BASE_URL}/orders/${orderId}/invoice`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      throw new Error(errorJson.message || `Server returned status ${response.status}`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `Florish_Invoice_Order${orderId.substring(orderId.length - 6).toUpperCase()}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    if (typeof showNotification === 'function') {
      showNotification('Invoice downloaded successfully!', 'success');
    }
  } catch (err) {
    console.error('Invoice download failed:', err);
    if (typeof showNotification === 'function') {
      showNotification(err.message || 'Invoice download failed. Please try again.', 'error');
    } else {
      alert(err.message || 'Invoice download failed. Please try again.');
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

/**
 * Initialize Sales Report UI controls and event listeners
 */
function initSalesReportExport() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  const startInput = document.getElementById('report-start-date');
  const endInput = document.getElementById('report-end-date');
  if (startInput) startInput.setAttribute('max', todayStr);
  if (endInput) endInput.setAttribute('max', todayStr);

  const btnCustom = document.getElementById('btn-download-custom');
  const btnDaily = document.getElementById('btn-download-daily');
  const btnWeekly = document.getElementById('btn-download-weekly');
  const btnMonthly = document.getElementById('btn-download-monthly');
  const btnFull = document.getElementById('btn-download-full');

  if (btnCustom) {
    btnCustom.addEventListener('click', () => {
      const startDate = startInput.value;
      const endDate = endInput.value;
      
      if (!startDate || !endDate) {
        showReportStatus('Please select both start and end dates for a custom report.', 'error');
        showNotification('Please select both start and end dates.', 'error');
        return;
      }

      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      if (new Date(startDate) > todayEnd || new Date(endDate) > todayEnd) {
        showReportStatus('Future dates are not allowed for sales reports.', 'error');
        showNotification('Future dates are not allowed.', 'error');
        return;
      }
      
      if (new Date(startDate) > new Date(endDate)) {
        showReportStatus('Start date must be before or equal to end date.', 'error');
        showNotification('Start date must be before or equal to end date.', 'error');
        return;
      }
      
      downloadSalesReport('custom', startDate, endDate);
    });
  }

  if (btnDaily) {
    btnDaily.addEventListener('click', () => downloadSalesReport('daily'));
  }

  if (btnWeekly) {
    btnWeekly.addEventListener('click', () => downloadSalesReport('weekly'));
  }

  if (btnMonthly) {
    btnMonthly.addEventListener('click', () => downloadSalesReport('monthly'));
  }

  if (btnFull) {
    btnFull.addEventListener('click', () => downloadSalesReport('full'));
  }
}

/**
 * Perform download request for Sales Report
 */
async function downloadSalesReport(type, startDate, endDate) {
  const token = localStorage.getItem('florish_token');
  if (!token) {
    showNotification('Authorization token not found. Please log in.', 'error');
    return;
  }

  showReportStatus('Generating sales report, please wait...', 'info');

  try {
    let queryParams = `?type=${type}`;
    if (type === 'custom') {
      queryParams += `&startDate=${startDate}&endDate=${endDate}`;
    }

    const response = await fetch(`${API_BASE_URL}/admin/reports/sales${queryParams}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      throw new Error(errorJson.message || `Server returned status ${response.status}`);
    }

    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error('The generated sales report is empty.');
    }

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    
    const fileToday = new Date().toISOString().slice(0, 10);
    a.download = `Florish_Sales_Report_${fileToday}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    showReportStatus('Report downloaded successfully!', 'success');
    showNotification('Sales report downloaded successfully!', 'success');
    
    setTimeout(() => {
      const statusDiv = document.getElementById('report-status-msg');
      if (statusDiv && statusDiv.textContent === 'Report downloaded successfully!') {
        statusDiv.style.display = 'none';
      }
    }, 5000);

  } catch (err) {
    console.error('Sales report download failed:', err);
    showReportStatus(err.message || 'Failed to download sales report.', 'error');
    showNotification(err.message || 'Report download failed.', 'error');
  }
}

/**
 * Update the report generation status indicator
 */
function showReportStatus(msg, type = 'info') {
  const statusDiv = document.getElementById('report-status-msg');
  if (!statusDiv) return;
  statusDiv.style.display = 'block';
  statusDiv.textContent = msg;
  
  if (type === 'error') {
    statusDiv.style.backgroundColor = 'hsl(0, 84%, 95%)';
    statusDiv.style.color = 'var(--error)';
    statusDiv.style.border = '1px solid var(--error)';
  } else if (type === 'success') {
    statusDiv.style.backgroundColor = 'hsl(142, 69%, 95%)';
    statusDiv.style.color = 'var(--success)';
    statusDiv.style.border = '1px solid var(--success)';
  } else {
    // loading / info
    statusDiv.style.backgroundColor = 'var(--primary-light)';
    statusDiv.style.color = 'var(--primary)';
    statusDiv.style.border = '1px solid var(--primary)';
  }
}

window.downloadSalesReport = downloadSalesReport;

async function deleteUserAccount(userId, userName) {
  const confirmText = `Are you sure you want to delete user ${userName}? This will deactivate their login but preserve their order history.`;
  if (!confirm(confirmText)) return;

  try {
    await api.delete(`/admin/users/${userId}`);
    showNotification(`User ${userName} deactivated and deleted successfully!`, 'success');
    loadCustomerDirectory();
  } catch (err) {
    showNotification(err.message || 'Failed to delete user.', 'error');
  }
}

function openOrdersReportModal() {
  const modalDiv = document.createElement('div');
  modalDiv.id = 'admin-report-modal';
  modalDiv.style.position = 'fixed';
  modalDiv.style.top = '0';
  modalDiv.style.left = '0';
  modalDiv.style.width = '100vw';
  modalDiv.style.height = '100vh';
  modalDiv.style.backgroundColor = 'rgba(0,0,0,0.5)';
  modalDiv.style.display = 'flex';
  modalDiv.style.alignItems = 'center';
  modalDiv.style.justifyContent = 'center';
  modalDiv.style.zIndex = '99999';

  modalDiv.innerHTML = `
    <div class="admin-card" style="width: 100%; max-width: 550px; margin: 1rem; padding: var(--space-xl); position: relative; background: var(--surface-color); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);">
      <button style="position: absolute; top: var(--space-md); right: var(--space-md); font-size: 1.5rem; cursor: pointer; color: var(--text-secondary); background: none; border: none;" onclick="document.getElementById('admin-report-modal').remove()">✖</button>
      
      <h3 style="margin-top: 0; display: flex; align-items: center; gap: 0.5rem; color: var(--primary);">📊 Download Sales Report</h3>
      <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: var(--space-lg);">
        Generate and download detailed sales performance reports in Excel (.xlsx) format.
      </p>

      <div style="display: flex; flex-direction: column; gap: var(--space-md); margin-bottom: var(--space-lg);">
        <div style="display: flex; gap: var(--space-md);">
          <div style="display: flex; flex-direction: column; gap: 0.25rem; flex: 1;">
            <label for="modal-start-date" style="font-size: 0.85rem; font-weight: 600; color: var(--text-secondary);">Start Date</label>
            <input type="date" id="modal-start-date" class="form-control" style="width: 100%;" />
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.25rem; flex: 1;">
            <label for="modal-end-date" style="font-size: 0.85rem; font-weight: 600; color: var(--text-secondary);">End Date</label>
            <input type="date" id="modal-end-date" class="form-control" style="width: 100%;" />
          </div>
        </div>
        <button id="modal-btn-download-custom" class="btn btn-primary" style="width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;">
          📥 Download Custom Report
        </button>
      </div>

      <div style="border-top: 1px solid var(--border-color); padding-top: var(--space-md);">
        <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: var(--space-sm);">Quick Reports:</span>
        <div style="display: flex; flex-wrap: wrap; gap: var(--space-sm);">
          <button id="modal-btn-download-daily" class="btn btn-outline btn-sm">Daily</button>
          <button id="modal-btn-download-weekly" class="btn btn-outline btn-sm">Weekly</button>
          <button id="modal-btn-download-monthly" class="btn btn-outline btn-sm">Monthly</button>
          <button id="modal-btn-download-full" class="btn btn-outline btn-sm">Full History</button>
        </div>
      </div>
      
      <div id="modal-report-status-msg" style="margin-top: var(--space-md); padding: var(--space-sm) var(--space-md); border-radius: var(--radius-sm); font-size: 0.9rem; display: none;"></div>
    </div>
  `;

  document.body.appendChild(modalDiv);

  // Set maximum date limits to today to block future dates selection
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  const modalStartInput = document.getElementById('modal-start-date');
  const modalEndInput = document.getElementById('modal-end-date');
  if (modalStartInput) modalStartInput.setAttribute('max', todayStr);
  if (modalEndInput) modalEndInput.setAttribute('max', todayStr);

  // Wire up modal actions
  const btnCustom = document.getElementById('modal-btn-download-custom');
  const btnDaily = document.getElementById('modal-btn-download-daily');
  const btnWeekly = document.getElementById('modal-btn-download-weekly');
  const btnMonthly = document.getElementById('modal-btn-download-monthly');
  const btnFull = document.getElementById('modal-btn-download-full');

  const showModalStatus = (msg, type = 'info') => {
    const statusDiv = document.getElementById('modal-report-status-msg');
    if (!statusDiv) return;
    statusDiv.style.display = 'block';
    statusDiv.textContent = msg;
    if (type === 'error') {
      statusDiv.style.backgroundColor = 'hsl(0, 84%, 95%)';
      statusDiv.style.color = 'var(--error)';
      statusDiv.style.border = '1px solid var(--error)';
    } else if (type === 'success') {
      statusDiv.style.backgroundColor = 'hsl(142, 69%, 95%)';
      statusDiv.style.color = 'var(--success)';
      statusDiv.style.border = '1px solid var(--success)';
    } else {
      statusDiv.style.backgroundColor = 'var(--surface-color)';
      statusDiv.style.color = 'var(--text-secondary)';
      statusDiv.style.border = '1px solid var(--border-color)';
    }
  };

  const downloadAction = async (type, start, end) => {
    const token = localStorage.getItem('florish_token');
    showModalStatus('Generating report, please wait...', 'info');
    try {
      let queryParams = `?type=${type}`;
      if (type === 'custom') queryParams += `&startDate=${start}&endDate=${end}`;
      const response = await fetch(`${API_BASE_URL}/admin/reports/sales${queryParams}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(errorJson.message || `Server returned status ${response.status}`);
      }
      const blob = await response.blob();
      if (blob.size === 0) throw new Error('The generated sales report is empty.');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fileToday = new Date().toISOString().slice(0, 10);
      a.download = `Florish_Sales_Report_${fileToday}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showModalStatus('Report downloaded successfully!', 'success');
      showNotification('Sales report downloaded successfully!', 'success');
      setTimeout(() => { modalDiv.remove(); }, 2000);
    } catch (err) {
      console.error(err);
      showModalStatus(err.message || 'Failed to download sales report.', 'error');
    }
  };

  btnCustom.addEventListener('click', () => {
    const start = modalStartInput.value;
    const end = modalEndInput.value;
    if (!start || !end) {
      showModalStatus('Please select both start and end dates.', 'error');
      return;
    }
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    if (new Date(start) > todayEnd || new Date(end) > todayEnd) {
      showModalStatus('Future dates are not allowed for sales reports.', 'error');
      return;
    }
    if (new Date(start) > new Date(end)) {
      showModalStatus('Start date must be before or equal to end date.', 'error');
      return;
    }
    downloadAction('custom', start, end);
  });

  btnDaily.addEventListener('click', () => downloadAction('daily'));
  btnWeekly.addEventListener('click', () => downloadAction('weekly'));
  btnMonthly.addEventListener('click', () => downloadAction('monthly'));
  btnFull.addEventListener('click', () => downloadAction('full'));
}

window.deleteUserAccount = deleteUserAccount;
window.openOrdersReportModal = openOrdersReportModal;

function validateAddProductForm() {
  const form = document.getElementById('admin-add-product-form');
  if (!form) return false;

  const nameEl = document.getElementById('add-prod-name');
  const skuEl = document.getElementById('add-prod-sku');
  const catEl = document.getElementById('add-prod-cat');
  const priceEl = document.getElementById('add-prod-price');
  const stockEl = document.getElementById('add-prod-stock');
  const imageSourceSelect = document.getElementById('add-prod-image-source');
  const imageEl = document.getElementById('add-prod-image');
  const imageUrlEl = document.getElementById('add-prod-image-url');
  const descEl = document.getElementById('add-prod-desc');
  const submitBtn = form.querySelector('button[type="submit"]');

  let isValid = true;

  if (nameEl) {
    const val = nameEl.value.trim();
    if (!val || val.length < 3 || val.length > 100 || /<script/i.test(val)) isValid = false;
  }
  if (skuEl) {
    const val = skuEl.value.trim();
    if (!val || /<script/i.test(val)) isValid = false;
  }
  if (catEl && !catEl.value) isValid = false;
  if (priceEl) {
    const val = priceEl.value.trim();
    const price = Number(val);
    if (!val || isNaN(price) || price <= 0) isValid = false;
  }
  if (stockEl) {
    const val = stockEl.value.trim();
    const stock = Number(val);
    if (!val || isNaN(stock) || !Number.isInteger(stock) || stock < 0) isValid = false;
  }

  const imageSource = imageSourceSelect ? imageSourceSelect.value : 'upload';
  if (imageSource === 'upload') {
    if (imageEl) {
      const file = imageEl.files[0];
      if (!file || !/\.(jpg|jpeg|png|webp)$/i.test(file.name)) isValid = false;
    } else {
      isValid = false;
    }
  } else {
    if (imageUrlEl) {
      const val = imageUrlEl.value.trim();
      if (!val || !isValidDirectImageUrl(val).valid) isValid = false;
    } else {
      isValid = false;
    }
  }

  if (descEl && descEl.value.trim().length < 10) isValid = false;

  if (submitBtn) {
    submitBtn.disabled = !isValid;
  }

  return isValid;
}

function setupAddProductValidation() {
  const nameEl = document.getElementById('add-prod-name');
  const skuEl = document.getElementById('add-prod-sku');
  const catEl = document.getElementById('add-prod-cat');
  const priceEl = document.getElementById('add-prod-price');
  const stockEl = document.getElementById('add-prod-stock');
  const imageSourceSelect = document.getElementById('add-prod-image-source');
  const imageEl = document.getElementById('add-prod-image');
  const imageUrlEl = document.getElementById('add-prod-image-url');
  const descEl = document.getElementById('add-prod-desc');

  const inputs = [nameEl, skuEl, catEl, priceEl, stockEl, imageEl, imageUrlEl, descEl];

  const validateField = (inputEl) => {
    if (!inputEl) return;
    const val = inputEl.value.trim();

    if (inputEl === nameEl) {
      if (!val) {
        showInlineError(nameEl, 'Product name is required.');
      } else if (val.length < 3 || val.length > 100) {
        showInlineError(nameEl, 'Product name must be between 3 and 100 characters.');
      } else if (/<script/i.test(val)) {
        showInlineError(nameEl, 'Script injection is not allowed.');
      } else {
        clearInlineError(nameEl);
      }
    } else if (inputEl === skuEl) {
      if (!val) {
        showInlineError(skuEl, 'SKU code is required.');
      } else if (/<script/i.test(val)) {
        showInlineError(skuEl, 'Script injection is not allowed.');
      } else {
        clearInlineError(skuEl);
      }
    } else if (inputEl === priceEl) {
      const p = Number(val);
      if (!val) {
        showInlineError(priceEl, 'Price is required.');
      } else if (isNaN(p) || p <= 0) {
        showInlineError(priceEl, 'Price must be a positive number greater than 0.');
      } else {
        clearInlineError(priceEl);
      }
    } else if (inputEl === stockEl) {
      const s = Number(val);
      if (!val) {
        showInlineError(stockEl, 'Stock level is required.');
      } else if (isNaN(s) || !Number.isInteger(s) || s < 0) {
        showInlineError(stockEl, 'Stock must be a non-negative integer.');
      } else {
        clearInlineError(stockEl);
      }
    } else if (inputEl === imageEl) {
      const imageSource = imageSourceSelect ? imageSourceSelect.value : 'upload';
      if (imageSource === 'upload') {
        const file = imageEl.files[0];
        if (!file) {
          showInlineError(imageEl, 'Product image file is required.');
        } else if (!/\.(jpg|jpeg|png|webp)$/i.test(file.name)) {
          showInlineError(imageEl, 'Image must be a valid format (JPG, JPEG, PNG, WEBP).');
        } else {
          clearInlineError(imageEl);
        }
      } else {
        clearInlineError(imageEl);
      }
    } else if (inputEl === imageUrlEl) {
      const imageSource = imageSourceSelect ? imageSourceSelect.value : 'upload';
      if (imageSource === 'url') {
        const check = isValidDirectImageUrl(val);
        if (!val) {
          showInlineError(imageUrlEl, 'Image URL is required.');
        } else if (!check.valid) {
          showInlineError(imageUrlEl, check.reason);
        } else {
          clearInlineError(imageUrlEl);
        }
      } else {
        clearInlineError(imageUrlEl);
      }
    } else if (inputEl === descEl) {
      if (!val) {
        showInlineError(descEl, 'Description is required.');
      } else if (val.length < 10) {
        showInlineError(descEl, 'Description must be at least 10 characters long.');
      } else {
        clearInlineError(descEl);
      }
    }
  };

  inputs.forEach(input => {
    if (!input) return;
    
    input.addEventListener('blur', () => {
      validateField(input);
    });

    input.addEventListener('input', () => {
      validateAddProductForm();
    });
    input.addEventListener('change', () => {
      validateField(input);
      validateAddProductForm();
    });
  });

  if (imageSourceSelect) {
    imageSourceSelect.addEventListener('change', () => {
      clearInlineError(imageEl);
      clearInlineError(imageUrlEl);
      validateField(imageEl);
      validateField(imageUrlEl);
      validateAddProductForm();
    });
  }

  validateAddProductForm();
}

/**
 * Helper to display inline error message under input field
 */
function showInlineError(inputEl, msg) {
  if (!inputEl) return;
  inputEl.style.borderColor = 'var(--error)';
  inputEl.style.boxShadow = '0 0 0 3px rgba(220, 38, 38, 0.1)';
  
  let errorContainer = document.getElementById(`err-${inputEl.id}`);
  if (!errorContainer) {
    errorContainer = document.createElement('div');
    errorContainer.id = `err-${inputEl.id}`;
    errorContainer.className = 'error-msg';
    errorContainer.style.color = 'var(--error)';
    errorContainer.style.fontSize = '0.8rem';
    errorContainer.style.marginTop = '4px';
    errorContainer.style.display = 'none';
    if (inputEl.parentNode) {
      inputEl.parentNode.appendChild(errorContainer);
    }
  }
  
  errorContainer.textContent = msg;
  errorContainer.style.display = 'block';

  // Reset highlight upon typing or change
  const resetHighlight = () => {
    inputEl.style.borderColor = '';
    inputEl.style.boxShadow = '';
    errorContainer.style.display = 'none';
    errorContainer.textContent = '';
    inputEl.removeEventListener('input', resetHighlight);
    inputEl.removeEventListener('change', resetHighlight);
  };

  inputEl.addEventListener('input', resetHighlight);
  inputEl.addEventListener('change', resetHighlight);
}

/**
 * Helper to clear inline error on a specific field
 */
function clearInlineError(inputEl) {
  if (!inputEl) return;
  inputEl.style.borderColor = '';
  inputEl.style.boxShadow = '';
  const errorContainer = document.getElementById(`err-${inputEl.id}`);
  if (errorContainer) {
    errorContainer.style.display = 'none';
    errorContainer.textContent = '';
  }
}

/**
 * Helper to validate if an image URL is a direct link and not a search/sharing page
 */
function isValidDirectImageUrl(url) {
  if (!url) return { valid: false, reason: 'Image URL is required.' };
  url = url.trim();
  
  if (url.startsWith('/uploads/')) {
    return { valid: true };
  }
  
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return { valid: false, reason: 'Image URL must start with http:// or https://' };
  }
  
  const lowerUrl = url.toLowerCase();
  
  // Reject common search/sharing pages
  if (lowerUrl.includes('google.com/imgres') || (lowerUrl.includes('google.') && lowerUrl.includes('/imgres'))) {
    return { valid: false, reason: 'This is a Google Images search link, not a direct image URL. Please right-click the image and select "Copy image address".' };
  }
  if (lowerUrl.includes('images.app.goo.gl') || lowerUrl.includes('app.goo.gl')) {
    return { valid: false, reason: 'This is a Google Images share link, not a direct image URL. Please right-click the image and select "Copy image address".' };
  }
  if (lowerUrl.includes('drive.google.com')) {
    return { valid: false, reason: 'This is a Google Drive share link, not a direct image URL. Please host the image publicly or upload it directly.' };
  }
  if (lowerUrl.includes('google.com/search') || lowerUrl.includes('google.com/url')) {
    return { valid: false, reason: 'This is a Google search/redirect link, not a direct image URL.' };
  }
  if (lowerUrl.includes('unsplash.com/photos/') || lowerUrl.includes('unsplash.com/collections/')) {
    return { valid: false, reason: 'This is an Unsplash webpage link, not a direct image link. Right-click the image and select "Copy image address".' };
  }
  if (lowerUrl.includes('pinterest.com/pin/') || lowerUrl.includes('pin.it/')) {
    return { valid: false, reason: 'This is a Pinterest webpage link, not a direct image link. Copy the direct image link instead.' };
  }
  
  return { valid: true };
}

window.showInlineError = showInlineError;
window.clearInlineError = clearInlineError;
window.isValidDirectImageUrl = isValidDirectImageUrl;

