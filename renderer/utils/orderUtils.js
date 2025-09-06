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
    
    // Check if order has PO and show appropriate button
    const poBtn = document.createElement('button');
    poBtn.className = 'btn-small';
    
    if (order.purchase_orders && order.purchase_orders.length > 0) {
      // Order has PO(s) - show View PO button
      poBtn.classList.add('btn-view-po');
      poBtn.textContent = 'View PO';
      poBtn.onclick = () => showViewPODialog(order, order.purchase_orders[0]);
    } else {
      // No PO - show Create PO button
      poBtn.classList.add('btn-create-po');
      poBtn.textContent = 'Create PO';
      poBtn.onclick = () => showCreatePODialog(order);
    }
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-small btn-delete';
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = () => confirmDeleteOrder(order.id, order.order_number);
    
    actionsDiv.appendChild(viewBtn);
    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(poBtn);
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
          // Refresh orders list to show the new PO button state
          await loadOrders();
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

async function showViewPODialog(order, purchaseOrder) {
  try {
    // Load full PO details
    const poDetails = await loadPurchaseOrderDetails(purchaseOrder.id || purchaseOrder);
    
    if (!poDetails) {
      alert('Failed to load Purchase Order details');
      return;
    }
    
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
      max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;
    `;
    
    // Format dates
    const orderDate = poDetails.order_date ? new Date(poDetails.order_date).toLocaleDateString() : 'N/A';
    const deliveryDate = poDetails.expected_delivery_date ? new Date(poDetails.expected_delivery_date).toLocaleDateString() : 'N/A';
    
    dialog.innerHTML = `
      <div id="poContent">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3>Purchase Order: ${poDetails.po_number}</h3>
          <span style="background: #e3f2fd; color: #1976d2; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;">
            ${poDetails.status?.toUpperCase() || 'DRAFT'}
          </span>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
          <div>
            <h4>Order Information</h4>
            <p><strong>Order Number:</strong> ${order.order_number}</p>
            <p><strong>Customer:</strong> ${order.restaurant_business_name || order.restaurant_name}</p>
            <p><strong>Order Date:</strong> ${orderDate}</p>
            <p><strong>Expected Delivery:</strong> ${deliveryDate}</p>
          </div>
          <div>
            <h4>Supplier Information</h4>
            <p><strong>Supplier:</strong> ${poDetails.supplier?.name || 'N/A'}</p>
            <p><strong>Sales Rep:</strong> ${poDetails.sales_rep?.name || 'N/A'}</p>
            <p><strong>Contact:</strong> ${poDetails.sales_rep?.email || poDetails.sales_rep?.phone || 'N/A'}</p>
          </div>
        </div>
        
        <div style="margin-bottom: 20px;">
          <h4>Items</h4>
          <div style="border: 1px solid #ddd; border-radius: 4px;">
            <div style="background: #f5f5f5; padding: 10px; font-weight: bold; display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 10px;">
              <div>Product</div>
              <div>Quantity</div>
              <div>Unit Price</div>
              <div>Total</div>
            </div>
            ${poDetails.items ? poDetails.items.map(item => `
              <div style="padding: 10px; border-top: 1px solid #eee; display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 10px;">
                <div>${item.product?.name || 'Unknown Product'}</div>
                <div>${item.quantity_ordered}</div>
                <div>R${parseFloat(item.unit_price || 0).toFixed(2)}</div>
                <div>R${parseFloat(item.total_price || 0).toFixed(2)}</div>
              </div>
            `).join('') : '<div style="padding: 10px; text-align: center; color: #666;">No items</div>'}
          </div>
        </div>
        
        <div style="margin-bottom: 20px;">
          <div style="text-align: right; font-size: 1.1rem;">
            <strong>Total: R${parseFloat(poDetails.total_amount || 0).toFixed(2)}</strong>
          </div>
        </div>
        
        ${poDetails.notes ? `
          <div style="margin-bottom: 20px;">
            <h4>Notes</h4>
            <div style="background: #f9f9f9; padding: 10px; border-radius: 4px; white-space: pre-wrap;">${poDetails.notes}</div>
          </div>
        ` : ''}
      </div>
      
      <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
        <button id="closePO" style="padding: 8px 16px; background: #ccc; border: none; border-radius: 4px; cursor: pointer;">Close</button>
        <button id="printPO" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Print</button>
        <button id="whatsappPO" style="padding: 8px 16px; background: #25d366; color: white; border: none; border-radius: 4px; cursor: pointer;">Send WhatsApp</button>
      </div>
    `;
    
    modal.appendChild(dialog);
    document.body.appendChild(modal);
    
    // Handle buttons
    dialog.querySelector('#closePO').onclick = () => {
      document.body.removeChild(modal);
    };
    
    dialog.querySelector('#printPO').onclick = () => {
      printPurchaseOrder(poDetails, order);
    };
    
    dialog.querySelector('#whatsappPO').onclick = () => {
      sendPOViaWhatsApp(poDetails, order);
    };
    
    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
    
  } catch (error) {
    console.error('Error showing view PO dialog:', error);
    alert(`Failed to load PO details: ${error.message}`);
  }
}

async function loadPurchaseOrderDetails(poId) {
  const { ENDPOINTS, makeApiCall } = await import('./apiUtils.js');
  
  // For now, we'll need to create a PO details endpoint or use the existing data
  // Since we don't have a detailed PO endpoint yet, let's simulate the data structure
  try {
    // This would be the actual API call when the backend endpoint exists
    // const data = await makeApiCall(`${ENDPOINTS.PROCUREMENT}/${poId}/`);
    
    // For now, return mock data structure - this should be replaced with actual API call
    return {
      id: poId,
      po_number: `PO-${new Date().getFullYear()}-${String(poId).padStart(4, '0')}`,
      status: 'sent',
      order_date: new Date().toISOString().split('T')[0],
      expected_delivery_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      supplier: {
        name: 'Pretoria Fresh Market',
        contact_person: 'John Smith'
      },
      sales_rep: {
        name: 'Sarah Johnson',
        email: 'sarah@pretoriamarket.co.za',
        phone: '+27 12 345 6789'
      },
      items: [
        {
          product: { name: 'Sample Product' },
          quantity_ordered: 1,
          unit_price: 25.00,
          total_price: 25.00
        }
      ],
      total_amount: 25.00,
      notes: 'Purchase order created from customer order'
    };
  } catch (error) {
    console.error('Failed to load PO details:', error);
    throw error;
  }
}

function printPurchaseOrder(poDetails, order) {
  // Create a new window for printing
  const printWindow = window.open('', '_blank');
  
  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Purchase Order - ${poDetails.po_number}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .po-info { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .items-table th, .items-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .items-table th { background-color: #f5f5f5; }
        .total { text-align: right; font-size: 1.2rem; font-weight: bold; }
        .notes { margin-top: 20px; }
        @media print { body { margin: 0; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>PURCHASE ORDER</h1>
        <h2>${poDetails.po_number}</h2>
        <p>Date: ${new Date().toLocaleDateString()}</p>
      </div>
      
      <div class="po-info">
        <div>
          <h3>From:</h3>
          <p><strong>Fambri Farms</strong><br>
          [Your Address]<br>
          [City, Postal Code]<br>
          [Phone] | [Email]</p>
        </div>
        <div>
          <h3>To:</h3>
          <p><strong>${poDetails.supplier?.name || 'N/A'}</strong><br>
          ${poDetails.sales_rep?.name ? `Attn: ${poDetails.sales_rep.name}<br>` : ''}
          ${poDetails.sales_rep?.email || ''}<br>
          ${poDetails.sales_rep?.phone || ''}</p>
        </div>
      </div>
      
      <div>
        <p><strong>Customer Order:</strong> ${order.order_number}</p>
        <p><strong>Customer:</strong> ${order.restaurant_business_name || order.restaurant_name}</p>
        <p><strong>Expected Delivery:</strong> ${poDetails.expected_delivery_date ? new Date(poDetails.expected_delivery_date).toLocaleDateString() : 'N/A'}</p>
      </div>
      
      <table class="items-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Quantity</th>
            <th>Unit Price</th>
            <th>Total Price</th>
          </tr>
        </thead>
        <tbody>
          ${poDetails.items ? poDetails.items.map(item => `
            <tr>
              <td>${item.product?.name || 'Unknown Product'}</td>
              <td>${item.quantity_ordered}</td>
              <td>R${parseFloat(item.unit_price || 0).toFixed(2)}</td>
              <td>R${parseFloat(item.total_price || 0).toFixed(2)}</td>
            </tr>
          `).join('') : '<tr><td colspan="4">No items</td></tr>'}
        </tbody>
      </table>
      
      <div class="total">
        <p>Total Amount: R${parseFloat(poDetails.total_amount || 0).toFixed(2)}</p>
      </div>
      
      ${poDetails.notes ? `
        <div class="notes">
          <h3>Notes:</h3>
          <p>${poDetails.notes}</p>
        </div>
      ` : ''}
      
      <div style="margin-top: 40px;">
        <p>Thank you for your business!</p>
        <p><em>This is a computer-generated document.</em></p>
      </div>
    </body>
    </html>
  `;
  
  printWindow.document.write(printContent);
  printWindow.document.close();
  
  // Wait for content to load then print
  printWindow.onload = () => {
    printWindow.print();
    printWindow.close();
  };
}

async function sendPOViaWhatsApp(poDetails, order) {
  // Create WhatsApp message content
  const message = `🧾 *PURCHASE ORDER*
📋 PO Number: ${poDetails.po_number}
🏪 Supplier: ${poDetails.supplier?.name || 'N/A'}
👤 Sales Rep: ${poDetails.sales_rep?.name || 'N/A'}

📦 *Order Details:*
Customer: ${order.restaurant_business_name || order.restaurant_name}
Order: ${order.order_number}
Delivery Date: ${poDetails.expected_delivery_date ? new Date(poDetails.expected_delivery_date).toLocaleDateString() : 'N/A'}

📋 *Items:*
${poDetails.items ? poDetails.items.map(item => 
  `• ${item.product?.name || 'Unknown'} - Qty: ${item.quantity_ordered} - R${parseFloat(item.total_price || 0).toFixed(2)}`
).join('\n') : 'No items'}

💰 *Total: R${parseFloat(poDetails.total_amount || 0).toFixed(2)}*

${poDetails.notes ? `📝 Notes: ${poDetails.notes}` : ''}

---
Fambri Farms Purchase Order`;

  // Get sales rep phone number if available
  const phoneNumber = poDetails.sales_rep?.phone ? poDetails.sales_rep.phone.replace(/[^\d]/g, '') : '';
  
  try {
    // Try automated WhatsApp sending first
    console.log('[orderUtils] Attempting automated WhatsApp send...');
    
    if (window.api && window.api.whatsappSendMessage) {
      const result = await window.api.whatsappSendMessage({
        phoneNumber: phoneNumber,
        message: message
      });
      
      if (result.success) {
        alert('✅ Purchase Order sent via WhatsApp successfully!');
        console.log('[orderUtils] WhatsApp message sent automatically');
        return;
      } else {
        console.warn('[orderUtils] Automated WhatsApp send failed:', result.error);
        // Fall through to manual method
      }
    }
    
    // Fallback: Open WhatsApp Web manually
    console.log('[orderUtils] Using manual WhatsApp Web fallback');
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = phoneNumber 
      ? `https://wa.me/${phoneNumber}?text=${encodedMessage}`
      : `https://wa.me/?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
    alert('📱 WhatsApp Web opened - please send the message manually');
    
  } catch (error) {
    console.error('[orderUtils] Error sending WhatsApp message:', error);
    
    // Final fallback: Open WhatsApp Web
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = phoneNumber 
      ? `https://wa.me/${phoneNumber}?text=${encodedMessage}`
      : `https://wa.me/?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
    alert('⚠️ Automated sending failed. WhatsApp Web opened - please send manually.');
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
      order_id: order.id,  // Link PO to the customer order
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
