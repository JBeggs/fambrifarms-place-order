const ordersEl = document.getElementById('orders');
const companyEl = document.getElementById('company');
const phoneEl = document.getElementById('phone');
const itemsListEl = document.getElementById('itemsList');
const addItemEl = document.getElementById('addItem');
const addBtn = document.getElementById('addBtn');
const verifiedEl = document.getElementById('verified');
const hintEl = document.getElementById('hint');
const panelOrders = document.getElementById('panelOrders');
const panelDebug = document.getElementById('panelDebug');
const tabOrders = document.getElementById('tabOrders');
const tabDebug = document.getElementById('tabDebug');
const debugPreEl = document.getElementById('debugPre');
const debugPostEl = document.getElementById('debugPost');

const btnSubmit = document.getElementById('submit');
const btnSubmitAll = document.getElementById('submitAll');
const btnRemove = document.getElementById('remove');
const btnClose = document.getElementById('close');

function getBackendUrl() {
  if (!window.api || typeof window.api.getBackendUrl !== 'function') {
    console.error('[renderer] window.api.getBackendUrl not available');
    return '';
  }
  try {
    return window.api.getBackendUrl();
  } catch (error) {
    console.error('[renderer] Failed to get backend URL:', error);
    return '';
  }
}

function getCompanyAliases() {
  if (!window.api || typeof window.api.getCompanyAliases !== 'function') {
    console.error('[renderer] window.api.getCompanyAliases not available');
    return {};
  }
  try {
    return window.api.getCompanyAliases();
  } catch (error) {
    console.error('[renderer] Failed to get company aliases:', error);
    return {};
  }
}

function getForwarderNames() {
  if (!window.api || typeof window.api.getForwarderNames !== 'function') {
    console.error('[renderer] window.api.getForwarderNames not available');
    return [];
  }
  try {
    const names = window.api.getForwarderNames();
    if (!Array.isArray(names)) {
      console.error('[renderer] getForwarderNames returned non-array:', names);
      return [];
    }
    return names.map(s => {
      if (typeof s !== 'string') {
        console.warn('[renderer] Non-string forwarder name:', s);
        return String(s).trim().toLowerCase();
      }
      return s.trim().toLowerCase();
    });
  } catch (error) {
    console.error('[renderer] Failed to get forwarder names:', error);
    return [];
  }
}

const BACKEND_API_URL = getBackendUrl();
const ENDPOINT = BACKEND_API_URL ? `${BACKEND_API_URL.replace(/\/$/, '')}/orders/from-whatsapp/` : '';

let orders = [];
let current = 0;
const COMPANY_ALIASES = getCompanyAliases();
const FORWARDER_NAMES = getForwarderNames();

// Load configuration
let PATTERNS_CONFIG = null;
let VALIDATION_CONFIG = null;

async function loadConfigurations() {
  try {
    const patternsResponse = await fetch('./config/patterns.json');
    PATTERNS_CONFIG = await patternsResponse.json();
  } catch (error) {
    console.error('[renderer] Failed to load patterns config:', error);
    PATTERNS_CONFIG = getDefaultPatternsConfig();
  }
  
  try {
    const validationResponse = await fetch('./config/validation.json');
    VALIDATION_CONFIG = await validationResponse.json();
  } catch (error) {
    console.error('[renderer] Failed to load validation config:', error);
    VALIDATION_CONFIG = getDefaultValidationConfig();
  }
}

function getDefaultPatternsConfig() {
  return {
    quantity_patterns: [
      { pattern: "^(.+?)\\s*[×x]\\s*(\\d+(?:[.,]\\d+)?)\\s*(.*)$", flags: "i" },
      { pattern: "^(.+?)\\s*(\\d+(?:[.,]\\d+)?)\\s*[×x]\\s*(.*)$", flags: "i" },
      { pattern: "^(\\d+(?:[.,]\\d+)?)\\s*[×x]\\s*(.+)$", flags: "i" },
      { pattern: "^(\\d+(?:[.,]\\d+)?)\\s*(.+)$", flags: "i" },
      { pattern: "^(.+?)\\s*(\\d+(?:[.,]\\d+)?)\\s*(kg|g|pkt|pkts|box|boxes|bag|bags|bunch|bunches|head|heads)s?\\b(.*)$", flags: "i" }
    ]
  };
}

function getDefaultValidationConfig() {
  return {
    content_starters: ["good morning", "good day", "morning", "veg order", "here's my order"],
    non_order_meta_phrases: ["stock as at", "orders start here"],
    weight_units: ["kg", "g", "grams", "gram"],
    package_units: ["pkt", "pkts", "packet", "packets", "box", "boxes", "bag", "bags", "bunch", "bunches", "head", "heads"],
    label_stopwords: ["good","morning","day","orders","order","please","add","thanks","thank","hi","hello","tnx","veg","stock","start","here","venue"]
  };
}

