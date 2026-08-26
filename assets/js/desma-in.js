'use strict';

const DI = {
  gatepassName:    null,
  verifiedItems:   [],
  qrScanner:       null,
  qrRunning:       false,
  qrResult:        null,
  currentCamera:   'environment',
  matchedRow:      null,
  verifying:       false,
  completing:      false,
};

function initDesmaInModule(bodyEl) {
  DI.gatepassName  = null;
  DI.verifiedItems = [];
  DI.qrScanner     = null;
  DI.qrRunning     = false;
  DI.qrResult      = null;
  DI.matchedRow    = null;
  DI.verifying     = false;
  DI.completing    = false;

  bodyEl.innerHTML = buildGatepassNameScreen();
}

function buildGatepassNameScreen() {
  return `
    <div class="pi-gatepass-name-screen di-gatepass-name-screen" id="diGatepassNameScreen">
      <div class="pi-gp-icon di-gp-icon">
        <i class="fa-solid fa-gears"></i>
      </div>
      <h3 class="pi-gp-title di-gp-title">Create New Desma In Gatepass</h3>
      <p class="pi-gp-subtitle di-gp-subtitle">
        Enter a unique name for this Desma material intake gatepass.
        All verified material items will be grouped under this gatepass.
      </p>
      <div class="pi-gp-input-wrap">
        <label class="pi-field-label di-field-label" for="diGatepassNameInput">GATEPASS NAME</label>
        <input type="text" id="diGatepassNameInput"
               class="pi-text-input di-text-input"
               placeholder="e.g., DESMA-GP-2026-001"
               aria-label="Gatepass name"
               onkeydown="if(event.key==='Enter')diStartGatepass()" />
      </div>
      <button class="pi-btn-start-gatepass di-btn-start-gatepass" onclick="diStartGatepass()">
        <i class="fa-solid fa-arrow-right"></i> Start Gatepass
      </button>
    </div>

    <div class="pi-toast di-toast" id="diToast" role="status" aria-live="polite"></div>
  `;
}

function diStartGatepass() {
  const input = document.getElementById('diGatepassNameInput');
  const name  = input?.value?.trim();

  if (!name) {
    diToast('Please enter a gatepass name.', 'error');
    return;
  }

  DI.gatepassName  = name;
  DI.verifiedItems = [];

  const bodyEl = document.getElementById('moduleBody');
  if (bodyEl) bodyEl.innerHTML = buildGatepassWorkflow();

  setTimeout(() => diStartQR(), 300);
}

