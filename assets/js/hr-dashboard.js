/* ═══════════════════════════════════════════════════════════════
   SOLE MATRIX — HR DEPARTMENT DASHBOARD
   Concord Footwear (Pvt) Ltd
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   STATE & CONSTANTS
   ───────────────────────────────────────────────────────────── */
const HRState = {
  currentUser: null,
  currentDept: null,
  currentModule: null,
  pendingGatepassCount: 0,
  pendingTransportCount: 0,
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

  // Verify user is from HR Department
  if (dept.toLowerCase() !== 'hr department') {
    alert('Access denied. This dashboard is for HR Department only.');
    window.location.href = 'index.html';
    return;
  }

  HRState.currentUser = user;
  HRState.currentDept = dept;
}

/* ─────────────────────────────────────────────────────────────
   DASHBOARD INITIALISATION
   ───────────────────────────────────────────────────────────── */
function initDashboard() {
  updateUserInfo();
  updateGreeting();
  updateStatToday();
  loadPendingGatepassCount();
  loadPendingTransportCount();
}

function updateUserInfo() {
  const userName = document.getElementById('userName');
  const dashUserName = document.getElementById('dashUserName');
  const userAvatar = document.getElementById('userAvatar');

  if (userName) userName.textContent = HRState.currentUser;
  if (dashUserName) dashUserName.textContent = HRState.currentUser;
  
  if (userAvatar) {
    const initial = HRState.currentUser.charAt(0).toUpperCase();
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
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
    'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
    'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
  ];
  const code = letter.charCodeAt(0);
  return colors[code % colors.length];
}

/* ─────────────────────────────────────────────────────────────
   LOAD PENDING GATEPASS COUNT — from BOTH Storse and Desma tabs
   ───────────────────────────────────────────────────────────── */
async function loadPendingGatepassCount() {
  try {
    const all = await hrFetchAllTabs();
    const pendingCount = all.filter(row => {
      const status = String(row['Status'] || '').trim();
      return status === 'Pending To HR';
    }).length;

    HRState.pendingGatepassCount = pendingCount;
    updatePendingGatepassBadge(pendingCount);

  } catch (error) {
    console.error('Error loading pending gatepass count:', error);
  }
}

function updatePendingGatepassBadge(count) {
  const badge = document.querySelector('.hr-card-gatepass .badge-count');
  if (badge) {
    badge.textContent = count;
  }
}

/* ─────────────────────────────────────────────────────────────
   LOAD PENDING TRANSPORT COUNT — from BOTH Storse and Desma tabs
   ───────────────────────────────────────────────────────────── */
async function loadPendingTransportCount() {
  try {
    const all = await hrFetchAllTabs();
    const pendingCount = all.filter(row => {
      const status = String(row['Status'] || '').trim();
      return status === 'Pending To Transport';
    }).length;

    HRState.pendingTransportCount = pendingCount;
    updatePendingTransportBadge(pendingCount);

  } catch (error) {
    console.error('Error loading pending transport count:', error);
  }
}

function updatePendingTransportBadge(count) {
  const badge = document.querySelector('.hr-card-transport .badge-count');
  if (badge) {
    badge.textContent = count;
  }
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

  HRState.currentModule = moduleType;

  // Module configurations
  const modules = {
    'gatepass': {
      icon: '<i class="fa-solid fa-id-card-clip"></i>',
      label: 'HR Module 01',
      title: 'Pending Gatepass',
      theme: 'hr-icon-gatepass',
      content: getGatepassContent(),
    },
    'transportation': {
      icon: '<i class="fa-solid fa-van-shuttle"></i>',
      label: 'HR Module 02',
      title: 'Transportation',
      theme: 'hr-icon-transport',
      content: getTransportationContent(),
    },
  };

  const module = modules[moduleType];
  if (!module) {
    console.error('[HR Dashboard] Unknown module:', moduleType);
    return;
  }

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
    HRState.currentModule = null;
  }, 200);
}

/* ─────────────────────────────────────────────────────────────
   MODULE CONTENT — GATEPASS
   ───────────────────────────────────────────────────────────── */
function getGatepassContent() {
  // Load gatepasses when content is rendered
  setTimeout(() => loadHRGatepasses(), 100);
  
  return `
    <div class="module-content-wrapper">
      <div class="module-info-box">
        <i class="fa-solid fa-info-circle"></i>
        <p>Review and approve employee gatepass requests pending HR approval.</p>
      </div>

      <div id="hrGatepassContainer" class="hr-gatepass-container">
        <div class="loading-spinner">
          <i class="fa-solid fa-spinner fa-spin"></i>
          <p>Loading gatepasses...</p>
        </div>
      </div>
    </div>
  `;
}

/* ─────────────────────────────────────────────────────────────
   MODULE CONTENT — TRANSPORTATION
   ───────────────────────────────────────────────────────────── */
