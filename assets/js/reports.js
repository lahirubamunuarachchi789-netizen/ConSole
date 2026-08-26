/* ═══════════════════════════════════════════════════════════════
   SOLE MATRIX — REPORTS CENTER (shared across departments)
   Concord Footwear (Pvt) Ltd
   ───────────────────────────────────────────────────────────────
   Five reports:
     01 · Outsole Production Output — by date (+ time window) [GFU Out]
     02 · Storse Output             — by date (+ time window) [Storse Out]
     03 · PO Wise Output            — size-wise output & storse out,
                                      related gatepasses & MRNs   [All]
     04 · MRN                       — MRNs (filter by date)     [Pending_MRN]
     05 · Gatepass                  — gatepasses (filter by date/type)
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   STATE & CONSTANTS
   ───────────────────────────────────────────────────────────── */
const RP = {
  overlay: null,
  activeTab: 'gfu',
  cache: {},                 // url -> Promise<rows[]>
  dateReports: { gfu: null, storse: null },
  po: null,                  // last PO result
  mrnList: null,             // { date, mrns: [] }
  gpList: null,              // { date, gpStorse: [], gpDesma: [], gpReturn: [] }
  sources: {},               // named row-bundles for PDF downloads
};

/* Config for the two date-driven output reports */
const RP_DATE_CFG = {
  gfu: {
    sheet: 'gfuOut',
    heading: 'Outsole Production Output',
    sub: 'Source: GFU Out sheet',
    pdfTitle: 'PRODUCTION OUTPUT',
    filePrefix: 'Production_Output',
    excelName: 'Production_Output',
  },
  storse: {
    sheet: 'storseOut',
    heading: 'Storse Output',
    sub: 'Source: Storse Out sheet',
    pdfTitle: 'STORSE OUTPUT',
    filePrefix: 'Storse_Output',
    excelName: 'Storse_Output',
  },
};

const RP_SHEET_URLS = {
  gfuOut: (typeof CONFIG !== 'undefined' && CONFIG.SHEETBEST_GFUOUT_URL)
    ? CONFIG.SHEETBEST_GFUOUT_URL
    : 'https://api.sheetbest.com/sheets/dd583123-5c7c-4279-8303-2aea56b7c8aa/tabs/GFU Out',
  storseOut: (typeof CONFIG !== 'undefined' && CONFIG.SHEETBEST_STORESOUT_URL)
    ? CONFIG.SHEETBEST_STORESOUT_URL
    : 'https://api.sheetbest.com/sheets/dd583123-5c7c-4279-8303-2aea56b7c8aa/tabs/Storse Out',
  mrn: (typeof CONFIG !== 'undefined' && CONFIG.SHEETBEST_MRN_URL)
    ? CONFIG.SHEETBEST_MRN_URL
    : 'https://api.sheetbest.com/sheets/dd583123-5c7c-4279-8303-2aea56b7c8aa/tabs/Pending_MRN',
  gpStorse: (typeof CONFIG !== 'undefined' && CONFIG.SHEETBEST_STORSE_TO_GFU_GATEPASS_URL)
    ? CONFIG.SHEETBEST_STORSE_TO_GFU_GATEPASS_URL
    : 'https://api.sheetbest.com/sheets/dd583123-5c7c-4279-8303-2aea56b7c8aa/tabs/Storse To GFU Gatepass',
  gpDesma: (typeof CONFIG !== 'undefined' && CONFIG.SHEETBEST_DESMA_IN_GATEPASS_URL)
    ? CONFIG.SHEETBEST_DESMA_IN_GATEPASS_URL
    : 'https://api.sheetbest.com/sheets/dd583123-5c7c-4279-8303-2aea56b7c8aa/tabs/Desma In Gatepass',
  gpReturn: (typeof CONFIG !== 'undefined' && CONFIG.SHEETBEST_DESMA_RETURN_GATEPASS_URL)
    ? CONFIG.SHEETBEST_DESMA_RETURN_GATEPASS_URL
    : 'https://api.sheetbest.com/sheets/dd583123-5c7c-4279-8303-2aea56b7c8aa/tabs/Desma Return Gatepass',
};

const RP_TIMEOUT = 20000;

/* ─────────────────────────────────────────────────────────────
   SMALL UTILITIES
   ───────────────────────────────────────────────────────────── */
function rpEsc(value) {
  const div = document.createElement('div');
  div.textContent = value == null ? '' : String(value);
  return div.innerHTML;
}

function rpCurrentUser() {
  return sessionStorage.getItem('sm_user') || 'Unknown';
}

function rpCurrentDept() {
  return sessionStorage.getItem('sm_dept') || 'SOLE MATRIX';
}

/* Parse any sheet date ("2/08/2026", "20/08/2026", "2026-08-20") */
function rpParseDate(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);      // yyyy-mm-dd
  if (m) return { y: +m[1], mth: +m[2], d: +m[3] };

  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);          // dd/mm/yyyy
  if (m) return { y: +m[3], mth: +m[2], d: +m[1] };

  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/);         // dd/mm/yy
  if (m) return { y: 2000 + +m[3], mth: +m[2], d: +m[1] };

  const parsed = new Date(s);
  if (!isNaN(parsed)) {
    return { y: parsed.getFullYear(), mth: parsed.getMonth() + 1, d: parsed.getDate() };
  }
  return null;
}

/* Convert <input type="date"> value ("yyyy-mm-dd") */
function rpInputDateParts(value) {
  const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { y: +m[1], mth: +m[2], d: +m[3] };
}

function rpSameDate(a, b) {
  return a && b && a.y === b.y && a.mth === b.mth && a.d === b.d;
}

/* Parse sheet time ("12:40:24", "9:5:3", "5:40 PM") → seconds */
function rpParseTime(value) {
  if (value == null) return null;
  const s = String(value).trim().toLowerCase();
  if (!s) return null;

  const m = s.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s*(am|pm)?/);
  if (!m) return null;

  let h = +m[1];
  const min = +m[2];
  const sec = m[3] ? +m[3] : 0;
  const mer = m[4];

  if (mer === 'pm' && h < 12) h += 12;
  if (mer === 'am' && h === 12) h = 0;

  return h * 3600 + min * 60 + sec;
}

function rpSortSizeKey(size) {
  const n = parseFloat(size);
  return isNaN(n) ? Infinity : n;
}

/* ─────────────────────────────────────────────────────────────
   DATA FETCHING (cached)
   ───────────────────────────────────────────────────────────── */
async function rpFetchSheet(key) {
  const url = RP_SHEET_URLS[key];
  if (RP.cache[url]) return RP.cache[url];

  RP.cache[url] = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RP_TIMEOUT);
    try {
      const res = await fetch(url, { method: 'GET', signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`Sheet request failed (${res.status})`);
      const rows = await res.json();
      if (!Array.isArray(rows)) throw new Error('Unexpected sheet response');
      return rows;
    } catch (err) {
      clearTimeout(timer);
      delete RP.cache[url]; // allow retry
      if (err.name === 'AbortError') throw new Error('Request timed out. Please check your connection.');
      throw err;
    }
  })();

  return RP.cache[url];
}

/* ─────────────────────────────────────────────────────────────
   ROW SHAPING HELPERS
   ───────────────────────────────────────────────────────────── */

