/*
 * Main.js - Global Interactions and Reusable Component Loader
 * Purpose: Automatically injects modular components (navbar, footer, loaders) across HTML views, updates global cart counters, and sets active link states.
 */

function getSafeImageUrl(imageUrl, category, name, isCategory = false) {
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
    const apiBase = window.API_BASE_URL || (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'http://localhost:5000/api');
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
}
window.getSafeImageUrl = getSafeImageUrl;

document.addEventListener('DOMContentLoaded', () => {
  // Load reusable HTML components dynamically
  loadGlobalComponents();

  // Initialize UI interactive events (e.g. Mobile toggle, Back to top button)
  initGlobalEvents();

  // Load category cards dynamically on Homepage
  loadHomepageCategories();
});

/**
 * Dynamically fetches and inserts shared HTML elements
 */
async function loadGlobalComponents() {
  // Sync core settings dynamically from DB to local cache
  if (typeof api !== 'undefined') {
    try {
      const settings = await api.get('/settings');
      if (settings) {
        localStorage.setItem('florish_brand_name', settings.brandName || 'Florish');
        localStorage.setItem('florish_support_email', settings.supportEmail || 'hello@florish-shop.com');
        localStorage.setItem('florish_allowed_pincodes', settings.allowedPincodes || '400001, 400002, 400003, 400029, 400032');
        localStorage.setItem('florish_sales_tax', settings.salesTax !== undefined ? settings.salesTax : '8.0');
        localStorage.setItem('florish_shipping_charge', settings.shippingCharge !== undefined ? settings.shippingCharge : '99');
      }
    } catch (err) {
      console.error('Failed to sync settings from database:', err);
    }
  }

  const components = [
    { id: 'navbar-placeholder', file: 'components/navbar.html', callback: initNavbarBurger },
    { id: 'footer-placeholder', file: 'components/footer.html', callback: initFooterDate }
  ];

  for (const component of components) {
    const container = document.getElementById(component.id);
    if (container) {
      try {
        // Resolve relative path adjustments depending on directory depths (admin uses ../components/)
        const isSubDir = window.location.pathname.includes('/admin/') || window.location.pathname.includes('/components/');
        const prefix = isSubDir ? '../' : '';
        
        const response = await fetch(`${prefix}${component.file}`);
        if (!response.ok) throw new Error(`Could not load ${component.file}`);
        
        container.innerHTML = await response.text();
        
        // Adjust relative href links dynamically if inside a subdirectory to prevent broken navigation
        if (isSubDir) {
          container.querySelectorAll('a[href]').forEach(link => {
            const href = link.getAttribute('href');
            if (href && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
              if (!href.startsWith('../')) {
                link.setAttribute('href', `../${href}`);
              }
            }
          });
        }
        
        if (component.callback) {
          component.callback();
        }
      } catch (err) {
        console.error('Error loading component:', err);
      }
    }
  }

  // Update navbar cart status numbers on elements
  await updateCartBadge();

  // Verify and greet logged in sessions globally
  verifySessionState();

  // Sync theme toggle icon immediately upon navbar load
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  if (themeToggleBtn) {
    const isDark = document.documentElement.classList.contains('dark-theme') || localStorage.getItem('florish_theme') === 'dark';
    const iconSpan = themeToggleBtn.querySelector('.toggle-icon');
    if (iconSpan) {
      iconSpan.textContent = isDark ? '☀️' : '🌙';
    }
  }

  // Sync theme toggle button icon if darkmode.js is loaded
  if (typeof updateToggleBtnIcon === 'function') {
    updateToggleBtnIcon(document.documentElement.classList.contains('dark-theme'));
  }
}

/**
 * Initializes navbar responsive hamburger toggle
 */
async function initNavbarBurger() {
  const menuToggle = document.getElementById('mobile-menu-toggle');
  const navMenu = document.querySelector('.nav-links');

  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', () => {
      navMenu.classList.toggle('active');
      menuToggle.classList.toggle('active');
    });
  }

  // Highlight active link based on current page
  highlightActiveLink();

  // Dynamically populate categories dropdown in navbar
  const categoriesDropdown = document.getElementById('nav-categories-dropdown');
  const categoriesToggle = document.getElementById('nav-categories-toggle');

  if (categoriesDropdown) {
    try {
      const categories = await api.get('/categories');
      if (categories && categories.length > 0) {
        const isSubDir = window.location.pathname.includes('/admin/');
        const prefix = isSubDir ? '../' : '';
        categoriesDropdown.innerHTML = `<a href="${prefix}shop.html">All Flowers</a>`;
        categories.forEach(cat => {
          const a = document.createElement('a');
          a.href = `${prefix}shop.html?category=${cat.slug}`;
          a.textContent = cat.name;
          categoriesDropdown.appendChild(a);
        });
      }
    } catch (err) {
      console.error('Error loading navbar categories dynamically:', err);
    }
  }

  if (categoriesToggle && categoriesDropdown) {
    categoriesToggle.addEventListener('click', (e) => {
      if (window.innerWidth <= 992) {
        e.preventDefault();
        const isVisible = categoriesDropdown.style.display === 'block';
        categoriesDropdown.style.display = isVisible ? 'none' : 'block';
      }
    });
  }

  // Initialize search suggestions logic
  initSearchSuggestions();
}

