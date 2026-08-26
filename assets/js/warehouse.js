/* ═══════════════════════════════════════════════════════════════
   SOLE MATRIX — Warehouse & Logistics Module
   Concord Footwear (Pvt) Ltd
   ─────────────────────────────────────────────────────────────
   Flow:
     1. Page loads → fetch pending MRNs from Cloudinary folder
     2. Display MRN cards grid
     3. User clicks a card → MRN Detail modal (PO / Model / Color / Sizes)
     4. User clicks a Size Chip → Kitting Workflow opens
     5. Camera QR scan + QTY entry → Submit kitting record
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   STATE
   ───────────────────────────────────────────────────────────── */
const WH = {
  mrns:          [],      // [{name, url, createdAt, rows:[{po,model,color,sizes,total}]}]
  activeMRN:     null,    // currently open MRN object
  activeChip:    null,    // {po, model, color, size, qty}
  submittedChips:{},      // key: "po|size" → {collectedQty, requiredQty}  for chip colouring
  qrScanner:     null,    // Html5Qrcode instance
  qrRunning:     false,
  qrResult:      null,    // last scanned text
  logoutPending: false,
};

/* ─────────────────────────────────────────────────────────────
   INIT
   ───────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // Guard: must be logged in
  const user = sessionStorage.getItem('sm_user');
  const dept = sessionStorage.getItem('sm_dept');
  if (!user) { window.location.href = 'index.html'; return; }

  // Populate UI chrome
  populateUserChrome(user, dept);
  startClock();
  whLoadMRNs();
});

/* ─────────────────────────────────────────────────────────────
   USER CHROME
   ───────────────────────────────────────────────────────────── */
function populateUserChrome(user, dept) {
  const initials = user.slice(0, 2).toUpperCase();
  const avatar   = document.getElementById('userAvatar');
  const nameEl   = document.getElementById('userName');
  const dashName = document.getElementById('dashUserName');
  const greeting = document.getElementById('dashGreeting');

  if (avatar)   avatar.textContent  = initials;
  if (nameEl)   nameEl.textContent  = user;
  if (dashName) dashName.textContent = user;

  const h = new Date().getHours();
  const greetText = h < 12 ? 'Good morning,' : h < 17 ? 'Good afternoon,' : 'Good evening,';
  if (greeting) greeting.textContent = greetText;
}

/* ─────────────────────────────────────────────────────────────
   CLOCK
   ───────────────────────────────────────────────────────────── */
function startClock() {
  const clockEl = document.getElementById('topbarClock');
  const dateEl  = document.getElementById('topbarDate');
  const statEl  = document.getElementById('statToday');

  function tick() {
    const now = new Date();
    if (clockEl) {
      clockEl.textContent = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    const dateStr = now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
    if (dateEl)  dateEl.textContent  = dateStr;
    if (statEl)  statEl.textContent  = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  }
  tick();
  setInterval(tick, 1000);
}

/* ─────────────────────────────────────────────────────────────
   LOAD PENDING MRNs FROM GOOGLE SHEETS
   ─────────────────────────────────────────────────────────────
   MRN records are saved to the Pending_MRN sheet tab when an
   MRN is submitted from Outsole Production. We read that tab
   here. Falls back to Cloudinary direct listing if sheet empty.
   ───────────────────────────────────────────────────────────── */
async function whLoadMRNs() {
  showMRNState('loading');

  try {
    const res = await fetch(CONFIG.SHEETBEST_MRN_URL, { method: 'GET' });

    // 400/404 = tab doesn't exist yet → fall back to Cloudinary
    if (res.status === 400 || res.status === 404) {
      console.warn('[WH] Pending_MRN tab not found — falling back to Cloudinary listing');
      await whLoadMRNsFromCloudinary();
      return;
    }

    if (!res.ok) throw new Error(`Sheet error ${res.status}`);

    const rows = await res.json();

    const pending = Array.isArray(rows)
      ? rows.filter(r => r && r.MRN_Name && (!r.Status || r.Status === 'Pending'))
      : [];

    if (pending.length === 0) {
      // Also check Cloudinary in case there are PDFs not yet in the sheet
      await whLoadMRNsFromCloudinary();
      return;
    }

    WH.mrns = pending.map(r => {
      // Parse Rows_JSON if present — this is the authoritative source of row data
      let rows = [];
      if (r.Rows_JSON) {
        try { rows = JSON.parse(r.Rows_JSON); } catch (_) { rows = []; }
      }
      return {
        publicId:   r.MRN_Name,
        name:       r.MRN_Name,
        url:        r.Cloudinary_URL || '',
        createdAt:  r.Created_At || '',
        createdBy:  r.Created_By || '—',
        rowCount:   r.Row_Count  || rows.length || '—',
        grandTotal: r.Grand_Total|| '—',
        status:     r.Status     || 'Pending',
        rows,   // pre-loaded — no Gemini needed
      };
    });

    renderMRNCards(WH.mrns);
    updatePendingCount(WH.mrns.length);
    showMRNState('grid');

  } catch (err) {
    console.error('[WH] Sheet load error:', err);
    // Fall back to Cloudinary
    await whLoadMRNsFromCloudinary();
  }
}

/* Fallback: build MRN list directly from Cloudinary URL pattern */
async function whLoadMRNsFromCloudinary() {
  try {
    const cloud  = CONFIG.CLOUDINARY_CLOUD_NAME;
    const folder = CONFIG.CLOUDINARY_FOLDER;
    const apiKey = CONFIG.CLOUDINARY_API_KEY;
    const secret = CONFIG.CLOUDINARY_API_SECRET;
    const creds  = btoa(`${apiKey}:${secret}`);

    const url = `https://api.cloudinary.com/v1_1/${cloud}/resources/raw`
              + `?prefix=${encodeURIComponent(folder)}&max_results=100&type=upload`;

    const res = await fetch(url, {
      headers: { 'Authorization': `Basic ${creds}` }
    });

    if (!res.ok) throw new Error(`Cloudinary ${res.status}`);

    const data      = await res.json();
    const resources = (data.resources || []).filter(r => r.public_id.startsWith(folder));

    if (resources.length === 0) {
      WH.mrns = [];
      showMRNState('empty');
      updatePendingCount(0);
      return;
    }

    WH.mrns = resources.map(r => ({
      publicId:   r.public_id,
      name:       extractMRNName(r.public_id),
      url:        r.secure_url,
      createdAt:  r.created_at,
      createdBy:  '—',
      rowCount:   '—',
      grandTotal: '—',
      status:     'Pending',
    }));

    renderMRNCards(WH.mrns);
    updatePendingCount(WH.mrns.length);
    showMRNState('grid');

  } catch (err) {
    console.error('[WH] Cloudinary fallback error:', err);
    showMRNState('error');
    const msgEl = document.getElementById('mrnErrorMsg');
    if (msgEl) msgEl.textContent = err.message || 'Could not load MRNs.';
  }
}

function extractMRNName(publicId) {
  // public_id: "sole-matrix/pending-mrn/1ST-EXTRA-GLUING-PLAN-WEEK-20"
  const parts = publicId.split('/');
  return parts[parts.length - 1] || publicId;
}

function showMRNState(state) {
  document.getElementById('mrnLoading').classList.toggle('hidden', state !== 'loading');
  document.getElementById('mrnEmpty').classList.toggle('hidden',   state !== 'empty');
  document.getElementById('mrnError').classList.toggle('hidden',   state !== 'error');
  document.getElementById('mrnCardsGrid').classList.toggle('hidden', state !== 'grid');
}

function updatePendingCount(n) {
  const el = document.getElementById('statPending');
  if (el) el.textContent = n;
}

/* ─────────────────────────────────────────────────────────────
   RENDER MRN CARDS
   ───────────────────────────────────────────────────────────── */
function renderMRNCards(mrns) {
  const grid = document.getElementById('mrnCardsGrid');
  grid.innerHTML = '';

  mrns.forEach((mrn, idx) => {
    const date = mrn.createdAt
      ? new Date(mrn.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : '—';

    const card = document.createElement('article');
    card.className = 'mrn-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Open MRN ${mrn.name}`);
    card.style.animationDelay = `${idx * 0.05}s`;

    card.innerHTML = `
      <div class="mrn-card-strip"></div>
      <div class="mrn-card-body">
        <div class="mrn-card-top">
          <div class="mrn-card-name">
            <i class="fa-solid fa-file-pdf" style="color:#f87171;margin-right:6px;font-size:0.75rem"></i>
            ${escapeHTML(mrn.name)}
          </div>
          <span class="mrn-card-badge pending">
            <i class="fa-solid fa-clock"></i>
            Pending
          </span>
        </div>
        <div class="mrn-card-meta">
          <div class="mrn-card-meta-row">
            <i class="fa-regular fa-calendar"></i>
            <span class="mrn-card-meta-label">Created</span>
            <span class="mrn-card-meta-value">${escapeHTML(date)}</span>
          </div>
          <div class="mrn-card-meta-row">
            <i class="fa-solid fa-user"></i>
            <span class="mrn-card-meta-label">By</span>
            <span class="mrn-card-meta-value">${escapeHTML(String(mrn.createdBy || '—'))}</span>
          </div>
          <div class="mrn-card-meta-row">
            <i class="fa-solid fa-list-ol"></i>
            <span class="mrn-card-meta-label">Lines</span>
            <span class="mrn-card-meta-value">${escapeHTML(String(mrn.rowCount || '—'))}</span>
          </div>
          <div class="mrn-card-meta-row">
            <i class="fa-solid fa-cubes"></i>
            <span class="mrn-card-meta-label">Total QTY</span>
            <span class="mrn-card-meta-value" style="color:var(--wh-light)">${escapeHTML(String(mrn.grandTotal || '—'))}</span>
          </div>
        </div>
      </div>
      <div class="mrn-card-action">
        <span>Collect &amp; Kit</span>
        <i class="fa-solid fa-arrow-right"></i>
      </div>
    `;

    card.addEventListener('click', () => whOpenDetail(mrn));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); whOpenDetail(mrn); }
    });

    grid.appendChild(card);
  });
}

