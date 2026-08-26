/* ═══════════════════════════════════════════════════════════════
   SOLE MATRIX — Outsole Production Dashboard
   Concord Footwear (Pvt) Ltd
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   SESSION GUARD
   Redirect to login if no valid session exists.
   ───────────────────────────────────────────────────────────── */
(function guardSession() {
  const user = sessionStorage.getItem('sm_user');
  const dept = sessionStorage.getItem('sm_dept');

  if (!user || !dept) {
    // No session — back to login
    window.location.replace('index.html');
    return;
  }

  // Ensure this page is only accessible to Outsole Production
  if (dept.toLowerCase() !== 'outsole production') {
    window.location.replace('index.html');
  }
})();

/* ─────────────────────────────────────────────────────────────
   MODULE DEFINITIONS
   ───────────────────────────────────────────────────────────── */
const MODULES = {
  'mrn': {
    label:       'Module 01',
    title:       'MRN Creation',
    icon:        'fa-solid fa-file-circle-plus',
    color:       '#06b6d4',
    colorBg:     'linear-gradient(135deg, #06b6d4, #0891b2)',
    colorShadow: 'rgba(6,182,212,0.4)',
    tag:         'Materials',
    desc:        'Raise and manage Material Requisition Notes for outsole production orders.',
  },
  'production-in': {
    label:       'Module 02',
    title:       'Production In',
    icon:        'fa-solid fa-arrow-right-to-bracket',
    color:       '#22c55e',
    colorBg:     'linear-gradient(135deg, #22c55e, #16a34a)',
    colorShadow: 'rgba(34,197,94,0.4)',
    tag:         'Inbound',
    desc:        'Record incoming outsole units entering the production floor for processing.',
  },
  'production-out': {
    label:       'Module 03',
    title:       'Production Out',
    icon:        'fa-solid fa-arrow-right-from-bracket',
    color:       '#f97316',
    colorBg:     'linear-gradient(135deg, #f97316, #ea580c)',
    colorShadow: 'rgba(249,115,22,0.4)',
    tag:         'Outbound',
    desc:        'Log completed outsole units dispatched from the production floor.',
  },
  'pack-to-bin': {
    label:       'Module 04',
    title:       'Pack To Bin',
    icon:        'fa-solid fa-boxes-stacked',
    color:       '#a855f7',
    colorBg:     'linear-gradient(135deg, #a855f7, #9333ea)',
    colorShadow: 'rgba(168,85,247,0.4)',
    tag:         'Storage',
    desc:        'Assign and transfer packed outsole batches to designated storage bins.',
  },
};

/* ─────────────────────────────────────────────────────────────
   INIT
   ───────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  populateUserInfo();
  startClock();
  setGreeting();
  setTodayDate();
});

/* ─────────────────────────────────────────────────────────────
   USER INFO
   ───────────────────────────────────────────────────────────── */
function populateUserInfo() {
  const user = sessionStorage.getItem('sm_user') || 'User';

  // Topbar
  const userNameEl  = document.getElementById('userName');
  const userAvatar  = document.getElementById('userAvatar');
  if (userNameEl) userNameEl.textContent = user;
  if (userAvatar)  userAvatar.textContent = user.charAt(0).toUpperCase();

  // Hero
  const dashUserName = document.getElementById('dashUserName');
  if (dashUserName) dashUserName.textContent = user;
}

/* ─────────────────────────────────────────────────────────────
   LIVE CLOCK
   ───────────────────────────────────────────────────────────── */
function startClock() {
  const clockEl = document.getElementById('topbarClock');
  if (!clockEl) return;

  function tick() {
    const now  = new Date();
    const h    = String(now.getHours()).padStart(2, '0');
    const m    = String(now.getMinutes()).padStart(2, '0');
    const s    = String(now.getSeconds()).padStart(2, '0');
    clockEl.textContent = `${h}:${m}:${s}`;
  }

  tick();
  setInterval(tick, 1000);
}

/* ─────────────────────────────────────────────────────────────
   GREETING & DATE
   ───────────────────────────────────────────────────────────── */
function setGreeting() {
  const hour = new Date().getHours();
  let text = 'Good morning,';
  if (hour >= 12 && hour < 17) text = 'Good afternoon,';
  else if (hour >= 17)          text = 'Good evening,';

  const el = document.getElementById('dashGreeting');
  if (el) el.textContent = text;
}

function setTodayDate() {
  const now    = new Date();
  const opts   = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const dateStr = now.toLocaleDateString('en-US', opts);

  // Topbar date
  const topDate = document.getElementById('topbarDate');
  if (topDate) topDate.textContent = dateStr;

  // Stats chip
  const statToday = document.getElementById('statToday');
  if (statToday) {
    const shortOpts = { day: 'numeric', month: 'short', year: 'numeric' };
    statToday.textContent = now.toLocaleDateString('en-US', shortOpts);
  }
}

