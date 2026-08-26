/* ═══════════════════════════════════════════════════════════════
   SOLE MATRIX — PLAN TRACKER (shared across departments)
   Concord Footwear (Pvt) Ltd
   ───────────────────────────────────────────────────────────────
   Enter a plan name (e.g. 1ST-EXTRA-GLUING-PLAN-WEEK-24-20260808)
   and the tracker follows it across every Google Sheet:

     Stage 1 · MRN Created          [Pending_MRN]
     Stage 2 · Stores Dispatch      [Storse Out — matched by MRN_Name]
     Stage 3 · Production Output    [GFU Out   — matched by MRN_Name]
     Stage 4 · Gatepass / Transport [Storse To GFU + Desma In,
                                     matched via the plan's POs]
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   STATE & CONSTANTS
   ───────────────────────────────────────────────────────────── */
const PT = {
  overlay: null,
  cache: {},
};

const PT_SHEET_URLS = {
  mrn: (typeof CONFIG !== 'undefined' && CONFIG.SHEETBEST_MRN_URL)
    ? CONFIG.SHEETBEST_MRN_URL
    : 'https://api.sheetbest.com/sheets/dd583123-5c7c-4279-8303-2aea56b7c8aa/tabs/Pending_MRN',
  storseOut: (typeof CONFIG !== 'undefined' && CONFIG.SHEETBEST_STORESOUT_URL)
    ? CONFIG.SHEETBEST_STORESOUT_URL
    : 'https://api.sheetbest.com/sheets/dd583123-5c7c-4279-8303-2aea56b7c8aa/tabs/Storse Out',
  gfuOut: (typeof CONFIG !== 'undefined' && CONFIG.SHEETBEST_GFUOUT_URL)
    ? CONFIG.SHEETBEST_GFUOUT_URL
    : 'https://api.sheetbest.com/sheets/dd583123-5c7c-4279-8303-2aea56b7c8aa/tabs/GFU Out',
  gpStorse: (typeof CONFIG !== 'undefined' && CONFIG.SHEETBEST_STORSE_TO_GFU_GATEPASS_URL)
    ? CONFIG.SHEETBEST_STORSE_TO_GFU_GATEPASS_URL
    : 'https://api.sheetbest.com/sheets/dd583123-5c7c-4279-8303-2aea56b7c8aa/tabs/Storse To GFU Gatepass',
  gpDesma: (typeof CONFIG !== 'undefined' && CONFIG.SHEETBEST_DESMA_IN_GATEPASS_URL)
    ? CONFIG.SHEETBEST_DESMA_IN_GATEPASS_URL
    : 'https://api.sheetbest.com/sheets/dd583123-5c7c-4279-8303-2aea56b7c8aa/tabs/Desma In Gatepass',
};

const PT_TIMEOUT = 20000;

/* ─────────────────────────────────────────────────────────────
   SMALL UTILITIES
   ───────────────────────────────────────────────────────────── */
function ptEsc(value) {
  const div = document.createElement('div');
  div.textContent = value == null ? '' : String(value);
  return div.innerHTML;
}

function ptNorm(value) {
  return String(value == null ? '' : value).trim().toLowerCase();
}

async function ptFetchSheet(key) {
  const url = PT_SHEET_URLS[key];
  if (PT.cache[url]) return PT.cache[url];

  PT.cache[url] = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PT_TIMEOUT);
    try {
      const res = await fetch(url, { method: 'GET', signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`Sheet request failed (${res.status})`);
      const rows = await res.json();
      if (!Array.isArray(rows)) throw new Error('Unexpected sheet response');
      return rows;
    } catch (err) {
      clearTimeout(timer);
      delete PT.cache[url];
      if (err.name === 'AbortError') throw new Error('Request timed out. Please check your connection.');
      throw err;
    }
  })();

  return PT.cache[url];
}

/* Parse sheet date ("2/08/2026", "20/08/2026", ISO…) → {y,mth,d} */
function ptParseDate(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return { y: +m[1], mth: +m[2], d: +m[3] };

  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return { y: +m[3], mth: +m[2], d: +m[1] };

  const parsed = new Date(s);
  if (!isNaN(parsed)) {
    return { y: parsed.getFullYear(), mth: parsed.getMonth() + 1, d: parsed.getDate() };
  }
  return null;
}

