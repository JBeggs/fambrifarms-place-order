// Data loading utilities
// Handles loading data from backend APIs and managing global data state

import { ENDPOINTS, makeApiCall, handleApiError, showApiError } from './apiUtils.js';
import { setBusinessSettings, setUnits } from './businessUtils.js';
import { setProducts } from './dataUtils.js';

// Global data stores
let customers = [];
let departments = [];
let suppliers = [];
let salesReps = [];

// Customer management
async function loadCustomers() {
  if (!ENDPOINTS.CUSTOMERS) {
    console.warn('[renderer] Backend URL not configured. Cannot load customers.');
    showApiError('Backend URL not configured. Cannot load customers.');
    customers = [];
    populateCustomerDropdown();
    return;
  }
  
  try {
    console.log('[renderer] Loading customers from:', ENDPOINTS.CUSTOMERS);
    const data = await makeApiCall(ENDPOINTS.CUSTOMERS);
    console.log('[renderer] Raw customers API response:', data);
    
    // Handle different response formats
    if (data.customers && Array.isArray(data.customers)) {
      // Custom response format from CustomerViewSet
      customers = data.customers;
    } else if (data.results && Array.isArray(data.results)) {
      // Paginated response from DRF ViewSet
      customers = data.results;
    } else if (Array.isArray(data)) {
      // Direct array response
      customers = data;
    } else if (data && typeof data === 'object' && Object.keys(data).length > 0) {
      // Single object response - wrap in array
      customers = [data];
    } else {
      console.warn('[renderer] Unexpected customers API response format:', data);
      customers = [];
    }
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
  if (!ENDPOINTS.BUSINESS_SETTINGS) {
    console.warn('[renderer] Backend URL not configured. Cannot load business settings.');
    showApiError('Backend URL not configured. Cannot load business settings.');
    setBusinessSettings(null);
    return;
  }
  
  try {
    console.log('[renderer] Loading business settings from:', ENDPOINTS.BUSINESS_SETTINGS);
    const data = await makeApiCall(ENDPOINTS.BUSINESS_SETTINGS);
    
    if (data.results && data.results.length > 0) {
      setBusinessSettings(data.results[0]);
    } else if (data.id) {
      setBusinessSettings(data);
    } else {
      throw new Error('Invalid Business Settings API response: expected object with id or results array');
    }
    console.log('[renderer] Loaded business settings');
    
  } catch (error) {
    const errorMessage = handleApiError(error, 'Loading business settings');
    console.error('[renderer] Failed to load business settings:', errorMessage);
    showApiError(errorMessage);
    setBusinessSettings(null);
  }
}

async function loadUnits() {
  if (!ENDPOINTS.UNITS) {
    console.warn('[renderer] Backend URL not configured. Cannot load units.');
    showApiError('Backend URL not configured. Cannot load units.');
    setUnits([]);
    return;
  }
  
  try {
    console.log('[renderer] Loading units from:', ENDPOINTS.UNITS);
    const data = await makeApiCall(ENDPOINTS.UNITS);
    
    if (data.results) {
      setUnits(data.results);
    } else if (Array.isArray(data)) {
      setUnits(data);
    } else {
      throw new Error('Invalid Units API response: expected array or results field');
    }
    console.log('[renderer] Loaded units:', data.results?.length || data.length);
    
    // Set units in businessUtils for generateUnitOptions
    setUnits(data.results || data);
    
  } catch (error) {
    const errorMessage = handleApiError(error, 'Loading units');
    console.error('[renderer] Failed to load units:', errorMessage);
    // Fallback to basic units if API fails - NO SILENT FALLBACKS
    showApiError(errorMessage);
    setUnits([]);
  }
}

async function loadProducts() {
  if (!ENDPOINTS.PRODUCTS) {
    console.warn('[renderer] Backend URL not configured. Cannot load products.');
    setProducts([]);
    return;
  }
  
  try {
    console.log('[renderer] Loading products from:', ENDPOINTS.PRODUCTS);
    
    // Load all pages of products if paginated
    let allProducts = [];
    let url = ENDPOINTS.PRODUCTS;
    
    while (url) {
      const data = await makeApiCall(url);
      
      if (data.results) {
        // Paginated response
        allProducts = allProducts.concat(data.results);
        url = data.next; // Next page URL
      } else if (Array.isArray(data)) {
        // Non-paginated response
        allProducts = data;
        url = null;
      } else {
        throw new Error('Invalid Products API response: expected array or results field');
      }
    }
    
    setProducts(allProducts);
    console.log('[renderer] Loaded products:', allProducts.length, '(all pages)');
    
    // Make products available globally for product search
    window.products = allProducts;
    
  } catch (error) {
    const errorMessage = handleApiError(error, 'Loading products');
    console.warn('[renderer]', errorMessage);
    setProducts([]);
    window.products = [];
  }
}

async function loadDepartments() {
  if (!ENDPOINTS.DEPARTMENTS) {
    console.warn('[renderer] Backend URL not configured. Cannot load departments.');
    departments = [];
    return;
  }
  
  try {
    console.log('[renderer] Loading departments from:', ENDPOINTS.DEPARTMENTS);
    const data = await makeApiCall(ENDPOINTS.DEPARTMENTS);
    
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
  if (!ENDPOINTS.SUPPLIERS) {
    console.warn('[renderer] Backend URL not configured. Cannot load suppliers.');
    suppliers = [];
    return;
  }
  
  try {
    console.log('[renderer] Loading suppliers from:', ENDPOINTS.SUPPLIERS);
    const data = await makeApiCall(ENDPOINTS.SUPPLIERS);
    
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
  if (!ENDPOINTS.SALES_REPS) {
    console.warn('[renderer] Backend URL not configured. Cannot load sales reps.');
    salesReps = [];
    return;
  }
  
  try {
    console.log('[renderer] Loading sales reps from:', ENDPOINTS.SALES_REPS);
    const data = await makeApiCall(ENDPOINTS.SALES_REPS);
    
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

// Customer dropdown management
function populateCustomerDropdown() {
  const customerSelect = document.getElementById('customerSelect');
  if (!customerSelect) {
    console.warn('[renderer] Customer select element not found');
    return;
  }
  
  // Clear existing options except the first one
  customerSelect.innerHTML = '<option value="">Select Customer...</option>';
  
  if (customers.length === 0) {
    const errorOption = document.createElement('option');
    errorOption.value = '';
    errorOption.textContent = 'No customers available (check backend connection)';
    errorOption.disabled = true;
    errorOption.style.color = '#d32f2f';
    customerSelect.appendChild(errorOption);
    return;
  }
  
  // Add customer options
  customers.forEach(customer => {
    const option = document.createElement('option');
    option.value = customer.id;
    
    // Display name priority: business_name, then first_name + last_name, then email, then id
    let displayName = '';
    if (customer.restaurant_profile && customer.restaurant_profile.business_name) {
      displayName = customer.restaurant_profile.business_name;
      if (customer.restaurant_profile.branch_name) {
        displayName += ` - ${customer.restaurant_profile.branch_name}`;
      }
    } else if (customer.first_name) {
      displayName = customer.first_name;
      if (customer.last_name) {
        displayName += ` ${customer.last_name}`;
      }
    } else if (customer.email) {
      displayName = customer.email;
    } else {
      displayName = `Customer ${customer.id}`;
    }
    
    option.textContent = displayName;
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
  if (!ENDPOINTS.CUSTOMERS) {
    const errorMessage = 'Backend URL not configured. Cannot create customer.';
    showApiError(errorMessage);
    return null;
  }
  
  try {
    console.log('[renderer] Creating new customer:', customerData);
    const data = await makeApiCall(ENDPOINTS.CUSTOMERS, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(customerData)
    });
    
    console.log('[renderer] Customer created successfully:', data);
    
    // Add to local customers array and refresh dropdown
    customers.push(data);
    populateCustomerDropdown();
    
    return data;
    
  } catch (error) {
    const errorMessage = handleApiError(error, 'Creating new customer');
    showApiError(errorMessage);
    return null;
  }
}

// Customer matching function
function findCustomerByName(messageText, messageSender = '') {
  if ((!messageText && !messageSender) || customers.length === 0) {
    return null;
  }
  
  const text = (messageText || '').toLowerCase();
  const sender = (messageSender || '').toLowerCase();
  
  // Try to find customer by business name in message text
  for (const customer of customers) {
    if (customer.restaurant_profile && customer.restaurant_profile.business_name) {
      const businessName = customer.restaurant_profile.business_name.toLowerCase();
      
      // Exact match in text or sender
      if (text.includes(businessName) || sender.includes(businessName)) {
        console.log(`[renderer] Found customer match: "${customer.restaurant_profile.business_name}" in message`);
        return customer;
      }
      
      // Try partial matches for common variations
      const businessWords = businessName.split(' ');
      if (businessWords.length > 1) {
        // Check if all words of business name appear in text or sender
        const allWordsMatchText = businessWords.every(word => 
          word.length > 2 && text.includes(word)
        );
        const allWordsMatchSender = businessWords.every(word => 
          word.length > 2 && sender.includes(word)
        );
        if (allWordsMatchText || allWordsMatchSender) {
          console.log(`[renderer] Found partial customer match: "${customer.restaurant_profile.business_name}" in message`);
          return customer;
        }
      }
      
      // Check for common abbreviations/variations
      const variations = getBusinessNameVariations(businessName);
      for (const variation of variations) {
        if (text.includes(variation) || sender.includes(variation)) {
          console.log(`[renderer] Found customer variation match: "${customer.restaurant_profile.business_name}" (${variation}) in message`);
          return customer;
        }
      }
    }
  }
  
  return null;
}

function getBusinessNameVariations(businessName) {
  const variations = [];
  const name = businessName.toLowerCase();
  
  // Common restaurant name variations
  const commonVariations = {
    'mugg and bean': ['mugg & bean', 'mugg bean', 'mugg'],
    'debonair pizza': ['debonair', 'debonairs'],
    'casa bella': ['casabella'],
    'order valley': ['ordervalley'],
    'barchef entertainment': ['barchef', 'bar chef'],
    'pecanwood golf estate': ['pecanwood', 'pecanwood golf'],
    'culinary institute': ['culinary', 'culinary inst']
  };
  
  if (commonVariations[name]) {
    variations.push(...commonVariations[name]);
  }
  
  // Add generic variations
  if (name.includes(' and ')) {
    variations.push(name.replace(' and ', ' & '));
  }
  if (name.includes(' & ')) {
    variations.push(name.replace(' & ', ' and '));
  }
  
  return variations;
}

function autoSelectCustomer(messageText, messageSender = '') {
  const matchedCustomer = findCustomerByName(messageText, messageSender);
  if (matchedCustomer) {
    const customerSelect = document.getElementById('customerSelect');
    if (customerSelect) {
      // Only auto-select if no customer is currently selected
      if (!customerSelect.value || customerSelect.value === '') {
        customerSelect.value = matchedCustomer.id;
        console.log(`[renderer] Auto-selected customer: ${matchedCustomer.restaurant_profile.business_name}`);
        
        // Trigger change event to update UI
        customerSelect.dispatchEvent(new Event('change'));
        return true;
      } else {
        console.log(`[renderer] Customer already selected, skipping auto-selection for: ${matchedCustomer.restaurant_profile.business_name}`);
      }
    }
  }
  return false;
}

// Load all data function
async function loadAllData() {
  console.log('[renderer] Loading all data...');
  
  try {
    // Load data asynchronously (don't await to avoid blocking UI)
    loadCustomers().catch(err => console.error('[renderer] Failed to load customers:', err));
    loadProducts().catch(err => console.error('[renderer] Failed to load products:', err));
    loadDepartments().catch(err => console.error('[renderer] Failed to load departments:', err));
    loadUnits().catch(err => console.error('[renderer] Failed to load units:', err));
    loadSuppliers().catch(err => console.error('[renderer] Failed to load suppliers:', err));
    loadSalesReps().catch(err => console.error('[renderer] Failed to load sales reps:', err));
    loadBusinessSettings().catch(err => console.error('[renderer] Failed to load business settings:', err));
    
    console.log('[renderer] All data loading initiated');
  } catch (error) {
    console.error('[renderer] Error during data loading:', error);
  }
}

async function createNewProduct(productData) {
  if (!ENDPOINTS.PRODUCTS) {
    showApiError('Backend URL not configured. Cannot create product.');
    return null;
  }
  
  try {
    console.log('[renderer] Creating new product:', productData);
    const newProduct = await makeApiCall(ENDPOINTS.PRODUCTS, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(productData)
    });
    
    console.log('[renderer] Created new product:', newProduct);
    
    // Reload products to get the updated list from backend
    await loadProducts();
    
    return newProduct;
    
  } catch (error) {
    const errorMessage = handleApiError(error, 'Creating new product');
    console.error('[dataLoaders] Product creation failed:', errorMessage);
    
    // Re-throw with specific error details for UI handling
    if (errorMessage.includes('already exists') || errorMessage.includes('unique')) {
      throw new Error(`Product with this name already exists`);
    } else {
      throw new Error(errorMessage);
    }
  }
}

// Getters for global data
function getCustomers() {
  return customers;
}

function getDepartments() {
  return departments;
}

function getSuppliers() {
  return suppliers;
}

function getSalesReps() {
  return salesReps;
}

export {
  loadCustomers,
  loadBusinessSettings,
  loadUnits,
  loadProducts,
  loadDepartments,
  loadSuppliers,
  loadSalesReps,
  populateCustomerDropdown,
  createNewCustomer,
  createNewProduct,
  loadAllData,
  getCustomers,
  getDepartments,
  getSuppliers,
  getSalesReps,
  findCustomerByName,
  autoSelectCustomer
};
