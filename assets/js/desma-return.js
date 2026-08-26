'use strict';

/* ═══════════════════════════════════════════════════════════════
   DESMA OUTSOLE RETURN MODULE — JavaScript
   Concord Footwear (Pvt) Ltd
   ───────────────────────────────────────────────────────────────
   Flow:
     1. Choose the return destination  →  GFU  or  Storse
     2. Give the return gatepass a name
     3. Scan / verify QR codes (same presses as the Desma In
        module). On verify, the GFU Out sheet columns N / O / P
        are updated with:
          N → Return Sttus  ("Desma To GFU" | "Desma To Storse")
          O → Return Date
          P → Returned User
     4. Complete gatepass → the record is saved to the
        "Desma Return Gatepass" sheet in the same column order
        as the Desma In Gatepass sheet.
   ═══════════════════════════════════════════════════════════════ */

const DR = {
  returnTarget:   null,   // 'GFU' | 'Storse'
  gatepassName:   null,
  verifiedItems:  [],
  qrScanner:      null,
  qrRunning:      false,
  qrResult:       null,
  currentCamera:  'environment',
  matchedRow:     null,
  verifying:      false,
  completing:     false,
};

/* ─────────────────────────────────────────────────────────────
   INITIALIZATION
   ───────────────────────────────────────────────────────────── */
function initDesmaReturnModule(bodyEl) {
  DR.returnTarget  = null;
  DR.gatepassName  = null;
  DR.verifiedItems = [];
  DR.qrScanner     = null;
  DR.qrRunning     = false;
  DR.qrResult      = null;
  DR.matchedRow    = null;
  DR.verifying     = false;
  DR.completing    = false;

  bodyEl.innerHTML = buildDRTargetScreen();
}

/* ─────────────────────────────────────────────────────────────
   STEP 1 — RETURN DESTINATION (GFU or Storse)
   ───────────────────────────────────────────────────────────── */
function buildDRTargetScreen() {
  return `
    <div class="pi-gatepass-name-screen di-gatepass-name-screen" id="drTargetScreen">
      <div class="pi-gp-icon di-gp-icon">
        <i class="fa-solid fa-rotate-left"></i>
      </div>
      <h3 class="pi-gp-title di-gp-title">Outsole Return</h3>
      <p class="pi-gp-subtitle di-gp-subtitle">
        Where should the outsole materials be returned to?<br/>
        Select a destination to continue.
      </p>

      <div class="dr-target-choice">
        <button class="dr-target-btn dr-target-gfu" onclick="drChooseTarget('GFU')"
                aria-label="Return to GFU">
          <i class="fa-solid fa-industry"></i>
          <span class="dr-target-name">GFU</span>
          <span class="dr-target-desc">Desma To GFU</span>
        </button>
        <button class="dr-target-btn dr-target-storse" onclick="drChooseTarget('Storse')"
                aria-label="Return to Storse">
          <i class="fa-solid fa-warehouse"></i>
          <span class="dr-target-name">Storse</span>
          <span class="dr-target-desc">Desma To Storse</span>
        </button>
      </div>
    </div>

    <div class="pi-toast di-toast" id="drToast" role="status" aria-live="polite"></div>
  `;
}

function drChooseTarget(target) {
  if (target !== 'GFU' && target !== 'Storse') {
    drToast('Please choose GFU or Storse.', 'error');
    return;
  }
  DR.returnTarget = target;

  const bodyEl = document.getElementById('moduleBody');
  if (bodyEl) bodyEl.innerHTML = buildDRGatepassNameScreen();
}

/* ─────────────────────────────────────────────────────────────
   STEP 2 — GATEPASS NAME
   ───────────────────────────────────────────────────────────── */
function buildDRGatepassNameScreen() {
  return `
    <div class="pi-gatepass-name-screen di-gatepass-name-screen" id="drGatepassNameScreen">
      <div class="pi-gp-icon di-gp-icon">
        <i class="fa-solid fa-rotate-left"></i>
      </div>
      <h3 class="pi-gp-title di-gp-title">Create New Outsole Return Gatepass</h3>
      <p class="pi-gp-subtitle di-gp-subtitle">
        Return destination: <strong style="color:#2dd4bf;">${drEscape(DR.returnTarget)}</strong><br/>
        Enter a unique name for this return gatepass.
        All verified material items will be grouped under this gatepass.
      </p>
      <div class="pi-gp-input-wrap">
        <label class="pi-field-label di-field-label" for="drGatepassNameInput">GATEPASS NAME</label>
        <input type="text" id="drGatepassNameInput"
               class="pi-text-input di-text-input"
               placeholder="e.g., DESMA-RET-2026-001"
               aria-label="Gatepass name"
               onkeydown="if(event.key==='Enter')drStartGatepass()" />
      </div>
      <button class="pi-btn-start-gatepass di-btn-start-gatepass" onclick="drStartGatepass()">
        <i class="fa-solid fa-arrow-right"></i> Start Gatepass
      </button>
    </div>

    <div class="pi-toast di-toast" id="drToast" role="status" aria-live="polite"></div>
  `;
}