function buildGatepassWorkflow() {
  return `
    <div class="pi-gatepass-workflow di-gatepass-workflow">

      <div class="pi-gp-header di-gp-header">
        <div class="pi-gp-header-icon di-gp-header-icon">
          <i class="fa-solid fa-gears"></i>
        </div>
        <div class="pi-gp-header-info">
          <div class="pi-gp-header-label">Active Desma Gatepass</div>
          <div class="pi-gp-header-name di-gp-header-name" id="diGPHeaderName">${diEscape(DI.gatepassName)}</div>
        </div>
        <div class="pi-gp-count-badge di-gp-count-badge" id="diGPCountBadge">
          <span id="diGPCount">0</span> items
        </div>
      </div>

      <div class="pi-gp-layout di-gp-layout">

        <div class="pi-gp-left di-gp-left">
          <div class="pi-section-label di-section-label">
            <i class="fa-solid fa-qrcode"></i> Scan or Enter QR Code
          </div>

          <div class="pi-tab-bar di-tab-bar">
            <button class="pi-tab-btn di-tab-btn active" id="diTabScan" onclick="diSwitchTab('scan')" aria-selected="true">
              <i class="fa-solid fa-camera"></i> Scan
            </button>
            <button class="pi-tab-btn di-tab-btn" id="diTabManual" onclick="diSwitchTab('manual')" aria-selected="false">
              <i class="fa-solid fa-keyboard"></i> Manual
            </button>
          </div>

          <div id="diPanelScan">
            <div class="pi-viewport-wrap di-viewport-wrap">
              <div id="diQRReader"></div>
              <div class="pi-corner di-corner tl"></div>
              <div class="pi-corner di-corner tr"></div>
              <div class="pi-corner di-corner bl"></div>
              <div class="pi-corner di-corner br"></div>
              <div class="pi-scanline di-scanline" id="diScanLine"></div>
              <div class="pi-status-strip di-status-strip" id="diStatusStrip">
                <i class="fa-solid fa-spinner fa-spin"></i> Starting camera…
              </div>
            </div>
            <button class="pi-btn-toggle-cam di-btn-toggle-cam" onclick="diToggleCam()">
              <i class="fa-solid fa-camera-rotate"></i> Switch Camera
            </button>
          </div>

          <div id="diPanelManual" style="display:none">
            <label class="pi-field-label di-field-label" for="diManualInput">QR CODE VALUE</label>
            <div class="pi-manual-row di-manual-row">
              <input type="text" id="diManualInput"
                     class="pi-text-input di-text-input"
                     placeholder="Type or paste QR code…"
                     oninput="diOnManualInput(this)"
                     onkeydown="if(event.key==='Enter')diConfirmManual()" />
              <button class="pi-btn-confirm-manual di-btn-confirm-manual" onclick="diConfirmManual()">
                <i class="fa-solid fa-magnifying-glass"></i> Look Up
              </button>
            </div>
          </div>

          <div class="pi-qr-result-box di-qr-result-box" id="diQRResultBox">
            <i class="fa-solid fa-check-circle"></i>
            <span>QR: <strong id="diQRResultText"></strong></span>
            <button onclick="diClearQR()" class="pi-btn-clear di-btn-clear" aria-label="Clear QR">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div id="diLookupResult"></div>
        </div>

        <div class="pi-gp-right di-gp-right">
          <div class="pi-section-label di-section-label">
            <i class="fa-solid fa-check-double"></i> Verified Items
          </div>
          <div class="pi-verified-list di-verified-list" id="diVerifiedList">
            <div class="pi-verified-empty di-verified-empty">
              <i class="fa-regular fa-clipboard"></i>
              <span>No items verified yet.<br/>Scan a QR code to begin.</span>
            </div>
          </div>
          <button class="pi-btn-complete-gatepass di-btn-complete-gatepass" id="diBtnCompleteGP" onclick="diCompleteGatepass()" disabled>
            <i class="fa-solid fa-circle-check"></i> Complete Gatepass
          </button>
        </div>

      </div>

    </div>

    <div class="pi-toast di-toast" id="diToast" role="status" aria-live="polite"></div>
  `;
}

function diSwitchTab(tab) {
  const scanBtn    = document.getElementById('diTabScan');
  const manualBtn  = document.getElementById('diTabManual');
  const scanPanel  = document.getElementById('diPanelScan');
  const manualPanel= document.getElementById('diPanelManual');
  if (!scanBtn) return;

  if (tab === 'scan') {
    scanBtn.classList.add('active');    scanBtn.setAttribute('aria-selected', 'true');
    manualBtn.classList.remove('active'); manualBtn.setAttribute('aria-selected', 'false');
    scanPanel.style.display  = 'block';
    manualPanel.style.display= 'none';
    if (!DI.qrResult) diStartQR();
  } else {
    manualBtn.classList.add('active');    manualBtn.setAttribute('aria-selected', 'true');
    scanBtn.classList.remove('active');   scanBtn.setAttribute('aria-selected', 'false');
    manualPanel.style.display= 'block';
    scanPanel.style.display  = 'none';
    diStopQR();
    setTimeout(() => document.getElementById('diManualInput')?.focus(), 100);
  }
}

