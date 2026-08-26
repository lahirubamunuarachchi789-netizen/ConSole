/* ═══════════════════════════════════════════════════════════════
   SOLE MATRIX — Production Out Module
   Concord Footwear (Pvt) Ltd
   ─────────────────────────────────────────────────────────────
   Flow:
     1. User scans or manually enters QR code
     2. System looks up the item from Production In records
     3. User enters the quantity to dispatch
     4. User submits to mark as dispatched from production floor
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   MODULE STATE
   ───────────────────────────────────────────────────────────── */
const PO = {
  qrScanner:       null,
  qrRunning:       false,
  qrResult:        null,
  currentCamera:   'environment',
  matchedRow:      null,
  submitting:      false,
  isRegulatedReentry: false,  // true when the QR was returned from Desma ("Desma To GFU")
};

/* ─────────────────────────────────────────────────────────────
   ENTRY POINT
   ───────────────────────────────────────────────────────────── */
function initProductionOutModule(bodyEl) {
  // Reset state
  PO.qrScanner     = null;
  PO.qrRunning     = false;
  PO.qrResult      = null;
  PO.matchedRow    = null;
  PO.submitting    = false;
  PO.isRegulatedReentry = false;

  bodyEl.innerHTML = buildProductionOutUI();
  
  // Start QR scanner after a short delay
  setTimeout(() => poStartQR(), 300);
}

/* ─────────────────────────────────────────────────────────────
   MAIN UI
   ───────────────────────────────────────────────────────────── */
function buildProductionOutUI() {
  return `
    <div class="po-container">
      
      <!-- Header Section -->
      <div class="po-header">
        <div class="po-header-icon">
          <i class="fa-solid fa-arrow-right-from-bracket"></i>
        </div>
        <div class="po-header-info">
          <div class="po-header-label">Production Out</div>
          <div class="po-header-title">Dispatch Items from Production Floor</div>
        </div>
      </div>

      <!-- Main Content -->
      <div class="po-content">
        
        <!-- QR Code Section -->
        <div class="po-section">
          <div class="po-section-label">
            <i class="fa-solid fa-qrcode"></i> Scan or Enter QR Code
          </div>

          <div class="po-tab-bar">
            <button class="po-tab-btn active" id="poTabScan" onclick="poSwitchTab('scan')" aria-selected="true">
              <i class="fa-solid fa-camera"></i> Scan QR
            </button>
            <button class="po-tab-btn" id="poTabManual" onclick="poSwitchTab('manual')" aria-selected="false">
              <i class="fa-solid fa-keyboard"></i> Manual Entry
            </button>
          </div>

          <!-- Scan Panel -->
          <div id="poPanelScan">
            <div class="po-viewport-wrap">
              <div id="poQRReader"></div>
              <div class="po-corner tl"></div>
              <div class="po-corner tr"></div>
              <div class="po-corner bl"></div>
              <div class="po-corner br"></div>
              <div class="po-scanline" id="poScanLine"></div>
              <div class="po-status-strip" id="poStatusStrip">
                <i class="fa-solid fa-spinner fa-spin"></i> Starting camera…
              </div>
            </div>
            <button class="po-btn-toggle-cam" onclick="poToggleCam()">
              <i class="fa-solid fa-camera-rotate"></i> Switch Camera
            </button>
          </div>

          <!-- Manual Panel -->
          <div id="poPanelManual" style="display:none">
            <label class="po-field-label" for="poManualInput">QR CODE VALUE</label>
            <div class="po-manual-row">
              <input type="text" id="poManualInput"
                     class="po-text-input"
                     placeholder="Type or paste QR code…"
                     oninput="poOnManualInput(this)"
                     onkeydown="if(event.key==='Enter')poConfirmManual()" />
              <button class="po-btn-confirm-manual" onclick="poConfirmManual()">
                <i class="fa-solid fa-magnifying-glass"></i> Look Up
              </button>
            </div>
          </div>

          <!-- QR Result Badge -->
          <div class="po-qr-result-box" id="poQRResultBox">
            <i class="fa-solid fa-check-circle"></i>
            <span>QR: <strong id="poQRResultText"></strong></span>
            <button onclick="poClearQR()" class="po-btn-clear" aria-label="Clear QR">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <!-- Lookup Result Area -->
          <div id="poLookupResult"></div>
        </div>

      </div>

    </div>

    <div class="po-toast" id="poToast" role="status" aria-live="polite"></div>
  `;
}