function drStartGatepass() {
  const input = document.getElementById('drGatepassNameInput');
  const name  = input?.value?.trim();

  if (!name) {
    drToast('Please enter a gatepass name.', 'error');
    return;
  }

  DR.gatepassName  = name;
  DR.verifiedItems = [];

  const bodyEl = document.getElementById('moduleBody');
  if (bodyEl) bodyEl.innerHTML = buildDRGatepassWorkflow();

  setTimeout(() => drStartQR(), 300);
}

/* ─────────────────────────────────────────────────────────────
   STEP 3 — GATEPASS WORKFLOW (same presses as Desma In)
   ───────────────────────────────────────────────────────────── */
function buildDRGatepassWorkflow() {
  return `
    <div class="pi-gatepass-workflow di-gatepass-workflow">

      <div class="pi-gp-header di-gp-header">
        <div class="pi-gp-header-icon di-gp-header-icon">
          <i class="fa-solid fa-rotate-left"></i>
        </div>
        <div class="pi-gp-header-info">
          <div class="pi-gp-header-label">Active Outsole Return Gatepass</div>
          <div class="pi-gp-header-name di-gp-header-name" id="drGPHeaderName">${drEscape(DR.gatepassName)}</div>
        </div>
        <div class="pi-gp-count-badge di-gp-count-badge" id="drGPCountBadge">
          <span id="drGPCount">0</span> items
        </div>
      </div>

      <div class="pi-gp-layout di-gp-layout">

        <div class="pi-gp-left di-gp-left">
          <div class="pi-section-label di-section-label">
            <i class="fa-solid fa-qrcode"></i> Scan or Enter QR Code
          </div>

          <div class="pi-tab-bar di-tab-bar">
            <button class="pi-tab-btn di-tab-btn active" id="drTabScan" onclick="drSwitchTab('scan')" aria-selected="true">
              <i class="fa-solid fa-camera"></i> Scan
            </button>
            <button class="pi-tab-btn di-tab-btn" id="drTabManual" onclick="drSwitchTab('manual')" aria-selected="false">
              <i class="fa-solid fa-keyboard"></i> Manual
            </button>
          </div>

          <div id="drPanelScan">
            <div class="pi-viewport-wrap di-viewport-wrap">
              <div id="drQRReader"></div>
              <div class="pi-corner di-corner tl"></div>
              <div class="pi-corner di-corner tr"></div>
              <div class="pi-corner di-corner bl"></div>
              <div class="pi-corner di-corner br"></div>
              <div class="pi-scanline di-scanline" id="drScanLine"></div>
              <div class="pi-status-strip di-status-strip" id="drStatusStrip">
                <i class="fa-solid fa-spinner fa-spin"></i> Starting camera…
              </div>
            </div>
            <button class="pi-btn-toggle-cam di-btn-toggle-cam" onclick="drToggleCam()">
              <i class="fa-solid fa-camera-rotate"></i> Switch Camera
            </button>
          </div>

          <div id="drPanelManual" style="display:none">
            <label class="pi-field-label di-field-label" for="drManualInput">QR CODE VALUE</label>
            <div class="pi-manual-row di-manual-row">
              <input type="text" id="drManualInput"
                     class="pi-text-input di-text-input"
                     placeholder="Type or paste QR code…"
                     oninput="drOnManualInput(this)"
                     onkeydown="if(event.key==='Enter')drConfirmManual()" />
              <button class="pi-btn-confirm-manual di-btn-confirm-manual" onclick="drConfirmManual()">
                <i class="fa-solid fa-magnifying-glass"></i> Look Up
              </button>
            </div>
          </div>

          <div class="pi-qr-result-box di-qr-result-box" id="drQRResultBox">
            <i class="fa-solid fa-check-circle"></i>
            <span>QR: <strong id="drQRResultText"></strong></span>
            <button onclick="drClearQR()" class="pi-btn-clear di-btn-clear" aria-label="Clear QR">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div id="drLookupResult"></div>
        </div>

        <div class="pi-gp-right di-gp-right">
          <div class="pi-section-label di-section-label">
            <i class="fa-solid fa-check-double"></i> Returned Items
          </div>
          <div class="pi-verified-list di-verified-list" id="drVerifiedList">
            <div class="pi-verified-empty di-verified-empty">
              <i class="fa-regular fa-clipboard"></i>
              <span>No items returned yet.<br/>Scan a QR code to begin.</span>
            </div>
          </div>
          <button class="pi-btn-complete-gatepass di-btn-complete-gatepass" id="drBtnCompleteGP" onclick="drCompleteGatepass()" disabled>
            <i class="fa-solid fa-circle-check"></i> Complete Gatepass
          </button>
        </div>

      </div>

    </div>

    <div class="pi-toast di-toast" id="drToast" role="status" aria-live="polite"></div>
  `;
}

