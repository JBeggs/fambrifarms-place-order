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
      let customerName = '';
      if (order.restaurant_business_name) {
        customerName = order.restaurant_business_name;
      } else if (order.restaurant_name && order.restaurant_name.trim() !== ' ') {
        customerName = order.restaurant_name.trim();
      } else if (order.restaurant_email) {
        customerName = order.restaurant_email;
      }
      
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
    
    // Use the serialized customer data from backend
    let customerName = 'Unknown Customer';
    if (order.restaurant_business_name) {
      customerName = order.restaurant_business_name;
    } else if (order.restaurant_name && order.restaurant_name.trim() !== ' ') {
      customerName = order.restaurant_name.trim();
    } else if (order.restaurant_email) {
      customerName = order.restaurant_email;
    }
    
    customerDiv.textContent = customerName;
    
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
  
  // Create a modal
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
    background: rgba(0,0,0,0.5); z-index: 1000; display: flex; 
    align-items: center; justify-content: center; padding: 20px;
  `;
  
  const content = document.createElement('div');
  content.style.cssText = `
    background: white; padding: 0; border-radius: 8px; 
    max-width: 800px; max-height: 90vh; overflow-y: auto;
    width: 100%; box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    position: relative;
  `;
  
  // Get customer name and address
  let customerName = 'Unknown Customer';
  let customerAddress = '';
  if (orderDetails.restaurant_business_name) {
    customerName = orderDetails.restaurant_business_name;
  } else if (orderDetails.restaurant_name && orderDetails.restaurant_name.trim() !== ' ') {
    customerName = orderDetails.restaurant_name.trim();
  } else if (orderDetails.restaurant_email) {
    customerName = orderDetails.restaurant_email;
  }
  
  if (orderDetails.restaurant_address) {
    customerAddress = orderDetails.restaurant_address;
  }
  
  // Calculate totals
  const subtotal = orderDetails.items ? orderDetails.items.reduce((sum, item) => sum + parseFloat(item.total_price || 0), 0) : 0;
  const vatRate = 0.15; // 15% VAT
  const vatAmount = subtotal * vatRate;
  const totalAmount = subtotal + vatAmount;
  
  content.innerHTML = `
    <div style="padding: 30px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #2196f3;">
        <div>
          <h1 style="margin: 0; color: #2196f3; font-size: 28px; font-weight: bold;">INVOICE</h1>
          <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">Order Details</p>
        </div>
        <button class="close-modal-btn" 
                style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999; padding: 5px;">×</button>
    </div>
      
      <!-- Company & Customer Info -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px;">
        <div>
          <h3 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">From:</h3>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #2196f3;">
            <strong style="color: #2196f3; font-size: 18px;">Fambri Farms</strong><br>
            <span style="color: #666; font-size: 14px;">
              Fresh Produce Supplier<br>
              Pretoria, South Africa<br>
              Tel: +27 12 345 6789<br>
              Email: orders@fambrifarms.co.za
            </span>
          </div>
        </div>
        
        <div>
          <h3 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">Bill To:</h3>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #4caf50;">
            <strong style="color: #333; font-size: 18px;">${customerName}</strong><br>
            <span style="color: #666; font-size: 14px;">
              ${customerAddress || 'Address not available'}<br>
              ${orderDetails.restaurant_phone ? `Tel: ${orderDetails.restaurant_phone}<br>` : ''}
              ${orderDetails.restaurant_email ? `Email: ${orderDetails.restaurant_email}` : ''}
            </span>
          </div>
        </div>
      </div>
      
      <!-- Invoice Details -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px;">
        <div>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666; font-weight: 500;">Invoice Number:</td>
              <td style="padding: 8px 0; font-weight: bold; color: #333;">${orderDetails.order_number}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666; font-weight: 500;">Order Date:</td>
              <td style="padding: 8px 0; color: #333;">${new Date(orderDetails.order_date).toLocaleDateString('en-ZA', { 
                year: 'numeric', month: 'long', day: 'numeric' 
              })}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666; font-weight: 500;">Delivery Date:</td>
              <td style="padding: 8px 0; color: #333;">${new Date(orderDetails.delivery_date).toLocaleDateString('en-ZA', { 
                year: 'numeric', month: 'long', day: 'numeric' 
              })}</td>
            </tr>
          </table>
        </div>
        
        <div>
          <div style="text-align: right;">
            <span style="display: inline-block; padding: 8px 16px; background: ${
              orderDetails.status === 'delivered' ? '#4caf50' : 
              orderDetails.status === 'confirmed' ? '#2196f3' : 
              orderDetails.status === 'cancelled' ? '#f44336' : '#ff9800'
            }; color: white; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase;">
              ${orderDetails.status || 'Pending'}
            </span>
          </div>
        </div>
      </div>
      
      <!-- Items Table -->
      <div style="margin-bottom: 30px;">
        <h3 style="margin: 0 0 15px 0; color: #333; font-size: 18px;">Order Items</h3>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="padding: 12px; text-align: left; border-bottom: 1px solid #e0e0e0; color: #333; font-weight: 600;">Description</th>
              <th style="padding: 12px; text-align: center; border-bottom: 1px solid #e0e0e0; color: #333; font-weight: 600; width: 80px;">Qty</th>
              <th style="padding: 12px; text-align: right; border-bottom: 1px solid #e0e0e0; color: #333; font-weight: 600; width: 100px;">Unit Price</th>
              <th style="padding: 12px; text-align: right; border-bottom: 1px solid #e0e0e0; color: #333; font-weight: 600; width: 100px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${orderDetails.items ? orderDetails.items.map((item, index) => {
              // Determine what to show for original text
              let originalInfo = '';
              if (item.original_text && item.original_text.trim() && item.original_text.toLowerCase() !== 'manual entry') {
                originalInfo = `<br><small style="color: #999; font-style: italic;">Original: "${item.original_text}"</small>`;
              }
              
              // Show confidence score if available and meaningful
              let confidenceInfo = '';
              if (item.confidence_score && item.confidence_score < 1.0 && !item.manually_corrected) {
                const confidencePercent = Math.round(item.confidence_score * 100);
                confidenceInfo = `<br><small style="color: #ff9800;">AI Confidence: ${confidencePercent}%</small>`;
              }
              
              return `
                <tr style="background: ${index % 2 === 0 ? '#ffffff' : '#fafafa'};">
                  <td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #333;">
                    <strong>${item.product_name || 'Unknown Product'}</strong>
                    ${item.product_description ? `<br><small style="color: #666;">${item.product_description}</small>` : ''}
                    ${item.product_department ? `<br><small style="color: #2196f3;">Department: ${item.product_department}</small>` : ''}
                    ${item.unit || item.product_default_unit ? `<br><small style="color: #666;">Unit: ${item.unit || item.product_default_unit}</small>` : ''}
                    ${item.product_stock_level ? `<br><small style="color: ${
                      item.product_stock_level === 'high' ? '#4caf50' : 
                      item.product_stock_level === 'medium' ? '#ff9800' : 
                      item.product_stock_level === 'low' ? '#f44336' : '#999'
                    };">Stock: ${item.product_stock_level.charAt(0).toUpperCase() + item.product_stock_level.slice(1)}</small>` : ''}
                    ${originalInfo}
                    ${confidenceInfo}
                    ${item.notes ? `<br><small style="color: #666;">Notes: ${item.notes}</small>` : ''}
                  </td>
                  <td style="padding: 12px; text-align: center; border-bottom: 1px solid #f0f0f0; color: #333;">${item.quantity}</td>
                  <td style="padding: 12px; text-align: right; border-bottom: 1px solid #f0f0f0; color: #333;">R${parseFloat(item.price || 0).toFixed(2)}</td>
                  <td style="padding: 12px; text-align: right; border-bottom: 1px solid #f0f0f0; color: #333; font-weight: 600;">R${parseFloat(item.total_price || 0).toFixed(2)}</td>
                </tr>
              `;
            }).join('') : '<tr><td colspan="4" style="padding: 20px; text-align: center; color: #666;">No items found</td></tr>'}
          </tbody>
        </table>
      </div>
      
      <!-- Totals -->
      <div style="display: flex; justify-content: flex-end; margin-bottom: 30px;">
        <div style="width: 300px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 12px; text-align: right; color: #666; border-top: 1px solid #e0e0e0;">Subtotal:</td>
              <td style="padding: 8px 12px; text-align: right; font-weight: 600; color: #333; border-top: 1px solid #e0e0e0;">R${subtotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; text-align: right; color: #666;">VAT (15%):</td>
              <td style="padding: 8px 12px; text-align: right; color: #333;">R${vatAmount.toFixed(2)}</td>
            </tr>
            <tr style="background: #f8f9fa;">
              <td style="padding: 12px; text-align: right; font-weight: bold; color: #333; border-top: 2px solid #2196f3; font-size: 16px;">Total Amount:</td>
              <td style="padding: 12px; text-align: right; font-weight: bold; color: #2196f3; border-top: 2px solid #2196f3; font-size: 18px;">R${totalAmount.toFixed(2)}</td>
            </tr>
          </table>
        </div>
      </div>
      
      ${orderDetails.original_message && orderDetails.original_message.trim() ? `
        <!-- Original WhatsApp Message -->
        <div style="margin-bottom: 30px;">
          <h3 style="margin: 0 0 15px 0; color: #333; font-size: 18px;">Original WhatsApp Message</h3>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #ff9800;">
            <pre style="margin: 0; white-space: pre-wrap; font-family: inherit; color: #555; line-height: 1.4;">${orderDetails.original_message.trim()}</pre>
          </div>
        </div>
      ` : ''}
      
      <!-- Footer -->
      <div style="text-align: center; padding: 20px; background: #f8f9fa; border-radius: 6px; color: #666; font-size: 12px;">
        <p style="margin: 0;">Thank you for your business!</p>
        <p style="margin: 5px 0 0 0;">For any queries, please contact us at orders@fambrifarms.co.za or +27 12 345 6789</p>
      </div>
    </div>
  `;
  
  // Add event listeners
  const closeBtn = content.querySelector('.close-modal-btn');
  closeBtn.onclick = () => document.body.removeChild(modal);
  
  modal.appendChild(content);
  document.body.appendChild(modal);
  
  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });
}

