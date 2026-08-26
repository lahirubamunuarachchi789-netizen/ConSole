/* ═══════════════════════════════════════════════════════════════
   SOLE MATRIX — WhatsApp Integration Helper
   Concord Footwear (Pvt) Ltd
   ─────────────────────────────────────────────────────────────
   Provides a "Switch to WhatsApp" action at key workflow events:

     1. Outsole Production submits & saves an MRN          → mrn.js
     2. Warehouse & Logistics completes the ACTIVE MRN     → warehouse.js
     3. Outsole Production completes a Gatepass
        (Production In — Module 02)                        → production-in.js
        / Desma Department completes a Gatepass (Desma In) → desma-in.js
     4. Management approves a Gatepass                     → gatepass-management.js
     5. HR approves a Gatepass                             → hr-dashboard.js

   RECIPIENT LOOKUP — "WP" Google Sheet tab:
     Column A ("Scenario")        → the event description
     Column B ("Whatsapp Number") → the recipient's number
     Cell C1 (3rd column, row 1)  → link appended to every message
   Every time the user switches to WhatsApp, the sheet is re-read
   so number AND link changes take effect immediately.
   The number is normalised to international format for wa.me
   (e.g. "786616438" → "94786616438" using the default country
   code below).

   Public API:
     waOpen(scenario, message, phone)
         Resolves the recipient number for `scenario` from the WP
         sheet, then opens WhatsApp with the pre-filled message.

     injectWhatsAppButton(target, message, options)
         Renders an inline "Switch to WhatsApp" button into a
         container element. options.scenario selects the recipient.

     showWhatsAppActionPopup({ title, subtitle, message, scenario })
         Shows a floating success popup containing the
         "Switch to WhatsApp" button.
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ── Scenario keys — MUST match Column A of the "WP" sheet ────── */
const WA_SCENARIOS = {
  MRN_SUBMITTED:
    'When the user in Outsole Production submits & saves the MRN',
  MRN_COMPLETED:
    'When a Warehouse & Logistics user completes the ACTIVE MRN',
  GATEPASS_COMPLETED:
    'When the Outsole Production user completes the Gatepass through the Production In Module 02 and the Desma Department user completes the Gatepass through the Desma In',
  GATEPASS_MGMT_APPROVED:
    'When the Gatepass is approved by the Management',
  GATEPASS_HR_APPROVED:
    'When the Gatepass is approved by the HR',
};

/* ── Default country code for local numbers (Sri Lanka) ───────── */
const WA_DEFAULT_COUNTRY_CODE = '94';

/* ═══════════════════════════════════════════════════════════════
   SELF-CONTAINED STYLES
   ═══════════════════════════════════════════════════════════════ */
