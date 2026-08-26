/* ═══════════════════════════════════════════════════════════════
   SOLE MATRIX — Production In Module (Gatepass Workflow)
   Concord Footwear (Pvt) Ltd
   ─────────────────────────────────────────────────────────────
   Flow:
     1. User enters Gatepass Name
     2. User scans/verifies multiple QR codes → tracked under that gatepass
     3. User clicks Complete Gatepass → generates PDF, uploads to Cloudinary,
        saves to 'Storse To GFU Gatepass' sheet
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   MODULE STATE
   ───────────────────────────────────────────────────────────── */
const PI = {
  gatepassName:    null,
  verifiedItems:   [],     // array of verified row objects
  qrScanner:       null,
  qrRunning:       false,
  qrResult:        null,
  currentCamera:   'environment',
  matchedRow:      null,
  verifying:       false,
  completing:      false,
};

/* ─────────────────────────────────────────────────────────────
   ENTRY POINT
   ───────────────────────────────────────────────────────────── */
function initProductionInModule(bodyEl) {
  // Reset state
  PI.gatepassName  = null;
  PI.verifiedItems = [];
  PI.qrScanner     = null;
  PI.qrRunning     = false;
  PI.qrResult      = null;
  PI.matchedRow    = null;
  PI.verifying     = false;
  PI.completing    = false;

  bodyEl.innerHTML = buildGatepassNameScreen();
}

/* ─────────────────────────────────────────────────────────────
   STEP 1 — GATEPASS NAME INPUT
   ───────────────────────────────────────────────────────────── */
function buildGatepassNameScreen() {
  return `
    <div class="pi-gatepass-name-screen" id="piGatepassNameScreen">
      <div class="pi-gp-icon">
        <i class="fa-solid fa-clipboard-list"></i>
      </div>
      <h3 class="pi-gp-title">Create New Gatepass</h3>
      <p class="pi-gp-subtitle">
        Enter a unique name for this Stores to GFU gatepass.
        All verified items will be grouped under this gatepass.
      </p>
      <div class="pi-gp-input-wrap">
        <label class="pi-field-label" for="piGatepassNameInput">GATEPASS NAME</label>
        <input type="text" id="piGatepassNameInput"
               class="pi-text-input"
               placeholder="e.g., GFU-GP-2026-001"
               aria-label="Gatepass name"
               onkeydown="if(event.key==='Enter')piStartGatepass()" />
      </div>
      <button class="pi-btn-start-gatepass" onclick="piStartGatepass()">
        <i class="fa-solid fa-arrow-right"></i> Start Gatepass
      </button>
    </div>

    <div class="pi-toast" id="piToast" role="status" aria-live="polite"></div>
  `;
}

function piStartGatepass() {
  const input = document.getElementById('piGatepassNameInput');
  const name  = input?.value?.trim();

  if (!name) {
    piToast('Please enter a gatepass name.', 'error');
    return;
  }

  PI.gatepassName  = name;
  PI.verifiedItems = [];

  // Replace screen with main gatepass workflow
  const bodyEl = document.getElementById('modalBody');
  if (bodyEl) bodyEl.innerHTML = buildGatepassWorkflow();

  // Start QR scanner
  setTimeout(() => piStartQR(), 300);
}

/* ─────────────────────────────────────────────────────────────
   STEP 2 — GATEPASS WORKFLOW (QR Scan + Summary Panel)
   ───────────────────────────────────────────────────────────── */