async function editOrder(orderId) {
  try {
    // Load full order details
    const orderDetails = await getOrderDetails(orderId);
    if (!orderDetails) {
      alert('Failed to load order details for editing');
      return;
    }

    // Load required data for editing
    const { customers, products } = await import('./dataLoaders.js');
    
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
      max-width: 800px; width: 95%; max-height: 90vh; overflow-y: auto;
    `;
    
    // Get current customer name
    let currentCustomerName = 'Unknown Customer';
    if (orderDetails.restaurant_business_name) {
      currentCustomerName = orderDetails.restaurant_business_name;
    } else if (orderDetails.restaurant_name && orderDetails.restaurant_name.trim() !== ' ') {
      currentCustomerName = orderDetails.restaurant_name.trim();
    } else if (orderDetails.restaurant_email) {
      currentCustomerName = orderDetails.restaurant_email;
    }

    dialog.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #f0f0f0; padding-bottom: 15px;">
        <h3 style="margin: 0; color: #333;">Edit Order - ${orderDetails.order_number}</h3>
        <button id="closeEditModal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999;">&times;</button>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
        <div>
          <label style="display: block; margin-bottom: 5px; font-weight: bold;">Customer:</label>
          <select id="editCustomerSelect" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            <option value="">Select Customer...</option>
          </select>
        </div>
        
        <div>
          <label style="display: block; margin-bottom: 5px; font-weight: bold;">Order Status:</label>
          <select id="editOrderStatus" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            <option value="received">Received via WhatsApp</option>
            <option value="parsed">AI Parsed</option>
            <option value="confirmed">Manager Confirmed</option>
            <option value="po_sent">PO Sent to Sales Rep</option>
            <option value="po_confirmed">Sales Rep Confirmed</option>
            <option value="delivered">Delivered to Customer</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
        <div>
          <label style="display: block; margin-bottom: 5px; font-weight: bold;">Order Date:</label>
          <input type="date" id="editOrderDate" value="${orderDetails.order_date}" 
                 style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
        </div>
        
        <div>
          <label style="display: block; margin-bottom: 5px; font-weight: bold;">Delivery Date:</label>
          <input type="date" id="editDeliveryDate" value="${orderDetails.delivery_date}" 
                 style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
        </div>
      </div>
      
      <div style="margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <h4 style="margin: 0;">Order Items:</h4>
          <button id="addNewItem" style="background: #4caf50; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
            + Add Item
          </button>
        </div>
        
        <div id="editOrderItems" style="border: 1px solid #ddd; border-radius: 4px; max-height: 300px; overflow-y: auto;">
          <!-- Order items will be populated here -->
        </div>
      </div>
      
      <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 15px; border-top: 2px solid #f0f0f0;">
        <div>
          <strong>Total Amount: </strong>
          <span id="editOrderTotal">R${parseFloat(orderDetails.total_amount || 0).toFixed(2)}</span>
        </div>
        
        <div style="display: flex; gap: 10px;">
          <button id="cancelEditOrder" style="background: #f44336; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">
            Cancel
          </button>
          <button id="saveEditOrder" style="background: #2196f3; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">
            Save Changes
          </button>
        </div>
      </div>
    `;
    
    modal.appendChild(dialog);
    document.body.appendChild(modal);
    
    // Populate customer dropdown
    await populateEditCustomerDropdown(orderDetails.restaurant);
    
    // Set current order status
    document.getElementById('editOrderStatus').value = orderDetails.status || 'received';
    
    // Populate order items
    await populateEditOrderItems(orderDetails.items || []);
    
    // Event listeners
    document.getElementById('closeEditModal').onclick = () => document.body.removeChild(modal);
    document.getElementById('cancelEditOrder').onclick = () => document.body.removeChild(modal);
    
    document.getElementById('addNewItem').onclick = () => addNewOrderItem();
    
    document.getElementById('saveEditOrder').onclick = async () => {
      await saveOrderChanges(orderDetails.id, modal);
    };
    
    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
    
  } catch (error) {
    console.error('Error opening edit order dialog:', error);
    alert(`Failed to open edit dialog: ${error.message}`);
  }
}

