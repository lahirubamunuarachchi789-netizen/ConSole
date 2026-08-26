/* ═══════════════════════════════════════════════════════════════
   SOLE MATRIX — Configuration
   Concord Footwear (Pvt) Ltd
   ═══════════════════════════════════════════════════════════════ */

const CONFIG = {
  // ─── SheetBest API ─────────────────────────────────────────────
  SHEETBEST_URL:          'https://api.sheetbest.com/sheets/dd583123-5c7c-4279-8303-2aea56b7c8aa',
  SHEETBEST_MRN_URL:      'https://api.sheetbest.com/sheets/dd583123-5c7c-4279-8303-2aea56b7c8aa/tabs/Pending_MRN',
  SHEETBEST_STORESOUT_URL:'https://api.sheetbest.com/sheets/dd583123-5c7c-4279-8303-2aea56b7c8aa/tabs/Storse Out',
  SHEETBEST_GFUOUT_URL:   'https://api.sheetbest.com/sheets/dd583123-5c7c-4279-8303-2aea56b7c8aa/tabs/GFU Out',
  SHEETBEST_STORSE_TO_GFU_GATEPASS_URL:'https://api.sheetbest.com/sheets/dd583123-5c7c-4279-8303-2aea56b7c8aa/tabs/Storse To GFU Gatepass',
  SHEETBEST_DESMA_IN_GATEPASS_URL:    'https://api.sheetbest.com/sheets/dd583123-5c7c-4279-8303-2aea56b7c8aa/tabs/Desma In Gatepass',
  SHEETBEST_DESMA_RETURN_GATEPASS_URL:'https://api.sheetbest.com/sheets/dd583123-5c7c-4279-8303-2aea56b7c8aa/tabs/Desma Return Gatepass',
  SHEETBEST_WP_URL:                   'https://api.sheetbest.com/sheets/dd583123-5c7c-4279-8303-2aea56b7c8aa/tabs/WP',
  SHEETBEST_PLANNED_URL:              'https://api.sheetbest.com/sheets/dd583123-5c7c-4279-8303-2aea56b7c8aa/tabs/Planned',

  // ─── Sheet column headers (must match row 1 exactly) ───────────
  COL_USERNAME:    'User',
  COL_PASSWORD:    'Password',
  COL_DEPARTMENT:  'Department',

  // ─── Gemini AI ─────────────────────────────────────────────────
  /* SECURITY: credentials now live ONLY on the backend proxy
     (server/config.local.json — gitignored). The browser calls the
     proxy via gemini-client.js; keep GEMINI_API_KEY empty.
     See server/README.md to run:  node server/gemini-proxy.mjs      */
  GEMINI_API_KEY:   '',
  GEMINI_MODEL:     'gemini-3.6-flash',
  GEMINI_ENDPOINT:  'https://generativelanguage.googleapis.com/v1beta/models',
  GEMINI_PROXY_URL: 'https://con-sole-three.vercel.app/api/gemini',
  GEMINI_PROXY_TOKEN: '',

  /* ─── Groq AI — Llama 3.3 70B (Solly chat) ─────────────────────
     Solly talks through the proxy's /api/groq route (OpenAI-style
     chat/completions). The key lives ONLY in the proxy's server
     config (gitignored) — never in the browser.
     Note: Groq chat models are text-only, so MRN/warehouse document
     vision stays on the Gemini route above.                        */
  GROQ_PROXY_URL:   'https://con-sole-three.vercel.app/api/groq',
  GROQ_MODEL:     'openai/gpt-oss-120b',

  /* ─── OpenRouter AI (Solly chat) ───────────────────────────────
     High-context free models → Solly receives the ENTIRE sheet
     snapshot (no row caps, no trimming, no column dropping).
     Key lives ONLY in the proxy's server config — never in the
     browser.

     SECONDARY FALLBACK — Cloudflare Worker (mobile-resilient):
       When the primary proxy (same-origin /api/openrouter) is
       unreachable due to mobile carrier rejections or Android
       instant fetch TypeErrors that also hit XHR, the CF Worker
       at patient-resonance-dc61.lahirubamunuarachchi789.workers.dev
       provides a completely independent edge endpoint that routes
       the exact same request to OpenRouter.                      */
  OPENROUTER_PROXY_URL: 'https://con-sole-three.vercel.app/api/openrouter',
  OPENROUTER_CLOUDFLARE_WORKER_URL: 'https://patient-resonance-dc61.lahirubamunuarachchi789.workers.dev',
  OPENROUTER_MODEL:     'minimax/minimax-m3:free',

  // ─── Cloudinary ────────────────────────────────────────────────
  CLOUDINARY_CLOUD_NAME:   'rzqjocgj',
  CLOUDINARY_API_KEY:      '356798211163198',
  CLOUDINARY_API_SECRET:   'SzZQZoHwYs9zkZ5hmrGHI9OLY14',
  CLOUDINARY_UPLOAD_PRESET: 'sole_matrix_unsigned', // create an unsigned preset named this in Cloudinary dashboard
  CLOUDINARY_FOLDER:        'sole-matrix/pending-mrn',

  // ─── App settings ──────────────────────────────────────────────
  APP_NAME:        'SOLE MATRIX',
  COMPANY:         'Concord Footwear (Pvt) Ltd',
  VERSION:         '1.0.0',
  DASHBOARD_URL:          'dashboard.html',
  OUTSOLE_DASHBOARD_URL:  'outsole-dashboard.html',
  WAREHOUSE_DASHBOARD_URL:'warehouse-dashboard.html',
  REQUEST_TIMEOUT: 15000,
};