const LABEL_STOPWORDS = new Set();

function normalizeSimple(s) { 
  if (typeof s !== 'string') {
    if (s === null || s === undefined) {
      return '';
    }
    s = String(s);
  }
  return s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9 &'\-]/g, ''); 
}

function getQuantityPatterns() {
  if (!PATTERNS_CONFIG || !PATTERNS_CONFIG.quantity_patterns) {
    console.warn('[renderer] Patterns config not loaded, using defaults');
    return getDefaultPatternsConfig().quantity_patterns.map(p => new RegExp(p.pattern, p.flags));
  }
  
  return PATTERNS_CONFIG.quantity_patterns.map(patternConfig => {
    try {
      return new RegExp(patternConfig.pattern, patternConfig.flags);
    } catch (error) {
      console.error('[renderer] Invalid regex pattern:', patternConfig, error);
      return null;
    }
  }).filter(pattern => pattern !== null);
}

function parseItemQuantity(itemText) {
  if (typeof itemText !== 'string') {
    if (itemText === null || itemText === undefined) {
      console.warn('[renderer] parseItemQuantity received null/undefined input');
      return {
        quantity: 1,
        name: '',
        unit: '',
        originalText: ''
      };
    }
    itemText = String(itemText);
  }
  
  const text = itemText.trim();
  
  // Check if this is an image item
  let imagePattern = /^\[IMAGE:\s*(.+?)\]$/;
  if (PATTERNS_CONFIG && PATTERNS_CONFIG.image_pattern) {
    try {
      imagePattern = new RegExp(PATTERNS_CONFIG.image_pattern.pattern, PATTERNS_CONFIG.image_pattern.flags);
    } catch (error) {
      console.warn('[renderer] Invalid image pattern in config, using default:', error);
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
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let quantity, name, unit;
      
      if (pattern.source.startsWith('^(.+?)\\s*[×x]\\s*(\\d+')) {
        // Pattern: "Sweet corn x6 pkts"
        name = match[1].trim();
        quantity = parseFloat(match[2]);
        unit = match[3].trim();
      } else if (pattern.source.startsWith('^(.+?)\\s*(\\d+')) {
        // Pattern: "Sweet corn 6x pkts"
        name = match[1].trim();
        quantity = parseFloat(match[2]);
        unit = match[3].trim();
      } else if (pattern.source.startsWith('^(\\d+')) {
        if (match[3]) {
          // Pattern: "6x Sweet corn pkts"
          quantity = parseFloat(match[1]);
          name = match[2].trim();
          unit = '';
        } else {
          // Pattern: "6 Sweet corn pkts"
          quantity = parseFloat(match[1]);
          const rest = match[2].trim();
          // Try to extract unit from the end
          const unitMatch = rest.match(/^(.+?)\s+(kg|g|pkt|pkts|box|boxes|bag|bags|bunch|bunches|head|heads)s?$/i);
          if (unitMatch) {
            name = unitMatch[1].trim();
            unit = unitMatch[2];
          } else {
            name = rest;
            unit = '';
          }
        }
      } else {
        // Pattern: "Butter nut 10kg"
        name = match[1].trim();
        quantity = parseFloat(match[2]);
        unit = match[3];
        if (match[4]) unit += match[4];
      }
      
      return {
        quantity: quantity ? quantity : 1,
        name: name ? name : text,
        unit: unit ? unit : '',
        originalText: text
      };
    }
  }
  
  // If no pattern matches, return as-is with quantity 1
  return {
    quantity: 1,
    name: text,
    unit: '',
    originalText: text
  };
}

function formatItemText(quantity, name, unit, isImage = false) {
  if (!name) return '';
  
  // Handle image items - don't format, return as-is
  if (isImage || unit === 'file') {
    return name.startsWith('[IMAGE:') ? name : `[IMAGE: ${name}]`;
  }
  
  // Format based on the unit type
  if (unit) {
    let weightUnits = ['kg', 'g', 'grams', 'gram'];
    let packageUnits = ['pkt', 'pkts', 'packet', 'packets', 'box', 'boxes', 'bag', 'bags', 'bunch', 'bunches', 'head', 'heads'];
    
    if (VALIDATION_CONFIG) {
      weightUnits = VALIDATION_CONFIG.weight_units || weightUnits;
      packageUnits = VALIDATION_CONFIG.package_units || packageUnits;
    }
    
    const unitLower = unit.toLowerCase();
    if (weightUnits.includes(unitLower)) {
      return `${name} ${quantity}${unit}`;
    } else if (packageUnits.includes(unitLower)) {
      return `${name} x${quantity}${unit}`;
    } else {
      return `${name} x${quantity}${unit}`;
    }
  } else {
    return `${name} x${quantity}`;
  }
}