/* ─────────────────────────────────────────────────────────────
   MODULE MODAL
   ───────────────────────────────────────────────────────────── */
function openModule(moduleKey) {
  const mod = MODULES[moduleKey];
  if (!mod) return;

  const modal     = document.getElementById('moduleModal');
  const iconEl    = document.getElementById('modalIcon');
  const labelEl   = document.getElementById('modalLabel');
  const titleEl   = document.getElementById('modalModuleTitle');
  const bodyEl    = document.getElementById('modalBody');
  const modalCard = document.getElementById('moduleModalCard');

  // Icon
  iconEl.innerHTML         = `<i class="${mod.icon}"></i>`;
  iconEl.style.background  = mod.colorBg;
  iconEl.style.boxShadow   = `0 6px 20px ${mod.colorShadow}`;

  // Titles
  labelEl.textContent = mod.label;
  titleEl.textContent = mod.title;

  // Border accent
  modalCard.style.borderColor = `${mod.color}40`;
  modalCard.style.boxShadow   = `0 40px 80px rgba(0,0,0,0.7), 0 0 0 1px ${mod.color}20`;

  // ── MRN gets its own wider modal and dedicated init ──────────
  if (moduleKey === 'mrn') {
    modal.classList.add('mrn-active');
    initMRNModule(bodyEl);           // defined in mrn.js
  } else if (moduleKey === 'production-in') {
    modal.classList.add('prodin-active');
    initProductionInModule(bodyEl);  // defined in production-in.js
  } else if (moduleKey === 'production-out') {
    modal.classList.add('prodout-active');
    initProductionOutModule(bodyEl); // defined in production-out.js
  } else {
    modal.classList.remove('mrn-active');
    bodyEl.innerHTML = buildModalBody(mod);
  }

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  modal.focus();
  document.body.style.overflow = 'hidden';
}

function closeModule() {
  const modal     = document.getElementById('moduleModal');
  const modalCard = document.getElementById('moduleModalCard');

  modal.classList.add('hidden');
  modal.classList.remove('mrn-active');    // always clean up mrn-active
  modal.classList.remove('prodin-active'); // always clean up prodin-active
  modal.classList.remove('prodout-active'); // always clean up prodout-active
  modal.setAttribute('aria-hidden', 'true');
  modalCard.style.borderColor = '';
  modalCard.style.boxShadow   = '';
  document.body.style.overflow = '';

  // Stop QR scanner if Production In was open
  if (typeof destroyProductionInModule === 'function') destroyProductionInModule();
  
  // Stop QR scanner if Production Out was open
  if (typeof destroyProductionOutModule === 'function') destroyProductionOutModule();

  // Clear body so MRN state does not persist across re-opens
  const bodyEl = document.getElementById('modalBody');
  if (bodyEl) bodyEl.innerHTML = '';
}

function buildModalBody(mod) {
  return `
    <div class="modal-coming-soon">
      <div class="cs-icon">
        <i class="${mod.icon}" style="color:${mod.color}"></i>
      </div>
      <h3>${mod.title}</h3>
      <p>${mod.desc}</p>
      <span class="cs-badge"
        style="background:${mod.color}18; border:1px solid ${mod.color}40; color:${mod.color};">
        <i class="fa-solid fa-clock-rotate-left"></i>
        Form coming soon
      </span>
    </div>
  `;
}

/* ─────────────────────────────────────────────────────────────
   LOGOUT
   ───────────────────────────────────────────────────────────── */
function handleLogout() {
  const modal = document.getElementById('logoutModal');
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  modal.focus();
  document.body.style.overflow = 'hidden';
}

function cancelLogout() {
  const modal = document.getElementById('logoutModal');
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function confirmLogout() {
  // Clear session
  sessionStorage.removeItem('sm_user');
  sessionStorage.removeItem('sm_dept');
  sessionStorage.removeItem('sm_login');

  // Redirect to login
  window.location.replace('index.html');
}

/* ─────────────────────────────────────────────────────────────
   KEYBOARD — Escape closes any open modal
   ───────────────────────────────────────────────────────────── */
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;

  const moduleModal = document.getElementById('moduleModal');
  const logoutModal = document.getElementById('logoutModal');

  if (logoutModal && !logoutModal.classList.contains('hidden')) {
    cancelLogout();
  } else if (moduleModal && !moduleModal.classList.contains('hidden')) {
    closeModule();
  }
});

/* ─────────────────────────────────────────────────────────────
   CLICK OUTSIDE modal card to close
   ───────────────────────────────────────────────────────────── */
document.getElementById('moduleModal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('moduleModal')) closeModule();
});
document.getElementById('logoutModal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('logoutModal')) cancelLogout();
});