/* Normalise an Out-row (GFU Out / Storse Out).
   Colour header differs per sheet: GFU Out uses "Outsole Colour"
   (with a space, column D) while Storse Out uses "Outsole_Colour". */
function rpShapeOutRow(row) {
  return {
    qr: row['QR_Code'] ?? '',
    po: String(row['PO'] ?? '').trim(),
    model: String(row['Model'] ?? '').trim(),
    colour: String(row['Outsole Colour'] ?? row['Outsole_Colour'] ?? '').trim(),
    size: String(row['Size'] ?? '').trim(),
    qty: parseInt(row['QTY'], 10) || 0,
    dateRaw: String(row['Date'] ?? '').trim(),
    timeRaw: String(row['Time'] ?? '').trim(),
    mrnName: String(row['MRN_Name'] ?? '').trim(),
    verification: String(row['Verification'] ?? '').trim(),
    verifiedUser: String(row['Verified_User'] ?? '').trim(),
  };
}

/* Group out-rows into unique PO|Model|Colour|Size lines */
function rpGroupOutRows(rows) {
  const map = new Map();
  rows.forEach(r => {
    const key = `${r.po}|${r.model}|${r.colour}|${r.size}`;
    if (!map.has(key)) {
      map.set(key, { po: r.po, model: r.model, colour: r.colour, size: r.size, qty: 0 });
    }
    map.get(key).qty += r.qty;
  });
  return Array.from(map.values()).sort((a, b) => {
    const poCmp = a.po.localeCompare(b.po, undefined, { numeric: true });
    if (poCmp !== 0) return poCmp;
    const mdl = a.model.localeCompare(b.model);
    if (mdl !== 0) return mdl;
    const clr = a.colour.localeCompare(b.colour);
    if (clr !== 0) return clr;
    return rpSortSizeKey(a.size) - rpSortSizeKey(b.size);
  });
}

/* Build a size-wise matrix: rows = Model+Colour, columns = Sizes */
function rpBuildSizeMatrix(rows) {
  const sizeSet = new Set();
  const rowMap = new Map();

  rows.forEach(r => {
    sizeSet.add(r.size);
    const key = `${r.model}|${r.colour}`;
    if (!rowMap.has(key)) {
      rowMap.set(key, { model: r.model, colour: r.colour, cells: {}, total: 0 });
    }
    const entry = rowMap.get(key);
    entry.cells[r.size] = (entry.cells[r.size] || 0) + r.qty;
    entry.total += r.qty;
  });

  const sizes = Array.from(sizeSet).sort((a, b) => rpSortSizeKey(a) - rpSortSizeKey(b));
  const dataRows = Array.from(rowMap.values()).sort((a, b) => {
    const mdl = a.model.localeCompare(b.model);
    if (mdl !== 0) return mdl;
    return a.colour.localeCompare(b.colour);
  });

  let grandTotal = 0;
  dataRows.forEach(r => { grandTotal += r.total; });

  return { sizes, rows: dataRows, grandTotal };
}

/* Expand gatepass Rows_JSON items → flat [{po, model, colour, size, qty}] */
function rpGatepassItems(gatepassRow) {
  let data = {};
  try { data = JSON.parse(gatepassRow['Rows_JSON'] || '{}'); } catch (e) { data = {}; }

  let items = [];
  if (Array.isArray(data.Items)) items = data.Items;
  else if (Array.isArray(data.items)) items = data.items;
  else if (data.PO) items = [data];

  const flat = [];
  items.forEach(it => {
    const po = String(it.PO ?? it.po ?? '').trim();
    const model = String(it.Model ?? it.model ?? '').trim();
    const colour = String(it.Outsole_Colour ?? it.colour ?? '').trim();
    if (it.QTY && typeof it.QTY === 'object' && !Array.isArray(it.QTY)) {
      Object.entries(it.QTY).forEach(([size, qty]) => {
        flat.push({ po, model, colour, size: String(size), qty: parseInt(qty, 10) || 0 });
      });
    } else {
      flat.push({ po, model, colour, size: String(it.Size ?? ''), qty: parseInt(it.QTY ?? it.qty, 10) || 0 });
    }
  });
  return { meta: data, items: flat };
}

/* Expand MRN Rows_JSON → flat [{po, model, colour, size, qty}] */
function rpMrnItems(mrnRow) {
  let items = [];
  try {
    const parsed = JSON.parse(mrnRow['Rows_JSON'] || '[]');
    if (Array.isArray(parsed)) items = parsed;
  } catch (e) { items = []; }

  const flat = [];
  items.forEach(it => {
    const po = String(it.po ?? it.PO ?? '').trim();
    const model = String(it.model ?? it.Model ?? '').trim();
    const colour = String(it.color ?? it.colour ?? '').trim();
    const sizes = it.sizes && typeof it.sizes === 'object' ? it.sizes : {};
    Object.entries(sizes).forEach(([size, qty]) => {
      flat.push({ po, model, colour, size: String(size), qty: parseInt(qty, 10) || 0 });
    });
  });
  return flat;
}

/* Resolve a named source bundle for PDF downloads */
function rpGetSourceState(source) {
  return RP.sources[source] || null;
}

/* ─────────────────────────────────────────────────────────────
   OVERLAY UI
   ───────────────────────────────────────────────────────────── */
function openReportsSection() {
  if (!RP.overlay) {
    RP.overlay = document.createElement('div');
    RP.overlay.className = 'rp-overlay';
    RP.overlay.id = 'reportsOverlay';
    RP.overlay.innerHTML = `
      <div class="rp-modal" role="dialog" aria-modal="true" aria-label="Reports Center">
        <div class="rp-header">
          <div class="rp-header-icon"><i class="fa-solid fa-chart-column"></i></div>
          <div>
            <p class="rp-header-label">${rpEsc(rpCurrentDept())} · Report Section</p>
            <h2 class="rp-header-title">Reports Center</h2>
          </div>
          <button class="rp-close-btn" onclick="closeReportsSection()" aria-label="Close reports">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="rp-tabs">
          <button class="rp-tab active" data-tab="gfu" onclick="rpSwitchTab('gfu')">
            <i class="fa-solid fa-industry"></i> Outsole Production Output
          </button>
          <button class="rp-tab" data-tab="storse" onclick="rpSwitchTab('storse')">
            <i class="fa-solid fa-warehouse"></i> Storse Output
          </button>
          <button class="rp-tab" data-tab="po" onclick="rpSwitchTab('po')">
            <i class="fa-solid fa-boxes-stacked"></i> PO Wise Output
          </button>
          <button class="rp-tab" data-tab="mrn" onclick="rpSwitchTab('mrn')">
            <i class="fa-solid fa-file-invoice"></i> MRN
          </button>
          <button class="rp-tab" data-tab="gp" onclick="rpSwitchTab('gp')">
            <i class="fa-solid fa-file-signature"></i> Gatepass
          </button>
        </div>
        <div class="rp-body" id="rpBody"></div>
      </div>
    `;
    document.body.appendChild(RP.overlay);

    RP.overlay.addEventListener('click', (e) => {
      if (e.target === RP.overlay) closeReportsSection();
    });
    document.addEventListener('keydown', rpEscHandler);
  }

  RP.overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
  rpSwitchTab(RP.activeTab);
}

function rpEscHandler(e) {
  if (e.key === 'Escape') closeReportsSection();
}

