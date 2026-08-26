/* ═══════════════════════════════════════════════════════════════
   SOLE MATRIX — GATEPASS MANAGEMENT MODULE
   Concord Footwear (Pvt) Ltd

   Supports three gatepass sheet tabs:
     - 'storse'      → Storse To GFU Gatepass  (Outsole Production → GFU)
     - 'desma'       → Desma In Gatepass       (Desma Department → GFU)
     - 'desmaReturn' → Desma Return Gatepass   (Desma Department → GFU/Storse Outsole Return)
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   CONFIGURATION
   ───────────────────────────────────────────────────────────── */
const GATEPASS_CONFIG_MAP = {
  storse: {
    SHEET_URL: (typeof CONFIG !== 'undefined' && CONFIG.SHEETBEST_STORSE_TO_GFU_GATEPASS_URL)
      ? CONFIG.SHEETBEST_STORSE_TO_GFU_GATEPASS_URL
      : 'https://api.sheetbest.com/sheets/dd583123-5c7c-4279-8303-2aea56b7c8aa/tabs/Storse To GFU Gatepass',
    DEPARTMENT_LABEL: 'Outsole Production Department',
    /* Column headers carry typos — must match the sheet exactly */
    MGMT_FIELDS: {
      USER: 'Approved Manegement User',
      DATE: 'Manegement Approve Date',
      TIME: 'Manegement Approve Time',
    },
  },
  desma: {
    SHEET_URL: (typeof CONFIG !== 'undefined' && CONFIG.SHEETBEST_DESMA_IN_GATEPASS_URL)
      ? CONFIG.SHEETBEST_DESMA_IN_GATEPASS_URL
      : 'https://api.sheetbest.com/sheets/dd583123-5c7c-4279-8303-2aea56b7c8aa/tabs/Desma In Gatepass',
    DEPARTMENT_LABEL: 'Desma Department',
    /* Column headers carry typos — must match the sheet exactly */
    MGMT_FIELDS: {
      USER: 'Approved Manegement User',
      DATE: 'Manegement Approve Date',
      TIME: 'Manegement Approve Time',
    },
  },
  desmaReturn: {
    SHEET_URL: (typeof CONFIG !== 'undefined' && CONFIG.SHEETBEST_DESMA_RETURN_GATEPASS_URL)
      ? CONFIG.SHEETBEST_DESMA_RETURN_GATEPASS_URL
      : 'https://api.sheetbest.com/sheets/dd583123-5c7c-4279-8303-2aea56b7c8aa/tabs/Desma Return Gatepass',
    DEPARTMENT_LABEL: 'Desma Department (Outsole Return)',
    /* All gatepass sheets (incl. Desma Return) carry the "Manegement"
       typo in columns F/G/H — keys must match the sheet exactly. */
    MGMT_FIELDS: {
      USER: 'Approved Manegement User',
      DATE: 'Manegement Approve Date',
      TIME: 'Manegement Approve Time',
    },
  },
};
const GATEPASS_DEFAULT_MODE = 'storse';
const GATEPASS_VALID_MODES  = ['storse', 'desma', 'desmaReturn'];
const GATEPASS_TIMEOUT = 15000;

function gpSheetUrl(mode) {
  const cfg = GATEPASS_CONFIG_MAP[mode] || GATEPASS_CONFIG_MAP[GATEPASS_DEFAULT_MODE];
  return cfg.SHEET_URL;
}
function gpDeptLabel(mode) {
  const cfg = GATEPASS_CONFIG_MAP[mode] || GATEPASS_CONFIG_MAP[GATEPASS_DEFAULT_MODE];
  return cfg.DEPARTMENT_LABEL;
}
/* Management-approval column headers for the given mode (F / G / H) */
function gpMgmtFields(mode) {
  const cfg = GATEPASS_CONFIG_MAP[mode] || GATEPASS_CONFIG_MAP[GATEPASS_DEFAULT_MODE];
  return cfg.MGMT_FIELDS || {
    USER: 'Approved Manegement User',
    DATE: 'Manegement Approve Date',
    TIME: 'Manegement Approve Time',
  };
}

/* All gatepass sheet tabs — used by the unified "Pending Gatepass" view */
const GATEPASS_ALL_TAB_KEYS = ['storse', 'desma', 'desmaReturn'];

