// Global variables - will be initialized when DOM is ready
let messagesListEl, selectedMessagesListEl, orderPreviewEl, customerSelectEl, verifiedEl, hintEl;
let panelMessages, panelDebug, tabMessages, tabDebug, debugPreEl, debugPostEl;
let btnSelectAll, btnClearSelection, btnCreateOrder, btnSkipMessages, btnClose;

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
    return '';
  }
}

// Old getCompanyAliases and getForwarderNames functions removed - not needed for manual selection

let BACKEND_API_URL = getBackendUrl();

// Handle if .env contains /api/ path - remove it to get base URL
if (BACKEND_API_URL.endsWith('/api/')) {
  BACKEND_API_URL = BACKEND_API_URL.replace(/\/api\/$/, '');
} else if (BACKEND_API_URL.endsWith('/api')) {
  BACKEND_API_URL = BACKEND_API_URL.replace(/\/api\/?$/, '');
}

const ENDPOINT = BACKEND_API_URL ? `${BACKEND_API_URL.replace(/\/$/, '')}/api/orders/from-whatsapp/` : '';
const CUSTOMERS_ENDPOINT = BACKEND_API_URL ? `${BACKEND_API_URL.replace(/\/$/, '')}/api/auth/customers/` : '';
const PRODUCTS_ENDPOINT = BACKEND_API_URL ? `${BACKEND_API_URL.replace(/\/$/, '')}/api/products/products/` : '';
const DEPARTMENTS_ENDPOINT = BACKEND_API_URL ? `${BACKEND_API_URL.replace(/\/$/, '')}/api/products/departments/` : '';
const PROCUREMENT_ENDPOINT = BACKEND_API_URL ? `${BACKEND_API_URL.replace(/\/$/, '')}/api/procurement/purchase-orders/create/` : '';
const SUPPLIERS_ENDPOINT = BACKEND_API_URL ? `${BACKEND_API_URL.replace(/\/$/, '')}/api/suppliers/suppliers/` : '';
const SALES_REPS_ENDPOINT = BACKEND_API_URL ? `${BACKEND_API_URL.replace(/\/$/, '')}/api/suppliers/sales-reps/` : '';
const UNITS_ENDPOINT = BACKEND_API_URL ? `${BACKEND_API_URL.replace(/\/$/, '')}/api/inventory/units/` : '';
const BUSINESS_SETTINGS_ENDPOINT = BACKEND_API_URL ? `${BACKEND_API_URL.replace(/\/$/, '')}/api/products/business-settings/` : '';

// API Error handling utilities
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

function generateUnitOptions(selectedUnit = '') {
  if (!units) {
    throw new Error('Units data is required but not loaded');
  }
  if (units.length === 0) {
    throw new Error('Units not loaded from API. Cannot generate unit options. Check backend connectivity and ensure loadUnits() completes successfully.');
  }
  
  return units.map(unit => 
    `<option value="${unit.abbreviation}" ${selectedUnit === unit.abbreviation ? 'selected' : ''}>${unit.abbreviation} - ${unit.name}</option>`
  ).join('');
}

// Helper functions to get configurable defaults
function getDefaultMinimumLevel() {
  if (!businessSettings?.default_minimum_level) {
    throw new Error('BusinessSettings not loaded or default_minimum_level not configured');
  }
  return businessSettings.default_minimum_level;
}

function getDefaultReorderLevel() {
  if (!businessSettings?.default_reorder_level) {
    throw new Error('BusinessSettings not loaded or default_reorder_level not configured');
  }
  return businessSettings.default_reorder_level;
}

function getDefaultOrderQuantity() {
  if (!businessSettings?.default_order_quantity) {
    throw new Error('BusinessSettings not loaded or default_order_quantity not configured');
  }
  return businessSettings.default_order_quantity;
}

function getDefaultWeightUnit() {
  if (!businessSettings?.default_weight_unit_abbr) {
    throw new Error('BusinessSettings not loaded or default_weight_unit_abbr not configured');
  }
  return businessSettings.default_weight_unit_abbr;
}

function getDefaultCountUnit() {
  if (!businessSettings?.default_count_unit_abbr) {
    throw new Error('BusinessSettings not loaded or default_count_unit_abbr not configured');
  }
  return businessSettings.default_count_unit_abbr;
}

function getMinPhoneDigits() {
  if (!businessSettings?.min_phone_digits) {
    throw new Error('BusinessSettings not loaded or min_phone_digits not configured');
  }
  return businessSettings.min_phone_digits;
}

function requireEmailValidation() {
  return businessSettings?.require_email_validation !== false;
}

function requireBatchTracking() {
  return businessSettings?.require_batch_tracking !== false;
}

function requireExpiryDates() {
  return businessSettings?.require_expiry_dates !== false;
}

function requireQualityGrades() {
  return businessSettings?.require_quality_grades !== false;
}

// Generate quality grade options
function generateQualityGradeOptions(selectedGrade = 'B') {
  const grades = [
    {value: 'A', label: 'Grade A - Premium'},
    {value: 'B', label: 'Grade B - Standard'},
    {value: 'C', label: 'Grade C - Economy'},
    {value: 'R', label: 'Grade R - Reject/Processing'}
  ];
  
  return grades.map(grade => 
    `<option value="${grade.value}" ${selectedGrade === grade.value ? 'selected' : ''}>${grade.label}</option>`
  ).join('');
}

// Unit conversion functions
function findUnitByAbbreviation(abbreviation) {
  return units.find(unit => unit.abbreviation === abbreviation);
}

function convertQuantity(quantity, fromUnit, toUnit) {
  /**
   * Convert quantity from one unit to another
   * Uses base_unit_multiplier for conversion
   */
  if (!fromUnit) {
    console.warn('[renderer] From unit not found for conversion');
    return null;
  }
  if (!toUnit) {
    console.warn('[renderer] To unit not found for conversion');
    return null;
  }
  if (fromUnit.abbreviation === toUnit.abbreviation) {
    return quantity;
  }
  
  // Convert to base unit first, then to target unit
  const baseQuantity = quantity * parseFloat(fromUnit.base_unit_multiplier);
  const convertedQuantity = baseQuantity / parseFloat(toUnit.base_unit_multiplier);
  
  return Math.round(convertedQuantity * 10000) / 10000; // Round to 4 decimal places
}

function getUnitConversionInfo(supplierUnit, internalUnit) {
  /**
   * Get conversion information between supplier and internal units
   */
  const fromUnit = findUnitByAbbreviation(supplierUnit);
  const toUnit = findUnitByAbbreviation(internalUnit);
  
  if (!fromUnit) {
    console.warn('[renderer] From unit not found for conversion info');
    return null;
  }
  if (!toUnit) {
    console.warn('[renderer] To unit not found for conversion info');
    return null;
  }
  
  // Check if units are compatible (both weight or both count)
  if (fromUnit.is_weight !== toUnit.is_weight) {
    return {
      canConvert: false,
      error: 'Cannot convert between weight and count units'
    };
  }
  
  const conversionFactor = parseFloat(fromUnit.base_unit_multiplier) / parseFloat(toUnit.base_unit_multiplier);
  
  return {
    canConvert: true,
    fromUnit: fromUnit,
    toUnit: toUnit,
    conversionFactor: conversionFactor,
    description: `1 ${fromUnit.abbreviation} = ${conversionFactor} ${toUnit.abbreviation}`
  };
}

function showUnitConversionHelper(supplierUnit, internalUnit, quantity = 1) {
  /**
   * Show unit conversion helper in the UI
   */
  const conversion = getUnitConversionInfo(supplierUnit, internalUnit);
  
  if (!conversion.canConvert) {
    return `<span style="color: #d32f2f;">⚠️ ${conversion.error}</span>`;
  }
  
  const convertedQuantity = convertQuantity(quantity, conversion.fromUnit, conversion.toUnit);
  
  return `
    <div style="background: #f5f5f5; padding: 8px; border-radius: 4px; font-size: 12px; margin-top: 4px;">
      <strong>Unit Conversion:</strong><br>
      ${quantity} ${supplierUnit} = ${convertedQuantity} ${internalUnit}<br>
      <em>${conversion.description}</em>
    </div>
  `;
}

// Validation functions using business settings
function validatePhoneNumber(phone) {
  if (!phone) return false;
  
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Check against configurable minimum digits
  const minDigits = getMinPhoneDigits();
  return cleaned.length >= minDigits;
}

function validateEmail(email) {
  if (!requireEmailValidation()) {
    return true; // Skip validation if not required
  }
  
  if (!email) return false;
  
  // Basic email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePrice(price, historicalAverage = null) {
  /**
   * Validate price against business rules
   * This is a frontend validation - backend will do the full historical analysis
   */
  if (!price) {
    console.warn('[renderer] Price is required for validation');
    return { isValid: false, message: 'Price is required' };
  }
  if (price <= 0) {
    return {
      isValid: false,
      message: 'Price must be greater than 0'
    };
  }
  
  // Check if price is reasonable (basic sanity check)
  if (price > 10000) {
    return {
      isValid: false,
      message: 'Price seems unusually high. Please verify.',
      requiresApproval: true
    };
  }
  
  // If we have historical data, do a basic variance check
  if (historicalAverage && historicalAverage > 0) {
    const variance = Math.abs((price - historicalAverage) / historicalAverage) * 100;
    
    if (!businessSettings?.max_price_variance_percent) {
      throw new Error('BusinessSettings not loaded or max_price_variance_percent not configured');
    }
    const maxVariance = businessSettings.max_price_variance_percent;
    
    if (variance > maxVariance * 2) { // Double threshold for extreme variance
      return {
        isValid: false,
        message: `Price variance of ${variance.toFixed(1)}% is extremely high. Requires approval.`,
        requiresApproval: true
      };
    } else if (variance > maxVariance) {
      return {
        isValid: true,
        message: `Price variance of ${variance.toFixed(1)}% is high but acceptable.`,
        requiresReview: true
      };
    }
  }
  
  return {
    isValid: true,
    message: 'Price is within acceptable range'
  };
}

async function loadCustomers() {
  console.log('[renderer] DEBUG - Raw backend URL:', getBackendUrl());
  console.log('[renderer] DEBUG - Processed BACKEND_API_URL:', BACKEND_API_URL);
  console.log('[renderer] DEBUG - Final CUSTOMERS_ENDPOINT:', CUSTOMERS_ENDPOINT);
  
  if (!CUSTOMERS_ENDPOINT) {
    showApiError('Backend URL not configured. Cannot load customers.');
    return;
  }
  
  try {
    console.log('[renderer] Loading customers from:', CUSTOMERS_ENDPOINT);
    const response = await fetchWithTimeout(CUSTOMERS_ENDPOINT);
    
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
    
    const data = await response.json();
    if (!data.customers) {
      throw new Error('Invalid API response: customers field missing');
    }
    customers = data.customers;
    
    console.log('[renderer] Loaded customers:', customers.length);
    populateCustomerDropdown();
    
  } catch (error) {
    const errorMessage = handleApiError(error, 'Loading customers');
    showApiError(errorMessage);
    customers = [];
    populateCustomerDropdown(); // Show empty dropdown with error state
  }
}

async function loadBusinessSettings() {
  if (!BUSINESS_SETTINGS_ENDPOINT) {
    console.warn('[renderer] Backend URL not configured. Cannot load business settings.');
    businessSettings = null;
    return;
  }
  
  try {
    console.log('[renderer] Loading business settings from:', BUSINESS_SETTINGS_ENDPOINT);
    const response = await fetchWithTimeout(BUSINESS_SETTINGS_ENDPOINT);
    
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
    
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      businessSettings = data.results[0];
    } else if (data && !data.results) {
      businessSettings = data;
    } else {
      throw new Error('Invalid BusinessSettings API response: no data found');
    }
    console.log('[renderer] Loaded business settings:', businessSettings);
  } catch (error) {
    const errorMessage = handleApiError(error, 'Loading business settings');
    console.error('[renderer] Failed to load business settings:', errorMessage);
    showApiError(errorMessage);
    businessSettings = null;
  }
}