function closeReportsSection() {
  if (!RP.overlay) return;

  const el = RP.overlay;
  RP.overlay = null; // next open builds a fresh overlay

  el.classList.remove('active');
  document.body.style.overflow = '';
  document.removeEventListener('keydown', rpEscHandler);

  // Fully detach the overlay once the fade-out finishes so it can
  // never sit invisibly above the page and swallow clicks.
  setTimeout(() => el.remove(), 300);
}

function rpSwitchTab(tab) {
  RP.activeTab = tab;

  document.querySelectorAll('#reportsOverlay .rp-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  const body = document.getElementById('rpBody');
  if (!body) return;

  const renderers = {
    gfu: () => rpRenderDateTab('gfu'),
    storse: () => rpRenderDateTab('storse'),
    po: rpRenderPOTab,
    mrn: rpRenderMrnTab,
    gp: rpRenderGpTab,
  };

  body.innerHTML = (renderers[tab] || renderers.gfu)();
}

/* ═══════════════════════════════════════════════════════════════
   TAB 01 & 02 · DATE-DRIVEN OUTPUT REPORTS (GFU / STORSE)
   ═══════════════════════════════════════════════════════════════ */
function rpRenderDateTab(key) {
  const cfg = RP_DATE_CFG[key];
  const today = new Date();
  const pad = n => String(n).padStart(2, '0');
  const todayVal = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const extraHint = key === 'gfu'
    ? 'Completed outsole units recorded at GFU, grouped by PO, Model, Colour, Size and QTY.'
    : 'Completed outsole units dispatched from Storse, grouped by PO, Model, Colour, Size and QTY.';

  return `
    <div class="rp-filter-card">
      <div class="rp-filter-title"><i class="fa-solid ${key === 'gfu' ? 'fa-industry' : 'fa-warehouse'}"></i> ${cfg.heading} — By Date</div>
      <p class="rp-filter-hint">
        Pick a date to see the complete report (PO, Model, Outsole Colour, Size & QTY).
        Optionally provide <strong>two times</strong> to limit the report to a specific time window on that date.
        ${extraHint}
      </p>
      <div class="rp-form-row">
        <div class="rp-field narrow">
          <label>Date <span class="req">*</span></label>
          <input type="date" id="rpDate_${key}" class="rp-input" value="${todayVal}">
        </div>
        <div class="rp-field narrow">
          <label>From Time</label>
          <input type="time" id="rpFrom_${key}" class="rp-input" step="1">
        </div>
        <div class="rp-field narrow">
          <label>To Time</label>
          <input type="time" id="rpTo_${key}" class="rp-input" step="1">
        </div>
        <button class="rp-btn rp-btn-primary" onclick="rpRunDateReport('${key}')">
          <i class="fa-solid fa-play"></i> Generate
        </button>
      </div>
    </div>
    <div id="rpResults_${key}"></div>
  `;
}

async function rpRunDateReport(key) {
  const cfg = RP_DATE_CFG[key];
  const resultsEl = document.getElementById(`rpResults_${key}`);
  if (!resultsEl) return;

  const dateVal = document.getElementById(`rpDate_${key}`).value;
  const fromVal = document.getElementById(`rpFrom_${key}`).value;
  const toVal = document.getElementById(`rpTo_${key}`).value;

  if (!dateVal) {
    resultsEl.innerHTML = `<div class="rp-error-box"><i class="fa-solid fa-circle-exclamation"></i> Please select a date first.</div>`;
    return;
  }

  const targetDate = rpInputDateParts(dateVal);
  const fromSec = fromVal ? rpParseTime(fromVal) : null;
  const toSec = toVal ? rpParseTime(toVal) : null;

  resultsEl.innerHTML = `
    <div class="rp-loading">
      <i class="fa-solid fa-spinner"></i>
      <p>Loading ${cfg.heading.toLowerCase()}…</p>
    </div>
  `;

  try {
    const outRaw = await rpFetchSheet(cfg.sheet);

    const shaped = outRaw.map(rpShapeOutRow);

    const filtered = shaped.filter(r => {
      if (!rpSameDate(rpParseDate(r.dateRaw), targetDate)) return false;
      const t = rpParseTime(r.timeRaw);
      if (fromSec != null && (t == null || t < fromSec)) return false;
      if (toSec != null && (t == null || t > toSec)) return false;
      return true;
    });

    const grouped = rpGroupOutRows(filtered);
    const totalQty = grouped.reduce((s, r) => s + r.qty, 0);

    RP.dateReports[key] = {
      date: dateVal, from: fromVal, to: toVal,
      grouped, total: totalQty, count: filtered.length,
    };

    if (grouped.length === 0) {
      resultsEl.innerHTML = `
        <div class="rp-section">
          <div class="rp-empty">
            <i class="fa-solid fa-inbox"></i>
            <p>No ${rpEsc(cfg.heading.toLowerCase())} found for <strong>${rpEsc(dateVal)}</strong>${fromVal && toVal ? ` between ${rpEsc(fromVal)} and ${rpEsc(toVal)}` : ''}.</p>
          </div>
        </div>
      `;
      return;
    }

    const rangeLabel = (fromVal || toVal)
      ? `Time window: ${rpEsc(fromVal || '00:00')} → ${rpEsc(toVal || '23:59')}`
      : 'Full day';

    const excelBtn = `
      <button class="rp-btn rp-btn-download" onclick="rpDownloadDateExcel('${key}')">
        <i class="fa-solid fa-file-excel"></i> Excel
      </button>`;

    resultsEl.innerHTML = `
      <div class="rp-section">
        <div class="rp-section-head">
          <div class="rp-section-icon ${key === 'gfu' ? 'violet' : 'green'}"><i class="fa-solid fa-chart-simple"></i></div>
          <div class="rp-section-title-wrap">
            <div class="rp-section-title">${cfg.heading} — ${rpEsc(dateVal)}</div>
            <div class="rp-section-sub">${rangeLabel} · ${cfg.sub}</div>
          </div>
          <span class="rp-count-pill"><i class="fa-solid fa-layer-group"></i> ${grouped.length} line${grouped.length !== 1 ? 's' : ''}</span>
          <button class="rp-btn rp-btn-download" onclick="rpDownloadDatePDF('${key}')">
            <i class="fa-solid fa-file-pdf"></i> Output PDF
          </button>
          ${excelBtn}
        </div>
        <div class="rp-summary-row">
          <span class="rp-summary-chip"><i class="fa-solid fa-cubes"></i> Total QTY <strong>${totalQty}</strong></span>
          <span class="rp-summary-chip"><i class="fa-solid fa-hashtag"></i> Records <strong>${filtered.length}</strong></span>
        </div>
        <div class="rp-table-wrap">
          <table class="rp-table">
            <thead>
              <tr><th>#</th><th>PO</th><th>Model</th><th>Outsole Colour</th><th class="ctr">Size</th><th class="num">QTY</th></tr>
            </thead>
            <tbody>
              ${grouped.map((g, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td class="rp-po-cell">${rpEsc(g.po)}</td>
                  <td>${rpEsc(g.model)}</td>
                  <td>${rpEsc(g.colour)}</td>
                  <td class="ctr">${rpEsc(g.size)}</td>
                  <td class="num"><strong>${g.qty}</strong></td>
                </tr>`).join('')}
            </tbody>
            <tfoot>
              <tr><td colspan="5">GRAND TOTAL</td><td class="num">${totalQty}</td></tr>
            </tfoot>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    resultsEl.innerHTML = `
      <div class="rp-error-box">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <span>${rpEsc(err.message)}</span>
        <button class="rp-btn rp-btn-ghost" onclick="rpRunDateReport('${key}')">Retry</button>
      </div>
    `;
  }
}