/**
 * Auto-injects current calendar year into footer disclaimer
 */
function initFooterDate() {
  const yearSpan = document.getElementById('current-year');
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }
}

/**
 * Highlights corresponding header anchor matching path matching
 */
function highlightActiveLink() {
  const links = document.querySelectorAll('.nav-link');
  const path = window.location.pathname;

  links.forEach(link => {
    const href = link.getAttribute('href');
    if (href && path.includes(href)) {
      link.classList.add('active');
    }
  });
}

/**
 * Updates cart count indicators globally
 */
async function updateCartBadge() {
  const badges = document.querySelectorAll('.cart-count-badge');
  const token = localStorage.getItem('florish_token');
  let count = 0;

  if (token) {
    try {
      const cart = await api.get('/cart');
      const items = cart.items || [];
      
      // Update localStorage cache
      const localCartCache = items.map(item => ({
        id: item.product ? item.product._id : '',
        quantity: item.quantity
      }));
      localStorage.setItem('florish_cart', JSON.stringify(localCartCache));
      count = items.reduce((acc, item) => acc + item.quantity, 0);
    } catch (err) {
      console.error('Failed to sync cart count with server:', err);
      // Fallback to local storage if API fails
      let cartItems = [];
      try {
        cartItems = JSON.parse(localStorage.getItem('florish_cart')) || [];
        if (!Array.isArray(cartItems)) cartItems = [];
      } catch (e) {
        cartItems = [];
      }
      count = cartItems.reduce((acc, item) => acc + item.quantity, 0);
    }
  } else {
    localStorage.removeItem('florish_cart');
    let guestCart = [];
    try {
      guestCart = JSON.parse(localStorage.getItem('florish_guest_cart')) || [];
      if (!Array.isArray(guestCart)) guestCart = [];
    } catch (e) {
      guestCart = [];
    }
    count = guestCart.reduce((acc, item) => acc + item.quantity, 0);
  }

  badges.forEach(badge => {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  });
}

/**
 * Standard utility to show customized notifications
 * @param {string} msg - Warning or info string
 * @param {'success'|'error'} type - Style modifier
 */
function showNotification(msg, type = 'success') {
  const banner = document.createElement('div');
  banner.className = `form-alert form-alert-${type} animate-fade-in`;
  banner.style.position = 'fixed';
  banner.style.bottom = '20px';
  banner.style.right = '20px';
  banner.style.zIndex = '9999';
  banner.innerHTML = `<span>${type === 'success' ? '✔' : '✖'}</span> ${msg}`;

  document.body.appendChild(banner);

  setTimeout(() => {
    banner.remove();
  }, 4000);
}

/**
 * Checks session cache to configure nav drop links globally
 */
function verifySessionState() {
  const token = localStorage.getItem('florish_token');
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem('florish_user'));
  } catch (e) {
    user = null;
  }
  
  const loginBtn = document.getElementById('nav-login-btn');
  const userMenu = document.getElementById('nav-user-menu');
  const adminLink = document.getElementById('nav-admin-link');

  if (token && user) {
    if (loginBtn) {
      loginBtn.textContent = `Hi, ${user.name.split(' ')[0]} ▾`;
      loginBtn.href = '#';
      loginBtn.className = 'btn btn-outline nav-dropdown-trigger';
      
      // Toggle dropdown behavior
      loginBtn.removeEventListener('click', toggleUserMenu);
      loginBtn.addEventListener('click', toggleUserMenu);
    }

    // Toggle admin control link
    if (user.role === 'admin') {
      if (adminLink) adminLink.style.display = 'block';
    } else {
      if (adminLink) adminLink.style.display = 'none';
    }

    // Fetch unread notifications count badge
    updateNotificationsBadge();
  } else {
    if (loginBtn) {
      const isSubDir = window.location.pathname.includes('/admin/') || window.location.pathname.includes('/components/');
      const prefix = isSubDir ? '../' : '';
      loginBtn.textContent = 'Login';
      loginBtn.href = `${prefix}login.html`;
      loginBtn.className = 'btn btn-outline';
      loginBtn.removeEventListener('click', toggleUserMenu);
    }
    if (adminLink) adminLink.style.display = 'none';
    if (userMenu) userMenu.style.display = 'none';
    const badge = document.getElementById('nav-notifications-badge');
    if (badge) badge.style.display = 'none';
  }
}