/* ─────────────────────────────────────────────────────────────
   MRN DETAIL MODAL
   ─────────────────────────────────────────────────────────────
   Because we store raw PDFs in Cloudinary (no JSON metadata),
   we re-parse the MRN data from Cloudinary by fetching the PDF
   URL and using Gemini to re-extract — OR we store the row data
   encoded in the filename. For simplicity and reliability, we
   present a "Collect MRN" view where the user manually enters
   the collected sizes, which is the real factory use case.
   However — if the MRN was created in this session's memory
   we can reuse WH.mrns rows. We fetch the PDF from Cloudinary
   and re-run Gemini extraction in the background.
   ───────────────────────────────────────────────────────────── */
function whOpenDetail(mrn) {
  WH.activeMRN = mrn;

  const modal   = document.getElementById('mrnDetailModal');
  const titleEl = document.getElementById('detailModalTitle');
  const bodyEl  = document.getElementById('mrnDetailBody');

  titleEl.textContent = mrn.name;
  modal.classList.remove('hidden');
  modal.focus();

  // If rows already loaded from Sheet — render immediately, no Gemini needed
  if (mrn.rows && mrn.rows.length > 0) {
    bodyEl.innerHTML = buildDetailBody(mrn, mrn.rows);
    return;
  }

  // No rows in sheet yet — try Gemini as fallback (only for old MRNs without Rows_JSON)
  bodyEl.innerHTML = buildDetailLoading();

  fetchMRNRows(mrn).then(rows => {
    mrn.rows = rows;
    bodyEl.innerHTML = buildDetailBody(mrn, rows);
  }).catch(() => {
    mrn.rows = [];
    bodyEl.innerHTML = buildDetailBody(mrn, []);
  });
}

function buildDetailLoading() {
  return `
    <div style="display:flex;flex-direction:column;align-items:center;gap:16px;padding:48px 16px;text-align:center">
      <div class="wh-spinner" style="position:relative"></div>
      <p style="font-size:0.875rem;color:var(--clr-text-secondary)">Loading MRN data…</p>
    </div>`;
}

/* Fetch the PDF from Cloudinary and re-extract rows via Gemini */
async function fetchMRNRows(mrn) {
  // Download PDF from Cloudinary as blob → base64 → send to Gemini
  const resp = await fetch(mrn.url);
  if (!resp.ok) throw new Error(`Could not download MRN PDF (${resp.status})`);

  const blob      = await resp.blob();
  const base64    = await blobToBase64(blob);
  const base64Data = base64.split(',')[1];

  const prompt = `
You are reading a Material Requisition Note (MRN) PDF from Concord Footwear.
Extract every production row from the table. Each row has:
- PO Number
- Model
- Outsole Color/Colour
- Sizes with quantities (columns labelled 35-48)
- Total quantity

Return ONLY a valid JSON array, no markdown, no explanation:
[{"po":"147352","model":"Elite","color":"Black","sizes":{"41":1,"42":3},"total":4}]

If no rows found return: []
`;

  const requestBody = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: 'application/pdf', data: base64Data } }
      ]
    }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 4096 }
  };

  const modelsToTry = [CONFIG.GEMINI_MODEL, 'gemini-flash-latest', 'gemini-3.5-flash', 'gemini-3.7-flash'];
  let geminiData = null;

  for (const model of modelsToTry) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    try {
      const tgt = (window.geminiTarget ? geminiTarget(model) : {
        url: endpoint,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': CONFIG.GEMINI_API_KEY },
        wrap: function (p) { return JSON.stringify(p); }
      });
      const r = await fetch(tgt.url, {
        method: 'POST',
        headers: tgt.headers,
        body: tgt.wrap(requestBody),
      });
      if (r.status === 429 || r.status === 503) { continue; }
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e?.error?.message || `HTTP ${r.status}`); }
      geminiData = await r.json();
      break;
    } catch (err) {
      console.warn(`[WH] Gemini model ${model} failed:`, err.message);
    }
  }

  if (!geminiData) throw new Error('All Gemini models unavailable. Try again later.');

  const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return parseRowsFromText(rawText);
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function parseRowsFromText(text) {
  let clean = text.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const s = clean.indexOf('['), e = clean.lastIndexOf(']');
  if (s === -1 || e === -1) return [];
  try {
    const arr = JSON.parse(clean.slice(s, e + 1));
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(r => r && r.po)
      .map(r => ({
        po:    String(r.po    || '').trim(),
        model: String(r.model || 'Unknown').trim(),
        color: String(r.color || r.colour || 'N/A').trim(),
        sizes: normalizeSizesWH(r.sizes),
        total: parseInt(r.total) || 0,
      }));
  } catch { return []; }
}

