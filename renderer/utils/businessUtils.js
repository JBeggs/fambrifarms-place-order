// Business logic utilities
// Handles validation, business settings, units, and business rules

// Global data stores
let businessSettings = null;
let units = [];

function generateUnitOptions(selectedUnit = '') {
  if (!units) {
    throw new Error('Units data is required but not loaded');
  }
  if (units.length === 0) {
    throw new Error('Units not loaded from API. Cannot generate unit options. Check backend connectivity and ensure loadUnits() completes successfully.');
  }
  
  return units.map(unit => 
    `<option value="${unit.abbreviation}" ${selectedUnit === unit.abbreviation ? 'selected' : ''}>${unit.abbreviation} - ${unit.name}</option>`
  ).join('');
}

// Helper functions to get configurable defaults
function getDefaultMinimumLevel() {
  if (!businessSettings?.default_minimum_level) {
    throw new Error('BusinessSettings not loaded or default_minimum_level not configured');
  }
  return businessSettings.default_minimum_level;
}

function getDefaultReorderLevel() {
  if (!businessSettings?.default_reorder_level) {
    throw new Error('BusinessSettings not loaded or default_reorder_level not configured');
  }
  return businessSettings.default_reorder_level;
}

function getDefaultOrderQuantity() {
  if (!businessSettings?.default_order_quantity) {
    throw new Error('BusinessSettings not loaded or default_order_quantity not configured');
  }
  return businessSettings.default_order_quantity;
}

function getDefaultWeightUnit() {
  if (!businessSettings?.default_weight_unit_abbr) {
    throw new Error('BusinessSettings not loaded or default_weight_unit_abbr not configured');
  }
  return businessSettings.default_weight_unit_abbr;
}

function getDefaultCountUnit() {
  if (!businessSettings?.default_count_unit_abbr) {
    throw new Error('BusinessSettings not loaded or default_count_unit_abbr not configured');
  }
  return businessSettings.default_count_unit_abbr;
}

function getMinPhoneDigits() {
  if (!businessSettings?.min_phone_digits) {
    throw new Error('BusinessSettings not loaded or min_phone_digits not configured');
  }
  return businessSettings.min_phone_digits;
}

function requireEmailValidation() {
  return businessSettings?.require_email_validation !== false;
}

function requireBatchTracking() {
  return businessSettings?.require_batch_tracking !== false;
}

function requireExpiryDates() {
  return businessSettings?.require_expiry_dates !== false;
}

function requireQualityGrades() {
  return businessSettings?.require_quality_grades !== false;
}

// Generate quality grade options
function generateQualityGradeOptions(selectedGrade = 'B') {
  const grades = [
    { value: 'A', label: 'Grade A (Premium)' },
    { value: 'B', label: 'Grade B (Standard)' },
    { value: 'C', label: 'Grade C (Economy)' }
  ];
  
  return grades.map(grade => 
    `<option value="${grade.value}" ${selectedGrade === grade.value ? 'selected' : ''}>${grade.label}</option>`
  ).join('');
}

// Unit conversion functions
function findUnitByAbbreviation(abbreviation) {
  return units.find(unit => unit.abbreviation === abbreviation);
}

function convertQuantity(quantity, fromUnit, toUnit) {
  if (!fromUnit || !toUnit) {
    throw new Error('Both fromUnit and toUnit are required for conversion');
  }
  
  if (fromUnit.base_unit !== toUnit.base_unit) {
    throw new Error(`Cannot convert between different unit types: ${fromUnit.base_unit} vs ${toUnit.base_unit}`);
  }
  
  if (!fromUnit.base_unit_multiplier || !toUnit.base_unit_multiplier) {
    throw new Error('Unit multipliers not configured for conversion');
  }
  
  // Convert to base unit first, then to target unit
  const baseQuantity = quantity * parseFloat(fromUnit.base_unit_multiplier);
  const convertedQuantity = baseQuantity / parseFloat(toUnit.base_unit_multiplier);
  
  return Math.round(convertedQuantity * 10000) / 10000; // Round to 4 decimal places
}