/* ═══════════════════════════════════════════════════════════════
   TAB 03 · PO WISE OUTPUT
   ═══════════════════════════════════════════════════════════════ */
function rpRenderPOTab() {
  return `
    <div class="rp-filter-card">
      <div class="rp-filter-title"><i class="fa-solid fa-boxes-stacked"></i> PO Wise Complete Output</div>
      <p class="rp-filter-hint">
        Enter a PO number to get its size-wise Outsole Production Output and size-wise
        Storse Out — each downloadable as PDF or Excel.
      </p>
      <div class="rp-form-row">
        <div class="rp-field grow">
          <label>PO Number <span class="req">*</span></label>
          <input type="text" id="rpPoInput" class="rp-input" placeholder="e.g. 147348" inputmode="numeric">
        </div>
        <button class="rp-btn rp-btn-primary" onclick="rpRunPOReport()">
          <i class="fa-solid fa-magnifying-glass"></i> Generate
        </button>
      </div>
    </div>
    <div id="rpPOResults"></div>
  `;
}

async function rpRunPOReport() {
  const resultsEl = document.getElementById('rpPOResults');
  if (!resultsEl) return;

  const po = String(document.getElementById('rpPoInput').value || '').trim();
  if (!po) {
    resultsEl.innerHTML = `<div class="rp-error-box"><i class="fa-solid fa-circle-exclamation"></i> Please enter a PO number.</div>`;
    return;
  }

  resultsEl.innerHTML = `
    <div class="rp-loading">
      <i class="fa-solid fa-spinner"></i>
      <p>Gathering all records for PO ${rpEsc(po)}…</p>
    </div>
  `;

  try {
    const [gfuRaw, storseRaw] = await Promise.all([
      rpFetchSheet('gfuOut'),
      rpFetchSheet('storseOut'),
    ]);

    const poEq = v => String(v ?? '').trim().toLowerCase() === po.toLowerCase();

    /* Size-wise sheets */
    const gfuRows = rpGroupOutRows(gfuRaw.map(rpShapeOutRow).filter(r => poEq(r.po)));
    const storseRows = rpGroupOutRows(storseRaw.map(rpShapeOutRow).filter(r => poEq(r.po)));

    RP.po = { po, gfuRows, storseRows };
    RP.sources.po = RP.po;

    const gfuMatrix = rpBuildSizeMatrix(gfuRows);
    const storseMatrix = rpBuildSizeMatrix(storseRows);

    const gfuTotal = gfuRows.reduce((s, r) => s + r.qty, 0);
    const storseTotal = storseRows.reduce((s, r) => s + r.qty, 0);

    resultsEl.innerHTML = `
      <div class="rp-summary-row">
        <span class="rp-summary-chip"><i class="fa-solid fa-industry"></i> Output QTY <strong>${gfuTotal}</strong></span>
        <span class="rp-summary-chip"><i class="fa-solid fa-warehouse"></i> Storse Out QTY <strong>${storseTotal}</strong></span>
      </div>

      <!-- 1 · Size-wise Production Output -->
      ${rpRenderMatrixSection({
        icon: 'violet', iconFa: 'fa-industry',
        title: `Size-Wise Outsole Production Output — PO ${rpEsc(po)}`,
        sub: 'Source: GFU Out sheet',
        matrix: gfuMatrix, kind: 'gfu',
        excelCall: `rpDownloadPoMatrixExcel('gfu')`,
        emptyText: 'No production output recorded for this PO yet.',
      })}

      <!-- 2 · Size-wise Storse Out -->
      ${rpRenderMatrixSection({
        icon: 'green', iconFa: 'fa-warehouse',
        title: `Size-Wise Storse Out — PO ${rpEsc(po)}`,
        sub: 'Source: Storse Out sheet',
        matrix: storseMatrix, kind: 'storse',
        excelCall: `rpDownloadPoMatrixExcel('storse')`,
        emptyText: 'No Storse Out dispatches recorded for this PO yet.',
      })}
    `;
  } catch (err) {
    resultsEl.innerHTML = `
      <div class="rp-error-box">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <span>${rpEsc(err.message)}</span>
        <button class="rp-btn rp-btn-ghost" onclick="rpRunPOReport()">Retry</button>
      </div>
    `;
  }
}

/* ═══════════════════════════════════════════════════════════════
   TAB 04 · MRN REPORT
   ═══════════════════════════════════════════════════════════════ */
function rpRenderMrnTab() {
  return `
    <div class="rp-filter-card">
      <div class="rp-filter-title"><i class="fa-solid fa-file-invoice"></i> MRN Report</div>
      <p class="rp-filter-hint">
        List Material Requisition Notes — optionally filtered by creation date.
        Leave the date empty to see every MRN. Each MRN can be downloaded as a PDF.
      </p>
      <div class="rp-form-row">
        <div class="rp-field narrow">
          <label>Created Date</label>
          <input type="date" id="rpMrnDate" class="rp-input">
        </div>
        <button class="rp-btn rp-btn-primary" onclick="rpRunMrnSearch()">
          <i class="fa-solid fa-magnifying-glass"></i> Generate
        </button>
      </div>
    </div>
    <div id="rpMrnResults"></div>
  `;
}

async function rpRunMrnSearch() {
  const resultsEl = document.getElementById('rpMrnResults');
  if (!resultsEl) return;

  const dateVal = document.getElementById('rpMrnDate').value;
  const targetDate = dateVal ? rpInputDateParts(dateVal) : null;

  resultsEl.innerHTML = `
    <div class="rp-loading">
      <i class="fa-solid fa-spinner"></i>
      <p>Loading MRNs…</p>
    </div>
  `;

  try {
    const raw = await rpFetchSheet('mrn');
    const rows = targetDate
      ? raw.filter(row => rpSameDate(rpParseDate(row['Created_At']), targetDate))
      : raw.slice();

    RP.mrnList = { date: dateVal, mrns: rows };
    RP.sources.mrn = { mrns: rows };

    const title = dateVal ? `MRNs — ${rpEsc(dateVal)}` : 'All MRNs';

    resultsEl.innerHTML = `
      ${rpRenderMrnSection({
        rows, source: 'mrn',
        title,
        sub: dateVal ? 'MRNs created on this date' : 'Every MRN in the system',
        emptyText: dateVal
          ? 'No MRN was created on this date.'
          : 'No MRNs found.',
      })}
    `;
  } catch (err) {
    resultsEl.innerHTML = `
      <div class="rp-error-box">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <span>${rpEsc(err.message)}</span>
        <button class="rp-btn rp-btn-ghost" onclick="rpRunMrnSearch()">Retry</button>
      </div>
    `;
  }
}

/* ═══════════════════════════════════════════════════════════════
   TAB 05 · GATEPASS REPORT
   ═══════════════════════════════════════════════════════════════ */