function normalizeSizesWH(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const q = parseInt(v);
    if (!isNaN(q) && q > 0) out[String(k)] = q;
  }
  return out;
}

/* ─────────────────────────────────────────────────────────────
   BUILD DETAIL BODY HTML
   ───────────────────────────────────────────────────────────── */
function buildDetailBody(mrn, rows) {
  const date = mrn.createdAt
    ? new Date(mrn.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
    : '—';

  const grandTotal = rows.reduce((s, r) => s + (r.total || 0), 0);

  /* Info chips */
  const infoChips = `
    <div class="mrn-detail-info">
      <div class="mrn-info-chip">
        <span class="chip-label">MRN Reference</span>
        <span class="chip-value">${escapeHTML(mrn.name)}</span>
      </div>
      <div class="mrn-info-chip">
        <span class="chip-label">Date Created</span>
        <span class="chip-value">${escapeHTML(date)}</span>
      </div>
      <div class="mrn-info-chip">
        <span class="chip-label">Total Rows</span>
        <span class="chip-value">${rows.length}</span>
      </div>
      <div class="mrn-info-chip">
        <span class="chip-label">Grand Total QTY</span>
        <span class="chip-value" style="color:var(--wh-light)">${grandTotal}</span>
      </div>
    </div>`;

  /* Rows table with clickable size chips */
  let tableRows = '';
  if (rows.length > 0) {
    rows.forEach((row, i) => {
      const chips = Object.entries(row.sizes)
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
        .map(([sz, qty]) => {
          // Check if this chip has been submitted — colour accordingly
          const chipKey    = `${row.po}|${sz}`;
          const submitted  = WH.submittedChips[chipKey];
          let chipStyle = '';
          let chipClass = 'size-chip';
          if (submitted) {
            if (submitted.collectedQty >= submitted.requiredQty) {
              // Full qty collected — green
              chipStyle = 'background:rgba(34,197,94,0.18);border-color:rgba(34,197,94,0.6);';
            } else {
              // Partial qty — yellow
              chipStyle = 'background:rgba(251,191,36,0.18);border-color:rgba(251,191,36,0.6);';
            }
          }
          return `
          <div class="${chipClass}"
               role="button" tabindex="0"
               aria-label="Size ${sz}, Quantity ${qty}"
               style="${chipStyle}"
               onclick="whOpenKitting(${JSON.stringify({ po: row.po, model: row.model, color: row.color, size: sz, qty }).replace(/"/g, '&quot;')})"
               onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();whOpenKitting(${JSON.stringify({ po: row.po, model: row.model, color: row.color, size: sz, qty }).replace(/"/g, '&quot;')})}">
            <span class="sc-size">${escapeHTML(sz)}</span>
            <span class="sc-qty">×<span>${qty}</span></span>
            ${submitted ? `<span style="font-size:0.55rem;line-height:1;color:${submitted.collectedQty >= submitted.requiredQty ? '#86efac' : '#fcd34d'}">${submitted.collectedQty}/${submitted.requiredQty}</span>` : ''}
          </div>`;
        }).join('');

      const noneChip = Object.keys(row.sizes).length === 0
        ? '<span style="font-size:0.75rem;color:var(--clr-text-muted)">No sizes</span>'
        : '';

      tableRows += `
        <tr>
          <td style="color:var(--clr-text-muted);font-size:0.72rem;font-weight:600">${String(i+1).padStart(2,'0')}</td>
          <td><span style="display:inline-flex;align-items:center;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.25);border-radius:4px;color:var(--wh-light);font-size:0.75rem;font-weight:700;padding:3px 8px">${escapeHTML(row.po)}</span></td>
          <td style="font-weight:600">${escapeHTML(row.model)}</td>
          <td>${escapeHTML(row.color)}</td>
          <td>
            <div class="size-chip-row">${chips}${noneChip}</div>
          </td>
          <td style="font-weight:800;color:var(--wh-light);text-align:right">${row.total}</td>
        </tr>`;
    });
  } else {
    tableRows = `
      <tr>
        <td colspan="6" style="text-align:center;padding:28px;color:var(--clr-text-muted);font-size:0.825rem">
          <i class="fa-solid fa-circle-info" style="margin-right:6px"></i>
          MRN data could not be extracted. Please view the original PDF.
        </td>
      </tr>`;
  }

  const hint = rows.length > 0
    ? `<p class="size-chip-hint"><i class="fa-solid fa-hand-pointer"></i> Click a Size Chip to open the Kitting Workflow</p>`
    : '';

  // PDF: regenerate from row data on the fly — no Cloudinary download needed
  const hasPdfData = rows.length > 0;
  const viewPdfBtn = hasPdfData ? `
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button
         onclick="whDownloadMRNPdf()"
         style="display:inline-flex;align-items:center;gap:7px;padding:8px 16px;background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.25);border-radius:8px;color:#fca5a5;font-size:0.8rem;font-weight:600;cursor:pointer;font-family:var(--font-body)"
         onmouseover="this.style.background='rgba(248,113,113,0.2)'" onmouseout="this.style.background='rgba(248,113,113,0.1)'">
        <i class="fa-solid fa-file-arrow-down"></i> Download PDF
      </button>
    </div>` : '';

  return `
    ${infoChips}
    <div class="detail-section-label"><i class="fa-solid fa-table"></i> Production Lines</div>
    <div class="detail-table-wrap">
      <table class="detail-table" aria-label="MRN production lines">
        <thead>
          <tr>
            <th>#</th>
            <th>PO Number</th>
            <th>Model</th>
            <th>Outsole Color</th>
            <th>Sizes &amp; QTY</th>
            <th style="text-align:right">Total</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
    ${hint}
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:8px">
      ${viewPdfBtn}
      <div style="flex:1"></div>
      ${rows.length > 0 ? `<button class="btn-complete-mrn" onclick="whCompleteMRN()"><i class="fa-solid fa-check-circle"></i> Complete MRN</button>` : ''}
    </div>`;
}

function whCloseDetail() {
  document.getElementById('mrnDetailModal').classList.add('hidden');
  WH.activeMRN = null;
}

/* ─────────────────────────────────────────────────────────────
   REGENERATE & DOWNLOAD PDF from row data (no Cloudinary needed)
   ───────────────────────────────────────────────────────────── */
function whDownloadMRNPdf() {
  const mrn  = WH.activeMRN;
  const rows = mrn?.rows;
  if (!rows || rows.length === 0) {
    whToast('No row data to generate PDF from.', 'error');
    return;
  }

  if (!window.jspdf) {
    whToast('PDF library not loaded. Please refresh and try again.', 'error');
    return;
  }

  try {
    const { jsPDF } = window.jspdf;
    const doc    = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW  = doc.internal.pageSize.getWidth();
    const pageH  = doc.internal.pageSize.getHeight();
    const margin = 12;
    const now    = new Date();
    const user   = (sessionStorage.getItem('sm_user') || 'Unknown').toUpperCase();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();

    const C = {
      headerBg:  [0, 51, 102],
      metaBg:    [240, 245, 250],
      metaLabel: [80, 100, 120],
      metaValue: [20, 30, 50],
      tablHead:  [0, 71, 122],
      border:    [180, 200, 220],
      rowOdd:    [245, 250, 255],
      rowEven:   [255, 255, 255],
      footerT:   [140, 155, 170],
      tablFoot:  [220, 235, 245],
      tablFootT: [0, 51, 102],
    };

    // Header bar
    doc.setFillColor(...C.headerBg);
    doc.rect(0, 0, pageW, 22, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text('CONCORD FOOTWEAR (PVT) LTD', margin, 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(180, 210, 240);
    doc.text('Outsole Production Department', margin, 16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text('MATERIAL REQUISITION NOTE', pageW - margin, 10, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(180, 210, 240);
    doc.text('SOLE MATRIX — Production Tracking System', pageW - margin, 16, { align: 'right' });

    // Meta box
    const metaY = 24, metaH = 18;
    doc.setFillColor(...C.metaBg);
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, metaY, pageW - margin * 2, metaH, 1, 1, 'FD');
    const colW = (pageW - margin * 2) / 4;
    const metaFields = [
      { label: 'MRN REFERENCE', value: mrn.name },
      { label: 'DATE ISSUED',   value: dateStr },
      { label: 'PREPARED BY',   value: user },
      { label: 'DEPARTMENT',    value: 'OUTSOLE PRODUCTION' },
    ];
    metaFields.forEach((f, i) => {
      const x = margin + i * colW + 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...C.metaLabel);
      doc.text(f.label, x, metaY + 5.5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...C.metaValue);
      doc.text(f.value, x, metaY + 12);
      if (i < 3) {
        doc.setDrawColor(...C.border);
        doc.setLineWidth(0.2);
        doc.line(margin + (i + 1) * colW, metaY + 2, margin + (i + 1) * colW, metaY + metaH - 2);
      }
    });

    // Table
    const allSizes = [...new Set(rows.flatMap(r => Object.keys(r.sizes || {}).map(Number)))]
      .sort((a, b) => a - b);
    const colHeaders = ['#', 'PO NUMBER', 'MODEL', 'OUTSOLE COLOUR', ...allSizes.map(String), 'TOTAL QTY'];
    const tableData  = rows.map((row, i) => [
      String(i + 1).padStart(2, '0'),
      row.po, row.model, row.color,
      ...allSizes.map(sz => { const q = (row.sizes || {})[String(sz)]; return q ? String(q) : ''; }),
      String(row.total || 0),
    ]);
    const grandTotal = rows.reduce((s, r) => s + (r.total || 0), 0);
    const footRow    = ['', '', '', 'GRAND TOTAL',
      ...allSizes.map(sz => {
        const sum = rows.reduce((s, r) => s + ((r.sizes || {})[String(sz)] || 0), 0);
        return sum > 0 ? String(sum) : '';
      }),
      String(grandTotal),
    ];
    const sizeColW = Math.min(9, (pageW - margin * 2 - 8 - 26 - 20 - 28 - 18) / Math.max(allSizes.length, 1));
    const colStyles = {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'center', cellWidth: 26, fontStyle: 'bold' },
      2: { halign: 'left',   cellWidth: 20 },
      3: { halign: 'left',   cellWidth: 28 },
      [colHeaders.length - 1]: { halign: 'center', cellWidth: 18, fontStyle: 'bold' },
    };
    for (let i = 4; i < colHeaders.length - 1; i++) colStyles[i] = { halign: 'center', cellWidth: sizeColW };

    doc.autoTable({
      head: [colHeaders], body: tableData, foot: [footRow],
      startY: metaY + metaH + 4,
      margin: { left: margin, right: margin },
      tableLineColor: C.border, tableLineWidth: 0.3,
      styles:      { fontSize: 8, cellPadding: 3, textColor: C.metaValue, lineColor: C.border, lineWidth: 0.2 },
      headStyles:  { fillColor: C.tablHead, textColor: [255,255,255], fontStyle: 'bold', halign: 'center', fontSize: 7.5, cellPadding: 4 },
      footStyles:  { fillColor: C.tablFoot, textColor: C.tablFootT, fontStyle: 'bold', fontSize: 8.5 },
      alternateRowStyles: { fillColor: C.rowOdd },
      bodyStyles:  { fillColor: C.rowEven },
      columnStyles: colStyles,
      didDrawPage: (data) => {
        const footY = pageH - 7;
        doc.setDrawColor(...C.border); doc.setLineWidth(0.3);
        doc.line(margin, footY - 2, pageW - margin, footY - 2);
        doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...C.footerT);
        doc.text(`MRN: ${mrn.name}`, margin, footY + 1);
        doc.text(`Page ${data.pageNumber} — SOLE MATRIX — ${dateStr}`, pageW / 2, footY + 1, { align: 'center' });
        doc.text('CONCORD FOOTWEAR (PVT) LTD — CONFIDENTIAL', pageW - margin, footY + 1, { align: 'right' });
        // Signature strip
        const signY = pageH - 17;
        doc.setFillColor(250, 245, 230); doc.setDrawColor(200, 170, 100); doc.setLineWidth(0.2);
        doc.roundedRect(margin, signY, pageW - margin * 2, 8, 1, 1, 'FD');
        ['PREPARED BY:', 'CHECKED BY:', 'APPROVED BY:'].forEach((label, idx) => {
          const sx = margin + idx * ((pageW - margin * 2) / 3) + 3;
          doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(120, 90, 30);
          doc.text(label, sx, signY + 3.5);
          doc.setFont('helvetica','normal'); doc.setTextColor(80, 60, 20);
          doc.text('_________________________', sx + 20, signY + 3.5);
          doc.text('Signature / Date', sx + 20, signY + 6.5);
        });
      },
    });

    doc.save(`${mrn.name}.pdf`);
    whToast('PDF downloaded!', 'success');

  } catch (err) {
    console.error('[WH] PDF generation error:', err);
    whToast('PDF generation failed. Please try again.', 'error');
  }
}

/* ─────────────────────────────────────────────────────────────
   COMPLETE MRN — updates Status to "Complete" in Pending_MRN
   ───────────────────────────────────────────────────────────── */
function whCompleteMRN() {
  if (!WH.activeMRN?.rows?.length) return;

  // Show inline confirmation inside the detail modal
  const bodyEl = document.getElementById('mrnDetailBody');
  if (!bodyEl) return;

  // Append a confirmation banner if not already present
  if (document.getElementById('completeMRNConfirmBanner')) return;

  const banner = document.createElement('div');
  banner.id = 'completeMRNConfirmBanner';
  banner.style.cssText = [
    'display:flex', 'align-items:center', 'gap:12px', 'flex-wrap:wrap',
    'padding:14px 16px', 'margin-top:12px',
    'background:rgba(34,197,94,0.08)', 'border:1.5px solid rgba(34,197,94,0.35)',
    'border-radius:10px', 'font-size:0.85rem',
  ].join(';');

  banner.innerHTML = `
    <i class="fa-solid fa-triangle-exclamation" style="color:#4ade80;flex-shrink:0"></i>
    <span style="flex:1;color:#86efac">
      Mark <strong style="color:#4ade80">${escapeHTML(WH.activeMRN.name)}</strong>
      as <strong style="color:#4ade80">Complete</strong>? This will update the sheet status and remove it from the pending queue.
    </span>
    <button id="btnConfirmComplete"
            onclick="whConfirmCompleteMRN()"
            style="padding:8px 18px;background:linear-gradient(135deg,#16a34a,#15803d);border:none;border-radius:7px;color:#fff;font-family:var(--font-body);font-size:0.82rem;font-weight:700;cursor:pointer">
      <i class="fa-solid fa-check"></i> Yes, Complete
    </button>
    <button onclick="document.getElementById('completeMRNConfirmBanner').remove()"
            style="padding:8px 14px;background:transparent;border:1px solid var(--wh-border);border-radius:7px;color:var(--clr-text-secondary);font-family:var(--font-body);font-size:0.82rem;cursor:pointer">
      Cancel
    </button>`;

  bodyEl.appendChild(banner);
  banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function whConfirmCompleteMRN() {
  const mrn     = WH.activeMRN;
  if (!mrn) return;

  const confirmBtn = document.getElementById('btnConfirmComplete');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…';
  }

  const mrnName  = mrn.name;
  const patchUrl = `${CONFIG.SHEETBEST_MRN_URL}/MRN_Name/${encodeURIComponent(mrnName)}`;

  try {
    const res = await fetch(patchUrl, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ Status: 'Complete' }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody?.message || `HTTP ${res.status}`);
    }

    // Remove MRN from in-memory list and refresh the cards grid
    WH.mrns = WH.mrns.filter(m => m.name !== mrnName);
    renderMRNCards(WH.mrns);
    updatePendingCount(WH.mrns.length);
    if (WH.mrns.length === 0) showMRNState('empty');

    // Close the detail modal
    whCloseDetail();

    whToast(`MRN "${mrnName}" marked as Complete.`, 'success');

    // ── "Switch to WhatsApp" action (ACTIVE MRN completed) ──
    if (typeof showWhatsAppActionPopup === 'function') {
      const waUser = sessionStorage.getItem('sm_user') || 'Unknown';
      const waNow  = new Date();
      showWhatsAppActionPopup({
        title: 'MRN Completed!',
        subtitle: `"${escapeHTML(mrnName)}" has been marked as Complete and removed from the pending queue.`,
        message: waMsg([
          '*SOLE MATRIX — MRN Completed*',
          '',
          '📄 MRN: ' + mrnName,
          '👤 Completed by: ' + waUser + ' (Warehouse & Logistics)',
          '📅 Date: ' + waNow.toLocaleDateString('en-GB') + ' ' +
            waNow.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          '📌 Status: Complete',
        ]),
        scenario: WA_SCENARIOS.MRN_COMPLETED,
      });
    }

  } catch (err) {
    console.error('[WH] Complete MRN failed:', err);
    whToast(`Failed to complete MRN: ${err.message}`, 'error');

    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<i class="fa-solid fa-check"></i> Yes, Complete';
    }
  }
}