function getTransportationContent() {
  // Load transportation gatepasses when content is rendered
  setTimeout(() => loadTransportGatepasses(), 100);
  
  return `
    <div class="module-content-wrapper">
      <div class="module-info-box">
        <i class="fa-solid fa-info-circle"></i>
        <p>Manage vehicle assignments for approved gatepasses. Assign vehicles and drivers for transportation.</p>
      </div>

      <div id="transportGatepassContainer" class="transport-gatepass-container">
        <div class="loading-spinner">
          <i class="fa-solid fa-spinner fa-spin"></i>
          <p>Loading gatepasses...</p>
        </div>
      </div>
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
// Note: These styles are inline for the module content
const moduleStyles = document.createElement('style');
moduleStyles.textContent = `
  .module-content-wrapper {
    padding: 1rem;
  }

  .module-info-box {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: rgba(124, 58, 237, 0.1);
    border: 1px solid rgba(124, 58, 237, 0.3);
    border-radius: 8px;
    margin-bottom: 2rem;
    color: var(--text-primary);
  }

  .module-info-box i {
    font-size: 1.5rem;
    color: var(--hr-primary);
  }

  .module-placeholder {
    text-align: center;
    padding: 2rem 1rem;
  }

  .placeholder-icon {
    width: 80px;
    height: 80px;
    margin: 0 auto 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #8b5cf6, #7c3aed);
    border-radius: 20px;
    font-size: 2.5rem;
    color: #fff;
    box-shadow: 0 8px 24px rgba(139, 92, 246, 0.4);
  }

  .transport-icon {
    background: linear-gradient(135deg, #14b8a6, #06b6d4);
    box-shadow: 0 8px 24px rgba(20, 184, 166, 0.4);
  }

  .placeholder-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 1rem;
  }

  .placeholder-text {
    font-size: 1rem;
    color: var(--text-secondary);
    margin-bottom: 1.5rem;
  }

  .placeholder-list {
    text-align: left;
    max-width: 500px;
    margin: 0 auto 2rem;
    list-style: none;
    padding: 0;
  }

  .placeholder-list li {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 0;
    color: var(--text-primary);
  }

  .placeholder-list i {
    color: #10b981;
    font-size: 1.1rem;
  }

  .placeholder-status {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-bottom: 2rem;
    flex-wrap: wrap;
  }

  .status-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    border-radius: 12px;
    font-weight: 600;
    font-size: 0.9rem;
  }

  .status-badge.pending {
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .status-badge.approved {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .status-badge.active-routes {
    background: rgba(20, 184, 166, 0.15);
    color: #14b8a6;
    border: 1px solid rgba(20, 184, 166, 0.3);
  }

  .status-badge.vehicles {
    background: rgba(6, 182, 212, 0.15);
    color: #06b6d4;
    border: 1px solid rgba(6, 182, 212, 0.3);
  }

  .btn-module-action {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 2rem;
    background: linear-gradient(135deg, #8b5cf6, #7c3aed);
    color: #fff;
    border: none;
    border-radius: 12px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 16px rgba(139, 92, 246, 0.4);
  }

  .btn-module-action:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 24px rgba(139, 92, 246, 0.6);
  }

  .btn-module-action.transport-action {
    background: linear-gradient(135deg, #14b8a6, #06b6d4);
    box-shadow: 0 4px 16px rgba(20, 184, 166, 0.4);
  }

  .btn-module-action.transport-action:hover {
    box-shadow: 0 6px 24px rgba(20, 184, 166, 0.6);
  }
`;
document.head.appendChild(moduleStyles);

/* ─────────────────────────────────────────────────────────────
   HR GATEPASS MANAGEMENT
   ───────────────────────────────────────────────────────────── */

/* ── Multi-tab URL map (Storse To GFU + Desma In + Desma Return) ── */
const HR_TAB_URLS = {
  storse: (typeof CONFIG !== 'undefined' && CONFIG.SHEETBEST_STORSE_TO_GFU_GATEPASS_URL)
    ? CONFIG.SHEETBEST_STORSE_TO_GFU_GATEPASS_URL
    : 'https://api.sheetbest.com/sheets/dd583123-5c7c-4279-8303-2aea56b7c8aa/tabs/Storse To GFU Gatepass',
  desma:  (typeof CONFIG !== 'undefined' && CONFIG.SHEETBEST_DESMA_IN_GATEPASS_URL)
    ? CONFIG.SHEETBEST_DESMA_IN_GATEPASS_URL
    : 'https://api.sheetbest.com/sheets/dd583123-5c7c-4279-8303-2aea56b7c8aa/tabs/Desma In Gatepass',
  desmaReturn: (typeof CONFIG !== 'undefined' && CONFIG.SHEETBEST_DESMA_RETURN_GATEPASS_URL)
    ? CONFIG.SHEETBEST_DESMA_RETURN_GATEPASS_URL
    : 'https://api.sheetbest.com/sheets/dd583123-5c7c-4279-8303-2aea56b7c8aa/tabs/Desma Return Gatepass',
};
const HR_TAB_LABELS = {
  storse: 'Outsole Production',
  desma:  'Desma Department',
  desmaReturn: 'Desma Outsole Return',
};
const HR_TIMEOUT = 15000;

/* Management-approval column headers — ALL gatepass sheets (Storse To GFU,
   Desma In AND Desma Return) carry the "Manegement" typo in columns F/G/H,
   so the keys must match that spelling exactly. */
function hrMgmtFields(tabKey) {
  return {
    USER: 'Approved Manegement User',
    DATE: 'Manegement Approve Date',
    TIME: 'Manegement Approve Time',
  };
}

/* Department badge colour per source tab */
function hrDeptBadgeColor(tabKey) {
  if (tabKey === 'desmaReturn') {
    return 'background:rgba(20,184,166,0.18);border:1px solid rgba(20,184,166,0.4);color:#2dd4bf;';
  }
  if (tabKey === 'desma') {
    return 'background:rgba(139,92,246,0.18);border:1px solid rgba(139,92,246,0.4);color:#a78bfa;';
  }
  return 'background:rgba(34,197,94,0.15);border:1px solid rgba(34,197,94,0.35);color:#4ade80;';
}

/* Full department label per source tab */
function hrDeptLabelFull(tabKey) {
  if (tabKey === 'desmaReturn') return 'Desma Department (Outsole Return)';
  if (tabKey === 'desma')       return 'Desma Department';
  return 'Outsole Production Department';
}

/**
 * Fetch rows from a single tab, tag each row with _sourceTab.
 * Returns [] on failure so the union still works if one tab is empty/missing.
 */
async function hrFetchTab(tabKey) {
  const url = HR_TAB_URLS[tabKey];
  if (!url) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HR_TIMEOUT);
  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn('[HR] Tab fetch failed:', tabKey, res.status);
      return [];
    }
    const rows = await res.json();
    if (!Array.isArray(rows)) return [];
    return rows.map(r => ({ ...r, _sourceTab: tabKey }));
  } catch (err) {
    clearTimeout(timer);
    console.warn('[HR] Tab fetch error:', tabKey, err);
    return [];
  }
}

/** Fetch & union rows from ALL tabs. */
async function hrFetchAllTabs() {
  const [rowsA, rowsB, rowsC] = await Promise.all([
    hrFetchTab('storse'),
    hrFetchTab('desma'),
    hrFetchTab('desmaReturn'),
  ]);
  return [...rowsA, ...rowsB, ...rowsC];
}

const HR_GATEPASS_CONFIG = {
  SHEET_URL: HR_TAB_URLS.storse, // backward compat – not used anymore
  TIMEOUT: HR_TIMEOUT,
};

const HRGatepassState = {
  gatepasses: [],
  currentGatepass: null,
};

/**
 * Fetch gatepasses with status "Pending To HR" — from BOTH tabs.
 */
async function fetchHRGatepasses() {
  try {
    const all = await hrFetchAllTabs();
    return all.filter(row => {
      const status = String(row['Status'] || '').trim();
      return status === 'Pending To HR';
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection.');
    }
    throw err;
  }
}

/**
 * Load and display HR gatepasses
 */
async function loadHRGatepasses() {
  const container = document.getElementById('hrGatepassContainer');
  if (!container) return;

  try {
    // Show loading state
    container.innerHTML = `
      <div class="loading-spinner">
        <i class="fa-solid fa-spinner fa-spin"></i>
        <p>Loading gatepasses...</p>
      </div>
    `;

    // Fetch gatepasses
    const gatepasses = await fetchHRGatepasses();
    HRGatepassState.gatepasses = gatepasses;

    // Render list
    container.innerHTML = renderHRGatepassList(gatepasses);

  } catch (error) {
    console.error('Error loading HR gatepasses:', error);
    container.innerHTML = `
      <div class="error-state">
        <div class="error-icon">
          <i class="fa-solid fa-exclamation-triangle"></i>
        </div>
        <p class="error-text">Failed to load gatepasses</p>
        <p class="error-detail">${sanitizeHTML(error.message)}</p>
        <button class="btn-retry" onclick="loadHRGatepasses()">
          <i class="fa-solid fa-rotate-right"></i>
          <span>Try Again</span>
        </button>
      </div>
    `;
  }
}

/**
 * Render HR gatepass list
 */
function renderHRGatepassList(gatepasses) {
  return `
    <div class="gatepass-header">
      <div class="gatepass-count">
        <strong>${gatepasses.length}</strong> Pending HR Approval${gatepasses.length !== 1 ? 's' : ''}
      </div>
      <button class="refresh-btn" onclick="loadHRGatepasses()">
        <i class="fa-solid fa-rotate-right"></i>
        <span>Refresh</span>
      </button>
    </div>
    
    ${gatepasses.length > 0 ? `
      <div class="gatepass-list">
        ${gatepasses.map((gp, index) => renderHRGatepassItem(gp, index)).join('')}
      </div>
    ` : `
      <div class="empty-state">
        <div class="empty-icon">
          <i class="fa-solid fa-clipboard-check"></i>
        </div>
        <p class="empty-text">No gatepasses pending HR approval</p>
        <p class="empty-subtext">All gatepasses have been processed</p>
      </div>
    `}
  `;
}

/**
 * Render single HR gatepass item
 */
function renderHRGatepassItem(gatepass, index) {
  let gatepassData = {};
  try {
    gatepassData = JSON.parse(gatepass['Rows_JSON'] || '{}');
  } catch (e) {
    console.error('Failed to parse gatepass JSON:', e);
    gatepassData = {};
  }

  const gatepassName = gatepass['Gatepass name'] || 'Unknown';
  const createdDate = gatepass['Created Date'] || '';
  const createdTime = gatepass['Created Time'] || '';
  const srcTab = gatepass._sourceTab || 'storse';
  const mgmtF = hrMgmtFields(srcTab);
  const approvedBy = gatepass[mgmtF.USER] || 'N/A';
  const deptLabel = HR_TAB_LABELS[srcTab] || 'Outsole Production';
  const deptBadgeColor = hrDeptBadgeColor(srcTab);

  return `
    <div class="gatepass-item hr-gatepass-item" onclick="viewHRGatepass(${index})">
      <!-- Department & status badges pinned to the top of the card -->
      <div class="gatepass-badges-row">
        <div class="gatepass-status-badge hr-pending-badge" style="${deptBadgeColor}">
          <i class="fa-solid fa-building"></i>
          <span>${sanitizeHTML(deptLabel)}</span>
        </div>
        <div class="gatepass-status-badge hr-pending-badge">
          <i class="fa-solid fa-clock"></i>
          <span>Pending HR</span>
        </div>
      </div>
      <div class="gatepass-main-row">
        <div class="gatepass-icon hr-gatepass-icon">
          <i class="fa-solid fa-id-card"></i>
        </div>
        <div class="gatepass-info">
          <div class="gatepass-name">${sanitizeHTML(gatepassName)}</div>
          <div class="gatepass-meta">
            <div class="gatepass-meta-item">
              <i class="fa-solid fa-user"></i>
              <span>${sanitizeHTML(gatepassData.GatepassName || 'N/A')}</span>
            </div>
            <div class="gatepass-meta-item">
              <i class="fa-solid fa-calendar"></i>
              <span>${sanitizeHTML(createdDate)}</span>
            </div>
            <div class="gatepass-meta-item">
              <i class="fa-solid fa-user-check"></i>
              <span>Approved by: ${sanitizeHTML(approvedBy)}</span>
            </div>
          </div>
        </div>
        <div class="gatepass-arrow">
          <i class="fa-solid fa-chevron-right"></i>
        </div>
      </div>
    </div>
  `;
}

/**
 * View HR gatepass preview
 */
function viewHRGatepass(index) {
  const gatepass = HRGatepassState.gatepasses[index];
  HRGatepassState.currentGatepass = gatepass;

  // Parse JSON data
  let gatepassData = {};
  try {
    gatepassData = JSON.parse(gatepass['Rows_JSON'] || '{}');
  } catch (e) {
    console.error('Failed to parse gatepass JSON:', e);
    alert('Error loading gatepass data');
    return;
  }

  // Create preview overlay
  const overlay = document.createElement('div');
  overlay.className = 'gatepass-preview-overlay hr-preview-overlay';
  overlay.id = 'hrGatepassPreview';
  overlay.innerHTML = renderHRGatepassPreview(gatepass, gatepassData);

  document.body.appendChild(overlay);

  // Animate in
  setTimeout(() => overlay.classList.add('active'), 10);

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeHRGatepassPreview();
  });

  // Close on Escape key
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeHRGatepassPreview();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

/**
 * Render HR gatepass preview
 */
function renderHRGatepassPreview(gatepass, data) {
  const gatepassName = gatepass['Gatepass name'] || 'Unknown';
  const createdDate = gatepass['Created Date'] || '';
  const createdTime = gatepass['Created Time'] || '';
  const srcTab = gatepass._sourceTab || 'storse';
  const mgmtF = hrMgmtFields(srcTab);
  const managementUser = gatepass[mgmtF.USER] || 'N/A';
  const managementDate = gatepass[mgmtF.DATE] || '';
  const managementTime = gatepass[mgmtF.TIME] || '';
  const deptLabel = HR_TAB_LABELS[srcTab] || 'Outsole Production';
  const deptLabelFull = hrDeptLabelFull(srcTab);

  const itemsTableHTML = buildHRItemsTable(data);

  return `
    <div class="gatepass-preview-container hr-preview-container">
      <div class="preview-header hr-preview-header">
        <div class="preview-title-section">
          <div class="preview-icon hr-preview-icon">
            <i class="fa-solid fa-id-card-clip"></i>
          </div>
          <div>
            <div class="preview-title">HR Gatepass Review</div>
            <div class="preview-subtitle">Approved by Management · ${sanitizeHTML(deptLabel)}</div>
          </div>
        </div>
        <button class="preview-close" onclick="closeHRGatepassPreview()">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="preview-body">
        <div class="gatepass-document">
          <!-- Document Header -->
          <div class="document-header">
            <div class="company-logo">
              <i class="fa-solid fa-shoe-prints"></i>
            </div>
            <div class="company-name">CONCORD FOOTWEAR (PVT) LTD</div>
            <div class="company-subtitle">${sanitizeHTML(deptLabelFull)}</div>
            <div class="document-title">GATEPASS — Production Tracking System</div>
          </div>

          <!-- Basic Info Grid -->
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">GATEPASS REFERENCE</div>
              <div class="info-value highlight">${sanitizeHTML(gatepassName)}</div>
            </div>
            <div class="info-item">
              <div class="info-label">DATE ISSUED</div>
              <div class="info-value">${sanitizeHTML(data.CreateDate || createdDate)}</div>
            </div>
            <div class="info-item">
              <div class="info-label">PREPARED BY</div>
              <div class="info-value">${sanitizeHTML(data.CreatedBy || 'N/A')}</div>
            </div>
            <div class="info-item">
              <div class="info-label">DEPARTMENT</div>
              <div class="info-value">${sanitizeHTML(data.Chanula || deptLabel.toUpperCase())}</div>
            </div>
          </div>

          <!-- Approval Info -->
          <div class="approval-info-section">
            <div class="approval-badge">
              <i class="fa-solid fa-check-circle"></i>
              <span>Management Approved</span>
            </div>
            <div class="approval-details">
              <div class="approval-item">
                <span class="approval-label">Approved By:</span>
                <span class="approval-value">${sanitizeHTML(managementUser)}</span>
              </div>
              <div class="approval-item">
                <span class="approval-label">Date:</span>
                <span class="approval-value">${sanitizeHTML(managementDate)}</span>
              </div>
              <div class="approval-item">
                <span class="approval-label">Time:</span>
                <span class="approval-value">${sanitizeHTML(managementTime)}</span>
              </div>
            </div>
          </div>

          <!-- Items Table -->
          ${itemsTableHTML}

          <!-- Status Footer -->
          <div class="document-footer">
            <div class="footer-section">
              <div class="footer-label">PREPARED BY:</div>
              <div class="footer-signature">
                <div class="signature-line">${sanitizeHTML(data.CreatedBy || 'N/A')}</div>
                <div class="signature-sublabel">Signature / Date</div>
              </div>
            </div>
            <div class="footer-section">
              <div class="footer-label">MANAGEMENT APPROVED:</div>
              <div class="footer-signature">
                <div class="signature-line">${sanitizeHTML(managementUser)}</div>
                <div class="signature-sublabel">${sanitizeHTML(managementDate)}</div>
              </div>
            </div>
            <div class="footer-section">
              <div class="footer-label">HR APPROVAL:</div>
              <div class="footer-signature">
                <div class="signature-line">_______________________</div>
                <div class="signature-sublabel">Pending</div>
              </div>
            </div>
          </div>

          <div class="document-note">
            <strong>Gatepass ID:</strong> ${sanitizeHTML(gatepassName)} — 
            <strong>Page 1</strong> — SOLE MATRIX — ${new Date().getFullYear()} — 
            <strong>CONCORD FOOTWEAR (PVT) LTD</strong> — CONFIDENTIAL
          </div>
        </div>
      </div>

      <div class="preview-footer hr-preview-footer">
        <button class="btn-preview btn-download" onclick="downloadHRGatepass()">
          <i class="fa-solid fa-download"></i>
          <span>Download</span>
        </button>
        <button class="btn-preview btn-reject" onclick="rejectHRGatepass()">
          <i class="fa-solid fa-times-circle"></i>
          <span>Reject</span>
        </button>
        <button class="btn-preview btn-approve hr-btn-approve" onclick="approveHRGatepass()">
          <i class="fa-solid fa-circle-check"></i>
          <span>Approve for Release</span>
        </button>
      </div>
    </div>
  `;
}

/**
 * Build items table for HR preview
 */
function buildHRItemsTable(data) {
  console.log('Building HR table with data:', data);
  
  // Extract items array
  let items = [];
  
  if (Array.isArray(data.Items)) {
    items = data.Items;
  } else if (Array.isArray(data.items)) {
    items = data.items;
  } else if (data.PO) {
    items = [data];
  }

  console.log('Extracted items:', items);

  if (items.length === 0) {
    return `
      <div class="items-section">
        <div class="section-title">ITEMS</div>
        <div class="empty-table">No items data available</div>
      </div>
    `;
  }

  // Check if Size is a simple value
  const hasSimpleSize = items.some(item => 
    typeof item.Size === 'string' || typeof item.Size === 'number'
  );

  if (hasSimpleSize) {
    // Simple table with Size and QTY columns
    let tableHTML = `
      <div class="items-section">
        <div class="section-title">ITEMS</div>
        <div class="items-table-wrapper">
          <table class="items-table">
            <thead>
              <tr>
                <th class="col-index">#</th>
                <th class="col-po">PO NUMBER</th>
                <th class="col-model">MODEL</th>
                <th class="col-colour">OUTSOLE<br/>COLOUR</th>
                <th class="col-size">SIZE</th>
                <th class="col-total">QTY</th>
              </tr>
            </thead>
            <tbody>
    `;

    let grandTotal = 0;
    items.forEach((item, index) => {
      const qty = parseInt(item.QTY || item.Qty || item.qty || 0);
      grandTotal += qty;

      tableHTML += `
        <tr>
          <td class="col-index">${index + 1}</td>
          <td class="col-po">${sanitizeHTML(item.PO || 'N/A')}</td>
          <td class="col-model">${sanitizeHTML(item.Model || 'N/A')}</td>
          <td class="col-colour">${sanitizeHTML(item.Outsole_Colour || 'N/A')}</td>
          <td class="col-size">${sanitizeHTML(item.Size || 'N/A')}</td>
          <td class="col-total"><strong>${qty}</strong></td>
        </tr>
      `;
    });

    tableHTML += `
      <tr class="grand-total-row">
        <td colspan="5" class="grand-total-label">GRAND TOTAL</td>
        <td class="col-total"><strong>${grandTotal}</strong></td>
      </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    return tableHTML;
  }

  // Complex table with multiple size columns
  const allSizes = new Set();
  items.forEach(item => {
    const qtyData = item.QTY || item.Qty || item.qty || {};
    
    if (qtyData && typeof qtyData === 'object') {
      Object.keys(qtyData).forEach(size => allSizes.add(size));
    }
  });
  
  const sizeColumns = Array.from(allSizes).sort((a, b) => {
    const numA = parseFloat(a);
    const numB = parseFloat(b);
    if (isNaN(numA) || isNaN(numB)) {
      return String(a).localeCompare(String(b));
    }
    return numA - numB;
  });

  let tableHTML = `
    <div class="items-section">
      <div class="section-title">ITEMS</div>
      <div class="items-table-wrapper">
        <table class="items-table">
          <thead>
            <tr>
              <th class="col-index">#</th>
              <th class="col-po">PO NUMBER</th>
              <th class="col-model">MODEL</th>
              <th class="col-colour">OUTSOLE<br/>COLOUR</th>
  `;

  sizeColumns.forEach(size => {
    tableHTML += `<th class="col-size">${sanitizeHTML(size)}</th>`;
  });

  tableHTML += `
              <th class="col-total">TOTAL<br/>QTY</th>
            </tr>
          </thead>
          <tbody>
  `;

  items.forEach((item, index) => {
    const qtyData = item.QTY || item.Qty || item.qty || {};
    
    tableHTML += `
      <tr>
        <td class="col-index">${index + 1}</td>
        <td class="col-po">${sanitizeHTML(item.PO || 'N/A')}</td>
        <td class="col-model">${sanitizeHTML(item.Model || 'N/A')}</td>
        <td class="col-colour">${sanitizeHTML(item.Outsole_Colour || 'N/A')}</td>
    `;

    let rowTotal = 0;
    sizeColumns.forEach(size => {
      const qty = qtyData[size];
      const qtyNum = parseInt(qty) || 0;
      rowTotal += qtyNum;
      tableHTML += `<td class="col-size">${qtyNum > 0 ? qtyNum : '-'}</td>`;
    });

    tableHTML += `
        <td class="col-total"><strong>${rowTotal}</strong></td>
      </tr>
    `;
  });

  tableHTML += `
    <tr class="grand-total-row">
      <td colspan="4" class="grand-total-label">GRAND TOTAL</td>
  `;

  let grandTotal = 0;
  sizeColumns.forEach(size => {
    let columnTotal = 0;
    items.forEach(item => {
      const qtyData = item.QTY || item.Qty || item.qty || {};
      if (qtyData[size]) {
        const qty = parseInt(qtyData[size]) || 0;
        columnTotal += qty;
        grandTotal += qty;
      }
    });
    tableHTML += `<td class="col-size"><strong>${columnTotal}</strong></td>`;
  });

  tableHTML += `
      <td class="col-total"><strong>${grandTotal}</strong></td>
    </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  return tableHTML;
}

/**
 * Close HR gatepass preview
 */
function closeHRGatepassPreview() {
  const overlay = document.getElementById('hrGatepassPreview');
  if (overlay) {
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 300);
  }
}

/**
 * Approve HR gatepass
 */
async function approveHRGatepass() {
  if (!HRGatepassState.currentGatepass) return;

  const confirmed = confirm('Are you sure you want to approve this gatepass?\n\nThis will send the gatepass to the Transport Department for processing.');
  
  if (!confirmed) return;

  try {
    // Show loading state
    const approveBtn = document.querySelector('.hr-btn-approve');
    if (approveBtn) {
      approveBtn.disabled = true;
      approveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Approving...</span>';
    }

    // Capture approving user, date, and time
    const hrUser = sessionStorage.getItem('sm_user') || 'Unknown';
    const now = new Date();
    const hrDate = now.toLocaleDateString('en-GB');
    const hrTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Update status to "Pending To Transport" and write HR approval metadata
    await updateHRGatepassStatus(HRGatepassState.currentGatepass, 'Pending To Transport', {
      'Approved HR User': hrUser,
      'HR Approve Date': hrDate,
      'HR Approve Time': hrTime,
    });

    closeHRGatepassPreview();
    await loadHRGatepasses();
    await loadPendingGatepassCount(); // Update badge count

    // ── Success + "Switch to WhatsApp" action (HR approval) ──
    if (typeof showWhatsAppActionPopup === 'function') {
      const gpName = HRGatepassState.currentGatepass?.['Gatepass name'] || '—';
      showWhatsAppActionPopup({
        title: 'Gatepass Approved!',
        subtitle: 'Status updated to "Pending To Transport" for transportation arrangement.',
        message: waMsg([
          '*SOLE MATRIX — Gatepass Approved by HR*',
          '',
          '📄 Gatepass: ' + gpName,
          '👤 Approved by: ' + hrUser + ' (HR Department)',
          '📅 Date: ' + hrDate + ' ' + hrTime,
          '📌 Status: Pending To Transport',
        ]),
        scenario: WA_SCENARIOS.GATEPASS_HR_APPROVED,
      });
    }

  } catch (error) {
    console.error('Error approving gatepass:', error);
    alert('Failed to approve gatepass. Please try again.\n\n' + error.message);
    
    const approveBtn = document.querySelector('.hr-btn-approve');
    if (approveBtn) {
      approveBtn.disabled = false;
      approveBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> <span>Approve for Release</span>';
    }
  }
}

/**
 * Reject HR gatepass
 */
async function rejectHRGatepass() {
  if (!HRGatepassState.currentGatepass) return;

  const reason = prompt('Please enter the reason for rejection:');
  
  if (!reason || reason.trim() === '') {
    alert('Rejection cancelled. A reason must be provided.');
    return;
  }

  try {
    const hrUser = sessionStorage.getItem('sm_user') || 'Unknown';
    const now = new Date();
    const hrDate = now.toLocaleDateString('en-GB');
    const hrTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    await updateHRGatepassStatus(HRGatepassState.currentGatepass, 'Rejected', {
      'Approved HR User': hrUser,
      'HR Approve Date': hrDate,
      'HR Approve Time': hrTime,
      'Rejection Reason': reason.trim(),
    });

    alert('✓ Gatepass rejected.\n\nThe gatepass has been marked as rejected.');

    closeHRGatepassPreview();
    await loadHRGatepasses();
    await loadPendingGatepassCount(); // Update badge count

  } catch (error) {
    console.error('Error rejecting gatepass:', error);
    alert('Failed to reject gatepass. Please try again.\n\n' + error.message);
  }
}

/**
 * Download HR gatepass as PDF
 */
function downloadHRGatepass() {
  if (!HRGatepassState.currentGatepass) return;

  try {
    const gatepassData = JSON.parse(HRGatepassState.currentGatepass['Rows_JSON'] || '{}');
    const gatepassName = HRGatepassState.currentGatepass['Gatepass name'] || 'gatepass';
    const createdDate = HRGatepassState.currentGatepass['Created Date'] || '';
    const srcTab = HRGatepassState.currentGatepass._sourceTab || 'storse';
    const mgmtF = hrMgmtFields(srcTab);
    const managementUser = HRGatepassState.currentGatepass[mgmtF.USER] || 'N/A';
    const managementDate = HRGatepassState.currentGatepass[mgmtF.DATE] || '';
    const managementTime = HRGatepassState.currentGatepass[mgmtF.TIME] || '';
    const deptLabel = HR_TAB_LABELS[srcTab] || 'Outsole Production';
    const deptLabelFull = hrDeptLabelFull(srcTab);

    // Check if jsPDF is available
    if (typeof window.jspdf === 'undefined') {
      alert('PDF library not loaded. Please refresh the page and try again.');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape orientation

    // Colors
    const hrPurple = [124, 58, 237];
    const hrPink = [236, 72, 153];
    const darkBlue = [13, 42, 87];
    const lightGray = [240, 240, 240];
    const white = [255, 255, 255];
    const green = [16, 185, 129];

    // Header Background - Purple gradient simulation
    doc.setFillColor(...hrPurple);
    doc.rect(0, 0, 297, 35, 'F');

    // Company Name
    doc.setTextColor(...white);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('CONCORD FOOTWEAR (PVT) LTD', 15, 15);

    // Subtitle
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(deptLabelFull, 15, 21);

    // Document Title (Right side)
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('GATEPASS', 245, 15);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('HR Approved - SOLE MATRIX', 220, 21);

    // HR Badge
    doc.setFillColor(...hrPurple);
    doc.roundedRect(240, 25, 42, 8, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...white);
    doc.text('HR DEPARTMENT', 261, 29.5, { align: 'center' });

    // Reset text color
    doc.setTextColor(0, 0, 0);

    // Info boxes
    const infoY = 42;
    const boxHeight = 12;
    
    // Gatepass Reference Box
    doc.setFillColor(...lightGray);
    doc.rect(15, infoY, 70, boxHeight, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('GATEPASS REFERENCE', 17, infoY + 4);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(gatepassName, 17, infoY + 9);

    // Date Box
    doc.setFillColor(...lightGray);
    doc.rect(88, infoY, 48, boxHeight, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('DATE ISSUED', 90, infoY + 4);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(createdDate, 90, infoY + 9);

    // Prepared By Box
    doc.setFillColor(...lightGray);
    doc.rect(139, infoY, 55, boxHeight, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('PREPARED BY', 141, infoY + 4);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(gatepassData.CreatedBy || 'N/A', 141, infoY + 9);

    // Department Box
    doc.setFillColor(...lightGray);
    doc.rect(197, infoY, 85, boxHeight, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('DEPARTMENT', 199, infoY + 4);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(deptLabel.toUpperCase(), 199, infoY + 9);

    // Management Approval Section - Clean light background
    const approvalY = 60;
    
    // Draw light green background box
    doc.setDrawColor(200, 200, 200); // Light gray border
    doc.setLineWidth(0.5);
    doc.setFillColor(245, 250, 245); // Very light mint green
    doc.roundedRect(15, approvalY, 267, 18, 2, 2, 'FD'); // Fill and Draw border
    
    // "Management Approved" badge
    doc.setFillColor(...green);
    doc.roundedRect(17, approvalY + 2, 50, 6, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...white);
    doc.text('✓ MANAGEMENT APPROVED', 42, approvalY + 5.5, { align: 'center' });

    // Approval details - Black text on light background
    doc.setTextColor(50, 50, 50); // Dark gray instead of pure black
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('APPROVED BY:', 17, approvalY + 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(managementUser, 17, approvalY + 16);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('APPROVAL DATE:', 90, approvalY + 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(managementDate, 90, approvalY + 16);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('APPROVAL TIME:', 160, approvalY + 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(managementTime, 160, approvalY + 16);

    // Build items table
    const items = extractHRItems(gatepassData);
    
    // Check if items have simple Size/QTY structure
    const hasSimpleSize = items.some(item => 
      typeof item.Size === 'string' || typeof item.Size === 'number'
    );

    let sizeColumns = [];
    let tableHeaders = [];
    let colWidths = [];
    
    if (hasSimpleSize) {
      tableHeaders = ['#', 'PO NUMBER', 'MODEL', 'OUTSOLE\nCOLOUR', 'SIZE', 'QTY'];
      colWidths = [10, 35, 40, 40, 20, 20];
    } else {
      sizeColumns = extractHRSizeColumns(items);
      tableHeaders = ['#', 'PO NUMBER', 'MODEL', 'OUTSOLE\nCOLOUR'];
      sizeColumns.forEach(size => tableHeaders.push(size));
      tableHeaders.push('TOTAL\nQTY');
      
      colWidths = [10, 35, 40, 40];
      sizeColumns.forEach(() => colWidths.push(15));
      colWidths.push(20);
    }

    const tableStartY = 84;

    // Calculate positions
    let xPos = 15;
    const colPositions = [xPos];
    colWidths.forEach(width => {
      xPos += width;
      colPositions.push(xPos);
    });

    // Draw table header
    doc.setFillColor(...hrPurple);
    doc.rect(15, tableStartY, colPositions[colPositions.length - 1] - 15, 12, 'F');

    doc.setTextColor(...white);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');

    tableHeaders.forEach((header, i) => {
      const textLines = header.split('\n');
      const startX = colPositions[i] + colWidths[i] / 2;
      if (textLines.length > 1) {
        doc.text(textLines[0], startX, tableStartY + 5, { align: 'center' });
        doc.text(textLines[1], startX, tableStartY + 9, { align: 'center' });
      } else {
        doc.text(header, startX, tableStartY + 7, { align: 'center' });
      }
    });

    // Draw table rows
    let currentY = tableStartY + 12;
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    if (hasSimpleSize) {
      items.forEach((item, index) => {
        if (index % 2 === 0) {
          doc.setFillColor(250, 250, 250);
          doc.rect(15, currentY, colPositions[colPositions.length - 1] - 15, 8, 'F');
        }

        doc.text(String(index + 1), colPositions[0] + colWidths[0] / 2, currentY + 5.5, { align: 'center' });
        doc.text(item.PO || 'N/A', colPositions[1] + 2, currentY + 5.5);
        doc.text(item.Model || 'N/A', colPositions[2] + 2, currentY + 5.5);
        doc.text(item.Outsole_Colour || 'N/A', colPositions[3] + colWidths[3] / 2, currentY + 5.5, { align: 'center' });
        doc.text(String(item.Size || 'N/A'), colPositions[4] + colWidths[4] / 2, currentY + 5.5, { align: 'center' });
        
        const qty = parseInt(item.QTY || item.Qty || item.qty || 0);
        doc.setFont('helvetica', 'bold');
        doc.text(String(qty), colPositions[5] + colWidths[5] / 2, currentY + 5.5, { align: 'center' });
        doc.setFont('helvetica', 'normal');

        currentY += 8;
      });
    } else {
      items.forEach((item, index) => {
        const qtyData = item.QTY || item.Qty || item.qty || {};
        
        if (index % 2 === 0) {
          doc.setFillColor(250, 250, 250);
          doc.rect(15, currentY, colPositions[colPositions.length - 1] - 15, 8, 'F');
        }

        doc.text(String(index + 1), colPositions[0] + colWidths[0] / 2, currentY + 5.5, { align: 'center' });
        doc.text(item.PO || 'N/A', colPositions[1] + 2, currentY + 5.5);
        doc.text(item.Model || 'N/A', colPositions[2] + 2, currentY + 5.5);
        doc.text(item.Outsole_Colour || 'N/A', colPositions[3] + colWidths[3] / 2, currentY + 5.5, { align: 'center' });

        let rowTotal = 0;
        sizeColumns.forEach((size, i) => {
          const qty = parseInt(qtyData[size]) || 0;
          rowTotal += qty;
          const displayQty = qty > 0 ? String(qty) : '-';
          doc.text(displayQty, colPositions[4 + i] + colWidths[4 + i] / 2, currentY + 5.5, { align: 'center' });
        });

        doc.setFont('helvetica', 'bold');
        doc.text(String(rowTotal), colPositions[colPositions.length - 1] - colWidths[colWidths.length - 1] / 2, currentY + 5.5, { align: 'center' });
        doc.setFont('helvetica', 'normal');

        currentY += 8;
      });
    }

    // Grand Total Row
    doc.setFillColor(...hrPurple);
    doc.rect(15, currentY, colPositions[colPositions.length - 1] - 15, 10, 'F');

    doc.setTextColor(...white);
    doc.setFont('helvetica', 'bold');
    
    if (hasSimpleSize) {
      doc.text('GRAND TOTAL', colPositions[4] + colWidths[4], currentY + 6.5, { align: 'right' });
      
      let grandTotal = 0;
      items.forEach(item => {
        grandTotal += parseInt(item.QTY || item.Qty || item.qty || 0);
      });
      
      doc.text(String(grandTotal), colPositions[5] + colWidths[5] / 2, currentY + 6.5, { align: 'center' });
    } else {
      doc.text('GRAND TOTAL', colPositions[3] + colWidths[3], currentY + 6.5, { align: 'right' });

      sizeColumns.forEach((size, i) => {
        let columnTotal = 0;
        items.forEach(item => {
          const qtyData = item.QTY || item.Qty || item.qty || {};
          columnTotal += parseInt(qtyData[size]) || 0;
        });
        doc.text(String(columnTotal), colPositions[4 + i] + colWidths[4 + i] / 2, currentY + 6.5, { align: 'center' });
      });

      let grandTotal = 0;
      items.forEach(item => {
        const qtyData = item.QTY || item.Qty || item.qty || {};
        Object.values(qtyData).forEach(qty => {
          grandTotal += parseInt(qty) || 0;
        });
      });
      doc.text(String(grandTotal), colPositions[colPositions.length - 1] - colWidths[colWidths.length - 1] / 2, currentY + 6.5, { align: 'center' });
    }

    // Footer section
    const footerY = currentY + 18;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');

    // Prepared By
    doc.text('PREPARED BY:', 15, footerY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(gatepassData.CreatedBy || 'N/A', 15, footerY + 5);
    doc.setLineWidth(0.5);
    doc.line(15, footerY + 8, 70, footerY + 8);
    doc.setFontSize(7);
    doc.text('Signature / Date', 15, footerY + 11);

    // Management Approved
    doc.setFont('helvetica', 'bold');
    doc.text('MANAGEMENT APPROVED:', 95, footerY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(managementUser, 95, footerY + 5);
    doc.line(95, footerY + 8, 150, footerY + 8);
    doc.setFontSize(7);
    doc.text(managementDate, 95, footerY + 11);

    // HR Status
    doc.setFont('helvetica', 'bold');
    doc.text('HR STATUS:', 175, footerY);
    doc.setFillColor(...hrPurple);
    doc.roundedRect(175, footerY + 2, 35, 6, 2, 2, 'F');
    doc.setTextColor(...white);
    doc.setFontSize(8);
    doc.text('PENDING APPROVAL', 192.5, footerY + 5.5, { align: 'center' });

    // Document Note (Footer)
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    const footNote = `Gatepass ID: ${gatepassName} — Page 1 — SOLE MATRIX — ${new Date().getFullYear()} — CONCORD FOOTWEAR (PVT) LTD — HR DEPARTMENT — CONFIDENTIAL`;
    doc.text(footNote, 148.5, footerY + 20, { align: 'center' });

    // Save the PDF
    const fileName = `HR_Gatepass_${gatepassName}_${new Date().getTime()}.pdf`;
    doc.save(fileName);

    console.log('[HR] PDF downloaded:', fileName);

  } catch (error) {
    console.error('Error generating HR PDF:', error);
    alert('Failed to generate PDF. Please try again.\n\n' + error.message);
  }
}

/**
 * Extract items from gatepass data for PDF
 */
function extractHRItems(data) {
  if (Array.isArray(data.Items)) {
    return data.Items;
  } else if (Array.isArray(data.items)) {
    return data.items;
  } else if (data.PO) {
    return [data];
  }
  return [];
}

/**
 * Extract size columns for complex QTY structure
 */
function extractHRSizeColumns(items) {
  const allSizes = new Set();
  items.forEach(item => {
    const qtyData = item.QTY || item.Qty || item.qty || {};
    if (qtyData && typeof qtyData === 'object') {
      Object.keys(qtyData).forEach(size => allSizes.add(size));
    }
  });
  
  return Array.from(allSizes).sort((a, b) => {
    const numA = parseFloat(a);
    const numB = parseFloat(b);
    if (isNaN(numA) || isNaN(numB)) {
      return String(a).localeCompare(String(b));
    }
    return numA - numB;
  });
}

/**
 * Update HR gatepass status — uses _sourceTab on rowData to pick correct sheet tab.
 */
async function updateHRGatepassStatus(rowData, newStatus, extraFields = {}) {
  const tabKey = rowData._sourceTab || 'storse';
  const url = HR_TAB_URLS[tabKey] || HR_TAB_URLS.storse;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HR_TIMEOUT);

  try {
    const gatepassName = rowData['Gatepass name'];
    console.log('[HR UPDATE] Looking for gatepass:', gatepassName, '| tab:', tabKey);

    const allRowsResponse = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });

    if (!allRowsResponse.ok) {
      throw new Error(`Failed to fetch rows: ${allRowsResponse.status}`);
    }

    const allRows = await allRowsResponse.json();
    console.log('[HR UPDATE] Total rows fetched:', allRows.length);

    const rowIndex = allRows.findIndex(row => row['Gatepass name'] === gatepassName);
    console.log('[HR UPDATE] Found at row index:', rowIndex);

    if (rowIndex === -1) {
      throw new Error(`Gatepass "${gatepassName}" not found in sheet (tab: ${tabKey})`);
    }

    const updateUrl = `${url}/${rowIndex}`;
    const payload = { 'Status': newStatus, ...extraFields };

    console.log('[HR UPDATE] Update URL:', updateUrl);
    console.log('[HR UPDATE] Payload:', JSON.stringify(payload, null, 2));

    const updateResponse = await fetch(updateUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timer);

    const responseBody = await updateResponse.text();
    console.log('[HR UPDATE] Response status:', updateResponse.status);
    console.log('[HR UPDATE] Response body:', responseBody);

    if (!updateResponse.ok) {
      throw new Error(`Failed to update status: ${updateResponse.status} - ${responseBody}`);
    }

    return JSON.parse(responseBody);

  } catch (err) {
    clearTimeout(timer);
    console.error('[HR UPDATE] Error:', err);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection.');
    }
    throw err;
  }
}

/* ═══════════════════════════════════════════════════════════════
   TRANSPORTATION MANAGEMENT
   ═══════════════════════════════════════════════════════════════ */

const TRANSPORT_CONFIG = {
  SHEET_URL: HR_TAB_URLS.storse, // backward compat
  TIMEOUT: HR_TIMEOUT,
};

const TransportState = {
  gatepasses: [],
  currentGatepass: null,
};

/**
 * Fetch gatepasses with status "Pending To Transport" — from BOTH tabs.
 */
async function fetchTransportGatepasses() {
  try {
    const all = await hrFetchAllTabs();
    return all.filter(row => {
      const status = String(row['Status'] || '').trim();
      return status === 'Pending To Transport';
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection.');
    }
    throw err;
  }
}

/**
 * Load and display transport gatepasses
 */
async function loadTransportGatepasses() {
  const container = document.getElementById('transportGatepassContainer');
  if (!container) return;

  try {
    container.innerHTML = `
      <div class="loading-spinner">
        <i class="fa-solid fa-spinner fa-spin"></i>
        <p>Loading gatepasses...</p>
      </div>
    `;

    const gatepasses = await fetchTransportGatepasses();
    TransportState.gatepasses = gatepasses;

    container.innerHTML = renderTransportGatepassList(gatepasses);

  } catch (error) {
    console.error('Error loading transport gatepasses:', error);
    container.innerHTML = `
      <div class="error-state">
        <div class="error-icon">
          <i class="fa-solid fa-exclamation-triangle"></i>
        </div>
        <p class="error-text">Failed to load gatepasses</p>
        <p class="error-detail">${sanitizeHTML(error.message)}</p>
        <button class="btn-retry" onclick="loadTransportGatepasses()">
          <i class="fa-solid fa-rotate-right"></i>
          <span>Try Again</span>
        </button>
      </div>
    `;
  }
}

/**
 * Render transport gatepass list
 */
function renderTransportGatepassList(gatepasses) {
  return `
    <div class="gatepass-header">
      <div class="gatepass-count">
        <strong>${gatepasses.length}</strong> Pending Transport Assignment${gatepasses.length !== 1 ? 's' : ''}
      </div>
      <button class="refresh-btn" onclick="loadTransportGatepasses()">
        <i class="fa-solid fa-rotate-right"></i>
        <span>Refresh</span>
      </button>
    </div>
    
    ${gatepasses.length > 0 ? `
      <div class="gatepass-list">
        ${gatepasses.map((gp, index) => renderTransportGatepassItem(gp, index)).join('')}
      </div>
    ` : `
      <div class="empty-state">
        <div class="empty-icon">
          <i class="fa-solid fa-truck-fast"></i>
        </div>
        <p class="empty-text">No gatepasses pending transport assignment</p>
        <p class="empty-subtext">All approved gatepasses have been assigned vehicles</p>
      </div>
    `}
  `;
}

/**
 * Render single transport gatepass item
 */
function renderTransportGatepassItem(gatepass, index) {
  let gatepassData = {};
  try {
    gatepassData = JSON.parse(gatepass['Rows_JSON'] || '{}');
  } catch (e) {
    console.error('Failed to parse gatepass JSON:', e);
    gatepassData = {};
  }

  const gatepassName = gatepass['Gatepass name'] || 'Unknown';
  const createdDate = gatepass['Created Date'] || '';
  const hrUser = gatepass['Approved HR User'] || 'N/A';
  const hrDate = gatepass['HR Approve Date'] || '';
  const srcTab = gatepass._sourceTab || 'storse';
  const deptLabel = HR_TAB_LABELS[srcTab] || 'Outsole Production';
  const deptBadgeColor = hrDeptBadgeColor(srcTab);

  return `
    <div class="gatepass-item transport-gatepass-item" onclick="viewTransportGatepass(${index})">
      <!-- Department & status badges pinned to the top of the card -->
      <div class="gatepass-badges-row">
        <div class="gatepass-status-badge transport-pending-badge" style="${deptBadgeColor}">
          <i class="fa-solid fa-building"></i>
          <span>${sanitizeHTML(deptLabel)}</span>
        </div>
        <div class="gatepass-status-badge transport-pending-badge">
          <i class="fa-solid fa-truck"></i>
          <span>Awaiting Vehicle</span>
        </div>
      </div>
      <div class="gatepass-main-row">
        <div class="gatepass-icon transport-gatepass-icon">
          <i class="fa-solid fa-truck-fast"></i>
        </div>
        <div class="gatepass-info">
          <div class="gatepass-name">${sanitizeHTML(gatepassName)}</div>
          <div class="gatepass-meta">
            <div class="gatepass-meta-item">
              <i class="fa-solid fa-user"></i>
              <span>${sanitizeHTML(gatepassData.GatepassName || 'N/A')}</span>
            </div>
            <div class="gatepass-meta-item">
              <i class="fa-solid fa-calendar"></i>
              <span>Created: ${sanitizeHTML(createdDate)}</span>
            </div>
            <div class="gatepass-meta-item">
              <i class="fa-solid fa-check-circle"></i>
              <span>HR Approved: ${sanitizeHTML(hrDate)}</span>
            </div>
          </div>
        </div>
        <div class="gatepass-arrow">
          <i class="fa-solid fa-chevron-right"></i>
        </div>
      </div>
    </div>
  `;
}

/**
 * View transport gatepass preview
 */
function viewTransportGatepass(index) {
  const gatepass = TransportState.gatepasses[index];
  TransportState.currentGatepass = gatepass;

  let gatepassData = {};
  try {
    gatepassData = JSON.parse(gatepass['Rows_JSON'] || '{}');
  } catch (e) {
    console.error('Failed to parse gatepass JSON:', e);
    alert('Error loading gatepass data');
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'gatepass-preview-overlay transport-preview-overlay';
  overlay.id = 'transportGatepassPreview';
  overlay.innerHTML = renderTransportGatepassPreview(gatepass, gatepassData);

  document.body.appendChild(overlay);

  setTimeout(() => overlay.classList.add('active'), 10);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeTransportGatepassPreview();
  });

  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeTransportGatepassPreview();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

/**
 * Render transport gatepass preview
 */
function renderTransportGatepassPreview(gatepass, data) {
  const gatepassName = gatepass['Gatepass name'] || 'Unknown';
  const createdDate = gatepass['Created Date'] || '';
  const hrUser = gatepass['Approved HR User'] || 'N/A';
  const hrDate = gatepass['HR Approve Date'] || '';
  const hrTime = gatepass['HR Approve Time'] || '';
  const srcTab = gatepass._sourceTab || 'storse';
  const mgmtF = hrMgmtFields(srcTab);
  const managementUser = gatepass[mgmtF.USER] || 'N/A';
  const managementDate = gatepass[mgmtF.DATE] || '';
  const deptLabel = HR_TAB_LABELS[srcTab] || 'Outsole Production';
  const deptLabelFull = hrDeptLabelFull(srcTab);

  const itemsTableHTML = buildHRItemsTable(data);

  return `
    <div class="gatepass-preview-container transport-preview-container">
      <div class="preview-header transport-preview-header">
        <div class="preview-title-section">
          <div class="preview-icon transport-preview-icon">
            <i class="fa-solid fa-truck-fast"></i>
          </div>
          <div>
            <div class="preview-title">Transportation Assignment</div>
            <div class="preview-subtitle">Approved by Management &amp; HR · ${sanitizeHTML(deptLabel)}</div>
          </div>
        </div>
        <button class="preview-close" onclick="closeTransportGatepassPreview()">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="preview-body">
        <div class="gatepass-document">
          <!-- Document Header -->
          <div class="document-header">
            <div class="company-logo">
              <i class="fa-solid fa-shoe-prints"></i>
            </div>
            <div class="company-name">CONCORD FOOTWEAR (PVT) LTD</div>
            <div class="company-subtitle">${sanitizeHTML(deptLabelFull)}</div>
            <div class="document-title">GATEPASS — Production Tracking System</div>
          </div>

          <!-- Basic Info Grid -->
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">GATEPASS REFERENCE</div>
              <div class="info-value highlight">${sanitizeHTML(gatepassName)}</div>
            </div>
            <div class="info-item">
              <div class="info-label">DATE ISSUED</div>
              <div class="info-value">${sanitizeHTML(data.CreateDate || createdDate)}</div>
            </div>
            <div class="info-item">
              <div class="info-label">PREPARED BY</div>
              <div class="info-value">${sanitizeHTML(data.CreatedBy || 'N/A')}</div>
            </div>
            <div class="info-item">
              <div class="info-label">DEPARTMENT</div>
              <div class="info-value">${sanitizeHTML(data.Chanula || deptLabel.toUpperCase())}</div>
            </div>
          </div>

          <!-- Approval Timeline -->
          <div class="approval-timeline">
            <div class="timeline-item timeline-completed">
              <div class="timeline-icon">
                <i class="fa-solid fa-check"></i>
              </div>
              <div class="timeline-content">
                <div class="timeline-title">Management Approved</div>
                <div class="timeline-detail">${sanitizeHTML(managementUser)} • ${sanitizeHTML(managementDate)}</div>
              </div>
            </div>
            <div class="timeline-connector timeline-completed"></div>
            <div class="timeline-item timeline-completed">
              <div class="timeline-icon">
                <i class="fa-solid fa-check"></i>
              </div>
              <div class="timeline-content">
                <div class="timeline-title">HR Approved</div>
                <div class="timeline-detail">${sanitizeHTML(hrUser)} • ${sanitizeHTML(hrDate)} ${sanitizeHTML(hrTime)}</div>
              </div>
            </div>
            <div class="timeline-connector timeline-pending"></div>
            <div class="timeline-item timeline-pending">
              <div class="timeline-icon">
                <i class="fa-solid fa-truck"></i>
              </div>
              <div class="timeline-content">
                <div class="timeline-title">Transport Assignment</div>
                <div class="timeline-detail">Pending vehicle assignment</div>
              </div>
            </div>
          </div>

          <!-- Items Table -->
          ${itemsTableHTML}

          <!-- Document Footer -->
          <div class="document-footer">
            <div class="footer-section">
              <div class="footer-label">PREPARED BY:</div>
              <div class="footer-signature">
                <div class="signature-line">${sanitizeHTML(data.CreatedBy || 'N/A')}</div>
                <div class="signature-sublabel">Signature / Date</div>
              </div>
            </div>
            <div class="footer-section">
              <div class="footer-label">MANAGEMENT:</div>
              <div class="footer-signature">
                <div class="signature-line">${sanitizeHTML(managementUser)}</div>
                <div class="signature-sublabel">${sanitizeHTML(managementDate)}</div>
              </div>
            </div>
            <div class="footer-section">
              <div class="footer-label">HR APPROVED:</div>
              <div class="footer-signature">
                <div class="signature-line">${sanitizeHTML(hrUser)}</div>
                <div class="signature-sublabel">${sanitizeHTML(hrDate)}</div>
              </div>
            </div>
          </div>

          <div class="document-note">
            <strong>Gatepass ID:</strong> ${sanitizeHTML(gatepassName)} — 
            <strong>Page 1</strong> — SOLE MATRIX — ${new Date().getFullYear()} — 
            <strong>CONCORD FOOTWEAR (PVT) LTD</strong> — CONFIDENTIAL
          </div>
        </div>
      </div>

      <div class="preview-footer transport-preview-footer">
        <button class="btn-preview btn-download" onclick="downloadTransportGatepass()">
          <i class="fa-solid fa-download"></i>
          <span>Download PDF</span>
        </button>
        <button class="btn-preview btn-assign-vehicle" onclick="showVehicleAssignmentForm()">
          <i class="fa-solid fa-truck"></i>
          <span>Assign Vehicle</span>
        </button>
      </div>
    </div>
  `;
}

/**
 * Close transport gatepass preview
 */
function closeTransportGatepassPreview() {
  const overlay = document.getElementById('transportGatepassPreview');
  if (overlay) {
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 300);
  }
}

/**
 * Download transport gatepass as PDF
 */
function downloadTransportGatepass() {
  if (!TransportState.currentGatepass) return;

  try {
    const gatepassData = JSON.parse(TransportState.currentGatepass['Rows_JSON'] || '{}');
    const gatepassName = TransportState.currentGatepass['Gatepass name'] || 'gatepass';
    const createdDate = TransportState.currentGatepass['Created Date'] || '';
    const srcTab = TransportState.currentGatepass._sourceTab || 'storse';
    const mgmtF = hrMgmtFields(srcTab);
    const managementUser = TransportState.currentGatepass[mgmtF.USER] || 'N/A';
    const managementDate = TransportState.currentGatepass[mgmtF.DATE] || '';
    const hrUser = TransportState.currentGatepass['Approved HR User'] || 'N/A';
    const hrDate = TransportState.currentGatepass['HR Approve Date'] || '';
    const deptLabel = HR_TAB_LABELS[srcTab] || 'Outsole Production';
    const deptLabelFull = hrDeptLabelFull(srcTab);

    if (typeof window.jspdf === 'undefined') {
      alert('PDF library not loaded. Please refresh the page and try again.');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4');

    // Colors - Teal/Cyan for Transport
    const transportTeal = [20, 184, 166];
    const transportCyan = [6, 182, 212];
    const darkBlue = [13, 42, 87];
    const lightGray = [240, 240, 240];
    const white = [255, 255, 255];
    const green = [16, 185, 129];

    // Header Background - Teal
    doc.setFillColor(...transportTeal);
    doc.rect(0, 0, 297, 35, 'F');

    doc.setTextColor(...white);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('CONCORD FOOTWEAR (PVT) LTD', 15, 15);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(deptLabelFull, 15, 21);

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('GATEPASS', 245, 15);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Transportation - SOLE MATRIX', 220, 21);

    // Transport Badge
    doc.setFillColor(...transportTeal);
    doc.roundedRect(235, 25, 47, 8, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...white);
    doc.text('TRANSPORT DEPT', 258.5, 29.5, { align: 'center' });

    doc.setTextColor(0, 0, 0);

    // Info boxes
    const infoY = 42;
    const boxHeight = 12;
    
    doc.setFillColor(...lightGray);
    doc.rect(15, infoY, 70, boxHeight, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('GATEPASS REFERENCE', 17, infoY + 4);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(gatepassName, 17, infoY + 9);

    doc.setFillColor(...lightGray);
    doc.rect(88, infoY, 48, boxHeight, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('DATE ISSUED', 90, infoY + 4);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(createdDate, 90, infoY + 9);

    doc.setFillColor(...lightGray);
    doc.rect(139, infoY, 55, boxHeight, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('PREPARED BY', 141, infoY + 4);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(gatepassData.CreatedBy || 'N/A', 141, infoY + 9);

    doc.setFillColor(...lightGray);
    doc.rect(197, infoY, 85, boxHeight, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('DEPARTMENT', 199, infoY + 4);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(deptLabel.toUpperCase(), 199, infoY + 9);

    // Approval Status Section
    const approvalY = 60;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.setFillColor(240, 253, 250);
    doc.roundedRect(15, approvalY, 267, 16, 2, 2, 'FD');

    // Two approval badges side by side
    doc.setFillColor(...green);
    doc.roundedRect(17, approvalY + 2, 45, 6, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...white);
    doc.text('✓ MANAGEMENT', 39.5, approvalY + 5.5, { align: 'center' });

    doc.setFillColor(...green);
    doc.roundedRect(65, approvalY + 2, 30, 6, 2, 2, 'F');
    doc.text('✓ HR', 80, approvalY + 5.5, { align: 'center' });

    doc.setFillColor(...transportTeal);
    doc.roundedRect(98, approvalY + 2, 50, 6, 2, 2, 'F');
    doc.text('⏳ PENDING TRANSPORT', 123, approvalY + 5.5, { align: 'center' });

    doc.setTextColor(50, 50, 50);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('MGMT:', 17, approvalY + 12);
    doc.setFont('helvetica', 'normal');
    doc.text(`${managementUser} (${managementDate})`, 32, approvalY + 12);

    doc.setFont('helvetica', 'bold');
    doc.text('HR:', 140, approvalY + 12);
    doc.setFont('helvetica', 'normal');
    doc.text(`${hrUser} (${hrDate})`, 148, approvalY + 12);

    // Build items table
    const items = extractHRItems(gatepassData);
    const hasSimpleSize = items.some(item => 
      typeof item.Size === 'string' || typeof item.Size === 'number'
    );

    let sizeColumns = [];
    let tableHeaders = [];
    let colWidths = [];
    
    if (hasSimpleSize) {
      tableHeaders = ['#', 'PO NUMBER', 'MODEL', 'OUTSOLE\nCOLOUR', 'SIZE', 'QTY'];
      colWidths = [10, 35, 40, 40, 20, 20];
    } else {
      sizeColumns = extractHRSizeColumns(items);
      tableHeaders = ['#', 'PO NUMBER', 'MODEL', 'OUTSOLE\nCOLOUR'];
      sizeColumns.forEach(size => tableHeaders.push(size));
      tableHeaders.push('TOTAL\nQTY');
      
      colWidths = [10, 35, 40, 40];
      sizeColumns.forEach(() => colWidths.push(15));
      colWidths.push(20);
    }

    const tableStartY = 82;

    let xPos = 15;
    const colPositions = [xPos];
    colWidths.forEach(width => {
      xPos += width;
      colPositions.push(xPos);
    });

    doc.setFillColor(...transportTeal);
    doc.rect(15, tableStartY, colPositions[colPositions.length - 1] - 15, 12, 'F');

    doc.setTextColor(...white);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');

    tableHeaders.forEach((header, i) => {
      const textLines = header.split('\n');
      const startX = colPositions[i] + colWidths[i] / 2;
      if (textLines.length > 1) {
        doc.text(textLines[0], startX, tableStartY + 5, { align: 'center' });
        doc.text(textLines[1], startX, tableStartY + 9, { align: 'center' });
      } else {
        doc.text(header, startX, tableStartY + 7, { align: 'center' });
      }
    });

    let currentY = tableStartY + 12;
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    if (hasSimpleSize) {
      items.forEach((item, index) => {
        if (index % 2 === 0) {
          doc.setFillColor(250, 250, 250);
          doc.rect(15, currentY, colPositions[colPositions.length - 1] - 15, 8, 'F');
        }

        doc.text(String(index + 1), colPositions[0] + colWidths[0] / 2, currentY + 5.5, { align: 'center' });
        doc.text(item.PO || 'N/A', colPositions[1] + 2, currentY + 5.5);
        doc.text(item.Model || 'N/A', colPositions[2] + 2, currentY + 5.5);
        doc.text(item.Outsole_Colour || 'N/A', colPositions[3] + colWidths[3] / 2, currentY + 5.5, { align: 'center' });
        doc.text(String(item.Size || 'N/A'), colPositions[4] + colWidths[4] / 2, currentY + 5.5, { align: 'center' });
        
        const qty = parseInt(item.QTY || item.Qty || item.qty || 0);
        doc.setFont('helvetica', 'bold');
        doc.text(String(qty), colPositions[5] + colWidths[5] / 2, currentY + 5.5, { align: 'center' });
        doc.setFont('helvetica', 'normal');

        currentY += 8;
      });
    } else {
      items.forEach((item, index) => {
        const qtyData = item.QTY || item.Qty || item.qty || {};
        
        if (index % 2 === 0) {
          doc.setFillColor(250, 250, 250);
          doc.rect(15, currentY, colPositions[colPositions.length - 1] - 15, 8, 'F');
        }

        doc.text(String(index + 1), colPositions[0] + colWidths[0] / 2, currentY + 5.5, { align: 'center' });
        doc.text(item.PO || 'N/A', colPositions[1] + 2, currentY + 5.5);
        doc.text(item.Model || 'N/A', colPositions[2] + 2, currentY + 5.5);
        doc.text(item.Outsole_Colour || 'N/A', colPositions[3] + colWidths[3] / 2, currentY + 5.5, { align: 'center' });

        let rowTotal = 0;
        sizeColumns.forEach((size, i) => {
          const qty = parseInt(qtyData[size]) || 0;
          rowTotal += qty;
          const displayQty = qty > 0 ? String(qty) : '-';
          doc.text(displayQty, colPositions[4 + i] + colWidths[4 + i] / 2, currentY + 5.5, { align: 'center' });
        });

        doc.setFont('helvetica', 'bold');
        doc.text(String(rowTotal), colPositions[colPositions.length - 1] - colWidths[colWidths.length - 1] / 2, currentY + 5.5, { align: 'center' });
        doc.setFont('helvetica', 'normal');

        currentY += 8;
      });
    }

    // Grand Total Row
    doc.setFillColor(...transportTeal);
    doc.rect(15, currentY, colPositions[colPositions.length - 1] - 15, 10, 'F');

    doc.setTextColor(...white);
    doc.setFont('helvetica', 'bold');
    
    if (hasSimpleSize) {
      doc.text('GRAND TOTAL', colPositions[4] + colWidths[4], currentY + 6.5, { align: 'right' });
      
      let grandTotal = 0;
      items.forEach(item => {
        grandTotal += parseInt(item.QTY || item.Qty || item.qty || 0);
      });
      
      doc.text(String(grandTotal), colPositions[5] + colWidths[5] / 2, currentY + 6.5, { align: 'center' });
    } else {
      doc.text('GRAND TOTAL', colPositions[3] + colWidths[3], currentY + 6.5, { align: 'right' });

      sizeColumns.forEach((size, i) => {
        let columnTotal = 0;
        items.forEach(item => {
          const qtyData = item.QTY || item.Qty || item.qty || {};
          columnTotal += parseInt(qtyData[size]) || 0;
        });
        doc.text(String(columnTotal), colPositions[4 + i] + colWidths[4 + i] / 2, currentY + 6.5, { align: 'center' });
      });

      let grandTotal = 0;
      items.forEach(item => {
        const qtyData = item.QTY || item.Qty || item.qty || {};
        Object.values(qtyData).forEach(qty => {
          grandTotal += parseInt(qty) || 0;
        });
      });
      doc.text(String(grandTotal), colPositions[colPositions.length - 1] - colWidths[colWidths.length - 1] / 2, currentY + 6.5, { align: 'center' });
    }

    // Footer
    const footerY = currentY + 18;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');

    doc.text('PREPARED BY:', 15, footerY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(gatepassData.CreatedBy || 'N/A', 15, footerY + 5);
    doc.setLineWidth(0.5);
    doc.line(15, footerY + 8, 65, footerY + 8);
    doc.setFontSize(7);
    doc.text('Signature / Date', 15, footerY + 11);

    doc.setFont('helvetica', 'bold');
    doc.text('MANAGEMENT:', 85, footerY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(managementUser, 85, footerY + 5);
    doc.line(85, footerY + 8, 135, footerY + 8);
    doc.setFontSize(7);
    doc.text(managementDate, 85, footerY + 11);

    doc.setFont('helvetica', 'bold');
    doc.text('HR APPROVED:', 155, footerY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(hrUser, 155, footerY + 5);
    doc.line(155, footerY + 8, 205, footerY + 8);
    doc.setFontSize(7);
    doc.text(hrDate, 155, footerY + 11);

    doc.setFont('helvetica', 'bold');
    doc.text('TRANSPORT:', 225, footerY);
    doc.setFillColor(...transportTeal);
    doc.roundedRect(225, footerY + 2, 35, 6, 2, 2, 'F');
    doc.setTextColor(...white);
    doc.setFontSize(8);
    doc.text('PENDING', 242.5, footerY + 5.5, { align: 'center' });

    doc.setTextColor(100, 100, 100);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    const footNote = `Gatepass ID: ${gatepassName} — Page 1 — SOLE MATRIX — ${new Date().getFullYear()} — CONCORD FOOTWEAR (PVT) LTD — TRANSPORT DEPT — CONFIDENTIAL`;
    doc.text(footNote, 148.5, footerY + 20, { align: 'center' });

    const fileName = `Transport_Gatepass_${gatepassName}_${new Date().getTime()}.pdf`;
    doc.save(fileName);

    console.log('[Transport] PDF downloaded:', fileName);

  } catch (error) {
    console.error('Error generating transport PDF:', error);
    alert('Failed to generate PDF. Please try again.\n\n' + error.message);
  }
}

/**
 * Show vehicle assignment form
 */
function showVehicleAssignmentForm() {
  if (!TransportState.currentGatepass) return;

  const gatepassName = TransportState.currentGatepass['Gatepass name'] || 'Unknown';

  const formHTML = `
    <div class="vehicle-form-overlay" id="vehicleFormOverlay">
      <div class="vehicle-form-container">
        <div class="vehicle-form-header">
          <div class="form-header-content">
            <div class="form-icon">
              <i class="fa-solid fa-truck"></i>
            </div>
            <div>
              <div class="form-title">Assign Vehicle</div>
              <div class="form-subtitle">Gatepass: ${sanitizeHTML(gatepassName)}</div>
            </div>
          </div>
          <button class="form-close" onclick="closeVehicleForm()">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="vehicle-form-body">
          <div class="form-group">
            <label class="form-label">
              <i class="fa-solid fa-truck"></i>
              <span>Vehicle Number</span>
              <span class="required">*</span>
            </label>
            <input 
              type="text" 
              id="vehicleNumber" 
              class="form-input"
              placeholder="e.g., CAA-1234"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label">
              <i class="fa-solid fa-id-card"></i>
              <span>Driver Name</span>
              <span class="required">*</span>
            </label>
            <input 
              type="text" 
              id="driverName" 
              class="form-input"
              placeholder="e.g., John Doe"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label">
              <i class="fa-solid fa-message"></i>
              <span>Remarks</span>
            </label>
            <textarea 
              id="remarks" 
              class="form-textarea"
              placeholder="Additional notes or instructions (optional)"
              rows="3"
            ></textarea>
          </div>

          <div class="form-info">
            <i class="fa-solid fa-info-circle"></i>
            <span>Vehicle assignment will update the gatepass status and notify relevant departments.</span>
          </div>
        </div>

        <div class="vehicle-form-footer">
          <button class="btn-form btn-cancel" onclick="closeVehicleForm()">
            <i class="fa-solid fa-times"></i>
            <span>Cancel</span>
          </button>
          <button class="btn-form btn-submit" onclick="submitVehicleAssignment()">
            <i class="fa-solid fa-check"></i>
            <span>Assign Vehicle</span>
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', formHTML);

  setTimeout(() => {
    const overlay = document.getElementById('vehicleFormOverlay');
    if (overlay) overlay.classList.add('active');
  }, 10);

  document.getElementById('vehicleNumber').focus();
}

/**
 * Close vehicle assignment form
 */
function closeVehicleForm() {
  const overlay = document.getElementById('vehicleFormOverlay');
  if (overlay) {
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 300);
  }
}