// Helper functions for order editing
async function populateEditCustomerDropdown(currentCustomerId) {
  const customerSelect = document.getElementById('editCustomerSelect');
  
  if (!customerSelect) return;
  
  // Clear existing options except the first one
  customerSelect.innerHTML = '<option value="">Select Customer...</option>';
  
  // Get customers - try multiple sources
  let customersData = null;
  
  // First try window.customers
  if (window.customers && window.customers.length > 0) {
    customersData = window.customers;
  } else {
    // If not available, load fresh from API
    try {
      const { ENDPOINTS, makeApiCall } = await import('./apiUtils.js');
      if (ENDPOINTS.CUSTOMERS) {
        const response = await makeApiCall(ENDPOINTS.CUSTOMERS);
        customersData = response.customers || response.results || response;
      }
    } catch (error) {
      console.error('Failed to load customers:', error);
    }
  }
  
  // Add customer options
  if (customersData && customersData.length > 0) {
    customersData.forEach(customer => {
      const option = document.createElement('option');
      option.value = customer.id;
      
      // Display name priority: business_name, then first_name + last_name, then email
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
      
      // Select current customer
      if (customer.id == currentCustomerId) { // Use == instead of === to handle type differences
        option.selected = true;
      }
    });
  } else {
    // Add a message option
    const errorOption = document.createElement('option');
    errorOption.value = '';
    errorOption.textContent = 'No customers available (check backend connection)';
    errorOption.disabled = true;
    errorOption.style.color = '#d32f2f';
    customerSelect.appendChild(errorOption);
  }
}