async function diStartQR() {
  if (!window.Html5Qrcode) {
    diUpdateStatus('<i class="fa-solid fa-triangle-exclamation" style="color:#f87171"></i> Camera library not loaded.', false);
    return;
  }
  await diStopQR();
  DI.qrScanner = new Html5Qrcode('diQRReader');
  DI.currentCamera = 'environment';
  const config = { fps: 10, qrbox: { width: 220, height: 180 }, aspectRatio: 1.4, disableFlip: false };

  try {
    await DI.qrScanner.start({ facingMode: 'environment' }, config, (text) => diOnQRSuccess(text), () => {});
    DI.qrRunning = true;
    diUpdateStatus('<i class="fa-solid fa-circle-dot" style="color:#8b5cf6"></i> Camera active — point at QR code', false);
  } catch {
    try {
      await DI.qrScanner.start({ facingMode: 'user' }, config, (text) => diOnQRSuccess(text), () => {});
      DI.qrRunning = true;
      diUpdateStatus('<i class="fa-solid fa-circle-dot" style="color:#8b5cf6"></i> Camera active (front)', false);
    } catch {
      diUpdateStatus('<i class="fa-solid fa-triangle-exclamation" style="color:#f87171"></i> Camera unavailable', false);
    }
  }
}

async function diStopQR() {
  if (DI.qrScanner && DI.qrRunning) {
    try { await DI.qrScanner.stop(); DI.qrScanner.clear(); } catch {}
    DI.qrRunning = false;
    DI.qrScanner = null;
  }
}

async function diToggleCam() {
  if (!DI.qrScanner) return;
  await diStopQR();
  diUpdateStatus('<i class="fa-solid fa-spinner fa-spin"></i> Switching camera…', false);
  DI.currentCamera = DI.currentCamera === 'environment' ? 'user' : 'environment';
  DI.qrScanner = new Html5Qrcode('diQRReader');
  const config = { fps: 10, qrbox: { width: 220, height: 180 }, aspectRatio: 1.4 };
  try {
    await DI.qrScanner.start({ facingMode: DI.currentCamera }, config, (text) => diOnQRSuccess(text), () => {});
    DI.qrRunning = true;
    diUpdateStatus('<i class="fa-solid fa-circle-dot" style="color:#8b5cf6"></i> Camera switched', false);
  } catch {
    diUpdateStatus('<i class="fa-solid fa-triangle-exclamation" style="color:#f87171"></i> Could not switch camera', false);
  }
}

function diUpdateStatus(html, detected) {
  const strip = document.getElementById('diStatusStrip');
  if (strip) { strip.innerHTML = html; strip.classList.toggle('detected', detected); }
}

function diOnQRSuccess(text) {
  if (!text || !text.trim()) return;
  DI.qrResult = text.trim();
  diUpdateStatus('<i class="fa-solid fa-qrcode"></i> QR Code captured!', true);
  const scanLine = document.getElementById('diScanLine');
  if (scanLine) scanLine.style.display = 'none';
  const box  = document.getElementById('diQRResultBox');
  const disp = document.getElementById('diQRResultText');
  if (box && disp) { disp.textContent = DI.qrResult; box.classList.add('visible'); }
  diStopQR();
  diToast('QR code captured!', 'success');
  diLookupQR(DI.qrResult);
}

function diOnManualInput(input) {
  DI.qrResult = input.value.trim() || null;
}

function diConfirmManual() {
  const inp = document.getElementById('diManualInput');
  if (!inp || !inp.value.trim()) { diToast('Please enter a QR code value.', 'error'); return; }
  diOnQRSuccess(inp.value.trim());
}

function diClearQR() {
  DI.qrResult   = null;
  DI.matchedRow = null;
  const box = document.getElementById('diQRResultBox');
  if (box) box.classList.remove('visible');
  const line = document.getElementById('diScanLine');
  if (line) line.style.display = '';
  const inp = document.getElementById('diManualInput');
  if (inp) inp.value = '';
  diUpdateStatus('<i class="fa-solid fa-spinner fa-spin"></i> Starting camera…', false);
  const area = document.getElementById('diLookupResult');
  if (area) area.innerHTML = '';
  const scanPanel = document.getElementById('diPanelScan');
  if (scanPanel && scanPanel.style.display !== 'none') diStartQR();
}