function buildGatepassWorkflow() {
  return `
    <div class="pi-gatepass-workflow">

      <!-- Gatepass Header Bar -->
      <div class="pi-gp-header">
        <div class="pi-gp-header-icon">
          <i class="fa-solid fa-clipboard-check"></i>
        </div>
        <div class="pi-gp-header-info">
          <div class="pi-gp-header-label">Active Gatepass</div>
          <div class="pi-gp-header-name" id="piGPHeaderName">${piEscape(PI.gatepassName)}</div>
        </div>
        <div class="pi-gp-count-badge" id="piGPCountBadge">
          <span id="piGPCount">0</span> items
        </div>
      </div>

      <!-- Two-column layout -->
      <div class="pi-gp-layout">

        <!-- Left: QR Scanner Section -->
        <div class="pi-gp-left">
          <div class="pi-section-label">
            <i class="fa-solid fa-qrcode"></i> Scan or Enter QR Code
          </div>

          <div class="pi-tab-bar">
            <button class="pi-tab-btn active" id="piTabScan" onclick="piSwitchTab('scan')" aria-selected="true">
              <i class="fa-solid fa-camera"></i> Scan
            </button>
            <button class="pi-tab-btn" id="piTabManual" onclick="piSwitchTab('manual')" aria-selected="false">
              <i class="fa-solid fa-keyboard"></i> Manual
            </button>
          </div>

          <div id="piPanelScan">
            <div class="pi-viewport-wrap">
              <div id="piQRReader"></div>
              <div class="pi-corner tl"></div>
              <div class="pi-corner tr"></div>
              <div class="pi-corner bl"></div>
              <div class="pi-corner br"></div>
              <div class="pi-scanline" id="piScanLine"></div>
              <div class="pi-status-strip" id="piStatusStrip">
                <i class="fa-solid fa-spinner fa-spin"></i> Starting camera…
              </div>
            </div>
            <button class="pi-btn-toggle-cam" onclick="piToggleCam()">
              <i class="fa-solid fa-camera-rotate"></i> Switch Camera
            </button>
          </div>

          <div id="piPanelManual" style="display:none">
            <label class="pi-field-label" for="piManualInput">QR CODE VALUE</label>
            <div class="pi-manual-row">
              <input type="text" id="piManualInput"
                     class="pi-text-input"
                     placeholder="Type or paste QR code…"
                     oninput="piOnManualInput(this)"
                     onkeydown="if(event.key==='Enter')piConfirmManual()" />
              <button class="pi-btn-confirm-manual" onclick="piConfirmManual()">
                <i class="fa-solid fa-magnifying-glass"></i> Look Up
              </button>
            </div>
          </div>

          <div class="pi-qr-result-box" id="piQRResultBox">
            <i class="fa-solid fa-check-circle"></i>
            <span>QR: <strong id="piQRResultText"></strong></span>
            <button onclick="piClearQR()" class="pi-btn-clear" aria-label="Clear QR">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div id="piLookupResult"></div>
        </div>

        <!-- Right: Verified Items Summary -->
        <div class="pi-gp-right">
          <div class="pi-section-label">
            <i class="fa-solid fa-check-double"></i> Verified Items
          </div>
          <div class="pi-verified-list" id="piVerifiedList">
            <div class="pi-verified-empty">
              <i class="fa-regular fa-clipboard"></i>
              <span>No items verified yet.<br/>Scan a QR code to begin.</span>
            </div>
          </div>
          <button class="pi-btn-complete-gatepass" id="piBtnCompleteGP" onclick="piCompleteGatepass()" disabled>
            <i class="fa-solid fa-circle-check"></i> Complete Gatepass
          </button>
        </div>

      </div>

    </div>

    <div class="pi-toast" id="piToast" role="status" aria-live="polite"></div>
  `;
}

/* ─────────────────────────────────────────────────────────────
   TAB SWITCHING
   ───────────────────────────────────────────────────────────── */
function piSwitchTab(tab) {
  const scanBtn    = document.getElementById('piTabScan');
  const manualBtn  = document.getElementById('piTabManual');
  const scanPanel  = document.getElementById('piPanelScan');
  const manualPanel= document.getElementById('piPanelManual');
  if (!scanBtn) return;

  if (tab === 'scan') {
    scanBtn.classList.add('active');    scanBtn.setAttribute('aria-selected', 'true');
    manualBtn.classList.remove('active'); manualBtn.setAttribute('aria-selected', 'false');
    scanPanel.style.display  = 'block';
    manualPanel.style.display= 'none';
    if (!PI.qrResult) piStartQR();
  } else {
    manualBtn.classList.add('active');    manualBtn.setAttribute('aria-selected', 'true');
    scanBtn.classList.remove('active');   scanBtn.setAttribute('aria-selected', 'false');
    manualPanel.style.display= 'block';
    scanPanel.style.display  = 'none';
    piStopQR();
    setTimeout(() => document.getElementById('piManualInput')?.focus(), 100);
  }
}

