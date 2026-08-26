/* ═══════════════════════════════════════════════════════════════
   SOLE MATRIX — Authentication Module
   Concord Footwear (Pvt) Ltd
   ─────────────────────────────────────────────────────────────
   API: SheetBest (https://api.sheetbest.com)
   Sheet columns: Username (A) | Password (B) | Department (C)
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   STATE
   ───────────────────────────────────────────────────────────── */
const AuthState = {
  currentTab: 'login',
  isLoading:  false,
};

/* ─────────────────────────────────────────────────────────────
   INITIALISATION
   ───────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initTabIndicator();
  initPasswordStrength();
  initRealTimeValidation();
});

/* ─────────────────────────────────────────────────────────────
   TAB SWITCHING
   ───────────────────────────────────────────────────────────── */
function switchTab(tab) {
  if (tab === AuthState.currentTab) return;
  AuthState.currentTab = tab;

  const loginBtn    = document.getElementById('tabLogin');
  const registerBtn = document.getElementById('tabRegister');
  const loginPanel  = document.getElementById('panelLogin');
  const regPanel    = document.getElementById('panelRegister');
  const indicator   = document.getElementById('tabIndicator');

  if (tab === 'login') {
    loginBtn.classList.add('active');
    loginBtn.setAttribute('aria-selected', 'true');
    registerBtn.classList.remove('active');
    registerBtn.setAttribute('aria-selected', 'false');

    loginPanel.removeAttribute('hidden');
    loginPanel.classList.add('active');
    regPanel.setAttribute('hidden', '');
    regPanel.classList.remove('active');

    indicator.classList.remove('right');
  } else {
    registerBtn.classList.add('active');
    registerBtn.setAttribute('aria-selected', 'true');
    loginBtn.classList.remove('active');
    loginBtn.setAttribute('aria-selected', 'false');

    regPanel.removeAttribute('hidden');
    regPanel.classList.add('active');
    loginPanel.setAttribute('hidden', '');
    loginPanel.classList.remove('active');

    indicator.classList.add('right');
  }

  hideAlert('loginAlert');
  hideAlert('registerAlert');
}

function initTabIndicator() {
  const indicator = document.getElementById('tabIndicator');
  if (AuthState.currentTab === 'register') indicator.classList.add('right');
}

/* ─────────────────────────────────────────────────────────────
   REAL-TIME VALIDATION
   ───────────────────────────────────────────────────────────── */
function initRealTimeValidation() {
  bindBlurValidation('loginUsername', () => validateRequired('loginUsername', 'loginUsernameErr', 'Username'));
  bindBlurValidation('loginPassword', () => validateRequired('loginPassword', 'loginPasswordErr', 'Password'));

  bindBlurValidation('regUsername',         () => validateUsername());
  bindBlurValidation('regPassword',         () => validatePassword());
  bindBlurValidation('regConfirmPassword',  () => validateConfirmPassword());
  bindBlurValidation('regDepartment',       () => validateDepartment());
}

function bindBlurValidation(id, fn) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('blur', fn);
  el.addEventListener('input', () => {
    clearFieldError(el);
    el.classList.remove('is-invalid');
  });
}

/* ─────────────────────────────────────────────────────────────
   VALIDATORS
   ───────────────────────────────────────────────────────────── */
function validateRequired(inputId, errId, label) {
  const el  = document.getElementById(inputId);
  const err = document.getElementById(errId);
  if (!el.value.trim()) {
    showFieldError(el, err, `${label} is required.`);
    return false;
  }
  clearFieldError(el, err);
  return true;
}

function validateUsername() {
  const el  = document.getElementById('regUsername');
  const err = document.getElementById('regUsernameErr');
  const val = el.value.trim();

  if (!val) { showFieldError(el, err, 'Username is required.'); return false; }
  if (val.length < 3) { showFieldError(el, err, 'Username must be at least 3 characters.'); return false; }
  if (!/^[a-zA-Z0-9._-]+$/.test(val)) {
    showFieldError(el, err, 'Only letters, numbers, dots, hyphens and underscores allowed.');
    return false;
  }
  clearFieldError(el, err);
  return true;
}