async function loadUnits() {
  if (!UNITS_ENDPOINT) {
    console.warn('[renderer] Backend URL not configured. Cannot load units.');
    units = [];
    return;
  }
  
  try {
    console.log('[renderer] Loading units of measure from:', UNITS_ENDPOINT);
    const response = await fetchWithTimeout(UNITS_ENDPOINT);
    
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
    
    const data = await response.json();
    if (data.results) {
      units = data.results;
    } else if (Array.isArray(data)) {
      units = data;
    } else {
      throw new Error('Invalid Units API response: expected array or results field');
    }
    console.log(`[renderer] Loaded ${units.length} units of measure`);
  } catch (error) {
    const errorMessage = handleApiError(error, 'Loading units');
    console.error('[renderer] Failed to load units:', errorMessage);
    // Fallback to basic units if API fails - NO SILENT FALLBACKS
    showApiError(errorMessage);
    units = [];
  }
}

async function loadProducts() {
  if (!PRODUCTS_ENDPOINT) {
    console.warn('[renderer] Backend URL not configured. Cannot load products.');
    products = [];
    return;
  }
  
  try {
    console.log('[renderer] Loading products from:', PRODUCTS_ENDPOINT);
    const response = await fetchWithTimeout(PRODUCTS_ENDPOINT);
    
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
    
    const data = await response.json();
    if (data.results) {
      products = data.results;
    } else if (Array.isArray(data)) {
      products = data;
    } else {
      throw new Error('Invalid Products API response: expected array or results field');
    }
    console.log('[renderer] Loaded products:', products.length);
    
  } catch (error) {
    const errorMessage = handleApiError(error, 'Loading products');
    console.warn('[renderer]', errorMessage);
    products = [];
  }
}

function populateCustomerDropdown() {
  const customerSelect = document.getElementById('customerSelect');
  if (!customerSelect) return;
  
  // Clear existing options
  customerSelect.innerHTML = '<option value="">Select Customer...</option>';
  
  // Add info message if no customers (but don't return early)
  if (customers.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No customers found - add one below';
    option.disabled = true;
    customerSelect.appendChild(option);
  }
  
  // Add customer options
  customers.forEach(customer => {
    const option = document.createElement('option');
    option.value = customer.id;
    
    // Display format: "Business Name - Branch (First Last)" or "Business Name (First Last)"
    const businessName = customer.restaurant_profile?.business_name;
    if (!businessName) {
      console.error('[renderer] Customer missing business_name:', customer);
      return; // Skip customers without business name
    }
    
    const branchName = customer.restaurant_profile?.branch_name;
    const firstName = customer.first_name ? customer.first_name : '';
    const lastName = customer.last_name ? customer.last_name : '';
    const contactName = `${firstName} ${lastName}`.trim();
    
    let displayName = businessName;
    if (branchName) {
      displayName = `${businessName} - ${branchName}`;
    }
    option.textContent = contactName ? `${displayName} (${contactName})` : displayName;
    
    customerSelect.appendChild(option);
  });
  
  // Add "Add New Customer" option
  const addNewOption = document.createElement('option');
  addNewOption.value = 'ADD_NEW';
  addNewOption.textContent = '+ Add New Customer';
  addNewOption.style.fontStyle = 'italic';
  addNewOption.style.color = '#2196f3';
  customerSelect.appendChild(addNewOption);
}

async function createNewCustomer(customerData) {
  if (!CUSTOMERS_ENDPOINT) {
    showApiError('Backend URL not configured. Cannot create customer.');
    return null;
  }
  
  try {
    console.log('[renderer] Creating new customer:', customerData);
    const response = await fetchWithTimeout(CUSTOMERS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(customerData)
    });
    
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
    
    const newCustomer = await response.json();
    console.log('[renderer] Created new customer:', newCustomer);
    
    // Add to local customers list and refresh dropdown
    customers.push(newCustomer);
    populateCustomerDropdown();
    
    return newCustomer;
    
  } catch (error) {
    const errorMessage = handleApiError(error, 'Creating new customer');
    showApiError(errorMessage);
    return null;
  }
}

async function loadDepartments() {
  if (!DEPARTMENTS_ENDPOINT) {
    console.warn('[renderer] Backend URL not configured. Cannot load departments.');
    departments = [];
    return;
  }
  
  try {
    console.log('[renderer] Loading departments from:', DEPARTMENTS_ENDPOINT);
    const response = await fetchWithTimeout(DEPARTMENTS_ENDPOINT);
    
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
    
    const data = await response.json();
    if (data.results) {
      departments = data.results;
    } else if (Array.isArray(data)) {
      departments = data;
    } else {
      throw new Error('Invalid Departments API response: expected array or results field');
    }
    console.log('[renderer] Loaded departments:', departments.length);
    
  } catch (error) {
    const errorMessage = handleApiError(error, 'Loading departments');
    console.warn('[renderer]', errorMessage);
    departments = [];
  }
}

async function loadSuppliers() {
  if (!SUPPLIERS_ENDPOINT) {
    console.warn('[renderer] Backend URL not configured. Cannot load suppliers.');
    suppliers = [];
    return;
  }
  
  try {
    console.log('[renderer] Loading suppliers from:', SUPPLIERS_ENDPOINT);
    const response = await fetchWithTimeout(SUPPLIERS_ENDPOINT);
    
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
    
    const data = await response.json();
    if (data.results) {
      suppliers = data.results;
    } else if (Array.isArray(data)) {
      suppliers = data;
    } else {
      throw new Error('Invalid Suppliers API response: expected array or results field');
    }
    console.log('[renderer] Loaded suppliers:', suppliers.length);
    
  } catch (error) {
    const errorMessage = handleApiError(error, 'Loading suppliers');
    console.warn('[renderer]', errorMessage);
    suppliers = [];
  }
}

async function loadSalesReps() {
  if (!SALES_REPS_ENDPOINT) {
    console.warn('[renderer] Backend URL not configured. Cannot load sales reps.');
    salesReps = [];
    return;
  }
  
  try {
    console.log('[renderer] Loading sales reps from:', SALES_REPS_ENDPOINT);
    const response = await fetchWithTimeout(SALES_REPS_ENDPOINT);
    
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
    
    const data = await response.json();
    if (data.results) {
      salesReps = data.results;
    } else if (Array.isArray(data)) {
      salesReps = data;
    } else {
      throw new Error('Invalid Sales Reps API response: expected array or results field');
    }
    console.log('[renderer] Loaded sales reps:', salesReps.length);
    
  } catch (error) {
    const errorMessage = handleApiError(error, 'Loading sales reps');
    console.warn('[renderer]', errorMessage);
    salesReps = [];
  }
}

function findProductByName(productName) {
  if (!productName) {
    console.warn('[renderer] Product name is required for search');
    return null;
  }
  if (!products.length) {
    console.warn('[renderer] No products available for search');
    return null;
  }
  
  const normalizedName = productName.toLowerCase().trim();
  
  // Direct name match
  let product = products.find(p => p.name.toLowerCase() === normalizedName);
  if (product) return product;
  
  // Check common names (alternative names)
  product = products.find(p => 
    p.common_names && 
    p.common_names.some(name => name.toLowerCase() === normalizedName)
  );
  if (product) return product;
  
  // Partial match in name
  product = products.find(p => 
    p.name.toLowerCase().includes(normalizedName) || 
    normalizedName.includes(p.name.toLowerCase())
  );
  if (product) return product;
  
  return null;
}

function getInventoryStatus(product) {
  if (!product) return { status: 'not_found', message: 'Product not in catalog' };
  
  // Check if inventory record exists (available_quantity is null/undefined means no inventory record)
  const hasInventoryRecord = product.available_quantity !== null && product.available_quantity !== undefined;
  const availableQty = product.available_quantity !== undefined ? product.available_quantity : 0;
  const reservedQty = product.reserved_quantity !== undefined ? product.reserved_quantity : 0;
  const needsProduction = product.needs_production === true;
  
  if (!hasInventoryRecord) {
  return {
      status: 'no_inventory', 
      message: 'No stock record',
      availableQuantity: 0,
      reservedQuantity: 0
    };
  } else if (availableQty > 0) {
    return { 
      status: 'available', 
      message: `${availableQty} available`,
      availableQuantity: availableQty,
      reservedQuantity: reservedQty
    };
  } else if (needsProduction) {
    return { 
      status: 'needs_production', 
      message: 'Needs production',
      availableQuantity: 0,
      reservedQuantity: reservedQty
    };
  } else {
    return { 
      status: 'out_of_stock', 
      message: 'Out of stock',
      availableQuantity: 0,
      reservedQuantity: reservedQty
    };
  }
}

async function createNewProduct(productData) {
  if (!PRODUCTS_ENDPOINT) {
    showApiError('Backend URL not configured. Cannot create product.');
    return null;
  }
  
  try {
    console.log('[renderer] Creating new product:', productData);
    const response = await fetchWithTimeout(PRODUCTS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(productData)
    });
    
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
    
    const newProduct = await response.json();
    console.log('[renderer] Created new product:', newProduct);
    
    // Add to local products list
    products.push(newProduct);
    
    return newProduct;
    
  } catch (error) {
    const errorMessage = handleApiError(error, 'Creating new product');
    showApiError(errorMessage);
    return null;
  }
}

