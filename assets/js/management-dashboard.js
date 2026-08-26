/* ═══════════════════════════════════════════════════════════════
   SOLE MATRIX — MANAGEMENT DASHBOARD
   Concord Footwear (Pvt) Ltd
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   STATE & CONSTANTS
   ───────────────────────────────────────────────────────────── */
const ManagementState = {
  currentUser: null,
  currentDept: null,
  currentModule: null,
  _gatepassLoadTid: null,
};

/* ─────────────────────────────────────────────────────────────
   INITIALISATION
   ───────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  checkAuthentication();
  initDashboard();
  initClock();
  initLogoutModal();
});

/* ─────────────────────────────────────────────────────────────
   AUTHENTICATION CHECK
   ───────────────────────────────────────────────────────────── */
function checkAuthentication() {
  const user = sessionStorage.getItem('sm_user');
  const dept = sessionStorage.getItem('sm_dept');

  if (!user || !dept) {
    window.location.href = 'index.html';
    return;
  }

  // Verify user is from Management
  if (dept.toLowerCase() !== 'management') {
    alert('Access denied. This dashboard is for Management only.');
    window.location.href = 'index.html';
    return;
  }

  ManagementState.currentUser = user;
  ManagementState.currentDept = dept;
}

/* ─────────────────────────────────────────────────────────────
   DASHBOARD INITIALISATION
   ───────────────────────────────────────────────────────────── */
function initDashboard() {
  updateUserInfo();
  updateGreeting();
  updateStatToday();
}

function updateUserInfo() {
  const userName = document.getElementById('userName');
  const dashUserName = document.getElementById('dashUserName');
  const userAvatar = document.getElementById('userAvatar');

  if (userName) userName.textContent = ManagementState.currentUser;
  if (dashUserName) dashUserName.textContent = ManagementState.currentUser;
  
  if (userAvatar) {
    const initial = ManagementState.currentUser.charAt(0).toUpperCase();
    userAvatar.textContent = initial;
    userAvatar.style.background = generateAvatarGradient(initial);
  }
}

function updateGreeting() {
  const greetingEl = document.getElementById('dashGreeting');
  if (!greetingEl) return;

  const hour = new Date().getHours();
  let greeting = 'Good morning';
  
  if (hour >= 12 && hour < 17) {
    greeting = 'Good afternoon';
  } else if (hour >= 17) {
    greeting = 'Good evening';
  }

  greetingEl.textContent = `${greeting},`;
}

function updateStatToday() {
  const statToday = document.getElementById('statToday');
  if (!statToday) return;

  const options = { weekday: 'short', month: 'short', day: 'numeric' };
  const today = new Date().toLocaleDateString('en-US', options);
  statToday.textContent = today;
}

function generateAvatarGradient(letter) {
  const colors = [
    'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    'linear-gradient(135deg, #fbbf24 0%, #f97316 100%)',
    'linear-gradient(135deg, #fb923c 0%, #ea580c 100%)',
    'linear-gradient(135deg, #fcd34d 0%, #f59e0b 100%)',
    'linear-gradient(135deg, #fde047 0%, #fb923c 100%)',
    'linear-gradient(135deg, #facc15 0%, #ea580c 100%)',
  ];
  const code = letter.charCodeAt(0);
  return colors[code % colors.length];
}

/* ─────────────────────────────────────────────────────────────
   CLOCK & DATE
   ───────────────────────────────────────────────────────────── */
function initClock() {
  updateClock();
  setInterval(updateClock, 1000);
}

function updateClock() {
  const clockEl = document.getElementById('topbarClock');
  const dateEl = document.getElementById('topbarDate');

  if (clockEl) {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    clockEl.textContent = `${hours}:${minutes}:${seconds}`;
  }

  if (dateEl) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateEl.textContent = new Date().toLocaleDateString('en-US', options);
  }
}

/* ─────────────────────────────────────────────────────────────
   MODULE NAVIGATION
   ───────────────────────────────────────────────────────────── */
function openModule(moduleType) {
  const modal = document.getElementById('moduleModal');
  const modalCard = document.getElementById('moduleModalCard');
  const modalIcon = document.getElementById('modalIcon');
  const modalLabel = document.getElementById('modalLabel');
  const modalTitle = document.getElementById('modalModuleTitle');
  const modalBody = document.getElementById('modalBody');

  ManagementState.currentModule = moduleType;

  // Module meta (deferred content builder: only invoke getGatepassContent for the module being opened)
  const moduleMeta = {
    'gatepass': {
      icon: '<i class="fa-solid fa-clipboard-check"></i>',
      label: 'Executive Module 01',
      title: 'Pending Gatepass Approvals',
      theme: 'management-icon-gatepass',
      mode:  'all',
    },
  };

  const meta = moduleMeta[moduleType];
  if (!meta) {
    console.error('[Management Dashboard] Unknown module:', moduleType);
    return;
  }

  const module = {
    ...meta,
    content: getGatepassContent(meta.mode),
  };

  // Set modal content
  modalIcon.innerHTML = module.icon;
  modalIcon.className = `module-modal-icon ${module.theme}`;
  modalLabel.textContent = module.label;
  modalTitle.textContent = module.title;
  modalBody.innerHTML = module.content;

  // Show modal
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  modal.focus();

  // Add animation
  requestAnimationFrame(() => {
    modalCard.style.transform = 'scale(1)';
    modalCard.style.opacity = '1';
  });
}