function getUnitConversionInfo(supplierUnit, internalUnit) {
  if (!supplierUnit || !internalUnit) {
    throw new Error('Both supplier and internal units are required');
  }
  
  const fromUnit = findUnitByAbbreviation(supplierUnit);
  const toUnit = findUnitByAbbreviation(internalUnit);
  
  if (!fromUnit) {
    throw new Error(`Supplier unit '${supplierUnit}' not found in units configuration`);
  }
  
  if (!toUnit) {
    throw new Error(`Internal unit '${internalUnit}' not found in units configuration`);
  }
  
  if (fromUnit.base_unit !== toUnit.base_unit) {
    throw new Error(`Cannot convert between different unit types: ${fromUnit.base_unit} vs ${toUnit.base_unit}`);
  }
  
  const conversionFactor = convertQuantity(1, fromUnit, toUnit);
  
  return {
    fromUnit: fromUnit,
    toUnit: toUnit,
    conversionFactor: conversionFactor,
    description: `1 ${fromUnit.abbreviation} = ${conversionFactor} ${toUnit.abbreviation}`
  };
}

function showUnitConversionHelper(supplierUnit, internalUnit, quantity = 1) {
  try {
    const conversion = getUnitConversionInfo(supplierUnit, internalUnit);
    const convertedQuantity = convertQuantity(quantity, conversion.fromUnit, conversion.toUnit);
    
    return `
    <div style="background: #e3f2fd; padding: 8px; border-radius: 4px; margin: 4px 0; font-size: 12px;">
      <strong>Unit Conversion:</strong><br>
      ${quantity} ${supplierUnit} = ${convertedQuantity} ${internalUnit}<br>
      <em>${conversion.description}</em>
    </div>
  `;
  } catch (error) {
    return `<div style="color: #d32f2f; font-size: 12px;">Conversion error: ${error.message}</div>`;
  }
}

// Validation functions using business settings
function validatePhoneNumber(phone) {
  if (!phone) return false;
  
  // Clean phone number
  const cleaned = phone.replace(/\D/g, '');
  
  // Check against configurable minimum digits
  const minDigits = getMinPhoneDigits();
  return cleaned.length >= minDigits;
}

function validateEmail(email) {
  if (!requireEmailValidation()) {
    return true; // Skip validation if not required
  }
  
  if (!email) return false;
  
  // Basic email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePrice(price, historicalAverage = null) {
  if (!price || isNaN(price) || price <= 0) {
    return {
      isValid: false,
      message: 'Price must be a positive number'
    };
  }
  
  const numericPrice = parseFloat(price);
  
  // Check for reasonable price range (configurable via business settings)
  const maxVariancePercent = businessSettings?.max_price_variance_percent;
  if (!maxVariancePercent) {
    throw new Error('BusinessSettings not loaded or max_price_variance_percent not configured');
  }
  
  if (historicalAverage && historicalAverage > 0) {
    const variance = Math.abs(numericPrice - historicalAverage) / historicalAverage;
    const maxVariance = maxVariancePercent / 100;
    
    if (variance > maxVariance) {
      return {
        isValid: false,
        message: `Price varies by ${(variance * 100).toFixed(1)}% from historical average (R${historicalAverage.toFixed(2)}). Maximum allowed variance is ${maxVariancePercent}%.`,
        variance: variance,
        historicalAverage: historicalAverage
      };
    }
  }
  
  return {
    isValid: true,
    message: 'Price is within acceptable range'
  };
}

// Setters for global data
function setBusinessSettings(settings) {
  businessSettings = settings;
}

function setUnits(unitsData) {
  units = unitsData;
}

// Getters for global data
function getBusinessSettings() {
  return businessSettings;
}

function getUnits() {
  return units;
}

export {
  generateUnitOptions,
  getDefaultMinimumLevel,
  getDefaultReorderLevel,
  getDefaultOrderQuantity,
  getDefaultWeightUnit,
  getDefaultCountUnit,
  getMinPhoneDigits,
  requireEmailValidation,
  requireBatchTracking,
  requireExpiryDates,
  requireQualityGrades,
  generateQualityGradeOptions,
  findUnitByAbbreviation,
  convertQuantity,
  getUnitConversionInfo,
  showUnitConversionHelper,
  validatePhoneNumber,
  validateEmail,
  validatePrice,
  setBusinessSettings,
  setUnits,
  getBusinessSettings,
  getUnits
};