/* ─────────────────────────────────────────────────────────────
   QR SCANNER
   ───────────────────────────────────────────────────────────── */
async function piStartQR() {
  if (!window.Html5Qrcode) {
    piUpdateStatus('<i class="fa-solid fa-triangle-exclamation" style="color:#f87171"></i> Camera library not loaded.', false);
    return;
  }
  await piStopQR();
  PI.qrScanner = new Html5Qrcode('piQRReader');
  PI.currentCamera = 'environment';
  const config = { fps: 10, qrbox: { width: 220, height: 180 }, aspectRatio: 1.4, disableFlip: false };

  try {
    await PI.qrScanner.start({ facingMode: 'environment' }, config, (text) => piOnQRSuccess(text), () => {});
    PI.qrRunning = true;
    piUpdateStatus('<i class="fa-solid fa-circle-dot" style="color:#22c55e"></i> Camera active — point at QR code', false);
  } catch {
    try {
      await PI.qrScanner.start({ facingMode: 'user' }, config, (text) => piOnQRSuccess(text), () => {});
      PI.qrRunning = true;
      piUpdateStatus('<i class="fa-solid fa-circle-dot" style="color:#22c55e"></i> Camera active (front)', false);
    } catch {
      piUpdateStatus('<i class="fa-solid fa-triangle-exclamation" style="color:#f87171"></i> Camera unavailable', false);
    }
  }
}

async function piStopQR() {
  if (PI.qrScanner && PI.qrRunning) {
    try { await PI.qrScanner.stop(); PI.qrScanner.clear(); } catch {}
    PI.qrRunning = false;
    PI.qrScanner = null;
  }
}

async function piToggleCam() {
  if (!PI.qrScanner) return;
  await piStopQR();
  piUpdateStatus('<i class="fa-solid fa-spinner fa-spin"></i> Switching camera…', false);
  PI.currentCamera = PI.currentCamera === 'environment' ? 'user' : 'environment';
  PI.qrScanner = new Html5Qrcode('piQRReader');
  const config = { fps: 10, qrbox: { width: 220, height: 180 }, aspectRatio: 1.4 };
  try {
    await PI.qrScanner.start({ facingMode: PI.currentCamera }, config, (text) => piOnQRSuccess(text), () => {});
    PI.qrRunning = true;
    piUpdateStatus('<i class="fa-solid fa-circle-dot" style="color:#22c55e"></i> Camera switched', false);
  } catch {
    piUpdateStatus('<i class="fa-solid fa-triangle-exclamation" style="color:#f87171"></i> Could not switch camera', false);
  }
}

function piUpdateStatus(html, detected) {
  const strip = document.getElementById('piStatusStrip');
  if (strip) { strip.innerHTML = html; strip.classList.toggle('detected', detected); }
}

/* ─────────────────────────────────────────────────────────────
   QR CAPTURE
   ───────────────────────────────────────────────────────────── */
function piOnQRSuccess(text) {
  if (!text || !text.trim()) return;
  PI.qrResult = text.trim();
  piUpdateStatus('<i class="fa-solid fa-qrcode"></i> QR Code captured!', true);
  const scanLine = document.getElementById('piScanLine');
  if (scanLine) scanLine.style.display = 'none';
  const box  = document.getElementById('piQRResultBox');
  const disp = document.getElementById('piQRResultText');
  if (box && disp) { disp.textContent = PI.qrResult; box.classList.add('visible'); }
  piStopQR();
  piToast('QR code captured!', 'success');
  piLookupQR(PI.qrResult);
}

function piOnManualInput(input) {
  PI.qrResult = input.value.trim() || null;
}

function piConfirmManual() {
  const inp = document.getElementById('piManualInput');
  if (!inp || !inp.value.trim()) { piToast('Please enter a QR code value.', 'error'); return; }
  piOnQRSuccess(inp.value.trim());
}

