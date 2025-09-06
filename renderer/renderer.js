// Main renderer - simplified by using utility modules
// This file orchestrates the application and delegates specific tasks to utility modules

// Import utility modules
import { ENDPOINTS, showApiError } from './utils/apiUtils.js';
import { loadAllData, getCustomers } from './utils/dataLoaders.js';
import { loadConfigurations } from './utils/dataUtils.js';
import { 
  setDomElements, 
  showPanel, 
  handleSelectAll, 
  handleClearSelection, 
  handleSkipMessages, 
  handleClose,
  setRawMessages,
  getRawMessages,
  getSelectedMessageIds,
  getCurrentOrderItems,
  renderSelectedMessages,
  renderOrderPreview,
  renderMessagesList,
  toggleMessageSelection
} from './utils/uiUtils.js';
import { setDomElements as setOrderDomElements, loadOrders, submitOrder, createOrderFromMessages, convertOrderItemsForBackend } from './utils/orderUtils.js';

// Global variables - will be initialized when DOM is ready
let messagesListEl, selectedMessagesListEl, orderPreviewEl, customerSelectEl, verifiedEl, hintEl;
let panelMessages, panelOrders, panelDebug, tabMessages, tabOrders, tabDebug, debugPreEl, debugPostEl;
let btnSelectAll, btnClearSelection, btnCreateOrder, btnClose;
let ordersListEl, statusFilterEl, dateFilterEl, customerFilterEl, btnRefreshOrders;

// Message state - managed by uiUtils.js

// Track initialization state
let appInitialized = false;

// Initialize DOM elements and event listeners
function initializeApp() {
  if (appInitialized) {
    console.log('[renderer] App already initialized, skipping...');
    return;
  }
  
  console.log('[renderer] Initializing app...');
  
  // Initialize DOM elements with null checks
  messagesListEl = document.getElementById('messagesList');
  selectedMessagesListEl = document.getElementById('selectedMessagesList');
  orderPreviewEl = document.getElementById('orderPreview');
  customerSelectEl = document.getElementById('customerSelect');
  verifiedEl = document.getElementById('verified');
  hintEl = document.getElementById('hint');
  panelMessages = document.getElementById('panelMessages');
  panelOrders = document.getElementById('panelOrders');
  panelDebug = document.getElementById('panelDebug');
  tabMessages = document.getElementById('tabMessages');
  tabOrders = document.getElementById('tabOrders');
  tabDebug = document.getElementById('tabDebug');
  debugPreEl = document.getElementById('debugPre');
  debugPostEl = document.getElementById('debugPost');

  // Order management elements
  ordersListEl = document.getElementById('ordersList');
  statusFilterEl = document.getElementById('statusFilter');
  dateFilterEl = document.getElementById('dateFilter');
  customerFilterEl = document.getElementById('customerFilter');
  btnRefreshOrders = document.getElementById('refreshOrders');

  btnSelectAll = document.getElementById('selectAll');
  btnClearSelection = document.getElementById('clearSelection');
  btnCreateOrder = document.getElementById('createOrder');
  btnClose = document.getElementById('close');
  
  // Check if critical elements exist
  if (!messagesListEl || !selectedMessagesListEl || !orderPreviewEl) {
    console.error('[renderer] Critical DOM elements not found, retrying in 100ms...');
    setTimeout(initializeApp, 100);
    return;
  }
  
  // Set DOM elements in UI utils and order utils
  const domElementsObj = {
    messagesListEl,
    selectedMessagesListEl,
    orderPreviewEl,
    customerSelectEl,
    verifiedEl,
    hintEl,
    panelMessages,
    panelOrders,
    panelDebug,
    tabMessages,
    tabOrders,
    tabDebug,
    debugPreEl,
    debugPostEl,
    ordersListEl,
    statusFilterEl,
    dateFilterEl,
    customerFilterEl,
    btnRefreshOrders
  };
  
  setDomElements(domElementsObj);
  setOrderDomElements(domElementsObj);

  // Set up event listeners
  setupEventListeners();

  // Initialize the app state
  try {
    // Load configurations first
    loadConfigurations();
    
    // Load all data
    loadAllData();
    
    // Set default panel
    showPanel('messages');
    
    // Mark as initialized
    appInitialized = true;
    console.log('[renderer] App initialized successfully');
  } catch (error) {
    console.error('[renderer] Error during app initialization:', error);
    showApiError(`Initialization failed: ${error.message}`);
  }
}

