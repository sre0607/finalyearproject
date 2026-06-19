/*
 * Validation.js - Form compliance checkers
 * Purpose: Evaluates text entries, checks phone formats, email regular expression patterns and highlights invalid controls.
 */

/**
 * Checks general checkout fields before submission
 * @returns {boolean} Status indicator
 */
function validateCheckoutInputs() {
  const form = document.getElementById('checkout-form');
  clearInlineErrors(form);

  const firstName = document.getElementById('txt-first-name');
  const lastName = document.getElementById('txt-last-name');
  const address = document.getElementById('txt-address');
  const city = document.getElementById('txt-city');
  const pincode = document.getElementById('txt-pincode');
  const phone = document.getElementById('txt-phone');
  const email = document.getElementById('txt-email');

  let isValid = true;

  // Verify presence
  if (firstName) {
    const fnVal = firstName.value.trim();
    if (!fnVal) {
      showInlineError(firstName, 'First name is required.');
      isValid = false;
    } else if (fnVal.length < 2) {
      showInlineError(firstName, 'First name must be at least 2 characters.');
      isValid = false;
    } else if (fnVal.length > 50) {
      showInlineError(firstName, 'First name cannot exceed 50 characters.');
      isValid = false;
    } else if (/<script/i.test(fnVal)) {
      showInlineError(firstName, 'Script injection is not allowed.');
      isValid = false;
    }
  }
  if (lastName) {
    const lnVal = lastName.value.trim();
    if (!lnVal) {
      showInlineError(lastName, 'Last name is required.');
      isValid = false;
    } else if (lnVal.length < 2) {
      showInlineError(lastName, 'Last name must be at least 2 characters.');
      isValid = false;
    } else if (lnVal.length > 50) {
      showInlineError(lastName, 'Last name cannot exceed 50 characters.');
      isValid = false;
    } else if (/<script/i.test(lnVal)) {
      showInlineError(lastName, 'Script injection is not allowed.');
      isValid = false;
    }
  }
  if (address) {
    const addrVal = address.value.trim();
    if (!addrVal) {
      showInlineError(address, 'Street address is required.');
      isValid = false;
    } else if (addrVal.length < 5) {
      showInlineError(address, 'Street address must be at least 5 characters long.');
      isValid = false;
    }
  }
  if (city && !city.value.trim()) {
    showInlineError(city, 'City is required.');
    isValid = false;
  }

  // Verify PIN/ZIP code (exactly 6 digits, numeric only) and check against allowed limits from settings
  if (pincode) {
    const pinVal = pincode.value.trim();
    if (!pinVal) {
      showInlineError(pincode, 'ZIP/PIN code is required.');
      isValid = false;
    } else if (!/^\d{6}$/.test(pinVal)) {
      showInlineError(pincode, 'ZIP/PIN code must be exactly 6 digits.');
      isValid = false;
    } else {
      const allowedStr = localStorage.getItem('florish_allowed_pincodes') || '400001, 400002, 400003, 400029, 400032';
      const allowedList = allowedStr.split(',').map(p => p.trim());
      if (!allowedList.includes(pinVal)) {
        showInlineError(pincode, `Sorry, we do not deliver to pincode ${pinVal}. Supported areas: ${allowedStr}`);
        isValid = false;
      }
    }
  }

  // Verify phone length (10 digits Indian mobile validation starting with 6-9)
  if (phone) {
    const phoneVal = phone.value.trim();
    if (!phoneVal) {
      showInlineError(phone, 'Phone number is required.');
      isValid = false;
    } else if (!/^[6-9]\d{9}$/.test(phoneVal)) {
      showInlineError(phone, 'Please enter a valid 10-digit Indian phone number starting with 6-9.');
      isValid = false;
    }
  }

  // Verify email pattern
  if (email) {
    const emailVal = email.value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailVal) {
      showInlineError(email, 'Email address is required.');
      isValid = false;
    } else if (!emailRegex.test(emailVal)) {
      showInlineError(email, 'Please enter a valid email address.');
      isValid = false;
    }
  }

  if (!isValid && typeof showNotification === 'function') {
    showNotification('Please correct the highlighted fields in the form.', 'error');
  }

  return isValid;
}