async function populateEditOrderItems(items) {
  const container = document.getElementById('editOrderItems');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (!items || items.length === 0) {
    container.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No items in this order</div>';
    return;
  }
  
  items.forEach((item, index) => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'edit-order-item';
    itemDiv.style.cssText = `
      display: grid; grid-template-columns: 2fr 1fr 1fr 1fr auto; gap: 10px; 
      padding: 10px; border-bottom: 1px solid #eee; align-items: center;
    `;
    
    itemDiv.innerHTML = `
      <div>
        <select class="edit-item-product" data-index="${index}" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
          <option value="">Select Product...</option>
        </select>
      </div>
      
      <div>
        <input type="number" class="edit-item-quantity" data-index="${index}" 
               value="${item.quantity}" min="0.01" step="0.01"
               style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
      </div>
      
      <div>
        <input type="number" class="edit-item-price" data-index="${index}" 
               value="${item.price}" min="0" step="0.01"
               style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
      </div>
      
      <div style="text-align: center; font-weight: bold;">
        R<span class="edit-item-total">${parseFloat(item.total_price || 0).toFixed(2)}</span>
      </div>
      
      <div>
        <button class="remove-edit-item" data-index="${index}" 
                style="background: #f44336; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer;">
          ✕
        </button>
      </div>
    `;
    
    container.appendChild(itemDiv);
    
    // Populate product dropdown for this item
    populateItemProductDropdown(itemDiv.querySelector('.edit-item-product'), item.product);
    
    // Add event listeners for quantity and price changes
    const quantityInput = itemDiv.querySelector('.edit-item-quantity');
    const priceInput = itemDiv.querySelector('.edit-item-price');
    const totalSpan = itemDiv.querySelector('.edit-item-total');
    
    const updateTotal = () => {
      const quantity = parseFloat(quantityInput.value) || 0;
      const price = parseFloat(priceInput.value) || 0;
      const total = quantity * price;
      totalSpan.textContent = total.toFixed(2);
      updateOrderTotal();
    };
    
    quantityInput.addEventListener('input', updateTotal);
    priceInput.addEventListener('input', updateTotal);
    
    // Remove item button
    itemDiv.querySelector('.remove-edit-item').addEventListener('click', () => {
      itemDiv.remove();
      updateOrderTotal();
    });
  });
  
  updateOrderTotal();
}

