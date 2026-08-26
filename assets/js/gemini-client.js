/* ═══════════════════════════════════════════════════════════════
   SOLE MATRIX — Shared Gemini client (browser side)
   ───────────────────────────────────────────────────────────────
   Routes Gemini calls through the backend proxy when
   CONFIG.GEMINI_PROXY_URL is set (recommended — keeps the API key
   off the client). Falls back to the legacy direct-browser call
   when no proxy is configured.

   Exposes:
     window.geminiTarget(model)            -> { url, headers, wrap(payload) }
     window.geminiRequest(model, payload)  -> Promise<upstream JSON>

   Load AFTER config.js and BEFORE solly-ai.js / mrn.js / warehouse.js.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function geminiTarget(model) {
    const proxy = (window.CONFIG && CONFIG.GEMINI_PROXY_URL) || '';
    if (proxy) {
      const headers = { 'Content-Type': 'application/json' };
      if (CONFIG.GEMINI_PROXY_TOKEN) headers['x-proxy-token'] = CONFIG.GEMINI_PROXY_TOKEN;
      return { url: proxy, headers: headers, wrap: function (p) { return JSON.stringify({ model: model, payload: p }); } };
    }
    return {
      url: 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': (window.CONFIG && CONFIG.GEMINI_API_KEY) || '' },
      wrap: function (p) { return JSON.stringify(p); },
    };
  }

  async function geminiRequest(model, payload) {
    const t = geminiTarget(model);
    const res = await fetch(t.url, { method: 'POST', headers: t.headers, body: t.wrap(payload) });
    const data = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      const err = new Error((data && data.error && data.error.message) || ('HTTP ' + res.status));
      err.status = res.status;
      throw err;
    }
    return data;
  }

  window.geminiTarget = geminiTarget;
  window.geminiRequest = geminiRequest;
})();