/* Parse time ("12:40:24") → seconds since midnight */
function ptParseTime(value) {
  if (value == null) return null;
  const m = String(value).trim().match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
  if (!m) return null;
  return (+m[1]) * 3600 + (+m[2]) * 60 + (m[3] ? +m[3] : 0);
}

/* Latest activity timestamp across out-rows (for "last activity") */
function ptLastActivity(rows) {
  let best = null;
  rows.forEach(r => {
    const d = ptParseDate(r['Date']);
    const t = ptParseTime(r['Time']) || 0;
    if (!d) return;
    const key = d.y * 100000000 + d.mth * 1000000 + d.d * 10000 + t;
    if (!best || key > best.key) best = { key, raw: `${r['Date'] ?? ''} ${r['Time'] ?? ''}`.trim() };
  });
  return best ? best.raw : '';
}

/* Group out-rows into PO|Model|Colour|Size lines */
function ptGroupRows(rows) {
  const map = new Map();
  rows.forEach(r => {
    const po = String(r['PO'] ?? '').trim();
    const model = String(r['Model'] ?? '').trim();
    const colour = String(row_colourOf(r)).trim();
    const size = String(r['Size'] ?? '').trim();
    const qty = parseInt(r['QTY'], 10) || 0;
    const key = `${po}|${model}|${colour}|${size}`;
    if (!map.has(key)) map.set(key, { po, model, colour, size, qty: 0 });
    map.get(key).qty += qty;
  });
  return Array.from(map.values()).sort((a, b) => {
    const p = a.po.localeCompare(b.po, undefined, { numeric: true });
    if (p !== 0) return p;
    const m = a.model.localeCompare(b.model);
    if (m !== 0) return m;
    return a.size.localeCompare(b.size, undefined, { numeric: true });
  });
}

/* Colour header differs per sheet (space vs underscore) */
function row_colourOf(row) {
  return row['Outsole Colour'] ?? row['Outsole_Colour'] ?? '';
}

/* Expand MRN Rows_JSON → [{po, model, colour, sizes:{s:q}, total}] */
function ptMrnItems(mrnRow) {
  let items = [];
  try {
    const parsed = JSON.parse(mrnRow['Rows_JSON'] || '[]');
    if (Array.isArray(parsed)) items = parsed;
  } catch (e) { items = []; }
  return items.map(it => ({
    po: String(it.po ?? '').trim(),
    model: String(it.model ?? '').trim(),
    colour: String(it.color ?? '').trim(),
    sizes: it.sizes && typeof it.sizes === 'object' ? it.sizes : {},
    total: parseInt(it.total, 10) ||
           Object.values(it.sizes || {}).reduce((s, q) => s + (parseInt(q, 10) || 0), 0),
  }));
}

/* Expand gatepass Rows_JSON items → flat [{po,…}] */
function ptGatepassItems(gatepassRow) {
  let data = {};
  try { data = JSON.parse(gatepassRow['Rows_JSON'] || '{}'); } catch (e) { data = {}; }

  let items = [];
  if (Array.isArray(data.Items)) items = data.Items;
  else if (Array.isArray(data.items)) items = data.items;
  else if (data.PO) items = [data];

  const flat = [];
  items.forEach(it => {
    const po = String(it.PO ?? it.po ?? '').trim();
    if (it.QTY && typeof it.QTY === 'object' && !Array.isArray(it.QTY)) {
      Object.entries(it.QTY).forEach(([size, qty]) => {
        flat.push({ po, size: String(size), qty: parseInt(qty, 10) || 0 });
      });
    } else {
      flat.push({ po, size: String(it.Size ?? ''), qty: parseInt(it.QTY ?? it.qty, 10) || 0 });
    }
  });
  return flat;
}

/* ─────────────────────────────────────────────────────────────
   OVERLAY UI
   ───────────────────────────────────────────────────────────── */
