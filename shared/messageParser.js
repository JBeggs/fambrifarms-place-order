import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readAliases() {
  const filePath = path.join(__dirname, '..', 'company_aliases.json');
  try { 
    const raw = fs.readFileSync(filePath, 'utf-8'); 
    const parsed = JSON.parse(raw);
    if (!parsed) {
      console.error(`[messageParser] company_aliases.json is empty or null`);
      throw new Error('Empty aliases file');
    }
    return parsed;
  } catch (error) { 
    console.error(`[messageParser] CRITICAL: Failed to load company_aliases.json:`, error.message);
    throw error; // Fail fast instead of silent fallback
  }
}

function readQuantityPatterns() {
  const filePath = path.join(__dirname, '..', 'quantity_patterns.json');
  try { 
    const raw = fs.readFileSync(filePath, 'utf-8'); 
    const parsed = JSON.parse(raw);
    if (!parsed) {
      console.error(`[messageParser] quantity_patterns.json is empty or null`);
      throw new Error('Empty patterns file');
    }
    return parsed;
  } catch (error) { 
    console.error(`[messageParser] CRITICAL: Failed to load quantity_patterns.json:`, error.message);
    throw error; // Fail fast instead of silent fallback
  }
}

const COMPANY_ALIASES = readAliases();
const QUANTITY_PATTERNS = readQuantityPatterns();

function buildQuantityRegex() {
  const patterns = QUANTITY_PATTERNS;
  if (!patterns) {
    console.error(`[messageParser] CRITICAL: quantity_patterns.json is null or undefined`);
    throw new Error('Invalid quantity patterns configuration - patterns is null');
  }
  if (!patterns.weight_units) {
    console.error(`[messageParser] CRITICAL: quantity_patterns.json missing weight_units`);
    throw new Error('Invalid quantity patterns configuration - missing weight_units');
  }
  if (!patterns.count_units) {
    console.error(`[messageParser] CRITICAL: quantity_patterns.json missing count_units`);
    throw new Error('Invalid quantity patterns configuration - missing count_units');
  }
  
  // Build comprehensive pattern from loaded data
  const weightUnits = patterns.weight_units.join('|');
  const countUnits = patterns.count_units.join('|');
  const containerUnits = patterns.container_units.join('|');
  const groupUnits = patterns.group_units.join('|');
  const specificItems = patterns.specific_items.join('|');
  const multiplyChars = patterns.multiplication_patterns.join('');
  
  const allUnits = [weightUnits, countUnits, containerUnits, groupUnits, specificItems].join('|');
  
  // Add special patterns if they exist
  const specialPatterns = patterns.special_patterns ? patterns.special_patterns.join('|') : '';
  
  // Create comprehensive regex pattern
  let pattern = `(\\b\\d+(?:[.,]\\d+)?\\s*(?:${allUnits})s?\\b|\\b\\d+\\s*[${multiplyChars}]\\s*\\d+|\\b[${multiplyChars}]\\s*\\d+|\\d+\\s*[${multiplyChars}]\\b|\\w+[${multiplyChars}]\\d+|\\d+(?:kg|g)\\w+)`;
  
  if (specialPatterns) {
    pattern = `(${pattern}|${specialPatterns})`;
  }
  
  return new RegExp(pattern, 'i');
}

const QUANTITY_REGEX = buildQuantityRegex();

// Build skip patterns regex
function buildSkipPatternsRegex() {
  const patterns = QUANTITY_PATTERNS.skip_patterns;
  if (!patterns) {
    console.warn('[messageParser] No skip_patterns defined in quantity_patterns.json');
    return null;
  }
  if (patterns.length === 0) return null;
  const combined = patterns.join('|');
  return new RegExp(`(${combined})`, 'i');
}

const SKIP_PATTERNS_REGEX = buildSkipPatternsRegex();