(function injectWhatsAppStyles() {
  if (document.getElementById('waHelperStyles')) return;
  const style = document.createElement('style');
  style.id = 'waHelperStyles';
  style.textContent = `
    /* ── Inline "Switch to WhatsApp" button ─────────────────── */
    .wa-action-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 13px 22px;
      background: linear-gradient(135deg, #25d366, #128c7e);
      border: none;
      border-radius: 10px;
      color: #ffffff;
      font-family: inherit;
      font-size: 0.9rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      cursor: pointer;
      box-shadow: 0 6px 18px rgba(37, 211, 102, 0.35);
      transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease, opacity 0.18s ease;
    }
    .wa-action-btn:hover {
      transform: translateY(-2px);
      filter: brightness(1.06);
      box-shadow: 0 9px 24px rgba(37, 211, 102, 0.5);
    }
    .wa-action-btn:active { transform: translateY(0); }
    .wa-action-btn:disabled { opacity: 0.7; cursor: wait; transform: none; }

    .wa-action-btn .wa-btn-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      flex-shrink: 0;
    }
    .wa-action-btn .wa-btn-icon svg {
      width: 100%;
      height: 100%;
      fill: currentColor;
    }
    .wa-action-btn .wa-btn-text {
      display: inline-flex;
      flex-direction: column;
      align-items: flex-start;
      line-height: 1.25;
    }
    .wa-action-btn .wa-btn-text small {
      font-size: 0.68rem;
      font-weight: 500;
      opacity: 0.85;
    }
    .wa-action-btn .fa-arrow-right { font-size: 0.8rem; opacity: 0.9; }

    /* Slot wrapper keeps spacing tidy inside success screens */
    .wa-slot {
      display: flex;
      justify-content: center;
      width: 100%;
      margin: 6px 0 2px;
    }

    /* ── Floating success popup ─────────────────────────────── */
    .wa-popup-overlay {
      position: fixed;
      inset: 0;
      z-index: 12000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(2, 6, 23, 0.72);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      opacity: 0;
      transition: opacity 0.22s ease;
    }
    .wa-popup-overlay.active { opacity: 1; }

    .wa-popup-card {
      position: relative;
      width: min(430px, 94vw);
      max-height: 90vh;
      overflow-y: auto;
      background: linear-gradient(160deg, #101828 0%, #0b1220 100%);
      border: 1px solid rgba(37, 211, 102, 0.35);
      border-radius: 18px;
      padding: 30px 26px 24px;
      text-align: center;
      font-family: var(--font-body, 'Segoe UI', system-ui, sans-serif);
      color: var(--clr-text-primary, #e2e8f0);
      box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255,255,255,0.03) inset;
      transform: translateY(14px) scale(0.97);
      transition: transform 0.24s cubic-bezier(0.34, 1.4, 0.64, 1);
    }
    .wa-popup-overlay.active .wa-popup-card { transform: translateY(0) scale(1); }

    .wa-popup-close {
      position: absolute;
      top: 12px;
      right: 12px;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 50%;
      color: #94a3b8;
      font-size: 0.85rem;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .wa-popup-close:hover { background: rgba(239, 68, 68, 0.18); color: #fca5a5; border-color: rgba(239,68,68,0.4); }

    .wa-popup-check {
      width: 66px;
      height: 66px;
      margin: 0 auto 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: radial-gradient(circle at 30% 30%, rgba(74, 222, 128, 0.35), rgba(34, 197, 94, 0.12));
      border: 1.5px solid rgba(74, 222, 128, 0.55);
      animation: waPopIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
    }
    .wa-popup-check i { font-size: 1.7rem; color: #4ade80; }
    @keyframes waPopIn {
      from { transform: scale(0.4); opacity: 0; }
      to   { transform: scale(1);   opacity: 1; }
    }

    .wa-popup-title {
      margin: 0 0 6px;
      font-size: 1.15rem;
      font-weight: 800;
      letter-spacing: 0.01em;
      color: var(--clr-text-primary, #f1f5f9);
    }
    .wa-popup-subtitle {
      margin: 0 0 16px;
      font-size: 0.84rem;
      line-height: 1.5;
      color: var(--clr-text-secondary, #94a3b8);
    }

    .wa-popup-preview {
      text-align: left;
      white-space: pre-wrap;
      word-break: break-word;
      margin: 0 0 18px;
      padding: 14px 16px;
      background: rgba(37, 211, 102, 0.07);
      border: 1px dashed rgba(37, 211, 102, 0.35);
      border-radius: 12px;
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 0.76rem;
      line-height: 1.65;
      color: #bbf7d0;
      max-height: 180px;
      overflow-y: auto;
    }
    .wa-popup-preview-label {
      display: block;
      margin-bottom: 8px;
      font-family: var(--font-body, 'Segoe UI', system-ui, sans-serif);
      font-size: 0.62rem;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #4ade80;
    }

    .wa-popup-recipient {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      margin: -6px 0 14px;
      font-size: 0.78rem;
      color: var(--clr-text-secondary, #94a3b8);
    }
    .wa-popup-recipient strong { color: #4ade80; font-weight: 700; letter-spacing: 0.03em; }

    .wa-popup-actions {
      display: flex;
      flex-direction: column;
      gap: 10px;
      align-items: stretch;
    }
    .wa-popup-dismiss {
      padding: 10px 16px;
      background: transparent;
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: 10px;
      color: var(--clr-text-secondary, #94a3b8);
      font-family: inherit;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .wa-popup-dismiss:hover {
      border-color: rgba(148, 163, 184, 0.6);
      color: var(--clr-text-primary, #e2e8f0);
    }
  `;
  document.head.appendChild(style);
})();