function validatePassword() {
  const el  = document.getElementById('regPassword');
  const err = document.getElementById('regPasswordErr');
  const val = el.value;

  if (!val) { showFieldError(el, err, 'Password is required.'); return false; }
  if (val.length < 6) { showFieldError(el, err, 'Password must be at least 6 characters.'); return false; }
  clearFieldError(el, err);
  return true;
}

function validateConfirmPassword() {
  const pw  = document.getElementById('regPassword').value;
  const el  = document.getElementById('regConfirmPassword');
  const err = document.getElementById('regConfirmPasswordErr');

  if (!el.value) { showFieldError(el, err, 'Please confirm your password.'); return false; }
  if (pw !== el.value) { showFieldError(el, err, 'Passwords do not match.'); return false; }
  clearFieldError(el, err);
  return true;
}

function validateDepartment() {
  const el  = document.getElementById('regDepartment');
  const err = document.getElementById('regDepartmentErr');

  if (!el.value) { showFieldError(el, err, 'Please select your department.'); return false; }
  clearFieldError(el, err);
  return true;
}

/* ─────────────────────────────────────────────────────────────
   FIELD ERROR HELPERS
   ───────────────────────────────────────────────────────────── */
function showFieldError(inputEl, errEl, message) {
  if (inputEl) { inputEl.classList.add('is-invalid'); inputEl.classList.remove('is-valid'); }
  if (errEl)   { errEl.textContent = message; errEl.classList.add('visible'); }
}

function clearFieldError(inputEl, errEl) {
  if (inputEl) {
    inputEl.classList.remove('is-invalid');
    if (inputEl.value.trim()) inputEl.classList.add('is-valid');
  }
  if (errEl) { errEl.textContent = ''; errEl.classList.remove('visible'); }
}

/* ─────────────────────────────────────────────────────────────
   ALERT HELPERS
   ───────────────────────────────────────────────────────────── */
function showAlert(id, message, type = 'error') {
  const el = document.getElementById(id);
  if (!el) return;

  const icons = {
    error:   '<i class="fa-solid fa-circle-exclamation"></i>',
    success: '<i class="fa-solid fa-circle-check"></i>',
    info:    '<i class="fa-solid fa-circle-info"></i>',
  };

  el.innerHTML  = `${icons[type] || icons.error} <span>${sanitizeHTML(message)}</span>`;
  el.className  = `alert-box alert-${type}`;
}

function hideAlert(id) {
  const el = document.getElementById(id);
  if (el) el.className = 'alert-box hidden';
}

function sanitizeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ─────────────────────────────────────────────────────────────
   PASSWORD VISIBILITY TOGGLE
   ───────────────────────────────────────────────────────────── */
function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  const icon  = btn.querySelector('i');

  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.replace('fa-eye', 'fa-eye-slash');
    btn.setAttribute('aria-label', 'Hide password');
  } else {
    input.type = 'password';
    icon.classList.replace('fa-eye-slash', 'fa-eye');
    btn.setAttribute('aria-label', 'Show password');
  }
}

/* ─────────────────────────────────────────────────────────────
   PASSWORD STRENGTH METER
   ───────────────────────────────────────────────────────────── */
function initPasswordStrength() {
  const input = document.getElementById('regPassword');
  if (!input) return;
  input.addEventListener('input', () => updateStrengthMeter(input.value));
}

function updateStrengthMeter(password) {
  const container = document.getElementById('pwStrength');
  const fill      = document.getElementById('pwStrengthFill');
  const label     = document.getElementById('pwStrengthLabel');

  if (!password) {
    container.className = 'pw-strength';
    fill.style.width    = '0%';
    label.textContent   = '';
    return;
  }

  const score  = calcPasswordScore(password);
  const levels = [
    { cls: 'strength-weak',   text: 'Weak',   width: '25%'  },
    { cls: 'strength-fair',   text: 'Fair',   width: '50%'  },
    { cls: 'strength-good',   text: 'Good',   width: '75%'  },
    { cls: 'strength-strong', text: 'Strong', width: '100%' },
  ];

  const level           = levels[score];
  container.className   = `pw-strength ${level.cls}`;
  fill.style.width      = level.width;
  label.textContent     = level.text;
}