/* ─────────────────────────────────────────────────────────────
   TAB SWITCHING
   ───────────────────────────────────────────────────────────── */
function poSwitchTab(tab) {
  const scanBtn    = document.getElementById('poTabScan');
  const manualBtn  = document.getElementById('poTabManual');
  const scanPanel  = document.getElementById('poPanelScan');
  const manualPanel= document.getElementById('poPanelManual');
  if (!scanBtn) return;

  if (tab === 'scan') {
    scanBtn.classList.add('active');    scanBtn.setAttribute('aria-selected', 'true');
    manualBtn.classList.remove('active'); manualBtn.setAttribute('aria-selected', 'false');
    scanPanel.style.display  = 'block';
    manualPanel.style.display= 'none';
    if (!PO.qrResult) poStartQR();
  } else {
    manualBtn.classList.add('active');    manualBtn.setAttribute('aria-selected', 'true');
    scanBtn.classList.remove('active');   scanBtn.setAttribute('aria-selected', 'false');
    manualPanel.style.display= 'block';
    scanPanel.style.display  = 'none';
    poStopQR();
    setTimeout(() => document.getElementById('poManualInput')?.focus(), 100);
  }
}

/* ─────────────────────────────────────────────────────────────
   QR SCANNER
   ───────────────────────────────────────────────────────────── */
async function poStartQR() {
  if (!window.Html5Qrcode) {
    poUpdateStatus('<i class="fa-solid fa-triangle-exclamation" style="color:#f87171"></i> Camera library not loaded.', false);
    return;
  }
  await poStopQR();
  PO.qrScanner = new Html5Qrcode('poQRReader');
  PO.currentCamera = 'environment';
  const config = { fps: 10, qrbox: { width: 220, height: 180 }, aspectRatio: 1.4, disableFlip: false };

  try {
    await PO.qrScanner.start({ facingMode: 'environment' }, config, (text) => poOnQRSuccess(text), () => {});
    PO.qrRunning = true;
    poUpdateStatus('<i class="fa-solid fa-circle-dot" style="color:#f97316"></i> Camera active — point at QR code', false);
  } catch {
    try {
      await PO.qrScanner.start({ facingMode: 'user' }, config, (text) => poOnQRSuccess(text), () => {});
      PO.qrRunning = true;
      poUpdateStatus('<i class="fa-solid fa-circle-dot" style="color:#f97316"></i> Camera active (front)', false);
    } catch {
      poUpdateStatus('<i class="fa-solid fa-triangle-exclamation" style="color:#f87171"></i> Camera unavailable', false);
    }
  }
}

async function poStopQR() {
  if (PO.qrScanner && PO.qrRunning) {
    try { await PO.qrScanner.stop(); PO.qrScanner.clear(); } catch {}
    PO.qrRunning = false;
    PO.qrScanner = null;
  }
}

async function poToggleCam() {
  if (!PO.qrScanner) return;
  await poStopQR();
  poUpdateStatus('<i class="fa-solid fa-spinner fa-spin"></i> Switching camera…', false);
  PO.currentCamera = PO.currentCamera === 'environment' ? 'user' : 'environment';
  PO.qrScanner = new Html5Qrcode('poQRReader');
  const config = { fps: 10, qrbox: { width: 220, height: 180 }, aspectRatio: 1.4 };
  try {
    await PO.qrScanner.start({ facingMode: PO.currentCamera }, config, (text) => poOnQRSuccess(text), () => {});
    PO.qrRunning = true;
    poUpdateStatus('<i class="fa-solid fa-circle-dot" style="color:#f97316"></i> Camera switched', false);
  } catch {
    poUpdateStatus('<i class="fa-solid fa-triangle-exclamation" style="color:#f87171"></i> Could not switch camera', false);
  }
}

function poUpdateStatus(html, detected) {
  const strip = document.getElementById('poStatusStrip');
  if (strip) { strip.innerHTML = html; strip.classList.toggle('detected', detected); }
}

/* ─────────────────────────────────────────────────────────────
   QR CAPTURE
   ───────────────────────────────────────────────────────────── */
