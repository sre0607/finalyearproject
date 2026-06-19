/*
 * Auth.js - Client-Side Login & Registration Handler
 * Purpose: Formulates JSON data schemas, handles fetch token storage, and redirects authorized sessions.
 */

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLoginSubmit);
  }

  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', handleRegisterSubmit);
    setupRegisterValidation();
  }

  // Ensure navbar updates correctly when opening auth pages
  verifySessionState();
});

/**
 * Handle public customer login form submits
 */
async function handleLoginSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const alertBox = document.getElementById('auth-alert');
  const submitBtn = form.querySelector('button[type="submit"]');

  if (alertBox) {
    alertBox.style.display = 'none';
    alertBox.textContent = '';
  }

  // Clear existing validation styles
  if (typeof clearInlineErrors === 'function') {
    clearInlineErrors(form);
  }

  let isValid = true;

  // Validate email
  const emailVal = emailInput.value.trim().toLowerCase();
  if (!emailVal) {
    if (typeof showInlineError === 'function') {
      showInlineError(emailInput, 'Email address is required');
    }
    isValid = false;
  } else if (typeof validateEmailPattern === 'function' && !validateEmailPattern(emailVal)) {
    if (typeof showInlineError === 'function') {
      showInlineError(emailInput, 'Please enter a valid email address');
    }
    isValid = false;
  }

  // Validate password
  const passwordVal = passwordInput.value;
  if (!passwordVal) {
    if (typeof showInlineError === 'function') {
      showInlineError(passwordInput, 'Password is required');
    }
    isValid = false;
  }

  if (!isValid) return;

  const originalBtnText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Signing In...';

  try {
    console.log('Sending authentication credentials for:', emailVal);
    const data = await api.post('/auth/login', { email: emailVal, password: passwordVal });
    
    // Save token and user info
    localStorage.setItem('florish_token', data.token);
    localStorage.setItem('florish_user', JSON.stringify({ name: data.name, email: data.email, role: data.role }));

    // Merge guest local cart with backend session
    await mergeGuestCart();

    // Show success feedback
    if (alertBox) {
      alertBox.className = 'form-alert form-alert-success animate-fade-in';
      alertBox.textContent = `Welcome back, ${data.name}! Redirecting...`;
      alertBox.style.display = 'flex';
    }

    if (typeof showNotification === 'function') {
      showNotification(`Welcome back to Florish, ${data.name}!`, 'success');
    }

    // Delay redirect for user experience feedback
    setTimeout(() => {
      if (data.role === 'admin') {
        window.location.href = 'admin/dashboard.html';
      } else {
        window.location.href = 'index.html';
      }
    }, 1200);

  } catch (error) {
    submitBtn.disabled = false;
    submitBtn.textContent = originalBtnText;

    if (alertBox) {
      alertBox.className = 'form-alert form-alert-error animate-fade-in';
      alertBox.textContent = error.message;
      alertBox.style.display = 'flex';
    }

    if (typeof showNotification === 'function') {
      showNotification(error.message || 'Login failed', 'error');
    }
  }
}

/**
 * Handle new customer registration form submits
 */
async function handleRegisterSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const nameInput = document.getElementById('reg-name');
  const emailInput = document.getElementById('reg-email');
  const passwordInput = document.getElementById('reg-password');
  const confirmPasswordInput = document.getElementById('reg-confirm-password');
  const alertBox = document.getElementById('auth-alert');
  const submitBtn = form.querySelector('button[type="submit"]');

  if (alertBox) {
    alertBox.style.display = 'none';
    alertBox.textContent = '';
  }

  // Clear existing validation styles
  if (typeof clearInlineErrors === 'function') {
    clearInlineErrors(form);
  }

  let isValid = true;

  // Validate Name
  const nameVal = nameInput.value.trim();
  if (!nameVal) {
    if (typeof showInlineError === 'function') {
      showInlineError(nameInput, 'Full name is required');
    }
    isValid = false;
  } else if (nameVal.length < 2) {
    if (typeof showInlineError === 'function') {
      showInlineError(nameInput, 'Name must be at least 2 characters long');
    }
    isValid = false;
  } else if (nameVal.length > 50) {
    if (typeof showInlineError === 'function') {
      showInlineError(nameInput, 'Name cannot exceed 50 characters');
    }
    isValid = false;
  } else if (/<script/i.test(nameVal)) {
    if (typeof showInlineError === 'function') {
      showInlineError(nameInput, 'Script injection is not allowed');
    }
    isValid = false;
  }

  // Validate Email
  const emailVal = emailInput.value.trim().toLowerCase();
  if (!emailVal) {
    if (typeof showInlineError === 'function') {
      showInlineError(emailInput, 'Email address is required');
    }
    isValid = false;
  } else if (typeof validateEmailPattern === 'function' && !validateEmailPattern(emailVal)) {
    if (typeof showInlineError === 'function') {
      showInlineError(emailInput, 'Please enter a valid email address');
    }
    isValid = false;
  }

  // Validate Password
  const passwordVal = passwordInput.value;
  if (!passwordVal) {
    if (typeof showInlineError === 'function') {
      showInlineError(passwordInput, 'Password is required');
    }
    isValid = false;
  } else if (typeof validatePasswordStrengthPattern === 'function' && !validatePasswordStrengthPattern(passwordVal)) {
    if (typeof showInlineError === 'function') {
      showInlineError(passwordInput, 'Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character');
    }
    isValid = false;
  }

  // Validate Confirm Password
  const confirmPasswordVal = confirmPasswordInput.value;
  if (!confirmPasswordVal) {
    if (typeof showInlineError === 'function') {
      showInlineError(confirmPasswordInput, 'Please confirm your password');
    }
    isValid = false;
  } else if (passwordVal !== confirmPasswordVal) {
    if (typeof showInlineError === 'function') {
      showInlineError(confirmPasswordInput, 'Passwords do not match');
    }
    isValid = false;
  }

  if (!isValid) return;

  const originalBtnText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Registering...';

  try {
    console.log('Sending new profile registration request for:', emailVal);
    const data = await api.post('/auth/register', { name: nameVal, email: emailVal, password: passwordVal });

    // Save token and user info
    localStorage.setItem('florish_token', data.token);
    localStorage.setItem('florish_user', JSON.stringify({ name: data.name, email: data.email, role: data.role }));

    // Merge guest local cart with backend session
    await mergeGuestCart();

    if (alertBox) {
      alertBox.className = 'form-alert form-alert-success animate-fade-in';
      alertBox.textContent = 'Profile successfully registered! Redirecting...';
      alertBox.style.display = 'flex';
    }

    if (typeof showNotification === 'function') {
      showNotification('Profile successfully registered! Enjoy shopping at Florish!', 'success');
    }

    // Delay redirect for user experience feedback
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1200);

  } catch (error) {
    submitBtn.disabled = false;
    submitBtn.textContent = originalBtnText;

    if (alertBox) {
      alertBox.className = 'form-alert form-alert-error animate-fade-in';
      alertBox.textContent = error.message;
      alertBox.style.display = 'flex';
    }

    if (typeof showNotification === 'function') {
      showNotification(error.message || 'Registration failed', 'error');
    }
  }
}

