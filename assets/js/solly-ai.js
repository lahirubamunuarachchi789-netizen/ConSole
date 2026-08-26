/* ═══════════════════════════════════════════════════════════════
   SOLE MATRIX — "Solly" AI Data Assistant
   Concord Footwear (Pvt) Ltd
   ─────────────────────────────────────────────────────────────
   Solly is a small circular, animated female AI avatar that sits
   on every department dashboard. Tap her to open a chat panel and
   ask questions about the live Google Sheet data. She answers via
   the Google Gemini API using real rows pulled from SheetBest.

   SHEETS SHE UNDERSTANDS
     1. Pending_MRN            → MRN requests raised by Outsole Production
     2. Storse To GFU Gatepass → Gatepasses from Stores → Outsole Prod (GFU)
     3. Storse Out             → Items scanned/issued out of Stores
     4. GFU Out                → Production output recorded at GFU
     5. Desma In Gatepass      → Gatepasses from Outsole Prod → Desma
     6. Planned                → Daily production plan (Plan QTY + Available Hours)

   FEATURES
     • Animated SVG female avatar (blinking, floating, talking)
     • Department-aware quick-question chips
     • Live sheet fetch with 60s cache + relevance-ranked context
     • Gemini 2.5 Flash with automatic model fallback
     • Mini markdown renderer (tables, lists, bold, code)
     • "Analyzed tabs" badge on every answer

   PUBLIC API (window.SollyAI)
     SollyAI.open() / .close() / .toggle() / .ask(question)
   ═══════════════════════════════════════════════════════════════ */

'use strict';