function buildCompanyMatchers() {
  const matchers = [];
  
  if (!COMPANY_ALIASES || typeof COMPANY_ALIASES !== 'object') {
    console.warn('[renderer] COMPANY_ALIASES not available or invalid');
    return matchers;
  }
  
  for (const canonical of Object.keys(COMPANY_ALIASES)) {
    const aliasValue = COMPANY_ALIASES[canonical];
    let variantList;
    
    if (Array.isArray(aliasValue)) {
      variantList = aliasValue;
    } else if (aliasValue !== null && aliasValue !== undefined) {
      variantList = [aliasValue];
    } else {
      variantList = [];
    }
    
    const variants = new Set([canonical, ...variantList].filter(v => v !== null && v !== undefined && v !== ''));
    const variantStrings = [];
    const variantRegexes = [];
    
    variants.forEach(v => {
      const str = String(v);
      if (str.startsWith('/') && str.endsWith('/i')) {
        try { 
          variantRegexes.push(new RegExp(str.slice(1, -2), 'i')); 
        } catch (error) {
          console.warn('[renderer] Invalid regex pattern:', str, error);
        }
      } else {
        variantStrings.push(str);
      }
    });
    
    matchers.push({ 
      canonical, 
      variantStrings, 
      variantRegexes, 
      normalizedSet: new Set(variantStrings.map(v => normalizeSimple(v))) 
    });
  }
  return matchers;
}
const COMPANY_MATCHERS = buildCompanyMatchers();

function matchCompanyInText(text) {
  if (typeof text !== 'string') {
    if (text === null || text === undefined) {
      return null;
    }
    text = String(text);
  }
  
  for (const m of COMPANY_MATCHERS) {
    for (const rx of m.variantRegexes) { 
      if (rx.test(text)) return m.canonical; 
    }
    for (const s of m.variantStrings) { 
      if (text.toLowerCase().includes(String(s).toLowerCase())) return m.canonical; 
    }
  }
  return null;
}

function isLabelOnlyText(text, canonical) {
  const norm = normalizeSimple(text);
  for (const m of COMPANY_MATCHERS) {
    if (m.canonical !== canonical) continue;
    if (m.normalizedSet.has(norm)) return true;
    // also allow exact canonical normalized
    if (normalizeSimple(m.canonical) === norm) return true;
  }
  return false;
}

function isContentStarter(text) {
  if (typeof text !== 'string') {
    if (text === null || text === undefined) {
      return false;
    }
    text = String(text);
  }
  
  const t = text.trim().toLowerCase();
  let starterPhrases = ['good morning', 'good day', 'morning', 'veg order', "here's my order"];
  
  if (VALIDATION_CONFIG && VALIDATION_CONFIG.content_starters) {
    starterPhrases = VALIDATION_CONFIG.content_starters;
  }
  
  return starterPhrases.some(phrase => t.includes(phrase));
}

function isNonOrderMeta(text) {
  if (typeof text !== 'string') {
    if (text === null || text === undefined) {
      return false;
    }
    text = String(text);
  }
  
  const t = text.toLowerCase();
  let metaPhrases = ['stock as at', 'orders start here'];
  
  if (VALIDATION_CONFIG && VALIDATION_CONFIG.non_order_meta_phrases) {
    metaPhrases = VALIDATION_CONFIG.non_order_meta_phrases;
  }
  
  return metaPhrases.some(phrase => t.includes(phrase));
}