/* ─────────────────────────────────────────────────────────────
   KITTING WORKFLOW MODAL
   ───────────────────────────────────────────────────────────── */
function whOpenKitting(chip) {
  // chip = { po, model, color, size, qty }
  if (typeof chip === 'string') { try { chip = JSON.parse(chip); } catch { return; } }

  const chipKey   = `${chip.po}|${chip.size}`;
  const submitted = WH.submittedChips[chipKey];

  // GREEN chip — fully collected, block re-entry
  if (submitted && submitted.collectedQty >= submitted.requiredQty) {
    whToast(`Size ${chip.size} is fully collected (${submitted.collectedQty}/${submitted.requiredQty}). No further entry needed.`, 'info');
    return;
  }

  // YELLOW chip — partially collected, limit max to remaining balance
  if (submitted && submitted.collectedQty < submitted.requiredQty) {
    const balance = submitted.requiredQty - submitted.collectedQty;
    // Override qty to remaining balance so user can only enter what's left
    chip = { ...chip, qty: balance, _balance: true, _alreadyCollected: submitted.collectedQty };
  }

  WH.activeChip = chip;

  const modal   = document.getElementById('kittingModal');
  const titleEl = document.getElementById('kittingModalTitle');
  const bodyEl  = document.getElementById('kittingBody');

  titleEl.textContent = `Size ${chip.size} — ${chip.po}`;
  bodyEl.innerHTML = buildKittingBody(chip);
  modal.classList.remove('hidden');
  modal.focus();

  // Start QR scanner after a short delay (DOM needs to settle)
  setTimeout(() => whStartQR(), 400);
}

