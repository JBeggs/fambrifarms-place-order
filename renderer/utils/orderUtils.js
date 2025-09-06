// Order management utilities
// Handles order-specific operations, order management UI, and order processing

import { ENDPOINTS, makeApiCall, handleApiError } from './apiUtils.js';

// Global order data
let orders = [];

// DOM elements (will be set by main renderer)
let domElements = {};

function setDomElements(elements) {
  domElements = elements;
}

// Order API functions
async function loadOrders() {
  if (!ENDPOINTS.ORDERS_LIST) {
    console.warn('[renderer] Backend URL not configured. Cannot load orders.');
    orders = [];
    return;
  }
  
  try {
    console.log('[renderer] Loading orders from:', ENDPOINTS.ORDERS_LIST);
    const data = await makeApiCall(ENDPOINTS.ORDERS_LIST);
    
    if (data.results) {
      orders = data.results;
    } else if (Array.isArray(data)) {
      orders = data;
    } else {
      throw new Error('Invalid Orders API response: expected array or results field');
    }
    console.log('[renderer] Loaded orders:', orders.length);
    
    renderOrdersList();
    
  } catch (error) {
    const errorMessage = handleApiError(error, 'Loading orders');
    console.warn('[renderer]', errorMessage);
    orders = [];
    renderOrdersList();
  }
}

async function deleteOrder(orderId) {
  if (!ENDPOINTS.ORDER_DELETE) {
    console.warn('[renderer] Backend URL not configured. Cannot delete order.');
    return false;
  }
  
  try {
    console.log('[renderer] Deleting order:', orderId);
    await makeApiCall(`${ENDPOINTS.ORDER_DELETE}${orderId}/`, {
      method: 'DELETE'
    });
    
    console.log('[renderer] Order deleted successfully:', orderId);
    return true;
    
  } catch (error) {
    const errorMessage = handleApiError(error, 'Deleting order');
    console.error('[renderer]', errorMessage);
    alert(`Failed to delete order: ${errorMessage}`);
    return false;
  }
}

async function getOrderDetails(orderId) {
  if (!ENDPOINTS.ORDER_DETAIL) {
    console.warn('[renderer] Backend URL not configured. Cannot get order details.');
    return null;
  }
  
  try {
    console.log('[renderer] Getting order details:', orderId);
    const data = await makeApiCall(`${ENDPOINTS.ORDER_DETAIL}${orderId}/`);
    
    console.log('[renderer] Loaded order details:', data);
    return data;
    
  } catch (error) {
    const errorMessage = handleApiError(error, 'Loading order details');
    console.error('[renderer]', errorMessage);
    alert(`Failed to load order details: ${errorMessage}`);
    return null;
  }
}

async function submitOrder(orderData) {
  if (!ENDPOINTS.ORDERS_FROM_WHATSAPP) { 
    alert('Backend URL not configured. Cannot submit order.'); 
    return false; 
  }
  
  try {
    console.log('[renderer] Submitting order:', orderData);
    const data = await makeApiCall(ENDPOINTS.ORDERS_FROM_WHATSAPP, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderData)
    });
    
    console.log('[renderer] Order submitted successfully:', data);
    alert(`Order created successfully! Order ID: ${data.order_id}`);
    return true;
    
  } catch (error) {
    const errorMessage = handleApiError(error, 'Submitting order');
    console.error('[renderer]', errorMessage);
    alert(`Failed to submit order: ${errorMessage}`);
    return false;
  }
}