/* ═══════════════════════════════════════════════════════════════
   WHATSAPP LOGO (inline SVG — no icon-font dependency)
   ═══════════════════════════════════════════════════════════════ */
const WA_LOGO_SVG = `
<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
  <path d="M16.004 3.2c-7.06 0-12.8 5.74-12.803 12.797 0 2.256.59 4.46 1.71 6.403L3.2 28.8l6.56-1.68a12.75 12.75 0 0 0 6.24 1.6h.005c7.058 0 12.798-5.74 12.8-12.797A12.72 12.72 0 0 0 25.36 6.85 12.71 12.71 0 0 0 16.004 3.2zm0 23.394h-.004a10.63 10.63 0 0 1-5.415-1.483l-.389-.23-4.03 1.032 1.076-3.93-.253-.403a10.61 10.61 0 0 1-1.627-5.66c.002-5.873 4.78-10.65 10.657-10.65a10.57 10.57 0 0 1 7.52 3.12 10.56 10.56 0 0 1 3.115 7.517c-.003 5.874-4.78 10.65-10.65 10.65zm5.84-7.967c-.32-.16-1.893-.933-2.186-1.04-.293-.106-.507-.16-.72.16-.213.32-.826 1.04-1.013 1.253-.187.213-.373.24-.693.08-.32-.16-1.352-.498-2.574-1.588-.951-.848-1.593-1.895-1.78-2.215-.186-.32-.02-.494.14-.653.144-.143.32-.373.48-.56.16-.187.213-.32.32-.533.107-.214.053-.4-.027-.56-.08-.16-.72-1.733-.986-2.373-.26-.623-.523-.54-.72-.547l-.613-.01c-.213 0-.56.08-.853.4-.293.32-1.12 1.093-1.12 2.667s1.147 3.093 1.307 3.307c.16.213 2.253 3.44 5.46 4.823.763.33 1.359.527 1.823.674.766.244 1.463.21 2.014.127.614-.092 1.893-.773 2.16-1.52.267-.747.267-1.387.187-1.52-.08-.133-.293-.213-.613-.373z"/>
</svg>`;

/* ═══════════════════════════════════════════════════════════════
   MESSAGE BUILDER — join lines with real newlines
   (uses String.fromCharCode(10) so call sites never need escape
    sequences that editors/formatters may mangle)
   ═══════════════════════════════════════════════════════════════ */
function waMsg(lines) {
  const NL = String.fromCharCode(10);
  if (Array.isArray(lines)) return lines.join(NL);
  return String(lines || '');
}

/* ═══════════════════════════════════════════════════════════════
   RECIPIENT LOOKUP — "WP" sheet (Column A = Scenario, B = Number)
   Re-fetched on EVERY redirect so number changes apply instantly.
   ═══════════════════════════════════════════════════════════════ */
function waWpSheetUrl() {
  if (typeof CONFIG !== 'undefined' && CONFIG.SHEETBEST_WP_URL) return CONFIG.SHEETBEST_WP_URL;
  const base = (typeof CONFIG !== 'undefined' && CONFIG.SHEETBEST_URL)
    ? CONFIG.SHEETBEST_URL
    : 'https://api.sheetbest.com/sheets/dd583123-5c7c-4279-8303-2aea56b7c8aa';
  return `${base}/tabs/WP`;
}