function openPlanTracker() {
  if (!PT.overlay) {
    PT.overlay = document.createElement('div');
    PT.overlay.className = 'pt-overlay';
    PT.overlay.id = 'planTrackerOverlay';
    PT.overlay.innerHTML = `
      <div class="pt-modal" role="dialog" aria-modal="true" aria-label="Plan Tracker">
        <div class="pt-header">
          <div class="pt-header-icon"><i class="fa-solid fa-route"></i></div>
          <div>
            <p class="pt-header-label">Cross-Sheet Pipeline Visibility</p>
            <h2 class="pt-header-title">Plan Tracker</h2>
          </div>
          <button class="pt-close-btn" onclick="closePlanTracker()" aria-label="Close plan tracker">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="pt-body">
          <div class="pt-search-card">
            <div class="pt-search-title"><i class="fa-solid fa-magnifying-glass-location"></i> Track a Production Plan</div>
            <p class="pt-search-hint">
              Enter the name of a plan (MRN) — e.g.
              <strong>1ST-EXTRA-GLUING-PLAN-WEEK-24-20260808</strong> — to see exactly which stage it has
              reached across Material Requisition, Stores dispatch, GFU production output and Gatepasses.
              Partial names work too (e.g. <strong>WEEK-24</strong>). Leave empty and press Track to browse recent plans.
            </p>
            <div class="pt-form-row">
              <div class="pt-field">
                <label>Plan Name</label>
                <input type="text" id="ptQuery" class="pt-input"
                       placeholder="Type a plan name or part of it…"
                       autocomplete="off"
                       onkeydown="if(event.key==='Enter')ptRunSearch()">
              </div>
              <button class="pt-btn pt-btn-primary" onclick="ptRunSearch()">
                <i class="fa-solid fa-route"></i> Track Plan
              </button>
            </div>
          </div>
          <div id="ptResults"></div>
        </div>
      </div>
    `;
    document.body.appendChild(PT.overlay);

    PT.overlay.addEventListener('click', (e) => {
      if (e.target === PT.overlay) closePlanTracker();
    });
    document.addEventListener('keydown', ptEscHandler);
  }

  PT.overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
  setTimeout(() => { const el = document.getElementById('ptQuery'); if (el) el.focus(); }, 250);
}

function ptEscHandler(e) {
  if (e.key === 'Escape') closePlanTracker();
}

function closePlanTracker() {
  if (!PT.overlay) return;

  const el = PT.overlay;
  PT.overlay = null;

  el.classList.remove('active');
  document.body.style.overflow = '';
  document.removeEventListener('keydown', ptEscHandler);

  // Fully detach so the invisible layer can never swallow clicks.
  setTimeout(() => el.remove(), 300);
}

/* ─────────────────────────────────────────────────────────────
   SEARCH & TRACKING LOGIC
   ───────────────────────────────────────────────────────────── */
async function ptRunSearch() {
  const resultsEl = document.getElementById('ptResults');
  if (!resultsEl) return;

  const queryEl = document.getElementById('ptQuery');
  const query = String(queryEl.value || '').trim();

  resultsEl.innerHTML = `
    <div class="pt-loading">
      <i class="fa-solid fa-spinner"></i>
      <p>Scanning all sheets for this plan…</p>
    </div>
  `;

  try {
    const [mrnRaw, storseRaw, gfuRaw] = await Promise.all([
      ptFetchSheet('mrn'),
      ptFetchSheet('storseOut'),
      ptFetchSheet('gfuOut'),
    ]);

    /* Empty query → suggest the most recent plans */
    if (!query) {
      const recent = [...mrnRaw]
        .filter(r => r['MRN_Name'])
        .sort((a, b) => ptParseDate(b['Created_At'])?.y - ptParseDate(a['Created_At'])?.y)
        .slice(0, 12);
      renderSuggestions(resultsEl, recent.map(r => r['MRN_Name']), 'Recent Plans');
      return;
    }

    const q = ptNorm(query);

    /* 1 · exact match on the MRN name */
    let mrn = mrnRaw.find(r => ptNorm(r['MRN_Name']) === q);
    let planName = mrn ? mrn['MRN_Name'] : null;

    /* 2 · otherwise collect substring candidates from every sheet */
    if (!mrn) {
      const candidates = [...new Set([
        ...mrnRaw.map(r => r['MRN_Name']),
        ...storseRaw.map(r => r['MRN_Name']),
        ...gfuRaw.map(r => r['MRN_Name']),
      ].filter(n => n && ptNorm(n).includes(q)))];

      if (candidates.length === 0) {
        resultsEl.innerHTML = `
          <div class="pt-section">
            <div class="pt-empty">
              <i class="fa-solid fa-circle-question"></i>
              <p>No plan matching "<strong>${ptEsc(query)}</strong>" was found in any sheet.</p>
              <p style="font-size:.78rem;">Check the spelling or try a shorter part of the name.</p>
            </div>
          </div>
        `;
        return;
      }

      if (candidates.length > 1) {
        renderSuggestions(resultsEl, candidates, `${candidates.length} Matching Plans`);
        return;
      }

      planName = candidates[0];
      mrn = mrnRaw.find(r => ptNorm(r['MRN_Name']) === ptNorm(planName)) || null;
    }

    await ptTrack(resultsEl, planName, mrn, storseRaw, gfuRaw);
  } catch (err) {
    resultsEl.innerHTML = `
      <div class="pt-error-box">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <span>${ptEsc(err.message)}</span>
        <button class="pt-btn pt-btn-chip" onclick="ptRunSearch()">Retry</button>
      </div>
    `;
  }
}