// Order UI rendering functions
function renderOrdersList() {
  const { ordersListEl, statusFilterEl, dateFilterEl, customerFilterEl } = domElements;
  
  if (!ordersListEl) return;
  
  ordersListEl.innerHTML = '';
  
  if (orders.length === 0) {
    ordersListEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">No orders found</div>';
    return;
  }
  
  // Apply filters
  const filteredOrders = orders.filter(order => {
    // Status filter
    if (statusFilterEl && statusFilterEl.value && order.status !== statusFilterEl.value) {
      return false;
    }
    
    // Date filter
    if (dateFilterEl && dateFilterEl.value) {
      const orderDate = new Date(order.order_date);
      const filterDate = new Date(dateFilterEl.value);
      if (orderDate.toDateString() !== filterDate.toDateString()) {
        return false;
      }
    }
    
    // Customer filter
    if (customerFilterEl && customerFilterEl.value) {
      const customerName = order.restaurant?.first_name || order.restaurant?.email || '';
      if (!customerName.toLowerCase().includes(customerFilterEl.value.toLowerCase())) {
        return false;
      }
    }
    
    return true;
  });
  
  filteredOrders.forEach(order => {
    const orderDiv = document.createElement('div');
    orderDiv.className = 'order-item';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'order-content';
    
    // Order header
    const headerDiv = document.createElement('div');
    headerDiv.className = 'order-header';
    
    const orderNumber = document.createElement('div');
    orderNumber.className = 'order-number';
    orderNumber.textContent = order.order_number || `Order #${order.id}`;
    
    const statusSpan = document.createElement('span');
    statusSpan.className = `order-status ${order.status || 'unknown'}`;
    statusSpan.textContent = order.status || 'Unknown';
    
    headerDiv.appendChild(orderNumber);
    headerDiv.appendChild(statusSpan);
    
    // Order details
    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'order-details';
    
    const customerDiv = document.createElement('div');
    customerDiv.className = 'order-customer';
    customerDiv.textContent = order.restaurant?.first_name || order.restaurant?.email || 'Unknown Customer';
    
    const dateDiv = document.createElement('div');
    dateDiv.className = 'order-date';
    const orderDate = new Date(order.order_date);
    const deliveryDate = new Date(order.delivery_date);
    dateDiv.textContent = `Order: ${orderDate.toLocaleDateString()} → Delivery: ${deliveryDate.toLocaleDateString()}`;
    
    const itemsDiv = document.createElement('div');
    itemsDiv.className = 'order-items-count';
    const itemCount = order.items ? order.items.length : 0;
    itemsDiv.textContent = `${itemCount} item${itemCount !== 1 ? 's' : ''}`;
    
    detailsDiv.appendChild(customerDiv);
    detailsDiv.appendChild(dateDiv);
    detailsDiv.appendChild(itemsDiv);
    
    contentDiv.appendChild(headerDiv);
    contentDiv.appendChild(detailsDiv);
    
    // Action buttons
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'order-actions';
    
    const viewBtn = document.createElement('button');
    viewBtn.className = 'btn-small btn-view';
    viewBtn.textContent = 'View';
    viewBtn.onclick = () => viewOrderDetails(order.id);
    
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-small btn-edit';
    editBtn.textContent = 'Edit';
    editBtn.onclick = () => editOrder(order.id);
    
    const createPOBtn = document.createElement('button');
    createPOBtn.className = 'btn-small btn-create-po';
    createPOBtn.textContent = 'Create PO';
    createPOBtn.onclick = () => showCreatePODialog(order);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-small btn-delete';
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = () => confirmDeleteOrder(order.id, order.order_number);
    
    actionsDiv.appendChild(viewBtn);
    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(createPOBtn);
    actionsDiv.appendChild(deleteBtn);
    
    orderDiv.appendChild(contentDiv);
    orderDiv.appendChild(actionsDiv);
    
    ordersListEl.appendChild(orderDiv);
  });
}