function poOnQRSuccess(text) {
  if (!text || !text.trim()) return;
  PO.qrResult = text.trim();
  poUpdateStatus('<i class="fa-solid fa-qrcode"></i> QR Code captured!', true);
  const scanLine = document.getElementById('poScanLine');
  if (scanLine) scanLine.style.display = 'none';
  const box  = document.getElementById('poQRResultBox');
  const disp = document.getElementById('poQRResultText');
  if (box && disp) { disp.textContent = PO.qrResult; box.classList.add('visible'); }
  poStopQR();
  poToast('QR code captured!', 'success');
  poLookupQR(PO.qrResult);
}

function poOnManualInput(input) {
  PO.qrResult = input.value.trim() || null;
}

function poConfirmManual() {
  const inp = document.getElementById('poManualInput');
  if (!inp || !inp.value.trim()) { poToast('Please enter a QR code value.', 'error'); return; }
  poOnQRSuccess(inp.value.trim());
}

function poClearQR() {
  PO.qrResult   = null;
  PO.matchedRow = null;
  PO.isRegulatedReentry = false;
  const box = document.getElementById('poQRResultBox');
  if (box) box.classList.remove('visible');
  const line = document.getElementById('poScanLine');
  if (line) line.style.display = '';
  const inp = document.getElementById('poManualInput');
  if (inp) inp.value = '';
  poUpdateStatus('<i class="fa-solid fa-spinner fa-spin"></i> Starting camera…', false);
  const area = document.getElementById('poLookupResult');
  if (area) area.innerHTML = '';
  const scanPanel = document.getElementById('poPanelScan');
  if (scanPanel && scanPanel.style.display !== 'none') poStartQR();
}

/* ─────────────────────────────────────────────────────────────
   LOOKUP QR CODE
   ───────────────────────────────────────────────────────────── */

/**
 * Check whether a QR code already exists in the GFU Out sheet
 * (column A "QR Code") and whether any matching row was returned
 * from Desma (column N "Return Sttus" = "Desma To GFU").
 *
 * Rule: each "Desma To GFU" return entitles exactly ONE re-entry
 * (marked Status = "Regulated" in column Q). Once that regulated
 * re-entry exists, the QR code is blocked again until it is
 * returned once more.
 */
function poCheckGFUOutQR(gfuOutRows, qrCode) {
  const target = String(qrCode || '').trim();
  const matches = (Array.isArray(gfuOutRows) ? gfuOutRows : []).filter(r => {
    if (!r || !r['QR Code']) return false;
    const cellQR = String(r['QR Code']).trim();
    if (cellQR === target) return true;
    const na = parseFloat(cellQR), nb = parseFloat(target);
    return !isNaN(na) && !isNaN(nb) && na === nb;
  });

  const returnedRows  = matches.filter(r =>
    String(r['Return Sttus'] || r['Return_Sttus'] || '').trim() === 'Desma To GFU');
  const regulatedRows = matches.filter(r =>
    String(r['Status'] || '').trim() === 'Regulated');

  /* A re-entry is only allowed while there are more returns than
     regulated re-entries (i.e. an unused return is pending). */
  const canReenter = returnedRows.length > regulatedRows.length;

  return {
    exists:         matches.length > 0,
    returnedCount:  returnedRows.length,
    regulatedCount: regulatedRows.length,
    isReturned:     canReenter,   // kept for compatibility: true when re-entry allowed
    canReenter,
    returnedRows,
  };
}