function piClearQR() {
  PI.qrResult   = null;
  PI.matchedRow = null;
  const box = document.getElementById('piQRResultBox');
  if (box) box.classList.remove('visible');
  const line = document.getElementById('piScanLine');
  if (line) line.style.display = '';
  const inp = document.getElementById('piManualInput');
  if (inp) inp.value = '';
  piUpdateStatus('<i class="fa-solid fa-spinner fa-spin"></i> Starting camera…', false);
  const area = document.getElementById('piLookupResult');
  if (area) area.innerHTML = '';
  const scanPanel = document.getElementById('piPanelScan');
  if (scanPanel && scanPanel.style.display !== 'none') piStartQR();
}

/* ─────────────────────────────────────────────────────────────
   LOOKUP & VERIFY
   ───────────────────────────────────────────────────────────── */
async function piLookupQR(qrCode) {
  const area = document.getElementById('piLookupResult');
  if (!area) return;
  area.innerHTML = '<div class="pi-lookup-loading"><div class="pi-spinner"></div><span>Looking up QR code…</span></div>';

  try {
    const res = await fetch(CONFIG.SHEETBEST_STORESOUT_URL, { method: 'GET' });
    if (!res.ok) throw new Error(`Sheet error ${res.status}`);
    const rows = await res.json();
    if (!Array.isArray(rows)) throw new Error('Unexpected response from sheet.');

    const match = rows.find(r => r && r.QR_Code && r.QR_Code.trim() === qrCode.trim());
    if (!match) { area.innerHTML = buildPINotFound(qrCode); return; }

    // Check if already verified IN THIS GATEPASS
    if (PI.verifiedItems.some(item => item.QR_Code === match.QR_Code)) {
      area.innerHTML = buildPIAlreadyInGatepass(match);
      return;
    }

    // Check if already verified globally (columns K-N populated)
    if (match.Vrification && match.Vrification.trim() !== '') {
      area.innerHTML = buildPIAlreadyVerified(match);
      return;
    }

    PI.matchedRow = match;
    area.innerHTML = buildPIDetails(match);

  } catch (err) {
    console.error('[PI] Lookup error:', err);
    area.innerHTML = buildPIError(err.message);
  }
}

function buildPIDetails(row) {
  return `
    <div class="pi-details-card">
      <div class="pi-details-header">
        <div class="pi-details-icon"><i class="fa-solid fa-box-open"></i></div>
        <div>
          <div class="pi-details-label">QR Code Match Found</div>
          <div class="pi-details-qr-val">${piEscape(row.QR_Code || '—')}</div>
        </div>
        <span class="pi-badge pending"><i class="fa-solid fa-clock"></i> Pending</span>
      </div>
      <div class="pi-details-grid">
        <div class="pi-detail-cell">
          <span class="pi-cell-label"><i class="fa-solid fa-hashtag"></i> PO Number</span>
          <span class="pi-cell-value po">${piEscape(row.PO || '—')}</span>
        </div>
        <div class="pi-detail-cell">
          <span class="pi-cell-label"><i class="fa-solid fa-shoe-prints"></i> Model</span>
          <span class="pi-cell-value">${piEscape(row.Model || '—')}</span>
        </div>
        <div class="pi-detail-cell">
          <span class="pi-cell-label"><i class="fa-solid fa-palette"></i> Outsole Colour</span>
          <span class="pi-cell-value">${piEscape(row.Outsole_Colour || '—')}</span>
        </div>
        <div class="pi-detail-cell">
          <span class="pi-cell-label"><i class="fa-solid fa-ruler"></i> Size</span>
          <span class="pi-cell-value">EU ${piEscape(String(row.Size || '—'))}</span>
        </div>
        <div class="pi-detail-cell">
          <span class="pi-cell-label"><i class="fa-solid fa-cubes"></i> QTY</span>
          <span class="pi-cell-value qty">${piEscape(String(row.QTY || '—'))}</span>
        </div>
        <div class="pi-detail-cell">
          <span class="pi-cell-label"><i class="fa-solid fa-file-lines"></i> MRN Reference</span>
          <span class="pi-cell-value" style="font-size:0.78rem">${piEscape(row.MRN_Name || '—')}</span>
        </div>
      </div>
      <div class="pi-verify-block">
        <p class="pi-verify-hint">
          <i class="fa-solid fa-circle-info"></i>
          Confirm the details above, then enter the QR range and click <strong>Add to Gatepass</strong>.
        </p>
        
        <!-- QR Range Inputs -->
        <div class="pi-qr-range-inputs">
          <div class="pi-qr-range-field">
            <label class="pi-field-label" for="piStartQR">START QR</label>
            <input type="number" id="piStartQR" class="pi-text-input" placeholder="e.g., 5" min="1" />
          </div>
          <div class="pi-qr-range-separator">→</div>
          <div class="pi-qr-range-field">
            <label class="pi-field-label" for="piEndQR">END QR</label>
            <input type="number" id="piEndQR" class="pi-text-input" placeholder="e.g., 11" min="1" />
          </div>
        </div>

        <div class="pi-verify-actions">
          <button class="pi-btn-scan-again" onclick="piClearQR()">
            <i class="fa-solid fa-xmark"></i> Cancel
          </button>
          <button class="pi-btn-verify" id="piBtnVerify" onclick="piVerifyAndAdd()">
            <i class="fa-solid fa-plus-circle"></i> Add to Gatepass
          </button>
        </div>
      </div>
    </div>`;
}