/**
 * Merge items from local guest cart into authenticated user cart
 */
async function mergeGuestCart() {
  const token = localStorage.getItem('florish_token');
  if (!token) return;

  let guestCart = [];
  try {
    guestCart = JSON.parse(localStorage.getItem('florish_guest_cart')) || [];
    if (!Array.isArray(guestCart)) guestCart = [];
  } catch (e) {
    guestCart = [];
  }

  if (guestCart.length === 0) return;

  console.log('Merging guest cart items into authenticated user session...');
  for (const item of guestCart) {
    try {
      await api.post('/cart', { productId: item.product, quantity: item.quantity });
    } catch (err) {
      console.error(`Failed to merge guest cart item: ${item.product}`, err);
    }
  }

  // Clear guest cart from localStorage
  localStorage.removeItem('florish_guest_cart');
}

function setupRegisterValidation() {
  const nameInput = document.getElementById('reg-name');
  const emailInput = document.getElementById('reg-email');
  const passwordInput = document.getElementById('reg-password');
  const confirmPasswordInput = document.getElementById('reg-confirm-password');
  const form = document.getElementById('register-form');
  const submitBtn = form ? form.querySelector('button[type="submit"]') : null;

  const validateRegisterForm = () => {
    let isValid = true;
    if (nameInput) {
      const val = nameInput.value.trim();
      if (!val || val.length < 2 || val.length > 50 || /<script/i.test(val)) isValid = false;
    }
    if (emailInput) {
      const val = emailInput.value.trim().toLowerCase();
      if (!val || !validateEmailPattern(val)) isValid = false;
    }
    if (passwordInput) {
      const val = passwordInput.value;
      if (!val || !validatePasswordStrengthPattern(val)) isValid = false;
    }
    if (confirmPasswordInput) {
      const val = confirmPasswordInput.value;
      if (!val || val !== passwordInput.value) isValid = false;
    }
    if (submitBtn) submitBtn.disabled = !isValid;
  };

  const validateField = (inputEl) => {
    if (!inputEl) return;
    const val = inputEl.value;
    const valTrim = val.trim();

    if (inputEl === nameInput) {
      if (!valTrim) {
        showInlineError(nameInput, 'Full name is required.');
      } else if (valTrim.length < 2) {
        showInlineError(nameInput, 'Name must be at least 2 characters long.');
      } else if (valTrim.length > 50) {
        showInlineError(nameInput, 'Name cannot exceed 50 characters.');
      } else if (/<script/i.test(valTrim)) {
        showInlineError(nameInput, 'Script injection is not allowed.');
      } else {
        clearInlineError(nameInput);
      }
    } else if (inputEl === emailInput) {
      if (!valTrim) {
        showInlineError(emailInput, 'Email address is required.');
      } else if (!validateEmailPattern(valTrim)) {
        showInlineError(emailInput, 'Please enter a valid email address.');
      } else {
        clearInlineError(emailInput);
      }
    } else if (inputEl === passwordInput) {
      if (!val) {
        showInlineError(passwordInput, 'Password is required.');
      } else if (!validatePasswordStrengthPattern(val)) {
        showInlineError(passwordInput, 'Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character.');
      } else {
        clearInlineError(passwordInput);
      }
    } else if (inputEl === confirmPasswordInput) {
      if (!val) {
        showInlineError(confirmPasswordInput, 'Please confirm your password.');
      } else if (val !== passwordInput.value) {
        showInlineError(confirmPasswordInput, 'Passwords do not match.');
      } else {
        clearInlineError(confirmPasswordInput);
      }
    }
  };

  const inputs = [nameInput, emailInput, passwordInput, confirmPasswordInput];
  inputs.forEach(input => {
    if (!input) return;
    input.addEventListener('blur', () => validateField(input));
    input.addEventListener('input', () => validateRegisterForm());
    input.addEventListener('change', () => {
      validateField(input);
      validateRegisterForm();
    });
  });

  validateRegisterForm();
}