async function poLookupQR(qrCode) {
  const area = document.getElementById('poLookupResult');
  if (!area) return;
  area.innerHTML = '<div class="po-lookup-loading"><div class="po-spinner"></div><span>Looking up QR code…</span></div>';

  try {
    // Look up in Stores Out sheet (items that have been verified for Production In)
    const res = await fetch(CONFIG.SHEETBEST_STORESOUT_URL, { method: 'GET' });
    if (!res.ok) throw new Error(`Sheet error ${res.status}`);
    const rows = await res.json();
    if (!Array.isArray(rows)) throw new Error('Unexpected response from sheet.');

    // Find row where Column O (Numbers) contains the scanned QR code
    // Numbers column contains comma-separated QR codes (e.g., "5,6,7,8,9,10,11")
    const match = rows.find(r => {
      if (!r || !r.Numbers) return false;
      const numbersArray = r.Numbers.split(',').map(n => n.trim());
      return numbersArray.includes(qrCode.trim());
    });

    if (!match) { area.innerHTML = buildPONotFound(qrCode); return; }

    // Check if item has been verified (Production In)
    if (!match.Vrification || match.Vrification.trim() === '') {
      area.innerHTML = buildPONotVerified(match);
      return;
    }

    // Get all QR codes in the same cell (same Numbers group)
    const qrCodesInSameCell = match.Numbers.split(',').map(n => n.trim());

    // Check GFU Out sheet for ALL dispatches made with ANY QR code from the same cell
    const gfuOutRes = await fetch(CONFIG.SHEETBEST_GFUOUT_URL, { method: 'GET' });
    if (!gfuOutRes.ok) throw new Error(`Could not check GFU Out sheet: ${gfuOutRes.status}`);
    
    const gfuOutRows = await gfuOutRes.json();
    if (!Array.isArray(gfuOutRows)) throw new Error('Unexpected response from GFU Out sheet.');

    /* ── Duplicate-QR guard (GFU Out column A) ─────────────────────
       A QR code that already exists in GFU Out cannot be dispatched
       again — UNLESS it was returned from Desma (column N
       "Return Sttus" = "Desma To GFU") and that return has not been
       used for a regulated re-entry yet. Each return allows exactly
       ONE re-entry, marked Status = "Regulated" (column Q). */
    const qrCheck = poCheckGFUOutQR(gfuOutRows, qrCode);
    PO.isRegulatedReentry = false;

    if (qrCheck.exists && !qrCheck.canReenter) {
      area.innerHTML = buildPOAlreadyDispatched(qrCode, qrCheck.regulatedCount > 0);
      return;
    }

    const isRegulatedReentry = qrCheck.exists && qrCheck.canReenter;
    PO.isRegulatedReentry = isRegulatedReentry;

    // Find all previous dispatches for ANY QR code in the same cell
    const previousDispatches = gfuOutRows.filter(r => {
      if (!r || !r['QR Code']) return false;
      const dispatchedQR = String(r['QR Code']).trim();
      return qrCodesInSameCell.includes(dispatchedQR);
    });

    // Calculate total dispatched quantity for ALL QR codes in the same cell
    const totalDispatchedQty = previousDispatches.reduce((sum, r) => {
      const qty = parseInt(r.QTY || 0);
      return sum + qty;
    }, 0);

    // Calculate available balance (shared across all QR codes in the same cell)
    const totalAvailableQty = parseInt(match.QTY || 0);
    let balanceQty = totalAvailableQty - totalDispatchedQty;

    /* Regulated re-entry: the quantity that came back from Desma can be
       dispatched again, regardless of the group's consumed balance. */
    if (isRegulatedReentry) {
      const returnedQty = qrCheck.returnedRows.reduce((sum, r) => sum + (parseInt(r.QTY) || 0), 0);
      balanceQty = returnedQty > 0 ? returnedQty : totalAvailableQty;
    }

    // Store balance information in matched row
    PO.matchedRow = {
      ...match,
      OriginalQTY: totalAvailableQty,
      DispatchedQTY: totalDispatchedQty,
      BalanceQTY: balanceQty,
      QRCodesInGroup: qrCodesInSameCell
    };

    // Check if balance is zero or negative (skipped for regulated re-entry)
    if (balanceQty <= 0 && !isRegulatedReentry) {
      area.innerHTML = buildPOFullyDispatched(match, totalAvailableQty, totalDispatchedQty, qrCodesInSameCell);
      return;
    }

    area.innerHTML = buildPODetails(PO.matchedRow);

  } catch (err) {
    console.error('[PO] Lookup error:', err);
    area.innerHTML = buildPOError(err.message);
  }
}

/* ─────────────────────────────────────────────────────────────
   BUILD DETAIL CARD
   ───────────────────────────────────────────────────────────── */