function drSwitchTab(tab) {
  const scanBtn    = document.getElementById('drTabScan');
  const manualBtn  = document.getElementById('drTabManual');
  const scanPanel  = document.getElementById('drPanelScan');
  const manualPanel= document.getElementById('drPanelManual');
  if (!scanBtn) return;

  if (tab === 'scan') {
    scanBtn.classList.add('active');    scanBtn.setAttribute('aria-selected', 'true');
    manualBtn.classList.remove('active'); manualBtn.setAttribute('aria-selected', 'false');
    scanPanel.style.display  = 'block';
    manualPanel.style.display= 'none';
    if (!DR.qrResult) drStartQR();
  } else {
    manualBtn.classList.add('active');    manualBtn.setAttribute('aria-selected', 'true');
    scanBtn.classList.remove('active');   scanBtn.setAttribute('aria-selected', 'false');
    manualPanel.style.display= 'block';
    scanPanel.style.display  = 'none';
    drStopQR();
    setTimeout(() => document.getElementById('drManualInput')?.focus(), 100);
  }
}

/* ─────────────────────────────────────────────────────────────
   QR SCANNER
   ───────────────────────────────────────────────────────────── */
async function drStartQR() {
  if (!window.Html5Qrcode) {
    drUpdateStatus('<i class="fa-solid fa-triangle-exclamation" style="color:#f87171"></i> Camera library not loaded.', false);
    return;
  }
  await drStopQR();
  DR.qrScanner = new Html5Qrcode('drQRReader');
  DR.currentCamera = 'environment';
  const config = { fps: 10, qrbox: { width: 220, height: 180 }, aspectRatio: 1.4, disableFlip: false };

  try {
    await DR.qrScanner.start({ facingMode: 'environment' }, config, (text) => drOnQRSuccess(text), () => {});
    DR.qrRunning = true;
    drUpdateStatus('<i class="fa-solid fa-circle-dot" style="color:#14b8a6"></i> Camera active — point at QR code', false);
  } catch {
    try {
      await DR.qrScanner.start({ facingMode: 'user' }, config, (text) => drOnQRSuccess(text), () => {});
      DR.qrRunning = true;
      drUpdateStatus('<i class="fa-solid fa-circle-dot" style="color:#14b8a6"></i> Camera active (front)', false);
    } catch {
      drUpdateStatus('<i class="fa-solid fa-triangle-exclamation" style="color:#f87171"></i> Camera unavailable', false);
    }
  }
}

async function drStopQR() {
  if (DR.qrScanner && DR.qrRunning) {
    try { await DR.qrScanner.stop(); DR.qrScanner.clear(); } catch {}
    DR.qrRunning = false;
    DR.qrScanner = null;
  }
}

async function drToggleCam() {
  if (!DR.qrScanner) return;
  await drStopQR();
  drUpdateStatus('<i class="fa-solid fa-spinner fa-spin"></i> Switching camera…', false);
  DR.currentCamera = DR.currentCamera === 'environment' ? 'user' : 'environment';
  DR.qrScanner = new Html5Qrcode('drQRReader');
  const config = { fps: 10, qrbox: { width: 220, height: 180 }, aspectRatio: 1.4 };
  try {
    await DR.qrScanner.start({ facingMode: DR.currentCamera }, config, (text) => drOnQRSuccess(text), () => {});
    DR.qrRunning = true;
    drUpdateStatus('<i class="fa-solid fa-circle-dot" style="color:#14b8a6"></i> Camera switched', false);
  } catch {
    drUpdateStatus('<i class="fa-solid fa-triangle-exclamation" style="color:#f87171"></i> Could not switch camera', false);
  }
}

function drUpdateStatus(html, detected) {
  const strip = document.getElementById('drStatusStrip');
  if (strip) { strip.innerHTML = html; strip.classList.toggle('detected', detected); }
}

