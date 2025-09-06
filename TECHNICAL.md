# Technical Documentation - Place Order Application

## 🔧 Technical Architecture

### Technology Stack
- **Frontend**: Electron (Chromium + Node.js)
- **Automation**: Selenium WebDriver with Chrome
- **Backend**: Django REST Framework
- **Database**: SQLite/PostgreSQL (backend)
- **Build**: electron-builder with NSIS

### Core Components

#### 1. Main Process (`main.js`)
```javascript
// Key responsibilities:
- Window management and lifecycle
- IPC communication with renderer
- WhatsApp reader integration
- Environment configuration
- Security policy enforcement
```

#### 2. Renderer Process (`renderer/renderer.js`)
```javascript
// Key responsibilities:
- UI state management
- API communication
- Message parsing and display
- Order processing workflow
- Customer/product management
```

#### 3. WhatsApp Reader (`reader/whatsappReader.js`)
```javascript
// Key responsibilities:
- Selenium Chrome automation
- Message extraction from WhatsApp Web
- Session persistence
- Error handling and recovery
```

#### 4. Preload Script (`preload.js`)
```javascript
// Security bridge exposing:
- Configuration data
- IPC communication methods
- Backend URL management
```

## 📡 API Integration

### Backend Endpoints

#### Customer Management
```javascript
// GET /api/auth/customers/
// Response: Array of customer objects
[{
  id: 1,
  business_name: "Debonairs",
  branch_name: "Sandton",
  phone: "+27123456789",
  address: "123 Main St",
  city: "Johannesburg"
}]

// POST /api/auth/customers/
// Payload: Customer creation data
{
  business_name: "New Restaurant",
  branch_name: "Branch Name",
  phone: "+27987654321",
  address: "456 Side St",
  city: "Cape Town",
  postal_code: "8001"
}
```

#### Product Management
```javascript
// GET /api/products/products/  // Updated: Correct ViewSet URL
// Response: Products with inventory data
[{
  id: 1,
  name: "Tomatoes",
  unit: "kg",
  price: "25.00",
  common_names: ["tomato", "ripe tomato"],
  available_quantity: 50,
  reserved_quantity: 10,
  needs_production: false,
  department_name: "Vegetables",
  department_color: "#4caf50"
}]

// POST /api/products/products/  // Updated: Correct ViewSet URL
// Payload: New product with optional inventory
{
  name: "New Product",
  unit: "kg",
  price: 30.00,
  department: 1,  // Updated: Use 'department' not 'department_id'
  create_inventory: true,
  initial_stock: 25
}

// PATCH /api/products/products/{id}/  // Updated: Correct ViewSet URL
// Payload: Update product or add stock
{
  add_stock: 15.5,
  adjustment_type: "manual_add"
}
```

#### Order Creation
```javascript
// POST /api/orders/create-from-whatsapp/
// Payload: Manual order creation
{
  customer_id: 123,
  items: [
    {
      name: "Tomatoes",
      quantity: 10,
      unit: "kg",
      price: 25.00
    }
  ],
  raw_message: "Selected WhatsApp messages",
  order_type: "manual"
}
```

#### Procurement
```javascript
// POST /api/procurement/purchase-orders/create/
// Payload: Purchase order creation
{
  product_id: 456,
  quantity: 50,
  supplier_id: 789,  // Required for purchase orders
  sales_rep_id: 101,  // Optional
  unit_price: 20.00,
  expected_delivery_date: "2024-01-15",
  priority: "high",
  notes: "Customer order requirement"
}

// POST /api/procurement/purchase-orders/create/
// Payload: Production order creation (Updated: No supplier required)
{
  product_id: 456,
  quantity: 25,
  is_production: true,  // Updated: Enables production mode
  priority: "high",
  notes: "Production order for customer demand"
  // supplier_id not required for production orders
}
```

### Error Handling Strategy

#### API Error Structure
```javascript
// Standard error response
{
  error: "Detailed error message",
  code: "ERROR_CODE",
  details: {
    field: "validation error"
  }
}
```

#### Frontend Error Handling
```javascript
async function handleApiError(error, operation) {
  const errorMessage = error.message || 'Unknown error';
  const statusCode = error.status || 0;
  
  // Log for debugging
  console.error(`[API Error] ${operation}:`, error);
  
  // User-friendly messages
  if (statusCode === 0) {
    return `Cannot connect to server. Please check your connection.`;
  } else if (statusCode >= 500) {
    return `Server error during ${operation}. Please try again.`;
  } else if (statusCode === 404) {
    return `Resource not found during ${operation}.`;
  }
  
  return `Error during ${operation}: ${errorMessage}`;
}
```

## 🔄 Message Processing Pipeline

### 1. WhatsApp Message Extraction
```javascript
// WhatsApp reader extracts messages
const messages = await extractMessages();
// Format: { timestamp, sender, content, isForwarded }
```