async function showNewProductDialog(productName, unit = 'kg') {
  return new Promise((resolve) => {
    // Create modal dialog
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,0,0,0.5); display: flex; align-items: center; 
      justify-content: center; z-index: 1000;
    `;
    
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white; padding: 24px; border-radius: 8px; 
      width: 400px; max-width: 90vw; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    
    dialog.innerHTML = `
      <h3 style="margin: 0 0 16px 0; color: #333;">Add New Product</h3>
      <p style="margin: 0 0 16px 0; color: #666; font-size: 14px;">Product "${productName}" not found in system. Add it now:</p>
      <form id="newProductForm">
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Product Name *</label>
          <input type="text" id="productName" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" value="${productName}">
        </div>
        <div style="display: flex; gap: 12px; margin-bottom: 12px;">
          <div style="flex: 1;">
            <label style="display: block; margin-bottom: 4px; font-weight: 500;">Unit *</label>
            <select id="productUnit" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
              ${generateUnitOptions(unit)}
            </select>
          </div>
          <div style="flex: 1;">
            <label style="display: block; margin-bottom: 4px; font-weight: 500;">Price (R) *</label>
            <input type="number" id="productPrice" required min="0" step="0.01" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" placeholder="0.00">
          </div>
        </div>
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Department *</label>
          <select id="productDepartment" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            ${departments.map((dept, index) => `<option value="${dept.id}" ${index === 0 ? 'selected' : ''}>${dept.name}</option>`).join('')}
          </select>
        </div>
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Description</label>
          <textarea id="productDescription" rows="2" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical;" placeholder="Optional description..."></textarea>
        </div>
        <div id="errorMessage" style="color: #d32f2f; margin-bottom: 12px; display: none;"></div>
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button type="button" id="cancelBtn" style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">Cancel</button>
          <button type="submit" id="createBtn" style="padding: 8px 16px; border: none; background: #4caf50; color: white; border-radius: 4px; cursor: pointer;">Create Product</button>
        </div>
      </form>
    `;
    
    modal.appendChild(dialog);
    document.body.appendChild(modal);
    
    // Focus first input
    setTimeout(() => dialog.querySelector('#productName').focus(), 100);
    
    // Event handlers
    const form = dialog.querySelector('#newProductForm');
    const cancelBtn = dialog.querySelector('#cancelBtn');
    const errorDiv = dialog.querySelector('#errorMessage');
    
    const cleanup = () => {
      document.body.removeChild(modal);
    };
    
    const showError = (message) => {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
    };
    
    cancelBtn.addEventListener('click', () => {
      cleanup();
      resolve(null);
    });
    
    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        cleanup();
        resolve(null);
      }
    });
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const productData = {
        name: dialog.querySelector('#productName').value.trim(),
        unit: dialog.querySelector('#productUnit').value,
        price: parseFloat(dialog.querySelector('#productPrice').value),
        department: parseInt(dialog.querySelector('#productDepartment').value),
        description: dialog.querySelector('#productDescription').value.trim(),
        create_inventory: true  // Signal backend to create FinishedInventory record
      };
      
      // Basic validation
      if (!productData.name) {
        showError('Product name is required');
        return;
      }
      if (!productData.unit) {
        showError('Product unit is required');
        return;
      }
      if (!productData.price) {
        showError('Product price is required');
        return;
      }
      if (!productData.department) {
        showError('Product department is required');
        return;
      }
      
      if (productData.price <= 0) {
        showError('Price must be greater than 0');
        return;
      }
      
      // Disable form while creating
      const createBtn = dialog.querySelector('#createBtn');
      createBtn.disabled = true;
      createBtn.textContent = 'Creating...';
      
      try {
        const newProduct = await createNewProduct(productData);
        if (newProduct) {
          cleanup();
          resolve(newProduct);
        } else {
          // Error already shown by createNewProduct
          createBtn.disabled = false;
          createBtn.textContent = 'Create Product';
        }
      } catch (error) {
        showError('Failed to create product. Please try again.');
        createBtn.disabled = false;
        createBtn.textContent = 'Create Product';
      }
    });
  });
}

async function createProcurementOrder(orderData) {
  if (!PROCUREMENT_ENDPOINT) {
    showApiError('Backend URL not configured. Cannot create procurement order.');
    return null;
  }
  
  try {
    console.log('[renderer] Creating procurement order:', orderData);
    const response = await fetchWithTimeout(PROCUREMENT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderData)
    });
    
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
    
    const newOrder = await response.json();
    console.log('[renderer] Created procurement order:', newOrder);
    
    return newOrder;
    
  } catch (error) {
    const errorMessage = handleApiError(error, 'Creating procurement order');
    showApiError(errorMessage);
    return null;
  }
}

async function createInventoryRecord(inventoryData) {
  // For now, we'll use the products endpoint to update the product with inventory
  // In a full system, this would be a separate inventory endpoint
  if (!PRODUCTS_ENDPOINT) {
    showApiError('Backend URL not configured. Cannot create inventory record.');
    return null;
  }
  
  try {
    console.log('[renderer] Creating inventory record:', inventoryData);
    const response = await fetchWithTimeout(`${PRODUCTS_ENDPOINT}${inventoryData.product_id}/`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        create_inventory: true,
        initial_stock: inventoryData.initial_stock !== undefined ? inventoryData.initial_stock : 0
      })
    });
    
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
    
    const updatedProduct = await response.json();
    console.log('[renderer] Created inventory record:', updatedProduct);
    
    return updatedProduct;
    
  } catch (error) {
    const errorMessage = handleApiError(error, 'Creating inventory record');
    showApiError(errorMessage);
    return null;
  }
}

async function showInventoryDialog(product, requiredQuantity) {
  return new Promise((resolve) => {
    // Create modal dialog
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,0,0,0.5); display: flex; align-items: center; 
      justify-content: center; z-index: 1000;
    `;
    
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white; padding: 24px; border-radius: 8px; 
      width: 400px; max-width: 90vw; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    
    dialog.innerHTML = `
      <h3 style="margin: 0 0 16px 0; color: #333;">Add Stock Item</h3>
      <p style="margin: 0 0 16px 0; color: #666; font-size: 14px;">
        Create inventory record for: <strong>${product.name}</strong>
        <br>Required for order: ${requiredQuantity} ${product.unit}
      </p>
      <form id="inventoryForm">
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Initial Stock Quantity</label>
          <input type="number" id="initialStock" min="0" step="0.01" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" value="${Math.max(requiredQuantity, parseFloat(getDefaultOrderQuantity()))}" placeholder="0">
        </div>
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Minimum Stock Level</label>
          <input type="number" id="minLevel" min="0" step="0.01" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" value="${getDefaultMinimumLevel()}" placeholder="${getDefaultMinimumLevel()}">
        </div>
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Reorder Level</label>
          <input type="number" id="reorderLevel" min="0" step="0.01" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" value="${getDefaultReorderLevel()}" placeholder="${getDefaultReorderLevel()}">
        </div>
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Notes</label>
          <textarea id="notes" rows="2" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical;" placeholder="Initial stock setup notes..."></textarea>
        </div>
        <div id="errorMessage" style="color: #d32f2f; margin-bottom: 12px; display: none;"></div>
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button type="button" id="cancelBtn" style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">Cancel</button>
          <button type="submit" id="createBtn" style="padding: 8px 16px; border: none; background: #9c27b0; color: white; border-radius: 4px; cursor: pointer;">Create Stock Item</button>
        </div>
      </form>
    `;
    
    modal.appendChild(dialog);
    document.body.appendChild(modal);
    
    // Focus first input
    setTimeout(() => dialog.querySelector('#initialStock').focus(), 100);
    
    // Event handlers
    const form = dialog.querySelector('#inventoryForm');
    const cancelBtn = dialog.querySelector('#cancelBtn');
    const errorDiv = dialog.querySelector('#errorMessage');
    
    const cleanup = () => {
      document.body.removeChild(modal);
    };
    
    const showError = (message) => {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
    };
    
    cancelBtn.addEventListener('click', () => {
      cleanup();
      resolve(null);
    });
    
    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        cleanup();
        resolve(null);
      }
    });
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const inventoryData = {
        product_id: product.id,
        initial_stock: parseFloat(dialog.querySelector('#initialStock').value) ? parseFloat(dialog.querySelector('#initialStock').value) : 0,
        minimum_level: parseFloat(dialog.querySelector('#minLevel').value) ? parseFloat(dialog.querySelector('#minLevel').value) : parseFloat(getDefaultMinimumLevel()),
        reorder_level: parseFloat(dialog.querySelector('#reorderLevel').value) ? parseFloat(dialog.querySelector('#reorderLevel').value) : parseFloat(getDefaultReorderLevel()),
        notes: dialog.querySelector('#notes').value.trim()
      };
      
      // Basic validation
      if (inventoryData.initial_stock < 0) {
        showError('Initial stock cannot be negative');
        return;
      }
      
      // Disable form while creating
      const createBtn = dialog.querySelector('#createBtn');
      createBtn.disabled = true;
      createBtn.textContent = 'Creating...';
      
      try {
        const result = await createInventoryRecord(inventoryData);
        if (result) {
          cleanup();
          resolve(result);
        } else {
          // Error already shown by createInventoryRecord
          createBtn.disabled = false;
          createBtn.textContent = 'Create Stock Item';
        }
      } catch (error) {
        showError('Failed to create stock item. Please try again.');
        createBtn.disabled = false;
        createBtn.textContent = 'Create Stock Item';
      }
    });
  });
}

async function updateInventoryStock(productId, addQuantity) {
  // For now, we'll use a simple approach to add stock
  // In a full system, this would be a proper inventory adjustment endpoint
  if (!PRODUCTS_ENDPOINT) {
    showApiError('Backend URL not configured. Cannot update stock.');
    return null;
  }
  
  try {
    console.log('[renderer] Adding stock to inventory:', { productId, addQuantity });
    
    // This is a simplified approach - in reality you'd have a proper inventory adjustment API
    const response = await fetchWithTimeout(`${PRODUCTS_ENDPOINT}${productId}/`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        add_stock: addQuantity,
        adjustment_type: 'manual_add'
      })
    });
    
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
    
    const updatedProduct = await response.json();
    console.log('[renderer] Updated inventory:', updatedProduct);
    
    return updatedProduct;
    
  } catch (error) {
    const errorMessage = handleApiError(error, 'Adding stock');
    showApiError(errorMessage);
    return null;
  }
}