async function viewOrderDetails(orderId) {
  const orderDetails = await getOrderDetails(orderId);
  if (!orderDetails) return;
  
  // Create a modal or detailed view
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
    background: rgba(0,0,0,0.5); z-index: 1000; display: flex; 
    align-items: center; justify-content: center;
  `;
  
  const content = document.createElement('div');
  content.style.cssText = `
    background: white; padding: 20px; border-radius: 8px; 
    max-width: 600px; max-height: 80vh; overflow-y: auto;
    width: 90%;
  `;
  
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.style.cssText = `
    float: right; background: none; border: none; 
    font-size: 24px; cursor: pointer; color: #999;
  `;
  closeBtn.onclick = () => document.body.removeChild(modal);
  
  content.innerHTML = `
    <h3>Order Details - ${orderDetails.order_number}</h3>
    <div><strong>Customer:</strong> ${orderDetails.restaurant?.first_name || orderDetails.restaurant?.email || 'Unknown'}</div>
    <div><strong>Status:</strong> <span class="order-status ${orderDetails.status}">${orderDetails.status}</span></div>
    <div><strong>Order Date:</strong> ${new Date(orderDetails.order_date).toLocaleDateString()}</div>
    <div><strong>Delivery Date:</strong> ${new Date(orderDetails.delivery_date).toLocaleDateString()}</div>
    <div><strong>Total Amount:</strong> ${orderDetails.total_amount ? `R${orderDetails.total_amount}` : 'Not calculated'}</div>
    <hr>
    <h4>Items:</h4>
    <div class="order-items-list">
      ${orderDetails.items ? orderDetails.items.map(item => `
        <div style="padding: 8px; border-bottom: 1px solid #eee;">
          <strong>${item.product?.name || 'Unknown Product'}</strong><br>
          Quantity: ${item.quantity} ${item.unit || ''}<br>
          Price: R${item.price} (Total: R${item.total_price})<br>
          ${item.original_text ? `<em>Original: "${item.original_text}"</em>` : ''}
        </div>
      `).join('') : '<div>No items found</div>'}
    </div>
    ${orderDetails.original_message ? `
      <hr>
      <h4>Original Message:</h4>
      <div style="background: #f5f5f5; padding: 10px; border-radius: 4px; white-space: pre-wrap;">${orderDetails.original_message}</div>
    ` : ''}
  `;
  
  content.appendChild(closeBtn);
  modal.appendChild(content);
  document.body.appendChild(modal);
}

function editOrder(orderId) {
  // For now, show a simple alert - this could be expanded to a full edit interface
  alert(`Edit functionality for order ${orderId} would be implemented here. This could include:\n\n- Editing order items\n- Changing quantities\n- Updating customer information\n- Modifying delivery dates\n- Changing order status`);
}

async function confirmDeleteOrder(orderId, orderNumber) {
  const confirmed = confirm(`Are you sure you want to delete ${orderNumber || `Order #${orderId}`}?\n\nThis action cannot be undone.`);
  
  if (confirmed) {
    const success = await deleteOrder(orderId);
    if (success) {
      // Remove from local orders array
      orders = orders.filter(order => order.id !== orderId);
      renderOrdersList();
      alert('Order deleted successfully');
    }
  }
}

// Order processing functions
function createOrderFromMessages(selectedMessages, customerId, verified = false) {
  if (!selectedMessages || selectedMessages.length === 0) {
    throw new Error('No messages selected for order creation');
  }
  
  if (!customerId) {
    throw new Error('Customer must be selected for order creation');
  }
  
  // Combine all selected messages
  const combinedText = selectedMessages.map(msg => msg.text).join('\n');
  const firstMessage = selectedMessages[0];
  
  // Create order data structure
  const orderData = {
    whatsapp_message_id: `manual_${Date.now()}`,
    sender: firstMessage.sender || 'manual_entry',
    sender_name: firstMessage.sender || 'Manual Entry',
    message_text: combinedText,
    timestamp: firstMessage.timestamp || new Date().toISOString(),
    customer_id: customerId,
    is_backdated: false,
    verified: verified,
    items: [] // Items will be added by convertOrderItemsForBackend
  };
  
  return orderData;
}

// Convert frontend order items to backend format
async function convertOrderItemsForBackend(frontendItems) {
  const { findProductByName } = await import('./dataUtils.js');
  const convertedItems = [];
  
  for (const item of frontendItems) {
    // Find the actual product by name
    const product = findProductByName(item.name);
    
    if (product) {
      convertedItems.push({
        name: product.name,
        quantity: item.quantity || 1,
        unit: item.unit || product.unit,
        originalText: item.originalText || item.name,
        productId: product.id  // Add product ID for backend
      });
    } else {
      // Product not found - include anyway with warning
      console.warn(`[orderUtils] Product not found: ${item.name}`);
      convertedItems.push({
        name: item.name,
        quantity: item.quantity || 1,
        unit: item.unit || '',
        originalText: item.originalText || item.name,
        productId: null  // No product ID - backend will handle this
      });
    }
  }
  
  return convertedItems;
}

// Purchase Order creation functions
async function showCreatePODialog(order) {
  try {
    // Load suppliers and get the first one as default
    const suppliers = await loadSuppliers();
    if (!suppliers || suppliers.length === 0) {
      alert('No suppliers found. Please add suppliers first.');
      return;
    }
    
    const defaultSupplier = suppliers[0];
    const salesReps = await loadSalesReps(defaultSupplier.id);
    
    // Create modal
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,0,0,0.5); z-index: 1000; display: flex; 
      align-items: center; justify-content: center;
    `;
    
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white; padding: 20px; border-radius: 8px; 
      max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto;
    `;
    
    dialog.innerHTML = `
      <h3>Create Purchase Order</h3>
      <p><strong>Order:</strong> ${order.order_number}</p>
      <p><strong>Customer:</strong> ${order.restaurant_business_name || order.restaurant_name}</p>
      <p><strong>Items:</strong> ${order.items ? order.items.length : 0} products</p>
      <hr>
      
      <div style="margin: 15px 0;">
        <label><strong>Supplier:</strong></label>
        <select id="supplierSelect" style="width: 100%; padding: 8px; margin-top: 5px;">
          ${suppliers.map(s => `<option value="${s.id}" ${s.id === defaultSupplier.id ? 'selected' : ''}>${s.name}</option>`).join('')}
        </select>
      </div>
      
      <div style="margin: 15px 0;">
        <label><strong>Sales Rep:</strong></label>
        <select id="salesRepSelect" style="width: 100%; padding: 8px; margin-top: 5px;">
          <option value="">Select Sales Rep (Optional)</option>
          ${salesReps.map(sr => `<option value="${sr.id}">${sr.name} - ${sr.position || 'Sales Rep'}</option>`).join('')}
        </select>
      </div>
      
      <div style="margin: 15px 0;">
        <label><strong>Expected Delivery Date:</strong></label>
        <input type="date" id="deliveryDate" style="width: 100%; padding: 8px; margin-top: 5px;" value="${order.delivery_date || ''}">
      </div>
      
      <div style="margin: 15px 0;">
        <label><strong>Notes:</strong></label>
        <textarea id="poNotes" rows="3" style="width: 100%; padding: 8px; margin-top: 5px;" placeholder="Additional notes for the purchase order..."></textarea>
      </div>
      
      <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
        <button id="cancelPO" style="padding: 8px 16px; background: #ccc; border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
        <button id="createPO" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Create PO</button>
      </div>
    `;
    
    modal.appendChild(dialog);
    document.body.appendChild(modal);
    
    // Handle supplier change to update sales reps
    const supplierSelect = dialog.querySelector('#supplierSelect');
    const salesRepSelect = dialog.querySelector('#salesRepSelect');
    
    supplierSelect.addEventListener('change', async () => {
      const selectedSupplierId = supplierSelect.value;
      const newSalesReps = await loadSalesReps(selectedSupplierId);
      
      salesRepSelect.innerHTML = '<option value="">Select Sales Rep (Optional)</option>' +
        newSalesReps.map(sr => `<option value="${sr.id}">${sr.name} - ${sr.position || 'Sales Rep'}</option>`).join('');
    });
    
    // Handle buttons
    dialog.querySelector('#cancelPO').onclick = () => {
      document.body.removeChild(modal);
    };
    
    dialog.querySelector('#createPO').onclick = async () => {
      const selectedSupplierId = supplierSelect.value;
      const selectedSalesRepId = salesRepSelect.value || null;
      const deliveryDate = dialog.querySelector('#deliveryDate').value || null;
      const notes = dialog.querySelector('#poNotes').value.trim();
      
      try {
        const result = await createPurchaseOrderFromOrder(order, selectedSupplierId, selectedSalesRepId, deliveryDate, notes);
        if (result.success) {
          alert(`Purchase Order ${result.po_number} created successfully!`);
          document.body.removeChild(modal);
        } else {
          alert(`Failed to create PO: ${result.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Error creating PO:', error);
        alert(`Failed to create PO: ${error.message}`);
      }
    };
    
    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
    
  } catch (error) {
    console.error('Error showing create PO dialog:', error);
    alert(`Failed to load suppliers: ${error.message}`);
  }
}