function rpRenderGpTab() {
  return `
    <div class="rp-filter-card">
      <div class="rp-filter-title"><i class="fa-solid fa-file-signature"></i> Gatepass Report</div>
      <p class="rp-filter-hint">
        List Storse To GFU and Desma In gatepasses — optionally filtered by creation date and type.
        Leave the date empty to see every gatepass. Each gatepass can be downloaded as a PDF.
      </p>
      <div class="rp-form-row">
        <div class="rp-field narrow">
          <label>Created Date</label>
          <input type="date" id="rpGpDate" class="rp-input">
        </div>
        <div class="rp-field narrow">
          <label>Type</label>
          <select id="rpGpType" class="rp-input">
            <option value="all">All Types</option>
            <option value="storse">Storse To GFU</option>
            <option value="desma">Desma In</option>
            <option value="return">Desma Return</option>
          </select>
        </div>
        <button class="rp-btn rp-btn-primary" onclick="rpRunGpSearch()">
          <i class="fa-solid fa-magnifying-glass"></i> Generate
        </button>
      </div>
    </div>
    <div id="rpGpResults"></div>
  `;
}

async function rpRunGpSearch() {
  const resultsEl = document.getElementById('rpGpResults');
  if (!resultsEl) return;

  const dateVal = document.getElementById('rpGpDate').value;
  const typeVal = document.getElementById('rpGpType').value;
  const targetDate = dateVal ? rpInputDateParts(dateVal) : null;

  resultsEl.innerHTML = `
    <div class="rp-loading">
      <i class="fa-solid fa-spinner"></i>
      <p>Loading gatepasses…</p>
    </div>
  `;

  try {
    const [storseRaw, desmaRaw, returnRaw] = await Promise.all([
      rpFetchSheet('gpStorse'),
      rpFetchSheet('gpDesma'),
      rpFetchSheet('gpReturn'),
    ]);

    const byDate = row => !targetDate || rpSameDate(rpParseDate(row['Created Date']), targetDate);

    const gpStorse = (typeVal === 'all' || typeVal === 'storse')
      ? storseRaw.filter(byDate) : [];
    const gpDesma = (typeVal === 'all' || typeVal === 'desma')
      ? desmaRaw.filter(byDate) : [];
    const gpReturn = (typeVal === 'all' || typeVal === 'return')
      ? returnRaw.filter(byDate) : [];

    RP.gpList = { date: dateVal, gpStorse, gpDesma, gpReturn };
    RP.sources.gp = { gpStorse, gpDesma, gpReturn };

    const scopeLabel = [
      dateVal ? `created on ${rpEsc(dateVal)}` : 'all dates',
      typeVal === 'storse' ? 'Storse To GFU only' :
      typeVal === 'desma' ? 'Desma In only' :
      typeVal === 'return' ? 'Desma Return only' : 'all types',
    ].join(' · ');

    resultsEl.innerHTML = `
      ${rpRenderGatepassSection({
        icon: 'cyan', iconFa: 'fa-truck-fast',
        title: 'Storse To GFU Gatepasses',
        sub: scopeLabel,
        rows: gpStorse, kind: 'gpStorse', source: 'gp',
        emptyText: 'No Storse To GFU gatepass matched this filter.',
      })}

      ${rpRenderGatepassSection({
        icon: 'pink', iconFa: 'fa-gears',
        title: 'Desma In Gatepasses',
        sub: scopeLabel,
        rows: gpDesma, kind: 'gpDesma', source: 'gp',
        emptyText: 'No Desma In gatepass matched this filter.',
      })}

      ${rpRenderGatepassSection({
        icon: 'teal', iconFa: 'fa-rotate-left',
        title: 'Desma Return Gatepasses',
        sub: scopeLabel,
        rows: gpReturn, kind: 'gpReturn', source: 'gp',
        emptyText: 'No Desma Return gatepass matched this filter.',
      })}
    `;
  } catch (err) {
    resultsEl.innerHTML = `
      <div class="rp-error-box">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <span>${rpEsc(err.message)}</span>
        <button class="rp-btn rp-btn-ghost" onclick="rpRunGpSearch()">Retry</button>
      </div>
    `;
  }
}

/* ═══════════════════════════════════════════════════════════════
   SHARED SECTION RENDERERS
   ═══════════════════════════════════════════════════════════════ */