function buildPIAlreadyInGatepass(row) {
  return `
    <div class="pi-not-found">
      <div class="pi-nf-icon" style="color:#fbbf24"><i class="fa-solid fa-circle-exclamation"></i></div>
      <div class="pi-nf-title">Already in Gatepass</div>
      <div class="pi-nf-body">
        QR code <strong>"${piEscape(row.QR_Code)}"</strong> has already been added to this gatepass.
      </div>
      <button class="pi-btn-scan-again" onclick="piClearQR()">
        <i class="fa-solid fa-qrcode"></i> Scan Another
      </button>
    </div>`;
}

function buildPIAlreadyVerified(row) {
  return `
    <div class="pi-not-found">
      <div class="pi-nf-icon" style="color:#22c55e"><i class="fa-solid fa-circle-check"></i></div>
      <div class="pi-nf-title">Already Verified</div>
      <div class="pi-nf-body">
        This QR code was verified by <strong>${piEscape(row['Verified User'] || '—')}</strong>
        on ${piEscape(row['Verified Date'] || '—')} at ${piEscape(row['Verified Time'] || '—')}.
      </div>
      <button class="pi-btn-scan-again" onclick="piClearQR()">
        <i class="fa-solid fa-qrcode"></i> Scan Another
      </button>
    </div>`;
}

function buildPINotFound(qrCode) {
  return `
    <div class="pi-not-found">
      <div class="pi-nf-icon"><i class="fa-solid fa-circle-xmark"></i></div>
      <div class="pi-nf-title">No Record Found</div>
      <div class="pi-nf-body">
        QR code <strong>"${piEscape(qrCode)}"</strong> does not match any kitting record.
      </div>
      <button class="pi-btn-scan-again" onclick="piClearQR()">
        <i class="fa-solid fa-rotate-left"></i> Try Again
      </button>
    </div>`;
}

function buildPIError(msg) {
  return `
    <div class="pi-not-found">
      <div class="pi-nf-icon" style="color:#f87171"><i class="fa-solid fa-triangle-exclamation"></i></div>
      <div class="pi-nf-title">Lookup Failed</div>
      <div class="pi-nf-body">${piEscape(msg || 'Could not reach the sheet.')}</div>
      <button class="pi-btn-scan-again" onclick="piClearQR()">
        <i class="fa-solid fa-rotate-left"></i> Try Again
      </button>
    </div>`;
}

/* ─────────────────────────────────────────────────────────────
   VERIFY & ADD TO GATEPASS
   ───────────────────────────────────────────────────────────── */
