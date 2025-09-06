# Place Order - WhatsApp Order Processing System

A cross-platform Electron application for processing customer orders from WhatsApp messages with manual selection and validation.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [System Requirements](#system-requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage Guide](#usage-guide)
- [Order Processing Workflow](#order-processing-workflow)
- [Product & Inventory Management](#product--inventory-management)
- [Customer Management](#customer-management)
- [Procurement System](#procurement-system)
- [API Integration](#api-integration)
- [Building & Deployment](#building--deployment)
- [Troubleshooting](#troubleshooting)
- [Architecture](#architecture)

## 🎯 Overview

The Place Order application replaces automated WhatsApp message parsing with a human-in-the-loop approach for 100% accuracy. Users can:

- View all WhatsApp messages in chronological order
- Manually select messages for order processing
- Validate and manage products/inventory
- Create customers and manage branches
- Handle procurement and production orders
- Process orders with full backend integration

## ✨ Features

### Core Functionality
- **Manual Message Selection**: Click to select WhatsApp messages for processing
- **Real-time Message Display**: All messages shown chronologically with timestamps
- **Customer Management**: Create customers with branch support
- **Product Validation**: Check products against catalog and inventory
- **Inventory Management**: Track stock levels, create inventory records
- **Procurement Integration**: Order stock from suppliers with sales rep tracking
- **Production Scheduling**: Schedule production for out-of-stock items
- **Cross-platform**: Runs on macOS (development) and Windows (deployment)

### Advanced Features
- **Dual Stock Actions**: Both "Add Stock" and "Order Stock" for out-of-stock items
- **Smart Product Matching**: Fuzzy matching with common names
- **Branch Management**: Multi-location customer support
- **Sales Rep Integration**: Supplier contact management
- **Error Handling**: Comprehensive API error reporting
- **No Fallbacks**: Strict validation with no silent failures

## 💻 System Requirements

### Development (macOS)
- Node.js 16+ 
- npm 8+
- Chrome browser (for WhatsApp Web automation)
- Backend API running on localhost

### Deployment (Windows)
- Windows 10/11
- Chrome browser
- Backend API accessible via network

## 🚀 Installation

### 1. Clone Repository
```bash
git clone <repository-url>
cd place-order
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create `.env` file:
```env
BACKEND_URL=http://localhost:8000/api/
WHATSAPP_SESSION_PATH=./whatsapp-session
```

### 4. Backend Setup
Ensure Django backend is running with required endpoints:
- `/api/auth/customers/`
- `/api/products/`
- `/api/orders/create-from-whatsapp/`
- `/api/procurement/purchase-orders/create/`
- `/api/suppliers/`
- `/api/suppliers/sales-reps/`

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BACKEND_URL` | Backend API base URL | `http://localhost:8000/api/` |
| `WHATSAPP_SESSION_PATH` | WhatsApp session storage | `./whatsapp-session` |

### Backend Configuration

The application expects these API endpoints to be available:

```javascript
// API Endpoints
const endpoints = {
  customers: '/api/auth/customers/',
  products: '/api/products/products/',  // Updated: Correct ViewSet URL
  orders: '/api/orders/create-from-whatsapp/',
  procurement: '/api/procurement/purchase-orders/create/',
  suppliers: '/api/suppliers/suppliers/',  // Updated: Correct ViewSet URL
  salesReps: '/api/suppliers/sales-reps/',
  departments: '/api/products/departments/'
};
```

## 📖 Usage Guide

### Starting the Application

#### Development Mode
```bash
npm start
```

#### Production Mode
```bash
npm run build
npm run dist
```

### Initial Setup

1. **Launch Application**: The app will maximize on startup
2. **WhatsApp Login**: Chrome will open WhatsApp Web for authentication
3. **Backend Connection**: Verify API connectivity in the status bar
4. **Load Data**: Application loads customers, products, suppliers automatically

### Basic Workflow

1. **View Messages**: All WhatsApp messages appear in the left sidebar (80% height)
2. **Select Messages**: Click messages to add to "Selected Messages" list
3. **Choose Customer**: Select existing customer or create new one
4. **Review Order**: Check "Order Items (Preview)" for validation
5. **Handle Issues**: Use action buttons for missing products/stock
6. **Create Order**: Submit order to backend system

## 🔄 Order Processing Workflow

### 1. Message Selection
- **All Messages Displayed**: Raw messages with timestamps and senders
- **Chronological Order**: Messages sorted by timestamp
- **Multi-select**: Click multiple messages for batch processing
- **Visual Feedback**: Selected messages highlighted

### 2. Customer Selection
- **Existing Customers**: Dropdown with business name and branch
- **New Customer Creation**: Phone validation and branch assignment
- **Branch Support**: Multi-location businesses (e.g., "Debonairs Sandton")

### 3. Order Validation
- **Item Parsing**: Automatic quantity and product extraction
- **Product Matching**: Fuzzy matching with common names
- **Inventory Check**: Real-time stock level validation
- **Edit Capabilities**: Modify quantities, add/remove items

### 4. Issue Resolution
Based on product/inventory status:

| Status | Icon | Action Buttons | Description |
|--------|------|----------------|-------------|
| ✅ Available | Green | None | Ready to order |
| ❌ Not Found | Red | "Add Product" | Create product + inventory |
| 📋 No Inventory | Purple | "Add Stock Item" | Create inventory record |
| 🏭 Needs Production | Orange | "Schedule Production" | Create production order |
| 📦 Out of Stock | Red | "Add Stock" + "Order Stock" | Manual add or purchase order |

### 5. Order Submission
- **Validation**: All items must be resolved
- **Backend Integration**: Creates order with customer and items
- **Status Tracking**: Order marked as manual entry
- **Continuation**: Process remaining messages

## 📦 Product & Inventory Management

### Product Catalog
- **Basic Info**: Name, unit, price, description
- **Common Names**: Alternative product names for matching
- **Department**: Product categorization
- **Status**: Active/inactive products

### Inventory Tracking
- **Available Quantity**: Current stock on hand
- **Reserved Quantity**: Stock allocated to orders
- **Minimum Level**: Automatic reorder trigger
- **Reorder Level**: When to place new orders
- **Production Flag**: Indicates if item needs production

### Stock Operations

#### Add Product (New to Catalog)
```javascript
// Creates both product and inventory record
{
  name: "New Product",
  unit: "kg",
  price: 25.00,
  department_id: 1,
  create_inventory: true,
  initial_stock: 10
}
```

#### Add Stock Item (Existing Product)
```javascript
// Creates inventory record for existing product
{
  create_inventory: true,
  initial_stock: 50,
  minimum_level: 5,
  reorder_level: 10
}
```

#### Add Stock (Manual Adjustment)
```javascript
// Adds to existing inventory
{
  add_stock: 15.5,
  adjustment_type: "found_stock"
}
```

## 👥 Customer Management

### Customer Creation
- **Required Fields**: Business name, phone number
- **Optional Fields**: Branch name, address, city, postal code
- **Phone Validation**: Regex pattern enforcement
- **Branch Support**: Multi-location business handling

### Customer Display
- **Format**: "Business Name - Branch Name"
- **Dropdown**: Searchable customer selection
- **New Customer**: Always available option

### API Integration
```javascript
// Customer creation payload
{
  business_name: "Debonairs",
  branch_name: "Sandton",
  phone: "+27123456789",
  address: "123 Main St",
  city: "Johannesburg",
  postal_code: "2196"
}
```

## 🏭 Procurement System

### Purchase Orders
- **Supplier Selection**: Dynamic supplier dropdown
- **Sales Rep**: Linked to selected supplier
- **Pricing**: Expected unit price and delivery date
- **Priority Levels**: Normal, High, Urgent
- **Notes**: Additional order information

### Production Orders
- **Production Date**: Scheduled production date
- **Quantity**: Amount to produce
- **Priority**: Customer order priority
- **Notes**: Production instructions

### Supplier Management
- **Supplier Info**: Name, contact details, terms
- **Sales Reps**: Multiple reps per supplier
- **Rep Details**: Name, email, phone, position
- **Primary Contact**: Designated main contact

## 🔌 API Integration

### Authentication
Currently uses direct API calls without authentication. Future versions will implement:
- JWT token authentication
- User session management
- Role-based access control

### Error Handling
- **Network Errors**: Connection timeout and retry logic
- **API Errors**: Structured error response handling
- **User Feedback**: Clear error messages with resolution steps
- **No Silent Failures**: All errors reported to user

### Data Flow
```
WhatsApp Messages → Manual Selection → Product Validation → Order Creation
                                    ↓
Customer Management ← API Integration → Inventory Management
                                    ↓
                            Procurement System
```

## 🏗️ Building & Deployment

### Development Build
```bash
npm run build
```

### Windows Distribution
```bash
npm run dist
```

Creates:
- `dist/place-order Setup 1.0.0.exe` - Windows installer
- NSIS installer with auto-update support
- Portable executable option

### Cross-Platform Notes
- **Development**: macOS with Chrome automation
- **Deployment**: Windows with Chrome dependency
- **Session Handling**: Persistent WhatsApp Web sessions
- **Path Handling**: Cross-platform file path resolution

### Build Configuration
```json
{
  "build": {
    "appId": "com.familyfarms.place-order",
    "productName": "Place Order",
    "directories": {
      "output": "dist"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true
    }
  }
}
```

## 🔧 Troubleshooting

### Common Issues

#### Product Creation Errors

**Error**: "405: Method Not Allowed" when creating products
**Solution**: Ensure frontend uses correct API endpoint
```javascript
// Incorrect
const PRODUCTS_ENDPOINT = '/api/products/';

// Correct  
const PRODUCTS_ENDPOINT = '/api/products/products/';
```

**Error**: "Supplier ID is required" for production orders
**Solution**: Ensure backend supports production orders without suppliers
- Check `is_production: true` flag is sent
- Verify procurement model allows null suppliers
- Run latest database migrations

#### WhatsApp Session Problems
```bash
# Clear session data
rm -rf whatsapp-session/
# Restart application for fresh login
```

#### Backend Connection Issues
- Verify `BACKEND_URL` in `.env`
- Check backend server status
- Confirm API endpoints are accessible
- Review CORS settings
- **New**: Ensure all database migrations are applied

#### Database Issues
```bash
# Apply missing migrations
python manage.py makemigrations
python manage.py migrate

# Create test data if needed
python manage.py shell -c "
from suppliers.models import Supplier, SalesRep
supplier = Supplier.objects.create(name='Test Supplier', contact_person='John Doe')
SalesRep.objects.create(supplier=supplier, name='Jane Smith', is_primary=True)
"
```

#### Chrome Automation Issues
- Ensure Chrome is installed and updated
- Check Chrome permissions for automation
- Verify WhatsApp Web compatibility

#### Build Issues
```bash
# Clear node modules and reinstall
rm -rf node_modules/
npm install

# Clear Electron cache
npm run clean
```

### Debug Mode
Enable debug logging:
```bash
DEBUG=* npm start
```

### Log Files
- **Main Process**: Console output
- **Renderer Process**: DevTools console
- **WhatsApp Reader**: Chrome console
- **API Calls**: Network tab in DevTools

## 🏛️ Architecture

### Application Structure
```
place-order/
├── main.js              # Main Electron process
├── preload.js           # Security bridge
├── renderer/
│   ├── index.html       # UI structure
│   └── renderer.js      # UI logic and API calls
├── reader/
│   └── whatsappReader.js # WhatsApp automation
├── shared/
│   └── messageParser.js  # Message parsing utilities
└── config/
    ├── patterns.json     # Regex patterns
    └── validation.json   # Validation rules
```

### Process Communication
```
Main Process (Node.js)
    ↕ IPC
Renderer Process (Chromium)
    ↕ HTTP/HTTPS
Backend API (Django)
    ↕ WebDriver
WhatsApp Web (Chrome)
```

### Security Model
- **Content Security Policy**: Restricts resource loading
- **Node Integration**: Disabled in renderer
- **Context Isolation**: Enabled for security
- **Preload Scripts**: Secure API exposure

### Data Flow
1. **WhatsApp Reader** scrapes messages via Selenium
2. **Main Process** receives messages via IPC
3. **Renderer Process** displays messages and handles UI
4. **User Selection** triggers API calls to backend
5. **Backend Integration** creates orders and updates inventory

### State Management
- **Raw Messages**: Array of WhatsApp messages
- **Selected Messages**: User-selected message IDs
- **Current Order**: Parsed items with validation
- **Customers/Products**: Cached API data
- **UI State**: Modal dialogs and form data

## 📝 Development Notes

### Code Style
- ES6+ JavaScript with async/await
- Modular function organization
- Comprehensive error handling
- Detailed logging and debugging

### Testing Strategy
- Manual testing with real WhatsApp data
- API integration testing
- Cross-platform compatibility testing
- User acceptance testing with non-technical users

### Future Enhancements
- Automated testing suite
- User authentication system
- Offline mode support
- Advanced reporting features
- Multi-language support

---

**Version**: 1.0.0  
**Last Updated**: 2024  
**Platform**: Electron (Cross-platform)  
**License**: Private/Commercial