function drOnQRSuccess(text) {
  if (!text || !text.trim()) return;
  DR.qrResult = text.trim();
  drUpdateStatus('<i class="fa-solid fa-qrcode"></i> QR Code captured!', true);
  const scanLine = document.getElementById('drScanLine');
  if (scanLine) scanLine.style.display = 'none';
  const box  = document.getElementById('drQRResultBox');
  const disp = document.getElementById('drQRResultText');
  if (box && disp) { disp.textContent = DR.qrResult; box.classList.add('visible'); }
  drStopQR();
  drToast('QR code captured!', 'success');
  drLookupQR(DR.qrResult);
}

function drOnManualInput(input) {
  DR.qrResult = input.value.trim() || null;
}

function drConfirmManual() {
  const inp = document.getElementById('drManualInput');
  if (!inp || !inp.value.trim()) { drToast('Please enter a QR code value.', 'error'); return; }
  drOnQRSuccess(inp.value.trim());
}

function drClearQR() {
  DR.qrResult   = null;
  DR.matchedRow = null;
  const box = document.getElementById('drQRResultBox');
  if (box) box.classList.remove('visible');
  const line = document.getElementById('drScanLine');
  if (line) line.style.display = '';
  const inp = document.getElementById('drManualInput');
  if (inp) inp.value = '';
  drUpdateStatus('<i class="fa-solid fa-spinner fa-spin"></i> Starting camera…', false);
  const area = document.getElementById('drLookupResult');
  if (area) area.innerHTML = '';
  const scanPanel = document.getElementById('drPanelScan');
  if (scanPanel && scanPanel.style.display !== 'none') drStartQR();
}

/* ─────────────────────────────────────────────────────────────
   QR LOOKUP — GFU Out sheet
   ───────────────────────────────────────────────────────────── */
async function drLookupQR(qrCode) {
  const area = document.getElementById('drLookupResult');
  if (!area) return;
  area.innerHTML = '<div class="pi-lookup-loading di-lookup-loading"><div class="pi-spinner di-spinner"></div><span>Looking up QR code…</span></div>';

  try {
    const res = await fetch(CONFIG.SHEETBEST_GFUOUT_URL, { method: 'GET' });
    if (!res.ok) throw new Error(`Sheet error ${res.status}`);
    const rows = await res.json();
    if (!Array.isArray(rows)) throw new Error('Unexpected response from sheet.');

    const match = rows.find(r => r && drMatchQR(r, qrCode));
    if (!match) { area.innerHTML = buildDRNotFound(qrCode); return; }

    const matchQR = drGetQR(match);
    if (DR.verifiedItems.some(item => drMatchQR(item, matchQR))) {
      area.innerHTML = buildDRAlreadyInGatepass(match);
      return;
    }

    /* Column N — "Return Sttus": block items that were already returned. */
    const returnedFlag = match['Return Sttus'] ?? match['Return_Sttus'] ?? null;
    if (returnedFlag && String(returnedFlag).trim() !== '') {
      area.innerHTML = buildDRAlreadyReturned(match);
      return;
    }

    DR.matchedRow = match;
    area.innerHTML = buildDRDetails(match);

  } catch (err) {
    console.error('[DR] Lookup error:', err);
    area.innerHTML = buildDRError(err.message);
  }
}