function buildPODetails(row) {
  return `
    <div class="po-details-card">
      <div class="po-details-header">
        <div class="po-details-icon"><i class="fa-solid fa-box-open"></i></div>
        <div>
          <div class="po-details-label">Production Item Found</div>
          <div class="po-details-qr-val">QR: ${poEscape(PO.qrResult || '—')}</div>
        </div>
        <span class="po-badge verified"><i class="fa-solid fa-check-circle"></i> Verified</span>
      </div>
      
      <div class="po-details-grid">
        <div class="po-detail-cell">
          <span class="po-cell-label"><i class="fa-solid fa-hashtag"></i> PO Number</span>
          <span class="po-cell-value po">${poEscape(row.PO || '—')}</span>
        </div>
        <div class="po-detail-cell">
          <span class="po-cell-label"><i class="fa-solid fa-shoe-prints"></i> Model</span>
          <span class="po-cell-value">${poEscape(row.Model || '—')}</span>
        </div>
        <div class="po-detail-cell">
          <span class="po-cell-label"><i class="fa-solid fa-palette"></i> Outsole Colour</span>
          <span class="po-cell-value">${poEscape(row.Outsole_Colour || '—')}</span>
        </div>
        <div class="po-detail-cell">
          <span class="po-cell-label"><i class="fa-solid fa-ruler"></i> Size</span>
          <span class="po-cell-value">EU ${poEscape(String(row.Size || '—'))}</span>
        </div>
        <div class="po-detail-cell">
          <span class="po-cell-label"><i class="fa-solid fa-cubes"></i> Total QTY</span>
          <span class="po-cell-value">${poEscape(String(row.OriginalQTY || row.QTY || '0'))}</span>
        </div>
        <div class="po-detail-cell">
          <span class="po-cell-label"><i class="fa-solid fa-check-circle"></i> Dispatched</span>
          <span class="po-cell-value" style="color:#ef4444">${poEscape(String(row.DispatchedQTY || '0'))}</span>
        </div>
        <div class="po-detail-cell">
          <span class="po-cell-label"><i class="fa-solid fa-box"></i> Balance QTY</span>
          <span class="po-cell-value" style="color:#22c55e;font-weight:bold">${poEscape(String(row.BalanceQTY || row.QTY || '0'))}</span>
        </div>
        <div class="po-detail-cell">
          <span class="po-cell-label"><i class="fa-solid fa-file-invoice"></i> MRN Name</span>
          <span class="po-cell-value">${poEscape(row.MRN_Name || '—')}</span>
        </div>
      </div>

      ${PO.isRegulatedReentry ? `
        <div class="po-info-note" style="background:rgba(20,184,166,0.08);border:1px solid rgba(20,184,166,0.45);border-radius:8px;padding:12px;margin:16px 0;display:flex;gap:10px;align-items:start;">
          <i class="fa-solid fa-rotate-left" style="color:#14b8a6;margin-top:2px;"></i>
          <div style="flex:1;font-size:13px;color:#0f766e;">
            <strong>Regulated Re-entry (one-time):</strong> This QR code was returned from Desma
            (Return Status: <strong>"Desma To GFU"</strong>) and may be entered <strong>once</strong>.
            The new GFU Out entry will be marked as <strong>"Regulated"</strong> in the Status column,
            after which this QR code cannot be entered again unless it is returned once more.
            <br><strong>Returned QTY available:</strong> ${poEscape(String(row.BalanceQTY || 0))}
          </div>
        </div>
      ` : ''}

      ${row.QRCodesInGroup && row.QRCodesInGroup.length > 1 ? `
        <div class="po-info-note" style="background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;padding:12px;margin:16px 0;display:flex;gap:10px;align-items:start;">
          <i class="fa-solid fa-circle-info" style="color:#f97316;margin-top:2px;"></i>
          <div style="flex:1;font-size:13px;color:#78350f;">
            <strong>Shared Quantity:</strong> This QR code shares the total quantity with other QR codes: 
            <strong>${row.QRCodesInGroup.join(', ')}</strong>. 
            The balance shown (${row.BalanceQTY || 0}) is shared across all these QR codes.
          </div>
        </div>
      ` : ''}

      <div class="po-dispatch-block">
        <p class="po-dispatch-hint">
          <i class="fa-solid fa-circle-info"></i>
          Enter the quantity to dispatch from the production floor (Max: <strong>${poEscape(String(row.BalanceQTY || row.QTY || '0'))}</strong>) and click <strong>Submit</strong>.
        </p>
        
        <div class="po-qty-input-wrap">
          <label class="po-field-label" for="poQtyInput">
            <i class="fa-solid fa-cubes"></i> DISPATCH QUANTITY
          </label>
          <input type="number" id="poQtyInput" class="po-text-input po-qty-input" 
                 placeholder="Enter quantity" min="1" max="${row.BalanceQTY || row.QTY || 0}" />
        </div>
        </div>
        </div>

        <div class="po-dispatch-actions">
          <button class="po-btn-cancel" onclick="poClearQR()">
            <i class="fa-solid fa-xmark"></i> Cancel
          </button>
          <button class="po-btn-submit" id="poBtnSubmit" onclick="poSubmitDispatch()">
            <i class="fa-solid fa-paper-plane"></i> Submit
          </button>
        </div>
      </div>
    </div>`;
}