async function diLookupQR(qrCode) {
  const area = document.getElementById('diLookupResult');
  if (!area) return;
  area.innerHTML = '<div class="pi-lookup-loading di-lookup-loading"><div class="pi-spinner di-spinner"></div><span>Looking up QR code…</span></div>';

  try {
    const res = await fetch(CONFIG.SHEETBEST_GFUOUT_URL, { method: 'GET' });
    if (!res.ok) throw new Error(`Sheet error ${res.status}`);
    const rows = await res.json();
    if (!Array.isArray(rows)) throw new Error('Unexpected response from sheet.');

    const match = rows.find(r => r && diMatchQR(r, qrCode));
    if (!match) { area.innerHTML = buildDINotFound(qrCode); return; }

    const matchQR = diGetQR(match);
    if (DI.verifiedItems.some(item => diMatchQR(item, matchQR))) {
      area.innerHTML = buildDIAlreadyInGatepass(match);
      return;
    }

    const verifiedFlag = match.Vrification ?? match['Vrification'] ?? null;
    if (verifiedFlag && String(verifiedFlag).trim() !== '') {
      area.innerHTML = buildDIAlreadyVerified(match);
      return;
    }
    DI.matchedRow = match;
    area.innerHTML = buildDIDetails(match);

  } catch (err) {
    console.error('[DI] Lookup error:', err);
    area.innerHTML = buildDIError(err.message);
  }
}

function buildDIDetails(row) {
  const qrVal = diGetQR(row);
  return `
    <div class="pi-details-card di-details-card">
      <div class="pi-details-header di-details-header">
        <div class="pi-details-icon di-details-icon"><i class="fa-solid fa-box-open"></i></div>
        <div>
          <div class="pi-details-label di-details-label">QR Code Match Found (GFU Out)</div>
          <div class="pi-details-qr-val di-details-qr-val">${diEscape(qrVal ?? '—')}</div>
        </div>
        <span class="pi-badge di-badge pending"><i class="fa-solid fa-clock"></i> Pending</span>
      </div>
      <div class="pi-details-grid di-details-grid">
        <div class="pi-detail-cell di-detail-cell">
          <span class="pi-cell-label di-cell-label"><i class="fa-solid fa-hashtag"></i> PO Number</span>
          <span class="pi-cell-value di-cell-value po">${diEscape(diGetProp(row,'PO','PO'))}</span>
        </div>
        <div class="pi-detail-cell di-detail-cell">
          <span class="pi-cell-label di-cell-label"><i class="fa-solid fa-shoe-prints"></i> Model</span>
          <span class="pi-cell-value di-cell-value">${diEscape(diGetProp(row,'Model','Model'))}</span>
        </div>
        <div class="pi-detail-cell di-detail-cell">
          <span class="pi-cell-label di-cell-label"><i class="fa-solid fa-palette"></i> Outsole Colour</span>
          <span class="pi-cell-value di-cell-value">${diEscape(diGetColour(row))}</span>
        </div>
        <div class="pi-detail-cell di-detail-cell">
          <span class="pi-cell-label di-cell-label"><i class="fa-solid fa-ruler"></i> Size</span>
          <span class="pi-cell-value di-cell-value">EU ${diEscape(String(diGetProp(row,'Size','Size')))}</span>
        </div>
        <div class="pi-detail-cell di-detail-cell">
          <span class="pi-cell-label di-cell-label"><i class="fa-solid fa-cubes"></i> QTY</span>
          <span class="pi-cell-value di-cell-value qty">${diEscape(String(diGetProp(row,'QTY','QTY')))}</span>
        </div>
        <div class="pi-detail-cell di-detail-cell">
          <span class="pi-cell-label di-cell-label"><i class="fa-solid fa-file-lines"></i> MRN Reference</span>
          <span class="pi-cell-value di-cell-value" style="font-size:0.78rem">${diEscape(diGetProp(row,'MRN_Name','MRN_Name'))}</span>
        </div>
      </div>
      <div class="pi-verify-block di-verify-block">
        <p class="pi-verify-hint di-verify-hint">
          <i class="fa-solid fa-circle-info"></i>
          Confirm the details above and click <strong>Add to Gatepass</strong> to add this item to the current Desma gatepass.
        </p>

        <div class="pi-verify-actions di-verify-actions">
          <button class="pi-btn-scan-again di-btn-scan-again" onclick="diClearQR()">
            <i class="fa-solid fa-xmark"></i> Cancel
          </button>
          <button class="pi-btn-verify di-btn-verify" id="diBtnVerify" onclick="diVerifyAndAdd()">
            <i class="fa-solid fa-plus-circle"></i> Add to Gatepass
          </button>
        </div>
      </div>
    </div>`;
}