async function showAddStockDialog(product, requiredQuantity) {
  return new Promise((resolve) => {
    // Create modal dialog
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,0,0,0.5); display: flex; align-items: center; 
      justify-content: center; z-index: 1000;
    `;
    
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white; padding: 24px; border-radius: 8px; 
      width: 400px; max-width: 90vw; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    
    const currentStock = product.available_quantity !== undefined ? product.available_quantity : 0;
    
    dialog.innerHTML = `
      <h3 style="margin: 0 0 16px 0; color: #333;">Add Existing Stock</h3>
      <p style="margin: 0 0 16px 0; color: #666; font-size: 14px;">
        Add stock you already have on hand for: <strong>${product.name}</strong>
        <br>Current stock: ${currentStock} ${product.unit}
        <br>Required for order: ${requiredQuantity} ${product.unit}
      </p>
      <form id="addStockForm">
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Quantity to Add *</label>
          <input type="number" id="addQuantity" required min="0.01" step="0.01" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" value="${Math.max(requiredQuantity, parseFloat(getDefaultOrderQuantity()))}" placeholder="0">
        </div>
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Reason for Addition</label>
          <select id="reason" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            <option value="found_stock">Found existing stock</option>
            <option value="manual_count">Manual stock count adjustment</option>
            <option value="returned_goods">Returned goods</option>
            <option value="other">Other</option>
          </select>
        </div>
        ${requireBatchTracking() ? `
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Batch/Lot Number *</label>
          <input type="text" id="batchNumber" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" placeholder="Enter batch or lot number">
        </div>
        ` : ''}
        ${requireQualityGrades() ? `
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Quality Grade *</label>
          <select id="qualityGrade" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            ${generateQualityGradeOptions()}
          </select>
        </div>
        ` : ''}
        ${requireExpiryDates() ? `
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Expiry Date</label>
          <input type="date" id="expiryDate" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
        </div>
        ` : ''}
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Notes</label>
          <textarea id="notes" rows="2" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical;" placeholder="Additional notes about this stock addition..."></textarea>
        </div>
        <div id="errorMessage" style="color: #d32f2f; margin-bottom: 12px; display: none;"></div>
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button type="button" id="cancelBtn" style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">Cancel</button>
          <button type="submit" id="addBtn" style="padding: 8px 16px; border: none; background: #9c27b0; color: white; border-radius: 4px; cursor: pointer;">Add Stock</button>
        </div>
      </form>
    `;
    
    modal.appendChild(dialog);
    document.body.appendChild(modal);
    
    // Focus first input
    setTimeout(() => dialog.querySelector('#addQuantity').focus(), 100);
    
    // Event handlers
    const form = dialog.querySelector('#addStockForm');
    const cancelBtn = dialog.querySelector('#cancelBtn');
    const errorDiv = dialog.querySelector('#errorMessage');
    
    const cleanup = () => {
      document.body.removeChild(modal);
    };
    
    const showError = (message) => {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
    };
    
    cancelBtn.addEventListener('click', () => {
      cleanup();
      resolve(null);
    });
    
    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        cleanup();
        resolve(null);
      }
    });
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const addQuantity = parseFloat(dialog.querySelector('#addQuantity').value);
      const reason = dialog.querySelector('#reason').value;
      const notes = dialog.querySelector('#notes').value.trim();
      
      // Collect additional tracking data
      const stockData = {
        quantity: addQuantity,
        reason: reason,
        notes: notes
      };
      
      // Add batch tracking if required
      if (requireBatchTracking()) {
        const batchNumber = dialog.querySelector('#batchNumber')?.value?.trim();
        if (batchNumber) {
          stockData.batch_number = batchNumber;
        }
      }
      
      // Add quality grade if required
      if (requireQualityGrades()) {
        const qualityGrade = dialog.querySelector('#qualityGrade')?.value;
        if (qualityGrade) {
          stockData.quality_grade = qualityGrade;
        }
      }
      
      // Add expiry date if required
      if (requireExpiryDates()) {
        const expiryDate = dialog.querySelector('#expiryDate')?.value;
        if (expiryDate) {
          stockData.expiry_date = expiryDate;
        }
      }
      
      // Basic validation
      if (!addQuantity) {
        showError('Add quantity is required');
        return;
      }
      if (isNaN(addQuantity)) {
        showError('Add quantity must be a valid number');
        return;
      }
      if (addQuantity <= 0) {
        showError('Please enter a valid quantity to add');
        return;
      }
      
      // Validate required tracking fields
      if (requireBatchTracking() && !stockData.batch_number) {
        showError('Batch/Lot number is required');
        return;
      }
      
      if (requireQualityGrades() && !stockData.quality_grade) {
        showError('Quality grade is required');
        return;
      }
      
      // Disable form while adding
      const addBtn = dialog.querySelector('#addBtn');
      addBtn.disabled = true;
      addBtn.textContent = 'Adding...';
      
      try {
        const result = await updateInventoryStock(product.id, addQuantity);
        if (result) {
          cleanup();
          resolve(result);
        } else {
          // Error already shown by updateInventoryStock
          addBtn.disabled = false;
          addBtn.textContent = 'Add Stock';
        }
      } catch (error) {
        showError('Failed to add stock. Please try again.');
        addBtn.disabled = false;
        addBtn.textContent = 'Add Stock';
      }
    });
  });
}

async function showProcurementDialog(product, requiredQuantity, actionType) {
  return new Promise((resolve) => {
    // Create modal dialog
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,0,0,0.5); display: flex; align-items: center; 
      justify-content: center; z-index: 1000;
    `;
    
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white; padding: 24px; border-radius: 8px; 
      width: 500px; max-width: 90vw; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    
    const isProduction = actionType === 'needs_production';
    const title = isProduction ? 'Schedule Production' : 'Create Purchase Order';
    const actionText = isProduction ? 'Production' : 'Purchase Order';
    
    dialog.innerHTML = `
      <h3 style="margin: 0 0 16px 0; color: #333;">${title}</h3>
      <p style="margin: 0 0 16px 0; color: #666; font-size: 14px;">
        ${product.name} - Required: ${requiredQuantity} ${product.unit}
        <br>Current stock: ${product.available_quantity !== undefined ? product.available_quantity : 0} ${product.unit}
      </p>
      <form id="procurementForm">
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Quantity to ${isProduction ? 'Produce' : 'Order'} *</label>
          <input type="number" id="orderQuantity" required min="1" step="0.01" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" value="${Math.max(requiredQuantity, parseFloat(getDefaultOrderQuantity()))}">
        </div>
        ${!isProduction ? `
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Supplier *</label>
          <select id="supplierSelect" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            <option value="">Select Supplier...</option>
            ${suppliers.map(supplier => `<option value="${supplier.id}">${supplier.name}</option>`).join('')}
          </select>
        </div>
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Sales Rep</label>
          <select id="salesRepSelect" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            <option value="">Select Sales Rep...</option>
          </select>
        </div>
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Expected Unit Price (R)</label>
          <input type="number" id="unitPrice" min="0" step="0.01" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" placeholder="0.00">
        </div>
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Expected Delivery Date</label>
          <input type="date" id="deliveryDate" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" value="${new Date(Date.now() + 24*60*60*1000).toISOString().split('T')[0]}">
        </div>
        ` : `
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Production Date</label>
          <input type="date" id="productionDate" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" value="${new Date().toISOString().split('T')[0]}">
        </div>
        `}
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Priority</label>
          <select id="priority" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            <option value="normal">Normal</option>
            <option value="high" selected>High (Customer Order)</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Notes</label>
          <textarea id="notes" rows="2" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical;" placeholder="Additional notes..."></textarea>
        </div>
        <div id="errorMessage" style="color: #d32f2f; margin-bottom: 12px; display: none;"></div>
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button type="button" id="cancelBtn" style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">Cancel</button>
          <button type="submit" id="createBtn" style="padding: 8px 16px; border: none; background: #ff9800; color: white; border-radius: 4px; cursor: pointer;">Create ${actionText}</button>
        </div>
      </form>
    `;
    
    modal.appendChild(dialog);
    document.body.appendChild(modal);
    
    // Focus first input
    setTimeout(() => dialog.querySelector('#orderQuantity').focus(), 100);
    
    // Event handlers
    const form = dialog.querySelector('#procurementForm');
    const cancelBtn = dialog.querySelector('#cancelBtn');
    const errorDiv = dialog.querySelector('#errorMessage');
    
    // Handle supplier selection to populate sales reps
    if (!isProduction) {
      const supplierSelect = dialog.querySelector('#supplierSelect');
      const salesRepSelect = dialog.querySelector('#salesRepSelect');
      
      supplierSelect.addEventListener('change', () => {
        const supplierId = supplierSelect.value;
        salesRepSelect.innerHTML = '<option value="">Select Sales Rep...</option>';
        
        if (supplierId) {
          const supplierSalesReps = salesReps.filter(rep => rep.supplier == supplierId);
          supplierSalesReps.forEach(rep => {
            const option = document.createElement('option');
            option.value = rep.id;
            option.textContent = `${rep.name} (${rep.position})`;
            salesRepSelect.appendChild(option);
          });
        }
      });
    }
    
    const cleanup = () => {
      document.body.removeChild(modal);
    };
    
    const showError = (message) => {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
    };
    
    cancelBtn.addEventListener('click', () => {
      cleanup();
      resolve(null);
    });
    
    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        cleanup();
        resolve(null);
      }
    });
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const quantity = parseFloat(dialog.querySelector('#orderQuantity').value);
      const notes = dialog.querySelector('#notes').value.trim();
      const priority = dialog.querySelector('#priority').value;
      
      let orderData = {
        product_id: product.id,
        quantity: quantity,
        priority: priority,
        notes: notes,
        is_production: isProduction  // Fixed: Use is_production flag expected by backend
      };
      
      if (isProduction) {
        const productionDate = dialog.querySelector('#productionDate').value;
        orderData.scheduled_date = productionDate;
      } else {
        const supplierId = dialog.querySelector('#supplierSelect').value;
        const salesRepId = dialog.querySelector('#salesRepSelect').value;
        const unitPrice = parseFloat(dialog.querySelector('#unitPrice').value) ? parseFloat(dialog.querySelector('#unitPrice').value) : 0;
        const deliveryDate = dialog.querySelector('#deliveryDate').value;
        
        if (!supplierId) {
          showError('Please select a supplier');
          return;
        }
        
        orderData.supplier_id = supplierId;
        orderData.sales_rep_id = salesRepId ? salesRepId : null;
        orderData.unit_price = unitPrice;
        orderData.expected_delivery_date = deliveryDate;
      }
      
      // Basic validation
      if (!quantity) {
        showError('Quantity is required');
        return;
      }
      if (quantity <= 0) {
        showError('Please enter a valid quantity');
        return;
      }
      
      // Disable form while creating
      const createBtn = dialog.querySelector('#createBtn');
      createBtn.disabled = true;
      createBtn.textContent = 'Creating...';
      
      try {
        const newOrder = await createProcurementOrder(orderData);
        if (newOrder) {
          cleanup();
          resolve(newOrder);
        } else {
          // Error already shown by createProcurementOrder
          createBtn.disabled = false;
          createBtn.textContent = `Create ${actionText}`;
        }
      } catch (error) {
        showError(`Failed to create ${actionText.toLowerCase()}. Please try again.`);
        createBtn.disabled = false;
        createBtn.textContent = `Create ${actionText}`;
      }
    });
  });
}