// Shared label parser (used by batch and streaming)
function parseCompanyLabelText(txt) {
  if (typeof txt !== 'string') {
    if (txt === null || txt === undefined) {
      return null;
    }
    txt = String(txt);
  }
  
  const t = txt.trim();
  if (!t) return null;
  
  // Check for "add to" pattern
  let addToPattern = /^(?:please\s+)?add(?:\s+on)?\s+to\s+(.+)$/i;
  if (PATTERNS_CONFIG && PATTERNS_CONFIG.add_to_pattern) {
    try {
      addToPattern = new RegExp(PATTERNS_CONFIG.add_to_pattern.pattern, PATTERNS_CONFIG.add_to_pattern.flags);
    } catch (error) {
      console.warn('[renderer] Invalid add_to_pattern in config, using default:', error);
    }
  }
  
  const m = t.match(addToPattern);
  if (m && m[1]) return normalizeCompanyName(m[1]);
  
  // Check if it looks like a company name (letters, spaces, common punctuation, reasonable length)
  let companyNamePattern = /^[A-Za-z][A-Za-z .&'\-]{0,35}$/;
  if (PATTERNS_CONFIG && PATTERNS_CONFIG.company_name_pattern) {
    try {
      companyNamePattern = new RegExp(PATTERNS_CONFIG.company_name_pattern.pattern, PATTERNS_CONFIG.company_name_pattern.flags);
    } catch (error) {
      console.warn('[renderer] Invalid company_name_pattern in config, using default:', error);
    }
  }
  
  if (companyNamePattern.test(t)) {
    const words = t.trim().split(/\s+/);
    let maxWords = 6;
    if (VALIDATION_CONFIG && VALIDATION_CONFIG.max_company_name_words) {
      maxWords = VALIDATION_CONFIG.max_company_name_words;
    }
    if (words.length <= maxWords) return normalizeCompanyName(t);
  }
  return null;
}

// Incremental parser state
const state = {
  currentLabel: null,
  lastLabelTsMs: 0,
  pending: [],
  ordersByCompany: new Map()
};

function normalizeCompanyName(name) {
  if (typeof name !== 'string') {
    if (name === null || name === undefined) {
      return '';
    }
    name = String(name);
  }
  
  const raw = name.trim();
  const lower = raw.toLowerCase();
  
  for (const key of Object.keys(COMPANY_ALIASES)) {
    const target = COMPANY_ALIASES[key];
    if (!target) continue;
    
    const variants = Array.isArray(target) ? target : [target];
    for (const v of variants) {
      if (v === null || v === undefined) continue;
      
      const patt = String(v).trim();
      if (!patt) continue;
      
      // exact, contains, or regex (/.../i)
      if (patt.startsWith('/') && patt.endsWith('/i')) {
        try { 
          const re = new RegExp(patt.slice(1, -2), 'i'); 
          if (re.test(raw)) { 
            console.log('[match] alias regex', { raw, key }); 
            return key; 
          } 
        } catch (error) {
          console.warn('[renderer] Invalid regex in company alias:', patt, error);
        }
      } else {
        const p = patt.toLowerCase();
        if (lower === p || lower.includes(p) || p.includes(lower)) { 
          console.log('[match] alias string', { raw, key }); 
          return key; 
        }
      }
    }
  }
  return raw;
}

function lineToOrders(lines) {
  let re = /^\[(?<ts>[^\]]+)\]\s*(?<company>[^→·]*?)\s*(?:·\s*(?<phone>[^→]+))?\s*→\s*(?<text>.*)$/;
  if (PATTERNS_CONFIG && PATTERNS_CONFIG.message_line_pattern) {
    try {
      re = new RegExp(PATTERNS_CONFIG.message_line_pattern.pattern, PATTERNS_CONFIG.message_line_pattern.flags);
    } catch (error) {
      console.warn('[renderer] Invalid message_line_pattern in config, using default:', error);
    }
  }
  
  const result = [];
  let cur = null;
  const forwarderMode = Array.isArray(FORWARDER_NAMES) && FORWARDER_NAMES.length > 0;
  // Forwarder-mode state: buffer lines until a trailing label, then assign to that company
  let pending = [];
  let currentLabel = null;
  let lastLabelTsMs = 0;
  const ordersByCompany = new Map();

  if (!Array.isArray(lines)) {
    console.warn('[renderer] lineToOrders received non-array lines:', lines);
    return result;
  }
  
  for (const raw of lines) {
    if (typeof raw !== 'string') {
      if (raw === null || raw === undefined) {
        continue;
      }
    }
    
    const line = String(raw).trim();
    if (!line) continue;
    const m = line.match(re);
    if (!m) { continue; }
    const { ts, company, phone, text } = m.groups;
    
    const normalizedCompany = normalizeCompanyName(company ? company : 'Unknown');
    const tsStr = ts ? ts : '';
    let tsMs = 0;
    if (tsStr) {
      tsMs = Date.parse(tsStr.replace(/\//g, '-'));
      if (isNaN(tsMs)) {
        tsMs = 0;
      }
    }
    
    let timeGapMinutes = 15;
    if (VALIDATION_CONFIG && VALIDATION_CONFIG.time_gap_minutes) {
      timeGapMinutes = VALIDATION_CONFIG.time_gap_minutes;
    }
    const timeGapMs = timeGapMinutes * 60 * 1000; // new block if gap is large or company changes
    const companyForCheck = company ? company : '';
    const isForwarder = forwarderMode && FORWARDER_NAMES.includes(companyForCheck.trim().toLowerCase());

    if (forwarderMode) {
      if (!isForwarder) continue; // only accept forwarder messages
      
      const textForSplit = text ? text : '';
      const parts = String(textForSplit).split(/\n+/);
      for (const partRaw of parts) {
        if (typeof partRaw !== 'string') {
          if (partRaw === null || partRaw === undefined) {
            continue;
          }
        }
        
        const part = String(partRaw).trim();
        if (!part) continue;
        if (isNonOrderMeta(part)) continue;
        const labelByPhrase = parseCompanyLabelText(part);
        const matchByAliases = matchCompanyInText(part);
        const companyMatch = labelByPhrase ? labelByPhrase : matchByAliases;
        if (companyMatch && isLabelOnlyText(part, companyMatch)) {
          // label only → end marker: flush pending to this company and clear current
          let order = ordersByCompany.get(companyMatch);
          if (!order) {
            order = { timestamp: tsStr, company_name: companyMatch, sender_phone: '', items_text: [], removed: new Set(), verified: false, _lastTsMs: tsMs };
            ordersByCompany.set(companyMatch, order);
            result.push(order);
          }
          if (pending.length) {
            try { console.log('[group:end] flushing pending to', companyMatch, pending); } catch {}
            order.items_text.push(...pending);
            pending = [];
          }
          currentLabel = null;
          lastLabelTsMs = 0;
          continue;
        }
        if (companyMatch && /\badd\b/i.test(part)) {
          // add with company → append to that company's order
          let order = ordersByCompany.get(companyMatch);
          if (!order) {
            order = { timestamp: tsStr, company_name: companyMatch, sender_phone: '', items_text: [], removed: new Set(), verified: false, _lastTsMs: tsMs };
            ordersByCompany.set(companyMatch, order);
            result.push(order);
          }
          order.items_text.push(part);
          continue;
        }
        if (companyMatch) {
          // company mentioned in content → start/switch current order
          currentLabel = companyMatch;
          lastLabelTsMs = tsMs;
          let order = ordersByCompany.get(companyMatch);
          if (!order) {
            order = { timestamp: tsStr, company_name: companyMatch, sender_phone: '', items_text: [], removed: new Set(), verified: false, _lastTsMs: tsMs };
            ordersByCompany.set(companyMatch, order);
            result.push(order);
          }
          // push content (could include quantities); if it's a pure starter line without items, we still append as context
          if (part) order.items_text.push(part);
          continue;
        }
        // no company in this line
        let forwarderTimeoutMinutes = 5;
        if (VALIDATION_CONFIG && VALIDATION_CONFIG.forwarder_timeout_minutes) {
          forwarderTimeoutMinutes = VALIDATION_CONFIG.forwarder_timeout_minutes;
        }
        const tooOldForCurrent = currentLabel && lastLabelTsMs && tsMs && (tsMs - lastLabelTsMs > forwarderTimeoutMinutes * 60 * 1000);
        if (currentLabel && !tooOldForCurrent) {
          let currentOrder = ordersByCompany.get(currentLabel);
          if (!currentOrder) {
            currentOrder = { timestamp: tsStr, company_name: currentLabel, sender_phone: '', items_text: [], removed: new Set(), verified: false, _lastTsMs: tsMs };
            ordersByCompany.set(currentLabel, currentOrder);
            result.push(currentOrder);
          }
          currentOrder.items_text.push(part);
        } else {
          pending.push(part);
        }
      }
      continue;
    }

    // default grouping (non-forwarder mode)
    const shouldStartNew = !cur || (normalizedCompany && normalizedCompany !== cur.company_name) || (cur._lastTsMs && tsMs && (tsMs - cur._lastTsMs > timeGapMs));
    if (shouldStartNew) {
      if (cur && cur.items_text.length) result.push(cur);
      const phoneValue = phone ? phone : '';
      cur = { timestamp: tsStr, company_name: normalizedCompany, sender_phone: phoneValue.trim(), items_text: [], removed: new Set(), verified: false, _lastTsMs: tsMs };
    } else {
      const currentTsMs = cur._lastTsMs ? cur._lastTsMs : 0;
      const newTsMs = tsMs ? tsMs : 0;
      cur._lastTsMs = Math.max(currentTsMs, newTsMs);
    }
    if (text) cur.items_text.push(text.trim());
  }
  if (cur && cur.items_text.length) result.push(cur);
  return result;
}

function normalizePayload(payload) {
  if (!payload) return [];
  
  if (Array.isArray(payload.orders) && payload.orders.length) {
    return payload.orders.map(o => {
      const companyName = o.company_name ? o.company_name : (o.sender_name ? o.sender_name : '');
      return { 
        ...o, 
        company_name: normalizeCompanyName(companyName), 
        removed: new Set(), 
        verified: false 
      };
    });
  }
  
  if (Array.isArray(payload.items_text) && payload.items_text.length) {
    return lineToOrders(payload.items_text);
  }
  
  if (payload.raw_text) {
    const timestamp = payload.timestamp ? payload.timestamp : '';
    const companyName = payload.company_name ? payload.company_name : (payload.sender_name ? payload.sender_name : 'Unknown');
    const senderPhone = payload.sender_phone ? payload.sender_phone : '';
    
    return [{
      timestamp: timestamp,
      company_name: normalizeCompanyName(companyName),
      sender_phone: senderPhone,
      items_text: [payload.raw_text],
      removed: new Set(),
      verified: false
    }];
  }
  
  return [];
}

function renderList() {
  ordersEl.innerHTML = '';
  orders.forEach((o, i) => {
    const li = document.createElement('li');
    const itemsArray = Array.isArray(o.items_text) ? o.items_text : [];
    const removedSize = o.removed ? o.removed.size : 0;
    const count = itemsArray.length - removedSize;
    const companyName = o.company_name ? o.company_name : 'Unknown';
    const timestampPart = o.timestamp ? ' (' + o.timestamp + ')' : '';
    li.textContent = `${i + 1}. ${companyName}${timestampPart} • ${count} item(s)`;
    if (i === current) li.classList.add('active');
    li.addEventListener('click', () => { saveForm(); current = i; loadForm(); renderList(); });
    ordersEl.appendChild(li);
  });
}

function renderItemsList() {
  console.log('[renderer] renderItemsList called for order:', current);
  itemsListEl.innerHTML = '';
  const o = orders[current];
  console.log('[renderer] Current order:', o);
  
  if (!Array.isArray(o.items_text) || o.items_text.length === 0) {
    itemsListEl.innerHTML = '<div style="padding: 16px; text-align: center; color: #999;">No items</div>';
    hintEl.textContent = 'Add items using the input below.';
    return;
  }
  
  o.items_text.forEach((txt, idx) => {
    const parsed = parseItemQuantity(txt);
    console.log('[renderer] Processing item:', txt, '-> parsed:', parsed); // Debug each item
    const isRemoved = o.removed?.has(idx);
    
    const row = document.createElement('div');
    row.className = 'item-row' + (isRemoved ? ' removed' : '') + (parsed.isImage ? ' image-item' : '');
    
    // Quantity input (disabled for images)
    const quantityInput = document.createElement('input');
    quantityInput.type = 'number';
    quantityInput.className = 'quantity-input';
    quantityInput.value = parsed.quantity;
    quantityInput.min = '0';
    quantityInput.step = '0.1';
    quantityInput.disabled = isRemoved || parsed.isImage; // Disable for images
    
    if (!parsed.isImage) {
      quantityInput.addEventListener('change', () => {
        let newQuantity = parseFloat(quantityInput.value);
        if (isNaN(newQuantity) || newQuantity <= 0) {
          newQuantity = 1;
        }
        const newText = formatItemText(newQuantity, parsed.name, parsed.unit);
        o.items_text[idx] = newText;
        renderList(); // Update the order list display
      });
    }
    
    // Item name (or image for image items)
    const nameSpan = document.createElement('span');
    nameSpan.className = 'item-name';
    
    if (parsed.isImage) {
      console.log('[renderer] FOUND IMAGE ITEM - will process with custom protocol');
      // Create image element for image items
      const img = document.createElement('img');
      // Extract the actual path from the parsed name like "Image: /images/filename.jpg"
      const imagePath = parsed.name.replace(/^Image:\s*/, '');
      
      // Convert to custom protocol for Electron
      if (imagePath.startsWith('/images/')) {
        let filename = imagePath.replace('/images/', '');
        
        // If the exact file doesn't exist, try to find a similar one
        if (filename.startsWith('order_image_')) {
          // For now, just use the filename as-is and let the protocol handler deal with it
        }
        
        const customUrl = `local-images://${filename}`;
        console.log('[renderer] USING CUSTOM PROTOCOL - Image path:', imagePath, '-> filename:', filename, '-> customUrl:', customUrl);
        
        // Check if file loads
        img.onerror = () => {
          console.error('[renderer] Image failed to load:', customUrl);
          img.alt = 'Image not found';
        };
        img.onload = () => {
          console.log('[renderer] Image loaded successfully:', customUrl);
        };
        img.src = customUrl;
      } else {
        img.src = imagePath;
      }
      img.alt = 'Order Image';
      img.style.maxWidth = '200px';
      img.style.maxHeight = '150px';
      img.style.objectFit = 'contain';
      img.style.border = '1px solid #ddd';
      img.style.borderRadius = '4px';
      img.style.cursor = 'pointer';
      
      // Add click to view full size
      img.addEventListener('click', () => {
        if (imagePath.startsWith('/images/')) {
          const filename = imagePath.replace('/images/', '');
          window.open(`local-images://${filename}`, '_blank');
        } else {
          window.open(imagePath, '_blank');
        }
      });
      
      nameSpan.appendChild(img);
      
      // Add filename below image
      const filenameDiv = document.createElement('div');
      filenameDiv.style.fontSize = '11px';
      filenameDiv.style.color = '#666';
      filenameDiv.style.marginTop = '4px';
      filenameDiv.textContent = imagePath.split('/').pop();
      nameSpan.appendChild(filenameDiv);
    } else {
      nameSpan.textContent = parsed.name;
    }
    
    // Unit
    const unitSpan = document.createElement('span');
    unitSpan.className = 'item-unit';
    unitSpan.textContent = parsed.unit;
    
    // Actions
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'item-actions';
    
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'btn-small ' + (isRemoved ? 'btn-restore' : 'btn-remove');
    toggleBtn.textContent = isRemoved ? '↻' : '×';
    toggleBtn.title = isRemoved ? 'Restore item' : 'Remove item';
    toggleBtn.addEventListener('click', () => {
      if (!o.removed) o.removed = new Set();
      if (o.removed.has(idx)) o.removed.delete(idx); else o.removed.add(idx);
      renderItemsList();
      renderList();
    });
    
    actionsDiv.appendChild(toggleBtn);
    
    row.appendChild(quantityInput);
    row.appendChild(nameSpan);
    row.appendChild(unitSpan);
    row.appendChild(actionsDiv);
    
    itemsListEl.appendChild(row);
  });
  
  hintEl.textContent = 'Change quantities directly. Removed items (×) will not be submitted. Click ↻ to restore.';
}

function loadForm() {
  let o = orders[current];
  if (!o) {
    o = { company_name: '', sender_phone: '', items_text: [], removed: new Set(), verified: false };
  }
  
  companyEl.value = o.company_name ? o.company_name : '';
  phoneEl.value = o.sender_phone ? o.sender_phone : '';
  verifiedEl.checked = !!o.verified;
  renderItemsList();
}

function saveForm() {
  const o = orders[current];
  if (!o) return;
  o.company_name = companyEl.value.trim();
  o.sender_phone = phoneEl.value.trim();
  o.verified = !!verifiedEl.checked;
}

addBtn.addEventListener('click', () => {
  const val = addItemEl.value.trim();
  if (!val) return;
  const o = orders[current];
  o.items_text.push(val);
  addItemEl.value = '';
  renderItemsList();
  renderList();
});

addItemEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') addBtn.click(); });

async function submitOrder(o) {
  if (!ENDPOINT) { 
    alert('BACKEND_API_URL not set'); 
    return false; 
  }
  
  const itemsArray = Array.isArray(o.items_text) ? o.items_text : [];
  const items = itemsArray.filter((_, idx) => !o.removed?.has(idx));
  
  if (!o.verified && !confirm('Order not marked as verified. Submit anyway?')) {
    return false;
  }
  
  const order_data = {
    whatsapp_message_id: `placeorder_${Date.now()}_${Math.floor(Math.random()*1e6)}`,
    sender: o.sender_phone ? o.sender_phone : '',
    sender_name: o.company_name ? o.company_name : '',
    message_text: items.join('\n'),
    timestamp: o.timestamp ? o.timestamp : '',
    is_backdated: false
  };
  try { console.log('[renderer] submitting order', { endpoint: ENDPOINT, size: JSON.stringify(order_data).length }); } catch {}
  const resp = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(order_data) });
  if (!resp.ok) { const txt = await resp.text(); alert(`Backend error ${resp.status}: ${txt}`); return false; }
  return true;
}

