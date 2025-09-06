// Data processing utilities
// Handles parsing, formatting, standardization, and data transformation

// Global data stores
let products = [];
let quantityPatterns = null;

function loadConfigurations() {
  try {
    // Load patterns configuration from preload API
    if (window.api && typeof window.api.getPatternsConfig === 'function') {
      quantityPatterns = window.api.getPatternsConfig();
      if (!quantityPatterns) {
        console.error('[renderer] Patterns configuration not loaded');
        throw new Error('Patterns configuration not loaded');
      }
      console.log('[renderer] Loaded patterns configuration');
    } else {
      console.error('[renderer] getPatternsConfig not available');
      throw new Error('Patterns configuration API is not available');
    }
  } catch (error) {
    console.error('[renderer] Failed to load configurations:', error);
    throw new Error(`Configuration loading failed: ${error.message}`);
  }
}

function getQuantityPatterns() {
  if (!quantityPatterns) {
    throw new Error('Quantity patterns not loaded. Call loadConfigurations() first.');
  }
  if (!quantityPatterns.quantity_patterns) {
    throw new Error('Quantity patterns configuration is required but not available');
  }
  
  return quantityPatterns.quantity_patterns.map(patternConfig => {
    try {
      return {
        name: patternConfig.name,
        regex: new RegExp(patternConfig.pattern, patternConfig.flags),
        pattern: patternConfig.pattern,
        description: patternConfig.description
      };
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
  if (quantityPatterns && quantityPatterns.image_pattern) {
    try {
      imagePattern = new RegExp(quantityPatterns.image_pattern.pattern, quantityPatterns.image_pattern.flags);
    } catch (error) {
      console.warn('[renderer] Invalid image pattern, using default');
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
  
  for (const patternInfo of patterns) {
    const match = text.match(patternInfo.regex);
    if (match) {
      let quantity, name, unit;
      
      // Handle different pattern types based on the pattern structure
      if (patternInfo.pattern.includes('^(.+?)\\\\s*[×x]\\\\s*(\\\\d+')) {
        // Pattern: "Sweet corn x6 pkts" - item_x_quantity_unit
        name = match[1].trim();
        quantity = parseFloat(match[2]);
        unit = match[3] ? match[3].trim() : '';
      } else if (patternInfo.pattern.includes('^(.+?)\\\\s*(\\\\d+(?:[.,]\\\\d+)?)\\\\s*[×x]')) {
        // Pattern: "Sweet corn 6x pkts" - item_quantity_x_unit
        name = match[1].trim();
        quantity = parseFloat(match[2]);
        unit = match[3] ? match[3].trim() : '';
      } else if (patternInfo.pattern.includes('^(\\\\d+(?:[.,]\\\\d+)?)\\\\s*[×x]\\\\s*(.+)$')) {
        // Pattern: "6x Sweet corn pkts" - quantity_x_item
        quantity = parseFloat(match[1]);
        name = match[2].trim();
        unit = '';
      } else if (patternInfo.pattern.includes('^(\\\\d+(?:[.,]\\\\d+)?)\\\\s*(.+)$')) {
        // Pattern: "6 Sweet corn pkts" - quantity_item
        quantity = parseFloat(match[1]);
        name = match[2].trim();
        unit = '';
      } else if (patternInfo.pattern.includes('kg|g|pkt|pkts|box|boxes')) {
        // Pattern: "Butter nut 10kg" - item_quantity_unit
        name = match[1].trim();
        quantity = parseFloat(match[2]);
        unit = match[3] ? match[3].trim() : '';
      }
      
      if (!isNaN(quantity) && quantity > 0 && name) {
        return {
          quantity: quantity,
          name: name,
          unit: unit.toLowerCase().trim(),
          originalText: text,
          patternUsed: patternInfo.name
        };
      }
    }
  }
  
  // If no patterns match, try to extract any number
  const numberMatch = text.match(/(\d+(?:\.\d+)?)/);
  if (numberMatch) {
    return {
      quantity: parseFloat(numberMatch[1]),
      name: text.replace(numberMatch[0], '').trim(),
      unit: '',
      originalText: text,
      patternUsed: 'fallback_number'
    };
  }
  
  // Default to quantity 1 if no quantity found
  return {
    quantity: 1,
    name: text,
    unit: '',
    originalText: text,
    patternUsed: 'default'
  };
}

function formatItemText(quantity, name, unit, isImage = false) {
  if (!name) {
    throw new Error('Product name is required for formatting');
  }
  
  let formatted = '';
  
  if (isImage) {
    formatted = `[IMAGE] ${name}`;
  } else {
    if (quantity && quantity !== 1) {
      formatted = `${quantity}`;
      if (unit) {
        formatted += ` ${unit}`;
      }
      formatted += ` ${name}`;
    } else {
      formatted = name;
    }
  }
  
  return formatted;
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
  
  // Extract product name from full item text (remove quantities and units)
  // Examples: "5 Baby Corn" -> "Baby Corn", "750 g Wild Rocket" -> "Wild Rocket"
  let cleanName = productName.trim();
  
  // Remove leading quantities with optional units: "750 g Wild Rocket" -> "Wild Rocket"
  cleanName = cleanName.replace(/^\d+\s*(?:g|kg|ml|l|piece|pieces|pcs?|x)?\s+/i, '');
  
  // Remove just leading numbers: "5 Baby Corn" -> "Baby Corn"  
  cleanName = cleanName.replace(/^\d+\s+/i, '');
  
  // Remove trailing units
  cleanName = cleanName.replace(/\s+(?:g|kg|ml|l|piece|pieces|pcs?)$/i, '');
  
  const normalizedName = cleanName.toLowerCase().trim();
  
  console.log(`[renderer] Searching for product: "${productName}" -> cleaned: "${cleanName}"`);
  console.log(`[renderer] Available products:`, products.map(p => p.name));
  console.log(`[renderer] Normalized search term: "${normalizedName}"`);
  
  // First try exact match with original name (before cleaning)
  let product = products.find(p => p.name.toLowerCase() === productName.toLowerCase().trim());
  if (product) {
    console.log(`[renderer] Found exact match with original name: "${product.name}"`);
    return product;
  }
  
  
  // Then try direct name match with cleaned name
  product = products.find(p => p.name.toLowerCase() === normalizedName);
  if (product) {
    console.log(`[renderer] Found exact match: "${product.name}"`);
    return product;
  }
  
  // Check common names (alternative names)
  product = products.find(p => 
    p.common_names && 
    p.common_names.some(name => name.toLowerCase() === normalizedName)
  );
  if (product) {
    console.log(`[renderer] Found common name match: "${product.name}"`);
    return product;
  }
  
  // Partial match in name
  product = products.find(p => 
    p.name.toLowerCase().includes(normalizedName) || 
    normalizedName.includes(p.name.toLowerCase())
  );
  if (product) {
    console.log(`[renderer] Found partial match: "${product.name}"`);
    return product;
  }
  
  console.log(`[renderer] No product found for: "${cleanName}"`);
  return null;
}

function getInventoryStatus(product) {
  if (!product) {
    return {
      status: 'not_found',
      message: 'Product not found',
      availableQuantity: 0,
      reservedQuantity: 0
    };
  }
  
  // Check if product has inventory records
  if (!product.inventory_items || product.inventory_items.length === 0) {
    return {
      status: 'no_inventory',
      message: 'No inventory records found',
      availableQuantity: 0,
      reservedQuantity: 0
    };
  }
  
  // Calculate total available and reserved quantities
  let totalAvailable = 0;
  let totalReserved = 0;
  
  for (const item of product.inventory_items) {
    if (item.quantity_available) {
      totalAvailable += parseFloat(item.quantity_available);
    }
    if (item.quantity_reserved) {
      totalReserved += parseFloat(item.quantity_reserved);
    }
  }
  
  // Determine status based on availability
  if (totalAvailable <= 0) {
    return {
      status: 'out_of_stock',
      message: 'Out of stock',
      availableQuantity: 0,
      reservedQuantity: totalReserved
    };
  }
  
  return {
    status: 'in_stock',
    message: 'In stock',
    availableQuantity: totalAvailable,
    reservedQuantity: totalReserved
  };
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
  
  // Parse quantity information
  const quantityInfo = parseItemQuantity(normalized);
  
  // Extract product name (remove quantity part)
  let productName = normalized;
  if (quantityInfo.originalText) {
    productName = productName.replace(quantityInfo.originalText, '').trim();
  }
  
  // Standardize product name and unit
  productName = standardizeProductName(productName);
  const unit = standardizeUnit(quantityInfo.unit);
  
  if (!productName) {
    console.warn('[renderer] No product name found in line:', originalLine);
    return null;
  }
  
  // Find matching product
  const product = findProductByName(productName);
  
  return {
    name: productName,
    quantity: quantityInfo.quantity,
    unit: unit,
    originalText: originalLine,
    product: product,
    productId: product ? product.id : null,
    price: product ? product.price : 0,
    patternUsed: quantityInfo.patternUsed
  };
}

function normalizeItemLine(line) {
  if (!line) return '';
  
  // Remove extra whitespace and normalize
  return line.trim()
    .replace(/\s+/g, ' ')  // Multiple spaces to single space
    .replace(/[""'']/g, '"')  // Normalize quotes
    .replace(/×/g, 'x');  // Normalize multiplication symbol
}

function standardizeUnit(unit) {
  if (!unit) return '';
  
  const unitMappings = {
    'kg': 'kg',
    'kgs': 'kg',
    'kilogram': 'kg',
    'kilograms': 'kg',
    'g': 'g',
    'gram': 'g',
    'grams': 'g',
    'l': 'l',
    'liter': 'l',
    'liters': 'l',
    'litre': 'l',
    'litres': 'l',
    'ml': 'ml',
    'milliliter': 'ml',
    'milliliters': 'ml',
    'millilitre': 'ml',
    'millilitres': 'ml',
    'pc': 'piece',
    'pcs': 'piece',
    'piece': 'piece',
    'pieces': 'piece',
    'each': 'piece',
    'box': 'box',
    'boxes': 'box',
    'pack': 'pack',
    'packs': 'pack',
    'packet': 'pack',
    'packets': 'pack'
  };
  
  const normalized = unit.toLowerCase().trim();
  return unitMappings[normalized] || normalized;
}

function standardizeProductName(name) {
  if (!name) return '';
  
  // Basic name cleaning
  let cleaned = name.trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')  // Remove special characters
    .replace(/\s+/g, ' ')      // Multiple spaces to single
    .trim();
  
  // Common product name mappings
  const nameMappings = {
    'onion': 'onions',
    'potato': 'potatoes',
    'tomato': 'tomatoes',
    'carrot': 'carrots',
    'pepper': 'peppers',
    'cucumber': 'cucumbers',
    'lettuce': 'lettuce',
    'spinach': 'spinach',
    'cabbage': 'cabbage',
    'broccoli': 'broccoli',
    'cauliflower': 'cauliflower'
  };
  
  // Apply mappings
  for (const [key, value] of Object.entries(nameMappings)) {
    if (cleaned.includes(key)) {
      cleaned = cleaned.replace(key, value);
      break;
    }
  }
  
  // Capitalize first letter of each word
  return cleaned.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function isNonItemLine(line) {
  if (!line) return true;
  
  const lowerLine = line.toLowerCase().trim();
  
  // Skip empty lines
  if (!lowerLine) return true;
  
  // Skip greeting/closing lines
  const greetingPatterns = [
    'good morning',
    'good afternoon',
    'good evening',
    'hello',
    'hi there',
    'thank you',
    'thanks',
    'regards',
    'best regards',
    'kind regards'
  ];
  
  for (const pattern of greetingPatterns) {
    if (lowerLine.includes(pattern)) {
      return true;
    }
  }
  
  // Skip instruction lines
  const instructionPatterns = [
    'please',
    'kindly',
    'can you',
    'could you',
    'would you',
    'let me know',
    'confirm',
    'delivery',
    'order for',
    'as follows'
  ];
  
  for (const pattern of instructionPatterns) {
    if (lowerLine.includes(pattern)) {
      return true;
    }
  }
  
  // Skip lines that are too short to be meaningful items
  if (lowerLine.length < 3) {
    return true;
  }
  
  return false;
}

function formatOrderItem(item) {
  if (!item) return '';
  
  return formatItemText(item.quantity, item.name, item.unit, item.isImage);
}

// Setters for global data
function setProducts(productsData) {
  products = productsData;
}

// Getters for global data
function getProducts() {
  return products;
}

export {
  loadConfigurations,
  getQuantityPatterns,
  parseItemQuantity,
  formatItemText,
  findProductByName,
  getInventoryStatus,
  parseAndStandardizeItem,
  normalizeItemLine,
  standardizeUnit,
  standardizeProductName,
  isNonItemLine,
  formatOrderItem,
  setProducts,
  getProducts
};