function waNormScenario(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/* Pick the number cell from a WP row (Column B, header-tolerant) */
function waPickNumber(row) {
  const keys = [
    'Whatsapp Number', 'WhatsApp Number', 'Whatsapp number',
    'whatsapp number', 'WhatsApp', 'Whatsapp',
    'Number', 'Phone', 'Mobile', 'Phone Number',
  ];
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
      return row[k];
    }
  }
  // Fallback: first non-Scenario / non-id column value
  const fallbackKey = Object.keys(row).find(k =>
    k !== '_id' &&
    !k.toLowerCase().includes('scenario') &&
    String(row[k]).trim() !== ''
  );
  return fallbackKey ? row[fallbackKey] : '';
}

/* Normalise a local number to international format for wa.me
   "786616438" → "94786616438" | "0786616438" → "94786616438"     */
function waNormalizeNumber(raw) {
  let digits = String(raw || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  const cc = WA_DEFAULT_COUNTRY_CODE;
  if (digits.startsWith(cc) && digits.length >= cc.length + 9) return digits;
  if (digits.startsWith('0')) return cc + digits.slice(1);
  if (digits.length === 9) return cc + digits;
  return digits;
}

/**
 * Fetch the WhatsApp number (Column B) for a scenario AND the
 * message link from cell C1 (3rd column of row 1) of the WP sheet.
 * Always performs a fresh fetch — numbers AND the link may change
 * at any time, so nothing is cached.
 * @param {string} scenario  exact text from Column A (see WA_SCENARIOS)
 * @returns {Promise<{phone: string, link: string}>}
 * @throws if the sheet is unreachable or the scenario is not found
 */
async function waFetchWpData(scenario) {
  const res = await fetch(waWpSheetUrl(), { method: 'GET' });
  if (!res.ok) throw new Error(`WP sheet error ${res.status}`);

  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Unexpected WP sheet response');
  }

  // Cell C1 link — SheetBest uses sheet row 1 as column names, so a
  // link typed into C1 surfaces as the 3rd column KEY; a link typed
  // into the first data row surfaces as that column's VALUE.
  // Check both and extract the first URL found.
  const firstKeys = Object.keys(rows[0]).filter(k => k !== '_id');
  const linkKey   = firstKeys[2];
  let link = '';
  if (linkKey !== undefined) {
    const candidates = [String(linkKey || ''), String(rows[0][linkKey] || '')];
    for (const candidate of candidates) {
      const match = candidate.match(/https?:\/\/[^\s]+/i);
      if (match) { link = match[0].trim(); break; }
    }
  }

  const wanted = waNormScenario(scenario);
  const row = rows.find(r =>
    r && waNormScenario(r['Scenario'] ?? r['scenario'] ?? '') === wanted
  );
  if (!row) throw new Error(`Scenario not found in WP sheet: "${scenario}"`);

  const phone = waNormalizeNumber(waPickNumber(row));
  if (!phone) throw new Error(`No WhatsApp number set for scenario: "${scenario}"`);
  return { phone, link };
}

/**
 * Fetch just the WhatsApp number for a scenario (see waFetchWpData).
 * @param {string} scenario  exact text from Column A (see WA_SCENARIOS)
 * @returns {Promise<string>} international-format number
 */
async function waFetchNumber(scenario) {
  const data = await waFetchWpData(scenario);
  return data.phone;
}

/* ═══════════════════════════════════════════════════════════════
   CORE — OPEN WHATSAPP WITH A PRE-FILLED MESSAGE
   ═══════════════════════════════════════════════════════════════ */
function waBuildURL(message, phone) {
  const text = encodeURIComponent(message || '');
  const num  = String(phone || '').replace(/[^0-9]/g, '');
  return num ? `https://wa.me/${num}?text=${text}` : `https://api.whatsapp.com/send?text=${text}`;
}