/* Matrix section renderer (PO report) */
function rpRenderMatrixSection({ icon, iconFa, title, sub, matrix, kind, emptyText, excelCall = '' }) {
  const hasData = matrix.rows.length > 0;
  return `
    <div class="rp-section">
      <div class="rp-section-head">
        <div class="rp-section-icon ${icon}"><i class="fa-solid ${iconFa}"></i></div>
        <div class="rp-section-title-wrap">
          <div class="rp-section-title">${title}</div>
          <div class="rp-section-sub">${sub}</div>
        </div>
        ${hasData ? `
          <span class="rp-count-pill"><i class="fa-solid fa-cubes"></i> Total ${matrix.grandTotal}</span>
          <button class="rp-btn rp-btn-download" onclick="rpDownloadMatrixPDF('${kind}')">
            <i class="fa-solid fa-file-pdf"></i> Download PDF
          </button>
          ${excelCall ? `
            <button class="rp-btn rp-btn-download" onclick="${excelCall}">
              <i class="fa-solid fa-file-excel"></i> Excel
            </button>
          ` : ''}
        ` : ''}
      </div>
      ${hasData ? `
        <div class="rp-table-wrap">
          <table class="rp-table">
            <thead>
              <tr>
                <th>#</th><th>Model</th><th>Outsole Colour</th>
                ${matrix.sizes.map(s => `<th class="ctr">${rpEsc(s)}</th>`).join('')}
                <th class="num">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${matrix.rows.map((r, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${rpEsc(r.model)}</td>
                  <td>${rpEsc(r.colour)}</td>
                  ${matrix.sizes.map(s => `<td class="ctr">${r.cells[s] ? r.cells[s] : '-'}</td>`).join('')}
                  <td class="num"><strong>${r.total}</strong></td>
                </tr>`).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3">GRAND TOTAL</td>
                ${matrix.sizes.map(s => {
                  const colSum = matrix.rows.reduce((acc, r) => acc + (r.cells[s] || 0), 0);
                  return `<td class="ctr">${colSum || '-'}</td>`;
                }).join('')}
                <td class="num">${matrix.grandTotal}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ` : `
        <div class="rp-empty"><i class="fa-solid fa-inbox"></i><p>${emptyText}</p></div>
      `}
    </div>
  `;
}

/* Gatepass list section renderer */
function rpRenderGatepassSection({ icon, iconFa, title, sub, rows, kind, emptyText, source = 'po' }) {
  return `
    <div class="rp-section">
      <div class="rp-section-head">
        <div class="rp-section-icon ${icon}"><i class="fa-solid ${iconFa}"></i></div>
        <div class="rp-section-title-wrap">
          <div class="rp-section-title">${title}</div>
          <div class="rp-section-sub">${sub}</div>
        </div>
        <span class="rp-count-pill"><i class="fa-solid fa-file-lines"></i> ${rows.length}</span>
      </div>
      ${rows.length ? `
        <div class="rp-item-list">
          ${rows.map((row, i) => {
            const name = row['Gatepass name'] || '—';
            const status = String(row['Status'] || '').trim();
            const created = row['Created Date'] || '';
            const mgmtUser = row['Approved Management User'] || row['Approved Manegement User'] || '';
            const hrUser = row['Approved HR User'] || '';
            const vehicle = row['Vehicle Number'] || '';
            const driver = row['Driver Name'] || '';

            const statusClass =
              /pending/i.test(status) ? 'rp-status-pending' :
              /assigned|complete|approved/i.test(status) ? 'rp-status-approved' :
              'rp-status-neutral';

            return `
              <div class="rp-item-card">
                <div class="rp-item-main">
                  <div class="rp-item-name">
                    <i class="fa-solid fa-file-signature"></i> ${rpEsc(name)}
                    <span class="rp-status-badge ${statusClass}">${rpEsc(status || 'Unknown')}</span>
                  </div>
                  <div class="rp-item-meta">
                    ${created ? `<span><i class="fa-solid fa-calendar"></i> ${rpEsc(created)}</span>` : ''}
                    ${mgmtUser ? `<span><i class="fa-solid fa-user-tie"></i> Mgmt: ${rpEsc(mgmtUser)}</span>` : ''}
                    ${hrUser ? `<span><i class="fa-solid fa-user-check"></i> HR: ${rpEsc(hrUser)}</span>` : ''}
                    ${vehicle ? `<span><i class="fa-solid fa-truck"></i> ${rpEsc(vehicle)}</span>` : ''}
                    ${driver ? `<span><i class="fa-solid fa-id-card"></i> ${rpEsc(driver)}</span>` : ''}
                  </div>
                </div>
                <button class="rp-btn rp-btn-download" onclick="rpDownloadGatepassPDF('${kind}', ${i}, '${source}')">
                  <i class="fa-solid fa-file-pdf"></i> PDF
                </button>
              </div>
            `;
          }).join('')}
        </div>
      ` : `
        <div class="rp-empty"><i class="fa-solid fa-inbox"></i><p>${emptyText}</p></div>
      `}
    </div>
  `;
}

/* MRN list section renderer */
function rpRenderMrnSection({ rows, emptyText, title = 'Material Requisition Notes (MRNs)', sub = 'Every MRN whose items include this PO', source = 'po' }) {
  return `
    <div class="rp-section">
      <div class="rp-section-head">
        <div class="rp-section-icon amber"><i class="fa-solid fa-file-invoice"></i></div>
        <div class="rp-section-title-wrap">
          <div class="rp-section-title">${title}</div>
          <div class="rp-section-sub">${sub}</div>
        </div>
        <span class="rp-count-pill"><i class="fa-solid fa-file-lines"></i> ${rows.length}</span>
      </div>
      ${rows.length ? `
        <div class="rp-item-list">
          ${rows.map((row, i) => {
            const name = row['MRN_Name'] || '—';
            const status = String(row['Status'] || '').trim();
            const createdBy = row['Created_By'] || '';
            const createdAt = row['Created_At'] || '';
            const grandTotal = row['Grand_Total'] || '';

            const statusClass =
              /pending/i.test(status) ? 'rp-status-pending' :
              /complete/i.test(status) ? 'rp-status-approved' :
              'rp-status-info';

            return `
              <div class="rp-item-card">
                <div class="rp-item-main">
                  <div class="rp-item-name">
                    <i class="fa-solid fa-file-invoice"></i> ${rpEsc(name)}
                    <span class="rp-status-badge ${statusClass}">${rpEsc(status || 'Unknown')}</span>
                  </div>
                  <div class="rp-item-meta">
                    ${createdBy ? `<span><i class="fa-solid fa-user"></i> ${rpEsc(createdBy)}</span>` : ''}
                    ${createdAt ? `<span><i class="fa-solid fa-clock"></i> ${rpEsc(createdAt)}</span>` : ''}
                    ${grandTotal ? `<span><i class="fa-solid fa-cubes"></i> Grand Total: ${rpEsc(grandTotal)}</span>` : ''}
                  </div>
                </div>
                <button class="rp-btn rp-btn-download" onclick="rpDownloadMRNPDF(${i}, '${source}')">
                  <i class="fa-solid fa-file-pdf"></i> PDF
                </button>
              </div>
            `;
          }).join('')}
        </div>
      ` : `
        <div class="rp-empty"><i class="fa-solid fa-inbox"></i><p>${emptyText}</p></div>
      `}
    </div>
  `;
}

/* ─────────────────────────────────────────────────────────────
   PDF ENGINE
   ───────────────────────────────────────────────────────────── */
function rpLoadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.onload = resolve;
    el.onerror = () => reject(new Error('Could not load PDF library.'));
    document.head.appendChild(el);
  });
}

async function rpEnsureJsPDF() {
  if (!(window.jspdf && window.jspdf.jsPDF)) {
    await rpLoadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  }
  if (!(window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.autoTable)) {
    await rpLoadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
  }
}

const RP_PURPLE = [124, 58, 237];
const RP_DARKBLUE = [13, 42, 87];
const RP_LIGHTGRAY = [240, 240, 240];

/* Shared page header for all report PDFs */
function rpPdfHeader(doc, title, subtitle) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(...RP_PURPLE);
  doc.rect(0, 0, pageWidth, 30, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('CONCORD FOOTWEAR (PVT) LTD', 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('SOLE MATRIX — Reports Center', 14, 19);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(title, pageWidth - 14, 12, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(subtitle, pageWidth - 14, 19, { align: 'right' });

  doc.setTextColor(0, 0, 0);
  return 38; // startY for content
}

/* Shared footer note */
function rpPdfFooter(doc) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(6.5);
  doc.setTextColor(110, 110, 110);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Generated by ${rpCurrentUser()} (${rpCurrentDept()}) — ${new Date().toLocaleString('en-GB')} — SOLE MATRIX — CONFIDENTIAL`,
    pageWidth / 2, pageHeight - 6, { align: 'center' }
  );
}

/* Shared items-table painter for output-style PDFs */
function rpPaintItemsTable(doc, startY, grouped, footLabel) {
  const total = grouped.reduce((s, g) => s + g.qty, 0);

  doc.autoTable({
    startY,
    head: [['#', 'PO', 'MODEL', 'OUTSOLE COLOUR', 'SIZE', 'QTY']],
    body: grouped.map((g, i) => [i + 1, g.po, g.model, g.colour, g.size, g.qty]),
    foot: [['', '', '', '', footLabel, total]],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: RP_PURPLE, textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: RP_DARKBLUE, textColor: 255, fontStyle: 'bold', halign: 'right' },
    columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'right', fontStyle: 'bold' } },
  });

  return total;
}

/* 1 & 2 · Date-driven output PDF (gfu | storse) */
async function rpDownloadDatePDF(key) {
  const cfg = RP_DATE_CFG[key];
  const d = RP.dateReports[key];
  if (!d || !d.grouped.length) return;

  try {
    await rpEnsureJsPDF();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    const rangeLabel = (d.from || d.to)
      ? `Time Window: ${d.from || '00:00'} to ${d.to || '23:59'}`
      : 'Full Day';

    let y = rpPdfHeader(doc, cfg.pdfTitle, `Date: ${d.date}`);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(rangeLabel, 14, y); y += 4;
    doc.text(`Total Quantity: ${d.total}   |   Lines: ${d.grouped.length}`, 14, y); y += 4;

    rpPaintItemsTable(doc, y + 2, d.grouped, 'GRAND TOTAL');

    rpPdfFooter(doc);
    doc.save(`${cfg.filePrefix}_${d.date.replace(/\//g, '-')}.pdf`);
  } catch (err) {
    alert('Failed to generate PDF: ' + err.message);
  }
}