btnSubmit.addEventListener('click', async () => { saveForm(); const ok = await submitOrder(orders[current]); if (ok) alert('Submitted'); });
btnSubmitAll.addEventListener('click', async () => { saveForm(); let okCount = 0; for (const o of orders) { if (!o.company_name && (!o.items_text || !o.items_text.length)) continue; if (await submitOrder(o)) okCount++; } alert(`Submitted ${okCount} order(s)`); });
btnRemove.addEventListener('click', () => { saveForm(); orders.splice(current, 1); if (!orders.length) orders.push({ company_name: '', sender_phone: '', items_text: [], removed: new Set(), verified: false }); current = Math.min(current, orders.length - 1); renderList(); loadForm(); });
btnClose.addEventListener('click', () => window.close());

async function boot() {
  // Load configurations first
  await loadConfigurations();
  
  // Initialize LABEL_STOPWORDS from config
  if (VALIDATION_CONFIG && VALIDATION_CONFIG.label_stopwords) {
    VALIDATION_CONFIG.label_stopwords.forEach(word => LABEL_STOPWORDS.add(word));
  } else {
    // Default stopwords
    ['good','morning','day','orders','order','please','add','thanks','thank','hi','hello','tnx','veg','stock','start','here','venue'].forEach(word => LABEL_STOPWORDS.add(word));
  }
  
  let p = null;
  if (window.api && typeof window.api.getPayload === 'function') {
    try {
      p = window.api.getPayload();
    } catch (error) {
      console.error('[renderer] Failed to get payload:', error);
    }
  }
  
  if (!p) { 
    hintEl.textContent = 'Waiting for WhatsApp messages…'; 
    return; 
  }
  
  orders = normalizePayload(p);
  
  if (!orders.length && p.raw_text) {
    const companyName = p.company_name ? p.company_name : 'Order';
    const senderPhone = p.sender_phone ? p.sender_phone : '';
    const timestamp = p.timestamp ? p.timestamp : '';
    
    orders = [{
      company_name: companyName,
      sender_phone: senderPhone,
      items_text: [p.raw_text],
      timestamp: timestamp,
      removed: new Set(),
      verified: false
    }];
  }
  
  if (!orders.length) { 
    hintEl.textContent = 'No orders in payload'; 
    return; 
  }
  
  current = 0; 
  renderList(); 
  loadForm();
}