### 2. Message Parsing
```javascript
// Parse individual message for order items
function parseOrderItems(messageText) {
  const lines = messageText.split('\n');
  const items = [];
  
  for (const line of lines) {
    const item = parseItemQuantity(line);
    if (item) {
      items.push({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit || 'units',
        rawLine: line
      });
    }
  }
  
  return items;
}
```

### 3. Product Validation
```javascript
// Validate each item against product catalog
async function validateOrderItems(items) {
  const validatedItems = [];
  
  for (const item of items) {
    const product = await findProductByName(item.name);
    const inventoryStatus = getInventoryStatus(product);
    
    validatedItems.push({
      ...item,
      product,
      inventoryStatus,
      isValid: product !== null
    });
  }
  
  return validatedItems;
}
```

### 4. Inventory Status Logic
```javascript
function getInventoryStatus(product) {
  if (!product) {
    return { status: 'not_found', message: 'Product not in catalog' };
  }
  
  const hasInventoryRecord = product.available_quantity !== null;
  const availableQty = product.available_quantity || 0;
  const needsProduction = product.needs_production || false;
  
  if (!hasInventoryRecord) {
    return { status: 'no_inventory', message: 'No stock record' };
  } else if (availableQty > 0) {
    return { status: 'available', message: `${availableQty} available` };
  } else if (needsProduction) {
    return { status: 'needs_production', message: 'Needs production' };
  } else {
    return { status: 'out_of_stock', message: 'Out of stock' };
  }
}
```

## 🎨 UI Component Architecture

### Modal Dialog System
```javascript
// Reusable modal creation pattern
function createModal(title, content, actions) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  
  const dialog = document.createElement('div');
  dialog.className = 'modal-dialog';
  
  // Standard modal structure with cleanup
  return new Promise((resolve) => {
    // Event handlers and form processing
  });
}
```

### Dynamic Button Generation
```javascript
// Action buttons based on inventory status
function createActionButtons(item, inventoryStatus) {
  const actions = [];
  
  switch (inventoryStatus.status) {
    case 'not_found':
      actions.push({
        text: 'Add Product',
        color: '#4caf50',
        action: () => showNewProductDialog(item.name, item.unit)
      });
      break;
      
    case 'no_inventory':
      actions.push({
        text: 'Add Stock Item',
        color: '#9c27b0',
        action: () => showInventoryDialog(product, item.quantity)
      });
      break;
      
    case 'out_of_stock':
      actions.push(
        {
          text: 'Add Stock',
          color: '#9c27b0',
          action: () => showAddStockDialog(product, item.quantity)
        },
        {
          text: 'Order Stock',
          color: '#ff9800',
          action: () => showProcurementDialog(product, item.quantity, 'out_of_stock')
        }
      );
      break;
  }
  
  return actions;
}
```

## 🔐 Security Implementation

### Content Security Policy
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               style-src 'self' 'unsafe-inline'; 
               connect-src 'self' http://localhost:* https://localhost:*" />
```

### Electron Security Best Practices
```javascript
// main.js security configuration
const mainWindow = new BrowserWindow({
  webPreferences: {
    nodeIntegration: false,        // Disable Node.js in renderer
    contextIsolation: true,        // Enable context isolation
    enableRemoteModule: false,     // Disable remote module
    preload: path.join(__dirname, 'preload.js')
  }
});
```

### IPC Security
```javascript
// preload.js - Secure API exposure
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Only expose necessary methods
  getConfig: () => ipcRenderer.invoke('get-config'),
  startWhatsAppReader: () => ipcRenderer.invoke('start-whatsapp-reader'),
  onMessagesReceived: (callback) => ipcRenderer.on('messages-received', callback)
});
```

## 📊 Performance Considerations

### Memory Management
```javascript
// Cleanup event listeners
function cleanup() {
  // Remove event listeners
  document.removeEventListener('click', handleClick);
  
  // Clear intervals/timeouts
  if (messagePollingInterval) {
    clearInterval(messagePollingInterval);
  }
  
  // Remove DOM elements
  const modals = document.querySelectorAll('.modal-overlay');
  modals.forEach(modal => modal.remove());
}
```

### API Caching
```javascript
// Cache frequently accessed data
const dataCache = {
  customers: null,
  products: null,
  suppliers: null,
  lastUpdated: null
};

