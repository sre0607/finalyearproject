/*
 * Filter.js - Shop Category and Price Filter Handler
 * Purpose: Evaluates state changes in sidebar widgets, category clicks, sorting select elements and triggers re-renders from the live API.
 */

let currentPage = 1;
const itemsPerPage = 9;

document.addEventListener('DOMContentLoaded', () => {
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) sortSelect.addEventListener('change', () => applyCatalogFilters(null, false));

  // When the sidebar is dynamically loaded, hook up event listeners and parse URL filters
  document.addEventListener('sidebar-loaded', async () => {
    const sidebarCategories = document.getElementById('sidebar-categories');
    if (sidebarCategories) {
      try {
        const categories = await api.get('/categories');
        if (categories && categories.length > 0) {
          sidebarCategories.innerHTML = '<li><a href="#" class="active" data-category="all">All Fresh Flowers <span class="badge">(0)</span></a></li>';
          categories.forEach(cat => {
            const li = document.createElement('li');
            li.innerHTML = `<a href="#" data-category="${cat.slug}">${cat.name} <span class="badge">(0)</span></a>`;
            sidebarCategories.appendChild(li);
          });
        }
      } catch (err) {
        console.error('Error loading sidebar categories dynamically:', err);
      }
    }
    initSidebarListeners();
    parseUrlFilters();
  });

  // Mobile filter drawer toggle trigger
  document.addEventListener('click', (e) => {
    const toggleBtn = e.target.closest('#mobile-filter-toggle');
    if (toggleBtn) {
      e.preventDefault();
      const sidebar = document.querySelector('.filters-sidebar');
      if (sidebar) {
        sidebar.classList.toggle('active');
      }
    }
  });
});

/**
 * Hook event listeners to filter sidebar elements
 */
function initSidebarListeners() {
  const categoryLinks = document.querySelectorAll('.category-list a');
  if (categoryLinks.length > 0) {
    categoryLinks.forEach(link => {
      link.removeEventListener('click', handleCategoryClick);
      link.addEventListener('click', handleCategoryClick);
    });
  }

  const chkStock = document.getElementById('chk-instock');
  const chkDeliv = document.getElementById('chk-delivery');
  const priceSlider = document.getElementById('price-range-slider');

  if (chkStock) {
    chkStock.removeEventListener('change', () => applyCatalogFilters(null, false));
    chkStock.addEventListener('change', () => applyCatalogFilters(null, false));
  }
  if (chkDeliv) {
    chkDeliv.removeEventListener('change', () => applyCatalogFilters(null, false));
    chkDeliv.addEventListener('change', () => applyCatalogFilters(null, false));
  }
  if (priceSlider) {
    priceSlider.removeEventListener('change', () => applyCatalogFilters(null, false));
    priceSlider.addEventListener('change', () => applyCatalogFilters(null, false));
  }
}

/**
 * Handle category link clicks
 */
function handleCategoryClick(e) {
  e.preventDefault();
  const categoryLinks = document.querySelectorAll('.category-list a');
  categoryLinks.forEach(l => l.classList.remove('active'));
  e.currentTarget.classList.add('active');
  applyCatalogFilters(null, false);
}

/**
 * Parse filters from search query parameters in the URL
 */
function parseUrlFilters() {
  const params = new URLSearchParams(window.location.search);
  const cat = params.get('category');
  const searchVal = params.get('search');

  if (cat) {
    const activeLink = document.querySelector(`.category-list a[data-category="${cat}"]`);
    if (activeLink) {
      document.querySelectorAll('.category-list a').forEach(l => l.classList.remove('active'));
      activeLink.classList.add('active');
    }
  }

  // Sync the search field in the navbar
  if (searchVal) {
    const navSearchInput = document.getElementById('nav-search-input');
    if (navSearchInput) navSearchInput.value = searchVal;
    const navSearchInputMobile = document.getElementById('nav-search-input-mobile');
    if (navSearchInputMobile) navSearchInputMobile.value = searchVal;
  }

  applyCatalogFilters(searchVal, false);
}

let allProductsCache = null;

/**
 * Fetch all products once and cache them for the page lifecycle
 */
async function getAllProducts() {
  if (!allProductsCache) {
    allProductsCache = await api.get('/products');
  }
  return allProductsCache;
}

/**
 * Fetch products and apply filters/sorting, displaying skeleton screen during load
 */