/* Track a specific plan name using pre-fetched sheet rows */
async function ptTrack(resultsEl, planName, mrn, storseRaw, gfuRaw) {
  const normName = ptNorm(planName);

  const storseRows = storseRaw.filter(r => ptNorm(r['MRN_Name']) === normName);
  const gfuRows = gfuRaw.filter(r => ptNorm(r['MRN_Name']) === normName);

  /* Collect every PO connected to this plan */
  const pos = new Set();
  if (mrn) ptMrnItems(mrn).forEach(it => { if (it.po) pos.add(it.po); });
  storseRows.forEach(r => { const p = String(r['PO'] ?? '').trim(); if (p) pos.add(p); });
  gfuRows.forEach(r => { const p = String(r['PO'] ?? '').trim(); if (p) pos.add(p); });

  /* Related gatepasses — matched through the plan's POs */
  let relGpStorse = [];
  let relGpDesma = [];
  try {
    const [gpSRaw, gpDRaw] = await Promise.all([
      ptFetchSheet('gpStorse'),
      ptFetchSheet('gpDesma'),
    ]);
    const poSet = new Set([...pos].map(ptNorm));
    const hasPo = row => ptGatepassItems(row).some(it => poSet.has(ptNorm(it.po)));
    relGpStorse = gpSRaw.filter(hasPo);
    relGpDesma = gpDRaw.filter(hasPo);
  } catch (e) { /* gatepass stages degrade gracefully */ }

  /* Quantities */
  const mrnItems = mrn ? ptMrnItems(mrn) : [];
  const mrnTotal =
    mrnItems.reduce((s, it) => s + (it.total || 0), 0) ||
    parseInt(mrn?.['Grand_Total'], 10) || 0;

  const dispatchedQty = storseRows.reduce((s, r) => s + (parseInt(r['QTY'], 10) || 0), 0);
  const producedQty = gfuRows.reduce((s, r) => s + (parseInt(r['QTY'], 10) || 0), 0);

  const verifiedDispatched = storseRows.filter(r => ptNorm(r['Verification']) === 'verified')
    .reduce((s, r) => s + (parseInt(r['QTY'], 10) || 0), 0);
  const verifiedProduced = gfuRows.filter(r => ptNorm(r['Verification']) === 'verified')
    .reduce((s, r) => s + (parseInt(r['QTY'], 10) || 0), 0);

  /* Denominator guard so bars never exceed 100% */
  const baseTotal = Math.max(mrnTotal, dispatchedQty, producedQty);

  /* Related gatepasses of the plan's POs */
  const relGps = [
    ...relGpStorse.map(r => ({ ...r, __type: 'Storse To GFU' })),
    ...relGpDesma.map(r => ({ ...r, __type: 'Desma In' })),
  ];

  /* ── Stepper states ── */
  const pct = (v) => baseTotal > 0 ? Math.min(100, Math.round((v / baseTotal) * 100)) : 0;

  const dispatchState = storseRows.length === 0 ? 'todo'
    : (baseTotal > 0 && dispatchedQty >= baseTotal) ? 'done' : 'active';

  const outputState = gfuRows.length === 0 ? 'todo'
    : (baseTotal > 0 && producedQty >= baseTotal) ? 'done' : 'active';

  const gpState = relGps.length > 0 ? 'done' : 'todo';

  const stages = [
    { icon: 'fa-file-circle-plus', label: 'MRN Created', state: mrn ? 'done' : 'todo',
      sub: mrn ? ptEsc(mrn['Status'] || 'Registered') : 'Not raised' },
    { icon: 'fa-truck-ramp-box', label: 'Stores Dispatch', state: dispatchState,
      sub: storseRows.length ? `${dispatchedQty} units` : 'No dispatches' },
    { icon: 'fa-industry', label: 'Production Output', state: outputState,
      sub: gfuRows.length ? `${producedQty} units` : 'No output yet' },
    { icon: 'fa-file-signature', label: 'Gatepass / Transport', state: gpState,
      sub: relGps.length ? `${relGps.length} gatepass${relGps.length !== 1 ? 'es' : ''}` : 'None yet' },
  ];

  /* ── Render ── */
  resultsEl.innerHTML = `
    <!-- Stepper -->
    <div class="pt-stepper">
      ${stages.map(s => `
        <div class="pt-step ${s.state}">
          <div class="pt-dot"><i class="fa-solid ${s.icon}"></i></div>
          <div class="pt-step-label">${s.label}</div>
          <div class="pt-step-sub">${s.sub}</div>
        </div>`).join('')}
    </div>

    <!-- Plan header meta -->
    <div class="pt-section">
      <div class="pt-section-head">
        <div class="pt-section-icon amber"><i class="fa-solid fa-clipboard-list"></i></div>
        <div class="pt-section-title-wrap">
          <div class="pt-section-title">${ptEsc(planName)}</div>
          <div class="pt-section-sub">Overall pipeline status for this plan</div>
        </div>
        ${mrn ? `<span class="rp-status-badge ${ptNorm(mrn['Status']) === 'complete' ? 'rp-status-approved' : 'rp-status-pending'}">
                   MRN ${ptEsc(mrn['Status'] || 'Unknown')}
                 </span>` : ''}
      </div>
      <div class="pt-meta-grid">
        <div class="pt-meta-item"><div class="pt-meta-label">Planned QTY</div><div class="pt-meta-value">${baseTotal}</div></div>
        <div class="pt-meta-item"><div class="pt-meta-label">Dispatched</div><div class="pt-meta-value">${dispatchedQty} <span style="color:#9aa3b5;font-weight:600;">(${pct(dispatchedQty)}%)</span></div></div>
        <div class="pt-meta-item"><div class="pt-meta-label">Produced at GFU</div><div class="pt-meta-value">${producedQty} <span style="color:#9aa3b5;font-weight:600;">(${pct(producedQty)}%)</span></div></div>
        <div class="pt-meta-item"><div class="pt-meta-label">Connected POs</div><div class="pt-meta-value">${pos.size || '—'}</div></div>
      </div>

      <div class="pt-progress-wrap">
        <div class="pt-progress-top"><span>Stores Dispatch progress</span><strong>${dispatchedQty} / ${baseTotal}</strong></div>
        <div class="pt-progress"><div class="pt-progress-fill" style="width:${pct(dispatchedQty)}%;"></div></div>
      </div>
      <div class="pt-progress-wrap">
        <div class="pt-progress-top"><span>Production Output progress</span><strong>${producedQty} / ${baseTotal}</strong></div>
        <div class="pt-progress"><div class="pt-progress-fill green" style="width:${pct(producedQty)}%;"></div></div>
      </div>
    </div>

    <!-- Stage 1 · MRN -->
    ${mrn ? ptMrnCard(mrn, mrnItems) : `
      <div class="pt-section">
        <div class="pt-section-head">
          <div class="pt-section-icon amber"><i class="fa-solid fa-file-circle-plus"></i></div>
          <div class="pt-section-title-wrap">
            <div class="pt-section-title">Stage 1 · MRN Created</div>
            <div class="pt-section-sub">Pending_MRN sheet</div>
          </div>
        </div>
        <div class="pt-empty"><i class="fa-solid fa-inbox"></i><p>No MRN record found under this name — the plan may have been tracked only through dispatch/output rows.</p></div>
      </div>
    `}

    <!-- Stage 2 · Stores Dispatch -->
    ${ptOutCard({
      icon: 'green', iconFa: 'fa-truck-ramp-box',
      title: 'Stage 2 · Stores Dispatch',
      sub: 'Storse Out sheet — matched by MRN name',
      rows: storseRows, verified: verifiedDispatched,
      emptyText: 'Nothing has been dispatched from Storse for this plan yet.',
    })}

    <!-- Stage 3 · Production Output -->
    ${ptOutCard({
      icon: 'violet', iconFa: 'fa-industry',
      title: 'Stage 3 · Production Output',
      sub: 'GFU Out sheet — matched by MRN name',
      rows: gfuRows, verified: verifiedProduced,
      emptyText: 'No production output has been recorded for this plan yet.',
    })}

    <!-- Stage 4 · Gatepasses -->
    <div class="pt-section">
      <div class="pt-section-head">
        <div class="pt-section-icon cyan"><i class="fa-solid fa-file-signature"></i></div>
        <div class="pt-section-title-wrap">
          <div class="pt-section-title">Stage 4 · Gatepass / Transport</div>
          <div class="pt-section-sub">Matched through the plan's PO numbers</div>
        </div>
        <span class="rp-count-pill"><i class="fa-solid fa-file-lines"></i> ${relGps.length}</span>
      </div>
      ${relGps.length ? `
        <div class="rp-item-list">
          ${relGps.map(row => {
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
                    <i class="fa-solid fa-file-signature"></i> ${ptEsc(name)}
                    <span class="rp-status-badge ${statusClass}">${ptEsc(status || 'Unknown')}</span>
                    <span class="rp-status-badge rp-status-info">${ptEsc(row.__type)}</span>
                  </div>
                  <div class="rp-item-meta">
                    ${created ? `<span><i class="fa-solid fa-calendar"></i> ${ptEsc(created)}</span>` : ''}
                    ${mgmtUser ? `<span><i class="fa-solid fa-user-tie"></i> Mgmt: ${ptEsc(mgmtUser)}</span>` : ''}
                    ${hrUser ? `<span><i class="fa-solid fa-user-check"></i> HR: ${ptEsc(hrUser)}</span>` : ''}
                    ${vehicle ? `<span><i class="fa-solid fa-truck"></i> ${ptEsc(vehicle)}</span>` : ''}
                    ${driver ? `<span><i class="fa-solid fa-id-card"></i> ${ptEsc(driver)}</span>` : ''}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : `
        <div class="pt-empty"><i class="fa-solid fa-inbox"></i><p>No gatepass has been raised against this plan's POs yet.</p></div>
      `}
    </div>
  `;
}

/* ── Stage card builders ─────────────────────────────────────── */
function ptMrnCard(mrn, items) {
  const sizesStr = it => Object.entries(it.sizes)
    .map(([s, q]) => `${s}:${q}`).join(', ') || '—';

  return `
    <div class="pt-section">
      <div class="pt-section-head">
        <div class="pt-section-icon amber"><i class="fa-solid fa-file-circle-plus"></i></div>
        <div class="pt-section-title-wrap">
          <div class="pt-section-title">Stage 1 · MRN Created</div>
          <div class="pt-section-sub">Pending_MRN sheet</div>
        </div>
        <span class="rp-count-pill"><i class="fa-solid fa-layer-group"></i> ${items.length} item${items.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="pt-meta-grid">
        <div class="pt-meta-item"><div class="pt-meta-label">Created By</div><div class="pt-meta-value">${ptEsc(mrn['Created_By'] || '—')}</div></div>
        <div class="pt-meta-item"><div class="pt-meta-label">Created At</div><div class="pt-meta-value">${ptEsc(mrn['Created_At'] || '—')}</div></div>
        <div class="pt-meta-item"><div class="pt-meta-label">Status</div><div class="pt-meta-value">${ptEsc(mrn['Status'] || '—')}</div></div>
        <div class="pt-meta-item"><div class="pt-meta-label">Grand Total</div><div class="pt-meta-value">${ptEsc(mrn['Grand_Total'] || '—')}</div></div>
      </div>
      ${items.length ? `
        <div class="rp-table-wrap">
          <table class="rp-table">
            <thead><tr><th>#</th><th>PO</th><th>Model</th><th>Colour</th><th>Sizes (size:qty)</th><th class="num">Total</th></tr></thead>
            <tbody>
              ${items.map((it, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td class="rp-po-cell">${ptEsc(it.po)}</td>
                  <td>${ptEsc(it.model)}</td>
                  <td>${ptEsc(it.colour)}</td>
                  <td>${ptEsc(sizesStr(it))}</td>
                  <td class="num"><strong>${it.total}</strong></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}
    </div>
  `;
}

function ptOutCard({ icon, iconFa, title, sub, rows, verified, emptyText }) {
  const grouped = ptGroupRows(rows);
  const total = grouped.reduce((s, g) => s + g.qty, 0);
  const lastAct = ptLastActivity(rows);

  return `
    <div class="pt-section">
      <div class="pt-section-head">
        <div class="pt-section-icon ${icon}"><i class="fa-solid ${iconFa}"></i></div>
        <div class="pt-section-title-wrap">
          <div class="pt-section-title">${title}</div>
          <div class="pt-section-sub">${sub}</div>
        </div>
        ${rows.length ? `
          <span class="rp-count-pill"><i class="fa-solid fa-cubes"></i> ${total} units</span>
          <span class="rp-count-pill"><i class="fa-solid fa-shield-halved"></i> Verified ${verified}</span>
        ` : ''}
      </div>
      ${rows.length ? `
        ${lastAct ? `<div class="pt-section-sub" style="margin-bottom:10px;"><i class="fa-solid fa-clock"></i> Last activity: ${ptEsc(lastAct)}</div>` : ''}
        <div class="rp-table-wrap">
          <table class="rp-table">
            <thead><tr><th>#</th><th>PO</th><th>Model</th><th>Outsole Colour</th><th class="ctr">Size</th><th class="num">QTY</th></tr></thead>
            <tbody>
              ${grouped.map((g, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td class="rp-po-cell">${ptEsc(g.po)}</td>
                  <td>${ptEsc(g.model)}</td>
                  <td>${ptEsc(g.colour)}</td>
                  <td class="ctr">${ptEsc(g.size)}</td>
                  <td class="num"><strong>${g.qty}</strong></td>
                </tr>`).join('')}
            </tbody>
            <tfoot><tr><td colspan="5">TOTAL</td><td class="num">${total}</td></tr></tfoot>
          </table>
        </div>
      ` : `
        <div class="pt-empty"><i class="fa-solid fa-inbox"></i><p>${emptyText}</p></div>
      `}
    </div>
  `;
}

/* Suggestion chips (multi matches / recent plans) */
function renderSuggestions(container, names, heading) {
  container.innerHTML = `
    <div class="pt-section">
      <div class="pt-section-head">
        <div class="pt-section-icon amber"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
        <div class="pt-section-title-wrap">
          <div class="pt-section-title">${ptEsc(heading)}</div>
          <div class="pt-section-sub">Pick one to track its pipeline</div>
        </div>
        <span class="rp-count-pill"><i class="fa-solid fa-list"></i> ${names.length}</span>
      </div>
      <div class="pt-suggest-list">
        ${names.map(n => `
          <button class="pt-btn pt-btn-chip" onclick="ptTrackByName('${ptEsc(n).replace(/'/g, "\'")}')">
            <i class="fa-solid fa-route"></i> ${ptEsc(n)}
          </button>`).join('')}
      </div>
    </div>
  `;
}

/* Entry point used by suggestion chips */
async function ptTrackByName(name) {
  const resultsEl = document.getElementById('ptResults');
  if (!resultsEl) return;

  resultsEl.innerHTML = `
    <div class="pt-loading">
      <i class="fa-solid fa-spinner"></i>
      <p>Loading pipeline for ${ptEsc(name)}…</p>
    </div>
  `;

  try {
    const [mrnRaw, storseRaw, gfuRaw] = await Promise.all([
      ptFetchSheet('mrn'),
      ptFetchSheet('storseOut'),
      ptFetchSheet('gfuOut'),
    ]);
    const mrn = mrnRaw.find(r => ptNorm(r['MRN_Name']) === ptNorm(name)) || null;
    await ptTrack(resultsEl, name, mrn, storseRaw, gfuRaw);
  } catch (err) {
    resultsEl.innerHTML = `
      <div class="pt-error-box">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <span>${ptEsc(err.message)}</span>
      </div>
    `;
  }
}

console.log('[SOLE MATRIX] Plan Tracker module loaded');