function calcPasswordScore(pw) {
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;

  if (score <= 1) return 0;
  if (score === 2) return 1;
  if (score === 3) return 2;
  return 3;
}

/* ─────────────────────────────────────────────────────────────
   LOADING STATE
   ───────────────────────────────────────────────────────────── */
function setLoading(btnId, loading) {
  AuthState.isLoading = loading;
  const btn    = document.getElementById(btnId);
  const lbl    = btn.querySelector('.btn-label');
  const loader = btn.querySelector('.btn-loader');

  btn.disabled = loading;
  lbl.classList.toggle('hidden', loading);
  loader.classList.toggle('hidden', !loading);
}

/* ─────────────────────────────────────────────────────────────
   SHEETBEST API HELPERS
   ───────────────────────────────────────────────────────────── */

/**
 * Fetch ALL rows from the sheet as an array of objects.
 * Uses the plain base URL — no /search endpoint, no extra params.
 * This avoids any CORS preflight issues with query parameters.
 */
async function sheetGetAll() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

  try {
    const res = await fetch(CONFIG.SHEETBEST_URL, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) throw new Error(`API error ${res.status}: ${res.statusText}`);

    const data = await res.json();
    return Array.isArray(data) ? data : [];

  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('Request timed out. Please check your connection.');
    throw err;
  }
}

/**
 * Append a new row to the sheet.
 * Body is a plain object whose keys match the sheet column headers.
 */
async function sheetAppend(rowData) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

  try {
    const res = await fetch(CONFIG.SHEETBEST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rowData),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) throw new Error(`API error ${res.status}: ${res.statusText}`);

    return await res.json();

  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('Request timed out. Please check your connection.');
    throw err;
  }
}

/* ─────────────────────────────────────────────────────────────
   LOGIN HANDLER
   ───────────────────────────────────────────────────────────── */
async function handleLogin(event) {
  event.preventDefault();
  if (AuthState.isLoading) return;

  hideAlert('loginAlert');

  const usernameOk = validateRequired('loginUsername', 'loginUsernameErr', 'Username');
  const passwordOk = validateRequired('loginPassword', 'loginPasswordErr', 'Password');
  if (!usernameOk || !passwordOk) return;

  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  setLoading('loginBtn', true);

  try {
    // Fetch all rows, then find the matching user locally.
    // This uses the plain base URL (no /search) to avoid CORS preflight issues.
    const rows = await sheetGetAll();

    const matchedRow = rows.find(row => {
      const rowUser = String(row[CONFIG.COL_USERNAME] || '').trim();
      const rowPass = String(row[CONFIG.COL_PASSWORD] || '').trim();
      return rowUser.toLowerCase() === username.toLowerCase() && rowPass === password;
    });

    if (!matchedRow) {
      showAlert('loginAlert', 'Incorrect username or password.', 'error');
      shakeCard();
      return;
    }

    // Successful login
    const dept = String(matchedRow[CONFIG.COL_DEPARTMENT] || '').trim();
    sessionStorage.setItem('sm_user',  matchedRow[CONFIG.COL_USERNAME]);
    sessionStorage.setItem('sm_dept',  dept);
    sessionStorage.setItem('sm_login', Date.now().toString());

    showSuccessModal(matchedRow[CONFIG.COL_USERNAME], dept);

  } catch (err) {
    showAlert('loginAlert', err.message || 'Connection error. Please try again.', 'error');
    console.error('[SOLE MATRIX] Login error:', err);
  } finally {
    setLoading('loginBtn', false);
  }
}

/* ─────────────────────────────────────────────────────────────
   REGISTER HANDLER
   ───────────────────────────────────────────────────────────── */
