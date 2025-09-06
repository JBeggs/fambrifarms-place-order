# User Guide - Place Order Application

## 🎯 Quick Start Guide

### What is Place Order?
Place Order is a desktop application that helps you process customer orders from WhatsApp messages. Instead of trying to automatically understand the messages (which often makes mistakes), you manually select which messages to process, ensuring 100% accuracy.

### Before You Start
1. **Chrome Browser**: Make sure Google Chrome is installed
2. **WhatsApp Web**: You'll need to scan a QR code to log into WhatsApp
3. **Internet Connection**: Required for connecting to the system

## 🚀 Getting Started

### 1. First Time Setup

#### Opening the Application
- Double-click the "Place Order" icon on your desktop
- The application will open in full screen
- Chrome will automatically open to WhatsApp Web

#### WhatsApp Login
1. **Scan QR Code**: Use your phone to scan the QR code in Chrome
2. **Wait for Messages**: Your WhatsApp messages will start appearing
3. **Keep Chrome Open**: Don't close the Chrome window

### 2. Understanding the Interface

```
┌─────────────────────────────────────────────────────────────┐
│                    Place Order Application                   │
├─────────────────────┬───────────────────────────────────────┤
│   WhatsApp Messages │           Order Processing            │
│                     │                                       │
│  📱 Customer A      │  Customer: [Select Customer ▼]       │
│  📱 Customer B      │                                       │
│  📱 Customer C      │  Selected Messages:                   │
│                     │  • Message 1                          │
│                     │  • Message 2                          │
│                     │                                       │
│                     │  Order Items (Preview):               │
│                     │  • 10kg Tomatoes ✅ Available         │
│                     │  • 5kg Onions ❌ Not Found            │
│                     │                                       │
│                     │  [Create Order]                       │
└─────────────────────┴───────────────────────────────────────┘
```

## 📱 Processing Orders Step by Step

### Step 1: Select Messages
1. **View All Messages**: All WhatsApp messages appear on the left side
2. **Click to Select**: Click on messages you want to process
3. **Multiple Selection**: You can select multiple messages from the same customer
4. **Visual Feedback**: Selected messages will be highlighted

**💡 Tip**: Only select messages that contain actual orders, not just conversations.

### Step 2: Choose Customer
1. **Existing Customer**: Click the dropdown and select the customer
2. **New Customer**: If not found, select "Add New Customer"

#### Creating a New Customer
When you select "Add New Customer":
1. **Business Name**: Enter the restaurant/business name (e.g., "Debonairs")
2. **Branch Name**: Enter the specific branch (e.g., "Sandton")
3. **Phone Number**: Enter the customer's phone number
4. **Address**: Enter the delivery address
5. **Click "Create"**: The customer will be saved

**📞 Phone Number Format**: Use format like +27123456789 or 0123456789

### Step 3: Review Order Items
The system will automatically try to understand what items were ordered:

#### Item Status Icons
- ✅ **Available**: Item is in stock and ready
- ❌ **Not Found**: Product doesn't exist in the system
- 📋 **No Stock Record**: Product exists but no inventory tracking
- 🏭 **Needs Production**: Item needs to be produced
- 📦 **Out of Stock**: Item exists but no stock available

### Step 4: Handle Missing Items

#### ❌ Product Not Found - "Add Product" Button
When you see this, the product doesn't exist in your catalog:
1. Click **"Add Product"**
2. **Product Name**: Confirm or edit the product name
3. **Unit**: Select kg, units, boxes, etc.
4. **Price**: Enter the selling price
5. **Department**: Choose the product category
6. **Initial Stock**: How much stock you currently have
7. Click **"Create Product"**

#### 📋 No Stock Record - "Add Stock Item" Button
The product exists but you haven't been tracking inventory:
1. Click **"Add Stock Item"**
2. **Initial Stock**: Enter how much you currently have
3. **Minimum Level**: When to reorder (default: 5)
4. **Reorder Level**: Reorder trigger point (default: 10)
5. Click **"Create Stock Item"**

#### 📦 Out of Stock - Two Buttons
When an item is out of stock, you have two options:

**"Add Stock" Button** (Purple):
- Use this when you have stock but haven't recorded it
- Example: "I found 20kg in the back room"
- Enter the quantity you're adding
- Select the reason (found stock, manual count, etc.)