function toggleUserMenu(e) {
  e.preventDefault();
  const userMenu = document.getElementById('nav-user-menu');
  if (userMenu) {
    userMenu.style.display = userMenu.style.display === 'none' ? 'block' : 'none';
  }
}

function initGlobalEvents() {
  // Dismiss user menu dropdown upon clicking outside
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('nav-user-menu');
    const trigger = document.getElementById('nav-login-btn');
    if (dropdown && trigger && dropdown.style.display === 'block') {
      if (!trigger.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    }
  });

  // Global event delegation for logout triggers
  document.addEventListener('click', (e) => {
    const logoutBtn = e.target.closest('#nav-logout-btn') || e.target.closest('#admin-logout-btn');
    if (logoutBtn) {
      e.preventDefault();
      localStorage.removeItem('florish_token');
      localStorage.removeItem('florish_user');
      localStorage.removeItem('florish_cart');
      
      if (typeof showNotification === 'function') {
        showNotification('Successfully logged out.', 'success');
      } else {
        alert('Successfully logged out.');
      }
      
      setTimeout(() => {
        const isSubDir = window.location.pathname.includes('/admin/');
        if (isSubDir) {
          window.location.href = 'login.html';
        } else {
          window.location.href = 'index.html';
        }
      }, 1000);
    }
  });

  // Global Image Load Error logger (disabled silent replacements)
  window.addEventListener('error', (e) => {
    if (e.target.tagName === 'IMG') {
      console.warn('[IMAGE LOAD ERROR] Failed to load image asset:', e.target.src);
    }
  }, true);

  // Global search bar listeners (navbar is loaded asynchronously)
  document.addEventListener('click', (e) => {
    const searchBtn = e.target.closest('#nav-search-submit, #nav-search-submit-mobile');
    if (searchBtn) {
      const isMobile = searchBtn.id.includes('mobile');
      const searchInput = document.getElementById(isMobile ? 'nav-search-input-mobile' : 'nav-search-input');
      if (searchInput) {
        triggerSearch(searchInput.value);
      }
    }
  });

  document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && (e.target.id === 'nav-search-input' || e.target.id === 'nav-search-input-mobile')) {
      triggerSearch(e.target.value);
    }
  });

  console.log('Florish core JavaScript initialized.');
}

function triggerSearch(query) {
  // Sanitize input to strip script and HTML tags to prevent XSS injection
  const sanitizeSearch = (str) => {
    if (typeof str !== 'string') return '';
    return str.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
              .replace(/<\/?[^>]+(>|$)/g, '')
              .trim();
  };
  const cleanQuery = sanitizeSearch(query);
  
  // If we are already on shop.html, filter dynamically without forcing a full page reload
  if (window.location.pathname.includes('shop.html')) {
    if (typeof applyCatalogFilters === 'function') {
      const params = new URLSearchParams(window.location.search);
      if (cleanQuery) {
        params.set('search', cleanQuery);
      } else {
        params.delete('search');
      }
      
      const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
      window.history.pushState({}, '', newUrl);
      
      applyCatalogFilters(cleanQuery, false);
      return;
    }
  }

  // If on other pages, an empty query redirects to shop.html (to browse all)
  if (!cleanQuery) {
    window.location.href = 'shop.html';
    return;
  }
  
  // Determine if we need relative prefix based on directory depth (admin page)
  const isSubDir = window.location.pathname.includes('/admin/');
  const prefix = isSubDir ? '../' : '';
  window.location.href = `${prefix}shop.html?search=${encodeURIComponent(cleanQuery)}`;
}

