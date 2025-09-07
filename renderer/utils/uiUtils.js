// UI utilities for DOM manipulation and rendering
// Handles all UI-related functions, rendering, and DOM interactions

import { generateUnitOptions } from './businessUtils.js';
import { findProductByName, getInventoryStatus, formatOrderItem, getProducts } from './dataUtils.js';

// Global UI state
let selectedMessageIds = new Set();
let processedMessageIds = new Set();
let rawMessages = [];
let currentOrderItems = [];

// DOM element references (will be set by main renderer)
let domElements = {};

function setDomElements(elements) {
  domElements = elements;
}

function getDomElements() {
  return domElements;
}

function renderMessagesList() {
  const { messagesListEl } = domElements;
  if (!messagesListEl) {
    console.warn('[uiUtils] Messages list element not found');
    return;
  }
  
  console.log('[uiUtils] Rendering messages list, count:', rawMessages.length);
  messagesListEl.innerHTML = '';
  
  if (rawMessages.length === 0) {
    messagesListEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">No messages available</div>';
    console.log('[uiUtils] No messages to display');
    return;
  }
  
  rawMessages.forEach((message, index) => {
    if (processedMessageIds.has(index)) return; // Skip processed messages
    
    console.log('[uiUtils] Rendering message:', index, message.timestamp, message.sender);
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-item ${selectedMessageIds.has(index) ? 'selected' : ''}`;
    messageDiv.onclick = () => toggleMessageSelection(index);
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'message-checkbox';
    checkbox.checked = selectedMessageIds.has(index);
    checkbox.onclick = (e) => e.stopPropagation();
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const timestampDiv = document.createElement('div');
    timestampDiv.className = 'message-timestamp';
    timestampDiv.textContent = message.timestamp || 'No timestamp';
    
    const senderDiv = document.createElement('div');
    senderDiv.className = 'message-sender';
    senderDiv.textContent = message.sender || 'Unknown sender';
    
    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    textDiv.textContent = message.text || 'No text content';
    
    contentDiv.appendChild(timestampDiv);
    contentDiv.appendChild(senderDiv);
    contentDiv.appendChild(textDiv);
    
    messageDiv.appendChild(checkbox);
    messageDiv.appendChild(contentDiv);
    
    messagesListEl.appendChild(messageDiv);
  });
}

function toggleMessageSelection(messageId) {
  if (selectedMessageIds.has(messageId)) {
    selectedMessageIds.delete(messageId);
  } else {
    selectedMessageIds.add(messageId);
    
    // Try to auto-select customer based on message content
    const message = rawMessages[messageId];
    if (message && (message.text || message.sender)) {
      // Import and call auto-selection function
      import('./dataLoaders.js').then(({ autoSelectCustomer }) => {
        const wasSelected = autoSelectCustomer(message.text, message.sender);
        if (wasSelected) {
          console.log(`[renderer] Auto-selected customer based on message: "${(message.text || '').substring(0, 50)}..." from sender: "${message.sender || 'Unknown'}"`);
        }
      }).catch(err => {
        console.warn('[renderer] Failed to auto-select customer:', err);
      });
    }
  }
  
  renderMessagesList();
  renderSelectedMessages();
  renderOrderPreview();
}

function renderSelectedMessages() {
  const { selectedMessagesListEl } = domElements;
  if (!selectedMessagesListEl) return;
  
  selectedMessagesListEl.innerHTML = '';
  
  if (selectedMessageIds.size === 0) {
    selectedMessagesListEl.innerHTML = '<div style="padding: 8px; color: #999; text-align: center;">No messages selected</div>';
    return;
  }
  
  Array.from(selectedMessageIds).forEach(id => {
    const message = rawMessages[id];
    if (!message) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'selected-message';
    messageDiv.innerHTML = `
      <div style="font-weight: 500; margin-bottom: 4px;">${message.sender || 'Unknown'} - ${message.timestamp || 'No time'}</div>
      <div style="font-size: 11px; color: #666;">${(message.text || '').substring(0, 100)}${message.text && message.text.length > 100 ? '...' : ''}</div>
    `;
    
    selectedMessagesListEl.appendChild(messageDiv);
  });
}

function renderOrderPreview() {
  const { orderPreviewEl } = domElements;
  if (!orderPreviewEl) return;
  orderPreviewEl.innerHTML = '';
  
  if (selectedMessageIds.size === 0) {
    orderPreviewEl.innerHTML = '<div style="padding: 8px; color: #999; text-align: center;">Select messages to preview order items</div>';
    currentOrderItems = [];
    return;
  }
  
  // Always re-parse items from selected messages to ensure we get all items
  parseOrderItemsFromMessages();
  
  if (currentOrderItems.length === 0) {
    orderPreviewEl.innerHTML = '<div style="padding: 8px; color: #999;">No order items found in selected messages</div>';
    return;
  }
  
  // Render each item with edit/remove buttons and inventory status
  currentOrderItems.forEach((item, index) => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'preview-item';
    itemDiv.dataset.itemIndex = index;
    
    // Item content with inventory status indicator
    const contentDiv = document.createElement('div');
    contentDiv.className = 'preview-item-content';
    
    // Check product and inventory status
    let existingProduct = null;
    
    // If item has a productId, find by ID first
    if (item.productId) {
      const products = getProducts() || [];
      existingProduct = products.find(p => p.id === item.productId);
    }
    
    // Fall back to name search if no productId or product not found by ID
    if (!existingProduct) {
      existingProduct = findProductByName(item.name);
    }
    
    const inventoryStatus = getInventoryStatus(existingProduct);
    
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
          item.name = newProduct.name; // Ensure name matches exactly
          
          // Small delay to ensure products list is updated, then re-render
          setTimeout(() => {
            renderOrderPreview(); // Re-render to show updated validation
          }, 100);
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
      <div style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center;">
        <div style="flex: 0 0 80px;">
          <label style="display: block; font-size: 11px; margin-bottom: 2px;">Quantity</label>
          <input type="number" step="0.1" value="${item.quantity}" placeholder="Qty" class="edit-quantity" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px;">
        </div>
        <div style="flex: 0 0 100px;">
          <label style="display: block; font-size: 11px; margin-bottom: 2px;">Unit</label>
          <select class="edit-unit" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px;">
            ${generateUnitOptions(item.unit)}
          </select>
        </div>
        <div style="flex: 1;">
          <label style="display: block; font-size: 11px; margin-bottom: 2px;">Product</label>
          <input type="text" value="${item.name}" placeholder="Product" class="edit-name" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px;">
        </div>
      </div>
      <div style="margin-bottom: 8px;">
        <label style="display: block; font-size: 11px; margin-bottom: 2px;">Search & Select Existing Product</label>
        <div style="display: flex; gap: 8px;">
          <input type="text" placeholder="Type to search products..." class="edit-product-search" style="flex: 1; padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px;">
          <button class="btn-use-product" disabled style="padding: 6px 12px; border: none; background: #2196f3; color: white; border-radius: 3px; cursor: pointer; font-size: 11px;">Use Selected</button>
        </div>
        <div class="edit-search-results" style="max-height: 100px; overflow-y: auto; margin-top: 4px; display: none;"></div>
      </div>
      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        <button class="btn-cancel" style="padding: 6px 12px; border: 1px solid #ddd; background: white; border-radius: 3px; cursor: pointer; font-size: 11px;">Cancel</button>
        <button class="btn-save" style="padding: 6px 12px; border: none; background: #4caf50; color: white; border-radius: 3px; cursor: pointer; font-size: 11px;">Save</button>
      </div>
    `;
    
    // Edit form event handlers
    const saveBtn = editForm.querySelector('.btn-save');
    const cancelBtn = editForm.querySelector('.btn-cancel');
    const productSearchInput = editForm.querySelector('.edit-product-search');
    const searchResultsDiv = editForm.querySelector('.edit-search-results');
    const useProductBtn = editForm.querySelector('.btn-use-product');
    const nameInput = editForm.querySelector('.edit-name');
    const unitSelect = editForm.querySelector('.edit-unit');
    
    let selectedEditProduct = null;
    
    // Product search functionality for inline editor
    const searchEditProducts = (query) => {
      if (!query || query.length < 2) {
        searchResultsDiv.style.display = 'none';
        return;
      }
      
      // Get products from dataLoaders
      const products = window.products || [];
      const matches = products.filter(p => 
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        (p.common_names && p.common_names.some(name => name.toLowerCase().includes(query.toLowerCase())))
      ).slice(0, 8); // Limit to 8 results for inline editor
      
      if (matches.length === 0) {
        searchResultsDiv.innerHTML = '<div style="padding: 6px; color: #666; font-style: italic; font-size: 11px;">No products found</div>';
        searchResultsDiv.style.display = 'block';
        return;
      }
      
      searchResultsDiv.innerHTML = matches.map(product => `
        <div class="edit-search-result" data-product-id="${product.id}" style="
          padding: 6px; border: 1px solid #ddd; margin-bottom: 2px; border-radius: 3px; 
          cursor: pointer; background: white; font-size: 11px;
        " onmouseover="this.style.background='#f0f0f0'" onmouseout="this.style.background='white'">
          <strong>${product.name}</strong> - ${product.unit} - R${product.price}
        </div>
      `).join('');
      searchResultsDiv.style.display = 'block';
      
      // Add click handlers to search results
      searchResultsDiv.querySelectorAll('.edit-search-result').forEach(resultEl => {
        resultEl.addEventListener('click', () => {
          const productId = parseInt(resultEl.dataset.productId);
          selectedEditProduct = products.find(p => p.id === productId);
          
          // Highlight selected result
          searchResultsDiv.querySelectorAll('.edit-search-result').forEach(el => {
            el.style.background = 'white';
            el.style.border = '1px solid #ddd';
          });
          resultEl.style.background = '#e3f2fd';
          resultEl.style.border = '2px solid #2196f3';
          
          useProductBtn.disabled = false;
          useProductBtn.style.background = '#2196f3';
        });
      });
    };
    
    productSearchInput.addEventListener('input', (e) => {
      searchEditProducts(e.target.value);
    });
    
    useProductBtn.addEventListener('click', () => {
      if (selectedEditProduct) {
        nameInput.value = selectedEditProduct.name;
        unitSelect.value = selectedEditProduct.unit;
        searchResultsDiv.style.display = 'none';
        productSearchInput.value = '';
        useProductBtn.disabled = true;
        useProductBtn.style.background = '#ccc';
      }
    });
    
    saveBtn.onclick = () => saveOrderItemEdit(index);
    cancelBtn.onclick = () => cancelOrderItemEdit(index);
    
    editForm.style.display = 'none';
    
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

function editOrderItem(index) {
  const { orderPreviewEl } = domElements;
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
  const { orderPreviewEl } = domElements;
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
  const { orderPreviewEl } = domElements;
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

function parseOrderItemsFromMessages() {
  console.log('Parsing order items from selected messages');
  currentOrderItems = [];
  
  // Extract items from selected messages
  const selectedMessages = Array.from(selectedMessageIds).map(id => rawMessages[id]).filter(Boolean);
  
  for (const message of selectedMessages) {
    if (!message.text) {
      console.error('[renderer] Selected message missing text for order preview:', message);
      continue;
    }
    
    // Split message text into lines and process each line
    const lines = message.text.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines
      if (trimmedLine.length === 0) continue;
      
      // Use basic order item detection
      if (isBasicOrderItem(trimmedLine)) {
        // Parse quantity and unit from the line
        const parsed = parseItemLine(trimmedLine);
        currentOrderItems.push(parsed);
      }
    }
  }
  
  console.log('Parsed order items:', currentOrderItems.length);
}

// Basic order item detection (fallback when import fails)
function isBasicOrderItem(text) {
  if (!text || text.trim().length < 3) return false;
  
  const trimmed = text.trim().toLowerCase();
  
  // Skip common greetings and responses
  const skipWords = ['hi', 'hello', 'hey', 'thanks', 'thank you', 'good morning', 'good afternoon', 'good evening', 'yes', 'no', 'ok', 'okay', 'sure', 'great', 'perfect'];
  if (skipWords.includes(trimmed)) return false;
  
  // Skip if starts with common non-product phrases
  const skipStarts = ['can you', 'could you', 'would you', 'when will', 'what time', 'how much', 'delivery to', 'address is'];
  if (skipStarts.some(phrase => trimmed.startsWith(phrase))) return false;
  
  // Check for quantity patterns (numbers with units)
  if (/\d+\s*(kg|g|pkt|pkts|box|boxes|bag|bags|bunch|bunches|head|heads|x|×|\*)/i.test(text)) return true;
  
  // Check for "please add" pattern
  if (/^please\s+add\s+/i.test(trimmed)) return true;
  
  // Check for common product words
  const productWords = ['tomato', 'onion', 'potato', 'carrot', 'lettuce', 'spinach', 'broccoli', 'mushroom', 'pepper', 'cucumber', 'cabbage', 'avocado', 'banana', 'apple', 'orange'];
  if (productWords.some(product => trimmed.includes(product))) return true;
  
  // If it's a reasonable length and has letters, might be an item
  if (trimmed.length >= 4 && trimmed.length <= 50 && /[a-zA-Z]/.test(trimmed)) return true;
  
  return false;
}

// Parse individual item line to extract quantity, unit, and name
function parseItemLine(text) {
  const trimmed = text.trim();
  
  // Handle "please add X" pattern
  const pleaseAddMatch = trimmed.match(/^please\s+add\s+(.+)$/i);
  if (pleaseAddMatch) {
    return parseItemLine(pleaseAddMatch[1]); // Recursively parse the item part
  }
  
  // Try to extract quantity and unit
  const quantityMatch = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*(kg|g|pkt|pkts|packet|packets|box|boxes|bag|bags|bunch|bunches|head|heads)?\s*(.*)$/i);
  if (quantityMatch) {
    return {
      quantity: parseFloat(quantityMatch[1]) || 1,
      unit: quantityMatch[2] || '',
      name: quantityMatch[3].trim() || trimmed,
      originalText: text,
      price: 0
    };
  }
  
  // Try multiplication pattern (e.g., "2x tomatoes")
  const multiplyMatch = trimmed.match(/^(\d+)\s*[x×*]\s*(.+)$/i);
  if (multiplyMatch) {
    return {
      quantity: parseInt(multiplyMatch[1]) || 1,
      unit: 'x',
      name: multiplyMatch[2].trim(),
      originalText: text,
      price: 0
    };
  }
  
  // Default: treat whole text as item name
  return {
    quantity: 1,
    unit: '',
    name: trimmed,
    originalText: text,
    price: 0
  };
}

// Panel switching
function showPanel(which) {
  const { panelMessages, panelOrders, panelDebug } = domElements;
  
  if (!panelMessages || !panelOrders || !panelDebug) {
    console.warn('[renderer] Panel elements not found');
    return;
  }
  
  // Get the wrap element to control layout
  const wrapElement = document.querySelector('.wrap');
  
  // Hide all panels
  panelMessages.style.display = 'none';
  panelOrders.style.display = 'none';
  panelDebug.style.display = 'none';
  
  // Remove all view classes
  if (wrapElement) {
    wrapElement.classList.remove('orders-view', 'debug-view', 'messages-view');
  }
  
  // Show selected panel and set appropriate layout
  if (which === 'orders') {
    panelOrders.style.display = '';
    if (wrapElement) {
      wrapElement.classList.add('orders-view');
    }
    // Load orders when Orders tab is first opened
    import('./orderUtils.js').then(({ loadOrders }) => {
      loadOrders().catch(err => console.error('[uiUtils] Failed to load orders:', err));
    });
  } else if (which === 'debug') {
    panelDebug.style.display = '';
    if (wrapElement) {
      wrapElement.classList.add('debug-view');
    }
  } else {
    panelMessages.style.display = '';
    if (wrapElement) {
      wrapElement.classList.add('messages-view');
    }
  }
}

// Event handlers
function handleSelectAll() {
  rawMessages.forEach((_, index) => {
    if (!processedMessageIds.has(index)) {
      selectedMessageIds.add(index);
    }
  });
  renderMessagesList();
  renderSelectedMessages();
  renderOrderPreview();
}

function handleClearSelection() {
  selectedMessageIds.clear();
  renderMessagesList();
  renderSelectedMessages();
  renderOrderPreview();
}

function handleSkipMessages() {
  selectedMessageIds.forEach(id => processedMessageIds.add(id));
  selectedMessageIds.clear();
  renderMessagesList();
  renderSelectedMessages();
  renderOrderPreview();
}

function handleClose() {
  if (window.api && typeof window.api.closeWindow === 'function') {
    window.api.closeWindow();
  } else {
    window.close();
  }
}

// State management
function setRawMessages(messages) {
  rawMessages = messages;
}

function getRawMessages() {
  return rawMessages;
}

function getSelectedMessageIds() {
  return selectedMessageIds;
}

function getCurrentOrderItems() {
  return currentOrderItems;
}

function setCurrentOrderItems(items) {
  currentOrderItems = items;
}

// Helper function to generate department options - NO HARDCODED FALLBACKS
async function generateDepartmentOptions(selectedDepartmentId = '') {
  try {
    // Import and get departments from dataLoaders
    const { getDepartments } = await import('./dataLoaders.js');
    const departments = getDepartments();
    
    if (!departments || departments.length === 0) {
      throw new Error('No departments loaded from backend. Cannot create products without departments.');
    }
    
    return departments.map(dept => 
      `<option value="${dept.id}" ${selectedDepartmentId == dept.id ? 'selected' : ''}>${dept.name}</option>`
    ).join('');
  } catch (error) {
    console.error('[uiUtils] Failed to load departments:', error);
    throw new Error('Departments not available. Please ensure backend is running and departments are configured.');
  }
}

// Dialog functions copied from renderer_original_backup.js
async function showNewProductDialog(productName, unit = 'kg') {
  return new Promise(async (resolve) => {
    // Get departments from dataLoaders - NO HARDCODED FALLBACKS
    const { getDepartments } = await import('./dataLoaders.js');
    const departments = getDepartments();
    
    if (!departments || departments.length === 0) {
      alert('Error: No departments available. Please ensure backend is running and departments are configured.');
      resolve(null);
      return;
    }
    const departmentOptions = departments.map((dept, index) => 
      `<option value="${dept.id}" ${index === 0 ? 'selected' : ''}>${dept.name}</option>`
    ).join('');
    
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
      width: 600px; max-width: 95vw; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    
    dialog.innerHTML = `
      <h3 style="margin: 0 0 16px 0; color: #333;">Add New Product</h3>
      <p style="margin: 0 0 16px 0; color: #666; font-size: 14px;">Product "${productName}" not found in system. Search for existing product or create new:</p>
      
      <!-- Existing Product Search -->
      <div style="margin-bottom: 16px; padding: 12px; background: #f5f5f5; border-radius: 4px;">
        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Search Existing Products</label>
        <div style="display: flex; gap: 8px;">
          <input type="text" id="productSearch" placeholder="Type to search existing products..." style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
          <button type="button" id="useExistingBtn" disabled style="padding: 8px 16px; border: none; background: #2196f3; color: white; border-radius: 4px; cursor: pointer;">Use Selected</button>
        </div>
        <div id="searchResults" style="max-height: 120px; overflow-y: auto; margin-top: 8px; display: none;"></div>
      </div>
      
      <div style="text-align: center; margin: 16px 0; color: #666; font-weight: 500;">OR CREATE NEW PRODUCT</div>
      
      <form id="newProductForm">
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Product Name *</label>
          <input type="text" id="productName" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;" value="${productName}">
        </div>
        <div style="display: flex; gap: 12px; margin-bottom: 12px;">
          <div style="flex: 1;">
            <label style="display: block; margin-bottom: 4px; font-weight: 500;">Unit *</label>
            <select id="productUnit" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;">
              ${generateUnitOptions(unit)}
            </select>
          </div>
          <div style="flex: 1;">
            <label style="display: block; margin-bottom: 4px; font-weight: 500;">Price (R) *</label>
            <input type="number" id="productPrice" required min="0" step="0.01" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;" placeholder="0.00">
          </div>
        </div>
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Department *</label>
          <select id="productDepartment" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;">
            ${departmentOptions}
          </select>
        </div>
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Description</label>
          <textarea id="productDescription" rows="2" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical; box-sizing: border-box;" placeholder="Optional description..."></textarea>
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
    
    // Focus first input and trigger initial search
    setTimeout(() => {
      const nameInput = dialog.querySelector('#productName');
      nameInput.focus();
      // Trigger search for the initial product name to show if it already exists
      if (productName && productName.length >= 2) {
        searchProducts(productName);
      }
    }, 100);
    
    // Event handlers
    const form = dialog.querySelector('#newProductForm');
    const cancelBtn = dialog.querySelector('#cancelBtn');
    const errorDiv = dialog.querySelector('#errorMessage');
    const productSearchInput = dialog.querySelector('#productSearch');
    const searchResultsDiv = dialog.querySelector('#searchResults');
    const useExistingBtn = dialog.querySelector('#useExistingBtn');
    
    let selectedProduct = null;
    
    const cleanup = () => {
      document.body.removeChild(modal);
    };
    
    const showError = (message) => {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
    };
    
    // Product search functionality
    const searchProducts = async (query) => {
      if (!query || query.length < 2) {
        searchResultsDiv.style.display = 'none';
        return;
      }
      
      // Get products from dataUtils
      const { getProducts } = await import('./dataUtils.js');
      const products = getProducts() || [];
      const matches = products.filter(p => 
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        (p.common_names && p.common_names.some(name => name.toLowerCase().includes(query.toLowerCase())))
      ).slice(0, 10); // Limit to 10 results
      
      if (matches.length === 0) {
        searchResultsDiv.innerHTML = '<div style="padding: 8px; color: #666; font-style: italic;">No products found</div>';
        searchResultsDiv.style.display = 'block';
        return;
      }
      
      searchResultsDiv.innerHTML = matches.map(product => `
        <div class="search-result" data-product-id="${product.id}" style="
          padding: 8px; border: 1px solid #ddd; margin-bottom: 4px; border-radius: 4px; 
          cursor: pointer; background: white;
        " onmouseover="this.style.background='#f0f0f0'" onmouseout="this.style.background='white'">
          <strong>${product.name}</strong> - ${product.unit} - R${product.price}
          <div style="font-size: 12px; color: #666;">${product.department_name}</div>
        </div>
      `).join('');
      searchResultsDiv.style.display = 'block';
      
      // Add click handlers to search results
      searchResultsDiv.querySelectorAll('.search-result').forEach(resultEl => {
        resultEl.addEventListener('click', () => {
          const productId = parseInt(resultEl.dataset.productId);
          selectedProduct = products.find(p => p.id === productId);
          
          // Highlight selected result
          searchResultsDiv.querySelectorAll('.search-result').forEach(el => {
            el.style.background = 'white';
            el.style.border = '1px solid #ddd';
          });
          resultEl.style.background = '#e3f2fd';
          resultEl.style.border = '2px solid #2196f3';
          
          useExistingBtn.disabled = false;
          useExistingBtn.style.background = '#2196f3';
        });
      });
    };
    
    productSearchInput.addEventListener('input', (e) => {
      searchProducts(e.target.value);
    });
    
    useExistingBtn.addEventListener('click', () => {
      if (selectedProduct) {
        cleanup();
        resolve(selectedProduct);
      }
    });
    
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
        description: dialog.querySelector('#productDescription').value.trim()
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
        // Import and call createNewProduct function
        const { createNewProduct } = await import('./dataLoaders.js');
        const newProduct = await createNewProduct(productData);
        if (newProduct) {
          cleanup();
          resolve(newProduct);
        } else {
          showError('Failed to create product. Please try again.');
          createBtn.disabled = false;
          createBtn.textContent = 'Create Product';
        }
      } catch (error) {
        console.error('[uiUtils] Error creating product:', error);
        
        // Handle specific error cases
        if (error.message && error.message.includes('already exists')) {
          showError(`Product "${productData.name}" already exists! Use the search above to find and select the existing product instead of creating a duplicate.`);
        } else if (error.message && error.message.includes('unique')) {
          showError(`A product with this name already exists. Please search for it above or use a different name.`);
        } else {
          showError('Failed to create product. Please try again.');
        }
        
        createBtn.disabled = false;
        createBtn.textContent = 'Create Product';
      }
    });
  });
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
          <input type="number" id="initialStock" min="0" step="0.01" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" value="${Math.max(requiredQuantity, 10)}" placeholder="0">
        </div>
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Minimum Stock Level</label>
          <input type="number" id="minLevel" min="0" step="0.01" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" value="5" placeholder="5">
        </div>
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Reorder Level</label>
          <input type="number" id="reorderLevel" min="0" step="0.01" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" value="10" placeholder="10">
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
        initial_stock: parseFloat(dialog.querySelector('#initialStock').value) || 0,
        minimum_level: parseFloat(dialog.querySelector('#minLevel').value) || 5,
        reorder_level: parseFloat(dialog.querySelector('#reorderLevel').value) || 10,
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
        // Would call createInventoryRecord function
        console.log('Would create inventory record:', inventoryData);
        cleanup();
        resolve(inventoryData);
      } catch (error) {
        showError('Failed to create stock item. Please try again.');
        createBtn.disabled = false;
        createBtn.textContent = 'Create Stock Item';
      }
    });
  });
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
          <input type="number" id="addQuantity" required min="0.01" step="0.01" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" value="${Math.max(requiredQuantity, 10)}" placeholder="0">
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
      
      const stockData = {
        quantity: addQuantity,
        reason: reason,
        notes: notes
      };
      
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
      
      // Disable form while adding
      const addBtn = dialog.querySelector('#addBtn');
      addBtn.disabled = true;
      addBtn.textContent = 'Adding...';
      
      try {
        // Would call updateInventoryStock function
        console.log('Would add stock:', stockData);
        cleanup();
        resolve(stockData);
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
          <input type="number" id="orderQuantity" required min="1" step="0.01" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" value="${Math.max(requiredQuantity, 10)}">
        </div>
        ${!isProduction ? `
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Supplier *</label>
          <select id="supplierSelect" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            <option value="">Select Supplier...</option>
            <option value="1">Default Supplier</option>
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
        is_production: isProduction
      };
      
      if (isProduction) {
        const productionDate = dialog.querySelector('#productionDate').value;
        orderData.scheduled_date = productionDate;
      } else {
        const supplierId = dialog.querySelector('#supplierSelect').value;
        const unitPrice = parseFloat(dialog.querySelector('#unitPrice').value) || 0;
        const deliveryDate = dialog.querySelector('#deliveryDate').value;
        
        if (!supplierId) {
          showError('Please select a supplier');
          return;
        }
        
        orderData.supplier_id = supplierId;
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
        // Would call createProcurementOrder function
        console.log('Would create procurement order:', orderData);
        cleanup();
        resolve(orderData);
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
        // Would call createNewCustomer function
        console.log('Would create customer:', customerData);
        cleanup();
        resolve({ ...customerData, id: Date.now() }); // Mock customer
      } catch (error) {
        showError('Failed to create customer. Please try again.');
        createBtn.disabled = false;
        createBtn.textContent = 'Create Customer';
      }
    });
  });
}

// Make functions available globally for onclick handlers
window.editOrderItem = editOrderItem;
window.saveOrderItemEdit = saveOrderItemEdit;
window.cancelOrderItemEdit = cancelOrderItemEdit;
window.removeOrderItem = removeOrderItem;
window.addNewOrderItem = addNewOrderItem;

export {
  setDomElements,
  getDomElements,
  renderMessagesList,
  toggleMessageSelection,
  renderSelectedMessages,
  renderOrderPreview,
  editOrderItem,
  saveOrderItemEdit,
  cancelOrderItemEdit,
  removeOrderItem,
  addNewOrderItem,
  parseOrderItemsFromMessages,
  showPanel,
  handleSelectAll,
  handleClearSelection,
  handleSkipMessages,
  handleClose,
  setRawMessages,
  getRawMessages,
  getSelectedMessageIds,
  getCurrentOrderItems,
  setCurrentOrderItems,
  showNewProductDialog,
  showInventoryDialog,
  showAddStockDialog,
  showProcurementDialog,
  showNewCustomerDialog
};