function buildDRDetails(row) {
  const qrVal = drGetQR(row);
  return `
    <div class="pi-details-card di-details-card">
      <div class="pi-details-header di-details-header">
        <div class="pi-details-icon di-details-icon"><i class="fa-solid fa-rotate-left"></i></div>
        <div>
          <div class="pi-details-label di-details-label">QR Code Match Found (GFU Out)</div>
          <div class="pi-details-qr-val di-details-qr-val">${drEscape(qrVal ?? '—')}</div>
        </div>
        <span class="pi-badge di-badge pending"><i class="fa-solid fa-clock"></i> Pending Return</span>
      </div>
      <div class="pi-details-grid di-details-grid">
        <div class="pi-detail-cell di-detail-cell">
          <span class="pi-cell-label di-cell-label"><i class="fa-solid fa-hashtag"></i> PO Number</span>
          <span class="pi-cell-value di-cell-value po">${drEscape(drGetProp(row,'PO','PO'))}</span>
        </div>
        <div class="pi-detail-cell di-detail-cell">
          <span class="pi-cell-label di-cell-label"><i class="fa-solid fa-shoe-prints"></i> Model</span>
          <span class="pi-cell-value di-cell-value">${drEscape(drGetProp(row,'Model','Model'))}</span>
        </div>
        <div class="pi-detail-cell di-detail-cell">
          <span class="pi-cell-label di-cell-label"><i class="fa-solid fa-palette"></i> Outsole Colour</span>
          <span class="pi-cell-value di-cell-value">${drEscape(drGetColour(row))}</span>
        </div>
        <div class="pi-detail-cell di-detail-cell">
          <span class="pi-cell-label di-cell-label"><i class="fa-solid fa-ruler"></i> Size</span>
          <span class="pi-cell-value di-cell-value">EU ${drEscape(String(drGetProp(row,'Size','Size')))}</span>
        </div>
        <div class="pi-detail-cell di-detail-cell">
          <span class="pi-cell-label di-cell-label"><i class="fa-solid fa-cubes"></i> QTY</span>
          <span class="pi-cell-value di-cell-value qty">${drEscape(String(drGetProp(row,'QTY','QTY')))}</span>
        </div>
        <div class="pi-detail-cell di-detail-cell">
          <span class="pi-cell-label di-cell-label"><i class="fa-solid fa-file-lines"></i> MRN Reference</span>
          <span class="pi-cell-value di-cell-value" style="font-size:0.78rem">${drEscape(drGetProp(row,'MRN_Name','MRN_Name'))}</span>
        </div>
      </div>
      <div class="pi-verify-block di-verify-block">
        <p class="pi-verify-hint di-verify-hint">
          <i class="fa-solid fa-circle-info"></i>
          Confirm the details above and click <strong>Add to Gatepass</strong> to log this return
          (<strong>Desma To ${drEscape(DR.returnTarget)}</strong>) in the GFU Out sheet.
        </p>

        <div class="pi-verify-actions di-verify-actions">
          <button class="pi-btn-scan-again di-btn-scan-again" onclick="drClearQR()">
            <i class="fa-solid fa-xmark"></i> Cancel
          </button>
          <button class="pi-btn-verify di-btn-verify" id="drBtnVerify" onclick="drVerifyAndAdd()">
            <i class="fa-solid fa-plus-circle"></i> Add to Gatepass
          </button>
        </div>
      </div>
    </div>`;
}

function buildDRAlreadyInGatepass(row) {
  const qrVal = drGetQR(row);
  return `
    <div class="pi-not-found di-not-found">
      <div class="pi-nf-icon di-nf-icon" style="color:#fbbf24"><i class="fa-solid fa-circle-exclamation"></i></div>
      <div class="pi-nf-title di-nf-title">Already in Gatepass</div>
      <div class="pi-nf-body di-nf-body">
        QR code <strong>"${drEscape(qrVal ?? '—')}"</strong> has already been added to this return gatepass.
      </div>
      <button class="pi-btn-scan-again di-btn-scan-again" onclick="drClearQR()">
        <i class="fa-solid fa-qrcode"></i> Scan Another
      </button>
    </div>`;
}

function buildDRAlreadyReturned(row) {
  const qrVal = drGetQR(row);
  const rUser = drGetProp(row, 'Returned User', 'Returned_User');
  const rDate = drGetProp(row, 'Return Date',  'Return_Date');
  return `
    <div class="pi-not-found di-not-found">
      <div class="pi-nf-icon di-nf-icon" style="color:#14b8a6"><i class="fa-solid fa-circle-check"></i></div>
      <div class="pi-nf-title di-nf-title">Already Returned</div>
      <div class="pi-nf-body di-nf-body">
        This QR code was already returned (${drEscape(drGetProp(row, 'Return Sttus', 'Return_Sttus'))})
        by <strong>${drEscape(rUser)}</strong> on ${drEscape(rDate)}.
      </div>
      <button class="pi-btn-scan-again di-btn-scan-again" onclick="drClearQR()">
        <i class="fa-solid fa-qrcode"></i> Scan Another
      </button>
    </div>`;
}

function buildDRNotFound(qrCode) {
  return `
    <div class="pi-not-found di-not-found">
      <div class="pi-nf-icon di-nf-icon"><i class="fa-solid fa-circle-xmark"></i></div>
      <div class="pi-nf-title di-nf-title">No Record Found</div>
      <div class="pi-nf-body di-nf-body">
        QR code <strong>"${drEscape(qrCode)}"</strong> does not match any GFU Outbound record.
      </div>
      <button class="pi-btn-scan-again di-btn-scan-again" onclick="drClearQR()">
        <i class="fa-solid fa-rotate-left"></i> Try Again
      </button>
    </div>`;
}

function buildDRError(msg) {
  return `
    <div class="pi-not-found di-not-found">
      <div class="pi-nf-icon di-nf-icon" style="color:#f87171"><i class="fa-solid fa-triangle-exclamation"></i></div>
      <div class="pi-nf-title di-nf-title">Lookup Failed</div>
      <div class="pi-nf-body di-nf-body">${drEscape(msg || 'Could not reach the sheet.')}</div>
      <button class="pi-btn-scan-again di-btn-scan-again" onclick="drClearQR()">
        <i class="fa-solid fa-rotate-left"></i> Try Again
      </button>
    </div>`;
}