// Additional filtering for individual message parts
function isLikelyOrderItem(text) {
  if (!text || text.trim().length === 0) return false;
  
  const trimmed = text.trim().toLowerCase();
  
  // Skip if it matches skip patterns
  if (SKIP_PATTERNS_REGEX && SKIP_PATTERNS_REGEX.test(trimmed)) {
    return false;
  }
  
  // Skip very short text (likely not product names)
  if (trimmed.length < 3) return false;
  
  // Skip if it's just numbers or punctuation
  if (/^[\d\s\-\+\(\)\.\,]+$/.test(trimmed)) return false;
  
  // Skip if it's just a single word that's likely a greeting or response
  const singleWordSkips = [
    'hi', 'hello', 'hey', 'thanks', 'thank', 'please', 'yes', 'no', 'ok', 'okay',
    'sure', 'great', 'good', 'perfect', 'excellent', 'awesome', 'wonderful',
    'received', 'confirmed', 'confirm', 'delivery', 'urgent', 'asap', 'rush',
    'morning', 'afternoon', 'evening', 'today', 'tomorrow', 'yesterday',
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
  ];
  
  const words = trimmed.split(/\s+/);
  if (words.length === 1 && singleWordSkips.includes(words[0])) {
    return false;
  }
  
  // Skip if it looks like a phone number
  if (/^[\+\d\s\-\(\)]+$/.test(trimmed) && trimmed.length > 5) {
    return false;
  }
  
  // Skip if it looks like an email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return false;
  }
  
  // Skip if it looks like a URL
  if (/^(https?:\/\/|www\.|ftp:\/\/)/.test(trimmed)) {
    return false;
  }
  
  // Skip if it's just punctuation or special characters
  if (/^[^\w\s]*$/.test(trimmed)) {
    return false;
  }
  
  // Skip if it's a common time format
  if (/^\d{1,2}:\d{2}(\s*(am|pm))?$/i.test(trimmed)) {
    return false;
  }
  
  // Skip if it's a date format
  if (/^\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?$/.test(trimmed)) {
    return false;
  }
  
  // Must have at least one letter (to avoid pure numbers)
  if (!/[a-zA-Z]/.test(trimmed)) {
    return false;
  }
  
  // If it has quantity patterns, it's likely an order item
  if (QUANTITY_REGEX.test(text)) {
    return true;
  }
  
  // If it contains known product words, it might be an order item
  const productWords = QUANTITY_PATTERNS.specific_items || [];
  const hasProductWord = productWords.some(product => 
    trimmed.includes(product.toLowerCase())
  );
  
  if (hasProductWord) {
    return true;
  }
  
  // If it's a reasonable length and has mixed content, it might be an order item
  if (trimmed.length >= 4 && trimmed.length <= 50 && /[a-zA-Z]/.test(trimmed)) {
    // But skip if it starts with common non-product phrases
    const nonProductStarts = [
      'can you', 'could you', 'would you', 'please let', 'let me know',
      'when will', 'what time', 'how much', 'how many', 'is it possible',
      'do you have', 'are you', 'i need', 'i want', 'i would like',
      'we need', 'we want', 'we would like', 'delivery to', 'address is',
      'phone number', 'contact number', 'total amount', 'grand total'
    ];
    
    const startsWithNonProduct = nonProductStarts.some(phrase => 
      trimmed.startsWith(phrase)
    );
    
    if (startsWithNonProduct) {
      return false;
    }
    
    return true;
  }
  
  return false;
}

// Build command patterns
function buildCommandPatterns() {
  const patterns = QUANTITY_PATTERNS.command_patterns;
  if (!patterns) {
    console.warn('[messageParser] No command_patterns defined in quantity_patterns.json');
    return {};
  }
  const compiled = {};
  for (const [key, pattern] of Object.entries(patterns)) {
    compiled[key] = new RegExp(pattern, 'i');
  }
  return compiled;
}

const COMMAND_PATTERNS = buildCommandPatterns();

// Apply quantity corrections to fix spacing issues
function applyQuantityCorrections(text) {
  if (!QUANTITY_PATTERNS.quantity_corrections) return text;
  
  let corrected = text;
  for (const correction of QUANTITY_PATTERNS.quantity_corrections) {
    const regex = new RegExp(correction.pattern, 'g');
    corrected = corrected.replace(regex, correction.replacement);
  }
  return corrected;
}

function normalizeSimple(str) {
  if (!str) {
    console.error(`[messageParser] normalizeSimple called with null/undefined value`);
    throw new Error('normalizeSimple requires a valid string');
  }
  const normalizationPattern = COMMAND_PATTERNS.normalization;
  if (!normalizationPattern) {
    console.error(`[messageParser] CRITICAL: normalization pattern not found in config`);
    throw new Error('Missing normalization pattern in configuration');
  }
  const regex = new RegExp(normalizationPattern, 'g');
  return String(str).toLowerCase().replace(regex, '');
}