async function piVerifyAndAdd() {
  if (!PI.matchedRow || PI.verifying) return;

  // Validate QR range inputs
  const startQRInput = document.getElementById('piStartQR');
  const endQRInput   = document.getElementById('piEndQR');

  if (!startQRInput || !endQRInput) return;

  const startQR = parseInt(startQRInput.value);
  const endQR   = parseInt(endQRInput.value);

  if (isNaN(startQR) || startQR < 1) {
    piToast('Please enter a valid Start QR number.', 'error');
    startQRInput.focus();
    return;
  }

  if (isNaN(endQR) || endQR < 1) {
    piToast('Please enter a valid End QR number.', 'error');
    endQRInput.focus();
    return;
  }

  if (endQR < startQR) {
    piToast('End QR must be greater than or equal to Start QR.', 'error');
    endQRInput.focus();
    return;
  }

  PI.verifying = true;

  const btn = document.getElementById('piBtnVerify');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying…'; }

  const user    = sessionStorage.getItem('sm_user') || 'Unknown';
  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-GB',  { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-GB',  { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // Generate QR range string (e.g., "5,6,7,8,9,10,11")
  const qrRangeArray = [];
  for (let i = startQR; i <= endQR; i++) {
    qrRangeArray.push(i);
  }
  const qrRangeString = qrRangeArray.join(',');

  const patchUrl = `${CONFIG.SHEETBEST_STORESOUT_URL}/QR_Code/${encodeURIComponent(PI.matchedRow.QR_Code.trim())}`;
  const payload = {
    Vrification:      'Verified',
    'Verified User':  user,
    'Verified Date':  dateStr,
    'Verified Time':  timeStr,
    Numbers:          qrRangeString,  // Column O: Numbers
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

    // Add to verified items array
    const verifiedItem = { 
      ...PI.matchedRow, 
      ...payload, 
      VerifiedAt: now.toISOString(),
      QR_Range_Start: startQR,
      QR_Range_End:   endQR,
    };
    PI.verifiedItems.push(verifiedItem);
    PI.verifying = false;

    piToast('Item added to gatepass!', 'success');
    piUpdateVerifiedList();
    piClearQR();

  } catch (err) {
    console.error('[PI] Verify PATCH error:', err);
    PI.verifying = false;
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-plus-circle"></i> Add to Gatepass'; }
    piToast(`Verification failed: ${err.message}`, 'error');
  }
}

/* ─────────────────────────────────────────────────────────────
   UPDATE VERIFIED LIST
   ───────────────────────────────────────────────────────────── */
function piUpdateVerifiedList() {
  const list = document.getElementById('piVerifiedList');
  const countBadge = document.getElementById('piGPCount');
  const completeBtn = document.getElementById('piBtnCompleteGP');

  if (!list) return;

  if (PI.verifiedItems.length === 0) {
    list.innerHTML = `
      <div class="pi-verified-empty">
        <i class="fa-regular fa-clipboard"></i>
        <span>No items verified yet.<br/>Scan a QR code to begin.</span>
      </div>`;
    if (completeBtn) completeBtn.disabled = true;
    if (countBadge) countBadge.textContent = '0';
    return;
  }

  let html = '';
  PI.verifiedItems.forEach((item, idx) => {
    const qrRange = item.QR_Range_Start && item.QR_Range_End 
      ? `QR ${item.QR_Range_Start}–${item.QR_Range_End}`
      : '';
    html += `
      <div class="pi-verified-item">
        <div class="pi-vi-header">
          <span class="pi-vi-num">#${idx + 1}</span>
          <span class="pi-vi-qr">${piEscape(item.QR_Code)}</span>
          <button class="pi-btn-remove-item" onclick="piRemoveItem(${idx})" title="Remove from gatepass">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="pi-vi-body">
          <span><strong>PO:</strong> ${piEscape(item.PO || '—')}</span>
          <span><strong>Model:</strong> ${piEscape(item.Model || '—')}</span>
          <span><strong>Colour:</strong> ${piEscape(item.Outsole_Colour || '—')}</span>
          <span><strong>Size:</strong> EU ${piEscape(String(item.Size || '—'))}</span>
          <span><strong>QTY:</strong> ${piEscape(String(item.QTY || '—'))}</span>
          ${qrRange ? `<span style="grid-column:1/-1"><strong>Range:</strong> ${piEscape(qrRange)}</span>` : ''}
        </div>
      </div>`;
  });

  list.innerHTML = html;
  if (countBadge) countBadge.textContent = PI.verifiedItems.length;
  if (completeBtn) completeBtn.disabled = false;
}

function piRemoveItem(index) {
  if (index < 0 || index >= PI.verifiedItems.length) return;
  const item = PI.verifiedItems[index];
  
  if (!confirm(`Remove ${item.QR_Code} from this gatepass?`)) return;

  PI.verifiedItems.splice(index, 1);
  piUpdateVerifiedList();
  piToast('Item removed from gatepass.', 'info');
}

/* ─────────────────────────────────────────────────────────────
   COMPLETE GATEPASS
   ───────────────────────────────────────────────────────────── */
async function piCompleteGatepass() {
  if (PI.verifiedItems.length === 0 || PI.completing) return;

  if (!confirm(`Complete gatepass "${PI.gatepassName}" with ${PI.verifiedItems.length} items?`)) return;

  PI.completing = true;
  const btn = document.getElementById('piBtnCompleteGP');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…'; }

  try {
    // Save to Storse To GFU Gatepass sheet
    await piSaveGatepassRecord();

    // Show success
    piShowGatepassSuccess();

  } catch (err) {
    console.error('[PI] Complete gatepass error:', err);
    PI.completing = false;
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Complete Gatepass'; }
    piToast(`Failed to complete gatepass: ${err.message}`, 'error');
  }
}

/* ─────────────────────────────────────────────────────────────
   SAVE TO SHEET
   ───────────────────────────────────────────────────────────── */
async function piSaveGatepassRecord() {
  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const gatepassData = {
    GatepassName:   PI.gatepassName,
    CreatedBy:      sessionStorage.getItem('sm_user') || 'Unknown',
    CreatedDate:    dateStr,
    CreatedTime:    timeStr,
    ItemCount:      PI.verifiedItems.length,
    TotalQty:       PI.verifiedItems.reduce((s, i) => s + (parseInt(i.QTY) || 0), 0),
    Items:          PI.verifiedItems.map(item => ({
      QR_Code:        item.QR_Code,
      PO:             item.PO,
      Model:          item.Model,
      Outsole_Colour: item.Outsole_Colour,
      Size:           item.Size,
      QTY:            item.QTY,
      MRN_Name:       item.MRN_Name,
    })),
  };

  const rowData = {
    Rows_JSON:                    JSON.stringify(gatepassData),  // Column A: Rows_JSON (with underscore)
    'Created Date':               dateStr,                        // Column B: Created Date (with space)
    'Created Time':               timeStr,                        // Column C: Created Time (with space)
    Status:                       'Pending Approval',             // Column D: Status
    'Gatepass name':              PI.gatepassName,                // Column E: Gatepass name (with space)
    'Approved Manegement User':   '',                             // Column F: Placeholder (filled on approval)
    'Manegement Approve Date':    '',                             // Column G: Placeholder (filled on approval)
    'Manegement Approve Time':    '',                             // Column H: Placeholder (filled on approval)
  };

  const sheetUrl = CONFIG.SHEETBEST_STORSE_TO_GFU_GATEPASS_URL
    || `${CONFIG.SHEETBEST_URL}/tabs/Storse To GFU Gatepass`;

  console.log('[PI] Saving gatepass to:', sheetUrl);
  console.log('[PI] Row payload keys:', Object.keys(rowData));

  const res = await fetch(sheetUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(rowData),
  });

  if (!res.ok) {
    let errText = '';
    try   { errText = await res.text(); } catch (_) { /* ignore */ }
    console.error('[PI] SheetBest error response (status=' + res.status + '):', errText);
    let parsedErr = {};
    try   { parsedErr = JSON.parse(errText); } catch (_) { /* ignore */ }
    const msg = parsedErr?.message || parsedErr?.error || errText || `Sheet save failed: ${res.status}`;
    throw new Error(msg);
  }

  try {
    const saved = await res.json();
    console.log('[PI] SheetBest save success:', saved);
  } catch (_) { /* ignore */ }
}