function buildDIAlreadyInGatepass(row) {
  const qrVal = diGetQR(row);
  return `
    <div class="pi-not-found di-not-found">
      <div class="pi-nf-icon di-nf-icon" style="color:#fbbf24"><i class="fa-solid fa-circle-exclamation"></i></div>
      <div class="pi-nf-title di-nf-title">Already in Gatepass</div>
      <div class="pi-nf-body di-nf-body">
        QR code <strong>"${diEscape(qrVal ?? '—')}"</strong> has already been added to this gatepass.
      </div>
      <button class="pi-btn-scan-again di-btn-scan-again" onclick="diClearQR()">
        <i class="fa-solid fa-qrcode"></i> Scan Another
      </button>
    </div>`;
}

function buildDIAlreadyVerified(row) {
  const qrVal = diGetQR(row);
  const vUser = row['Verified User'] ?? diGetProp(row, 'Verified User', 'Verified User');
  const vDate = row['Verified Date'] ?? diGetProp(row, 'Verified Date', 'Verified Date');
  const vTime = row['Verified Time'] ?? diGetProp(row, 'Verified Time', 'Verified Time');
  return `
    <div class="pi-not-found di-not-found">
      <div class="pi-nf-icon di-nf-icon" style="color:#14b8a6"><i class="fa-solid fa-circle-check"></i></div>
      <div class="pi-nf-title di-nf-title">Already Verified</div>
      <div class="pi-nf-body di-nf-body">
        This QR code was verified by <strong>${diEscape(vUser)}</strong>
        on ${diEscape(vDate)} at ${diEscape(vTime)}.
      </div>
      <button class="pi-btn-scan-again di-btn-scan-again" onclick="diClearQR()">
        <i class="fa-solid fa-qrcode"></i> Scan Another
      </button>
    </div>`;
}

function buildDINotFound(qrCode) {
  return `
    <div class="pi-not-found di-not-found">
      <div class="pi-nf-icon di-nf-icon"><i class="fa-solid fa-circle-xmark"></i></div>
      <div class="pi-nf-title di-nf-title">No Record Found</div>
      <div class="pi-nf-body di-nf-body">
        QR code <strong>"${diEscape(qrCode)}"</strong> does not match any GFU Outbound record.
      </div>
      <button class="pi-btn-scan-again di-btn-scan-again" onclick="diClearQR()">
        <i class="fa-solid fa-rotate-left"></i> Try Again
      </button>
    </div>`;
}

function buildDIError(msg) {
  return `
    <div class="pi-not-found di-not-found">
      <div class="pi-nf-icon di-nf-icon" style="color:#f87171"><i class="fa-solid fa-triangle-exclamation"></i></div>
      <div class="pi-nf-title di-nf-title">Lookup Failed</div>
      <div class="pi-nf-body di-nf-body">${diEscape(msg || 'Could not reach the sheet.')}</div>
      <button class="pi-btn-scan-again di-btn-scan-again" onclick="diClearQR()">
        <i class="fa-solid fa-rotate-left"></i> Try Again
      </button>
    </div>`;
}