function toCanonical(companyName) {
  if (!companyName) return null;
  
  let workingName = String(companyName).trim();
  
  // Apply auto-corrections first
  if (COMPANY_ALIASES.auto_corrections) {
    const lowerName = workingName.toLowerCase();
    for (const [typo, correction] of Object.entries(COMPANY_ALIASES.auto_corrections)) {
      if (lowerName === typo.toLowerCase()) {
        workingName = correction;
        break;
      }
    }
  }
  
  const normalized = normalizeSimple(workingName);
  
  // Check each company's aliases
  for (const [canonical, variants] of Object.entries(COMPANY_ALIASES)) {
    if (canonical === 'auto_corrections') continue; // Skip the corrections object
    
    // Check exact match with canonical name
    if (normalizeSimple(canonical) === normalized) return canonical;
    
    if (Array.isArray(variants)) {
      for (const variant of variants) {
        if (typeof variant === 'string') {
          // Check if it's a regex pattern (starts with / and ends with /flags)
          if (variant.startsWith('/') && variant.includes('/')) {
            try {
              const lastSlash = variant.lastIndexOf('/');
              const pattern = variant.slice(1, lastSlash);
              const flags = variant.slice(lastSlash + 1);
              if (!flags) {
                throw new Error(`Invalid regex pattern: ${variant} - missing flags after last slash`);
              }
              const regex = new RegExp(pattern, flags);
              if (regex.test(workingName)) return canonical;
            } catch (e) {
              console.warn(`Invalid regex pattern: ${variant}`);
            }
          } else {
            // Regular string match
            if (normalizeSimple(variant) === normalized) return canonical;
          }
        }
      }
    }
  }
  
  return null;
}

function matchCompanyInText(text) {
  if (!text) {
    throw new Error('Text is required for word extraction');
  }
  const words = String(text).split(/\s+/);
  for (const word of words) {
    const canonical = toCanonical(word);
    if (canonical) return canonical;
  }
  return null;
}