function buildKittingBody(chip) {
  return `
    <!-- Job details -->
    <div class="kitting-job-bar">
      <div class="kitting-job-field">
        <div class="field-label">PO Number</div>
        <div class="field-value">${escapeHTML(chip.po)}</div>
      </div>
      <div class="kitting-job-field">
        <div class="field-label">Model</div>
        <div class="field-value">${escapeHTML(chip.model)}</div>
      </div>
      <div class="kitting-job-field">
        <div class="field-label">Outsole Color</div>
        <div class="field-value">${escapeHTML(chip.color)}</div>
      </div>
      <div class="kitting-job-field">
        <div class="field-label">Size</div>
        <div class="field-value" style="color:var(--wh-light);font-size:1.2rem">EU ${escapeHTML(String(chip.size))}</div>
      </div>
    </div>

    ${chip._balance ? `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.35);border-radius:8px;margin-bottom:4px;font-size:0.82rem">
      <i class="fa-solid fa-triangle-exclamation" style="color:#fbbf24;flex-shrink:0"></i>
      <span style="color:#fcd34d">
        <strong>Partial entry:</strong> ${chip._alreadyCollected} of ${chip._alreadyCollected + chip.qty} already collected.
        You can enter up to <strong>${chip.qty}</strong> remaining pairs.
      </span>
    </div>` : ''}

    <!-- QR Section with Scan / Manual tabs -->
    <div class="qr-section">
      <div class="qr-section-label"><i class="fa-solid fa-qrcode"></i> QR Code</div>

      <!-- Tab switcher -->
      <div class="qr-tab-bar">
        <button class="qr-tab-btn active" id="qrTabScan" onclick="whSwitchQRTab('scan')">
          <i class="fa-solid fa-camera"></i> Scan Camera
        </button>
        <button class="qr-tab-btn" id="qrTabManual" onclick="whSwitchQRTab('manual')">
          <i class="fa-solid fa-keyboard"></i> Manual Entry
        </button>
      </div>

      <!-- Scan tab -->
      <div id="qrPanelScan">
        <div class="qr-viewport-wrap">
          <div id="qrReader"></div>
          <div class="qr-corner tl"></div>
          <div class="qr-corner tr"></div>
          <div class="qr-corner bl"></div>
          <div class="qr-corner br"></div>
          <div class="qr-scanline" id="qrScanLine"></div>
          <div class="qr-status-strip" id="qrStatusStrip">
            <i class="fa-solid fa-spinner fa-spin"></i> Starting camera…
          </div>
        </div>
        <button class="btn-toggle-cam" id="btnToggleCam" onclick="whToggleCam()">
          <i class="fa-solid fa-camera-rotate"></i> Switch Camera
        </button>
      </div>

      <!-- Manual entry tab -->
      <div id="qrPanelManual" style="display:none">
        <div style="margin-top:4px">
          <label class="qty-input-label" for="qrManualInput">ENTER QR CODE DATA</label>
          <div style="display:flex;gap:8px;margin-top:6px">
            <input type="text" id="qrManualInput"
                   style="flex:1;padding:11px 14px;background:rgba(255,255,255,0.04);border:1.5px solid var(--clr-border);border-radius:8px;color:var(--clr-text-primary);font-family:var(--font-body);font-size:0.9rem;outline:none"
                   placeholder="Type or paste QR code value…"
                   aria-label="Manual QR code entry"
                   oninput="whManualQRInput(this)" />
            <button onclick="whConfirmManualQR()"
                    style="padding:11px 18px;background:linear-gradient(135deg,var(--wh-primary),#4f46e5);border:none;border-radius:8px;color:#fff;font-family:var(--font-body);font-size:0.85rem;font-weight:700;cursor:pointer;white-space:nowrap">
              <i class="fa-solid fa-check"></i> Confirm
            </button>
          </div>
        </div>
      </div>

      <!-- Shared result box (shown after scan OR manual confirm) -->
      <div class="qr-result-box" id="qrResultBox">
        <i class="fa-solid fa-check-circle"></i>
        <span>QR Data: <strong id="qrResultText"></strong></span>
        <button onclick="whClearQR()"
                style="margin-left:auto;background:none;border:none;color:var(--clr-text-muted);cursor:pointer;font-size:0.8rem;padding:2px 6px"
                title="Clear and re-scan">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    </div>

    <!-- Kitting form -->
    <div class="kitting-form-section" id="kittingFormSection">
      <div class="detail-section-label"><i class="fa-solid fa-boxes-stacked"></i> Kit Quantity</div>
      <label class="qty-input-label" for="kitQtyInput">QUANTITY COLLECTED</label>
      <div class="kitting-qty-row">
        <div class="qty-input-wrap">
          <input type="number" id="kitQtyInput" class="qty-input"
                 min="1" max="${chip.qty}" value=""
                 placeholder="0"
                 aria-label="Quantity collected"
                 oninput="whValidateQty(this, ${chip.qty})" />
          <div class="qty-required-badge">
            Required: <span>${chip.qty}</span> pairs
          </div>
        </div>
      </div>
      <button class="btn-kit-submit" id="btnKitSubmit" onclick="whSubmitKit()" disabled>
        <i class="fa-solid fa-check"></i>
        Confirm Kitting
      </button>
    </div>

    <!-- Success screen (hidden initially) -->
    <div class="kitting-success" id="kittingSuccess">
      <div class="kit-success-icon"><i class="fa-solid fa-circle-check"></i></div>
      <h3 class="kit-success-title">Kitting Complete!</h3>
      <p class="kit-success-body">The quantity has been recorded for this size.</p>
      <div class="kit-summary" id="kitSummaryGrid"></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:8px">
        <button class="btn-kit-next" onclick="whCloseKitting()">
          <i class="fa-solid fa-xmark"></i> Close
        </button>
        <button class="btn-kit-next" onclick="whBackToDetail()" style="background:var(--wh-bg);border-color:var(--wh-border)">
          <i class="fa-solid fa-arrow-left"></i> Back to MRN
        </button>
      </div>
    </div>`;
}