/**
 * Resolve the recipient for `scenario` from the WP sheet, append the
 * cell-C1 link (freshly fetched — it changes over time) to the
 * message, then open WhatsApp. If the sheet lookup fails, falls back
 * to WhatsApp's contact picker so the flow never blocks.
 * @param {string} scenario  key from WA_SCENARIOS (Column A text)
 * @param {string} message   pre-filled WhatsApp text
 * @param {string} [phone]   optional explicit override number
 * @returns {Promise<string>} the number used ('' if contact picker)
 */
async function waOpen(scenario, message, phone) {
  let num  = String(phone || '').replace(/[^0-9]/g, '');
  let link = '';
  if (scenario) {
    try {
      const data = await waFetchWpData(scenario);
      if (!num) num = data.phone;
      link = data.link || '';
    } catch (err) {
      console.warn('[WA] Recipient lookup failed, opening contact picker:', err.message);
    }
  }
  // Append the C1 link on its own line at the end of the message
  const finalMessage = link ? waMsg([message || '', '', link]) : (message || '');
  const url = waBuildURL(finalMessage, num);
  // window.open must happen in the click task; popup blockers may
  // complain about the async gap, so fall back to same-tab redirect.
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (!win) window.location.href = url;
  return num;
}

/* ═══════════════════════════════════════════════════════════════
   INLINE BUTTON — render "Switch to WhatsApp" into a container
   ═══════════════════════════════════════════════════════════════
   @param {string|HTMLElement} target  container id or element
   @param {string}             message pre-filled WhatsApp text
   @param {Object}             [options]
   @param {string}             [options.scenario] WP Column A text
   @param {string}             [options.label]    button label
   @param {string}             [options.sub]      small sub-label
   @param {string}             [options.phone]    explicit override
   @returns {HTMLButtonElement|null}
   ═══════════════════════════════════════════════════════════════ */
function injectWhatsAppButton(target, message, options = {}) {
  const el = typeof target === 'string' ? document.getElementById(target) : target;
  if (!el) return null;

  const label = options.label || 'Switch to WhatsApp';
  const sub   = options.sub   || '';

  el.classList.add('wa-slot');
  el.innerHTML = `
    <button type="button" class="wa-action-btn">
      <span class="wa-btn-icon">${WA_LOGO_SVG}</span>
      <span class="wa-btn-text">
        <strong>${label}</strong>
        ${sub ? `<small>${sub}</small>` : ''}
      </span>
      <i class="fa-solid fa-arrow-right"></i>
    </button>
  `;

  const btn = el.querySelector('.wa-action-btn');
  if (btn) {
    btn.addEventListener('click', async () => {
      const original = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `
        <span class="wa-btn-icon">${WA_LOGO_SVG}</span>
        <span class="wa-btn-text"><strong>Fetching recipient…</strong></span>
      `;
      try {
        await waOpen(options.scenario, message, options.phone);
      } finally {
        btn.disabled = false;
        btn.innerHTML = original;
      }
    });
  }
  return btn;
}

/* ═══════════════════════════════════════════════════════════════
   FLOATING SUCCESS POPUP with "Switch to WhatsApp" action
   ═══════════════════════════════════════════════════════════════
   @param {Object}   cfg
   @param {string}   cfg.title     popup heading
   @param {string}   cfg.subtitle  short description under heading
   @param {string}   cfg.message   pre-filled WhatsApp text
   @param {string}   [cfg.scenario] WP Column A text → recipient
   @param {string}   [cfg.phone]   explicit override number
   @param {Function} [cfg.onClose] called after popup dismissed
   ═══════════════════════════════════════════════════════════════ */