async function showNewCustomerDialog() {
  return new Promise((resolve) => {
    // Create modal dialog
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,0,0,0.5); display: flex; align-items: center; 
      justify-content: center; z-index: 1000;
    `;
    
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white; padding: 24px; border-radius: 8px; 
      width: 400px; max-width: 90vw; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    
    dialog.innerHTML = `
      <h3 style="margin: 0 0 16px 0; color: #333;">Add New Customer</h3>
      <form id="newCustomerForm">
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Business Name *</label>
          <input type="text" id="businessName" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
        </div>
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Branch Name</label>
          <input type="text" id="branchName" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" placeholder="e.g., Sandton, Rosebank (optional for multi-location businesses)">
        </div>
        <div style="display: flex; gap: 12px; margin-bottom: 12px;">
          <div style="flex: 1;">
            <label style="display: block; margin-bottom: 4px; font-weight: 500;">First Name *</label>
            <input type="text" id="firstName" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
          </div>
          <div style="flex: 1;">
            <label style="display: block; margin-bottom: 4px; font-weight: 500;">Last Name *</label>
            <input type="text" id="lastName" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
          </div>
        </div>
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Email *</label>
          <input type="email" id="email" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
        </div>
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Phone *</label>
          <input type="tel" id="phone" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" placeholder="+27 XX XXX XXXX">
        </div>
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Address *</label>
          <textarea id="address" required rows="2" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical;"></textarea>
        </div>
        <div style="display: flex; gap: 12px; margin-bottom: 16px;">
          <div style="flex: 1;">
            <label style="display: block; margin-bottom: 4px; font-weight: 500;">City *</label>
            <input type="text" id="city" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
          </div>
          <div style="flex: 1;">
            <label style="display: block; margin-bottom: 4px; font-weight: 500;">Postal Code</label>
            <input type="text" id="postalCode" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
          </div>
        </div>
        <div id="errorMessage" style="color: #d32f2f; margin-bottom: 12px; display: none;"></div>
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button type="button" id="cancelBtn" style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">Cancel</button>
          <button type="submit" id="createBtn" style="padding: 8px 16px; border: none; background: #2196f3; color: white; border-radius: 4px; cursor: pointer;">Create Customer</button>
        </div>
      </form>
    `;
    
    modal.appendChild(dialog);
    document.body.appendChild(modal);
    
    // Focus first input
    setTimeout(() => dialog.querySelector('#businessName').focus(), 100);
    
    // Event handlers
    const form = dialog.querySelector('#newCustomerForm');
    const cancelBtn = dialog.querySelector('#cancelBtn');
    const errorDiv = dialog.querySelector('#errorMessage');
    
    const cleanup = () => {
      document.body.removeChild(modal);
    };
    
    const showError = (message) => {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
    };
    
    cancelBtn.addEventListener('click', () => {
      cleanup();
      resolve(null);
    });
    
    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        cleanup();
        resolve(null);
      }
    });
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(form);
      const customerData = {
        business_name: dialog.querySelector('#businessName').value.trim(),
        branch_name: dialog.querySelector('#branchName').value.trim(),
        first_name: dialog.querySelector('#firstName').value.trim(),
        last_name: dialog.querySelector('#lastName').value.trim(),
        email: dialog.querySelector('#email').value.trim(),
        phone: dialog.querySelector('#phone').value.trim(),
        address: dialog.querySelector('#address').value.trim(),
        city: dialog.querySelector('#city').value.trim(),
        postal_code: dialog.querySelector('#postalCode').value.trim()
      };
      
      // Basic validation
      if (!customerData.business_name) {
        showError('Business name is required');
        return;
      }
      if (!customerData.first_name) {
        showError('First name is required');
        return;
      }
      if (!customerData.last_name) {
        showError('Last name is required');
        return;
      }
      if (!customerData.email) {
        showError('Email is required');
        return;
      }
      if (!customerData.phone) {
        showError('Phone is required');
        return;
      }
      if (!customerData.address) {
        showError('Address is required');
        return;
      }
      if (!customerData.city) {
        showError('Please fill in all required fields (marked with *)');
        return;
      }
      
      // Phone validation - basic format check
      const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,}$/;
      if (!phoneRegex.test(customerData.phone)) {
        showError('Please enter a valid phone number (minimum 10 digits)');
        return;
      }
      
      // Disable form while creating
      const createBtn = dialog.querySelector('#createBtn');
      createBtn.disabled = true;
      createBtn.textContent = 'Creating...';
      
      try {
        const newCustomer = await createNewCustomer(customerData);
        if (newCustomer) {
          cleanup();
          resolve(newCustomer);
        } else {
          // Error already shown by createNewCustomer
          createBtn.disabled = false;
          createBtn.textContent = 'Create Customer';
        }
      } catch (error) {
        showError('Failed to create customer. Please try again.');
        createBtn.disabled = false;
        createBtn.textContent = 'Create Customer';
      }
    });
  });
}

// Manual selection state
let rawMessages = [];
let selectedMessageIds = new Set();
let processedMessageIds = new Set();
let currentOrderItems = []; // Store parsed order items for editing
let customers = []; // Store customer list from backend
let products = []; // Store products list from backend
let departments = []; // Store departments list from backend
let suppliers = []; // Store suppliers list from backend
let salesReps = []; // Store sales reps list from backend
let units = []; // Store units of measure from backend
let businessSettings = null; // Store business settings from backend
// Old COMPANY_ALIASES constant removed - not needed for manual selection
// Old FORWARDER_NAMES constant removed - not needed for manual selection

// Load configuration
let PATTERNS_CONFIG = null;
let VALIDATION_CONFIG = null;

function loadConfigurations() {
  try {
    if (window.api && typeof window.api.getPatternsConfig === 'function') {
      PATTERNS_CONFIG = window.api.getPatternsConfig();
      if (!PATTERNS_CONFIG) {
        console.error('[renderer] PATTERNS_CONFIG not loaded');
        throw new Error('Patterns configuration not loaded');
      }
      if (Object.keys(PATTERNS_CONFIG).length === 0) {
        console.error('[renderer] Failed to load patterns config');
        throw new Error('Patterns configuration is required but not available');
      }
    } else {
      console.error('[renderer] getPatternsConfig not available');
      throw new Error('Patterns configuration API is not available');
    }
  } catch (error) {
    console.error('[renderer] Failed to load patterns config:', error);
    throw error;
  }
  
  try {
    if (window.api && typeof window.api.getValidationConfig === 'function') {
      VALIDATION_CONFIG = window.api.getValidationConfig();
      if (!VALIDATION_CONFIG) {
        console.error('[renderer] VALIDATION_CONFIG not loaded');
        throw new Error('Validation configuration not loaded');
      }
      if (Object.keys(VALIDATION_CONFIG).length === 0) {
        console.error('[renderer] Failed to load validation config');
        throw new Error('Validation configuration is required but not available');
      }
    } else {
      console.error('[renderer] getValidationConfig not available');
      throw new Error('Validation configuration API is not available');
    }
  } catch (error) {
    console.error('[renderer] Failed to load validation config:', error);
    throw error;
  }
}

// Old getDefaultPatternsConfig and getDefaultValidationConfig functions removed - no fallbacks allowed

// Old LABEL_STOPWORDS constant removed - not needed for manual selection

// Old normalizeSimple function removed - not needed for manual selection

function getQuantityPatterns() {
  if (!PATTERNS_CONFIG) {
    console.error('[renderer] PATTERNS_CONFIG not available for parsing');
    throw new Error('Patterns configuration not available');
  }
  if (!PATTERNS_CONFIG.quantity_patterns) {
    console.error('[renderer] Patterns config not available');
    throw new Error('Quantity patterns configuration is required but not available');
  }
  
  return PATTERNS_CONFIG.quantity_patterns.map(patternConfig => {
    try {
      return new RegExp(patternConfig.pattern, patternConfig.flags);
    } catch (error) {
      console.error('[renderer] Invalid regex pattern:', patternConfig, error);
      return null;
    }
  }).filter(pattern => pattern !== null);
}

function parseItemQuantity(itemText) {
  if (typeof itemText !== 'string') {
    if (itemText === null) {
      console.warn('[renderer] Item text is null, skipping');
      return null;
    }
    if (itemText === undefined) {
      console.error('[renderer] parseItemQuantity received null/undefined input');
      throw new Error('parseItemQuantity requires valid string input');
    }
    itemText = String(itemText);
  }
  
  const text = itemText.trim();
  
  // Check if this is an image item
  let imagePattern = /^\[IMAGE:\s*(.+?)\]$/;
  if (PATTERNS_CONFIG && PATTERNS_CONFIG.image_pattern) {
    try {
      imagePattern = new RegExp(PATTERNS_CONFIG.image_pattern.pattern, PATTERNS_CONFIG.image_pattern.flags);
    } catch (error) {
      console.warn('[renderer] Invalid image pattern in config, using default:', error);
    }
  }
  
  const imageMatch = text.match(imagePattern);
  if (imageMatch) {
    return {
      quantity: 1,
      name: `Image: ${imageMatch[1]}`,
      unit: 'file',
      originalText: text,
      isImage: true
    };
  }
  
  // Load quantity patterns from configuration
  const patterns = getQuantityPatterns();
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let quantity, name, unit;
      
      if (pattern.source.startsWith('^(.+?)\\s*[×x]\\s*(\\d+')) {
        // Pattern: "Sweet corn x6 pkts"
        name = match[1].trim();
        quantity = parseFloat(match[2]);
        unit = match[3].trim();
      } else if (pattern.source.startsWith('^(.+?)\\s*(\\d+')) {
        // Pattern: "Sweet corn 6x pkts"
        name = match[1].trim();
        quantity = parseFloat(match[2]);
        unit = match[3].trim();
      } else if (pattern.source.startsWith('^(\\d+')) {
        if (match[3]) {
          // Pattern: "6x Sweet corn pkts"
          quantity = parseFloat(match[1]);
          name = match[2].trim();
          unit = '';
        } else {
          // Pattern: "6 Sweet corn pkts"
          quantity = parseFloat(match[1]);
          const rest = match[2].trim();
          // Try to extract unit from the end
          const unitMatch = rest.match(/^(.+?)\s+(kg|g|pkt|pkts|box|boxes|bag|bags|bunch|bunches|head|heads)s?$/i);
          if (unitMatch) {
            name = unitMatch[1].trim();
            unit = unitMatch[2];
          } else {
            name = rest;
            unit = '';
          }
        }
      } else {
        // Pattern: "Butter nut 10kg"
        name = match[1].trim();
        quantity = parseFloat(match[2]);
        unit = match[3];
        if (match[4]) unit += match[4];
      }
      
      return {
        quantity: quantity ? quantity : 1,
        name: name ? name : text,
        unit: unit ? unit : '',
        originalText: text
      };
    }
  }
  
  // If no pattern matches, return as-is with quantity 1
  return {
    quantity: 1,
    name: text,
    unit: '',
    originalText: text
  };
}

function formatItemText(quantity, name, unit, isImage = false) {
  if (!name) return '';
  
  // Handle image items - don't format, return as-is
  if (isImage) {
    console.log('[renderer] Skipping image item for order processing');
    return null;
  }
  if (unit === 'file') {
    return name.startsWith('[IMAGE:') ? name : `[IMAGE: ${name}]`;
  }
  
  // Format based on the unit type
  if (unit) {
    let weightUnits = ['kg', 'g', 'grams', 'gram'];
    let packageUnits = ['pkt', 'pkts', 'packet', 'packets', 'box', 'boxes', 'bag', 'bags', 'bunch', 'bunches', 'head', 'heads'];
    
    if (VALIDATION_CONFIG) {
      if (VALIDATION_CONFIG.weight_units) {
        weightUnits = VALIDATION_CONFIG.weight_units;
      }
      if (VALIDATION_CONFIG.package_units) {
        packageUnits = VALIDATION_CONFIG.package_units;
      }
    }
    
    const unitLower = unit.toLowerCase();
    if (weightUnits.includes(unitLower)) {
      return `${name} ${quantity}${unit}`;
    } else if (packageUnits.includes(unitLower)) {
      return `${name} x${quantity}${unit}`;
    } else {
      return `${name} x${quantity}${unit}`;
    }
  } else {
    return `${name} x${quantity}`;
  }
}

// Old buildCompanyMatchers function removed - not needed for manual selection
// Old COMPANY_MATCHERS constant removed - not needed for manual selection

// Old matchCompanyInText function removed - not needed for manual selection

// Old isLabelOnlyText function removed - not needed for manual selection

// Old isContentStarter function removed - not needed for manual selection

// Old isNonOrderMeta function removed - not needed for manual selection

// Shared label parser (used by batch and streaming)
// Old parseCompanyLabelText function removed - not needed for manual selection

// Old incremental parser state removed - replaced by manual selection state

// Old normalizeCompanyName function removed - not needed for manual selection

// Old lineToOrders function removed - replaced by manual selection parsing

// Old normalizePayload function removed - replaced by manual selection parsing

function renderMessagesList() {
  messagesListEl.innerHTML = '';
  
  if (!rawMessages.length) {
    messagesListEl.innerHTML = '<div style="padding: 16px; text-align: center; color: #999;">No messages loaded</div>';
    return;
  }
  
  rawMessages.forEach((msg, index) => {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message-item';
    messageDiv.dataset.messageId = index;
    
    if (selectedMessageIds.has(index)) {
      messageDiv.classList.add('selected');
    }
    
    if (processedMessageIds.has(index)) {
      messageDiv.style.opacity = '0.5';
      messageDiv.style.pointerEvents = 'none';
    }
    
    // Checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'message-checkbox';
    checkbox.checked = selectedMessageIds.has(index);
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      toggleMessageSelection(index);
    });
    
    // Message content
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const timestampSpan = document.createElement('div');
    timestampSpan.className = 'message-timestamp';
    if (!msg.timestamp) {
      console.error('[renderer] Invalid message without timestamp should not exist:', msg);
      throw new Error('Invalid message without timestamp detected - this should not happen');
    }
    timestampSpan.textContent = `[${msg.timestamp}]`;
    
    const senderSpan = document.createElement('div');
    senderSpan.className = 'message-sender';
    if (!msg.sender) {
      console.error('[renderer] Invalid message without sender should not exist:', msg);
      throw new Error('Invalid message without sender detected - this should not happen');
    }
    senderSpan.textContent = msg.sender;
    
    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    if (!msg.text) {
      console.error('[renderer] Invalid message without text should not exist:', msg);
      throw new Error('Invalid message without text detected - this should not happen');
    }
    textDiv.textContent = msg.text;
    
    contentDiv.appendChild(timestampSpan);
    contentDiv.appendChild(senderSpan);
    contentDiv.appendChild(textDiv);
    
    messageDiv.appendChild(checkbox);
    messageDiv.appendChild(contentDiv);
    
    // Click to toggle selection
    messageDiv.addEventListener('click', () => {
      if (!processedMessageIds.has(index)) {
        toggleMessageSelection(index);
      }
    });
    
    messagesListEl.appendChild(messageDiv);
  });
}

function toggleMessageSelection(messageId) {
  if (selectedMessageIds.has(messageId)) {
    selectedMessageIds.delete(messageId);
  } else {
    selectedMessageIds.add(messageId);
  }
  
  // Clear current order items when messages change so they get re-parsed
  currentOrderItems = [];
  
  renderMessagesList();
  renderSelectedMessages();
  renderOrderPreview();
}

function renderSelectedMessages() {
  selectedMessagesListEl.innerHTML = '';
  
  if (selectedMessageIds.size === 0) {
    selectedMessagesListEl.innerHTML = '<div style="padding: 8px; color: #999; text-align: center;">No messages selected</div>';
    return;
  }
  
  Array.from(selectedMessageIds).forEach(messageId => {
    const msg = rawMessages[messageId];
    if (!msg) return;
    
    const msgDiv = document.createElement('div');
    msgDiv.className = 'selected-message';
    if (!msg.timestamp) {
      console.error('[renderer] Selected message missing timestamp:', msg);
      throw new Error('Selected message missing required timestamp');
    }
    if (!msg.sender) {
      console.error('[renderer] Selected message missing sender:', msg);
      throw new Error('Selected message missing required sender');
    }
    if (!msg.text) {
      console.error('[renderer] Selected message missing text:', msg);
      throw new Error('Selected message missing required text');
    }
    
    const truncatedText = msg.text.length > 100 ? msg.text.substring(0, 100) + '...' : msg.text;
    msgDiv.innerHTML = `
      <strong>[${msg.timestamp}] ${msg.sender}:</strong><br>
      ${truncatedText}
    `;
    selectedMessagesListEl.appendChild(msgDiv);
  });
}

function renderOrderPreview() {
  orderPreviewEl.innerHTML = '';
  
  if (selectedMessageIds.size === 0) {
    orderPreviewEl.innerHTML = '<div style="padding: 8px; color: #999; text-align: center;">Select messages to preview order items</div>';
    currentOrderItems = [];
    return;
  }
  
  // Re-parse items from selected messages if needed
  if (currentOrderItems.length === 0) {
    parseOrderItemsFromMessages();
  }
  
  if (currentOrderItems.length === 0) {
    orderPreviewEl.innerHTML = '<div style="padding: 8px; color: #999;">No order items found in selected messages</div>';
    return;
  }
  
  // Render each item with edit/remove buttons and inventory status
  currentOrderItems.forEach((item, index) => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'preview-item';
    itemDiv.dataset.itemIndex = index;
    
    // Check product and inventory status
    const existingProduct = findProductByName(item.name);
    const inventoryStatus = getInventoryStatus(existingProduct);
    
    // Item content with inventory status indicator
    const contentDiv = document.createElement('div');
    contentDiv.className = 'preview-item-content';
    
    const itemText = formatOrderItem(item);
    let statusIcon, statusColor, statusText;
    
    switch (inventoryStatus.status) {
      case 'available':
        statusIcon = '✅';
        statusColor = '#4caf50';
        statusText = inventoryStatus.message;
        break;
      case 'needs_production':
        statusIcon = '🏭';
        statusColor = '#ff9800';
        statusText = inventoryStatus.message;
        break;
      case 'out_of_stock':
        statusIcon = '📦';
        statusColor = '#f44336';
        statusText = inventoryStatus.message;
        break;
      case 'no_inventory':
        statusIcon = '📋';
        statusColor = '#9c27b0';
        statusText = inventoryStatus.message;
        break;
      case 'not_found':
        statusIcon = '❌';
        statusColor = '#f44336';
        statusText = inventoryStatus.message;
        break;
    }
    
    contentDiv.innerHTML = `
      <div>${itemText}</div>
      <div style="font-size: 11px; color: ${statusColor}; margin-top: 2px;">
        ${statusIcon} ${statusText}
      </div>
    `;
    
    // Action buttons
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'preview-item-actions';
    
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-edit';
    editBtn.textContent = 'Edit';
    editBtn.onclick = () => editOrderItem(index);
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-remove';
    removeBtn.textContent = 'Remove';
    removeBtn.onclick = () => removeOrderItem(index);
    
    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(removeBtn);
    
    // Add action buttons based on inventory status
    if (inventoryStatus.status === 'not_found') {
      const addProductBtn = document.createElement('button');
      addProductBtn.className = 'btn-edit';
      addProductBtn.textContent = 'Add Product';
      addProductBtn.style.background = '#4caf50';
      addProductBtn.style.color = 'white';
      addProductBtn.onclick = async () => {
        const newProduct = await showNewProductDialog(item.name, item.unit);
        if (newProduct) {
          // Update the item with the new product info
          item.productId = newProduct.id;
          item.price = newProduct.price;
          renderOrderPreview(); // Re-render to show updated validation
        }
      };
      actionsDiv.appendChild(addProductBtn);
    } else if (inventoryStatus.status === 'no_inventory') {
      const addStockBtn = document.createElement('button');
      addStockBtn.className = 'btn-edit';
      addStockBtn.textContent = 'Add Stock Item';
      addStockBtn.style.background = '#9c27b0';
      addStockBtn.style.color = 'white';
      addStockBtn.onclick = async () => {
        await showInventoryDialog(existingProduct, item.quantity);
        // Reload products to get updated inventory
        await loadProducts();
        renderOrderPreview(); // Re-render to show updated status
      };
      actionsDiv.appendChild(addStockBtn);
    } else if (inventoryStatus.status === 'needs_production') {
      const procureBtn = document.createElement('button');
      procureBtn.className = 'btn-edit';
      procureBtn.textContent = 'Schedule Production';
      procureBtn.style.background = '#ff9800';
      procureBtn.style.color = 'white';
      procureBtn.onclick = async () => {
        await showProcurementDialog(existingProduct, item.quantity, inventoryStatus.status);
        // Reload products to get updated inventory
        await loadProducts();
        renderOrderPreview(); // Re-render to show updated status
      };
      actionsDiv.appendChild(procureBtn);
    } else if (inventoryStatus.status === 'out_of_stock') {
      // Show both "Add Stock" and "Order Stock" buttons for out of stock items
      const addStockBtn = document.createElement('button');
      addStockBtn.className = 'btn-edit';
      addStockBtn.textContent = 'Add Stock';
      addStockBtn.style.background = '#9c27b0';
      addStockBtn.style.color = 'white';
      addStockBtn.style.marginRight = '8px';
      addStockBtn.onclick = async () => {
        await showAddStockDialog(existingProduct, item.quantity);
        // Reload products to get updated inventory
        await loadProducts();
        renderOrderPreview(); // Re-render to show updated status
      };
      actionsDiv.appendChild(addStockBtn);
      
      const orderStockBtn = document.createElement('button');
      orderStockBtn.className = 'btn-edit';
      orderStockBtn.textContent = 'Order Stock';
      orderStockBtn.style.background = '#ff9800';
      orderStockBtn.style.color = 'white';
      orderStockBtn.onclick = async () => {
        await showProcurementDialog(existingProduct, item.quantity, 'out_of_stock');
        // Reload products to get updated inventory
        await loadProducts();
        renderOrderPreview(); // Re-render to show updated status
      };
      actionsDiv.appendChild(orderStockBtn);
    }
    
    itemDiv.appendChild(contentDiv);
    itemDiv.appendChild(actionsDiv);
    
    // Edit form (hidden by default)
    const editForm = document.createElement('div');
    editForm.className = 'item-edit-form';
    editForm.innerHTML = `
      <input type="number" step="0.1" value="${item.quantity}" placeholder="Qty" class="edit-quantity">
      <input type="text" value="${item.unit ? item.unit : ''}" placeholder="Unit" class="edit-unit">
      <input type="text" value="${item.name}" placeholder="Product" class="edit-name">
      <button class="btn-save">Save</button>
      <button class="btn-cancel">Cancel</button>
    `;
    
    // Edit form event handlers
    const saveBtn = editForm.querySelector('.btn-save');
    const cancelBtn = editForm.querySelector('.btn-cancel');
    
    saveBtn.onclick = () => saveOrderItemEdit(index);
    cancelBtn.onclick = () => cancelOrderItemEdit(index);
    
    itemDiv.appendChild(editForm);
    orderPreviewEl.appendChild(itemDiv);
  });
  
  // Add "Add Item" button
  const addItemDiv = document.createElement('div');
  addItemDiv.style.padding = '8px';
  addItemDiv.style.textAlign = 'center';
  addItemDiv.innerHTML = '<button class="btn-edit" onclick="addNewOrderItem()">+ Add Item</button>';
  orderPreviewEl.appendChild(addItemDiv);
}

function parseOrderItemsFromMessages() {
  currentOrderItems = [];
  
  // Extract items from selected messages
  const selectedMessages = Array.from(selectedMessageIds).map(id => rawMessages[id]).filter(Boolean);
  const combinedText = selectedMessages.map(msg => {
    if (!msg.text) {
      console.error('[renderer] Selected message missing text for order preview:', msg);
      throw new Error('Selected message missing required text');
    }
    return msg.text;
  }).join('\n');
  
  // Parse all lines to find items with quantities
  const lines = combinedText.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip obvious non-item lines
    if (isNonItemLine(trimmedLine)) {
      continue;
    }
    
    // Use the new standardized parser
    const standardizedItem = parseAndStandardizeItem(trimmedLine);
    if (standardizedItem) {
      currentOrderItems.push(standardizedItem);
    }
  }
}

function parseAndStandardizeItem(line) {
  if (!line) {
    console.warn('[renderer] Line is required for parsing');
    return null;
  }
  if (typeof line !== 'string') {
    console.warn('[renderer] Line must be a string for parsing');
    return null;
  }
  
  const originalLine = line.trim();
  if (!originalLine) return null;
  
  // Normalize the line for parsing
  let normalized = normalizeItemLine(originalLine);
  
  // Try different parsing patterns in order of specificity
  const patterns = [
    // Pattern 0: "Please add spring onion 1kg" (please add product quantity)
    /^please\s+add\s+(.+?)\s+(\d+(?:\.\d+)?)\s*(kg|g|pkt|pkts|packet|packets|box|boxes|bag|bags|bunch|bunches|head|heads|punnet|punnets|pun)?\s*$/i,
    
    // Pattern 1: "20kg potato" or "3kg red pepper" (weight + product)
    /^(\d+(?:\.\d+)?)\s*(kg|g)\s+(.+?)$/i,
    
    // Pattern 2: "3 box avos" or "2 bag onions" (quantity + unit + product)
    /^(\d+(?:\.\d+)?)\s+(box|boxes|bag|bags|bunch|bunches|head|heads|punnet|punnets|pun|packet|packets|pkt|pkts)\s+(.+?)$/i,
    
    // Pattern 3: "5×baby corn" or "10×cucumber" (quantity×product)
    /^(\d+(?:\.\d+)?)\s*[×x]\s*(.+?)$/i,
    
    // Pattern 4: "5*packets parsley" (quantity*unit product)
    /^(\d+(?:\.\d+)?)\s*\*\s*(packets?|pkts?|box|boxes|bag|bags|bunch|bunches|head|heads|punnet|punnets|pun)\s+(.+?)$/i,
    
    // Pattern 5: "750g wild rocket" (quantity+unit+product, no space between qty and unit)
    /^(\d+(?:\.\d+)?)(kg|g|pkt|pkts|packet|packets|box|boxes|bag|bags|bunch|bunches|head|heads|punnet|punnets|pun)\s+(.+?)$/i,
    
    // Pattern 6: "Parsley ×200g" or "Sweet corn x6 pkts" (product × quantity+unit)
    /^(.+?)\s*[×x]\s*(\d+(?:\.\d+)?)\s*(kg|g|pkt|pkts|packet|packets|box|boxes|bag|bags|bunch|bunches|head|heads|punnet|punnets|pun)\s*$/i,
    
    // Pattern 7: "Cucumber 26" (product + number at end)
    /^(.+?)\s+(\d+(?:\.\d+)?)$/,
    
    // Pattern 8: Just product name (default to quantity 1)
    /^(.+)$/
  ];
  
  for (let i = 0; i < patterns.length; i++) {
    const match = normalized.match(patterns[i]);
    if (match) {
      let quantity = 1;
      let unit = '';
      let name = '';
      
      switch (i) {
        case 0: // "Please add spring onion 1kg" (please add product quantity unit)
          name = match[1];
          quantity = parseFloat(match[2]);
          unit = match[3] ? match[3] : '';
          break;
          
        case 1: // "20kg potato" (quantity + weight unit + product)
          quantity = parseFloat(match[1]);
          unit = match[2];
          name = match[3];
          break;
          
        case 2: // "3 box avos" (quantity + packaging unit + product)
          quantity = parseFloat(match[1]);
          unit = match[2];
          name = match[3];
          break;
          
        case 3: // "5×baby corn" (quantity × product)
          quantity = parseFloat(match[1]);
          name = match[2];
          unit = '';
          break;
          
        case 4: // "5*packets parsley" (quantity * unit + product)
          quantity = parseFloat(match[1]);
          unit = match[2];
          name = match[3];
          break;
          
        case 5: // "750g wild rocket" (quantityunit + product, no space)
          quantity = parseFloat(match[1]);
          unit = match[2];
          name = match[3];
          break;
          
        case 6: // "Parsley ×200g" (product × quantity + unit)
          name = match[1];
          quantity = parseFloat(match[2]);
          unit = match[3] ? match[3] : '';
          break;
          
        case 7: // "Cucumber 26" (product + number)
          name = match[1];
          quantity = parseFloat(match[2]);
          unit = '';
          break;
          
        case 8: // Just product name
          name = match[1];
          quantity = 1;
          unit = '';
          break;
      }
      
      // Standardize the parsed data
      const standardized = {
        quantity: Math.max(quantity ? quantity : 1, 0.1), // Ensure positive quantity
        unit: standardizeUnit(unit),
        name: standardizeProductName(name),
        originalText: originalLine
      };
      
      // Only return if we have a valid product name
      if (standardized.name && standardized.name.length > 1) {
        return standardized;
      }
    }
  }
  
  return null;
}

function normalizeItemLine(line) {
  // Remove leading numbers and dots (like "1. Red Cabbage" -> "Red Cabbage")
  let normalized = line.replace(/^\d+\.\s*/, '');
  
  // Don't normalize × and * characters here - let the regex patterns handle them
  // This prevents breaking product names that contain these characters
  
  // Normalize multiple spaces
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}

function standardizeUnit(unit) {
  if (!unit) return '';
  
  const unitMap = {
    // Weight units
    'kg': 'kg',
    'g': 'g',
    
    // Packaging units
    'pkt': 'packet',
    'pkts': 'packet',
    'packet': 'packet',
    'packets': 'packet',
    
    'box': 'box',
    'boxes': 'box',
    
    'bag': 'bag',
    'bags': 'bag',
    
    'bunch': 'bunch',
    'bunches': 'bunch',
    
    'head': 'head',
    'heads': 'head',
    
    'pun': 'punnet',
    'punnet': 'punnet',
    'punnets': 'punnet',
    
    // Pieces (no unit)
    'piece': '',
    'pieces': '',
    'pc': '',
    'pcs': ''
  };
  
  const cleaned = unit.toLowerCase().trim();
  return unitMap[cleaned] ? unitMap[cleaned] : cleaned;
}

function standardizeProductName(name) {
  if (!name) return '';
  
  // Clean up the name
  let cleaned = name.trim();
  
  // Remove trailing units that might have been included
  cleaned = cleaned.replace(/\s+(kg|g|pkt|pkts|packet|packets|box|boxes|bag|bags|bunch|bunches|head|heads|punnet|punnets|pun|piece|pieces|pc|pcs)s?$/i, '');
  
  // Capitalize first letter of each word
  cleaned = cleaned.replace(/\b\w/g, l => l.toUpperCase());
  
  // Fix common product name variations
  const nameMap = {
    'Paw Paw': 'Papaya',
    'Sweet Mellon': 'Sweet Melon',
    'Water Mellon': 'Watermelon',
    'Pine Apple': 'Pineapple',
    'Green Peppee': 'Green Pepper',
    'Spinarch': 'Spinach',
    'Sweetcorn': 'Sweet Corn',
    'Brout Sprout': 'Brussels Sprouts',
    'Tumeric': 'Turmeric',
    'Crushed Garlic': 'Garlic (Crushed)',
    'Blue Berry': 'Blueberry',
    'Baby Corn': 'Baby Corn',
    'Grape Fruits': 'Grapefruit',
    'Red Apples': 'Red Apple',
    'White Onion': 'White Onions',
    'Red Onion': 'Red Onions',
    'Mi × Ed Lettuce': 'Mixed Lettuce',
    'Mixed Lettuce': 'Mixed Lettuce',
    'Baby Corn': 'Baby Corn'
  };
  
  return nameMap[cleaned] ? nameMap[cleaned] : cleaned;
}

function isNonItemLine(line) {
  const lowerLine = line.toLowerCase();
  
  // Skip lines that are clearly not items
  const skipPatterns = [
    /^stock as at/i,
    /^herbs$/i,
    /^for\s+\w+/i,
    /^please\s+(make sure|tell|confirm|note)/i,  // Only skip non-product "please" lines
    /^can\s+(you|we|i)\s/i,  // Only skip question "can" lines, not "Can we add to..."
    /^hie[,\s]/i,
    /^good\s+day/i,
    /^\d+\.\s*$/,  // Just numbers like "1."
    /^thanks?$/i,
    /^friday$/i,
    /^attention/i,
    /^customer order from/i,
    /^including$/i,
    /^early this morning/i,
    /^we are starting/i,
    /^every tue and thurs/i,
    /^i want to work/i
  ];
  
  return skipPatterns.some(pattern => pattern.test(line));
}


function formatOrderItem(item) {
  const qty = item.quantity ? item.quantity : 1;
  const unit = item.unit ? ` ${item.unit}` : '';
  return `${qty}${unit} ${item.name}`;
}

function editOrderItem(index) {
  const itemDiv = orderPreviewEl.querySelector(`[data-item-index="${index}"]`);
  if (!itemDiv) return;
  
  const editForm = itemDiv.querySelector('.item-edit-form');
  const content = itemDiv.querySelector('.preview-item-content');
  const actions = itemDiv.querySelector('.preview-item-actions');
  
  // Show edit form, hide content and actions
  editForm.style.display = 'block';
  content.style.display = 'none';
  actions.style.display = 'none';
}

function saveOrderItemEdit(index) {
  const itemDiv = orderPreviewEl.querySelector(`[data-item-index="${index}"]`);
  if (!itemDiv) return;
  
  const editForm = itemDiv.querySelector('.item-edit-form');
  const quantityInput = editForm.querySelector('.edit-quantity');
  const unitInput = editForm.querySelector('.edit-unit');
  const nameInput = editForm.querySelector('.edit-name');
  
  // Update the item
  currentOrderItems[index] = {
    ...currentOrderItems[index],
    quantity: parseFloat(quantityInput.value) ? parseFloat(quantityInput.value) : 1,
    unit: unitInput.value.trim(),
    name: nameInput.value.trim()
  };
  
  // Re-render to show updated item
  renderOrderPreview();
}

function cancelOrderItemEdit(index) {
  const itemDiv = orderPreviewEl.querySelector(`[data-item-index="${index}"]`);
  if (!itemDiv) return;
  
  const editForm = itemDiv.querySelector('.item-edit-form');
  const content = itemDiv.querySelector('.preview-item-content');
  const actions = itemDiv.querySelector('.preview-item-actions');
  
  // Hide edit form, show content and actions
  editForm.style.display = 'none';
  content.style.display = 'block';
  actions.style.display = 'flex';
}

function removeOrderItem(index) {
  if (confirm('Remove this item from the order?')) {
    currentOrderItems.splice(index, 1);
    renderOrderPreview();
  }
}

function addNewOrderItem() {
  const newItem = {
    quantity: 1,
    unit: '',
    name: 'New Item',
    originalText: 'Manual Entry'
  };
  
  currentOrderItems.push(newItem);
  renderOrderPreview();
  
  // Immediately edit the new item
  setTimeout(() => {
    editOrderItem(currentOrderItems.length - 1);
  }, 100);
}

// Old renderItemsList function removed - replaced by manual selection interface

// Old loadForm function removed - replaced by manual selection interface

// Old loadForm and saveForm functions removed - replaced by manual selection interface

// Manual selection event listeners - moved to initializeApp()
function setupEventListeners() {
  if (btnSelectAll) {
    btnSelectAll.addEventListener('click', () => {
      selectedMessageIds.clear();
      rawMessages.forEach((_, index) => {
        if (!processedMessageIds.has(index)) {
          selectedMessageIds.add(index);
        }
      });
      renderMessagesList();
      renderSelectedMessages();
      renderOrderPreview();
    });
  }

  if (btnClearSelection) {
    btnClearSelection.addEventListener('click', () => {
      selectedMessageIds.clear();
      renderMessagesList();
      renderSelectedMessages();
      renderOrderPreview();
    });
  }

  if (btnCreateOrder) {
    btnCreateOrder.addEventListener('click', handleCreateOrder);
  }

  if (btnSkipMessages) {
    btnSkipMessages.addEventListener('click', handleSkipMessages);
  }

  if (btnClose) {
    btnClose.addEventListener('click', handleClose);
  }

  if (customerSelectEl) {
    customerSelectEl.addEventListener('change', handleCustomerSelect);
  }
}

async function submitOrder(orderData) {
  if (!ENDPOINT) { 
    alert('BACKEND_API_URL not set'); 
    return false; 
  }
  
  if (!verifiedEl.checked && !confirm('Order not marked as verified. Submit anyway?')) {
    return false;
  }
  
  try { 
    console.log('[renderer] submitting manual order', { endpoint: ENDPOINT, size: JSON.stringify(orderData).length }); 
  } catch {}
  
  const resp = await fetch(ENDPOINT, { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify(orderData) 
  });
  
  if (!resp.ok) { 
    const txt = await resp.text(); 
    alert(`Backend error ${resp.status}: ${txt}`); 
    return false; 
  }
  
  return true;
}

// Moved to setupEventListeners function
async function handleCreateOrder() {
  if (selectedMessageIds.size === 0) {
    alert('Please select messages first');
    return;
  }
  
  const customerId = customerSelectEl.value;
  if (!customerId) {
    alert('Please select a customer');
    return;
  }
  
  // Create order from selected messages
  const selectedMessages = Array.from(selectedMessageIds).map(id => rawMessages[id]).filter(Boolean);
  
  if (selectedMessages.length === 0) {
    alert('No valid messages selected');
    return;
  }
  
  // Validate first message has required data
  const firstMessage = selectedMessages[0];
  if (!firstMessage.sender) {
    console.warn('[renderer] First message missing sender');
    return;
  }
  if (!firstMessage.timestamp) {
    alert('Selected messages contain invalid data');
    return;
  }
  
  const combinedText = selectedMessages.map(msg => msg.text).join('\n');
  const selectedOption = customerSelectEl.options[customerSelectEl.selectedIndex];
  if (!selectedOption) {
    console.warn('[renderer] No option selected');
    return;
  }
  if (!selectedOption.text) {
    alert('Please select a valid customer');
    return;
  }
  
  const orderData = {
    whatsapp_message_id: `manual_${Date.now()}_${Math.floor(Math.random()*1e6)}`,
    sender: firstMessage.sender,
    sender_name: selectedOption.text,
    message_text: combinedText,
    timestamp: firstMessage.timestamp,
    is_backdated: false,
    customer_id: customerId,
    items: currentOrderItems  // Include parsed items
  };
  
  const success = await submitOrder(orderData);
  if (success) {
    // Mark messages as processed
    selectedMessageIds.forEach(id => processedMessageIds.add(id));
    selectedMessageIds.clear();
    renderMessagesList();
    renderSelectedMessages();
    renderOrderPreview();
    alert('Order created successfully');
  }
}

function handleSkipMessages() {
  if (selectedMessageIds.size === 0) {
    alert('Please select messages first');
    return;
  }
  
  // Mark selected messages as processed without creating order
  selectedMessageIds.forEach(id => processedMessageIds.add(id));
  selectedMessageIds.clear();
  renderMessagesList();
  renderSelectedMessages();
  renderOrderPreview();
}

function handleClose() {
  window.close();
}

function handleCustomerSelect(e) {
  if (e.target.value === 'ADD_NEW') {
    // Show new customer dialog
    showNewCustomerDialog().then(newCustomer => {
      if (newCustomer) {
        // Select the newly created customer
        customerSelectEl.value = newCustomer.id;
      } else {
        // Reset to empty if cancelled
        customerSelectEl.value = '';
      }
    });
  }
}

function boot() {
  // Load configurations first
  loadConfigurations();
  
  // Load business settings, units, customers, products, departments, suppliers, and sales reps from backend
  loadBusinessSettings();
  loadUnits();
  loadCustomers();
  loadProducts();
  loadDepartments();
  loadSuppliers();
  loadSalesReps();
  
  // Old LABEL_STOPWORDS initialization removed - not needed for manual selection
  
  let p = null;
  if (window.api && typeof window.api.getPayload === 'function') {
    try {
      p = window.api.getPayload();
    } catch (error) {
      console.error('[renderer] Failed to get payload:', error);
    }
  }
  
  if (!p) { 
    hintEl.textContent = 'Waiting for WhatsApp messages…'; 
    return; 
  }
  
  // Convert payload to raw messages for manual selection - show ALL messages
  rawMessages = [];
  
  if (Array.isArray(p.items_text)) {
    // More flexible parsing to catch all message formats including multiline messages
    const whatsappPatterns = [
      // Pattern 1: [timestamp] sender → text (standard messages, including multiline)
      /^\[(?<ts>[^\]]+)\]\s*(?<sender>.+?)\s*→\s*(?<text>[\s\S]+)$/,
      // Pattern 2: [timestamp] Image (image messages)
      /^\[(?<ts>[^\]]+)\]\s*Image$/,
      // Pattern 3: [timestamp] sender (messages without arrow, like company names)
      /^\[(?<ts>[^\]]+)\]\s*(?<sender>.+)$/
    ];
    
    p.items_text.forEach((line, index) => {
      let parsed = false;
      
      for (const pattern of whatsappPatterns) {
        const match = line.match(pattern);
        if (match && match.groups.ts) {
          // Handle image messages specially
          if (line.includes('Image') && !match.groups.sender) {
            rawMessages.push({
              id: index,
              timestamp: match.groups.ts.trim(),
              sender: 'System',
              text: 'Image',
              originalLine: line,
              isImage: true
            });
            parsed = true;
            break;
          }
          
          // Handle regular messages with sender
          if (match.groups.sender) {
            // Clean up sender (remove phone numbers and extra formatting)
            let cleanSender = match.groups.sender.trim();
            cleanSender = cleanSender.replace(/\+27 \d+ \d+ \d+ · \+27 \d+ \d+ \d+/, 'Customer');
            cleanSender = cleanSender.replace(/\+27 \d+ \d+ \d+/, 'Customer');
            
            // Use text if available, otherwise use sender as the content
            const textContent = match.groups.text ? match.groups.text.trim() : cleanSender;
            
            rawMessages.push({
              id: index,
              timestamp: match.groups.ts.trim(),
              sender: cleanSender,
              text: textContent,
              originalLine: line // Keep original for debugging
            });
            parsed = true;
            break;
          }
        }
      }
      
      if (!parsed) {
        console.warn('[renderer] Could not parse message line:', line);
      }
    });
    
    // Sort messages chronologically by timestamp
    rawMessages.sort((a, b) => {
      // Parse timestamps for comparison (format: "20:47, 03/09/2025" or "12:44")
      const parseTimestamp = (ts) => {
        try {
          // Handle full timestamp format: "20:47, 03/09/2025"
          let parts = ts.match(/(\d{1,2}):(\d{2}),\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/);
          if (parts) {
            const [, hours, minutes, day, month, year] = parts;
            return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));
          }
          
          // Try alternative format without comma: "20:47 03/09/2025"
          parts = ts.match(/(\d{1,2}):(\d{2})\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
          if (parts) {
            const [, hours, minutes, day, month, year] = parts;
            return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));
          }
          
          // Handle time-only format: "12:44" - use today's date
          parts = ts.match(/^(\d{1,2}):(\d{2})$/);
          if (parts) {
            const [, hours, minutes] = parts;
            const today = new Date();
            return new Date(today.getFullYear(), today.getMonth(), today.getDate(), parseInt(hours), parseInt(minutes));
          }
          
          console.warn('[renderer] Could not parse timestamp:', ts);
          return new Date(0);
        } catch (error) {
          console.error('[renderer] Timestamp parsing error:', error, 'for timestamp:', ts);
          return new Date(0);
        }
      };
      
      const dateA = parseTimestamp(a.timestamp);
      const dateB = parseTimestamp(b.timestamp);
      
      // Debug logging to see what's happening
      if (dateA.getTime() === 0) {
        console.warn('[renderer] Invalid date A in comparison:', {
          a: { timestamp: a.timestamp, parsed: dateA }
        });
      }
      if (dateB.getTime() === 0) {
        console.warn('[renderer] Invalid date B in comparison:', {
          b: { timestamp: b.timestamp, parsed: dateB }
        });
      }
      
      return dateA - dateB;
    });
  }
  
  if (rawMessages.length === 0) { 
    hintEl.textContent = 'No messages in payload'; 
    return; 
  }
  
  renderMessagesList();
  renderSelectedMessages();
  renderOrderPreview();
}

// Listen for live batches from the main process (WhatsApp reader)
if (window.api && typeof window.api.onPayload === 'function') {
  window.api.onPayload((payload) => {
    try { 
      console.log('[post-receive payload]', payload); 
      console.log('[post-receive payload json]', JSON.stringify(payload)); 
    } catch (error) {
      console.warn('[renderer] Failed to log payload:', error);
    }
    
    try { 
      if (debugPostEl) debugPostEl.textContent = JSON.stringify(payload, null, 2); 
    } catch (error) {
      console.warn('[renderer] Failed to update debug element:', error);
    }
    
    if (payload && payload.error) {
      const errorMessage = payload.message ? payload.message : payload.error;
      hintEl.textContent = `Reader error: ${errorMessage}`;
      return;
    }
    
    // Add new messages to the raw messages list - show ALL messages
    if (Array.isArray(payload.items_text)) {
      const whatsappPatterns = [
        // Pattern 1: [timestamp] sender → text (standard messages, including multiline)
        /^\[(?<ts>[^\]]+)\]\s*(?<sender>.+?)\s*→\s*(?<text>[\s\S]+)$/,
        // Pattern 2: [timestamp] Image (image messages)
        /^\[(?<ts>[^\]]+)\]\s*Image$/,
        // Pattern 3: [timestamp] sender (messages without arrow, like company names)
        /^\[(?<ts>[^\]]+)\]\s*(?<sender>.+)$/
      ];
      
      const newMessages = [];
      
      payload.items_text.forEach((line, index) => {
        let parsed = false;
        
        for (const pattern of whatsappPatterns) {
          const match = line.match(pattern);
          if (match && match.groups.ts) {
            // Handle image messages specially
            if (line.includes('Image') && !match.groups.sender) {
              newMessages.push({
                id: rawMessages.length + newMessages.length,
                timestamp: match.groups.ts.trim(),
                sender: 'System',
                text: 'Image',
                originalLine: line,
                isImage: true
              });
              parsed = true;
              break;
            }
            
            // Handle regular messages with sender
            if (match.groups.sender) {
              // Clean up sender (remove phone numbers and extra formatting)
              let cleanSender = match.groups.sender.trim();
              cleanSender = cleanSender.replace(/\+27 \d+ \d+ \d+ · \+27 \d+ \d+ \d+/, 'Customer');
              cleanSender = cleanSender.replace(/\+27 \d+ \d+ \d+/, 'Customer');
              
              // Use text if available, otherwise use sender as the content
              const textContent = match.groups.text ? match.groups.text.trim() : cleanSender;
              
              newMessages.push({
                id: rawMessages.length + newMessages.length,
                timestamp: match.groups.ts.trim(),
                sender: cleanSender,
                text: textContent,
                originalLine: line // Keep original for debugging
              });
              parsed = true;
              break;
            }
          }
        }
        
        if (!parsed) {
          console.warn('[renderer] Could not parse message line:', line);
        }
      });
      
      // Add new messages and re-sort everything chronologically
      rawMessages.push(...newMessages);
      
      // Sort all messages chronologically by timestamp using the same logic as boot()
      rawMessages.sort((a, b) => {
        const parseTimestamp = (ts) => {
          try {
            // Handle full timestamp format: "20:47, 03/09/2025"
            let parts = ts.match(/(\d{1,2}):(\d{2}),\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/);
            if (parts) {
              const [, hours, minutes, day, month, year] = parts;
              return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));
            }
            
            // Try alternative format without comma: "20:47 03/09/2025"
            parts = ts.match(/(\d{1,2}):(\d{2})\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
            if (parts) {
              const [, hours, minutes, day, month, year] = parts;
              return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));
            }
            
            // Handle time-only format: "12:44" - use today's date
            parts = ts.match(/^(\d{1,2}):(\d{2})$/);
            if (parts) {
              const [, hours, minutes] = parts;
              const today = new Date();
              return new Date(today.getFullYear(), today.getMonth(), today.getDate(), parseInt(hours), parseInt(minutes));
            }
            
            console.warn('[renderer] Could not parse timestamp in onPayload:', ts);
            return new Date(0);
          } catch (error) {
            console.error('[renderer] Timestamp parsing error in onPayload:', error, 'for timestamp:', ts);
            return new Date(0);
          }
        };
        
        const dateA = parseTimestamp(a.timestamp);
        const dateB = parseTimestamp(b.timestamp);
        
        // Debug logging for new messages
        if (dateA.getTime() === 0) {
          console.warn('[renderer] Invalid date A in onPayload comparison:', {
            a: { timestamp: a.timestamp, parsed: dateA }
          });
        }
        if (dateB.getTime() === 0) {
          console.warn('[renderer] Invalid date B in onPayload comparison:', {
            b: { timestamp: b.timestamp, parsed: dateB }
          });
        }
        
        return dateA - dateB;
      });
      
      renderMessagesList();
    }
  });
}

// Handle single-line streaming updates
// Old onPayloadLine handler removed - replaced by manual selection interface

// Listen for pre-send debug events from main
if (window.api && typeof window.api.onPayloadDebug === 'function') {
  window.api.onPayloadDebug((info) => {
    try { 
      console.log('[pre-send payload]', info); 
    } catch (error) {
      console.warn('[renderer] Failed to log debug info:', error);
    }
    
    try { 
      if (debugPreEl) debugPreEl.textContent = JSON.stringify(info, null, 2); 
    } catch (error) {
      console.warn('[renderer] Failed to update debug pre element:', error);
    }
  });
}

boot();

// Tabs toggle
function showPanel(which) {
  if (!panelMessages) {
    console.warn('[renderer] Messages panel not found');
    return;
  }
  if (!panelDebug) {
    console.warn('[renderer] Debug panel not found');
    return;
  }
  if (which === 'debug') {
    panelMessages.style.display = 'none';
    panelDebug.style.display = '';
  } else {
    panelMessages.style.display = '';
    panelDebug.style.display = 'none';
  }
}
// Initialize DOM elements and event listeners
function initializeApp() {
  // Initialize DOM elements
  messagesListEl = document.getElementById('messagesList');
  selectedMessagesListEl = document.getElementById('selectedMessagesList');
  orderPreviewEl = document.getElementById('orderPreview');
  customerSelectEl = document.getElementById('customerSelect');
  verifiedEl = document.getElementById('verified');
  hintEl = document.getElementById('hint');
  panelMessages = document.getElementById('panelMessages');
  panelDebug = document.getElementById('panelDebug');
  tabMessages = document.getElementById('tabMessages');
  tabDebug = document.getElementById('tabDebug');
  debugPreEl = document.getElementById('debugPre');
  debugPostEl = document.getElementById('debugPost');

  btnSelectAll = document.getElementById('selectAll');
  btnClearSelection = document.getElementById('clearSelection');
  btnCreateOrder = document.getElementById('createOrder');
  btnSkipMessages = document.getElementById('skipMessages');
  btnClose = document.getElementById('close');

  // Set up event listeners
  if (tabMessages) {
    tabMessages.addEventListener('click', () => showPanel('messages'));
  }
  if (tabDebug) {
    tabDebug.addEventListener('click', () => showPanel('debug'));
  }
  
  // Set up main app event listeners
  setupEventListeners();

  // Initialize the app state
  try {
    // Load cached data if available
    loadCachedData('customers');
    loadCachedData('products');
    loadCachedData('departments');
    loadCachedData('units');
    loadCachedData('suppliers');
    loadCachedData('businessSettings');
    
    // Set default panel
    showPanel('messages');
    
    console.log('[renderer] App initialized successfully');
  } catch (error) {
    console.error('[renderer] Error during app initialization:', error);
  }
}

// Wait for DOM to be ready before initializing
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  // DOM is already ready
  initializeApp();
}

// Handle page refresh gracefully
window.addEventListener('beforeunload', (event) => {
  console.log('[renderer] Page is about to refresh/unload');
  // Don't prevent refresh, just log it
});

// Re-initialize if the page was refreshed
window.addEventListener('load', () => {
  console.log('[renderer] Page loaded/refreshed');
  // The initializeApp() will already have been called by DOMContentLoaded or immediately above
});