/**
 * Submit vehicle assignment
 */
async function submitVehicleAssignment() {
  if (!TransportState.currentGatepass) return;

  const vehicleNumber = document.getElementById('vehicleNumber').value.trim();
  const driverName = document.getElementById('driverName').value.trim();
  const remarks = document.getElementById('remarks').value.trim();

  if (!vehicleNumber) {
    alert('Please enter the vehicle number.');
    document.getElementById('vehicleNumber').focus();
    return;
  }

  if (!driverName) {
    alert('Please enter the driver name.');
    document.getElementById('driverName').focus();
    return;
  }

  try {
    const submitBtn = document.querySelector('.btn-submit');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Assigning...</span>';
    }

    const transportUser = sessionStorage.getItem('sm_user') || 'Unknown';
    const now = new Date();
    const transportDate = now.toLocaleDateString('en-GB');
    const transportTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    await updateTransportGatepassStatus(TransportState.currentGatepass, 'Vehicle Assigned', {
      'Vehicle Number': vehicleNumber,
      'Driver Name': driverName,
      'Transport Remarks': remarks || 'N/A',
      'Assigned By (username)': transportUser,
      'Assignment Date': transportDate,
      'Assignment Time': transportTime,
    });

    alert(`✓ Vehicle assigned successfully!\n\nVehicle: ${vehicleNumber}\nDriver: ${driverName}\n\nGatepass is ready for transport.`);

    closeVehicleForm();
    closeTransportGatepassPreview();
    await loadTransportGatepasses();
    await loadPendingTransportCount(); // Update badge count

  } catch (error) {
    console.error('Error assigning vehicle:', error);
    alert('Failed to assign vehicle. Please try again.\n\n' + error.message);
    
    const submitBtn = document.querySelector('.btn-submit');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> <span>Assign Vehicle</span>';
    }
  }
}