async function loadCachedData(type, forceRefresh = false) {
  const cacheAge = Date.now() - (dataCache.lastUpdated || 0);
  const isStale = cacheAge > 5 * 60 * 1000; // 5 minutes
  
  if (!dataCache[type] || isStale || forceRefresh) {
    dataCache[type] = await fetchFromAPI(type);
    dataCache.lastUpdated = Date.now();
  }
  
  return dataCache[type];
}
```

### DOM Optimization
```javascript
// Efficient DOM updates
function updateMessagesList(messages) {
  const container = document.getElementById('messages-list');
  
  // Use DocumentFragment for batch updates
  const fragment = document.createDocumentFragment();
  
  messages.forEach(message => {
    const messageElement = createMessageElement(message);
    fragment.appendChild(messageElement);
  });
  
  // Single DOM update
  container.innerHTML = '';
  container.appendChild(fragment);
}
```

## 🔧 Recent Fixes & Updates

### Product Creation Issues (Fixed)
**Problem**: 405 Method Not Allowed errors when creating products
**Root Cause**: Frontend calling `/api/products/` instead of `/api/products/products/`
**Solution**: Updated frontend endpoints to use correct ViewSet URLs

```javascript
// Fixed endpoint URLs
const PRODUCTS_ENDPOINT = '/api/products/products/';  // Was: /api/products/
const SUPPLIERS_ENDPOINT = '/api/suppliers/suppliers/';  // Was: /api/suppliers/
```

**Additional Fixes**:
- Fixed ProductSerializer.get_supplier_count() method
- Added get_or_create for inventory to prevent unique constraint errors
- Updated department field name from 'department_id' to 'department'

### Procurement Issues (Fixed)
**Problem**: 400 Bad Request errors for procurement/production orders
**Root Cause**: Missing suppliers, database tables, and rigid supplier requirements
**Solution**: Complete procurement system overhaul

```python
# Added support for production orders without suppliers
is_production = data.get('is_production', False)
if is_production:
    supplier = None  # Optional for production
else:
    supplier = required_supplier  # Required for purchase orders
```

**Database Updates**:
- Created SalesRep model and migration
- Added sales_rep field to PurchaseOrder
- Made supplier field nullable for production orders
- Created test suppliers and sales reps

## 🧪 Testing Strategy

### Manual Testing Checklist
```markdown
## Message Processing
- [ ] All messages display with timestamps
- [ ] Message selection works correctly
- [ ] Forwarded messages are captured
- [ ] Chronological ordering is maintained

## Customer Management
- [ ] Customer dropdown populates
- [ ] New customer creation works
- [ ] Phone validation functions
- [ ] Branch names display correctly

## Product Validation
- [ ] Product matching works with common names
- [ ] Inventory status displays correctly
- [ ] Action buttons appear based on status
- [ ] Stock operations update inventory
- [ ] Product creation works (Fixed: 405 errors)
- [ ] Inventory creation works (Fixed: constraint errors)

## Procurement & Production
- [ ] Purchase orders create successfully (Fixed: 400 errors)
- [ ] Production orders work without suppliers (Fixed: supplier requirement)
- [ ] Sales rep selection works
- [ ] Supplier dropdown populates

## Order Creation
- [ ] Order items can be edited
- [ ] Items can be added/removed
- [ ] Order submission succeeds
- [ ] Error handling works properly
```

### API Testing
```javascript
// Test API connectivity
async function testAPIConnectivity() {
  const tests = [
    { name: 'Customers', endpoint: '/api/auth/customers/' },
    { name: 'Products', endpoint: '/api/products/' },
    { name: 'Suppliers', endpoint: '/api/suppliers/' }
  ];
  
  for (const test of tests) {
    try {
      const response = await fetch(`${BACKEND_URL}${test.endpoint}`);
      console.log(`✅ ${test.name}: ${response.status}`);
    } catch (error) {
      console.error(`❌ ${test.name}: ${error.message}`);
    }
  }
}
```

## 🚀 Deployment Pipeline

### Build Process
```bash
# Development build
npm run build

# Production build with code signing
npm run build:prod

# Windows distribution
npm run dist:win

# Cross-platform build
npm run dist:all
```

### Environment Configuration
```javascript
// Environment-specific settings
const config = {
  development: {
    BACKEND_URL: 'http://localhost:8000/api/',
    DEBUG: true,
    AUTO_UPDATE: false
  },
  production: {
    BACKEND_URL: 'https://api.familyfarms.com/api/',
    DEBUG: false,
    AUTO_UPDATE: true
  }
};
```

### Update Mechanism
```javascript
// Auto-update configuration
"build": {
  "publish": {
    "provider": "github",
    "owner": "familyfarms",
    "repo": "place-order"
  }
}
```

## 🔍 Debugging Guide

### Debug Mode
```bash
# Enable debug logging
DEBUG=* npm start

# Specific module debugging
DEBUG=whatsapp-reader npm start
```

### Common Debug Points
```javascript
// Message processing
console.log('[DEBUG] Raw messages:', rawMessages);
console.log('[DEBUG] Selected messages:', selectedMessageIds);
console.log('[DEBUG] Parsed items:', currentOrderItems);

// API calls
console.log('[DEBUG] API request:', { url, method, body });
console.log('[DEBUG] API response:', response);

// State changes
console.log('[DEBUG] State update:', { before, after });
```

### Performance Monitoring
```javascript
// Performance timing
console.time('Message Processing');
await processMessages();
console.timeEnd('Message Processing');

// Memory usage
console.log('Memory usage:', process.memoryUsage());
```

---

**Technical Lead**: Development Team  
**Last Updated**: 2024  
**Version**: 1.0.0
