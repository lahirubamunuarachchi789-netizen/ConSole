/* ═══════════════════════════════════════════════════════════════
   DESMA DEPARTMENT DASHBOARD — JavaScript
   Concord Footwear (Pvt) Ltd
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   INITIALIZATION
   ───────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  initDashboard();
  startClock();
});

/* ─────────────────────────────────────────────────────────────
   AUTHENTICATION CHECK
   ───────────────────────────────────────────────────────────── */
function checkAuth() {
  const user = sessionStorage.getItem('sm_user');
  const dept = sessionStorage.getItem('sm_dept');

  if (!user || !dept) {
    window.location.href = 'index.html';
    return;
  }

  // Verify department access
  if (dept !== 'Desma Department') {
    alert('Access denied. This dashboard is for Desma Department only.');
    window.location.href = 'index.html';
    return;
  }
}

/* ─────────────────────────────────────────────────────────────
   DASHBOARD INITIALIZATION
   ───────────────────────────────────────────────────────────── */
function initDashboard() {
  const user = sessionStorage.getItem('sm_user');
  
  // Update user name displays
  const userNameEl = document.getElementById('userName');
  const dashUserNameEl = document.getElementById('dashUserName');
  if (userNameEl) userNameEl.textContent = user;
  if (dashUserNameEl) dashUserNameEl.textContent = user;

  // Update greeting based on time
  updateGreeting();

  // Update today's date
  updateTodayDate();

  // Generate user avatar
  generateAvatar(user);
}

/* ─────────────────────────────────────────────────────────────
   GREETING
   ───────────────────────────────────────────────────────────── */
function updateGreeting() {
  const hour = new Date().getHours();
  let greeting = 'Good morning';
  
  if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
  else if (hour >= 17) greeting = 'Good evening';

  const greetingEl = document.getElementById('dashGreeting');
  if (greetingEl) greetingEl.textContent = `${greeting},`;
}

/* ─────────────────────────────────────────────────────────────
   CLOCK
   ───────────────────────────────────────────────────────────── */
function startClock() {
  updateClock();
  setInterval(updateClock, 1000);
}

function updateClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const clockEl = document.getElementById('topbarClock');
  if (clockEl) clockEl.textContent = timeStr;
}

/* ─────────────────────────────────────────────────────────────
   TODAY'S DATE
   ───────────────────────────────────────────────────────────── */
function updateTodayDate() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const dateEl = document.getElementById('topbarDate');
  const statTodayEl = document.getElementById('statToday');
  
  if (dateEl) dateEl.textContent = dateStr;
  if (statTodayEl) {
    statTodayEl.textContent = now.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
}

/* ─────────────────────────────────────────────────────────────
   USER AVATAR
   ───────────────────────────────────────────────────────────── */
function generateAvatar(username) {
  const avatarEl = document.getElementById('userAvatar');
  if (!avatarEl || !username) return;

  const initial = username.charAt(0).toUpperCase();
  avatarEl.textContent = initial;
}

/* ─────────────────────────────────────────────────────────────
   LOGOUT
   ───────────────────────────────────────────────────────────── */
function handleLogout() {
  if (confirm('Are you sure you want to sign out?')) {
    sessionStorage.clear();
    window.location.href = 'index.html';
  }
}

/* ─────────────────────────────────────────────────────────────
   OPEN DESMA IN MODULE
   ───────────────────────────────────────────────────────────── */
function openDesmaIn() {
  const overlay = document.getElementById('moduleOverlay');
  const container = document.getElementById('moduleContainer');
  const titleEl = document.getElementById('moduleTitle');
  const bodyEl = document.getElementById('moduleBody');

  if (!overlay || !container || !titleEl || !bodyEl) return;

  titleEl.innerHTML = `
    <i class="fa-solid fa-box-open" style="
      background: linear-gradient(135deg, #8b5cf6, #14b8a6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    "></i>
    Desma In
  `;

  initDesmaInModule(bodyEl);

  overlay.classList.remove('hidden');
  container.classList.add('active');

  document.addEventListener('keydown', handleEscapeKey);
}

/* ─────────────────────────────────────────────────────────────
   OPEN OUTSOLE RETURN MODULE
   ───────────────────────────────────────────────────────────── */
function openDesmaReturn() {
  const overlay = document.getElementById('moduleOverlay');
  const container = document.getElementById('moduleContainer');
  const titleEl = document.getElementById('moduleTitle');
  const bodyEl = document.getElementById('moduleBody');

  if (!overlay || !container || !titleEl || !bodyEl) return;

  titleEl.innerHTML = `
    <i class="fa-solid fa-rotate-left" style="
      background: linear-gradient(135deg, #14b8a6, #8b5cf6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    "></i>
    Outsole Return
  `;

  initDesmaReturnModule(bodyEl);

  overlay.classList.remove('hidden');
  container.classList.add('active');

  document.addEventListener('keydown', handleEscapeKey);
}

/* ─────────────────────────────────────────────────────────────
   CLOSE MODULE
   ───────────────────────────────────────────────────────────── */
function closeModule() {
  const overlay = document.getElementById('moduleOverlay');
  const container = document.getElementById('moduleContainer');

  if (overlay && container) {
    container.classList.remove('active');
    setTimeout(() => {
      overlay.classList.add('hidden');
    }, 300);
  }

  if (typeof destroyDesmaInModule === 'function') destroyDesmaInModule();
  if (typeof destroyDesmaReturnModule === 'function') destroyDesmaReturnModule();

  const bodyEl = document.getElementById('moduleBody');
  if (bodyEl) bodyEl.innerHTML = '';

  document.removeEventListener('keydown', handleEscapeKey);
}

/* ─────────────────────────────────────────────────────────────
   ESCAPE KEY HANDLER
   ───────────────────────────────────────────────────────────── */
function handleEscapeKey(event) {
  if (event.key === 'Escape') {
    closeModule();
  }
}

/* ─────────────────────────────────────────────────────────────
   KEYBOARD ACCESSIBILITY
   ───────────────────────────────────────────────────────────── */
document.addEventListener('keydown', (event) => {
  // Allow Tab navigation
  if (event.key === 'Tab') return;
  
  // Close module on Escape (handled by handleEscapeKey when module is open)
});

const moduleOverlay = document.getElementById('moduleOverlay');
if (moduleOverlay) {
  moduleOverlay.addEventListener('click', (e) => {
    if (e.target === moduleOverlay) closeModule();
  });
}

console.log('[Desma Dashboard] Initialized successfully');