**"Order Stock" Button** (Orange):
- Use this to order new stock from suppliers
- Select the supplier from the dropdown
- Choose the sales rep (if available)
- Enter expected price and delivery date
- Set priority level

#### 🏭 Needs Production - "Schedule Production" Button
For items that need to be produced:
1. Click **"Schedule Production"**
2. **Production Date**: When to produce
3. **Quantity**: How much to produce
4. **Priority**: Set priority level
5. **Notes**: Any special instructions

### Step 5: Edit Order Items (Optional)
You can modify the order before submitting:

#### Edit Item Quantities
1. Click **"Edit"** next to any item
2. Change the quantity or unit
3. Click **"Save"** to confirm

#### Remove Items
1. Click **"Remove"** next to any item
2. The item will be deleted from the order

#### Add Items
1. Click **"Add Item"** at the bottom
2. Enter product name, quantity, and unit
3. Click **"Add"** to include it

### Step 6: Create the Order
1. **Check Everything**: Make sure all items show ✅ Available
2. **Click "Create Order"**: The order will be sent to the system
3. **Success Message**: You'll see confirmation that the order was created
4. **Continue**: The messages will be marked as processed, and you can continue with the next order

## 🔧 Common Issues and Solutions

### WhatsApp Problems

#### "WhatsApp not loading"
1. **Check Chrome**: Make sure Chrome is open and showing WhatsApp Web
2. **Refresh**: Press F5 in Chrome to refresh WhatsApp Web
3. **Re-scan QR Code**: If logged out, scan the QR code again
4. **Restart**: Close and reopen the Place Order application

#### "No messages showing"
1. **Wait**: Messages can take a few seconds to load
2. **Check WhatsApp**: Make sure you have messages in WhatsApp Web
3. **Refresh**: Try refreshing WhatsApp Web in Chrome

### Customer Issues

#### "Customer not in dropdown"
- Select **"Add New Customer"** to create them
- Make sure to include branch name for chain restaurants

#### "Phone number error"
- Use format: +27123456789 or 0123456789
- Don't include spaces or special characters

### Product Issues

#### "Product not found for common items"
- The system might not recognize the product name
- Try clicking **"Add Product"** and create it
- Use clear, simple product names

#### "Can't find the right department"
- If the department doesn't exist, contact your system administrator
- Choose the closest matching department for now

### Order Issues

#### "Can't create order"
- Make sure all items show ✅ Available status
- Check that a customer is selected
- Verify all required fields are filled

#### "System not responding"
- Check your internet connection
- Wait a few seconds and try again
- If problem persists, restart the application

## 💡 Best Practices

### Message Selection
- **Be Selective**: Only select messages that contain actual orders
- **Group by Customer**: Process all messages from one customer together
- **Check Timestamps**: Make sure messages are recent and relevant

### Customer Management
- **Consistent Names**: Use the same business name format each time
- **Include Branches**: Always specify branch names for chain restaurants
- **Complete Information**: Fill in all address fields for accurate delivery

### Product Management
- **Clear Names**: Use simple, clear product names
- **Consistent Units**: Stick to standard units (kg, units, boxes)
- **Regular Updates**: Keep stock levels updated

### Order Processing
- **Double Check**: Always review the order before submitting
- **Handle Issues**: Resolve all ❌ and 📦 items before creating orders
- **Take Notes**: Use the notes field for special instructions

## 📞 Getting Help

### When to Contact Support
- Application won't start
- WhatsApp Web won't connect
- System errors that persist
- Need new product departments created
- Customer information needs to be updated

### What Information to Provide
- **Error Messages**: Take a screenshot of any error messages
- **Steps Taken**: Describe what you were doing when the problem occurred
- **Customer/Order Details**: If it's related to a specific order
- **Time**: When the problem occurred

### Self-Help Checklist
Before contacting support, try:
1. ✅ Restart the application
2. ✅ Check internet connection
3. ✅ Refresh WhatsApp Web
4. ✅ Wait a few minutes and try again
5. ✅ Check if Chrome is running

---

**Need Help?** Contact your system administrator or technical support team.

**Version**: 1.0.0  
**Last Updated**: 2024