async function diVerifyAndAdd() {
  if (!DI.matchedRow || DI.verifying) return;

  DI.verifying = true;

  const btn = document.getElementById('diBtnVerify');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying…'; }

  const user    = sessionStorage.getItem('sm_user') || 'Unknown';
  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-GB',  { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-GB',  { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const matchedQR = diGetQR(DI.matchedRow);
  const patchUrl  = `${CONFIG.SHEETBEST_GFUOUT_URL}/QR%20Code/${encodeURIComponent(String(matchedQR ?? ''))}`;
  const payload = {
    Vrification:      'Verified',
    'Verified User':  user,
    'Verified Date':  dateStr,
    'Verified Time':  timeStr,
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
      PO:             diGetProp(DI.matchedRow, 'PO', 'PO'),
      Model:          diGetProp(DI.matchedRow, 'Model', 'Model'),
      Outsole_Colour: diGetColour(DI.matchedRow),
      Size:           diGetProp(DI.matchedRow, 'Size', 'Size'),
      QTY:            diGetProp(DI.matchedRow, 'QTY', 'QTY'),
      MRN_Name:       diGetProp(DI.matchedRow, 'MRN_Name', 'MRN_Name'),
      ...payload,
      VerifiedAt: now.toISOString(),
    };
    DI.verifiedItems.push(verifiedItem);
    DI.verifying = false;

    diToast('Item added to gatepass!', 'success');
    diUpdateVerifiedList();
    diClearQR();

  } catch (err) {
    console.error('[DI] Verify PATCH error:', err);
    DI.verifying = false;
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-plus-circle"></i> Add to Gatepass'; }
    diToast(`Verification failed: ${err.message}`, 'error');
  }
}

function diUpdateVerifiedList() {
  const list = document.getElementById('diVerifiedList');
  const countBadge = document.getElementById('diGPCount');
  const completeBtn = document.getElementById('diBtnCompleteGP');

  if (!list) return;

  if (DI.verifiedItems.length === 0) {
    list.innerHTML = `
      <div class="pi-verified-empty di-verified-empty">
        <i class="fa-regular fa-clipboard"></i>
        <span>No items verified yet.<br/>Scan a QR code to begin.</span>
      </div>`;
    if (completeBtn) completeBtn.disabled = true;
    if (countBadge) countBadge.textContent = '0';
    return;
  }

  let html = '';
  DI.verifiedItems.forEach((item, idx) => {
    html += `
      <div class="pi-verified-item di-verified-item">
        <div class="pi-vi-header di-vi-header">
          <span class="pi-vi-num di-vi-num">#${idx + 1}</span>
          <span class="pi-vi-qr di-vi-qr">${diEscape(item.QR_Code)}</span>
          <button class="pi-btn-remove-item di-btn-remove-item" onclick="diRemoveItem(${idx})" title="Remove from gatepass">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="pi-vi-body di-vi-body">
          <span><strong>PO:</strong> ${diEscape(item.PO || '—')}</span>
          <span><strong>Model:</strong> ${diEscape(item.Model || '—')}</span>
          <span><strong>Colour:</strong> ${diEscape(item.Outsole_Colour || '—')}</span>
          <span><strong>Size:</strong> EU ${diEscape(String(item.Size || '—'))}</span>
          <span><strong>QTY:</strong> ${diEscape(String(item.QTY || '—'))}</span>
        </div>
      </div>`;
  });

  list.innerHTML = html;
  if (countBadge) countBadge.textContent = DI.verifiedItems.length;
  if (completeBtn) completeBtn.disabled = false;
}

function diRemoveItem(index) {
  if (index < 0 || index >= DI.verifiedItems.length) return;
  const item = DI.verifiedItems[index];
  
  if (!confirm(`Remove ${item.QR_Code} from this gatepass?`)) return;

  DI.verifiedItems.splice(index, 1);
  diUpdateVerifiedList();
  diToast('Item removed from gatepass.', 'info');
}