function buildPONotVerified(row) {
  return `
    <div class="po-not-found">
      <div class="po-nf-icon" style="color:#fbbf24"><i class="fa-solid fa-circle-exclamation"></i></div>
      <div class="po-nf-title">Not Ready for Production Out</div>
      <div class="po-nf-body">
        QR number <strong>"${poEscape(PO.qrResult)}"</strong> has not been verified through Production In yet.
        Please verify this item through Production In first.
      </div>
      <button class="po-btn-scan-again" onclick="poClearQR()">
        <i class="fa-solid fa-qrcode"></i> Scan Another
      </button>
    </div>`;
}

function buildPOFullyDispatched(row, totalQty, dispatchedQty, qrCodesInGroup) {
  return `
    <div class="po-not-found" style="border-color:#fbbf24">
      <div class="po-nf-icon" style="color:#fbbf24"><i class="fa-solid fa-circle-check"></i></div>
      <div class="po-nf-title">Fully Dispatched</div>
      <div class="po-nf-body">
        QR code <strong>"${poEscape(PO.qrResult)}"</strong> belongs to a group that has been fully dispatched.
        <br><br>
        <strong>QR Codes in Same Group:</strong><br>
        ${qrCodesInGroup.join(', ')}
        <br><br>
        <strong>Dispatch Summary:</strong><br>
        Total Available: ${totalQty}<br>
        Already Dispatched: ${dispatchedQty}<br>
        Remaining Balance: 0
        <br><br>
        <em>No more quantity can be dispatched for any QR code in this group.</em>
      </div>
      <button class="po-btn-scan-again" onclick="poClearQR()">
        <i class="fa-solid fa-qrcode"></i> Scan Another
      </button>
    </div>`;
}

/**
 * Blocked card — the scanned QR code already exists in the GFU Out
 * sheet (column A) and cannot be dispatched again.
 *   alreadyRegulated=false → plain duplicate (never returned)
 *   alreadyRegulated=true  → the return was already consumed by a
 *                            "Regulated" re-entry, so no further
 *                            entry is allowed.
 */
function buildPOAlreadyDispatched(qrCode, alreadyRegulated = false) {
  const reason = alreadyRegulated
    ? `<em>This QR code was returned from Desma and has <strong>already been re-entered as "Regulated"</strong>.
       The same data cannot be entered again unless it is returned once more
       (Return Status: <strong>"Desma To GFU"</strong>).</em>`
    : `<em>Only QR codes returned from Desma (Return Status: <strong>"Desma To GFU"</strong>)
       can be dispatched again — such re-entries are marked as <strong>"Regulated"</strong>.</em>`;

  return `
    <div class="po-not-found" style="border-color:#f87171">
      <div class="po-nf-icon" style="color:#f87171"><i class="fa-solid fa-ban"></i></div>
      <div class="po-nf-title">QR Code Already Dispatched</div>
      <div class="po-nf-body">
        QR code <strong>"${poEscape(qrCode)}"</strong> already exists in the GFU Out sheet
        and cannot be entered again.
        <br><br>
        ${reason}
      </div>
      <button class="po-btn-scan-again" onclick="poClearQR()">
        <i class="fa-solid fa-qrcode"></i> Scan Another
      </button>
    </div>`;
}

function buildPONotFound(qrCode) {
  return `
    <div class="po-not-found">
      <div class="po-nf-icon"><i class="fa-solid fa-circle-xmark"></i></div>
      <div class="po-nf-title">No Record Found</div>
      <div class="po-nf-body">
        QR code <strong>"${poEscape(qrCode)}"</strong> does not match any production record.
      </div>
      <button class="po-btn-scan-again" onclick="poClearQR()">
        <i class="fa-solid fa-rotate-left"></i> Try Again
      </button>
    </div>`;
}