async function updateNotificationsBadge() {
  const badge = document.getElementById('nav-notifications-badge');
  if (!badge) return;

  const token = localStorage.getItem('florish_token');
  if (!token) {
    badge.style.display = 'none';
    return;
  }

  try {
    const data = await api.get('/notifications/unread-count');
    if (data.count > 0) {
      badge.textContent = data.count;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  } catch (err) {
    console.error('Error fetching unread notifications count:', err);
    badge.style.display = 'none';
  }
}

window.updateNotificationsBadge = updateNotificationsBadge;

/**
 * Dynamically fetches categories from API and populates the homepage category grid
 */
async function loadHomepageCategories() {
  const categoryGrid = document.querySelector('.category-grid');
  if (!categoryGrid) return;

  try {
    const categories = await api.get('/categories');
    if (categories && categories.length > 0) {
      categoryGrid.innerHTML = '';
      const baseServerUrl = API_BASE_URL.replace('/api', '');
      categories.forEach(cat => {
        const imageUrl = getSafeImageUrl(cat.image, cat.slug, cat.name, true);

        const card = document.createElement('a');
        card.href = `shop.html?category=${cat.slug}`;
        card.className = 'category-card';
        card.innerHTML = `
          <img src="${imageUrl}" alt="${cat.name}" onerror="this.onerror=null; this.src=getSafeImageUrl(null, '${cat.slug}', '${cat.name}', true);" />
          <div class="category-overlay">
            <h3>${cat.name}</h3>
            <span class="category-explore">Explore Collection &rarr;</span>
          </div>
        `;
        categoryGrid.appendChild(card);
      });
    }
  } catch (err) {
    console.error('Error loading homepage categories dynamically:', err);
  }
}

window.loadHomepageCategories = loadHomepageCategories;

function initSearchSuggestions() {
  const searchInputs = [
    document.getElementById('nav-search-input'),
    document.getElementById('nav-search-input-mobile')
  ].filter(Boolean);

  searchInputs.forEach(input => {
    const searchBar = input.closest('.nav-search-bar');
    if (!searchBar) return;

    let dropdown = searchBar.querySelector('.search-suggestions-dropdown');
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.className = 'search-suggestions-dropdown';
      searchBar.appendChild(dropdown);
    }

    let activeIndex = -1;
    let suggestions = [];
    let debounceTimer;

    const handleInput = () => {
      clearTimeout(debounceTimer);
      const query = input.value.trim();
      
      if (query.length === 0) {
        dropdown.innerHTML = '';
        dropdown.style.display = 'none';
        suggestions = [];
        activeIndex = -1;
        return;
      }

      debounceTimer = setTimeout(async () => {
        try {
          const data = await api.get(`/products/suggestions?q=${encodeURIComponent(query)}`);
          suggestions = data || [];
          activeIndex = -1;
          renderDropdown();
        } catch (err) {
          console.error('Error fetching search suggestions:', err);
          dropdown.style.display = 'none';
        }
      }, 200); // 200ms debounce
    };

    const renderDropdown = () => {
      if (suggestions.length === 0) {
        dropdown.innerHTML = '';
        dropdown.style.display = 'none';
        return;
      }

      dropdown.innerHTML = suggestions.map((item, idx) => {
        const imageUrl = getSafeImageUrl(item.image, item.category, item.name);
        
        const isSubDir = window.location.pathname.includes('/admin/');
        const prefix = isSubDir ? '../' : '';
        const detailLink = `${prefix}product-details.html?id=${item._id || item.id}`;

        return `
          <a href="${detailLink}" class="suggestion-item ${idx === activeIndex ? 'selected' : ''}" data-index="${idx}">
            <img src="${imageUrl}" alt="${item.name}" onerror="this.onerror=null; this.src=getSafeImageUrl(null, '${item.category}', '${item.name}');" />
            <div class="suggestion-details">
              <span class="suggestion-name">${item.name}</span>
              <span class="suggestion-price">${formatINR(item.price)}</span>
            </div>
          </a>
        `;
      }).join('');
      dropdown.style.display = 'block';
    };

    input.addEventListener('keydown', (e) => {
      if (dropdown.style.display !== 'block') return;

      const items = dropdown.querySelectorAll('.suggestion-item');
      if (items.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = (activeIndex + 1) % items.length;
        updateSelection(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = (activeIndex - 1 + items.length) % items.length;
        updateSelection(items);
      } else if (e.key === 'Enter') {
        if (activeIndex >= 0 && activeIndex < items.length) {
          e.preventDefault();
          items[activeIndex].click();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        dropdown.style.display = 'none';
        activeIndex = -1;
      }
    });

    const updateSelection = (items) => {
      items.forEach((item, idx) => {
        if (idx === activeIndex) {
          item.classList.add('selected');
          item.scrollIntoView({ block: 'nearest' });
        } else {
          item.classList.remove('selected');
        }
      });
    };

    input.addEventListener('input', handleInput);
    input.addEventListener('focus', () => {
      if (input.value.trim().length > 0 && suggestions.length > 0) {
        dropdown.style.display = 'block';
      }
    });
  });

  document.addEventListener('click', (e) => {
    const dropdowns = document.querySelectorAll('.search-suggestions-dropdown');
    dropdowns.forEach(dropdown => {
      const searchBar = dropdown.closest('.nav-search-bar');
      if (searchBar && !searchBar.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });
  });
}

window.initSearchSuggestions = initSearchSuggestions;