async function populateItemProductDropdown(selectElement, currentProductId) {
  if (!selectElement) return;
  
  // Clear existing options
  selectElement.innerHTML = '<option value="">Select Product...</option>';
  
  // Get products - try multiple sources
  let productsData = null;
  
  // First try window.products
  if (window.products && window.products.length > 0) {
    productsData = window.products;
  } else {
    // If not available, load fresh from API
    try {
      const { ENDPOINTS, makeApiCall } = await import('./apiUtils.js');
      if (ENDPOINTS.PRODUCTS) {
        const response = await makeApiCall(ENDPOINTS.PRODUCTS);
        productsData = response.products || response.results || response;
      }
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  }
  
  // Add product options
  if (productsData && productsData.length > 0) {
    productsData.forEach(product => {
      const option = document.createElement('option');
      option.value = product.id;
      option.textContent = product.name;
      option.dataset.price = product.price || 0;
      
      selectElement.appendChild(option);
      
      // Select current product
      if (product.id == currentProductId) { // Use == to handle type differences
        option.selected = true;
      }
    });
  } else {
    // Add error message
    const errorOption = document.createElement('option');
    errorOption.value = '';
    errorOption.textContent = 'No products available';
    errorOption.disabled = true;
    errorOption.style.color = '#d32f2f';
    selectElement.appendChild(errorOption);
  }
  
  // Update price when product changes
  selectElement.addEventListener('change', (e) => {
    const selectedOption = e.target.selectedOptions[0];
    if (selectedOption && selectedOption.dataset.price) {
      const itemDiv = e.target.closest('.edit-order-item');
      const priceInput = itemDiv.querySelector('.edit-item-price');
      priceInput.value = selectedOption.dataset.price;
      
      // Trigger total update
      priceInput.dispatchEvent(new Event('input'));
    }
  });
}

function addNewOrderItem() {
  const container = document.getElementById('editOrderItems');
  if (!container) return;
  
  // Remove "no items" message if it exists
  if (container.innerHTML.includes('No items in this order')) {
    container.innerHTML = '';
  }
  
  const itemCount = container.children.length;
  const itemDiv = document.createElement('div');
  itemDiv.className = 'edit-order-item';
  itemDiv.style.cssText = `
    display: grid; grid-template-columns: 2fr 1fr 1fr 1fr auto; gap: 10px; 
    padding: 10px; border-bottom: 1px solid #eee; align-items: center;
  `;
  
  itemDiv.innerHTML = `
    <div>
      <select class="edit-item-product" data-index="${itemCount}" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
        <option value="">Select Product...</option>
      </select>
    </div>
    
    <div>
      <input type="number" class="edit-item-quantity" data-index="${itemCount}" 
             value="1" min="0.01" step="0.01"
             style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
    </div>
    
    <div>
      <input type="number" class="edit-item-price" data-index="${itemCount}" 
             value="0" min="0" step="0.01"
             style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
    </div>
    
    <div style="text-align: center; font-weight: bold;">
      R<span class="edit-item-total">0.00</span>
    </div>
    
    <div>
      <button class="remove-edit-item" data-index="${itemCount}" 
              style="background: #f44336; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer;">
        ✕
      </button>
    </div>
  `;
  
  container.appendChild(itemDiv);
  
  // Populate product dropdown
  populateItemProductDropdown(itemDiv.querySelector('.edit-item-product'));
  
  // Add event listeners
  const quantityInput = itemDiv.querySelector('.edit-item-quantity');
  const priceInput = itemDiv.querySelector('.edit-item-price');
  const totalSpan = itemDiv.querySelector('.edit-item-total');
  
  const updateTotal = () => {
    const quantity = parseFloat(quantityInput.value) || 0;
    const price = parseFloat(priceInput.value) || 0;
    const total = quantity * price;
    totalSpan.textContent = total.toFixed(2);
    updateOrderTotal();
  };
  
  quantityInput.addEventListener('input', updateTotal);
  priceInput.addEventListener('input', updateTotal);
  
  // Remove item button
  itemDiv.querySelector('.remove-edit-item').addEventListener('click', () => {
    itemDiv.remove();
    updateOrderTotal();
  });
}

function updateOrderTotal() {
  const totalSpans = document.querySelectorAll('.edit-item-total');
  let total = 0;
  
  totalSpans.forEach(span => {
    total += parseFloat(span.textContent) || 0;
  });
  
  const orderTotalElement = document.getElementById('editOrderTotal');
  if (orderTotalElement) {
    orderTotalElement.textContent = `R${total.toFixed(2)}`;
  }
}

async function saveOrderChanges(orderId, modal) {
  try {
    // Collect form data
    const customerId = document.getElementById('editCustomerSelect').value;
    const orderStatus = document.getElementById('editOrderStatus').value;
    const orderDate = document.getElementById('editOrderDate').value;
    const deliveryDate = document.getElementById('editDeliveryDate').value;
    
    // Collect items data
    const items = [];
    const itemDivs = document.querySelectorAll('.edit-order-item');
    
    itemDivs.forEach(itemDiv => {
      const productSelect = itemDiv.querySelector('.edit-item-product');
      const quantityInput = itemDiv.querySelector('.edit-item-quantity');
      const priceInput = itemDiv.querySelector('.edit-item-price');
      
      const productId = productSelect.value;
      const quantity = parseFloat(quantityInput.value);
      const price = parseFloat(priceInput.value);
      
      if (productId && quantity > 0 && price >= 0) {
        items.push({
          product: productId,
          quantity: quantity,
          price: price,
          total_price: quantity * price
        });
      }
    });
    
    if (items.length === 0) {
      alert('Please add at least one item to the order');
      return;
    }
    
    if (!customerId) {
      alert('Please select a customer');
      return;
    }
    
    // Calculate total
    const totalAmount = items.reduce((sum, item) => sum + item.total_price, 0);
    
    // Prepare order data for backend
    const orderData = {
      restaurant: customerId,
      status: orderStatus,
      order_date: orderDate,
      delivery_date: deliveryDate,
      subtotal: totalAmount,
      total_amount: totalAmount,
      items: items
    };
    
    console.log('Saving order changes:', orderData);
    
    // Call API to update order
    const { ENDPOINTS, makeApiCall } = await import('./apiUtils.js');
    
    if (!ENDPOINTS.ORDER_DETAIL) {
      alert('Backend API not configured for order updates');
      return;
    }
    
    const response = await makeApiCall(`${ENDPOINTS.ORDER_DETAIL}${orderId}/`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData)
    });
    
    console.log('Order update response:', response);
    
    alert('Order updated successfully!');
    document.body.removeChild(modal);
    
    // Refresh orders list
    await loadOrders();
    
  } catch (error) {
    console.error('Error saving order changes:', error);
    alert(`Failed to save changes: ${error.message}`);
  }
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
    // Load full PO details, passing the order data as fallback
    const poDetails = await loadPurchaseOrderDetails(purchaseOrder.id || purchaseOrder, order);
    
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
      background: white; padding: 30px; border-radius: 8px; 
      max-width: 800px; width: 95%; max-height: 90vh; overflow-y: auto;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    `;
    
    // Format dates
    const orderDate = poDetails.order_date ? new Date(poDetails.order_date).toLocaleDateString() : 'N/A';
    const deliveryDate = poDetails.expected_delivery_date ? new Date(poDetails.expected_delivery_date).toLocaleDateString() : 'N/A';
    
    dialog.innerHTML = `
      <div id="poContent" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 3px solid #2196f3;">
          <div>
            <h2 style="margin: 0; color: #2196f3; font-size: 24px;">Purchase Order: ${poDetails.po_number}</h2>
            <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">Professional Purchase Order</p>
          </div>
          <span style="background: ${
            poDetails.status === 'sent' ? '#4caf50' : 
            poDetails.status === 'confirmed' ? '#2196f3' : 
            poDetails.status === 'delivered' ? '#4caf50' : '#ff9800'
          }; color: white; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase;">
            ${poDetails.status || 'DRAFT'}
          </span>
        </div>
        
        <!-- Company & Supplier Info -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 25px;">
          <div>
            <h4 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">Order Information</h4>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #2196f3;">
              <p style="margin: 0 0 8px 0;"><strong>Order Number:</strong> ${order.order_number}</p>
              <p style="margin: 0 0 8px 0;"><strong>Customer:</strong> ${order.restaurant_business_name || order.restaurant_name}</p>
              <p style="margin: 0;"><strong>Order Date:</strong> ${orderDate}</p>
            </div>
          </div>
          
          <div>
            <h4 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">Supplier Information</h4>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #4caf50;">
              <p style="margin: 0 0 8px 0;"><strong>Supplier:</strong> ${poDetails.supplier?.name || 'N/A'}</p>
              <p style="margin: 0 0 8px 0;"><strong>Sales Rep:</strong> ${poDetails.sales_rep?.name || 'N/A'}</p>
              <p style="margin: 0;"><strong>Contact:</strong> ${poDetails.sales_rep?.email || poDetails.sales_rep?.phone || 'N/A'}</p>
            </div>
          </div>
        </div>
        
        <!-- Items Table -->
        <div style="margin-bottom: 25px;">
          <h4 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">Items</h4>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden;">
            <thead>
              <tr style="background: #f5f5f5;">
                <th style="padding: 12px; text-align: left; border-bottom: 1px solid #e0e0e0; color: #333; font-weight: 600;">Product</th>
                <th style="padding: 12px; text-align: center; border-bottom: 1px solid #e0e0e0; color: #333; font-weight: 600; width: 80px;">Quantity</th>
                <th style="padding: 12px; text-align: right; border-bottom: 1px solid #e0e0e0; color: #333; font-weight: 600; width: 100px;">Unit Price</th>
                <th style="padding: 12px; text-align: right; border-bottom: 1px solid #e0e0e0; color: #333; font-weight: 600; width: 100px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${poDetails.items ? poDetails.items.map((item, index) => `
                <tr style="background: ${index % 2 === 0 ? '#ffffff' : '#fafafa'};">
                  <td style="padding: 12px; border-bottom: 1px solid #f0f0f0; color: #333;">
                    <strong>${item.product?.name || item.product_name || 'Unknown Product'}</strong>
                  </td>
                  <td style="padding: 12px; text-align: center; border-bottom: 1px solid #f0f0f0; color: #333;">${item.quantity_ordered}${item.unit ? ` ${item.unit}` : ''}</td>
                  <td style="padding: 12px; text-align: right; border-bottom: 1px solid #f0f0f0; color: #333;">R${parseFloat(item.unit_price || 0).toFixed(2)}</td>
                  <td style="padding: 12px; text-align: right; border-bottom: 1px solid #f0f0f0; color: #333; font-weight: 600;">R${parseFloat(item.total_price || 0).toFixed(2)}</td>
                </tr>
              `).join('') : '<tr><td colspan="4" style="padding: 20px; text-align: center; color: #666;">No items</td></tr>'}
            </tbody>
          </table>
        </div>
        
        <!-- Total -->
        <div style="display: flex; justify-content: flex-end; margin-bottom: 25px;">
          <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; border-top: 2px solid #2196f3;">
            <div style="font-size: 18px; font-weight: bold; color: #2196f3;">
              Total Amount: R${parseFloat(poDetails.total_amount || 0).toFixed(2)}
            </div>
          </div>
        </div>
        
        ${poDetails.notes ? `
          <div style="margin-bottom: 25px;">
            <h4 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">Notes</h4>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #ff9800;">
              <div style="white-space: pre-wrap; color: #555;">${poDetails.notes}</div>
            </div>
          </div>
        ` : ''}
      </div>
      
      <div style="margin-top: 25px; display: flex; gap: 10px; justify-content: flex-end; padding-top: 15px; border-top: 1px solid #e0e0e0;">
        <button id="closePO" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">Close</button>
        <button id="printPO" style="padding: 10px 20px; background: #2196f3; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">Print</button>
        <button id="whatsappPO" style="padding: 10px 20px; background: #25d366; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">Send WhatsApp</button>
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

async function loadPurchaseOrderDetails(poId, order = null) {
  const { ENDPOINTS, makeApiCall } = await import('./apiUtils.js');
  
  try {
    // Try to load actual PO details from backend first
    try {
      const data = await makeApiCall(`${ENDPOINTS.PROCUREMENT}/${poId}/`);
      return data;
    } catch (apiError) {
      console.log('PO API endpoint not available, using order data:', apiError.message);
    }
    
    // Fallback: If no backend PO endpoint, construct PO details from the order data
    if (order && order.items) {
      return {
        id: poId,
        po_number: `PO-${new Date().getFullYear()}-${String(poId).padStart(4, '0')}`,
        status: 'sent',
        order_date: order.order_date || new Date().toISOString().split('T')[0],
        expected_delivery_date: order.delivery_date || new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        supplier: {
          name: 'Pretoria Fresh Market',
          contact_person: 'John Smith'
        },
        sales_rep: {
          name: 'Sarah Johnson',
          email: 'sarah@pretoriamarket.co.za',
          phone: '+27 12 345 6789'
        },
        items: order.items.map(item => ({
          product: { name: item.product_name || 'Unknown Product' },
          product_name: item.product_name,
          quantity_ordered: item.quantity,
          unit: item.unit || item.product_default_unit || '',
          unit_price: parseFloat(item.price || 0),
          total_price: parseFloat(item.total_price || (item.quantity * item.price) || 0)
        })),
        total_amount: order.total_amount || order.items.reduce((sum, item) => sum + parseFloat(item.total_price || (item.quantity * item.price) || 0), 0),
        notes: 'Purchase order created from customer order'
      };
    }
    
    // Last resort: return minimal mock data
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
      items: [],
      total_amount: 0,
      notes: 'No items available - order data missing'
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
              <td>${item.product?.name || item.product_name || 'Unknown Product'}</td>
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
  `• ${item.product?.name || item.product_name || 'Unknown'} - Qty: ${item.quantity_ordered} - R${parseFloat(item.total_price || 0).toFixed(2)}`
).join('\n') : 'No items'}

💰 *Total: R${parseFloat(poDetails.total_amount || 0).toFixed(2)}*

${poDetails.notes ? `📝 Notes: ${poDetails.notes}` : ''}

---
Fambri Farms Purchase Order`;

  // Get sales rep phone number if available
  const phoneNumber = poDetails.sales_rep?.phone ? poDetails.sales_rep.phone.replace(/[^\d]/g, '') : '';
  
  console.log('[orderUtils] Sending WhatsApp message via automation...');
  
  if (window.api && window.api.whatsappSendMessage) {
    const result = await window.api.whatsappSendMessage({
      phoneNumber: phoneNumber,
      message: message
    });
    
    if (result.success) {
      alert('✅ Purchase Order sent via WhatsApp successfully!');
      console.log('[orderUtils] WhatsApp message sent automatically');
    } else {
      alert(`❌ Failed to send WhatsApp message: ${result.error}`);
      console.error('[orderUtils] WhatsApp send failed:', result.error);
    }
  } else {
    alert('❌ WhatsApp automation not available');
    console.error('[orderUtils] WhatsApp API not available');
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