export function processLines(lines) {
  const whatsappPattern = COMMAND_PATTERNS.whatsapp_message;
  if (!whatsappPattern) {
    console.error(`[messageParser] CRITICAL: whatsapp_message pattern not found in config`);
    throw new Error('Missing WhatsApp message pattern in configuration');
  }
  const re = new RegExp(whatsappPattern, 's');
  const orders = [];

  // Process each message and create explicit pairs
  const messages = [];
  for (const line of lines) {
    if (!line) {
      console.error(`[messageParser] Received null/undefined line in input`);
      continue; // Skip null lines but log them
    }
    const lineStr = String(line).trim();
    if (!lineStr) continue;

    const m = lineStr.match(re);
    if (!m) continue;

    const { ts, text } = m.groups;
    const tsStr = ts ? ts : '';
    if (!text) {
      console.error(`[messageParser] Message has no text content:`, lineStr);
      continue;
    }
    const textStr = String(text).trim();
    if (!textStr) continue;

    // Skip stock reports and order markers using configurable patterns
    if (SKIP_PATTERNS_REGEX && SKIP_PATTERNS_REGEX.test(textStr)) {
      continue;
    }

    messages.push({ timestamp: ts ? ts : '', text: textStr });
  }

  // FIRST PASS: Handle items-before-company-name patterns ONLY
  // This must be done first to prevent other patterns from interfering
  const processedIndices = new Set();
  
  for (let i = 0; i < messages.length - 1; i++) {
    if (processedIndices.has(i)) continue;
    
    const currentMsg = messages[i];
    const nextMsg = messages[i + 1];
    
    const currentParts = currentMsg.text.split(/\n+/).map(p => applyQuantityCorrections(p.trim())).filter(p => p);
    const nextParts = nextMsg.text.split(/\n+/).map(p => p.trim()).filter(p => p);
    
    // Check if next message is exactly a company name
    if (nextParts.length === 1) {
      const companyName = toCanonical(nextParts[0]);
      if (companyName) {
        // Check if current message has items
        const hasItems = currentParts.some(part => QUANTITY_REGEX.test(part));
        if (hasItems) {
          // Create order: current message items → next message company
          const order = {
            company_name: companyName,
            items_text: [],
            instructions: [],
            timestamp: currentMsg.timestamp,
            removed: {},
            verified: false
          };
          
          for (const part of currentParts) {
            const hasQuantity = QUANTITY_REGEX.test(part);
            if (hasQuantity && isLikelyOrderItem(part)) {
              order.items_text.push(part);
            } else if (isLikelyOrderItem(part)) {
              // Even without quantity, if it looks like an order item, include it
              order.items_text.push(part);
            } else {
              // Skip company names, sender names, and phone numbers in instructions
              const partCompany = toCanonical(part);
              const isSenderName = part === currentMsg.sender;
              const isPhoneNumber = /^[\+\d\s\-\(\)]+$/.test(part.trim()) && part.trim().length > 5;
              if (!partCompany && !isSenderName && !isPhoneNumber && isLikelyOrderItem(part)) {
                order.instructions.push(part);
              }
            }
          }
          
          if (order.items_text.length > 0) {
            orders.push(order);
            processedIndices.add(i);     // Mark current message as processed
            processedIndices.add(i + 1); // Mark company message as processed
          }
        }
      }
    }
  }
  
  // SECOND PASS: Handle remaining patterns for unprocessed messages
  for (let i = 0; i < messages.length; i++) {
    if (processedIndices.has(i)) continue; // Skip already processed messages
    
    const msg = messages[i];
    const parts = msg.text.split(/\n+/).map(p => applyQuantityCorrections(p.trim())).filter(p => p);

    // PATTERN 1B: Company-only message followed by items
    // Handle: "Venue" → "Good morning...items..."
    if (i > 0 && !processedIndices.has(i - 1)) {
      const prevMsg = messages[i - 1];
      const prevParts = prevMsg.text.split(/\n+/).map(p => p.trim()).filter(p => p);
      
      if (prevParts.length === 1) {
        const companyName = toCanonical(prevParts[0]);
        if (companyName && !matchCompanyInText(msg.text)) {
          const hasItems = parts.some(part => QUANTITY_REGEX.test(part));
          if (hasItems) {
            const order = {
              company_name: companyName,
              items_text: [],
              instructions: [],
              timestamp: prevMsg.timestamp,
              removed: {},
              verified: false
            };
            
            for (const part of parts) {
              const hasQuantity = QUANTITY_REGEX.test(part);
              if (hasQuantity && isLikelyOrderItem(part)) {
                order.items_text.push(part);
              } else if (isLikelyOrderItem(part)) {
                // Even without quantity, if it looks like an order item, include it
                order.items_text.push(part);
              } else {
                // Skip company names, sender names, and phone numbers in instructions
                const partCompany = toCanonical(part);
                const isSenderName = part === prevMsg.sender;
                const isPhoneNumber = /^[\+\d\s\-\(\)]+$/.test(part.trim()) && part.trim().length > 5;
                if (!partCompany && !isSenderName && !isPhoneNumber && isLikelyOrderItem(part)) {
                  order.instructions.push(part);
                }
              }
            }
            
            orders.push(order);
            processedIndices.add(i - 1); // Mark previous message as processed
            processedIndices.add(i);     // Mark current message as processed
            continue;
          }
        }
      }
    }

    // EXPLICIT PATTERN 1C: "Please add [item] to [Company]" pattern
    // Handle both single-line and multi-line formats
    const addToMatch = COMMAND_PATTERNS.add_to_order ? msg.text.match(COMMAND_PATTERNS.add_to_order) : null;
    if (addToMatch) {
      const item = addToMatch[1].trim();
      const companyName = toCanonical(addToMatch[2].trim());
      if (companyName) {
        // Find the most recent order for this company and add the item
        for (let j = orders.length - 1; j >= 0; j--) {
          if (orders[j].company_name === companyName) {
            if (!orders[j].items_text.includes(item) && isLikelyOrderItem(item)) {
              orders[j].items_text.push(item);
            }
            break;
          }
        }
        continue;
      }
    }
    
    // EXPLICIT PATTERN 1D: Multi-line "Please add to [Company]" pattern
    // Handle: "Please add on\n5kg spinach\n1kg lime\nPlease add to Casa Bella"
    const multiLineAddMatch = msg.text.match(/please\s+add\s+to\s+(.+?)(?:\s+boxes?)?$/i);
    if (multiLineAddMatch) {
      const companyName = toCanonical(multiLineAddMatch[1].trim());
      if (companyName) {
        // Extract items from the message (everything except the "please add to" line)
        const lines = msg.text.split(/\n+/).map(p => p.trim()).filter(p => p);
        const itemLines = lines.filter(line => 
          !line.toLowerCase().includes('please add to') && 
          !toCanonical(line) && // Not a company name
          QUANTITY_REGEX.test(line) // Has quantity pattern
        );
        
        if (itemLines.length > 0) {
          // Create new order or find existing one
          let targetOrder = null;
          for (let j = orders.length - 1; j >= 0; j--) {
            if (orders[j].company_name === companyName) {
              targetOrder = orders[j];
              break;
            }
          }
          
          if (!targetOrder) {
            targetOrder = {
              company_name: companyName,
              items_text: [],
              instructions: [],
              timestamp: msg.timestamp,
              removed: {},
              verified: false
            };
            orders.push(targetOrder);
          }
          
          // Add items to the order
          for (const itemLine of itemLines) {
            if (!targetOrder.items_text.includes(itemLine) && isLikelyOrderItem(itemLine)) {
              targetOrder.items_text.push(itemLine);
            }
          }
          continue;
        }
      }
    }

    // EXPLICIT PATTERN 2: Company name in same message as items (but NOT company-only messages)
    // Skip if next message is a company-only message (let Pattern 1 handle it)
    let nextIsCompanyOnly = false;
    if (i + 1 < messages.length) {
      const nextMsg = messages[i + 1];
      const nextParts = nextMsg.text.split(/\n+/).map(p => p.trim()).filter(p => p);
      if (nextParts.length === 1 && toCanonical(nextParts[0])) {
        nextIsCompanyOnly = true;
      }
    }
    
    const companyInMessage = toCanonical(matchCompanyInText(msg.text));
    if (companyInMessage && parts.length > 1 && !nextIsCompanyOnly) { // Only if there are other parts besides company name and next message is not company-only
      const order = {
        company_name: companyInMessage,
        items_text: [],
        instructions: [],
        timestamp: msg.timestamp,
        removed: {},
        verified: false
      };
      
      for (const part of parts) {
        if (toCanonical(part) === companyInMessage) continue; // Skip company name itself
        
        const hasQuantity = QUANTITY_REGEX.test(part);
        if (hasQuantity && isLikelyOrderItem(part)) {
          order.items_text.push(part);
        } else if (isLikelyOrderItem(part)) {
          // Even without quantity, if it looks like an order item, include it
          order.items_text.push(part);
        } else {
          // Skip company names, sender names, and phone numbers in instructions
          const partCompany = toCanonical(part);
          const isSenderName = part === msg.sender;
          const isPhoneNumber = /^[\+\d\s\-\(\)]+$/.test(part.trim()) && part.trim().length > 5;
          if (!partCompany && !isSenderName && !isPhoneNumber && isLikelyOrderItem(part)) {
            order.instructions.push(part);
          }
        }
      }
      
      orders.push(order);
      continue;
    }

    // EXPLICIT PATTERN 3: Handle image placeholders
    const imageMatch = COMMAND_PATTERNS.image_placeholder ? msg.text.match(COMMAND_PATTERNS.image_placeholder) : null;
    if (imageMatch) {
      const imagePath = imageMatch[1];
      if (orders.length > 0) {
        const lastOrder = orders[orders.length - 1];
        const imageItem = `[IMAGE: ${imagePath}]`;
        if (!lastOrder.items_text.includes(imageItem)) {
          lastOrder.items_text.push(imageItem);
        }
      }
      continue;
    }
  }

  // Consolidate multiple orders for the same company
  const consolidatedOrders = [];
  const companyMap = new Map();
  
  for (const order of orders) {
    const key = order.company_name;
    if (companyMap.has(key)) {
      const existing = companyMap.get(key);
      // Merge items and instructions
      existing.items_text.push(...order.items_text);
      existing.instructions.push(...order.instructions);
      // Keep the earliest timestamp
      if (order.timestamp < existing.timestamp) {
        existing.timestamp = order.timestamp;
      }
    } else {
      companyMap.set(key, {
        company_name: order.company_name,
        items_text: [...order.items_text],
        instructions: [...order.instructions],
        timestamp: order.timestamp,
        removed: {},
        verified: false
      });
    }
  }
  
  // Convert map back to array
  for (const order of companyMap.values()) {
    consolidatedOrders.push(order);
  }
  
  return { orders: consolidatedOrders };
}

// Export utility functions for renderer compatibility
export { COMPANY_ALIASES, QUANTITY_REGEX, toCanonical, matchCompanyInText, normalizeSimple };