function closeModule() {
  const modal = document.getElementById('moduleModal');
  const modalCard = document.getElementById('moduleModalCard');

  modalCard.style.transform = 'scale(0.95)';
  modalCard.style.opacity = '0';

  setTimeout(() => {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    ManagementState.currentModule = null;
  }, 200);
}

/* ─────────────────────────────────────────────────────────────
   MODULE CONTENT — GATEPASS
   mode: 'storse' (Storse To GFU Gatepass) or 'desma' (Desma In Gatepass)
   ───────────────────────────────────────────────────────────── */
function getGatepassContent(mode) {
  const useMode = (mode === 'all' || GATEPASS_VALID_MODES.includes(mode)) ? mode : 'all';
  const labels = {
    all:         'All Pending Gatepasses',
    storse:      'Storse → GFU Gatepass',
    desma:       'Desma In Gatepass',
    desmaReturn: 'Outsole Return Gatepass',
  };

  // Debounce: clear any previously-scheduled load so fast module switches don't race
  if (ManagementState._gatepassLoadTid) {
    clearTimeout(ManagementState._gatepassLoadTid);
    ManagementState._gatepassLoadTid = null;
  }
  const expectedModule = ManagementState.currentModule;
  ManagementState._gatepassLoadTid = setTimeout(() => {
    // Guard: only run if the user hasn't since switched to a different module
    if (ManagementState.currentModule !== expectedModule) {
      console.log('[Management Dashboard] Skipping stale gatepass load; module changed');
      return;
    }
    loadGatepassModule(useMode);
  }, 100);

  return `
    <div class="loading-container">
      <div class="spinner"></div>
      <div class="loading-text">Loading ${sanitizeHTML(labels[useMode] || 'pending gatepasses')}...</div>
    </div>
  `;
}

/* ─────────────────────────────────────────────────────────────
   LOGOUT FUNCTIONALITY
   ───────────────────────────────────────────────────────────── */
function initLogoutModal() {
  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const logoutModal = document.getElementById('logoutModal');
      const moduleModal = document.getElementById('moduleModal');
      
      if (logoutModal && !logoutModal.classList.contains('hidden')) {
        cancelLogout();
      }
      if (moduleModal && !moduleModal.classList.contains('hidden')) {
        closeModule();
      }
    }
  });
}

function handleLogout() {
  const modal = document.getElementById('logoutModal');
  if (!modal) return;

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  modal.focus();
}

function cancelLogout() {
  const modal = document.getElementById('logoutModal');
  if (!modal) return;

  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

function confirmLogout() {
  sessionStorage.removeItem('sm_user');
  sessionStorage.removeItem('sm_dept');
  sessionStorage.removeItem('sm_login');
  window.location.href = 'index.html';
}

/* ─────────────────────────────────────────────────────────────
   UTILITY FUNCTIONS
   ───────────────────────────────────────────────────────────── */
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function sanitizeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ─────────────────────────────────────────────────────────────
   CSS ADDITIONS FOR MODULE CONTENT
   ───────────────────────────────────────────────────────────── */
const moduleStyles = document.createElement('style');
moduleStyles.textContent = `
  .module-content-wrapper {
    padding: 1rem;
  }

  .module-info-box.executive {
    background: rgba(245, 158, 11, 0.1);
    border-color: rgba(245, 158, 11, 0.3);
  }

  .module-info-box.executive i {
    color: var(--mgmt-primary);
  }

  .management-placeholder {
    background: linear-gradient(135deg, #f59e0b, #d97706);
    box-shadow: 0 8px 24px rgba(245, 158, 11, 0.4);
  }

  .placeholder-list i {
    color: #fbbf24;
  }

  .status-badge.urgent-badge {
    background: rgba(220, 38, 38, 0.15);
    color: #dc2626;
    border: 1px solid rgba(220, 38, 38, 0.4);
    animation: pulse-urgent 2s ease-in-out infinite;
  }

  .status-badge.pending-mgmt {
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .status-badge.approved-mgmt {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  @keyframes pulse-urgent {
    0%, 100% {
      transform: scale(1);
      box-shadow: 0 0 15px rgba(220, 38, 38, 0.3);
    }
    50% {
      transform: scale(1.05);
      box-shadow: 0 0 25px rgba(220, 38, 38, 0.5);
    }
  }

  .btn-module-action.mgmt-action {
    background: linear-gradient(135deg, #f59e0b, #d97706);
    box-shadow: 0 4px 16px rgba(245, 158, 11, 0.4);
  }

  .btn-module-action.mgmt-action:hover {
    box-shadow: 0 6px 24px rgba(245, 158, 11, 0.6);
  }
`;
document.head.appendChild(moduleStyles);

console.log('[SOLE MATRIX] Management Dashboard initialized successfully');