(function () {
  if (window.SOLLY_LOADED) return;
  window.SOLLY_LOADED = true;

  /* ═══════════════════════════════════════════════════════════
     CONSTANTS
     ═══════════════════════════════════════════════════════════ */
  const CACHE_TTL      = 60000;   // ms — sheet data cache
  const ROW_CAP        = 1000000; // uncapped — Solly receives EVERY row (OpenRouter high-context models)
  const ROW_CAP_BOOST  = 1000000; // uncapped — relevant tabs included in full
  const CELL_MAX       = 90;      // max chars per cell
  const JSON_MAX       = 220;     // max chars for summarized Rows_JSON

  const TABS = [
    { key: 'mrn',     label: 'Pending_MRN',            cfg: 'SHEETBEST_MRN_URL',                   desc: 'MRN (Material Request Note) records raised by Outsole Production. Rows_JSON holds per-model breakdowns (model, colour, sizes, totals).' },
    { key: 's2g',     label: 'Storse To GFU Gatepass', cfg: 'SHEETBEST_STORSE_TO_GFU_GATEPASS_URL', desc: 'Gatepasses issued from Stores to Outsole Production (GFU). Has Management + HR approval workflow columns and vehicle/driver assignment.' },
    { key: 'sout',    label: 'Storse Out',             cfg: 'SHEETBEST_STORESOUT_URL',              desc: 'Individual items scanned out of Stores against an MRN (QR scans: PO, Model, Outsole Colour, Size, QTY, verification).' },
    { key: 'gout',    label: 'GFU Out',                cfg: 'SHEETBEST_GFUOUT_URL',                 desc: 'Production output recorded at GFU (Outsole Production) against an MRN (QR scans with verification).' },
    { key: 'd2d',     label: 'Desma In Gatepass',      cfg: 'SHEETBEST_DESMA_IN_GATEPASS_URL',      desc: 'Gatepasses issued from Outsole Production to the Desma department, with approvals and transport assignment.' },
    { key: 'planned', label: 'Planned',                cfg: 'SHEETBEST_PLANNED_URL',                desc: 'Daily production plan — one row per date. Columns: Date (US format M/D/YYYY), "Planed QTY" (the sheet header is spelled with one N; it is the planned production quantity for that date) and "Available Hours" (production hours available that day).' },
  ];

  const DEPTS = {
    warehouse:  { name: 'Warehouse & Logistics', boost: ['s2g', 'sout', 'mrn'] },
    outsole:    { name: 'Outsole Production',    boost: ['mrn', 'sout', 'gout', 'planned'] },
    desma:      { name: 'Desma',                 boost: ['d2d', 'gout', 'planned'] },
    management: { name: 'Management',            boost: ['planned'] },
    hr:         { name: 'Human Resources (HR)',  boost: ['s2g', 'd2d'] },
    default:    { name: 'SOLE MATRIX',           boost: [] },
  };

  const CHIPS = {
    warehouse: [
      'How many pending MRNs are there?',
      'Which MRNs were created most recently?',
      'Summarise today\'s Storse Out scans',
      'Which gatepasses are waiting for approval?',
    ],
    outsole: [
      'What is today\'s GFU Out production total?',
      'Which models did we produce the most?',
      'Show the latest MRN and its grand total',
      'How many pairs were scanned out of Stores today?',
      'What is the plan QTY for today?',
    ],
    desma: [
      'Show today\'s Desma In gatepasses',
      'What arrived in Desma recently?',
      'Which gatepasses are pending transport?',
      'Summarise GFU Out for this week',
      'What is the planned QTY for tomorrow?',
    ],
    management: [
      'Give me an overview of all sheets',
      'Which gatepasses are pending approval?',
      'Production summary for the latest MRN',
      'How many MRNs, gatepasses and scans in total?',
      'What is the total planned QTY for this week?',
    ],
    hr: [
      'Which gatepasses are pending HR approval?',
      'Gatepasses approved by HR recently',
      'Which vehicles and drivers are assigned?',
      'Show the latest gatepass details',
    ],
    default: [
      'Give me an overview of all sheets',
      'How many pending MRNs are there?',
      'Show today\'s production activity',
      'What is today\'s plan QTY and available hours?',
    ],
  };

  /* ═══════════════════════════════════════════════════════════
     STATE
     ═══════════════════════════════════════════════════════════ */
  const S = {
    open: false, busy: false, greeted: false,
    cache: {}, cacheAt: 0, lastError: null,
    lastAnalyzed: [], dept: DEPTS.default, user: 'there',
    voiceOut: true, lang: 'en', listening: false, recog: null, uttering: false,
  };

  /* ═══════════════════════════════════════════════════════════
     STYLES (self-injected)
     ═══════════════════════════════════════════════════════════ */
  function injectStyles() {
    if (document.getElementById('sollyStyles')) return;
    const st = document.createElement('style');
    st.id = 'sollyStyles';
    st.textContent = `
/* ═══ SOLLY AI — WIDGET STYLES ═══ */
.solly-root{ position:fixed; right:22px; bottom:22px; z-index:999999;
  font-family:'Inter',system-ui,-apple-system,sans-serif; }

/* ── Floating avatar button ─────────────────────────────── */
.solly-fab{ position:relative; width:68px; height:68px; border-radius:50%;
  border:none; padding:0; cursor:pointer; background:transparent;
  -webkit-tap-highlight-color:transparent; }
.solly-fab-ring{ position:absolute; inset:0; border-radius:50%;
  background:conic-gradient(from 0deg,#22d3ee,#8b5cf6,#f472b6,#22d3ee);
  animation:sollySpin 6s linear infinite;
  filter:drop-shadow(0 0 12px rgba(99,102,241,.55)); }
.solly-fab-halo{ position:absolute; inset:-7px; border-radius:50%;
  border:2px solid rgba(34,211,238,.35); animation:sollyHalo 2.6s ease-out infinite; }
.solly-fab-core{ position:absolute; inset:4px; border-radius:50%; overflow:hidden;
  background:radial-gradient(circle at 30% 22%,#223059 0%,#0b1020 72%);
  display:flex; align-items:center; justify-content:center;
  box-shadow:inset 0 0 18px rgba(34,211,238,.15); }
.solly-fab-avatar{ width:82%; height:82%; animation:sollyFloat 3.6s ease-in-out infinite; }
.solly-fab-avatar svg{ width:100%; height:100%; display:block; }
.solly-fab-dot{ position:absolute; top:3px; right:3px; width:13px; height:13px;
  border-radius:50%; background:#22d3ee; border:2.5px solid #0b1020; }
.solly-fab-dot::after{ content:''; position:absolute; inset:-2px; border-radius:50%;
  border:2px solid #22d3ee; animation:sollyPing 1.8s ease-out infinite; }
.solly-fab-tip{ position:absolute; right:78px; top:50%; transform:translateY(-50%) translateX(8px);
  background:linear-gradient(135deg,#22d3ee,#8b5cf6); color:#fff; white-space:nowrap;
  font-size:.78rem; font-weight:700; padding:8px 14px; border-radius:12px 12px 2px 12px;
  opacity:0; pointer-events:none; transition:all .3s ease;
  box-shadow:0 6px 20px rgba(99,102,241,.4); }
.solly-fab:hover .solly-fab-tip{ opacity:1; transform:translateY(-50%) translateX(0); }
.solly-fab.thinking .solly-fab-ring{ animation-duration:1.1s; }
.solly-fab.thinking .solly-fab-avatar{ animation-duration:1s; }
.solly-fab.speaking .solly-fab-ring{ animation-duration:2.4s; }

/* ── Avatar SVG animations ──────────────────────────────── */
.solly-eyes{ animation:sollyBlink 4.8s infinite; transform-box:fill-box; transform-origin:center; }
.solly-mouth-talk{ opacity:0; transform-box:fill-box; transform-origin:center; }
.solly-speaking .solly-mouth-talk{ opacity:1; animation:sollyTalk .26s infinite alternate; }
.solly-speaking .solly-mouth-idle{ opacity:0; }
.solly-ear-dot{ animation:sollyDot 2.2s ease-in-out infinite; transform-box:fill-box; transform-origin:center; }
.solly-star{ animation:sollyTwinkle 3s ease-in-out infinite; transform-box:fill-box; transform-origin:center; }

/* ── Chat panel ─────────────────────────────────────────── */
.solly-chat{ position:absolute; right:0; bottom:84px; width:min(392px,calc(100vw - 28px));
  height:min(600px,calc(100vh - 130px)); display:flex; flex-direction:column;
  background:linear-gradient(160deg,rgba(17,24,42,.97),rgba(10,14,26,.97));
  border:1px solid rgba(99,102,241,.35); border-radius:22px;
  box-shadow:0 24px 70px rgba(0,0,0,.6),0 0 40px rgba(99,102,241,.18);
  backdrop-filter:blur(14px); overflow:hidden;
  opacity:0; transform:translateY(16px) scale(.96); pointer-events:none;
  transition:opacity .28s ease,transform .28s cubic-bezier(.34,1.4,.64,1); }
.solly-root.open .solly-chat{ opacity:1; transform:translateY(0) scale(1); pointer-events:auto; }
.solly-root.open .solly-fab-dot{ display:none; }

/* header */
.solly-head{ display:flex; align-items:center; gap:11px; padding:13px 15px;
  background:linear-gradient(135deg,rgba(34,211,238,.14),rgba(139,92,246,.16) 55%,rgba(244,114,182,.12));
  border-bottom:1px solid rgba(99,102,241,.3); flex-shrink:0; }
.solly-head-avatar{ width:44px; height:44px; border-radius:50%; flex-shrink:0;
  background:radial-gradient(circle at 30% 22%,#223059,#0b1020 75%);
  border:2px solid rgba(34,211,238,.5); overflow:hidden;
  box-shadow:0 0 14px rgba(34,211,238,.3); }
.solly-head-avatar svg{ width:100%; height:100%; display:block; }
.solly-head-meta{ flex:1; min-width:0; }
.solly-head-name{ display:flex; align-items:center; gap:7px; color:#f8fafc;
  font-size:1.02rem; font-weight:800; letter-spacing:.02em; }
.solly-head-name svg{ color:#22d3ee; }
.solly-head-status{ display:flex; align-items:center; gap:6px; margin-top:2px;
  color:#8fa3c8; font-size:.72rem; font-weight:600; }
.solly-status-dot{ width:7px; height:7px; border-radius:50%; background:#34d399;
  box-shadow:0 0 8px #34d399; animation:sollyDot 2s infinite; }
.solly-wave{ display:none; align-items:flex-end; gap:2.5px; height:14px; margin-left:2px; }
.solly-busy .solly-wave{ display:inline-flex; }
.solly-wave i{ width:3px; border-radius:2px; background:linear-gradient(180deg,#22d3ee,#8b5cf6);
  animation:sollyWave 1s ease-in-out infinite; }
.solly-wave i:nth-child(1){ height:6px; } .solly-wave i:nth-child(2){ height:12px; animation-delay:.15s; }
.solly-wave i:nth-child(3){ height:8px; animation-delay:.3s; } .solly-wave i:nth-child(4){ height:13px; animation-delay:.45s; }
.solly-head-btn{ width:31px; height:31px; border-radius:9px; border:1px solid rgba(148,163,184,.22);
  background:rgba(148,163,184,.08); color:#9fb2d6; cursor:pointer; flex-shrink:0;
  display:flex; align-items:center; justify-content:center; transition:all .2s; }
.solly-head-btn:hover{ background:rgba(34,211,238,.15); color:#22d3ee; border-color:rgba(34,211,238,.4); }

/* messages */
.solly-msgs{ flex:1; overflow-y:auto; padding:16px 14px 8px; display:flex;
  flex-direction:column; gap:12px; scroll-behavior:smooth; }
.solly-msgs::-webkit-scrollbar{ width:5px; }
.solly-msgs::-webkit-scrollbar-thumb{ background:rgba(99,102,241,.4); border-radius:4px; }
.solly-msg{ display:flex; gap:8px; max-width:88%; animation:sollyMsgIn .3s ease; }
.solly-msg.user{ align-self:flex-end; flex-direction:row-reverse; }
.solly-msg-ava{ width:28px; height:28px; border-radius:50%; flex-shrink:0; margin-top:2px;
  background:radial-gradient(circle at 30% 22%,#223059,#0b1020 78%);
  border:1.5px solid rgba(34,211,238,.45); overflow:hidden; }
.solly-msg-ava svg{ width:100%; height:100%; display:block; }
.solly-msg-bubble{ padding:10px 13px; border-radius:14px; font-size:.855rem;
  line-height:1.55; color:#dbe4f5; word-break:break-word; }
.solly-msg.ai .solly-msg-bubble{ background:rgba(99,102,241,.12);
  border:1px solid rgba(99,102,241,.28); border-radius:4px 14px 14px 14px; }
.solly-msg.user .solly-msg-bubble{ background:linear-gradient(135deg,#0891b2,#7c3aed);
  color:#fff; border-radius:14px 4px 14px 14px;
  box-shadow:0 4px 14px rgba(124,58,237,.3); }
.solly-msg-bubble strong{ color:#7dd3fc; }
.solly-msg-bubble em{ color:#f0abfc; }
.solly-msg-bubble code{ background:rgba(34,211,238,.14); color:#67e8f9;
  padding:1px 5px; border-radius:5px; font-size:.8em; font-family:'Consolas',monospace; }
.solly-msg-bubble pre{ background:#0a0f1e; border:1px solid rgba(99,102,241,.3);
  border-radius:10px; padding:10px 12px; overflow-x:auto; margin:7px 0; }
.solly-msg-bubble pre code{ background:none; padding:0; color:#a5f3fc; }
.solly-msg-bubble h3,.solly-msg-bubble h4{ margin:8px 0 4px; color:#7dd3fc; font-size:.9rem; }
.solly-msg-bubble ul,.solly-msg-bubble ol{ margin:5px 0; padding-left:19px; }
.solly-msg-bubble li{ margin:3px 0; }
.solly-msg-bubble table{ border-collapse:collapse; margin:8px 0; width:100%; font-size:.78rem; }
.solly-msg-bubble th{ background:rgba(34,211,238,.14); color:#7dd3fc; text-align:left; }
.solly-msg-bubble th,.solly-msg-bubble td{ border:1px solid rgba(99,102,241,.3);
  padding:5px 8px; }
.solly-msg-bubble tr:nth-child(even) td{ background:rgba(99,102,241,.07); }
.solly-msg-bubble .solly-md-table-wrap{ overflow-x:auto; }
.solly-badge{ display:inline-flex; align-items:center; gap:5px; margin-top:7px;
  padding:3px 9px; border-radius:20px; background:rgba(34,211,238,.1);
  border:1px solid rgba(34,211,238,.25); color:#67e8f9; font-size:.66rem; font-weight:700; }
.solly-msg-err .solly-msg-bubble{ border-color:rgba(248,113,113,.45);
  background:rgba(248,113,113,.1); }

/* typing */
.solly-typing{ display:flex; align-items:center; gap:8px; color:#8fa3c8; font-size:.76rem; }
.solly-typing-dots{ display:inline-flex; gap:4px; }
.solly-typing-dots i{ width:7px; height:7px; border-radius:50%;
  background:linear-gradient(135deg,#22d3ee,#8b5cf6); animation:sollyBounce 1.2s infinite; }
.solly-typing-dots i:nth-child(2){ animation-delay:.18s; }
.solly-typing-dots i:nth-child(3){ animation-delay:.36s; }

/* chips */
.solly-chips{ display:flex; gap:7px; padding:8px 13px; overflow-x:auto; flex-shrink:0;
  scrollbar-width:none; }
.solly-chips::-webkit-scrollbar{ display:none; }
.solly-chip{ flex-shrink:0; padding:7px 13px; border-radius:20px; cursor:pointer;
  background:rgba(99,102,241,.1); border:1px solid rgba(99,102,241,.35);
  color:#a5b4fc; font-size:.72rem; font-weight:600; font-family:inherit;
  transition:all .2s; white-space:nowrap; }
.solly-chip:hover{ background:rgba(34,211,238,.16); border-color:rgba(34,211,238,.5);
  color:#67e8f9; transform:translateY(-1px); }
.solly-chip:disabled{ opacity:.45; cursor:not-allowed; transform:none; }

/* input */
.solly-inputbar{ display:flex; align-items:center; gap:9px; padding:11px 13px;
  border-top:1px solid rgba(99,102,241,.25); flex-shrink:0;
  background:rgba(10,14,26,.6); }
.solly-input{ flex:1; background:rgba(148,163,184,.08); border:1px solid rgba(148,163,184,.22);
  border-radius:13px; padding:11px 14px; color:#f1f5f9; font-size:.85rem;
  font-family:inherit; outline:none; transition:border .2s; }
.solly-input::placeholder{ color:#5b6b8c; }
.solly-input:focus{ border-color:rgba(34,211,238,.55);
  box-shadow:0 0 0 3px rgba(34,211,238,.12); }
.solly-send{ width:42px; height:42px; border-radius:13px; border:none; cursor:pointer;
  flex-shrink:0; display:flex; align-items:center; justify-content:center;
  background:linear-gradient(135deg,#22d3ee,#8b5cf6); color:#fff;
  box-shadow:0 4px 14px rgba(99,102,241,.4); transition:all .2s; }
.solly-send:hover{ transform:translateY(-1px) scale(1.04); }
.solly-send:disabled{ opacity:.5; cursor:not-allowed; transform:none; }
.solly-foot{ text-align:center; padding:6px; font-size:.62rem; color:#4c5b7a;
  background:rgba(10,14,26,.6); flex-shrink:0; }
.solly-foot b{ background:linear-gradient(90deg,#22d3ee,#a78bfa);
  -webkit-background-clip:text; background-clip:text; color:transparent; }

/* ── Voice controls (mic / language / speaker) ──────────── */
.solly-lang-btn,.solly-mic-btn{ height:42px; border-radius:13px; flex-shrink:0;
  border:1px solid rgba(148,163,184,.22); background:rgba(148,163,184,.08);
  color:#9fb2d6; cursor:pointer; display:flex; align-items:center; justify-content:center;
  font-family:inherit; transition:all .2s; }
.solly-lang-btn{ min-width:46px; padding:0 9px; font-size:.72rem; font-weight:800; letter-spacing:.02em; }
.solly-mic-btn{ width:42px; }
.solly-lang-btn:hover,.solly-mic-btn:hover{ border-color:rgba(34,211,238,.5);
  color:#67e8f9; background:rgba(34,211,238,.12); }
.solly-mic-btn.listening{ background:linear-gradient(135deg,#f43f5e,#ec4899);
  color:#fff; border-color:transparent; animation:sollyMicPulse 1.2s ease-out infinite; }
.solly-head-btn.solly-mute-off{ color:#f87171; border-color:rgba(248,113,113,.4);
  background:rgba(248,113,113,.1); }
.solly-listening-tip{ display:none; align-items:center; gap:8px; padding:0 14px;
  color:#fda4af; font-size:.72rem; font-weight:700; flex-shrink:0; }
.solly-root.listening .solly-listening-tip{ display:flex; }
.solly-listening-tip .solly-typing-dots i{
  background:linear-gradient(135deg,#f43f5e,#ec4899); }

/* ── Keyframes ──────────────────────────────────────────── */
@keyframes sollySpin{ to{ transform:rotate(360deg); } }
@keyframes sollyFloat{ 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(-4px); } }
@keyframes sollyHalo{ 0%{ transform:scale(.9); opacity:.8; } 100%{ transform:scale(1.35); opacity:0; } }
@keyframes sollyPing{ 0%{ transform:scale(.6); opacity:1; } 100%{ transform:scale(1.9); opacity:0; } }
@keyframes sollyBlink{ 0%,91%,100%{ transform:scaleY(1); } 94%{ transform:scaleY(.06); } 97%{ transform:scaleY(1); } }
@keyframes sollyTalk{ from{ transform:scaleY(.45); } to{ transform:scaleY(1.3); } }
@keyframes sollyDot{ 0%,100%{ opacity:1; } 50%{ opacity:.45; } }
@keyframes sollyTwinkle{ 0%,100%{ transform:scale(1) rotate(0deg); opacity:.9; }
  50%{ transform:scale(1.35) rotate(18deg); opacity:.5; } }
@keyframes sollyWave{ 0%,100%{ transform:scaleY(.4); } 50%{ transform:scaleY(1); } }
@keyframes sollyMsgIn{ from{ opacity:0; transform:translateY(8px); } to{ opacity:1; transform:translateY(0); } }
@keyframes sollyBounce{ 0%,60%,100%{ transform:translateY(0); } 30%{ transform:translateY(-6px); } }
@keyframes sollyMicPulse{ 0%{ box-shadow:0 0 0 0 rgba(244,63,94,.55); }
  100%{ box-shadow:0 0 0 12px rgba(244,63,94,0); } }

@media (max-width:480px){
  .solly-root{ right:12px; bottom:12px; }
  .solly-chat{ right:-6px; bottom:78px; height:min(560px,calc(100vh - 110px)); }
}
@media (prefers-reduced-motion:reduce){
  .solly-fab-ring,.solly-fab-avatar,.solly-fab-halo,.solly-eyes,.solly-star{ animation:none !important; }
}`;
    document.head.appendChild(st);
  }

  /* ═══════════════════════════════════════════════════════════
     ANIMATED FEMALE AVATAR (pure SVG)
     ═══════════════════════════════════════════════════════════ */
  function avatarSVG(prefix) {
    return '<svg viewBox="0 0 120 120" aria-hidden="true">' +
      '<defs>' +
        '<linearGradient id="' + prefix + '-hair" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="#8b5cf6"/><stop offset=".55" stop-color="#6366f1"/><stop offset="1" stop-color="#22d3ee"/>' +
        '</linearGradient>' +
        '<linearGradient id="' + prefix + '-skin" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#ffe9d6"/><stop offset="1" stop-color="#ffd3ba"/>' +
        '</linearGradient>' +
        '<radialGradient id="' + prefix + '-cheek">' +
          '<stop offset="0" stop-color="#fb7185" stop-opacity=".5"/><stop offset="1" stop-color="#fb7185" stop-opacity="0"/>' +
        '</radialGradient>' +
      '</defs>' +
      /* back hair */
      '<path d="M60 13 C29 13 21 38 23 61 C24 79 30 93 38 101 L82 101 C90 93 96 79 97 61 C99 38 91 13 60 13 Z" fill="url(#' + prefix + '-hair)"/>' +
      /* shoulders */
      '<path d="M27 120 C29 102 44 95 60 95 C76 95 91 102 93 120 Z" fill="url(#' + prefix + '-hair)" opacity=".92"/>' +
      /* neck */
      '<path d="M50 82 h20 v12 a10 7 0 0 1 -20 0 Z" fill="#f5c3a8"/>' +
      /* face */
      '<ellipse cx="60" cy="60" rx="26" ry="27" fill="url(#' + prefix + '-skin)"/>' +
      /* bangs */
      '<path d="M34 53 C31 29 44 21 60 21 C76 21 89 29 86 53 C80 44 74 39 60 39 C46 39 40 44 34 53 Z" fill="url(#' + prefix + '-hair)"/>' +
      '<path d="M35 52 C37 40 43 33 51 31 C43 40 41 47 39 57 Z" fill="#7c3aed" opacity=".55"/>' +
      /* hair shine */
      '<path d="M43 29 C49 24 59 23 67 25" stroke="#fff" stroke-opacity=".35" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      /* eyes */
      '<g class="solly-eyes">' +
        '<ellipse cx="49" cy="62" rx="4.6" ry="5.6" fill="#312e51"/>' +
        '<circle cx="50.7" cy="60" r="1.7" fill="#fff"/>' +
        '<circle cx="47.3" cy="64.2" r=".95" fill="#67e8f9"/>' +
        '<path d="M44 55.5 q5 -4 10 -1" stroke="#312e51" stroke-width="1.7" fill="none" stroke-linecap="round"/>' +
        '<ellipse cx="71" cy="62" rx="4.6" ry="5.6" fill="#312e51"/>' +
        '<circle cx="72.7" cy="60" r="1.7" fill="#fff"/>' +
        '<circle cx="69.3" cy="64.2" r=".95" fill="#67e8f9"/>' +
        '<path d="M66 54.5 q5 -3 10 1" stroke="#312e51" stroke-width="1.7" fill="none" stroke-linecap="round"/>' +
      '</g>' +
      /* blush + nose */
      '<ellipse cx="43.5" cy="70" rx="5.2" ry="3.1" fill="url(#' + prefix + '-cheek)"/>' +
      '<ellipse cx="76.5" cy="70" rx="5.2" ry="3.1" fill="url(#' + prefix + '-cheek)"/>' +
      '<path d="M60 66 l-1.5 2.5 h3 Z" fill="#f0b096"/>' +
      /* mouth: idle smile + talking ellipse */
      '<path class="solly-mouth-idle" d="M55 73 q5 4.2 10 0" stroke="#e26d8a" stroke-width="2.1" fill="none" stroke-linecap="round"/>' +
      '<ellipse class="solly-mouth-talk" cx="60" cy="74" rx="3.4" ry="2.3" fill="#e26d8a"/>' +
      /* headset */
      '<path d="M31 57 C29 30 44 17 60 17 C76 17 91 30 89 57" stroke="#101830" stroke-width="5.5" fill="none" stroke-linecap="round" opacity=".9"/>' +
      '<rect x="25" y="53" width="10" height="17" rx="5" fill="#1e293b"/>' +
      '<rect x="85" y="53" width="10" height="17" rx="5" fill="#1e293b"/>' +
      '<circle class="solly-ear-dot" cx="30" cy="61.5" r="2.1" fill="#22d3ee"/>' +
      '<circle class="solly-ear-dot" cx="90" cy="61.5" r="2.1" fill="#22d3ee"/>' +
      /* mic boom */
      '<path d="M30 70 q4 8.5 12.5 9.5" stroke="#1e293b" stroke-width="2.5" fill="none" stroke-linecap="round"/>' +
      '<circle cx="44" cy="80" r="2.5" fill="#334155"/>' +
      /* glowing hair-clip star */
      '<g class="solly-star" transform="translate(85,35)">' +
        '<path d="M0 -5.5 L1.5 -1.5 L5.5 0 L1.5 1.5 L0 5.5 L-1.5 1.5 L-5.5 0 L-1.5 -1.5 Z" fill="#67e8f9"/>' +
      '</g>' +
    '</svg>';
  }

  /* ═══════════════════════════════════════════════════════════
     WIDGET BUILD
     ═══════════════════════════════════════════════════════════ */
  let els = {};
  function buildWidget() {
    injectStyles();
    const root = document.createElement('div');
    root.className = 'solly-root';
    root.id = 'sollyRoot';
    root.innerHTML =
      '<div class="solly-chat" role="dialog" aria-label="Solly AI chat">' +
        '<div class="solly-head">' +
          '<div class="solly-head-avatar">' + avatarSVG('sollyHead') + '</div>' +
          '<div class="solly-head-meta">' +
            '<span class="solly-head-name">Solly' +
              '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 14.4 7.2 16.9l.9-5.4L4.2 7.7l5.4-.8z"/></svg>' +
            '</span>' +
            '<span class="solly-head-status"><span class="solly-status-dot"></span>Online · OpenRouter AI' +
              '<span class="solly-wave"><i></i><i></i><i></i><i></i></span>' +
            '</span>' +
          '</div>' +
          '<button class="solly-head-btn" id="sollySpeakBtn" title="Voice replies: on" aria-label="Toggle voice replies"></button>' +
          '<button class="solly-head-btn" id="sollyClearBtn" title="Clear chat" aria-label="Clear chat">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M1 4v6h6"/><path d="M3.5 15a9 9 0 1 0 2.1-9.4L1 10"/></svg>' +
          '</button>' +
          '<button class="solly-head-btn" id="sollyCloseBtn" title="Close" aria-label="Close chat">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="solly-msgs" id="sollyMsgs"></div>' +
        '<div class="solly-chips" id="sollyChips"></div>' +
        '<div class="solly-listening-tip"><span class="solly-typing-dots"><i></i><i></i><i></i></span><span class="solly-listening-label">Listening… speak now</span></div>' +
        '<div class="solly-inputbar">' +
          '<button class="solly-lang-btn" id="sollyLangBtn" title="Voice language: English (tap to switch)">EN</button>' +
          '<button class="solly-mic-btn" id="sollyMicBtn" title="Speak to Solly" aria-label="Voice input">' +
            '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1"/><path d="M12 18v4"/></svg>' +
          '</button>' +
          '<input class="solly-input" id="sollyInput" type="text" autocomplete="off" placeholder="Ask me about your sheet data…"/>' +
          '<button class="solly-send" id="sollySendBtn" title="Send" aria-label="Send message">' +
            '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="solly-foot">Powered by <b>OpenRouter AI</b> · Live Google Sheets data</div>' +
      '</div>' +
      '<button class="solly-fab" id="sollyFab" aria-label="Chat with Solly AI">' +
        '<span class="solly-fab-halo"></span>' +
        '<span class="solly-fab-ring"></span>' +
        '<span class="solly-fab-core"><span class="solly-fab-avatar">' + avatarSVG('sollyFab') + '</span></span>' +
        '<span class="solly-fab-dot"></span>' +
        '<span class="solly-fab-tip">Hi! I\'m Solly ✨ Ask me anything</span>' +
      '</button>';
    document.body.appendChild(root);

    els = {
      root, fab: root.querySelector('#sollyFab'),
      chat: root.querySelector('.solly-chat'),
      msgs: root.querySelector('#sollyMsgs'),
      chips: root.querySelector('#sollyChips'),
      input: root.querySelector('#sollyInput'),
      send: root.querySelector('#sollySendBtn'),
      clear: root.querySelector('#sollyClearBtn'),
      close: root.querySelector('#sollyCloseBtn'),
      speakBtn: root.querySelector('#sollySpeakBtn'),
      langBtn: root.querySelector('#sollyLangBtn'),
      micBtn: root.querySelector('#sollyMicBtn'),
    };

    els.fab.addEventListener('click', toggle);
    els.close.addEventListener('click', close);
    els.clear.addEventListener('click', clearChat);
    els.send.addEventListener('click', () => submitInput());
    els.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitInput(); });
    els.speakBtn.addEventListener('click', toggleVoiceOut);
    els.langBtn.addEventListener('click', cycleLang);
    els.micBtn.addEventListener('click', toggleListening);
    if (!recognitionSupported()) els.micBtn.style.display = 'none';
    updateSpeakBtn();
    updateLangBtn();
    renderChips();
  }

  /* ═══════════════════════════════════════════════════════════
     OPEN / CLOSE / CHIPS
     ═══════════════════════════════════════════════════════════ */
  function open() {
    if (S.open) return;
    S.open = true;
    els.root.classList.add('open');
    els.fab.setAttribute('aria-expanded', 'true');
    setTimeout(() => els.input.focus(), 320);
    if (!S.greeted) { S.greeted = true; greet(); }
  }
  function close() {
    S.open = false;
    els.root.classList.remove('open');
    els.fab.setAttribute('aria-expanded', 'false');
    stopSpeaking();
    stopListening();
  }
  function toggle() { S.open ? close() : open(); }
  function clearChat() {
    stopSpeaking();
    els.msgs.innerHTML = '';
    S.greeted = false;
    greet();
  }

  function renderChips() {
    const list = (CHIPS[S.dept.key] || CHIPS.default).slice();
    list.push('🔄 Refresh sheet data');
    els.chips.innerHTML = '';
    list.forEach((c) => {
      const b = document.createElement('button');
      b.className = 'solly-chip';
      b.type = 'button';
      b.textContent = c;
      b.addEventListener('click', () => {
        if (S.busy) return;
        if (c.startsWith('🔄')) { refreshData(); return; }
        submitText(c);
      });
      els.chips.appendChild(b);
    });
  }

  /* ═══════════════════════════════════════════════════════════
     MESSAGE RENDERING
     ═══════════════════════════════════════════════════════════ */
  function addMessage(role, html, opts) {
    opts = opts || {};
    const wrap = document.createElement('div');
    wrap.className = 'solly-msg ' + role + (opts.isErr ? ' solly-msg-err' : '');
    if (role === 'ai') {
      wrap.innerHTML = '<div class="solly-msg-ava">' + avatarSVG('sollyMsg' + Date.now()) + '</div>' +
                       '<div class="solly-msg-bubble">' + html + '</div>';
    } else {
      wrap.innerHTML = '<div class="solly-msg-bubble">' + html + '</div>';
    }
    els.msgs.appendChild(wrap);
    scrollBottom();
    return wrap;
  }

  function addTyping(label) {
    const wrap = document.createElement('div');
    wrap.className = 'solly-msg ai';
    wrap.innerHTML = '<div class="solly-msg-ava">' + avatarSVG('sollyTyp') + '</div>' +
      '<div class="solly-msg-bubble"><span class="solly-typing">' +
      '<span class="solly-typing-dots"><i></i><i></i><i></i></span>' +
      '<span class="solly-typing-label"></span></span></div>';
    wrap.querySelector('.solly-typing-label').textContent = label || 'Thinking…';
    els.msgs.appendChild(wrap);
    scrollBottom();
    return wrap;
  }

  function setTypingLabel(wrap, label) {
    const el = wrap.querySelector('.solly-typing-label');
    if (el) el.textContent = label;
  }

  function resolveTyping(wrap, html, badge, isErr) {
    const bubble = wrap.querySelector('.solly-msg-bubble');
    if (!bubble) return;
    wrap.classList.remove('solly-msg-err');
    if (isErr) wrap.classList.add('solly-msg-err');
    bubble.innerHTML = html + (badge ? '<span class="solly-badge">📊 ' + badge + '</span>' : '');
    scrollBottom();
  }

  function scrollBottom() { els.msgs.scrollTop = els.msgs.scrollHeight; }

  function setThinking(on) {
    S.busy = on;
    els.fab.classList.toggle('thinking', on);
    els.chat.classList.toggle('solly-busy', on);
    els.send.disabled = on;
    els.input.disabled = on;
    els.chips.querySelectorAll('.solly-chip').forEach((c) => { c.disabled = on; });
  }

  function setSpeaking(ms) {
    els.fab.classList.add('speaking');
    els.chat.classList.add('solly-speaking');
    clearTimeout(setSpeaking._t);
    setSpeaking._t = setTimeout(() => {
      els.fab.classList.remove('speaking');
      els.chat.classList.remove('solly-speaking');
    }, ms);
  }

  /* ═══════════════════════════════════════════════════════════
     MINI MARKDOWN RENDERER
     ═══════════════════════════════════════════════════════════ */
  function escapeHtml(s) {
    /* Numeric character references built at runtime — immune to entity decoding */
    return String(s).replace(/[&<>"']/g, function (ch) {
      return '&#' + ch.charCodeAt(0) + ';';
    });
  }

  function inlineMd(s) {
    s = escapeHtml(s);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:#67e8f9;">$1</a>');
    return s;
  }

  function renderMarkdown(src) {
    const lines = String(src || '').replace(/\r/g, '').split('\n');
    let html = '', i = 0;
    const flushList = (type, items) => {
      if (!items.length) return;
      html += '<' + type + '>' + items.map((li) => '<li>' + li + '</li>').join('') + '</' + type + '>';
    };
    while (i < lines.length) {
      const line = lines[i];
      /* fenced code */
      if (/^\s*```/.test(line)) {
        const buf = []; i++;
        while (i < lines.length && !/^\s*```/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++;
        html += '<pre><code>' + escapeHtml(buf.join('\n')) + '</code></pre>';
        continue;
      }
      /* table */
      if (/^\s*\|.*\|\s*$/.test(line)) {
        const rows = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
          const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
          if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
          i++;
        }
        if (rows.length) {
          let t = '<div class="solly-md-table-wrap"><table>';
          rows.forEach((r, ri) => {
            t += '<tr>' + r.map((c) => (ri === 0 ? '<th>' : '<td>') + inlineMd(c) + (ri === 0 ? '</th>' : '</td>')).join('') + '</tr>';
          });
          html += t + '</table></div>';
        }
        continue;
      }
      /* headings */
      const h = line.match(/^\s*(#{1,4})\s+(.*)/);
      if (h) { html += '<h4>' + inlineMd(h[2]) + '</h4>'; i++; continue; }
      /* unordered list */
      if (/^\s*[-*•]\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
          items.push(inlineMd(lines[i].replace(/^\s*[-*•]\s+/, ''))); i++;
        }
        flushList('ul', items); continue;
      }
      /* ordered list */
      if (/^\s*\d+[.)]\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
          items.push(inlineMd(lines[i].replace(/^\s*\d+[.)]\s+/, ''))); i++;
        }
        flushList('ol', items); continue;
      }
      /* blank */
      if (!line.trim()) { i++; continue; }
      /* paragraph */
      const para = [];
      while (i < lines.length && lines[i].trim() &&
             !/^\s*(```|[-*•]\s|\d+[.)]\s|\||#{1,4}\s)/.test(lines[i])) {
        para.push(inlineMd(lines[i])); i++;
      }
      html += '<p>' + para.join('<br>') + '</p>';
    }
    return html;
  }

  /* ═══════════════════════════════════════════════════════════
     DATA LAYER — SheetBest fetch + cache
     ═══════════════════════════════════════════════════════════ */
  async function fetchTab(tab, force) {
    const hit = S.cache[tab.key];
    if (!force && hit && Date.now() - hit.t < CACHE_TTL) return hit.data;
    const url = tab.cfg === '__MAIN__' ? CONFIG.SHEETBEST_URL : CONFIG[tab.cfg];
    if (!url) throw new Error('Missing URL for ' + tab.label);
    const full = url + (url.indexOf('?') > -1 ? '&' : '?') + '_=' + Date.now();
    /* mobile networks drop requests silently — 20s timeout + one retry */
    let lastErr = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const t0 = Date.now();
      try {
        const res = await fetchWithTimeout(full, { method: 'GET', cache: 'no-store', credentials: 'omit', redirect: 'follow' }, 20000);
        if (!res.ok) throw new Error(tab.label + ': HTTP ' + res.status);
        const data = await res.json();
        console.log('[SOLLY] sheet "' + tab.label + '": ' + (Array.isArray(data) ? data.length : '?') + ' rows in ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
        S.cache[tab.key] = { t: Date.now(), data: Array.isArray(data) ? data : [] };
        S.cacheAt = Date.now();
        return S.cache[tab.key].data;
      } catch (e) {
        const d = describeFetchError(e, full);
        console.warn('[SOLLY] sheet "' + tab.label + '" attempt ' + attempt + ' FAILED [' + d.kind + '] - ' + d.detail);
        lastErr = new Error(tab.label + ': ' + (d.kind === 'TIMEOUT' ? 'timed out' : d.kind === 'OFFLINE' ? 'device offline' : 'network error'));
        if (attempt === 1 && d.kind !== 'OFFLINE') { await new Promise((r) => setTimeout(r, 1200)); continue; }
      }
    }
    throw lastErr;
  }

  async function fetchAll(force) {
    const results = await Promise.allSettled(TABS.map((t) => fetchTab(t, force)));
    const failed = [];
    results.forEach((r, idx) => { if (r.status === 'rejected') failed.push(TABS[idx].label); });
    S.lastError = failed.length ? failed.join(', ') : null;
    return failed;
  }

  function dataOf(key) { return (S.cache[key] && S.cache[key].data) || []; }

  function totalRecords() { return TABS.reduce((n, t) => n + dataOf(t.key).length, 0); }

  /* ═══════════════════════════════════════════════════════════
     CONTEXT BUILDER — relevance-ranked sheet snapshot
     ═══════════════════════════════════════════════════════════ */
  function colomboNow() { return new Date(Date.now() + (5.5 * 60 + new Date().getTimezoneOffset()) * 60000); }

  function dateTokens() {
    const d = colomboNow();
    const p = (n) => String(n).padStart(2, '0');
    const today = d.getDate() + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear();
    const us = (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear();   /* M/D/YYYY — Planned tab format */
    const y = new Date(d.getTime() - 86400000);
    const yest = y.getDate() + '/' + p(y.getMonth() + 1) + '/' + y.getFullYear();
    const tm = new Date(d.getTime() + 86400000);
    const tom = tm.getDate() + '/' + p(tm.getMonth() + 1) + '/' + tm.getFullYear();
    const tomUs = (tm.getMonth() + 1) + '/' + tm.getDate() + '/' + tm.getFullYear();
    return { today, yest, us, tom, tomUs, iso: d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) };
  }

  function extractTokens(q) {
    const tokens = new Set();
    (q.match(/[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)+/g) || []).forEach((t) => tokens.add(t.toLowerCase()));
    (q.match(/\b\d{4,}\b/g) || []).forEach((t) => tokens.add(t));
    (q.match(/\b\d{1,2}[\/\-.]\d{1,2}(?:[\/\-.]\d{2,4})?\b/g) || []).forEach((t) => tokens.add(t));
    (q.match(/"([^"]{3,60})"/g) || []).forEach((m) => tokens.add(m.slice(1, -1).toLowerCase()));
    const lower = q.toLowerCase();
    const dt = dateTokens();
    if (/\btoday\b/.test(lower)) { tokens.add(dt.today); tokens.add(dt.iso); tokens.add(dt.us); }
    if (/yesterday/.test(lower)) tokens.add(dt.yest);
    if (/tomorrow/.test(lower)) { tokens.add(dt.tom); tokens.add(dt.tomUs); }
    const stop = new Set(['what','when','where','which','how','many','much','show','tell','about','please','with','from','this','that','have','has','were','was','are','the','for','and','you','your','give','list','data','sheet','sheets','today','yesterday','status','total','count','summarize','summary','overview','there','is','it','its','all','any','currently','current','latest','recent','recently','pending','waiting','waiting']);
    (lower.match(/[a-z]{4,}/g) || []).forEach((w) => { if (!stop.has(w)) tokens.add(w); });
    return Array.from(tokens);
  }

  function scoreRow(row, tokens) {
    if (!tokens.length) return 0;
    const hay = JSON.stringify(row).toLowerCase();
    let s = 0;
    tokens.forEach((t) => { if (hay.indexOf(String(t).toLowerCase()) > -1) s += 3; });
    return s;
  }

  function cellText(v) {
    if (v === null || v === undefined) return '';
    let s = String(v);
    if (s.length > CELL_MAX) s = s.slice(0, CELL_MAX) + '…';
    return s.replace(/\s+/g, ' ').replace(/\|/g, '/');
  }

  function summarizeJSON(v) {
    const s = String(v === null || v === undefined ? '' : v);
    if (!s) return '';
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) {
        const out = arr.map((it) => {
          if (it && typeof it === 'object') {
            const m = it.model || it.Model || it.po || it.PO || '?';
            const c = it.color || it.Color || it.colour || it.Colour || '';
            const sz = it.sizes || it.Sizes || it.size || '';
            const t = (it.total !== undefined && it.total !== null) ? ' total=' + it.total : (it.qty !== undefined ? ' qty=' + it.qty : '');
            return m + (c ? '/' + c : '') + (sz ? ' sizes[' + sz + ']' : '') + t;
          }
          return String(it);
        }).join(' ;; ');
        return out.length > JSON_MAX ? out.slice(0, JSON_MAX) + '…' : out;
      }
    } catch (e) { /* not JSON */ }
    return s.length > JSON_MAX ? s.slice(0, JSON_MAX) + '…' : s;
  }

  function buildContext(question) {
    const tokens = extractTokens(question);
    const lowerQ = question.toLowerCase();
    const dt = dateTokens();

    /* Assemble the snapshot at a given per-tab row cap. Called repeatedly
       with shrinking caps until the snapshot fits CTX_MAX_CHARS (keeps
       requests inside Groq free-tier TPM windows). */
    function assemble(cap, boostCap) {
      const parts = [];
      S.lastAnalyzed = [];

      /* overview header */
      parts.push('SHEET OVERVIEW (live snapshot):');
      TABS.forEach((t) => {
        const rows = dataOf(t.key);
        const todayCount = rows.filter((r) => JSON.stringify(r).indexOf(dt.today) > -1).length;
        parts.push('- ' + t.label + ': ' + rows.length + ' rows (' + todayCount + ' dated ' + dt.today + ')');
      });
      parts.push('Current date/time: ' + dt.today + ' (Asia/Colombo)');
      parts.push('');

      TABS.forEach((tab) => {
        const rows = dataOf(tab.key);
        if (!rows.length) { parts.push('### ' + tab.label + '\n(no rows)'); parts.push(''); return; }
        const boost = S.dept.boost.indexOf(tab.key) > -1;
        const mentioned = tab.label.toLowerCase().split(' ').some((w) => w.length > 3 && lowerQ.indexOf(w) > -1) ||
                          (tab.key === 'mrn' && /\bmrn\b/i.test(question)) ||
                          (tab.key === 's2g' && /stores?\s*(to)?\s*gfu|gatepass/i.test(question)) ||
                          (tab.key === 'gout' && /gfu|production\s*out/i.test(question)) ||
                          (tab.key === 'sout' && /stores?\s*out/i.test(question)) ||
                          (tab.key === 'd2d' && /desma/i.test(question)) ||
                          (tab.key === 'planned' && /\bplan(?:ned)?\b|\bqty\b|quantity|available\s+hours|production\s+plan/i.test(question));
        const c = (mentioned || boost) ? boostCap : cap;

        const scored = rows.map((r, idx) => ({ r, idx, sc: scoreRow(r, tokens) }));
        scored.sort((a, b) => (b.sc - a.sc) || (b.idx - a.idx));
        const picked = scored.slice(0, c).sort((a, b) => a.idx - b.idx);

        const headers = Object.keys(rows[0] || {});
        const lines = picked.map(({ r }) => headers.map((h) => {
          let v = r[h];
          if (/rows_json/i.test(h)) v = summarizeJSON(v); else v = cellText(v);
          return cellText(v);
        }).join(' | '));

        parts.push('### ' + tab.label + ' — ' + tab.desc);
        parts.push('(' + rows.length + ' rows total; showing ' + picked.length + ' most relevant, sheet order)');
        parts.push(headers.map(cellText).join(' | '));
        parts.push(lines.join('\n'));
        parts.push('');
        S.lastAnalyzed.push(tab.label + ' (' + picked.length + ')');
      });

      return parts.join('\n');
    }

    /* Full snapshot — no row caps, no truncation, no column dropping.
       OpenRouter free models carry up to 1M-token contexts, so Solly
       receives the complete data of every sheet tab. */
    return assemble(ROW_CAP, ROW_CAP_BOOST);
  }

  /* ═══════════════════════════════════════════════════════════
     GEMINI API
     ═══════════════════════════════════════════════════════════ */
  function systemPrompt() {
    const dt = dateTokens();
    return [
      'You are "Solly" — a friendly, sharp female AI data assistant for SOLE MATRIX, the production-tracking system of Concord Footwear (Pvt) Ltd (footwear outsole manufacturing).',
      'The user is currently on the "' + S.dept.name + '" dashboard' + (S.user && S.user !== 'there' ? ', logged in as ' + S.user : '') + '.',
      'Current date: ' + dt.today + ' (dd/mm/yyyy, Asia/Colombo timezone). ISO form: ' + dt.iso + '.',
      '',
      'SHEET DICTIONARY (the data you receive comes from these Google Sheet tabs):',
      TABS.map((t) => '• ' + t.label + ' → ' + t.desc).join('\n'),
      '',
      'WORKFLOW CONTEXT: The Planned tab is the daily production plan — each row is one date (US M/D/YYYY format) with "Planed QTY" (the quantity planned for that date; the header is spelled with one N in the sheet) and "Available Hours" (production hours available that day). Outsole Production raises MRNs (Pending_MRN). Stores issues items against MRNs (Storse Out) and creates gatepasses to send them to Outsole Production / GFU (Storse To GFU Gatepass). GFU records finished production output (GFU Out). Outsole Production then sends output to Desma via gatepass (Desma In Gatepass). Gatepasses need Management and/or HR approval and vehicle/driver assignment.',
      '',
      'RULES:',
      '1. Answer ONLY from the provided sheet data. Never invent numbers, names or rows.',
      '2. Compute counts, sums, totals and comparisons yourself from the rows when asked.',
      '3. Quote exact identifiers (MRN names, PO numbers, model numbers, gatepass names) when relevant.',
      '4. If the data does not contain the answer, say so honestly and suggest the closest thing you can see.',
      '5. Be concise and well-formatted: use markdown headings, bullet lists and tables. Bold key numbers.',
      '6. LANGUAGE: Reply in the SAME language the user writes or speaks in. You fluently support English, Sinhala (සිංහල) and Tamil (தமிழ்) — if the user asks in Sinhala, answer entirely in Sinhala script; if in Tamil, answer entirely in Tamil script; otherwise answer in English. Keep a warm, upbeat tone — a light emoji is fine, but stay professional.',
      '7. Dates in the sheet look like "22/08/2026" or ISO "2026-08-22"; times like "18:08:30". The Planned tab uses US format M/D/YYYY, e.g. "8/24/2026". Treat "today" as ' + dt.today + ' (US form ' + dt.us + ').',
    ].join('\n');
  }

  /* fetch with a hard timeout — mobile networks stall easily; without this
     a hung request spins forever. On timeout the model chain falls through
     to the next model. */
  async function fetchWithTimeout(url, options, timeoutMs) {
    /* AbortController is guarded: very old mobile engines throw on the
       constructor — degrade to a plain fetch instead of crashing. */
    let controller = null;
    try { controller = new AbortController(); } catch (_) { controller = null; }
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs || 120000) : null;
    const opts = Object.assign({}, options);
    if (controller) opts.signal = controller.signal;
    try {
      return await fetch(url, opts);
    } finally { if (timer) clearTimeout(timer); }
  }

  /* Classify a fetch failure — mobile networks fail in distinct ways and
     each needs a different message + strategy. */
  function describeFetchError(e, url) {
    const name = (e && e.name) || 'Error';
    if (typeof navigator !== 'undefined' && navigator.onLine === false)
      return { kind: 'OFFLINE', detail: 'Browser reports no internet connection (navigator.onLine = false).' };
    if (name === 'AbortError')
      return { kind: 'TIMEOUT', detail: 'Request aborted after the timeout - the connection stalled (typical on mobile networks).' };
    if (name === 'TypeError')
      return { kind: 'NETWORK', detail: 'Connection failed before/during the request (radio drop, DNS, TLS or carrier proxy). Target: ' + url };
    return { kind: 'ERROR', detail: name + ': ' + ((e && e.message) || e) };
  }

  /* Extract the NATIVE network error for UI display. Chrome populates the
     fetch TypeError's .cause with the real net error (e.g.
     "net::ERR_CONNECTION_RESET", "net::ERR_QUIC_PROTOCOL_ERROR",
     "net::ERR_BLOCKED_BY_CLIENT") — that string pinpoints the exact mobile
     failure instead of a generic message. */
  function nativeErrorText(e) {
    if (!e) return 'unknown';
    let s = (e.name || 'Error') + ': ' + (e.message || String(e));
    try {
      const c = e.cause;
      if (c) s += ' | cause: ' + (c.message || String(c));
    } catch (_) { /* ignore */ }
    return s;
  }

  /* Pin the proxy to the page's FULL origin (window.location.origin + path)
     when it lives on the same host. Absolute URL + default request mode —
     raw relative paths combined with mode:'same-origin' are rejected
     instantly (0.0s TypeError) by some Android Chrome builds. */
  function sameOriginUrl(url) {
    try {
      const u = new URL(url, window.location ? location.href : 'https://invalid.local');
      if (window.location && u.origin === location.origin) return u.origin + u.pathname + u.search;
    } catch (_) { /* keep the absolute URL */ }
    return url;
  }

  /* OpenRouter (OpenAI-compatible) via the backend proxy /api/openrouter.
     High-context free models → Solly receives the ENTIRE sheet snapshot:
     no row caps, no truncation, no column dropping.
     The API key lives ONLY in the server config — never in the browser.

     MOBILE RESILIENCE: on production the endpoint is same-origin, so CORS
     is never the problem — "Failed to fetch" on phones is a dropped radio
     or a stalled carrier connection. Strategy:
       • fail fast with a clear message when navigator.onLine is false
       • log payload size, endpoint, timing and failure class per attempt
       • retry the same model once after a QUICK network failure (<45s);
         long stalls move straight to the next model in the chain        */
  async function callOpenRouter(question, contextText) {
    const proxy = sameOriginUrl((window.CONFIG && CONFIG.OPENROUTER_PROXY_URL)
      || (window.CONFIG && CONFIG.GROQ_PROXY_URL ? CONFIG.GROQ_PROXY_URL.replace('/api/groq', '/api/openrouter') : '')
      || 'http://localhost:8787/api/openrouter');
    /* Model chain — on 404/429/503 fall through to the next free model. */
    const models = [];
    [(window.CONFIG && CONFIG.OPENROUTER_MODEL) || 'minimax/minimax-m3:free', 'google/gemma-4-31b-it:free', 'nvidia/nemotron-3.5-lightning:free']
      .forEach((m) => { if (m && models.indexOf(m) === -1) models.push(m); });
    /* text/plain keeps this a CORS "simple request" — no OPTIONS preflight.
       The proxy parses the raw JSON body regardless of Content-Type. */
    const headers = { 'Content-Type': 'text/plain;charset=UTF-8' };
    if (CONFIG.GEMINI_PROXY_TOKEN) headers['x-proxy-token'] = CONFIG.GEMINI_PROXY_TOKEN;

    console.log('[SOLLY] context: ' + contextText.length + ' chars (~' + Math.round(contextText.length / 1024) + ' KB)'
      + ' | endpoint: ' + proxy
      + ' | online: ' + navigator.onLine
      + ' | page origin: ' + (window.location ? location.origin : '?'));
    if (typeof navigator !== 'undefined' && navigator.onLine === false)
      throw new Error('Your device appears to be offline. Reconnect to the internet and try again.');

    let lastErr = null;
    for (const model of models) {
      const body = {
        model: model,
        messages: [
          { role: 'system', content: systemPrompt() },
          { role: 'user', content: 'LIVE SHEET DATA SNAPSHOT:\n\n' + contextText },
          { role: 'user', content: question },
        ],
        temperature: 0.35,
        stream: false,
      };
      const wire = JSON.stringify({ model: model, payload: body });
      /* attempt 1: rich options. attempt 2: the PLAINEST possible request —
         some Android Chrome builds reject rich fetch option combos instantly
         (0.0s TypeError before any bytes are sent), so the fallback strips
         every optional field and lets the browser use its default mode. */
      const fetchOpts = {
        method: 'POST',
        headers: headers,
        body: wire,
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'follow',
      };
      const cleanOpts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: wire };
      /* up to 2 attempts per model — quick network blips are retried,
         long stalls (server-side timeouts) move to the next model */
      for (let netAttempt = 1; netAttempt <= 2; netAttempt++) {
        const t0 = Date.now();
        const opts = netAttempt === 1 ? fetchOpts : cleanOpts;
        try {
          console.log('[SOLLY] -> ' + model + ' | attempt ' + netAttempt + (netAttempt === 2 ? ' (clean fallback)' : '') + ' | payload ' + wire.length + ' bytes');
          const res = await fetchWithTimeout(proxy, opts, 65000);
          const data = await res.json().catch(() => ({}));
          console.log('[SOLLY] <- ' + model + ' | HTTP ' + res.status + ' | ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
          if (!res.ok) {
            lastErr = new Error((data && data.error && data.error.message) || ('OpenRouter HTTP ' + res.status + ' (' + model + ')'));
            console.warn('[SOLLY] ' + model + ' rejected: ' + lastErr.message);
            break;   /* server refused - retrying the same model will not help */
          }
          const text = String((data?.choices?.[0]?.message?.content || '')).trim();
          if (!text) { lastErr = new Error('Empty response from ' + model + '.'); break; }
          return text;
        } catch (e) {
          const d = describeFetchError(e, proxy);
          const secs = ((Date.now() - t0) / 1000).toFixed(1);
          const native = nativeErrorText(e);
          console.error('[SOLLY] ' + model + ' attempt ' + netAttempt + ' FAILED [' + d.kind + '] after ' + secs + 's - ' + d.detail, e);
          /* the toast carries the NATIVE error (e.cause -> net::ERR_*) so the
             exact mobile failure is visible without remote debugging */
          lastErr = new Error(
            d.kind === 'OFFLINE' ? 'Your device is offline.' :
            d.kind === 'TIMEOUT' ? 'The AI request timed out (' + model + ').' :
            'Network error reaching the AI service (' + d.kind + ').' +
            ' [' + model + ' | ' + secs + 's | ' + wire.length + ' B] Native: ' + native);
          /* retry the same model only after a QUICK failure (radio blip);
             a long stall means the server/model is struggling - move on */
          if (netAttempt === 1 && d.kind !== 'OFFLINE' && (Date.now() - t0) < 45000) {
            await new Promise((r) => setTimeout(r, 1500));
            continue;
          }
          break;   /* next model */
        }
      }
    }
    throw (lastErr || new Error('OpenRouter is unavailable right now.'));
  }

  /* ═══════════════════════════════════════════════════════════
     VOICE ENGINE — Speech-to-Text (mic) + Text-to-Speech
     English · Sinhala (සිංහල) · Tamil (தமிழ்)
     ═══════════════════════════════════════════════════════════ */
  const LANGS = {
    en: { code: 'en-US', label: 'EN',    name: 'English' },
    si: { code: 'si-LK', label: 'සිං',   name: 'Sinhala' },
    ta: { code: 'ta-IN', label: 'தமிழ்', name: 'Tamil' },
  };

  const ICONS = {
    speakerOn: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor" stroke="none"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
    speakerOff: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor" stroke="none"/><path d="M22 9l-6 6"/><path d="M16 9l6 6"/></svg>',
  };

  let _voices = [];
  function loadVoices() {
    try { _voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : []; }
    catch (e) { _voices = []; }
  }
  if (window.speechSynthesis) {
    loadVoices();
    if (typeof window.speechSynthesis.onvoiceschanged !== 'undefined') {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  /* female-sounding voice names across Windows / Chrome / Android / macOS */
  const FEMALE_HINTS = ['female','samantha','zira','susan','hazel','heera','kalpana','karen','moira','tessa','fiona','veena','amala','swara','sarika','kumari','thilini','amara','aditi','raveena','priya','salli','joanna','kendra','kimberly','victoria','catherine','serena','allison','ava','nicky','lasha','gamlath','nirmala','shanthi','banu','yaalini','saranya','tharushi','dilini'];

  function pickVoice(langCode) {
    if (!_voices.length) loadVoices();
    if (!_voices.length) return null;
    const want = String(langCode || 'en-US').toLowerCase();
    const norm = (v) => String(v.lang || '').toLowerCase().replace('_', '-');
    const base = want.split('-')[0];
    let pool = _voices.filter((v) => norm(v) === want);
    if (!pool.length) pool = _voices.filter((v) => norm(v).split('-')[0] === base);
    if (!pool.length) pool = _voices;
    const female = pool.filter((v) => {
      const n = (v.name || '').toLowerCase();
      return FEMALE_HINTS.some((h) => n.indexOf(h) > -1) || /female|woman/.test(n);
    });
    return female[0] || pool[0];
  }

  /* detect answer language by Unicode script → pick matching TTS voice */
  function detectScriptLang(text) {
    if (/[\u0D80-\u0DFF]/.test(text)) return 'si';   /* Sinhala block */
    if (/[\u0B80-\u0BFF]/.test(text)) return 'ta';   /* Tamil block */
    return 'en';
  }

  /* strip markdown / emoji so the voice reads clean sentences */
  function stripForSpeech(md) {
    return String(md || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/^\s*\|.*\|\s*$/gm, ' ')
      .replace(/^\s*#{1,4}\s*/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1$2')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, ' ')
      .replace(/^\s*[-*•]\s*/gm, '')
      .replace(/^\s*\d+[.)]\s*/gm, '')
      .replace(/\s*\|\s*/g, ', ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function speak(text, langOverride) {
    if (!S.voiceOut || !window.speechSynthesis) return;
    stopSpeaking();
    const clean = stripForSpeech(text);
    if (!clean) return;
    const lang = langOverride || detectScriptLang(clean);
    const u = new SpeechSynthesisUtterance(clean.slice(0, 1200));
    const v = pickVoice((LANGS[lang] || LANGS.en).code);
    if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = (LANGS[lang] || LANGS.en).code; }
    u.pitch = 1.25;   /* brighter, feminine tone */
    u.rate  = 1.02;
    u.volume = 1;
    u.onstart = () => {
      S.uttering = true;
      els.fab.classList.add('speaking');
      els.chat.classList.add('solly-speaking');
    };
    const done = () => {
      S.uttering = false;
      els.fab.classList.remove('speaking');
      els.chat.classList.remove('solly-speaking');
    };
    u.onend = done;
    u.onerror = done;
    window.speechSynthesis.speak(u);
  }

  function stopSpeaking() {
    if (window.speechSynthesis) { try { window.speechSynthesis.cancel(); } catch (e) {} }
    S.uttering = false;
    if (els.fab) els.fab.classList.remove('speaking');
    if (els.chat) els.chat.classList.remove('solly-speaking');
  }

  function toggleVoiceOut() {
    S.voiceOut = !S.voiceOut;
    if (!S.voiceOut) stopSpeaking();
    updateSpeakBtn();
  }

  function updateSpeakBtn() {
    if (!els.speakBtn) return;
    els.speakBtn.classList.toggle('solly-mute-off', !S.voiceOut);
    els.speakBtn.title = 'Voice replies: ' + (S.voiceOut ? 'on' : 'off');
    els.speakBtn.innerHTML = S.voiceOut ? ICONS.speakerOn : ICONS.speakerOff;
  }

  /* ── Speech recognition (voice input) ────────────────────── */
  function recognitionSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  function toggleListening() {
    if (S.busy) return;
    S.listening ? stopListening() : startListening();
  }

  function startListening() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      addMessage('ai', 'Voice input isn\'t supported in this browser 😔 — please type your question instead.', { isErr: true });
      return;
    }
    stopSpeaking();
    if (S.recog) { try { S.recog.abort(); } catch (e) {} S.recog = null; }
    const r = new SR();
    r.lang = (LANGS[S.lang] || LANGS.en).code;
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.continuous = false;
    let finalText = '';
    r.onstart = () => {
      S.listening = true;
      els.micBtn.classList.add('listening');
      els.root.classList.add('listening');
      els.input.value = '';
      els.input.placeholder = 'Listening in ' + (LANGS[S.lang] || LANGS.en).name + '…';
      const lbl = els.root.querySelector('.solly-listening-label');
      if (lbl) lbl.textContent = 'Listening in ' + (LANGS[S.lang] || LANGS.en).name + '… speak now';
    };
    r.onresult = (ev) => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) finalText += t; else interim += t;
      }
      els.input.value = (finalText || interim).trim();
    };
    r.onerror = (ev) => {
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        addMessage('ai', 'Microphone access is blocked 🔒 — allow it in your browser to talk to me.', { isErr: true });
      }
      /* 'no-speech' and 'aborted' stay silent */
    };
    const finish = () => {
      stopListeningUI();
      S.recog = null;
      const q = (finalText || els.input.value || '').trim();
      if (q) submitText(q);
    };
    r.onend = () => { if (S.listening) finish(); };
    S.recog = r;
    try { r.start(); } catch (e) { stopListeningUI(); }
  }

  function stopListeningUI() {
    S.listening = false;
    if (els.micBtn) els.micBtn.classList.remove('listening');
    if (els.root) els.root.classList.remove('listening');
    if (els.input) els.input.placeholder = 'Ask me about your sheet data…';
  }

  function stopListening() {
    if (S.recog) {
      try { S.recog.onend = null; S.recog.stop(); } catch (e) {}
      S.recog = null;
    }
    stopListeningUI();
  }

  function cycleLang() {
    const order = ['en', 'si', 'ta'];
    S.lang = order[(order.indexOf(S.lang) + 1) % order.length];
    updateLangBtn();
  }

  function updateLangBtn() {
    if (!els.langBtn) return;
    const L = LANGS[S.lang] || LANGS.en;
    els.langBtn.textContent = L.label;
    els.langBtn.title = 'Voice language: ' + L.name + ' (tap to switch)';
  }

  /* ═══════════════════════════════════════════════════════════
     CHAT FLOW
     ═══════════════════════════════════════════════════════════ */
  async function greet() {
    const typing = addTyping('Connecting to Google Sheets…');
    try {
      const failed = await fetchAll(false);
      const n = totalRecords();
      const hello = 'Hi <strong>' + escapeHtml(S.user) + '</strong>! 👋 I\'m <strong>Solly</strong>, your SOLE MATRIX data assistant.' +
        '<br><br>I\'m connected to your Google Sheet — <strong>' + TABS.length + ' tabs, ' + n + ' live records</strong>' +
        (S.dept.key !== 'default' ? ', tuned for the <strong>' + escapeHtml(S.dept.name) + '</strong> department' : '') + '.' +
        '<br><br>Ask me anything about MRNs, gatepasses, Stores scans, production output or the daily plan (Plan QTY) — or tap a suggestion below. ✨';
      const badge = failed.length ? '⚠️ couldn\'t reach: ' + escapeHtml(failed.join(', ')) : '📊 All ' + TABS.length + ' tabs synced';
      resolveTyping(typing, hello, badge, !!failed.length);
      if (S.voiceOut) speak('Hi ' + S.user + '! I am Solly, your data assistant. Ask me anything about the sheet.');
      else setSpeaking(1600);
    } catch (e) {
      resolveTyping(typing,
        'I couldn\'t reach the Google Sheet right now 😔<br><span style="font-size:.78rem;color:#9aa3b5;">' +
        escapeHtml(e.message) + '</span><br><br>You can still chat with me — try the 🔄 chip to reconnect.', '', true);
    }
  }

  async function refreshData() {
    if (S.busy) return;
    setThinking(true);
    const typing = addTyping('Refreshing sheet data…');
    try {
      const failed = await fetchAll(true);
      const n = totalRecords();
      resolveTyping(typing, 'Fresh data loaded ✅ <strong>' + n + ' records</strong> across ' + TABS.length + ' tabs.' +
        (failed.length ? '<br><span style="color:#fca5a5;">Couldn\'t refresh: ' + escapeHtml(failed.join(', ')) + '</span>' : ''),
        '🔄 Synced ' + new Date().toLocaleTimeString('en-GB'), !!failed.length);
      setSpeaking(900);
    } catch (e) {
      resolveTyping(typing, 'Refresh failed: ' + escapeHtml(e.message), '', true);
    } finally { setThinking(false); }
  }

  async function submitText(text) {
    const q = String(text || '').trim();
    if (!q || S.busy) return;
    stopSpeaking();
    stopListening();
    els.input.value = '';   /* clear the box for both typed & voice-sent questions */
    addMessage('user', escapeHtml(q));
    setThinking(true);
    const typing = addTyping('Analyzing sheet data…');

    /* staggered status labels for a lively feel */
    const t1 = setTimeout(() => setTypingLabel(typing, 'Reading MRNs, gatepasses & scans…'), 1400);
    const t2 = setTimeout(() => setTypingLabel(typing, 'Thinking with OpenRouter…'), 3200);

    try {
      const stale = !S.cacheAt || (Date.now() - S.cacheAt > CACHE_TTL);
      if (stale) {
        setTypingLabel(typing, 'Fetching live sheet data…');
        await fetchAll(false);
      }
      const ctx = buildContext(q);
      const answer = await callOpenRouter(q, ctx);
      clearTimeout(t1); clearTimeout(t2);
      resolveTyping(typing, renderMarkdown(answer), '📊 Analyzed: ' + S.lastAnalyzed.join(' · '));
      if (S.voiceOut) speak(answer);
      else setSpeaking(1200 + Math.min(4200, answer.length * 9));
    } catch (e) {
      clearTimeout(t1); clearTimeout(t2);
      console.error('[SOLLY]', e);
      resolveTyping(typing,
        'Sorry ' + escapeHtml(S.user) + ', I hit a snag 😅<br><span style="font-size:.78rem;color:#fca5a5;">' +
        escapeHtml(e.message) + '</span><br><br>Try again, or tap 🔄 to refresh my sheet connection.', '', true);
    } finally {
      setThinking(false);
      els.input.focus();
    }
  }

  function submitInput() {
    const v = els.input.value.trim();
    if (!v) return;
    els.input.value = '';
    submitText(v);
  }

  /* ═══════════════════════════════════════════════════════════
     INIT
     ═══════════════════════════════════════════════════════════ */
  function detectDept() {
    const page = (location.pathname || '').toLowerCase();
    if (page.indexOf('warehouse') > -1) return DEPTS.warehouse;
    if (page.indexOf('outsole') > -1) return DEPTS.outsole;
    if (page.indexOf('desma') > -1) return DEPTS.desma;
    if (page.indexOf('management') > -1) return DEPTS.management;
    if (page.indexOf('hr') > -1) return DEPTS.hr;
    const d = (sessionStorage.getItem('sm_dept') || '').toLowerCase();
    for (const k of Object.keys(DEPTS)) {
      if (k !== 'default' && d.indexOf(k) > -1) return DEPTS[k];
    }
    return DEPTS.default;
  }

  function init() {
    if (typeof CONFIG === 'undefined' || (!CONFIG.OPENROUTER_PROXY_URL && !CONFIG.GEMINI_API_KEY && !CONFIG.GEMINI_PROXY_URL)) {
      console.warn('[SOLLY] CONFIG/AI not configured (no proxy URL or API key) — widget disabled.');
      return;
    }
    S.dept = detectDept();
    S.user = sessionStorage.getItem('sm_user') || 'there';
    buildWidget();

    /* one-time attention wiggle */
    setTimeout(() => {
      els.fab.style.transition = 'transform .5s ease';
      els.fab.style.transform = 'scale(1.12) rotate(-6deg)';
      setTimeout(() => { els.fab.style.transform = ''; }, 550);
    }, 2200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* Public API */
  window.SollyAI = { open, close, toggle, ask: (q) => { open(); submitText(q); } };
})();