/* ─────────────────────────────────────────────────────────────
   QR TAB SWITCHING — Scan vs Manual
   ───────────────────────────────────────────────────────────── */
function whSwitchQRTab(tab) {
  const scanBtn    = document.getElementById('qrTabScan');
  const manualBtn  = document.getElementById('qrTabManual');
  const scanPanel  = document.getElementById('qrPanelScan');
  const manualPanel= document.getElementById('qrPanelManual');
  if (!scanBtn) return;

  if (tab === 'scan') {
    scanBtn.classList.add('active');
    manualBtn.classList.remove('active');
    scanPanel.style.display  = 'block';
    manualPanel.style.display= 'none';
    // Restart scanner if no result yet
    if (!WH.qrResult) whStartQR();
  } else {
    manualBtn.classList.add('active');
    scanBtn.classList.remove('active');
    manualPanel.style.display= 'block';
    scanPanel.style.display  = 'none';
    // Stop camera to free resources
    whStopQR();
    // Focus the manual input
    setTimeout(() => {
      const inp = document.getElementById('qrManualInput');
      if (inp) inp.focus();
    }, 100);
  }
}

function whManualQRInput(input) {
  // Store value live so it's available even without pressing Confirm
  WH.qrResult = input.value.trim() || null;
  whEnableSubmitIfReady();
}

