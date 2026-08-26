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

  /* Collapse a proxy URL to a relative path when it lives on the same host
     that serves this page — keeps the request same-origin (no CORS, no
     preflight) no matter how the phone reached the site. */
  function sameOrigin(url) {
    try {
      const u = new URL(url, window.location ? location.href : 'https://invalid.local');
      if (window.location && u.origin === location.origin) return u.pathname + u.search;
    } catch (e) { /* keep absolute */ }
    return url;
  }

  function geminiTarget(model) {
    const proxy = (window.CONFIG && CONFIG.GEMINI_PROXY_URL) || '';
    if (proxy) {
      /* text/plain = CORS "simple request" (no OPTIONS preflight); the
         proxy parses the raw JSON body regardless of Content-Type. */
      const headers = { 'Content-Type': 'text/plain;charset=UTF-8' };
      if (CONFIG.GEMINI_PROXY_TOKEN) headers['x-proxy-token'] = CONFIG.GEMINI_PROXY_TOKEN;
      return { url: sameOrigin(proxy), headers: headers, wrap: function (p) { return JSON.stringify({ model: model, payload: p }); } };
    }
    return {
      url: 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': (window.CONFIG && CONFIG.GEMINI_API_KEY) || '' },
      wrap: function (p) { return JSON.stringify(p); },
    };
  }

  async function geminiRequest(model, payload) {
    const t = geminiTarget(model);
    const res = await fetch(t.url, { method: 'POST', headers: t.headers, body: t.wrap(payload), cache: 'no-store', credentials: 'omit', redirect: 'follow' });
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