async function handleRegister(event) {
  event.preventDefault();
  if (AuthState.isLoading) return;

  hideAlert('registerAlert');

  const usernameOk   = validateUsername();
  const passwordOk   = validatePassword();
  const confirmOk    = validateConfirmPassword();
  const departmentOk = validateDepartment();

  if (!usernameOk || !passwordOk || !confirmOk || !departmentOk) return;

  const username   = document.getElementById('regUsername').value.trim();
  const password   = document.getElementById('regPassword').value;
  const department = document.getElementById('regDepartment').value;

  setLoading('registerBtn', true);

  try {
    // Fetch all rows and check for duplicate username locally
    const existing = await sheetGetAll();

    const isDuplicate = existing.some(row => {
      const rowUser = String(row[CONFIG.COL_USERNAME] || '').trim();
      return rowUser.toLowerCase() === username.toLowerCase();
    });

    if (isDuplicate) {
      showAlert('registerAlert', 'This username is already taken. Please choose another.', 'error');
      showFieldError(
        document.getElementById('regUsername'),
        document.getElementById('regUsernameErr'),
        'Username is already taken.'
      );
      return;
    }

    // Append new row — keys must match sheet column headers exactly
    const newRow = {
      [CONFIG.COL_USERNAME]:   username,
      [CONFIG.COL_PASSWORD]:   password,
      [CONFIG.COL_DEPARTMENT]: department,
    };

    await sheetAppend(newRow);

    // Success
    showAlert('registerAlert', `Account created! Welcome, ${sanitizeHTML(username)}. You can now sign in.`, 'success');

    // Reset form
    document.getElementById('registerForm').reset();
    document.getElementById('pwStrength').className    = 'pw-strength';
    document.getElementById('pwStrengthFill').style.width = '0%';
    document.getElementById('pwStrengthLabel').textContent = '';

    ['regUsername', 'regPassword', 'regConfirmPassword', 'regDepartment'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('is-valid', 'is-invalid');
    });

    // Auto-switch to login and pre-fill username after 2.5s
    setTimeout(() => {
      switchTab('login');
      const loginUser = document.getElementById('loginUsername');
      loginUser.value = username;
      loginUser.dispatchEvent(new Event('input'));
    }, 2500);

  } catch (err) {
    showAlert('registerAlert', err.message || 'Connection error. Please try again.', 'error');
    console.error('[SOLE MATRIX] Register error:', err);
  } finally {
    setLoading('registerBtn', false);
  }
}

/* ─────────────────────────────────────────────────────────────
   SUCCESS MODAL
   ───────────────────────────────────────────────────────────── */
function showSuccessModal(username, department) {
  const modal      = document.getElementById('successModal');
  const body       = document.getElementById('modalBody');
  const badge      = document.getElementById('modalDeptBadge');
  const loaderFill = document.getElementById('loaderFill');

  body.textContent = `Welcome back, ${username}. Redirecting to dashboard…`;
  badge.innerHTML  = `<i class="fa-solid fa-building" aria-hidden="true"></i> ${sanitizeHTML(department)}`;

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  modal.focus();

  // Kick off the progress bar animation
  requestAnimationFrame(() => {
    loaderFill.style.width = '100%';
  });

  // Redirect after bar fills (2.5s transition + small buffer)
  setTimeout(() => {
    window.location.href = getDashboardURL(department);
  }, 2700);
}

/* ─────────────────────────────────────────────────────────────
   UTILITY
   ───────────────────────────────────────────────────────────── */
function shakeCard() {
  const card = document.getElementById('authCard');
  card.style.animation = 'none';
  card.offsetHeight; // force reflow
  card.style.animation = '';
}

/**
 * Returns the correct dashboard URL based on the user's department.
 * Add more departments here as the app grows.
 */
function getDashboardURL(department) {
  const map = {
    'Outsole Production':  'outsole-dashboard.html',
    'Warehouse & Logistics': 'warehouse-dashboard.html',
    'Warehouse &amp; Logistics': 'warehouse-dashboard.html', // HTML-encoded variant
    'HR Department': 'hr-dashboard.html',
    'Management': 'management-dashboard.html',
    'Desma Department': 'desma-dashboard.html',
  };
  const dept = (department || '').trim();
  const key = Object.keys(map).find(
    k => k.toLowerCase() === dept.toLowerCase()
  );
  return key ? map[key] : 'dashboard.html';
}

// Escape key closes the modal (useful during development)
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const modal = document.getElementById('successModal');
  if (modal && !modal.classList.contains('hidden')) {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    const fill = document.getElementById('loaderFill');
    if (fill) fill.style.width = '0%';
  }
});