function buildPOError(msg) {
  return `
    <div class="po-not-found">
      <div class="po-nf-icon" style="color:#f87171"><i class="fa-solid fa-triangle-exclamation"></i></div>
      <div class="po-nf-title">Lookup Failed</div>
      <div class="po-nf-body">${poEscape(msg || 'Could not reach the sheet.')}</div>
      <button class="po-btn-scan-again" onclick="poClearQR()">
        <i class="fa-solid fa-rotate-left"></i> Try Again
      </button>
    </div>`;
}

/* ─────────────────────────────────────────────────────────────
   SUBMIT DISPATCH
   ───────────────────────────────────────────────────────────── */
async function poSubmitDispatch() {
  if (!PO.matchedRow || PO.submitting) return;

  const qtyInput = document.getElementById('poQtyInput');
  if (!qtyInput) return;

  const dispatchQty = parseInt(qtyInput.value);
  const balanceQty = parseInt(PO.matchedRow.BalanceQTY || PO.matchedRow.QTY || 0);

  if (isNaN(dispatchQty) || dispatchQty < 1) {
    poToast('Please enter a valid quantity (minimum 1).', 'error');
    qtyInput.focus();
    return;
  }

  // Validate against balance quantity
  if (dispatchQty > balanceQty) {
    poToast(`Quantity cannot exceed balance QTY (${balanceQty}).`, 'error');
    qtyInput.focus();
    return;
  }

  if (!confirm(`Dispatch ${dispatchQty} units of ${PO.matchedRow.Model} (QR: ${PO.qrResult})?`)) return;

  PO.submitting = true;

  const btn = document.getElementById('poBtnSubmit');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting…'; }

  const user    = sessionStorage.getItem('sm_user') || 'Unknown';
  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-GB',  { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-GB',  { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  try {
    /* ── Duplicate-QR guard — re-check against live GFU Out data ──
       Blocks the submit if the QR already exists in GFU Out column A,
       unless it was returned from Desma ("Desma To GFU" in column N). */
    let regulatedReentry = PO.isRegulatedReentry === true;
    try {
      const guardRes = await fetch(CONFIG.SHEETBEST_GFUOUT_URL, { method: 'GET' });
      if (guardRes.ok) {
        const guardRows = await guardRes.json();
        const check = poCheckGFUOutQR(Array.isArray(guardRows) ? guardRows : [], PO.qrResult);
        if (check.exists && !check.canReenter) {
          PO.submitting = false;
          if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit'; }
          poToast(`QR code "${PO.qrResult}" already exists in GFU Out — entry blocked.`, 'error');
          const area = document.getElementById('poLookupResult');
          if (area) area.innerHTML = buildPOAlreadyDispatched(PO.qrResult, check.regulatedCount > 0);
          return;
        }
        regulatedReentry = check.exists && check.canReenter;
        PO.isRegulatedReentry = regulatedReentry;
      }
    } catch (guardErr) {
      console.warn('[PO] Duplicate guard check skipped:', guardErr);
    }

    // 1. Update the Stores Out sheet with Production Out information
    const patchUrl = `${CONFIG.SHEETBEST_STORESOUT_URL}/QR_Code/${encodeURIComponent(PO.matchedRow.QR_Code.trim())}`;
    const patchPayload = {
      'Production Out':    'Dispatched',               // Column P: Production Out
      'Dispatched Qty':    dispatchQty,                // Column Q: Dispatched Qty
      'Dispatched User':   user,                       // Column R: Dispatched User
      'Dispatched Date':   dateStr,                    // Column S: Dispatched Date
      'Dispatched Time':   timeStr,                    // Column T: Dispatched Time
    };

    const patchRes = await fetch(patchUrl, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(patchPayload),
    });
    
    if (!patchRes.ok) {
      const errBody = await patchRes.json().catch(() => ({}));
      throw new Error(errBody?.message || `Stores Out update failed: ${patchRes.status}`);
    }

    // 2. Add a new row to the GFU Out sheet
    const gfuOutPayload = {
      'QR Code':         PO.qrResult,                  // Column A: QR Code (scanned number)
      'PO':              PO.matchedRow.PO,             // Column B: PO
      'Model':           PO.matchedRow.Model,          // Column C: Model
      'Outsole Colour':  PO.matchedRow.Outsole_Colour, // Column D: Outsole Colour
      'Size':            PO.matchedRow.Size,           // Column E: Size
      'QTY':             dispatchQty,                  // Column F: QTY (dispatch quantity)
      'Date':            dateStr,                      // Column G: Date
      'Time':            timeStr,                      // Column H: Time
      'MRN_Name':        PO.matchedRow.MRN_Name,       // Column I: MRN_Name
    };

    /* Regulated re-entry (item returned from Desma → "Desma To GFU"):
       mark the new GFU Out row in column Q. */
    if (regulatedReentry) {
      gfuOutPayload['Status'] = 'Regulated';           // Column Q: Status
    }

    const postRes = await fetch(CONFIG.SHEETBEST_GFUOUT_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(gfuOutPayload),
    });

    if (!postRes.ok) {
      const errBody = await postRes.json().catch(() => ({}));
      throw new Error(errBody?.message || `GFU Out save failed: ${postRes.status}`);
    }

    PO.submitting = false;
    poShowSuccess(dispatchQty);

  } catch (err) {
    console.error('[PO] Submit error:', err);
    PO.submitting = false;
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit'; }
    poToast(`Dispatch failed: ${err.message}`, 'error');
  }
}