function showWhatsAppActionPopup(cfg = {}) {
  closeWhatsAppActionPopup();

  const overlay = document.createElement('div');
  overlay.className = 'wa-popup-overlay';
  overlay.id = 'waActionPopup';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const safeTitle    = cfg.title    || 'Done!';
  const safeSubtitle = cfg.subtitle || '';
  const msg          = cfg.message  || '';

  overlay.innerHTML = `
    <div class="wa-popup-card">
      <button type="button" class="wa-popup-close" aria-label="Close">
        <i class="fa-solid fa-xmark"></i>
      </button>

      <div class="wa-popup-check"><i class="fa-solid fa-check"></i></div>
      <h3 class="wa-popup-title">${safeTitle}</h3>
      ${safeSubtitle ? `<p class="wa-popup-subtitle">${safeSubtitle}</p>` : ''}

      ${msg ? `
      <div class="wa-popup-preview">
        <span class="wa-popup-preview-label">WhatsApp Message Preview</span><span class="wa-popup-preview-text"></span>
      </div>` : ''}

      <div class="wa-popup-recipient" id="waPopupRecipient">
        <i class="fa-solid fa-user"></i>
        <span>Recipient: <strong>resolving from WP sheet…</strong></span>
      </div>

      <div class="wa-popup-actions">
        <button type="button" class="wa-action-btn">
          <span class="wa-btn-icon">${WA_LOGO_SVG}</span>
          <span class="wa-btn-text"><strong>Switch to WhatsApp</strong></span>
          <i class="fa-solid fa-arrow-right"></i>
        </button>
        <button type="button" class="wa-popup-dismiss">Continue without WhatsApp</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Set message text via textContent (safe — no HTML injection possible)
  const previewText = overlay.querySelector('.wa-popup-preview-text');
  if (previewText) previewText.textContent = msg;

  // Resolve + display the recipient number from the WP sheet
  const recipientEl = overlay.querySelector('#waPopupRecipient');
  let resolvedPhone = String(cfg.phone || '').replace(/[^0-9]/g, '');
  if (recipientEl && cfg.scenario) {
    waFetchNumber(cfg.scenario)
      .then(num => {
        resolvedPhone = num;
        const target = recipientEl.querySelector('strong');
        if (target) target.textContent = '+' + num;
      })
      .catch(err => {
        console.warn('[WA] Recipient preview lookup failed:', err.message);
        const target = recipientEl.querySelector('strong');
        if (target) target.textContent = 'unavailable — contact picker will open';
      });
  } else if (recipientEl && resolvedPhone) {
    const target = recipientEl.querySelector('strong');
    if (target) target.textContent = '+' + resolvedPhone;
  }

  requestAnimationFrame(() => overlay.classList.add('active'));

  const dismiss = () => {
    closeWhatsAppActionPopup();
    if (typeof cfg.onClose === 'function') cfg.onClose();
  };

  const waBtn = overlay.querySelector('.wa-action-btn');
  if (waBtn) {
    waBtn.addEventListener('click', async () => {
      const original = waBtn.innerHTML;
      waBtn.disabled = true;
      waBtn.innerHTML = `
        <span class="wa-btn-icon">${WA_LOGO_SVG}</span>
        <span class="wa-btn-text"><strong>Opening WhatsApp…</strong></span>
      `;
      try {
        // Re-check column B at click time (numbers may have changed
        // since the popup opened); fall back to the previewed number.
        await waOpen(cfg.scenario, msg, resolvedPhone);
      } finally {
        waBtn.disabled = false;
        waBtn.innerHTML = original;
      }
    });
  }
  overlay.querySelector('.wa-popup-close')?.addEventListener('click', dismiss);
  overlay.querySelector('.wa-popup-dismiss')?.addEventListener('click', dismiss);

  // Click on dark backdrop closes
  overlay.addEventListener('click', (e) => { if (e.target === overlay) dismiss(); });

  // Escape key closes
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      document.removeEventListener('keydown', escHandler);
      dismiss();
    }
  };
  document.addEventListener('keydown', escHandler);
}

/* Remove the popup if present */
function closeWhatsAppActionPopup() {
  const existing = document.getElementById('waActionPopup');
  if (existing) existing.remove();
}