// Listen for live batches from the main process (WhatsApp reader)
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
      hintEl.textContent = `Reader error: ${errorMessage}`;
      return;
    }
    
    const incoming = normalizePayload(payload);
    if (!incoming.length) return;

    const firstOrderEmpty = orders.length === 1 && (!Array.isArray(orders[0].items_text) || orders[0].items_text.length === 0);
    if (!orders.length || firstOrderEmpty) {
      orders = incoming;
      current = 0;
    } else {
      const startIndex = orders.length;
      orders = orders.concat(incoming);
      current = startIndex;
    }
    renderList();
    loadForm();
  });
}

// Handle single-line streaming updates
if (window.api && typeof window.api.onPayloadLine === 'function') {
  window.api.onPayloadLine((line) => {
    try { 
      if (debugPostEl) {
        const currentText = debugPostEl.textContent ? debugPostEl.textContent : '';
        debugPostEl.textContent = currentText + `\n${line}`;
      }
    } catch (error) {
      console.warn('[renderer] Failed to update debug element with line:', error);
    }
    
    let re = /^\[(?<ts>[^\]]+)\]\s*(?<company>[^→·]*?)\s*(?:·\s*(?<phone>[^→]+))?\s*→\s*(?<text>.*)$/;
    if (PATTERNS_CONFIG && PATTERNS_CONFIG.message_line_pattern) {
      try {
        re = new RegExp(PATTERNS_CONFIG.message_line_pattern.pattern, PATTERNS_CONFIG.message_line_pattern.flags);
      } catch (error) {
        console.warn('[renderer] Invalid message_line_pattern in config for onPayloadLine, using default:', error);
      }
    }
    
    let lineStr = '';
    if (typeof line === 'string') {
      lineStr = line;
    } else if (line !== null && line !== undefined) {
      lineStr = String(line);
    }
    
    const m = lineStr.trim().match(re);
    if (!m) return;
    
    const { ts, company, text } = m.groups;
    const tsStr = ts ? ts : '';
    
    let tsMs = Date.now();
    if (tsStr) {
      const parsed = Date.parse(tsStr.replace(/\//g, '-'));
      if (!isNaN(parsed)) {
        tsMs = parsed;
      }
    }
    
    const companyForCheck = company ? company : '';
    const isForwarder = FORWARDER_NAMES.includes(companyForCheck.trim().toLowerCase());
    if (!isForwarder) return;
    
    const textForSplit = text ? text : '';
    const parts = String(textForSplit).split(/\n+/);
  for (const part of parts) {
    const label = parseCompanyLabelText(part);
    if (label) {
      state.currentLabel = label;
      state.lastLabelTsMs = tsMs;
      if (!state.ordersByCompany.has(label)) {
        state.ordersByCompany.set(label, { timestamp: tsStr, company_name: label, sender_phone: '', items_text: [], removed: new Set(), verified: false, _lastTsMs: tsMs });
        orders.push(state.ordersByCompany.get(label));
      }
      if (state.pending.length) {
        state.ordersByCompany.get(label).items_text.push(...state.pending);
        state.pending = [];
      }
      continue;
    }
      const content = part.trim();
      if (!content) continue;
      let forwarderTimeoutMinutes = 5;
      if (VALIDATION_CONFIG && VALIDATION_CONFIG.forwarder_timeout_minutes) {
        forwarderTimeoutMinutes = VALIDATION_CONFIG.forwarder_timeout_minutes;
      }
      const tooOld = state.currentLabel && state.lastLabelTsMs && (tsMs - state.lastLabelTsMs > forwarderTimeoutMinutes * 60 * 1000);
      if (state.currentLabel && !tooOld) {
        state.ordersByCompany.get(state.currentLabel).items_text.push(content);
      } else {
        state.pending.push(content);
      }
    }
    current = orders.length - 1;
    renderList();
    loadForm();
  });
}

// Listen for pre-send debug events from main
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

boot();

// Tabs toggle
function showPanel(which) {
  if (!panelOrders || !panelDebug) return;
  if (which === 'debug') {
    panelOrders.style.display = 'none';
    panelDebug.style.display = '';
  } else {
    panelOrders.style.display = '';
    panelDebug.style.display = 'none';
  }
}
if (tabOrders) {
  tabOrders.addEventListener('click', () => showPanel('orders'));
}
if (tabDebug) {
  tabDebug.addEventListener('click', () => showPanel('debug'));
}