/**
 * Update transport gatepass status — uses _sourceTab on rowData.
 */
async function updateTransportGatepassStatus(rowData, newStatus, extraFields = {}) {
  const tabKey = rowData._sourceTab || 'storse';
  const url = HR_TAB_URLS[tabKey] || HR_TAB_URLS.storse;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HR_TIMEOUT);

  try {
    const gatepassName = rowData['Gatepass name'];
    console.log('[Transport UPDATE] Looking for gatepass:', gatepassName, '| tab:', tabKey);

    const allRowsResponse = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });

    if (!allRowsResponse.ok) {
      throw new Error(`Failed to fetch rows: ${allRowsResponse.status}`);
    }

    const allRows = await allRowsResponse.json();
    console.log('[Transport UPDATE] Total rows fetched:', allRows.length);

    const rowIndex = allRows.findIndex(row => row['Gatepass name'] === gatepassName);
    console.log('[Transport UPDATE] Found at row index:', rowIndex);

    if (rowIndex === -1) {
      throw new Error(`Gatepass "${gatepassName}" not found in sheet (tab: ${tabKey})`);
    }

    const updateUrl = `${url}/${rowIndex}`;
    const payload = { 'Status': newStatus, ...extraFields };

    console.log('[Transport UPDATE] Update URL:', updateUrl);
    console.log('[Transport UPDATE] Payload:', JSON.stringify(payload, null, 2));

    const updateResponse = await fetch(updateUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timer);

    const responseBody = await updateResponse.text();
    console.log('[Transport UPDATE] Response status:', updateResponse.status);
    console.log('[Transport UPDATE] Response body:', responseBody);

    if (!updateResponse.ok) {
      throw new Error(`Failed to update status: ${updateResponse.status} - ${responseBody}`);
    }

    return JSON.parse(responseBody);

  } catch (err) {
    clearTimeout(timer);
    console.error('[Transport UPDATE] Error:', err);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection.');
    }
    throw err;
  }
}

console.log('[SOLE MATRIX] HR Dashboard initialized successfully');