function setupEventListeners() {
  // Tab navigation
  if (tabMessages) {
    tabMessages.addEventListener('click', () => showPanel('messages'));
  }
  if (tabOrders) {
    tabOrders.addEventListener('click', () => showPanel('orders'));
  }
  if (tabDebug) {
    tabDebug.addEventListener('click', () => showPanel('debug'));
  }
  
  // Message controls
  if (btnSelectAll) {
    btnSelectAll.addEventListener('click', handleSelectAll);
  }
  if (btnClearSelection) {
    btnClearSelection.addEventListener('click', handleClearSelection);
  }
  if (btnClose) {
    btnClose.addEventListener('click', handleClose);
  }
  
  // Order controls
  if (btnCreateOrder) {
    btnCreateOrder.addEventListener('click', handleCreateOrder);
  }
  
  // Order management event listeners
  if (btnRefreshOrders) {
    btnRefreshOrders.addEventListener('click', () => {
      loadOrders().catch(err => console.error('[renderer] Failed to refresh orders:', err));
    });
  }
  
  if (statusFilterEl) {
    statusFilterEl.addEventListener('change', () => {
      // Trigger re-render of orders list
      import('./utils/orderUtils.js').then(({ renderOrdersList }) => {
        renderOrdersList();
      });
    });
  }
  
  if (dateFilterEl) {
    dateFilterEl.addEventListener('change', () => {
      // Trigger re-render of orders list
      import('./utils/orderUtils.js').then(({ renderOrdersList }) => {
        renderOrdersList();
      });
    });
  }
  
  if (customerFilterEl) {
    customerFilterEl.addEventListener('input', () => {
      // Trigger re-render of orders list
      import('./utils/orderUtils.js').then(({ renderOrdersList }) => {
        renderOrdersList();
    });
  });
}

  // Customer select handler
  if (customerSelectEl) {
    customerSelectEl.addEventListener('change', handleCustomerSelect);
  }
}

async function handleCreateOrder() {
  const selectedMessageIds = getSelectedMessageIds();
  const currentOrderItems = getCurrentOrderItems();
  
  if (selectedMessageIds.size === 0) {
    alert('Please select at least one message to create an order.');
    return;
  }
  
  if (!customerSelectEl.value) {
    alert('Please select a customer for the order.');
    return;
  }
  
  if (customerSelectEl.value === 'ADD_NEW') {
    alert('Please create a new customer first, then select them for the order.');
    return;
  }
  
  try {
    // Get actual selected messages from uiUtils
    const rawMessages = getRawMessages();
    const selectedMessages = Array.from(selectedMessageIds).map(id => rawMessages[id]).filter(Boolean);
    
    if (selectedMessages.length === 0) {
      alert('No valid messages found for order creation.');
      return;
    }
    
    // Create order data
    const orderData = createOrderFromMessages(
      selectedMessages,
      customerSelectEl.value,
      verifiedEl ? verifiedEl.checked : false
    );
    
    // Convert and add parsed items to proper backend format
    orderData.items = await convertOrderItemsForBackend(currentOrderItems);
  
  const success = await submitOrder(orderData);
  if (success) {
      // Mark messages as processed and clear selection
      handleSkipMessages();
      alert('Order created successfully!');
    }
  } catch (error) {
    console.error('[renderer] Failed to create order:', error);
    alert(`Failed to create order: ${error.message}`);
  }
}

function handleCustomerSelect(e) {
  if (e.target.value === 'ADD_NEW') {
    // Show new customer dialog
    showNewCustomerDialog();
  }
}

async function showNewCustomerDialog() {
  // Import the dialog function from uiUtils
  const { showNewCustomerDialog: showDialog } = await import('./utils/uiUtils.js');
  const newCustomer = await showDialog();
  
  if (newCustomer) {
    // Create customer using data loader
    const { createNewCustomer } = await import('./utils/dataLoaders.js');
    const createdCustomer = await createNewCustomer(newCustomer);
    
    if (createdCustomer) {
      // Select the new customer
      customerSelectEl.value = createdCustomer.id;
      alert(`Customer "${newCustomer.first_name} ${newCustomer.last_name}" created successfully!`);
    }
  }
}

// Boot function to start the application
function boot() {
  console.log('[renderer] Booting application...');
  
  // Initialize the app when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
  } else {
    initializeApp();
  }
}

// Handle payload from main process
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
      if (hintEl) hintEl.textContent = `Reader error: ${errorMessage}`;
      return;
    }
    
    // Add new messages to the raw messages list - show ALL messages
    if (Array.isArray(payload.items_text)) {
          const rawMessages = getRawMessages();
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
          
          // Update the utils state
      
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
      
      // Update the utils state with the sorted messages
      setRawMessages(rawMessages);
      
      renderMessagesList();
    }
  });
}

// Handle debug payload
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

// Message rendering functions - restored from original
// renderMessagesList and toggleMessageSelection are now imported from uiUtils.js

// Start the application
boot();

// Handle page refresh gracefully
window.addEventListener('beforeunload', (event) => {
  console.log('[renderer] Page is about to refresh/unload');
});

window.addEventListener('load', () => {
  console.log('[renderer] Page loaded/refreshed');
});