/* Department badge colour per source tab (unified list view) */
function gpDeptBadgeColor(tabKey) {
  if (tabKey === 'desmaReturn') {
    return 'background:rgba(20,184,166,0.15);border:1px solid rgba(20,184,166,0.4);color:#2dd4bf;';
  }
  if (tabKey === 'desma') {
    return 'background:rgba(139,92,246,0.15);border:1px solid rgba(139,92,246,0.4);color:#a78bfa;';
  }
  return 'background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.4);color:#fbbf24;';
}

/**
 * Fetch all rows from a single gatepass sheet tab.
 * Returns [] on failure so the union still works if one tab is
 * empty or unreachable.
 */
async function gpFetchTabRows(tabKey) {
  const url = gpSheetUrl(tabKey);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GATEPASS_TIMEOUT);
  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/**
 * Fetch "Pending Approval" gatepasses from ALL gatepass sheets,
 * tagging each row with _sourceTab so the unified list (and the
 * approval write) knows which sheet the row belongs to.
 */
async function fetchPendingGatepassesAllTabs() {
  const perTab = await Promise.all(GATEPASS_ALL_TAB_KEYS.map(async (tab) => {
    try {
      const rows = await gpFetchTabRows(tab);
      return rows.filter(row =>
        String(row['Status'] || '').trim().toLowerCase() === 'pending approval'
      ).map(row => ({ ...row, _sourceTab: tab }));
    } catch (err) {
      console.warn('[GATEPASS] Tab fetch failed:', tab, err);
      return [];
    }
  }));
  return perTab.flat();
}



/* ─────────────────────────────────────────────────────────────
   STATE
   ───────────────────────────────────────────────────────────── */
const GatepassState = {
  mode: GATEPASS_DEFAULT_MODE,
  gatepasses: [],
  currentGatepass: null,
  isLoading: false,
};

/* ─────────────────────────────────────────────────────────────
   FETCH PENDING GATEPASSES
   ───────────────────────────────────────────────────────────── */