/* ─────────────────────────────────────────────────────────────
   SUCCESS SCREEN
   ───────────────────────────────────────────────────────────── */
function piShowGatepassSuccess() {
  const bodyEl = document.getElementById('modalBody');
  if (!bodyEl) return;

  bodyEl.innerHTML = `
    <div class="pi-gp-success">
      <div class="pi-success-icon">
        <i class="fa-solid fa-circle-check"></i>
      </div>
      <h3 class="pi-success-title">Gatepass Complete!</h3>
      <p class="pi-success-body">
        Gatepass <strong>"${piEscape(PI.gatepassName)}"</strong> has been successfully created
        with ${PI.verifiedItems.length} verified items and saved to the system.
      </p>
      <div class="pi-success-grid">
        <div class="pi-success-cell">
          <div class="pi-sc-label">Gatepass Name</div>
          <div class="pi-sc-value">${piEscape(PI.gatepassName)}</div>
        </div>
        <div class="pi-success-cell">
          <div class="pi-sc-label">Items</div>
          <div class="pi-sc-value">${PI.verifiedItems.length}</div>
        </div>
        <div class="pi-success-cell">
          <div class="pi-sc-label">Total QTY</div>
          <div class="pi-sc-value" style="color:#22c55e">${PI.verifiedItems.reduce((s, i) => s + (parseInt(i.QTY) || 0), 0)}</div>
        </div>
        <div class="pi-success-cell">
          <div class="pi-sc-label">Status</div>
          <div class="pi-sc-value" style="color:#fbbf24">Pending Approval</div>
        </div>
      </div>
      <div class="pi-success-actions">
        <!-- "Switch to WhatsApp" action (injected after gatepass completion) -->
        <div id="piWhatsAppAction"></div>
        <button class="pi-btn-new-gatepass" onclick="piNewGatepass()">
          <i class="fa-solid fa-plus"></i> New Gatepass
        </button>
      </div>
    </div>

    <div class="pi-toast" id="piToast" role="status" aria-live="polite"></div>
  `;

  piToast('Gatepass saved successfully!', 'success');

  // ── "Switch to WhatsApp" action (Gatepass completed via Production In — Module 02) ──
  if (typeof injectWhatsAppButton === 'function') {
    const waUser = sessionStorage.getItem('sm_user') || 'Unknown';
    const waNow  = new Date();
    injectWhatsAppButton(
      'piWhatsAppAction',
      waMsg([
        '*SOLE MATRIX — Gatepass Created*',
        '',
        '📄 Gatepass: ' + PI.gatepassName,
        '🏢 Department: Outsole Production (Production In — Module 02)',
        '👤 Created by: ' + waUser,
        '📅 Date: ' + waNow.toLocaleDateString('en-GB') + ' ' +
          waNow.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        '📦 Items: ' + PI.verifiedItems.length +
          ' | Total QTY: ' + PI.verifiedItems.reduce((s, i) => s + (parseInt(i.QTY) || 0), 0),
        '📌 Status: Pending Approval',
      ]),
      {
        label: 'Switch to WhatsApp',
        sub: 'Notify the team about this gatepass',
        scenario: WA_SCENARIOS.GATEPASS_COMPLETED,
      }
    );
  }

  PI.completing = false;
}

function piNewGatepass() {
  const bodyEl = document.getElementById('modalBody');
  if (bodyEl) initProductionInModule(bodyEl);
}

/* ─────────────────────────────────────────────────────────────
   CLEANUP
   ───────────────────────────────────────────────────────────── */
function destroyProductionInModule() {
  piStopQR();
  PI.gatepassName  = null;
  PI.verifiedItems = [];
  PI.qrResult      = null;
  PI.matchedRow    = null;
  PI.verifying     = false;
  PI.completing    = false;
}

/* ─────────────────────────────────────────────────────────────
   TOAST
   ───────────────────────────────────────────────────────────── */
let _piToastTimer = null;

function piToast(message, type = 'info') {
  const toast = document.getElementById('piToast');
  if (!toast) return;
  const icons = { success: 'fa-circle-check', error: 'fa-circle-exclamation', info: 'fa-circle-info' };
  toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i> ${piEscape(message)}`;
  toast.className = `pi-toast pi-toast-${type} show`;
  clearTimeout(_piToastTimer);
  _piToastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

/* ─────────────────────────────────────────────────────────────
   UTILITY
   ───────────────────────────────────────────────────────────── */
function piEscape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