function whConfirmManualQR() {
  const inp = document.getElementById('qrManualInput');
  if (!inp || !inp.value.trim()) {
    whToast('Please enter a QR code value.', 'error');
    return;
  }
  const text = inp.value.trim();
  onQRSuccess(text);   // reuse the same success handler as camera scan
}

function whClearQR() {
  WH.qrResult = null;

  // Hide result box
  const box = document.getElementById('qrResultBox');
  if (box) box.classList.remove('visible');

  // Restore scan line
  const line = document.getElementById('qrScanLine');
  if (line) line.style.display = '';

  // Clear manual input if visible
  const inp = document.getElementById('qrManualInput');
  if (inp) inp.value = '';

  // Reset status strip
  updateQRStatus('<i class="fa-solid fa-spinner fa-spin"></i> Starting camera…', false);

  // Restart scanner if on scan tab
  const scanPanel = document.getElementById('qrPanelScan');
  if (scanPanel && scanPanel.style.display !== 'none') {
    whStartQR();
  }

  whEnableSubmitIfReady();
}

/* ─────────────────────────────────────────────────────────────
   QR SCANNER
   ───────────────────────────────────────────────────────────── */
async function whStartQR() {
  if (!window.Html5Qrcode) {
    updateQRStatus('Camera library not loaded.', false);
    return;
  }

  // Stop any previous scanner
  await whStopQR();

  WH.qrScanner = new Html5Qrcode('qrReader');
  WH.qrCurrentCamera = 'environment'; // start with back camera

  const config = {
    fps: 10,
    qrbox: { width: 220, height: 180 },
    aspectRatio: 1.4,
    disableFlip: false,
  };

  try {
    await WH.qrScanner.start(
      { facingMode: 'environment' },
      config,
      (decodedText) => { onQRSuccess(decodedText); },
      () => { /* scan still in progress, no error */ }
    );
    WH.qrRunning = true;
    updateQRStatus('<i class="fa-solid fa-circle-dot" style="color:#22c55e"></i> Camera active — point at QR code', false);
  } catch (err) {
    console.warn('[WH] QR start error:', err);
    // Try front camera as fallback
    try {
      await WH.qrScanner.start(
        { facingMode: 'user' },
        config,
        (decodedText) => { onQRSuccess(decodedText); },
        () => {}
      );
      WH.qrRunning = true;
      updateQRStatus('<i class="fa-solid fa-circle-dot" style="color:#22c55e"></i> Camera active (front)', false);
    } catch (err2) {
      updateQRStatus('<i class="fa-solid fa-triangle-exclamation" style="color:#f87171"></i> Camera unavailable — please allow access', false);
    }
  }
}

async function whStopQR() {
  if (WH.qrScanner && WH.qrRunning) {
    try {
      await WH.qrScanner.stop();
      WH.qrScanner.clear();
    } catch (_) {}
    WH.qrRunning = false;
    WH.qrScanner = null;
  }
}

async function whToggleCam() {
  if (!WH.qrScanner) return;
  await whStopQR();
  updateQRStatus('<i class="fa-solid fa-spinner fa-spin"></i> Switching camera…', false);

  WH.qrCurrentCamera = WH.qrCurrentCamera === 'environment' ? 'user' : 'environment';

  WH.qrScanner = new Html5Qrcode('qrReader');
  const config = { fps: 10, qrbox: { width: 220, height: 180 }, aspectRatio: 1.4 };

  try {
    await WH.qrScanner.start(
      { facingMode: WH.qrCurrentCamera },
      config,
      (decodedText) => { onQRSuccess(decodedText); },
      () => {}
    );
    WH.qrRunning = true;
    updateQRStatus('<i class="fa-solid fa-circle-dot" style="color:#22c55e"></i> Camera switched', false);
  } catch (err) {
    updateQRStatus('<i class="fa-solid fa-triangle-exclamation" style="color:#f87171"></i> Could not switch camera', false);
  }
}

function onQRSuccess(text) {
  if (!text || !text.trim()) return;
  // Always update — manual entry may re-confirm same value after a clear
  WH.qrResult = text.trim();

  // Update status strip (only relevant for camera scan panel)
  updateQRStatus('<i class="fa-solid fa-qrcode"></i> QR Code captured!', true);

  // Hide scan line
  const scanLine = document.getElementById('qrScanLine');
  if (scanLine) scanLine.style.display = 'none';

  // Show result box
  const resultBox  = document.getElementById('qrResultBox');
  const resultText = document.getElementById('qrResultText');
  if (resultBox && resultText) {
    resultText.textContent = WH.qrResult;
    resultBox.classList.add('visible');
  }

  whEnableSubmitIfReady();
  whToast('QR code captured!', 'success');

  // Stop camera scanner (not needed after capture)
  whStopQR();
}

function updateQRStatus(html, detected) {
  const strip = document.getElementById('qrStatusStrip');
  if (!strip) return;
  strip.innerHTML = html;
  strip.classList.toggle('detected', detected);
}

/* ─────────────────────────────────────────────────────────────
   QTY VALIDATION
   ───────────────────────────────────────────────────────────── */
function whValidateQty(input, maxQty) {
  const val = parseInt(input.value);
  const isValid = !isNaN(val) && val > 0;
  const isOver  = !isNaN(val) && val > maxQty;

  input.classList.toggle('qty-over', isOver);

  if (isOver) {
    whToast(`Quantity cannot exceed required ${maxQty} pairs.`, 'error');
  }

  whEnableSubmitIfReady();
}

function whEnableSubmitIfReady() {
  const btn      = document.getElementById('btnKitSubmit');
  const qtyInput = document.getElementById('kitQtyInput');
  if (!btn || !qtyInput) return;

  const val   = parseInt(qtyInput.value);
  const chip  = WH.activeChip;
  const qtyOk = !isNaN(val) && val > 0 && val <= chip.qty;

  // QR scan is optional — allow submit even without scan (factory may skip QR)
  btn.disabled = !qtyOk;
}

/* ─────────────────────────────────────────────────────────────
   SUBMIT KITTING → write to "Storse Out" Google Sheet
   Columns A-J: QR | PO | Model | Outsole | Size | QTY | Date | Time | User | MRN Name
   ───────────────────────────────────────────────────────────── */