/* ─────────────────────────────────────────────────────────────
   VERIFY & ADD — patches GFU Out columns N / O / P
   ───────────────────────────────────────────────────────────── */
async function drVerifyAndAdd() {
  if (!DR.matchedRow || DR.verifying) return;

  DR.verifying = true;

  const btn = document.getElementById('drBtnVerify');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying…'; }

  const user    = sessionStorage.getItem('sm_user') || 'Unknown';
  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-GB',  { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-GB',  { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const returnStatus = DR.returnTarget === 'Storse' ? 'Desma To Storse' : 'Desma To GFU';
  const matchedQR    = drGetQR(DR.matchedRow);
  const patchUrl     = `${CONFIG.SHEETBEST_GFUOUT_URL}/QR%20Code/${encodeURIComponent(String(matchedQR ?? ''))}`;

  /* Columns N / O / P in the GFU Out sheet */
  const payload = {
    'Return Sttus':  returnStatus,
    'Return Date':   dateStr,
    'Returned User': user,
  };

  try {
    const res = await fetch(patchUrl, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody?.message || `HTTP ${res.status}`);
    }

    const verifiedItem = {
      QR_Code:        matchedQR,
      PO:             drGetProp(DR.matchedRow, 'PO', 'PO'),
      Model:          drGetProp(DR.matchedRow, 'Model', 'Model'),
      Outsole_Colour: drGetColour(DR.matchedRow),
      Size:           drGetProp(DR.matchedRow, 'Size', 'Size'),
      QTY:            drGetProp(DR.matchedRow, 'QTY', 'QTY'),
      MRN_Name:       drGetProp(DR.matchedRow, 'MRN_Name', 'MRN_Name'),
      ...payload,
      ReturnedAt: now.toISOString(),
    };
    DR.verifiedItems.push(verifiedItem);
    DR.verifying = false;

    drToast(`Returned — ${returnStatus}!`, 'success');
    drUpdateVerifiedList();
    drClearQR();

  } catch (err) {
    console.error('[DR] Verify PATCH error:', err);
    DR.verifying = false;
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-plus-circle"></i> Add to Gatepass'; }
    drToast(`Return failed: ${err.message}`, 'error');
  }
}

function drUpdateVerifiedList() {
  const list = document.getElementById('drVerifiedList');
  const countBadge = document.getElementById('drGPCount');
  const completeBtn = document.getElementById('drBtnCompleteGP');

  if (!list) return;

  if (DR.verifiedItems.length === 0) {
    list.innerHTML = `
      <div class="pi-verified-empty di-verified-empty">
        <i class="fa-regular fa-clipboard"></i>
        <span>No items returned yet.<br/>Scan a QR code to begin.</span>
      </div>`;
    if (completeBtn) completeBtn.disabled = true;
    if (countBadge) countBadge.textContent = '0';
    return;
  }

  let html = '';
  DR.verifiedItems.forEach((item, idx) => {
    html += `
      <div class="pi-verified-item di-verified-item">
        <div class="pi-vi-header di-vi-header">
          <span class="pi-vi-num di-vi-num">#${idx + 1}</span>
          <span class="pi-vi-qr di-vi-qr">${drEscape(item.QR_Code)}</span>
          <button class="pi-btn-remove-item di-btn-remove-item" onclick="drRemoveItem(${idx})" title="Remove from gatepass">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="pi-vi-body di-vi-body">
          <span><strong>PO:</strong> ${drEscape(item.PO || '—')}</span>
          <span><strong>Model:</strong> ${drEscape(item.Model || '—')}</span>
          <span><strong>Colour:</strong> ${drEscape(item.Outsole_Colour || '—')}</span>
          <span><strong>Size:</strong> EU ${drEscape(String(item.Size || '—'))}</span>
          <span><strong>QTY:</strong> ${drEscape(String(item.QTY || '—'))}</span>
          <span><strong>To:</strong> ${drEscape(item['Return Sttus'] || '—')}</span>
        </div>
      </div>`;
  });

  list.innerHTML = html;
  if (countBadge) countBadge.textContent = DR.verifiedItems.length;
  if (completeBtn) completeBtn.disabled = false;
}

function drRemoveItem(index) {
  if (index < 0 || index >= DR.verifiedItems.length) return;
  const item = DR.verifiedItems[index];

  if (!confirm(`Remove ${item.QR_Code} from this return gatepass?`)) return;

  DR.verifiedItems.splice(index, 1);
  drUpdateVerifiedList();
  drToast('Item removed from gatepass.', 'info');
}