async function diCompleteGatepass() {
  if (DI.verifiedItems.length === 0 || DI.completing) return;

  if (!confirm(`Complete gatepass "${DI.gatepassName}" with ${DI.verifiedItems.length} items?`)) return;

  DI.completing = true;
  const btn = document.getElementById('diBtnCompleteGP');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…'; }

  try {
    await diSaveGatepassRecord();
    diShowGatepassSuccess();

  } catch (err) {
    console.error('[DI] Complete gatepass error:', err);
    DI.completing = false;
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Complete Gatepass'; }
    diToast(`Failed to complete gatepass: ${err.message}`, 'error');
  }
}

async function diSaveGatepassRecord() {
  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const gatepassData = {
    GatepassName:   DI.gatepassName,
    CreatedBy:      sessionStorage.getItem('sm_user') || 'Unknown',
    CreatedDate:    dateStr,
    CreatedTime:    timeStr,
    ItemCount:      DI.verifiedItems.length,
    TotalQty:       DI.verifiedItems.reduce((s, i) => s + (parseInt(i.QTY) || 0), 0),
    Items:          DI.verifiedItems.map(item => ({
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
    Rows_JSON:                    JSON.stringify(gatepassData),
    'Created Date':               dateStr,
    'Created Time':               timeStr,
    Status:                       'Pending Approval',
    'Gatepass name':              DI.gatepassName,
    'Approved Manegement User':   '',
    'Manegement Approve Date':    '',
    'Manegement Approve Time':    '',
  };

  const sheetUrl = CONFIG.SHEETBEST_DESMA_IN_GATEPASS_URL
    || `${CONFIG.SHEETBEST_URL}/tabs/Desma In Gatepass`;

  console.log('[DI] Saving gatepass to:', sheetUrl);
  console.log('[DI] Row payload keys:', Object.keys(rowData));
  console.log('[DI] Row payload:', JSON.stringify(rowData));

  const res = await fetch(sheetUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(rowData),
  });

  if (!res.ok) {
    let errText = '';
    try   { errText = await res.text(); } catch (_) { /* ignore */ }
    console.error('[DI] SheetBest error response (status=' + res.status + '):', errText);
    let parsedErr = {};
    try   { parsedErr = JSON.parse(errText); } catch (_) { /* ignore */ }
    const msg = parsedErr?.message || parsedErr?.error || errText || `Sheet save failed: ${res.status}`;
    throw new Error(msg);
  }

  try {
    const saved = await res.json();
    console.log('[DI] SheetBest save success:', saved);
  } catch (_) { /* ignore */ }
}

function diShowGatepassSuccess() {
  const bodyEl = document.getElementById('moduleBody');
  if (!bodyEl) return;

  bodyEl.innerHTML = `
    <div class="pi-gp-success di-gp-success">
      <div class="pi-success-icon di-success-icon">
        <i class="fa-solid fa-circle-check"></i>
      </div>
      <h3 class="pi-success-title di-success-title">Gatepass Complete!</h3>
      <p class="pi-success-body di-success-body">
        Desma Gatepass <strong>"${diEscape(DI.gatepassName)}"</strong> has been successfully created
        with ${DI.verifiedItems.length} verified items and saved to the system.
      </p>
      <div class="pi-success-grid di-success-grid">
        <div class="pi-success-cell di-success-cell">
          <div class="pi-sc-label di-sc-label">Gatepass Name</div>
          <div class="pi-sc-value di-sc-value">${diEscape(DI.gatepassName)}</div>
        </div>
        <div class="pi-success-cell di-success-cell">
          <div class="pi-sc-label di-sc-label">Items</div>
          <div class="pi-sc-value di-sc-value">${DI.verifiedItems.length}</div>
        </div>
        <div class="pi-success-cell di-success-cell">
          <div class="pi-sc-label di-sc-label">Total QTY</div>
          <div class="pi-sc-value di-sc-value" style="color:#14b8a6">${DI.verifiedItems.reduce((s, i) => s + (parseInt(i.QTY) || 0), 0)}</div>
        </div>
        <div class="pi-success-cell di-success-cell">
          <div class="pi-sc-label di-sc-label">Status</div>
          <div class="pi-sc-value di-sc-value" style="color:#fbbf24">Pending Approval</div>
        </div>
      </div>
      <div class="pi-success-actions di-success-actions">
        <!-- "Switch to WhatsApp" action (injected after gatepass completion) -->
        <div id="diWhatsAppAction"></div>
        <button class="pi-btn-new-gatepass di-btn-new-gatepass" onclick="diNewGatepass()">
          <i class="fa-solid fa-plus"></i> New Gatepass
        </button>
      </div>
    </div>

    <div class="pi-toast di-toast" id="diToast" role="status" aria-live="polite"></div>
  `;

  diToast('Gatepass saved successfully!', 'success');

  // ── "Switch to WhatsApp" action (Desma In gatepass completed) ──
  if (typeof injectWhatsAppButton === 'function') {
    const waUser = sessionStorage.getItem('sm_user') || 'Unknown';
    const waNow  = new Date();
    injectWhatsAppButton(
      'diWhatsAppAction',
      waMsg([
        '*SOLE MATRIX — Desma In Gatepass Created*',
        '',
        '📄 Gatepass: ' + DI.gatepassName,
        '🏢 Department: Desma Department (Desma In)',
        '👤 Created by: ' + waUser,
        '📅 Date: ' + waNow.toLocaleDateString('en-GB') + ' ' +
          waNow.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        '📦 Items: ' + DI.verifiedItems.length +
          ' | Total QTY: ' + DI.verifiedItems.reduce((s, i) => s + (parseInt(i.QTY) || 0), 0),
        '📌 Status: Pending Approval',
      ]),
      {
        label: 'Switch to WhatsApp',
        sub: 'Notify the team about this gatepass',
        scenario: WA_SCENARIOS.GATEPASS_COMPLETED,
      }
    );
  }

  DI.completing = false;
}

function diNewGatepass() {
  const bodyEl = document.getElementById('moduleBody');
  if (bodyEl) initDesmaInModule(bodyEl);
}

function destroyDesmaInModule() {
  diStopQR();
  DI.gatepassName  = null;
  DI.verifiedItems = [];
  DI.qrResult      = null;
  DI.matchedRow    = null;
  DI.verifying     = false;
  DI.completing    = false;
}

let _diToastTimer = null;

function diToast(message, type = 'info') {
  const toast = document.getElementById('diToast');
  if (!toast) return;
  const icons = { success: 'fa-circle-check', error: 'fa-circle-exclamation', info: 'fa-circle-info' };
  toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i> ${diEscape(message)}`;
  toast.className = `pi-toast di-toast pi-toast-${type} di-toast-${type} show`;
  clearTimeout(_diToastTimer);
  _diToastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

function diEscape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function diGetProp(row, keySpace, keyUnderscore, fallback = '—') {
  if (!row) return fallback;
  if (row[keyUnderscore] !== undefined && row[keyUnderscore] !== null && String(row[keyUnderscore]).trim() !== '') return row[keyUnderscore];
  if (row[keySpace]      !== undefined && row[keySpace]      !== null && String(row[keySpace]).trim()      !== '') return row[keySpace];
  return fallback;
}

function diGetQR(row) {
  return diGetProp(row, 'QR Code', 'QR_Code', null);
}

function diGetColour(row) {
  return diGetProp(row, 'Outsole Colour', 'Outsole_Colour');
}

function diMatchQR(row, qrCode) {
  const cell = diGetQR(row);
  if (cell === null) return false;
  const a = String(cell).trim();
  const b = String(qrCode).trim();
  if (a === b) return true;
  const na = parseFloat(a), nb = parseFloat(b);
  if (!isNaN(na) && !isNaN(nb) && na === nb) return true;
  return false;
}