async function whSubmitKit() {
  const qtyInput = document.getElementById('kitQtyInput');
  const chip     = WH.activeChip;
  if (!qtyInput || !chip) return;

  const qty     = parseInt(qtyInput.value);
  const qrData  = WH.qrResult || 'N/A';
  const user    = sessionStorage.getItem('sm_user') || 'Unknown';
  const mrnName = WH.activeMRN?.name || '—';
  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const btn = document.getElementById('btnKitSubmit');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking…'; }

  // Block duplicate QR code entries (skip check if QR is N/A — manual skip)
  if (qrData !== 'N/A') {
    try {
      const checkRes = await fetch(
        'https://api.sheetbest.com/sheets/dd583123-5c7c-4279-8303-2aea56b7c8aa/tabs/Storse Out',
        { method: 'GET' }
      );
      if (checkRes.ok) {
        const existing = await checkRes.json().catch(() => []);
        const duplicate = Array.isArray(existing) && existing.some(
          row => row.QR_Code && row.QR_Code.trim() === qrData.trim()
        );
        if (duplicate) {
          // Re-enable button and warn user
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Confirm Kitting';
          }
          whToast(`QR Code "${qrData}" has already been submitted. Please scan a different QR code.`, 'error');
          return;
        }
      }
    } catch (err) {
      console.warn('[WH] Duplicate QR check failed (non-blocking):', err.message);
      // Continue — don't block submission if the check itself fails
    }
  }

  if (btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting…'; }

  // Row object — keys must match sheet column headers EXACTLY (rename headers in sheet to use underscores)
  // Sheet row 1 must be: QR_Code | PO | Model | Outsole_Colour | Size | QTY | Date | Time | User | MRN_Name
  const rowData = {
    QR_Code:        qrData,
    PO:             chip.po,
    Model:          chip.model,
    Outsole_Colour: chip.color,
    Size:           String(chip.size),
    QTY:            String(qty),
    Date:           dateStr,
    Time:           timeStr,
    User:           user,
    MRN_Name:       mrnName,
  };

  let saved = false;
  try {
    const res = await fetch(
      'https://api.sheetbest.com/sheets/dd583123-5c7c-4279-8303-2aea56b7c8aa/tabs/Storse Out',
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(rowData),
      }
    );
    const respBody = await res.json().catch(() => ({}));
    if (res.ok) {
      saved = true;
      console.log('[WH] Stores Out saved:', respBody);
    } else {
      console.error('[WH] Stores Out failed:', res.status, respBody);
    }
  } catch (e) {
    console.error('[WH] Stores Out fetch error:', e.message);
  }

  if (!saved) {
    whToast('Sheet write failed — check browser console.', 'error');
    console.error('[WH] Row data was:', JSON.stringify(rowData));
  }

  // Track submitted chip — use original required qty (not balance) so colour is based on total
  const chipKey     = `${chip.po}|${chip.size}`;
  const prev        = WH.submittedChips[chipKey];
  const requiredQty = chip._balance
    ? (chip._alreadyCollected + chip.qty)  // restore original required
    : chip.qty;
  const newQty      = (prev?.collectedQty || 0) + qty;
  WH.submittedChips[chipKey] = { collectedQty: newQty, requiredQty };

  showKittingSuccess(chip, qty, qrData, mrnName, saved);
}

function showKittingSuccess(chip, qty, qrData, mrnName, saved = true) {
  const formSection = document.getElementById('kittingFormSection');
  const qrSection   = document.querySelector('.qr-section');
  const successEl   = document.getElementById('kittingSuccess');
  const summaryGrid = document.getElementById('kitSummaryGrid');
  const titleEl     = document.getElementById('kittingModalTitle');
  const isComplete  = qty >= chip.qty;

  if (formSection) formSection.style.display = 'none';
  if (qrSection)   qrSection.style.display   = 'none';
  if (titleEl)     titleEl.textContent        = saved ? 'Kitting Complete' : 'Recorded (Sheet Error)';

  if (summaryGrid) {
    summaryGrid.innerHTML = `
      <div class="kit-summary-cell"><div class="ks-label">PO</div><div class="ks-value">${escapeHTML(chip.po)}</div></div>
      <div class="kit-summary-cell"><div class="ks-label">Size</div><div class="ks-value">EU ${escapeHTML(String(chip.size))}</div></div>
      <div class="kit-summary-cell">
        <div class="ks-label">Collected</div>
        <div class="ks-value" style="color:${isComplete ? 'var(--clr-success)' : '#fbbf24'}">${qty}</div>
      </div>
      <div class="kit-summary-cell"><div class="ks-label">Required</div><div class="ks-value">${chip.qty}</div></div>
    `;
  }

  if (successEl) successEl.classList.add('visible');
  whToast(saved ? 'Store Out record saved!' : 'Saved locally — sheet tab missing!', saved ? 'success' : 'info');
}

function whCloseKitting() {
  whStopQR();
  document.getElementById('kittingModal').classList.add('hidden');
  WH.activeChip = null;
  WH.qrResult   = null;
}

function whBackToDetail() {
  whCloseKitting();
  const detailModal = document.getElementById('mrnDetailModal');
  const bodyEl      = document.getElementById('mrnDetailBody');
  if (detailModal && WH.activeMRN) {
    detailModal.classList.remove('hidden');
    // Re-render so chip colours reflect submitted state
    if (bodyEl) bodyEl.innerHTML = buildDetailBody(WH.activeMRN, WH.activeMRN.rows || []);
  }
}

/* ─────────────────────────────────────────────────────────────
   LOGOUT
   ───────────────────────────────────────────────────────────── */
function whHandleLogout() {
  document.getElementById('logoutModal').classList.remove('hidden');
  WH.logoutPending = true;
}

function whCancelLogout() {
  document.getElementById('logoutModal').classList.add('hidden');
  WH.logoutPending = false;
}

function whConfirmLogout() {
  whStopQR();
  sessionStorage.clear();
  window.location.href = 'index.html';
}

// Escape key closes modals
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!document.getElementById('kittingModal').classList.contains('hidden')) {
    whCloseKitting(); return;
  }
  if (!document.getElementById('mrnDetailModal').classList.contains('hidden')) {
    whCloseDetail(); return;
  }
  if (!document.getElementById('logoutModal').classList.contains('hidden')) {
    whCancelLogout();
  }
});

/* ─────────────────────────────────────────────────────────────
   TOAST
   ───────────────────────────────────────────────────────────── */
let _whToastTimer = null;

function whToast(message, type = 'info') {
  let toast = document.getElementById('whToast');
  const icons = { success: 'fa-circle-check', error: 'fa-circle-exclamation', info: 'fa-circle-info' };
  toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i> ${escapeHTML(message)}`;
  toast.className = `wh-toast toast-${type} show`;
  clearTimeout(_whToastTimer);
  _whToastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

/* ─────────────────────────────────────────────────────────────
   UTILITIES
   ───────────────────────────────────────────────────────────── */
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