async function drCompleteGatepass() {
  if (DR.verifiedItems.length === 0 || DR.completing) return;

  if (!confirm(`Complete return gatepass "${DR.gatepassName}" with ${DR.verifiedItems.length} items?`)) return;

  DR.completing = true;
  const btn = document.getElementById('drBtnCompleteGP');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…'; }

  try {
    await drSaveGatepassRecord();
    drShowGatepassSuccess();

  } catch (err) {
    console.error('[DR] Complete gatepass error:', err);
    DR.completing = false;
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Complete Gatepass'; }
    drToast(`Failed to complete gatepass: ${err.message}`, 'error');
  }
}

async function drSaveGatepassRecord() {
  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const returnStatus = DR.returnTarget === 'Storse' ? 'Desma To Storse' : 'Desma To GFU';

  const gatepassData = {
    GatepassName:   DR.gatepassName,
    ReturnType:     returnStatus,
    CreatedBy:      sessionStorage.getItem('sm_user') || 'Unknown',
    CreatedDate:    dateStr,
    CreatedTime:    timeStr,
    ItemCount:      DR.verifiedItems.length,
    TotalQty:       DR.verifiedItems.reduce((s, i) => s + (parseInt(i.QTY) || 0), 0),
    Items:          DR.verifiedItems.map(item => ({
      QR_Code:        item.QR_Code,
      PO:             item.PO,
      Model:          item.Model,
      Outsole_Colour: item.Outsole_Colour,
      Size:           item.Size,
      QTY:            item.QTY,
      MRN_Name:       item.MRN_Name,
      Return_Status:  item['Return Sttus'],
      Return_Date:    item['Return Date'],
      Returned_User:  item['Returned User'],
    })),
  };

  /* Same column order as the Desma In Gatepass sheet.
     NOTE: columns F/G/H use the "Manegement" typo — must match the
     Desma Return Gatepass sheet headers exactly. */
  const rowData = {
    Rows_JSON:                  JSON.stringify(gatepassData),
    'Created Date':             dateStr,
    'Created Time':             timeStr,
    Status:                     'Pending Approval',
    'Gatepass name':            DR.gatepassName,
    'Approved Manegement User': '',
    'Manegement Approve Date':  '',
    'Manegement Approve Time':  '',
    'Approved HR User':         '',
    'HR Approve Date':          '',
    'HR Approve Time':          '',
    'Vehicle Number':           '',
    'Driver Name':              '',
    'Transport Remarks':        '',
    'Assigned By (username)':   '',
    'Assignment Date':          '',
    'Assignment Time':          '',
  };

  const sheetUrl = CONFIG.SHEETBEST_DESMA_RETURN_GATEPASS_URL
    || `${CONFIG.SHEETBEST_URL}/tabs/Desma Return Gatepass`;

  console.log('[DR] Saving return gatepass to:', sheetUrl);
  console.log('[DR] Row payload keys:', Object.keys(rowData));

  const res = await fetch(sheetUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(rowData),
  });

  if (!res.ok) {
    let errText = '';
    try   { errText = await res.text(); } catch (_) { /* ignore */ }
    console.error('[DR] SheetBest error response (status=' + res.status + '):', errText);
    let parsedErr = {};
    try   { parsedErr = JSON.parse(errText); } catch (_) { /* ignore */ }
    const msg = parsedErr?.message || parsedErr?.error || errText || `Sheet save failed: ${res.status}`;
    throw new Error(msg);
  }

  try {
    const saved = await res.json();
    console.log('[DR] SheetBest save success:', saved);
  } catch (_) { /* ignore */ }
}