async function loadSuppliers() {
  const { ENDPOINTS, makeApiCall } = await import('./apiUtils.js');
  
  if (!ENDPOINTS.SUPPLIERS) {
    throw new Error('Suppliers endpoint not configured');
  }
  
  try {
    const data = await makeApiCall(ENDPOINTS.SUPPLIERS);
    return data.results || data || [];
  } catch (error) {
    console.error('Failed to load suppliers:', error);
    throw error;
  }
}

async function loadSalesReps(supplierId) {
  const { ENDPOINTS, makeApiCall } = await import('./apiUtils.js');
  
  if (!ENDPOINTS.SALES_REPS) {
    throw new Error('Sales reps endpoint not configured');
  }
  
  try {
    const data = await makeApiCall(`${ENDPOINTS.SALES_REPS}?supplier=${supplierId}&is_active=true`);
    return data.results || data || [];
  } catch (error) {
    console.error('Failed to load sales reps:', error);
    return []; // Return empty array if sales reps fail to load
  }
}

async function createPurchaseOrderFromOrder(order, supplierId, salesRepId, deliveryDate, notes) {
  const { ENDPOINTS, makeApiCall } = await import('./apiUtils.js');
  
  if (!ENDPOINTS.PROCUREMENT) {
    throw new Error('Procurement endpoint not configured');
  }
  
  try {
    // For now, create a simple PO with the first item from the order
    // In the future, this could be enhanced to handle multiple items or let user select items
    const firstItem = order.items && order.items.length > 0 ? order.items[0] : null;
    
    if (!firstItem) {
      throw new Error('Order has no items to create PO from');
    }
    
    const poData = {
      supplier_id: supplierId,
      sales_rep_id: salesRepId,
      product_id: firstItem.product,
      quantity: Math.ceil(parseFloat(firstItem.quantity) || 1),
      unit_price: parseFloat(firstItem.price) || 0,
      expected_delivery_date: deliveryDate,
      notes: notes || `PO created from order ${order.order_number} for ${order.restaurant_business_name || order.restaurant_name}`
    };
    
    console.log('Creating PO with data:', poData);
    
    const result = await makeApiCall(ENDPOINTS.PROCUREMENT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(poData)
    });
    
    return result;
    
  } catch (error) {
    console.error('Failed to create purchase order:', error);
    throw error;
  }
}

// Getters and setters
function getOrders() {
  return orders;
}

function setOrders(ordersData) {
  orders = ordersData;
}

export {
  setDomElements,
  loadOrders,
  deleteOrder,
  getOrderDetails,
  submitOrder,
  renderOrdersList,
  viewOrderDetails,
  editOrder,
  confirmDeleteOrder,
  createOrderFromMessages,
  convertOrderItemsForBackend,
  getOrders,
  setOrders
};
