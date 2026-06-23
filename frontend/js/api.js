/*
 * Api.js - Central API Fetch Client for Florish
 * Purpose: Provides a modular fetch wrapper with JWT interceptors, base API path resolution, timeout limits, offline checks, and error parsing.
 */

// Central API Config
// In local dev, it uses localhost. In production, it defaults to the live Render URL.
const PRODUCTION_API_URL = 'https://finalyearproject-qn8h.onrender.com/api';

const API_BASE_URL = localStorage.getItem('florish_api_url') || (
  (
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' || 
    window.location.hostname.startsWith('192.168.') || 
    window.location.hostname.startsWith('10.') || 
    window.location.hostname.startsWith('172.16.') || 
    window.location.hostname.endsWith('.local') ||
    window.location.hostname.includes('localhost') ||
    window.location.hostname === ''
  )
    ? 'http://localhost:5000/api'
    : PRODUCTION_API_URL
);


class ApiClient {
  /**
   * Performs an HTTP request with auth header, offline checks, and a 15-second timeout.
   * @param {string} endpoint - API route (e.g. '/auth/login')
   * @param {object} options - Fetch options
   */
  async request(endpoint, options = {}) {
    // 1. Offline network check
    if (!window.navigator.onLine) {
      const offlineErr = new Error('You are currently offline. Please check your internet connection and try again.');
      console.error(`Offline API Error on ${endpoint}:`, offlineErr.message);
      throw offlineErr;
    }

    const token = localStorage.getItem('florish_token');
    
    // Set headers
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // 2. Timeout implementation (15 seconds limit)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const config = {
      ...options,
      headers,
      signal: controller.signal,
    };

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');

      console.log(`[DIAGNOSTICS] Final API URL: ${API_BASE_URL}${endpoint}`);
      console.log(`[DIAGNOSTICS] Response Status: ${response.status}`);
      console.log(`[DIAGNOSTICS] Content-Type: ${contentType}`);

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('florish_token');
          localStorage.removeItem('florish_user');
          localStorage.removeItem('florish_cart');
          
          const path = window.location.pathname;
          if (path.includes('/admin/') && !path.includes('login.html')) {
            window.location.href = 'login.html';
          } else if (path.includes('orders.html') || path.includes('checkout.html')) {
            window.location.href = 'login.html';
          } else {
            window.location.reload();
          }
        }

        let errMsg = `Request failed with status ${response.status}`;
        if (isJson) {
          try {
            const data = await response.json();
            errMsg = data.message || errMsg;
          } catch (e) {}
        } else {
          if (response.status === 503) {
            errMsg = 'The server is temporarily unavailable (503 Service Unavailable). It might be suspended, sleeping, or undergoing maintenance. Please try again later.';
          } else if (contentType.includes('text/html')) {
            errMsg = `Server returned an HTML error page (Status ${response.status}).`;
          } else {
            errMsg = `Server returned an invalid response (Status ${response.status}).`;
          }
        }
        throw new Error(errMsg);
      }

      if (!isJson) {
        throw new Error(`Expected JSON response from server but received Content-Type: "${contentType}"`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      
      // Clean, actionable timeout message (helpful if Render free tier is sleeping)
      if (error.name === 'AbortError') {
        const timeoutErr = new Error('The server is taking longer to respond. It may be waking up from sleep on the Render free tier (which takes 30-50 seconds). Please try again in a few moments.');
        console.error(`API Timeout on ${endpoint}:`, timeoutErr.message);
        throw timeoutErr;
      }

      if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
        const fetchErr = new Error('Unable to connect to the Florish server. The service might be temporarily offline, sleeping on the Render free tier, or there is a network connection issue. Please check your internet connection and try again.');
        console.error(`API Connection Failure on ${endpoint}:`, fetchErr.message);
        throw fetchErr;
      }

      console.error(`API Error on ${endpoint}:`, error.message);
      throw error;
    }
  }

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) });
  }

  put(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }

  patch(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PATCH', body: JSON.stringify(body) });
  }

  /**
   * Multipart/form-data upload using fetch for Multer compatibility, with 15s timeout and method override.
   * @param {string} endpoint - API route
   * @param {FormData} formData - Multipart data
   * @param {string} method - HTTP Verb ('POST' or 'PUT')
   */
  async upload(endpoint, formData, method = 'POST') {
    // Offline network check
    if (!window.navigator.onLine) {
      const offlineErr = new Error('You are currently offline. Please check your connection and try again.');
      throw offlineErr;
    }

    const token = localStorage.getItem('florish_token');
    const headers = {};

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Timeout implementation (15 seconds limit)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        headers,
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('florish_token');
          localStorage.removeItem('florish_user');
          localStorage.removeItem('florish_cart');
          
          const path = window.location.pathname;
          if (path.includes('/admin/') && !path.includes('login.html')) {
            window.location.href = 'login.html';
          } else if (path.includes('orders.html') || path.includes('checkout.html')) {
            window.location.href = 'login.html';
          } else {
            window.location.reload();
          }
        }

        let errMsg = 'Image upload failed';
        if (isJson) {
          try {
            const data = await response.json();
            errMsg = data.message || errMsg;
          } catch (e) {}
        } else {
          if (response.status === 503) {
            errMsg = 'The server is temporarily unavailable (503 Service Unavailable). It might be suspended, sleeping, or undergoing maintenance. Please try again later.';
          } else {
            errMsg = `Upload request failed with status ${response.status}.`;
          }
        }
        throw new Error(errMsg);
      }

      if (!isJson) {
        throw new Error(`Expected JSON response from upload server but received Content-Type: "${contentType}"`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        const timeoutErr = new Error('The upload timed out. The server may be waking up from sleep on the Render free tier. Please try again.');
        console.error(`Upload Timeout on ${endpoint}:`, timeoutErr.message);
        throw timeoutErr;
      }

      if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
        const fetchErr = new Error('Unable to connect to the Florish server for upload. The service might be temporarily offline, sleeping on the Render free tier, or there is a network connection issue. Please check your internet connection and try again.');
        console.error(`Upload Connection Failure on ${endpoint}:`, fetchErr.message);
        throw fetchErr;
      }

      console.error(`Upload Error on ${endpoint}:`, error.message);
      throw error;
    }
  }
}

const api = new ApiClient();

// Global price formatter for Indian Rupees (INR)
function formatINR(price) {
  const num = Number(price);
  if (isNaN(num)) return '₹0';
  const formattedNumber = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: num % 1 === 0 ? 0 : 2,
    maximumFractionDigits: num % 1 === 0 ? 0 : 2
  }).format(num);
  return `₹${formattedNumber}`;
}
window.formatINR = formatINR;