function drShowGatepassSuccess() {
  const bodyEl = document.getElementById('moduleBody');
  if (!bodyEl) return;

  const returnStatus = DR.returnTarget === 'Storse' ? 'Desma To Storse' : 'Desma To GFU';

  bodyEl.innerHTML = `
    <div class="pi-gp-success di-gp-success">
      <div class="pi-success-icon di-success-icon">
        <i class="fa-solid fa-circle-check"></i>
      </div>
      <h3 class="pi-success-title di-success-title">Return Gatepass Complete!</h3>
      <p class="pi-success-body di-success-body">
        Outsole Return Gatepass <strong>"${drEscape(DR.gatepassName)}"</strong> has been successfully created
        with ${DR.verifiedItems.length} returned items and saved to the system.
      </p>
      <div class="pi-success-grid di-success-grid">
        <div class="pi-success-cell di-success-cell">
          <div class="pi-sc-label di-sc-label">Gatepass Name</div>
          <div class="pi-sc-value di-sc-value">${drEscape(DR.gatepassName)}</div>
        </div>
        <div class="pi-success-cell di-success-cell">
          <div class="pi-sc-label di-sc-label">Return Status</div>
          <div class="pi-sc-value di-sc-value" style="color:#2dd4bf">${drEscape(returnStatus)}</div>
        </div>
        <div class="pi-success-cell di-success-cell">
          <div class="pi-sc-label di-sc-label">Items</div>
          <div class="pi-sc-value di-sc-value">${DR.verifiedItems.length}</div>
        </div>
        <div class="pi-success-cell di-success-cell">
          <div class="pi-sc-label di-sc-label">Total QTY</div>
          <div class="pi-sc-value di-sc-value" style="color:#14b8a6">${DR.verifiedItems.reduce((s, i) => s + (parseInt(i.QTY) || 0), 0)}</div>
        </div>
        <div class="pi-success-cell di-success-cell">
          <div class="pi-sc-label di-sc-label">Status</div>
          <div class="pi-sc-value di-sc-value" style="color:#fbbf24">Pending Approval</div>
        </div>
      </div>
      <div class="pi-success-actions di-success-actions">
        <!-- "Switch to WhatsApp" action (injected after return gatepass completion) -->
        <div id="drWhatsAppAction"></div>
        <button class="pi-btn-new-gatepass di-btn-new-gatepass" onclick="drNewGatepass()">
          <i class="fa-solid fa-plus"></i> New Gatepass
        </button>
      </div>
    </div>

    <div class="pi-toast di-toast" id="drToast" role="status" aria-live="polite"></div>
  `;

  drToast('Return gatepass saved successfully!', 'success');

  // ── "Switch to WhatsApp" action (Outsole Return gatepass completed) ──
  if (typeof injectWhatsAppButton === 'function') {
    const waUser = sessionStorage.getItem('sm_user') || 'Unknown';
    const waNow  = new Date();
    injectWhatsAppButton(
      'drWhatsAppAction',
      waMsg([
        '*SOLE MATRIX — Outsole Return Gatepass Created*',
        '',
        '📄 Gatepass: ' + DR.gatepassName,
        '🏢 Department: Desma Department (Outsole Return)',
        '🔁 Return: ' + returnStatus,
        '👤 Created by: ' + waUser,
        '📅 Date: ' + waNow.toLocaleDateString('en-GB') + ' ' +
          waNow.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        '📦 Items: ' + DR.verifiedItems.length +
          ' | Total QTY: ' + DR.verifiedItems.reduce((s, i) => s + (parseInt(i.QTY) || 0), 0),
        '📌 Status: Pending Approval',
      ]),
      {
        label: 'Switch to WhatsApp',
        sub: 'Notify the team about this return gatepass',
        scenario: WA_SCENARIOS.GATEPASS_COMPLETED,
      }
    );
  }

  DR.completing = false;
}

function drNewGatepass() {
  const bodyEl = document.getElementById('moduleBody');
  if (bodyEl) initDesmaReturnModule(bodyEl);
}

function destroyDesmaReturnModule() {
  drStopQR();
  DR.returnTarget  = null;
  DR.gatepassName  = null;
  DR.verifiedItems = [];
  DR.qrResult      = null;
  DR.matchedRow    = null;
  DR.verifying     = false;
  DR.completing    = false;
}

let _drToastTimer = null;

function drToast(message, type = 'info') {
  const toast = document.getElementById('drToast');
  if (!toast) return;
  const icons = { success: 'fa-circle-check', error: 'fa-circle-exclamation', info: 'fa-circle-info' };
  toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i> ${drEscape(message)}`;
  toast.className = `pi-toast di-toast pi-toast-${type} di-toast-${type} show`;
  clearTimeout(_drToastTimer);
  _drToastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

function drEscape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function drGetProp(row, keySpace, keyUnderscore, fallback = '—') {
  if (!row) return fallback;
  if (row[keyUnderscore] !== undefined && row[keyUnderscore] !== null && String(row[keyUnderscore]).trim() !== '') return row[keyUnderscore];
  if (row[keySpace]      !== undefined && row[keySpace]      !== null && String(row[keySpace]).trim()      !== '') return row[keySpace];
  return fallback;
}

function drGetQR(row) {
  return drGetProp(row, 'QR Code', 'QR_Code', null);
}

function drGetColour(row) {
  return drGetProp(row, 'Outsole Colour', 'Outsole_Colour');
}

function drMatchQR(row, qrCode) {
  const cell = drGetQR(row);
  if (cell === null) return false;
  const a = String(cell).trim();
  const b = String(qrCode).trim();
  if (a === b) return true;
  const na = parseFloat(a), nb = parseFloat(b);
  if (!isNaN(na) && !isNaN(nb) && na === nb) return true;
  return false;
}