async function fetchPendingGatepasses(mode) {
  const useMode = mode || GatepassState.mode || GATEPASS_DEFAULT_MODE;
  const url = gpSheetUrl(useMode);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GATEPASS_TIMEOUT);

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`API error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Filter only "Pending Approval" items
    const pendingGatepasses = data.filter(row => {
      const status = String(row['Status'] || '').trim();
      return status.toLowerCase() === 'pending approval';
    });

    return pendingGatepasses;

  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection.');
    }
    throw err;
  }
}

/* ─────────────────────────────────────────────────────────────
   UPDATE GATEPASS STATUS
   ───────────────────────────────────────────────────────────── */
async function updateGatepassStatus(rowData, newStatus, extraFields = {}, mode) {
  const useMode = mode || GatepassState.mode || GATEPASS_DEFAULT_MODE;
  const url = gpSheetUrl(useMode);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GATEPASS_TIMEOUT);

  try {
    const gatepassName = rowData['Gatepass name'];
    console.log('[UPDATE] Looking for gatepass:', gatepassName, '| mode:', useMode);

    const allRowsResponse = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });

    if (!allRowsResponse.ok) {
      throw new Error(`Failed to fetch rows: ${allRowsResponse.status}`);
    }

    const allRows = await allRowsResponse.json();
    console.log('[UPDATE] Total rows fetched:', allRows.length);

    const rowIndex = allRows.findIndex(row => row['Gatepass name'] === gatepassName);
    console.log('[UPDATE] Found at row index:', rowIndex);

    if (rowIndex === -1) {
      throw new Error(`Gatepass "${gatepassName}" not found in sheet`);
    }

    const updateUrl = `${url}/${rowIndex}`;
    const payload = { 'Status': newStatus, ...extraFields };

    console.log('[UPDATE] Update URL:', updateUrl);
    console.log('[UPDATE] Payload:', JSON.stringify(payload, null, 2));

    const updateResponse = await fetch(updateUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timer);

    const responseBody = await updateResponse.text();
    console.log('[UPDATE] Response status:', updateResponse.status);
    console.log('[UPDATE] Response body:', responseBody);

    if (!updateResponse.ok) {
      throw new Error(`Failed to update status: ${updateResponse.status} - ${responseBody}`);
    }

    return JSON.parse(responseBody);

  } catch (err) {
    clearTimeout(timer);
    console.error('[UPDATE] Error:', err);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection.');
    }
    throw err;
  }
}

/* ─────────────────────────────────────────────────────────────
   RENDER GATEPASS LIST
   ───────────────────────────────────────────────────────────── */
function renderGatepassList(gatepasses) {
  const content = `
    <div class="gatepass-container">
      <div class="gatepass-header">
        <div class="gatepass-count">
          <strong>${gatepasses.length}</strong> Pending Approval${gatepasses.length !== 1 ? 's' : ''}
        </div>
        <button class="refresh-btn" onclick="refreshGatepassList()">
          <i class="fa-solid fa-rotate-right"></i>
          <span>Refresh</span>
        </button>
      </div>
      
      ${gatepasses.length > 0 ? `
        <div class="gatepass-list">
          ${gatepasses.map((gp, index) => renderGatepassItem(gp, index)).join('')}
        </div>
      ` : `
        <div class="empty-state">
          <div class="empty-icon">
            <i class="fa-solid fa-clipboard-check"></i>
          </div>
          <p class="empty-text">No pending gatepasses at the moment</p>
        </div>
      `}
    </div>
  `;

  return content;
}

/* ─────────────────────────────────────────────────────────────
   RENDER SINGLE GATEPASS ITEM
   ───────────────────────────────────────────────────────────── */
function renderGatepassItem(gatepass, index) {
  // Parse JSON from Column A
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

  /* Department badge — shown when the row is tagged with a source tab
     (unified "all" view). Colour-coded per sheet, like the HR list. */
  const srcTab = gatepass._sourceTab || null;
  const deptBadge = srcTab ? `
    <span style="display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;font-size:0.68rem;font-weight:700;letter-spacing:0.03em;margin-bottom:6px;${gpDeptBadgeColor(srcTab)}">
      <i class="fa-solid fa-building"></i> ${sanitizeHTML(gpDeptLabel(srcTab))}
    </span>` : '';

  return `
    <div class="gatepass-item" onclick="viewGatepass(${index})">
      <div class="gatepass-icon">
        <i class="fa-solid fa-id-card"></i>
      </div>
      <div class="gatepass-info">
        ${deptBadge}
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
            <i class="fa-solid fa-clock"></i>
            <span>${sanitizeHTML(createdTime)}</span>
          </div>
        </div>
      </div>
      <div class="gatepass-arrow">
        <i class="fa-solid fa-chevron-right"></i>
      </div>
    </div>
  `;
}

/* ─────────────────────────────────────────────────────────────
   VIEW GATEPASS PREVIEW
   ───────────────────────────────────────────────────────────── */
function viewGatepass(index) {
  const gatepass = GatepassState.gatepasses[index];
  GatepassState.currentGatepass = gatepass;

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
  overlay.className = 'gatepass-preview-overlay';
  overlay.id = 'gatepassPreview';
  overlay.innerHTML = renderGatepassPreview(gatepass, gatepassData);

  document.body.appendChild(overlay);

  // Animate in
  setTimeout(() => overlay.classList.add('active'), 10);

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeGatepassPreview();
  });

  // Close on Escape key
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeGatepassPreview();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

/* ─────────────────────────────────────────────────────────────
   RENDER GATEPASS PREVIEW
   ───────────────────────────────────────────────────────────── */
function renderGatepassPreview(gatepass, data) {
  const gatepassName = gatepass['Gatepass name'] || 'Unknown';
  const createdDate = gatepass['Created Date'] || '';
  const createdTime = gatepass['Created Time'] || '';

  // Build items table
  const itemsTableHTML = buildItemsTable(data);
  const deptLabel = gpDeptLabel(gatepass._sourceTab || GatepassState.mode || GATEPASS_DEFAULT_MODE);

  return `
    <div class="gatepass-preview-container">
      <div class="preview-header">
        <div class="preview-title-section">
          <div class="preview-icon">
            <i class="fa-solid fa-id-card-clip"></i>
          </div>
          <div>
            <div class="preview-title">Gatepass Preview</div>
          </div>
        </div>
        <button class="preview-close" onclick="closeGatepassPreview()">
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
            <div class="company-subtitle">${sanitizeHTML(deptLabel)}</div>
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
              <div class="info-value">${sanitizeHTML(data.Chanula || data.Department || deptLabel.toUpperCase())}</div>
            </div>
            ${data.ReturnType ? `
            <div class="info-item">
              <div class="info-label">RETURN TYPE</div>
              <div class="info-value highlight">${sanitizeHTML(data.ReturnType)}</div>
            </div>` : ''}
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
              <div class="footer-label">APPROVED BY:</div>
              <div class="footer-signature">
                <div class="signature-line">_______________________</div>
                <div class="signature-sublabel">Signature / Date</div>
              </div>
            </div>
            <div class="footer-section">
              <div class="footer-label">STATUS:</div>
              <div class="status-badge-doc">
                <i class="fa-solid fa-clock"></i>
                Pending Approval
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

      <div class="preview-footer">
        <button class="btn-preview btn-download" onclick="downloadGatepass()">
          <i class="fa-solid fa-download"></i>
          <span>Download</span>
        </button>
        <button class="btn-preview btn-share" onclick="shareGatepass()">
          <i class="fa-solid fa-share-nodes"></i>
          <span>Share</span>
        </button>
        <button class="btn-preview btn-approve" onclick="approveGatepass()">
          <i class="fa-solid fa-circle-check"></i>
          <span>Approve Gatepass</span>
        </button>
      </div>
    </div>
  `;
}

/* ─────────────────────────────────────────────────────────────
   BUILD ITEMS TABLE
   ───────────────────────────────────────────────────────────── */
function buildItemsTable(data) {
  console.log('Building table with data:', data); // Debug log
  
  // Extract items array - check for "Items" (capitalized)
  let items = [];
  
  if (Array.isArray(data.Items)) {
    items = data.Items;
  } else if (Array.isArray(data.items)) {
    items = data.items;
  } else if (data.PO) {
    // If data has individual fields, create single item
    items = [data];
  }

  console.log('Extracted items:', items); // Debug log

  if (items.length === 0) {
    return `
      <div class="items-section">
        <div class="section-title">ITEMS</div>
        <div class="empty-table">No items data available</div>
      </div>
    `;
  }

  // NEW APPROACH: Check if Size is a simple value (not an object)
  // In this case, we'll show Size and QTY as separate columns
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

    // Build table rows
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

    // Grand total row
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

  // ORIGINAL APPROACH: QTY is an object with size breakdown
  // Get all unique size columns from QTY objects
  const allSizes = new Set();
  items.forEach(item => {
    const qtyData = item.QTY || item.Qty || item.qty || {};
    
    if (qtyData && typeof qtyData === 'object') {
      Object.keys(qtyData).forEach(size => {
        allSizes.add(size);
      });
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

  // Build table header
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

  // Add size columns
  sizeColumns.forEach(size => {
    tableHTML += `<th class="col-size">${sanitizeHTML(size)}</th>`;
  });

  tableHTML += `
              <th class="col-total">TOTAL<br/>QTY</th>
            </tr>
          </thead>
          <tbody>
  `;

  // Build table rows
  items.forEach((item, index) => {
    const qtyData = item.QTY || item.Qty || item.qty || {};
    
    tableHTML += `
      <tr>
        <td class="col-index">${index + 1}</td>
        <td class="col-po">${sanitizeHTML(item.PO || 'N/A')}</td>
        <td class="col-model">${sanitizeHTML(item.Model || 'N/A')}</td>
        <td class="col-colour">${sanitizeHTML(item.Outsole_Colour || 'N/A')}</td>
    `;

    // Add size quantities
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

  // Build grand total row
  tableHTML += `
    <tr class="grand-total-row">
      <td colspan="4" class="grand-total-label">GRAND TOTAL</td>
  `;

  // Calculate column totals
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

/* ─────────────────────────────────────────────────────────────
   CLOSE GATEPASS PREVIEW
   ───────────────────────────────────────────────────────────── */
function closeGatepassPreview() {
  const overlay = document.getElementById('gatepassPreview');
  if (overlay) {
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 300);
  }
}

/* ─────────────────────────────────────────────────────────────
   APPROVE GATEPASS
   ───────────────────────────────────────────────────────────── */
async function approveGatepass() {
  if (!GatepassState.currentGatepass) return;

  const confirmed = confirm('Are you sure you want to approve this gatepass?\n\nStatus will be updated to "Pending To HR".');
  
  if (!confirmed) return;

  try {
    // Show loading state
    const approveBtn = document.querySelector('.btn-approve');
    if (approveBtn) {
      approveBtn.disabled = true;
      approveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Approving...</span>';
    }

    // Capture approving user, date, and time
    const approvedBy = sessionStorage.getItem('sm_user') || 'Unknown';
    const now = new Date();
    const approveDate = now.toLocaleDateString('en-GB');  // DD/MM/YYYY
    const approveTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Update status to "Pending To HR" and write approval metadata to columns F, G, H
    // The target sheet is resolved from the row's _sourceTab (unified view)
    // or the active mode — column headers are resolved per sheet.
    const approveMode = GatepassState.currentGatepass._sourceTab
      || (GATEPASS_VALID_MODES.includes(GatepassState.mode) ? GatepassState.mode : GATEPASS_DEFAULT_MODE);
    const mgmtFields = gpMgmtFields(approveMode);
    await updateGatepassStatus(
      GatepassState.currentGatepass,
      'Pending To HR',
      {
        [mgmtFields.USER]: approvedBy,
        [mgmtFields.DATE]: approveDate,
        [mgmtFields.TIME]: approveTime,
      },
      approveMode
    );

    // Close preview & refresh the list first
    closeGatepassPreview();
    await refreshGatepassList();

    // ── Success + "Switch to WhatsApp" action (Management approval) ──
    if (typeof showWhatsAppActionPopup === 'function') {
      const gpName = GatepassState.currentGatepass?.['Gatepass name'] || '—';
      const dept   = gpDeptLabel(approveMode);
      showWhatsAppActionPopup({
        title: 'Gatepass Approved!',
        subtitle: 'Status updated to "Pending To HR".',
        message: waMsg([
          '*SOLE MATRIX — Gatepass Approved by Management*',
          '',
          '📄 Gatepass: ' + gpName,
          '🏢 Department: ' + dept,
          '👤 Approved by: ' + approvedBy + ' (Management)',
          '📅 Date: ' + approveDate + ' ' + approveTime,
          '📌 Status: Pending To HR',
        ]),
        scenario: WA_SCENARIOS.GATEPASS_MGMT_APPROVED,
      });
    } else {
      alert('✓ Gatepass approved successfully! Status updated to Pending To HR.');
    }

  } catch (error) {
    console.error('Error approving gatepass:', error);
    alert('Failed to approve gatepass. Please try again.\n\n' + error.message);
    
    // Re-enable button
    const approveBtn = document.querySelector('.btn-approve');
    if (approveBtn) {
      approveBtn.disabled = false;
      approveBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> <span>Approve Gatepass</span>';
    }
  }
}

/* ─────────────────────────────────────────────────────────────
   DOWNLOAD GATEPASS AS PDF
   ───────────────────────────────────────────────────────────── */
function downloadGatepass() {
  if (!GatepassState.currentGatepass) return;

  try {
    const gatepassData = JSON.parse(GatepassState.currentGatepass['Rows_JSON'] || '{}');
    const gatepassName = GatepassState.currentGatepass['Gatepass name'] || 'gatepass';
    const createdDate = GatepassState.currentGatepass['Created Date'] || '';

    // Check if jsPDF is available
    if (typeof window.jspdf === 'undefined') {
      alert('PDF library not loaded. Please refresh the page and try again.');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape orientation

    // Colors
    const primaryColor = [245, 158, 11]; // Gold
    const darkBlue = [13, 42, 87];
    const lightGray = [240, 240, 240];
    const white = [255, 255, 255];

    // Header Background
    doc.setFillColor(...darkBlue);
    doc.rect(0, 0, 297, 35, 'F');

    // Company Name
    doc.setTextColor(...white);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('CONCORD FOOTWEAR (PVT) LTD', 15, 15);

    // Subtitle
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(gpDeptLabel(GatepassState.currentGatepass._sourceTab || GatepassState.mode || GATEPASS_DEFAULT_MODE), 15, 21);

    // Document Title (Right side)
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('GATEPASS', 245, 15);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('SOLE MATRIX — Production Tracking System', 199, 21);

    // Reset text color
    doc.setTextColor(0, 0, 0);

    // Info boxes
    const infoY = 42;
    const boxHeight = 12;
    
    // MRN Reference Box
    doc.setFillColor(...lightGray);
    doc.rect(15, infoY, 80, boxHeight, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('GATEPASS REFERENCE', 17, infoY + 4);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(gatepassName, 17, infoY + 9);

    // Date Box
    doc.setFillColor(...lightGray);
    doc.rect(98, infoY, 50, boxHeight, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('DATE ISSUED', 100, infoY + 4);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(createdDate, 100, infoY + 9);

    // Prepared By Box
    doc.setFillColor(...lightGray);
    doc.rect(151, infoY, 60, boxHeight, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('PREPARED BY', 153, infoY + 4);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(gatepassData.CreatedBy || 'N/A', 153, infoY + 9);

    // Department Box
    doc.setFillColor(...lightGray);
    doc.rect(214, infoY, 68, boxHeight, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('DEPARTMENT', 216, infoY + 4);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(gpDeptLabel(GatepassState.currentGatepass._sourceTab || GatepassState.mode || GATEPASS_DEFAULT_MODE).toUpperCase(), 216, infoY + 9);

    // Build items table
    const items = extractItems(gatepassData);
    
    // Check if items have simple Size/QTY structure
    const hasSimpleSize = items.some(item => 
      typeof item.Size === 'string' || typeof item.Size === 'number'
    );

    let sizeColumns = [];
    let tableHeaders = [];
    let colWidths = [];
    
    if (hasSimpleSize) {
      // Simple table with Size and QTY columns
      tableHeaders = ['#', 'PO NUMBER', 'MODEL', 'OUTSOLE\nCOLOUR', 'SIZE', 'QTY'];
      colWidths = [10, 35, 35, 35, 20, 20];
    } else {
      // Complex table with multiple size columns
      sizeColumns = extractSizeColumns(items);
      tableHeaders = ['#', 'PO NUMBER', 'MODEL', 'OUTSOLE\nCOLOUR'];
      sizeColumns.forEach(size => tableHeaders.push(size));
      tableHeaders.push('TOTAL\nQTY');
      
      colWidths = [10, 35, 35, 35];
      sizeColumns.forEach(() => colWidths.push(15));
      colWidths.push(20);
    }

    const tableStartY = 62;

    // Calculate positions
    let xPos = 15;
    const colPositions = [xPos];
    colWidths.forEach(width => {
      xPos += width;
      colPositions.push(xPos);
    });

    // Draw table header
    doc.setFillColor(...darkBlue);
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
      // Simple Size/QTY structure
      items.forEach((item, index) => {
        // Alternate row colors
        if (index % 2 === 0) {
          doc.setFillColor(250, 250, 250);
          doc.rect(15, currentY, colPositions[colPositions.length - 1] - 15, 8, 'F');
        }

        // Draw row data
        doc.text(String(index + 1), colPositions[0] + colWidths[0] / 2, currentY + 5.5, { align: 'center' });
        doc.text(item.PO || 'N/A', colPositions[1] + 2, currentY + 5.5);
        doc.text(item.Model || 'N/A', colPositions[2] + 2, currentY + 5.5);
        doc.text(item.Outsole_Colour || 'N/A', colPositions[3] + colWidths[3] / 2, currentY + 5.5, { align: 'center' });
        doc.text(String(item.Size || 'N/A'), colPositions[4] + colWidths[4] / 2, currentY + 5.5, { align: 'center' });
        
        // QTY
        const qty = parseInt(item.QTY || item.Qty || item.qty || 0);
        doc.setFont('helvetica', 'bold');
        doc.text(String(qty), colPositions[5] + colWidths[5] / 2, currentY + 5.5, { align: 'center' });
        doc.setFont('helvetica', 'normal');

        currentY += 8;
      });
    } else {
      // Complex QTY object structure
      items.forEach((item, index) => {
        const qtyData = item.QTY || item.Qty || item.qty || {};
        
        // Alternate row colors
        if (index % 2 === 0) {
          doc.setFillColor(250, 250, 250);
          doc.rect(15, currentY, colPositions[colPositions.length - 1] - 15, 8, 'F');
        }

        // Draw row data
        doc.text(String(index + 1), colPositions[0] + colWidths[0] / 2, currentY + 5.5, { align: 'center' });
        doc.text(item.PO || 'N/A', colPositions[1] + 2, currentY + 5.5);
        doc.text(item.Model || 'N/A', colPositions[2] + 2, currentY + 5.5);
        doc.text(item.Outsole_Colour || 'N/A', colPositions[3] + colWidths[3] / 2, currentY + 5.5, { align: 'center' });

        // Size quantities
        let rowTotal = 0;
        sizeColumns.forEach((size, i) => {
          const qty = parseInt(qtyData[size]) || 0;
          rowTotal += qty;
          const displayQty = qty > 0 ? String(qty) : '-';
          doc.text(displayQty, colPositions[4 + i] + colWidths[4 + i] / 2, currentY + 5.5, { align: 'center' });
        });

        // Row total
        doc.setFont('helvetica', 'bold');
        doc.text(String(rowTotal), colPositions[colPositions.length - 1] - colWidths[colWidths.length - 1] / 2, currentY + 5.5, { align: 'center' });
        doc.setFont('helvetica', 'normal');

        currentY += 8;
      });
    }

    // Grand Total Row
    doc.setFillColor(245, 158, 11);
    doc.rect(15, currentY, colPositions[colPositions.length - 1] - 15, 10, 'F');

    doc.setTextColor(...white);
    doc.setFont('helvetica', 'bold');
    
    if (hasSimpleSize) {
      // Simple structure - grand total
      doc.text('GRAND TOTAL', colPositions[4] + colWidths[4], currentY + 6.5, { align: 'right' });
      
      let grandTotal = 0;
      items.forEach(item => {
        grandTotal += parseInt(item.QTY || item.Qty || item.qty || 0);
      });
      
      doc.text(String(grandTotal), colPositions[5] + colWidths[5] / 2, currentY + 6.5, { align: 'center' });
    } else {
      // Complex structure - column totals
      doc.text('GRAND TOTAL', colPositions[3] + colWidths[3], currentY + 6.5, { align: 'right' });

      // Calculate grand totals for each size column
      sizeColumns.forEach((size, i) => {
        let columnTotal = 0;
        items.forEach(item => {
          const qtyData = item.QTY || item.Qty || item.qty || {};
          columnTotal += parseInt(qtyData[size]) || 0;
        });
        doc.text(String(columnTotal), colPositions[4 + i] + colWidths[4 + i] / 2, currentY + 6.5, { align: 'center' });
      });

      // Grand total sum
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
    const footerY = currentY + 20;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');

    // Prepared By
    doc.text('PREPARED BY:', 15, footerY);
    doc.setFont('helvetica', 'normal');
    doc.line(15, footerY + 10, 80, footerY + 10);
    doc.text('Signature / Date', 15, footerY + 13);

    // Checked By
    doc.setFont('helvetica', 'bold');
    doc.text('CHECKED BY:', 110, footerY);
    doc.setFont('helvetica', 'normal');
    doc.line(110, footerY + 10, 175, footerY + 10);
    doc.text('Signature / Date', 110, footerY + 13);

    // Approved By
    doc.setFont('helvetica', 'bold');
    doc.text('APPROVED BY:', 205, footerY);
    doc.setFont('helvetica', 'normal');
    doc.line(205, footerY + 10, 270, footerY + 10);
    doc.text('Signature / Date', 205, footerY + 13);

    // Bottom note
    const bottomY = 200;
    doc.setFontSize(6);
    doc.setTextColor(100, 100, 100);
    doc.text(`GATEPASS: ${gatepassName}`, 15, bottomY);
    doc.text(`Page 1 — SOLE MATRIX — ${createdDate}`, 148, bottomY, { align: 'center' });
    doc.text('CONCORD FOOTWEAR (PVT) LTD — CONFIDENTIAL', 282, bottomY, { align: 'right' });

    // Save PDF
    doc.save(`Gatepass_${gatepassName}_${Date.now()}.pdf`);

    // Show success message
    setTimeout(() => {
      alert('✓ Gatepass PDF downloaded successfully!');
    }, 100);

  } catch (error) {
    console.error('Error downloading gatepass:', error);
    alert('Failed to download gatepass PDF. Please try again.\n\n' + error.message);
  }
}

/* ─────────────────────────────────────────────────────────────
   HELPER: EXTRACT ITEMS FROM DATA
   ───────────────────────────────────────────────────────────── */
function extractItems(data) {
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.Items)) return data.Items;
  if (data.PO) {
    return [{
      PO: data.PO,
      Model: data.Model,
      Outsole_Colour: data.Outsole_Colour,
      QTY: data.QTY || data.Qty || data.qty || {},
    }];
  }
  return [];
}

/* ─────────────────────────────────────────────────────────────
   HELPER: EXTRACT SIZE COLUMNS
   ───────────────────────────────────────────────────────────── */
function extractSizeColumns(items) {
  const allSizes = new Set();
  items.forEach(item => {
    const qtyData = item.QTY || item.Qty || item.qty || {};
    if (qtyData && typeof qtyData === 'object') {
      Object.keys(qtyData).forEach(size => {
        allSizes.add(size);
      });
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

/* ─────────────────────────────────────────────────────────────
   SHARE GATEPASS
   ───────────────────────────────────────────────────────────── */
function shareGatepass() {
  if (!GatepassState.currentGatepass) return;

  try {
    const gatepassData = JSON.parse(GatepassState.currentGatepass['Rows_JSON'] || '{}');
    const gatepassName = GatepassState.currentGatepass['Gatepass name'] || 'gatepass';

    const shareText = `Gatepass: ${gatepassName}\nEmployee: ${gatepassData.GatepassName || 'N/A'}\nStatus: Pending Approval`;

    if (navigator.share) {
      navigator.share({
        title: 'Employee Gatepass',
        text: shareText,
      }).catch(err => console.log('Share cancelled'));
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(shareText).then(() => {
        alert('✓ Gatepass details copied to clipboard!');
      }).catch(err => {
        alert('Unable to share. Please use the download option instead.');
      });
    }

  } catch (error) {
    console.error('Error sharing gatepass:', error);
    alert('Failed to share gatepass. Please try again.');
  }
}

/* ─────────────────────────────────────────────────────────────
   LOAD GATEPASS MODULE (MAIN ENTRY POINT)

   mode: 'storse' (Storse To GFU Gatepass), 'desma' (Desma In Gatepass)
         or 'desmaReturn' (Desma Return Gatepass)
   ───────────────────────────────────────────────────────────── */
async function loadGatepassModule(mode) {
  const isAllMode = mode === 'all';
  const useMode = isAllMode ? 'all' : (GATEPASS_VALID_MODES.includes(mode) ? mode : GATEPASS_DEFAULT_MODE);
  GatepassState.mode = useMode;

  const modalBody = document.getElementById('modalBody');
  if (!modalBody) return;

  const deptLabel = isAllMode ? 'All Departments' : gpDeptLabel(useMode);

  // Show loading
  modalBody.innerHTML = `
    <div class="loading-container">
      <div class="spinner"></div>
      <div class="loading-text">Loading ${sanitizeHTML(deptLabel)} pending gatepasses...</div>
    </div>
  `;

  try {
    GatepassState.isLoading = true;
    const gatepasses = isAllMode
      ? await fetchPendingGatepassesAllTabs()
      : await fetchPendingGatepasses(useMode);
    GatepassState.gatepasses = gatepasses;
    GatepassState.isLoading = false;

    // Render list with department header
    const headerExtra = isAllMode ? `
      <div style="margin-bottom:1rem;padding:0.75rem 1rem;border-radius:8px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);font-size:0.9rem;color:var(--text-primary);">
        <i class="fa-solid fa-layer-group" style="color:#f59e0b;margin-right:0.5rem;"></i>
        Sources: <strong>Storse To GFU</strong> · <strong>Desma In</strong> · <strong>Outsole Return</strong>
        <button class="refresh-btn" onclick="refreshGatepassList('all')" style="margin-left:1rem;padding:0.25rem 0.75rem;font-size:0.8rem;">
          <i class="fa-solid fa-rotate-right"></i> Refresh
        </button>
      </div>
    ` : `
      <div style="margin-bottom:1rem;padding:0.75rem 1rem;border-radius:8px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);font-size:0.9rem;color:var(--text-primary);">
        <i class="fa-solid fa-building" style="color:#f59e0b;margin-right:0.5rem;"></i>
        Department: <strong>${sanitizeHTML(deptLabel)}</strong>
        <button class="refresh-btn" onclick="refreshGatepassList('${useMode}')" style="margin-left:1rem;padding:0.25rem 0.75rem;font-size:0.8rem;">
          <i class="fa-solid fa-rotate-right"></i> Refresh
        </button>
      </div>
    `;
    modalBody.innerHTML = headerExtra + renderGatepassList(gatepasses);

  } catch (error) {
    console.error('Error loading gatepasses:', error);
    GatepassState.isLoading = false;

    modalBody.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <i class="fa-solid fa-triangle-exclamation"></i>
        </div>
        <p class="empty-text" style="color: #dc2626;">
          Failed to load gatepasses<br>
          <small>${error.message}</small>
        </p>
        <button class="refresh-btn" onclick="refreshGatepassList('${useMode}')" style="margin-top: 1rem;">
          <i class="fa-solid fa-rotate-right"></i>
          <span>Try Again</span>
        </button>
      </div>
    `;
  }
}

/* ─────────────────────────────────────────────────────────────
   REFRESH GATEPASS LIST
   ───────────────────────────────────────────────────────────── */
async function refreshGatepassList(mode) {
  const useMode = mode || GatepassState.mode || GATEPASS_DEFAULT_MODE;
  await loadGatepassModule(useMode);
}

/* ─────────────────────────────────────────────────────────────
   UTILITY
   ───────────────────────────────────────────────────────────── */
function sanitizeHTML(str) {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

console.log('[SOLE MATRIX] Gatepass Management module loaded');