/**
 * Highlights elements and sets error tags
 * @param {HTMLInputElement} field - Input target
 * @param {string} err - Warning text
 * @param {boolean} customMsg - Check flag
 */
function highlightField(field, err) {
  showInlineError(field, err);
}

/**
 * Helper to display inline error message under input field
 */
function showInlineError(inputEl, msg) {
  if (!inputEl) return;
  inputEl.style.borderColor = 'var(--error)';
  inputEl.style.boxShadow = '0 0 0 3px rgba(220, 38, 38, 0.1)';
  
  let errorContainer = document.getElementById(`err-${inputEl.id}`);
  if (!errorContainer) {
    errorContainer = document.createElement('div');
    errorContainer.id = `err-${inputEl.id}`;
    errorContainer.className = 'error-msg';
    errorContainer.style.color = 'var(--error)';
    errorContainer.style.fontSize = '0.8rem';
    errorContainer.style.marginTop = '4px';
    errorContainer.style.display = 'none';
    if (inputEl.parentNode) {
      inputEl.parentNode.appendChild(errorContainer);
    }
  }
  
  errorContainer.textContent = msg;
  errorContainer.style.display = 'block';

  // Reset highlight upon typing or change
  const resetHighlight = () => {
    inputEl.style.borderColor = '';
    inputEl.style.boxShadow = '';
    errorContainer.style.display = 'none';
    errorContainer.textContent = '';
    inputEl.removeEventListener('input', resetHighlight);
    inputEl.removeEventListener('change', resetHighlight);
  };

  inputEl.addEventListener('input', resetHighlight);
  inputEl.addEventListener('change', resetHighlight);
}

/**
 * Helper to clear inline error on a specific field
 */
function clearInlineError(inputEl) {
  if (!inputEl) return;
  inputEl.style.borderColor = '';
  inputEl.style.boxShadow = '';
  const errorContainer = document.getElementById(`err-${inputEl.id}`);
  if (errorContainer) {
    errorContainer.style.display = 'none';
    errorContainer.textContent = '';
  }
}

/**
 * Helper to clear all inline errors in a form
 */
function clearInlineErrors(formEl) {
  if (!formEl) return;
  const inputs = formEl.querySelectorAll('.form-control');
  inputs.forEach(input => {
    clearInlineError(input);
  });
}

/**
 * Checks email patterns
 */
function validateEmailPattern(email) {
  const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
}

/**
 * Ensures password fields satisfy minimal standards
 */
function validatePasswordStrengthPattern(password) {
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  return password && password.length >= 8 && hasUppercase && hasLowercase && hasNumber && hasSpecial;
}

// Product Validation Helpers
function validateProductName(name) {
  return name && name.trim().length >= 3 && name.trim().length <= 100 && !/<script/i.test(name);
}

function validateProductPrice(price) {
  const p = Number(price);
  return !isNaN(p) && p > 0;
}

function validateProductStock(stock) {
  const s = Number(stock);
  return !isNaN(s) && Number.isInteger(s) && s >= 0;
}

function validateProductSku(sku) {
  return sku && sku.trim().length > 0 && !/<script/i.test(sku);
}

function validateProductDesc(desc) {
  return desc && desc.trim().length >= 10;
}

function validateProductImage(fileName, isRequired = true) {
  if (!fileName) return !isRequired;
  return /\.(jpg|jpeg|png|webp)$/i.test(fileName);
}

// Category Validation Helpers
function validateCategoryName(name) {
  return name && name.trim().length > 0 && !/<script/i.test(name);
}

function validateCategorySlug(slug) {
  return slug && /^[a-z0-9-]+$/.test(slug.trim());
}

// Settings Validation Helpers
function validateSettingsTax(tax) {
  const t = Number(tax);
  return !isNaN(t) && t >= 0 && t <= 100;
}

function validateSettingsShipping(shipping) {
  const s = Number(shipping);
  return !isNaN(s) && s >= 0;
}

function validateSettingsPincodes(pincodes) {
  if (!pincodes) return false;
  const pins = pincodes.split(',').map(p => p.trim());
  return pins.length > 0 && pins.every(pin => /^\d{6}$/.test(pin));
}