/* 3 · Size-wise matrix PDF (gfu | storse) */
async function rpDownloadMatrixPDF(kind) {
  if (!RP.po) return;
  const isGfu = kind === 'gfu';
  const rows = isGfu ? RP.po.gfuRows : RP.po.storseRows;
  if (!rows.length) return;

  try {
    await rpEnsureJsPDF();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4');

    const matrix = rpBuildSizeMatrix(rows);
    const title = isGfu ? 'SIZE-WISE PRODUCTION OUTPUT' : 'SIZE-WISE STORSE OUT';

    let y = rpPdfHeader(doc, title, `PO: ${RP.po.po}`);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Grand Total: ${matrix.grandTotal}`, 14, y); y += 2;

    const head = [['#', 'MODEL', 'OUTSOLE COLOUR', ...matrix.sizes, 'TOTAL']];
    const body = matrix.rows.map((r, i) => [
      i + 1, r.model, r.colour,
      ...matrix.sizes.map(s => (r.cells[s] ? r.cells[s] : '-')),
      r.total,
    ]);
    const foot = [['', '', 'GRAND TOTAL',
      ...matrix.sizes.map(s => String(matrix.rows.reduce((acc, r) => acc + (r.cells[s] || 0), 0))),
      matrix.grandTotal]];

    doc.autoTable({
      startY: y + 2,
      head, body, foot,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: RP_PURPLE, textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: RP_DARKBLUE, textColor: 255, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 10, halign: 'center' } },
    });

    rpPdfFooter(doc);
    doc.save(`${isGfu ? 'PO_Output' : 'PO_StorseOut'}_${RP.po.po}.pdf`);
  } catch (err) {
    alert('Failed to generate PDF: ' + err.message);
  }
}

/* 4 & 5 · Gatepass PDF (works from po | daily | gp sources) */
async function rpDownloadGatepassPDF(kind, index, source = 'po') {
  const state = rpGetSourceState(source);
  if (!state) return;
  const rows = kind === 'gpStorse' ? state.gpStorse
    : kind === 'gpReturn' ? state.gpReturn
    : state.gpDesma;
  const row = rows[index];
  if (!row) return;

  try {
    await rpEnsureJsPDF();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4');

    const isStorse = kind === 'gpStorse';
    const isReturn = kind === 'gpReturn';
    const deptFull = isStorse ? 'Outsole Production Department'
      : isReturn ? 'Desma Department (Outsole Return)'
      : 'Desma Department';
    const name = row['Gatepass name'] || '—';
    const createdDate = row['Created Date'] || '';
    const createdTime = row['Created Time'] || '';
    const status = row['Status'] || '';
    const mgmtUser = row['Approved Management User'] || row['Approved Manegement User'] || 'N/A';
    const mgmtDate = row['Management Approve Date'] || row['Manegement Approve Date'] || '';
    const hrUser = row['Approved HR User'] || 'N/A';
    const hrDate = row['HR Approve Date'] || '';
    const vehicle = row['Vehicle Number'] || '';
    const driver = row['Driver Name'] || '';

    const { items } = rpGatepassItems(row);
    const poScoped = source === 'po';
    const poFilter = poScoped ? RP.po.po.toLowerCase() : null;
    const scoped = poFilter
      ? items.filter(it => String(it.po).toLowerCase() === poFilter)
      : items;

    let y = rpPdfHeader(
      doc,
      'GATEPASS',
      poScoped
        ? `${isStorse ? 'STORSE TO GFU' : isReturn ? 'DESMA RETURN' : 'DESMA IN'} · PO ${RP.po.po}`
        : (isStorse ? 'STORSE TO GFU GATEPASS' : isReturn ? 'DESMA RETURN GATEPASS' : 'DESMA IN GATEPASS')
    );

    /* Info boxes */
    const boxY = y;
    const boxH = 14;
    const boxes = [
      ['GATEPASS REFERENCE', name, 14, 70],
      ['DATE ISSUED', `${createdDate}${createdTime ? ' ' + createdTime : ''}`, 88, 55],
      ['STATUS', status || '—', 147, 45],
      ['DEPARTMENT', deptFull.replace(' Department', '').toUpperCase(), 196, 60],
    ];
    boxes.forEach(([label, value, x, w]) => {
      doc.setFillColor(...RP_LIGHTGRAY);
      doc.rect(x, boxY, w, boxH, 'F');
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.text(label, x + 2, boxY + 5);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.text(String(value).substring(0, 34), x + 2, boxY + 11);
    });
    y = boxY + boxH + 6;

    /* Approval line */
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('MANAGEMENT:', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`${mgmtUser}${mgmtDate ? ' (' + mgmtDate + ')' : ''}`, 44, y);
    doc.setFont('helvetica', 'bold');
    doc.text('HR:', 100, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`${hrUser}${hrDate ? ' (' + hrDate + ')' : ''}`, 112, y);
    if (vehicle) {
      doc.setFont('helvetica', 'bold');
      doc.text('VEHICLE:', 160, y);
      doc.setFont('helvetica', 'normal');
      doc.text(`${vehicle}${driver ? ' / ' + driver : ''}`, 184, y);
    }
    y += 4;

    /* Items table */
    const grouped = rpGroupOutRows(scoped.map(it => ({
      po: it.po, model: it.model, colour: it.colour, size: it.size, qty: it.qty,
    })));

    rpPaintItemsTable(doc, y + 2, grouped, poScoped ? 'TOTAL (THIS PO)' : 'TOTAL');

    rpPdfFooter(doc);
    const suffix = poScoped ? `_${RP.po.po}` : '';
    doc.save(`Gatepass_${isStorse ? 'StorseToGFU' : isReturn ? 'DesmaReturn' : 'DesmaIn'}_${name}${suffix}.pdf`);
  } catch (err) {
    alert('Failed to generate PDF: ' + err.message);
  }
}

/* MRN PDF (works from po | daily | mrn sources) */
async function rpDownloadMRNPDF(index, source = 'po') {
  const state = rpGetSourceState(source);
  if (!state) return;
  const row = state.mrns[index];
  if (!row) return;

  try {
    await rpEnsureJsPDF();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4');

    const name = row['MRN_Name'] || '—';
    const createdBy = row['Created_By'] || 'N/A';
    const createdAt = row['Created_At'] || '';
    const status = row['Status'] || '';

    const poScoped = source === 'po';
    const poFilter = poScoped ? RP.po.po.toLowerCase() : null;
    const allItems = rpMrnItems(row);
    const items = poFilter
      ? allItems.filter(it => String(it.po).toLowerCase() === poFilter)
      : allItems;

    let y = rpPdfHeader(
      doc,
      'MATERIAL REQUISITION NOTE',
      poScoped ? `PO ${RP.po.po}` : 'MRN REPORT'
    );

    const boxY = y;
    const boxes = [
      ['MRN NAME', name, 14, 90],
      ['CREATED BY', createdBy, 108, 50],
      ['CREATED AT', createdAt, 162, 55],
      ['STATUS', status || '—', 221, 35],
    ];
    boxes.forEach(([label, value, x, w]) => {
      doc.setFillColor(...RP_LIGHTGRAY);
      doc.rect(x, boxY, w, 14, 'F');
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.text(label, x + 2, boxY + 5);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.text(String(value).substring(0, 30), x + 2, boxY + 11);
    });
    y = boxY + 20;

    const grouped = rpGroupOutRows(items);
    rpPaintItemsTable(doc, y, grouped, poScoped ? 'TOTAL (THIS PO)' : 'TOTAL');

    rpPdfFooter(doc);
    const suffix = poScoped ? `_${RP.po.po}` : '';
    doc.save(`MRN_${name}${suffix}.pdf`);
  } catch (err) {
    alert('Failed to generate PDF: ' + err.message);
  }
}

/* ─────────────────────────────────────────────────────────────
   EXCEL EXPORTS
   ───────────────────────────────────────────────────────────── */

/* Trigger a browser download of an Excel-compatible HTML workbook */
function rpSaveExcel(filename, html) {
  const blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function rpExcelHeadStyle() {
  return `
  <style>
    body { font-family: Calibri, Arial, sans-serif; }
    h3 { margin: 14px 0 4px; }
    h4 { margin: 10px 0 4px; }
    table { border-collapse: collapse; }
    th, td { border: 1px solid #9a9a9a; padding: 4px 10px; font-size: 11pt; }
    th { background: #7c3aed; color: #ffffff; font-weight: bold; }
  </style>`;
}

/* Build a size-wise matrix keyed by PO|Model|Colour for Excel exports */
function rpBuildExcelMatrix(grouped) {
  const sizeSet = new Set();
  const rowMap = new Map();

  grouped.forEach(g => {
    sizeSet.add(g.size);
    const key = `${g.po}|${g.model}|${g.colour}`;
    if (!rowMap.has(key)) {
      rowMap.set(key, { po: g.po, model: g.model, colour: g.colour, cells: {}, total: 0 });
    }
    const entry = rowMap.get(key);
    entry.cells[g.size] = (entry.cells[g.size] || 0) + g.qty;
    entry.total += g.qty;
  });

  const sizes = Array.from(sizeSet).sort((a, b) => rpSortSizeKey(a) - rpSortSizeKey(b));
  const rows = Array.from(rowMap.values()).sort((a, b) => {
    const poCmp = a.po.localeCompare(b.po, undefined, { numeric: true });
    if (poCmp !== 0) return poCmp;
    const mdl = a.model.localeCompare(b.model);
    if (mdl !== 0) return mdl;
    return a.colour.localeCompare(b.colour);
  });

  let grandTotal = 0;
  rows.forEach(r => { grandTotal += r.total; });

  return { sizes, rows, grandTotal };
}

/* Size-wise Excel: PO / Model / Colour as rows, sizes across the top,
   QTY for every PO-and-size combination */
function rpDownloadDateExcel(key) {
  const cfg = RP_DATE_CFG[key];
  const d = RP.dateReports[key];
  if (!d) return;

  const escX = v => String(v == null ? '' : v)
    .split('&').join('&' + 'amp;')
    .split('<').join('&' + 'lt;')
    .split('>').join('&' + 'gt;');

  const rangeTag = (d.from || d.to) ? ` (${escX(d.from || '00:00')} – ${escX(d.to || '23:59')})` : '';

  const matrix = rpBuildExcelMatrix(d.grouped);

  /* Header row */
  const headCells = [
    '<th>#</th>', '<th>PO</th>', '<th>Model</th>', '<th>Outsole Colour</th>',
    ...matrix.sizes.map(s => `<th style="text-align:center;">${escX(s)}</th>`),
    '<th style="text-align:right;">TOTAL</th>',
  ].join('');

  /* Data rows — one per PO | Model | Colour combination */
  const bodyRows = matrix.rows.map((r, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${escX(r.po)}</td>
          <td>${escX(r.model)}</td>
          <td>${escX(r.colour)}</td>
          ${matrix.sizes.map(s => `<td style="text-align:center;">${r.cells[s] ? r.cells[s] : '-'}</td>`).join('')}
          <td style="text-align:right;"><b>${r.total}</b></td>
        </tr>`).join('');

  /* Grand-total footer with per-size column sums */
  const footCells = [
    '<td colspan="4"><b>GRAND TOTAL</b></td>',
    ...matrix.sizes.map(s => {
      const colSum = matrix.rows.reduce((acc, r) => acc + (r.cells[s] || 0), 0);
      return `<td style="text-align:center;"><b>${colSum || '-'}</b></td>`;
    }),
    `<td style="text-align:right;"><b>${matrix.grandTotal}</b></td>`,
  ].join('');

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="UTF-8">${rpExcelHeadStyle()}</head>
<body>
  <h3>SOLE MATRIX — ${escX(cfg.heading)} — ${escX(d.date)}${rangeTag}</h3>
  <table>
    <tr>${headCells}</tr>
    ${bodyRows || `<tr><td colspan="${4 + matrix.sizes.length + 1}">No records on this date</td></tr>`}
    <tr>${footCells}</tr>
  </table>
</body>
</html>`;

  rpSaveExcel(`${cfg.excelName}_${String(d.date).replace(/\//g, '-')}.xls`, html);
}

/* Size-wise Excel for a single PO (gfu | storse) */
function rpDownloadPoMatrixExcel(kind) {
  if (!RP.po) return;
  const isGfu = kind === 'gfu';
  const rows = isGfu ? RP.po.gfuRows : RP.po.storseRows;

  const escX = v => String(v == null ? '' : v)
    .split('&').join('&' + 'amp;')
    .split('<').join('&' + 'lt;')
    .split('>').join('&' + 'gt;');

  const matrix = rpBuildSizeMatrix(rows);
  const title = isGfu ? 'Size-Wise Outsole Production Output' : 'Size-Wise Storse Out';

  /* Header row */
  const headCells = [
    '<th>#</th>', '<th>Model</th>', '<th>Outsole Colour</th>',
    ...matrix.sizes.map(s => `<th style="text-align:center;">${escX(s)}</th>`),
    '<th style="text-align:right;">TOTAL</th>',
  ].join('');

  /* Data rows */
  const bodyRows = matrix.rows.map((r, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${escX(r.model)}</td>
          <td>${escX(r.colour)}</td>
          ${matrix.sizes.map(s => `<td style="text-align:center;">${r.cells[s] ? r.cells[s] : '-'}</td>`).join('')}
          <td style="text-align:right;"><b>${r.total}</b></td>
        </tr>`).join('');

  /* Grand-total footer with per-size column sums */
  const footCells = [
    '<td colspan="3"><b>GRAND TOTAL</b></td>',
    ...matrix.sizes.map(s => {
      const colSum = matrix.rows.reduce((acc, r) => acc + (r.cells[s] || 0), 0);
      return `<td style="text-align:center;"><b>${colSum || '-'}</b></td>`;
    }),
    `<td style="text-align:right;"><b>${matrix.grandTotal}</b></td>`,
  ].join('');

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="UTF-8">${rpExcelHeadStyle()}</head>
<body>
  <h3>SOLE MATRIX — ${escX(title)} — PO ${escX(RP.po.po)}</h3>
  <table>
    <tr>${headCells}</tr>
    ${bodyRows || `<tr><td colspan="${3 + matrix.sizes.length + 1}">No records for this PO</td></tr>`}
    <tr>${footCells}</tr>
  </table>
</body>
</html>`;

  rpSaveExcel(`${isGfu ? 'PO_Output' : 'PO_StorseOut'}_${RP.po.po}.xls`, html);
}

console.log('[SOLE MATRIX] Reports Center module loaded');