/* ─────────────────────────────────────────────────────────────
   SUCCESS SCREEN
   ───────────────────────────────────────────────────────────── */
function poShowSuccess(qty) {
  const area = document.getElementById('poLookupResult');
  if (!area) return;

  area.innerHTML = `
    <div class="po-success">
      <div class="po-success-icon">
        <i class="fa-solid fa-circle-check"></i>
      </div>
      <h3 class="po-success-title">Dispatched Successfully!</h3>
      <p class="po-success-body">
        <strong>${qty} units</strong> of <strong>${poEscape(PO.matchedRow.Model)}</strong> 
        (QR: ${poEscape(PO.qrResult)}) have been dispatched from the production floor.
      </p>
      <div class="po-success-grid">
        <div class="po-success-cell">
          <div class="po-sc-label">QR Number</div>
          <div class="po-sc-value">${poEscape(PO.qrResult)}</div>
        </div>
        <div class="po-success-cell">
          <div class="po-sc-label">Dispatched Qty</div>
          <div class="po-sc-value" style="color:#f97316">${qty}</div>
        </div>
        <div class="po-success-cell">
          <div class="po-sc-label">Model</div>
          <div class="po-sc-value">${poEscape(PO.matchedRow.Model)}</div>
        </div>
        <div class="po-success-cell">
          <div class="po-sc-label">MRN Name</div>
          <div class="po-sc-value">${poEscape(PO.matchedRow.MRN_Name || '—')}</div>
        </div>
        <div class="po-success-cell">
          <div class="po-sc-label">Status</div>
          <div class="po-sc-value" style="color:#22c55e">Dispatched</div>
        </div>
      </div>
      <button class="po-btn-new-dispatch" onclick="poClearQR()">
        <i class="fa-solid fa-qrcode"></i> Scan Next Item
      </button>
    </div>
  `;

  poToast('Item dispatched successfully!', 'success');
}

/* ─────────────────────────────────────────────────────────────
   CLEANUP
   ───────────────────────────────────────────────────────────── */
function destroyProductionOutModule() {
  poStopQR();
  PO.qrResult   = null;
  PO.matchedRow = null;
  PO.submitting = false;
  PO.isRegulatedReentry = false;
}

/* ─────────────────────────────────────────────────────────────
   TOAST
   ───────────────────────────────────────────────────────────── */
let _poToastTimer = null;

function poToast(message, type = 'info') {
  const toast = document.getElementById('poToast');
  if (!toast) return;
  const icons = { success: 'fa-circle-check', error: 'fa-circle-exclamation', info: 'fa-circle-info' };
  toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i> ${poEscape(message)}`;
  toast.className = `po-toast po-toast-${type} show`;
  clearTimeout(_poToastTimer);
  _poToastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

/* ─────────────────────────────────────────────────────────────
   UTILITY
   ───────────────────────────────────────────────────────────── */
function poEscape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