async function applyCatalogFilters(initialSearch = null, keepPage = false) {
  const catalogGrid = document.getElementById('catalog-products-grid');
  if (!catalogGrid) return;

  // Show premium skeleton loading placeholders
  catalogGrid.innerHTML = `
    <div class="skeleton-card"></div>
    <div class="skeleton-card"></div>
    <div class="skeleton-card"></div>
    <div class="skeleton-card"></div>
    <div class="skeleton-card"></div>
    <div class="skeleton-card"></div>
  `;

  if (!keepPage) {
    currentPage = 1;
  }

  // Determine active category
  const activeCatEl = document.querySelector('.category-list a.active');
  const activeCat = activeCatEl ? activeCatEl.getAttribute('data-category') : 'all';

  // Determine price limits
  const slider = document.getElementById('price-range-slider');
  const maxPrice = slider ? parseFloat(slider.value) : 5000;

  // Determine sorting criteria
  const sortSel = document.getElementById('sort-select');
  const sortOrder = sortSel ? sortSel.value : 'popularity';

  // Check stock toggle
  const chkStock = document.getElementById('chk-instock');
  const showOnlyInStock = chkStock ? chkStock.checked : false;

  const urlParams = new URLSearchParams(window.location.search);
  const query = initialSearch !== null ? initialSearch : urlParams.get('search');

  try {
    // Single clean data fetch
    const allProducts = await getAllProducts();
    updateCategoryBadges(allProducts, query);

    // Apply client-side filters
    let filtered = [...allProducts];

    // 1. Category filter
    if (activeCat !== 'all') {
      filtered = filtered.filter(item => item.category === activeCat);
    }

    // 2. Search query filter
    if (query && query.trim() !== '') {
      const lowerQuery = query.toLowerCase().trim();
      filtered = filtered.filter(item => {
        const nameMatch = item.name && item.name.toLowerCase().includes(lowerQuery);
        const categoryMatch = item.category && item.category.toLowerCase().includes(lowerQuery);
        const descMatch = item.description && item.description.toLowerCase().includes(lowerQuery);
        const tagsMatch = item.deliveryTags && item.deliveryTags.some(tag => tag.toLowerCase().includes(lowerQuery));
        return nameMatch || categoryMatch || descMatch || tagsMatch;
      });
    }

    // 3. In Stock filter
    if (showOnlyInStock) {
      filtered = filtered.filter(item => item.stock === undefined || item.stock > 0);
    }

    // 4. Price range filter
    filtered = filtered.filter(item => item.price <= maxPrice);

    // 5. Sorting logic
    if (sortOrder === 'price-low') {
      filtered.sort((a, b) => a.price - b.price);
    } else if (sortOrder === 'price-high') {
      filtered.sort((a, b) => b.price - a.price);
    } else if (sortOrder === 'newest') {
      filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    const totalItems = filtered.length;

    // Show empty no-results state
    if (totalItems === 0) {
      catalogGrid.innerHTML = `
        <div class="no-results-state text-center" style="grid-column: 1/-1; padding: 4rem 2rem;">
          <span style="font-size: 3.5rem;">🌸</span>
          <h3 style="margin-top: var(--space-md); color: var(--primary);">No Arrangements Found</h3>
          <p class="text-secondary" style="max-width: 400px; margin: var(--space-sm) auto var(--space-lg);">We couldn't find any flower arrangements matching your selected criteria. Try adjusting your price range or category filters.</p>
          <button class="btn btn-outline" onclick="resetFilters()">Reset All Filters</button>
        </div>
      `;
      
      const rangeSpan = document.getElementById('results-range');
      const totalSpan = document.getElementById('results-total');
      if (rangeSpan && totalSpan) {
        rangeSpan.textContent = '0';
        totalSpan.textContent = '0';
      }
      renderPaginationControls(0);
      return;
    }

    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // Bound current page margins
    if (currentPage > totalPages) {
      currentPage = Math.max(1, totalPages);
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    const paginatedItems = filtered.slice(startIndex, endIndex);

    // Re-render catalog grid
    if (typeof renderProducts === 'function') {
      renderProducts(paginatedItems, catalogGrid);
      
      // Update displayed range counts
      const rangeSpan = document.getElementById('results-range');
      const totalSpan = document.getElementById('results-total');
      if (rangeSpan && totalSpan) {
        rangeSpan.textContent = `${startIndex + 1}-${endIndex}`;
        totalSpan.textContent = totalItems;
      }

      // Render pagination links
      renderPaginationControls(totalPages);
    }
  } catch (err) {
    console.error('Error loading filtered products:', err);
    catalogGrid.innerHTML = '<p class="text-secondary" style="grid-column: 1/-1; padding: 2rem; text-align: center;">Could not load products. Please check your connection or reload the page.</p>';
  }
}

/**
 * Dynamically builds page navigation buttons
 * @param {number} totalPages - Total pages count
 */
function renderPaginationControls(totalPages) {
  const paginationContainer = document.querySelector('.pagination');
  if (!paginationContainer) return;

  paginationContainer.innerHTML = '';

  if (totalPages <= 1) {
    paginationContainer.style.display = 'none';
    return;
  }

  paginationContainer.style.display = 'flex';

  // Left Arrow "«"
  const prevBtn = document.createElement('button');
  prevBtn.className = 'page-btn';
  prevBtn.innerHTML = '«';
  prevBtn.disabled = currentPage === 1;
  prevBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      applyCatalogFilters(null, true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
  paginationContainer.appendChild(prevBtn);

  // Numbered pages
  for (let i = 1; i <= totalPages; i++) {
    const pageBtn = document.createElement('button');
    pageBtn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
    pageBtn.textContent = i;
    pageBtn.addEventListener('click', () => {
      currentPage = i;
      applyCatalogFilters(null, true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    paginationContainer.appendChild(pageBtn);
  }

  // Right Arrow "»"
  const nextBtn = document.createElement('button');
  nextBtn.className = 'page-btn';
  nextBtn.innerHTML = '»';
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage++;
      applyCatalogFilters(null, true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
  paginationContainer.appendChild(nextBtn);
}

/**
 * Reset all catalog search queries, checkboxes, and sliders back to defaults
 */
function resetFilters() {
  const searchInput = document.getElementById('nav-search-input');
  if (searchInput) searchInput.value = '';
  const searchInputMobile = document.getElementById('nav-search-input-mobile');
  if (searchInputMobile) searchInputMobile.value = '';
  
  // Clear search query param in URL
  window.history.pushState({}, '', window.location.pathname);
  
  // Reset active category link
  const categoryLinks = document.querySelectorAll('.category-list a');
  categoryLinks.forEach(l => l.classList.remove('active'));
  const allLink = document.querySelector('.category-list a[data-category="all"]');
  if (allLink) allLink.classList.add('active');
  
  // Reset price slider
  const slider = document.getElementById('price-range-slider');
  const sliderValue = document.getElementById('price-slider-value');
  if (slider && sliderValue) {
    slider.value = 5000;
    sliderValue.textContent = '5000';
  }
  
  // Reset checkboxes
  const chkStock = document.getElementById('chk-instock');
  if (chkStock) chkStock.checked = false;
  const chkDeliv = document.getElementById('chk-delivery');
  if (chkDeliv) chkDeliv.checked = false;
  
  // Re-run filter fetch
  applyCatalogFilters('', false);
}

/**
 * Computes category products statistics dynamically based on raw catalog array
 * @param {Array} allProducts - Full products list fetched from DB
 */
function updateCategoryBadges(allProducts, query = null) {
  // Read current filter states
  const slider = document.getElementById('price-range-slider');
  const maxPrice = slider ? parseFloat(slider.value) : 5000;
  
  const chkStock = document.getElementById('chk-instock');
  const showOnlyInStock = chkStock ? chkStock.checked : false;

  // Apply filters to counts
  let filteredForCounts = [...allProducts];
  
  // Apply Search query filter for counts if present
  if (query && query.trim() !== '') {
    const lowerQuery = query.toLowerCase().trim();
    filteredForCounts = filteredForCounts.filter(item => {
      const nameMatch = item.name && item.name.toLowerCase().includes(lowerQuery);
      const categoryMatch = item.category && item.category.toLowerCase().includes(lowerQuery);
      const descMatch = item.description && item.description.toLowerCase().includes(lowerQuery);
      const tagsMatch = item.deliveryTags && item.deliveryTags.some(tag => tag.toLowerCase().includes(lowerQuery));
      return nameMatch || categoryMatch || descMatch || tagsMatch;
    });
  }

  if (showOnlyInStock) {
    filteredForCounts = filteredForCounts.filter(item => item.stock === undefined || item.stock > 0);
  }
  filteredForCounts = filteredForCounts.filter(item => item.price <= maxPrice);

  const counts = {};
  const categoryLinks = document.querySelectorAll('.category-list a');
  categoryLinks.forEach(link => {
    const catName = link.getAttribute('data-category');
    if (catName && catName !== 'all') {
      counts[catName] = 0;
    }
  });
  
  filteredForCounts.forEach(p => {
    if (p.category && counts[p.category] !== undefined) {
      counts[p.category]++;
    }
  });

  const total = filteredForCounts.length;

  const allLinkBadge = document.querySelector('.category-list a[data-category="all"] .badge');
  if (allLinkBadge) allLinkBadge.textContent = `(${total})`;

  for (const cat in counts) {
    const badge = document.querySelector(`.category-list a[data-category="${cat}"] .badge`);
    if (badge) {
      badge.textContent = `(${counts[cat]})`;
    }
  }
}
