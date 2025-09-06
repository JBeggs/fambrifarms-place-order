// API utilities for backend communication
// Handles all API calls, error handling, and endpoint management

function getBackendUrl() {
  if (!window.api) {
    console.error('[renderer] window.api not available');
    throw new Error('window.api not available - preload script failed');
  }
  if (typeof window.api.getBackendUrl !== 'function') {
    console.error('[renderer] window.api.getBackendUrl not available');
    throw new Error('window.api.getBackendUrl not available - preload script incomplete');
  }
  try {
    return window.api.getBackendUrl();
  } catch (error) {
    console.error('[renderer] Failed to get backend URL:', error);
    throw new Error('Failed to get backend URL');
  }
}

let BACKEND_API_URL = getBackendUrl();

// Handle if .env contains /api/ path - remove it to get base URL
if (BACKEND_API_URL.endsWith('/api/')) {
  BACKEND_API_URL = BACKEND_API_URL.replace(/\/api\/$/, '');
} else if (BACKEND_API_URL.endsWith('/api')) {
  BACKEND_API_URL = BACKEND_API_URL.replace(/\/api\/?$/, '');
}

// API Endpoints
const ENDPOINTS = {
  ORDERS_FROM_WHATSAPP: BACKEND_API_URL ? `${BACKEND_API_URL.replace(/\/$/, '')}/api/orders/from-whatsapp/` : '',
  CUSTOMERS: BACKEND_API_URL ? `${BACKEND_API_URL.replace(/\/$/, '')}/api/auth/customers/` : '',
  PRODUCTS: BACKEND_API_URL ? `${BACKEND_API_URL.replace(/\/$/, '')}/api/products/products/` : '',
  DEPARTMENTS: BACKEND_API_URL ? `${BACKEND_API_URL.replace(/\/$/, '')}/api/products/departments/` : '',
  PROCUREMENT: BACKEND_API_URL ? `${BACKEND_API_URL.replace(/\/$/, '')}/api/procurement/purchase-orders/create/` : '',
  SUPPLIERS: BACKEND_API_URL ? `${BACKEND_API_URL.replace(/\/$/, '')}/api/suppliers/suppliers/` : '',
  SALES_REPS: BACKEND_API_URL ? `${BACKEND_API_URL.replace(/\/$/, '')}/api/suppliers/sales-reps/` : '',
  UNITS: BACKEND_API_URL ? `${BACKEND_API_URL.replace(/\/$/, '')}/api/inventory/units/` : '',
  BUSINESS_SETTINGS: BACKEND_API_URL ? `${BACKEND_API_URL.replace(/\/$/, '')}/api/products/business-settings/` : '',
  ORDERS_LIST: BACKEND_API_URL ? `${BACKEND_API_URL.replace(/\/$/, '')}/api/orders/` : '',
  ORDER_DETAIL: BACKEND_API_URL ? `${BACKEND_API_URL.replace(/\/$/, '')}/api/orders/` : '',
  ORDER_DELETE: BACKEND_API_URL ? `${BACKEND_API_URL.replace(/\/$/, '')}/api/orders/` : ''
};

function handleApiError(error, operation = 'API operation') {
  console.error(`[renderer] ${operation} failed:`, error);
  
  let errorMessage = `${operation} failed: `;
  
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    errorMessage += 'Cannot connect to backend server. Please check if the backend is running.';
  } else if (error.name === 'AbortError') {
    errorMessage += 'Request timed out. Please check your connection.';
  } else if (error.status) {
    switch (error.status) {
      case 404:
        errorMessage += 'API endpoint not found. Please check backend configuration.';
        break;
      case 500:
        errorMessage += 'Backend server error. Please try again later.';
        break;
      case 403:
        errorMessage += 'Access denied. Please check authentication.';
        break;
      default:
        errorMessage += `Server returned error ${error.status}: ${error.statusText ? error.statusText : 'No status text'}`;
    }
  } else {
    errorMessage += error.message ? error.message : 'Unknown error occurred';
  }
  
  return errorMessage;
}

async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

function showApiError(message) {
  const hintEl = document.getElementById('hint');
  if (hintEl) {
    hintEl.textContent = message;
    hintEl.style.color = '#d32f2f';
    hintEl.style.fontWeight = 'bold';
  }
  
  // Also show in console for debugging
  console.error('[renderer] API Error:', message);
}

// Generic API call function
async function makeApiCall(endpoint, options = {}) {
  if (!endpoint) {
    throw new Error('Backend URL not configured. Cannot make API call.');
  }
  
  try {
    const response = await fetchWithTimeout(endpoint, options);
    
    if (!response.ok) {
      let errorData = {};
      try {
        errorData = await response.json();
      } catch (jsonError) {
        console.error('[renderer] Failed to parse error response JSON:', jsonError);
      }
      throw {
        status: response.status,
        statusText: response.statusText,
        message: errorData.error ? errorData.error : `HTTP ${response.status}: ${response.statusText}`
      };
    }
    
    return await response.json();
  } catch (error) {
    throw error;
  }
}

export {
  ENDPOINTS,
  handleApiError,
  fetchWithTimeout,
  showApiError,
  makeApiCall,
  getBackendUrl
};
