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

  /* Pin the proxy to the page's FULL origin (absolute URL) when it lives on
     the same host — raw relative paths are rejected instantly by some
     Android Chrome builds. */
  function sameOrigin(url) {
    try {
      const u = new URL(url, window.location ? location.href : 'https://invalid.local');
      if (window.location && u.origin === location.origin) return u.origin + u.pathname + u.search;
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

  /* ── XMLHttpRequest fallback transport ─────────────────────────────
     Some Android Chrome builds reject EVERY fetch() instantly (0.0s
     "TypeError: Failed to fetch") even for clean minimal requests on
     mobile data. XHR drives an older, separate native path in the
     Android network stack and is NOT affected by that rejection.
     Returns the slice of the fetch Response API callers use:
     { ok, status, json() }. */
  function xhrPost(url, body, headers, timeoutMs) {
    return new Promise((resolve, reject) => {
      let xhr;
      try { xhr = new XMLHttpRequest(); } catch (e) { reject(e); return; }
      let done = false;
      let timer = null;
      const finish = (fn, val) => {
        if (done) return;
        done = true;
        if (timer) clearTimeout(timer);
        fn(val);
      };
      timer = setTimeout(() => {
        const err = new Error('XHR request timed out after ' + Math.round((timeoutMs || 65000) / 1000) + 's.');
        err.name = 'AbortError';
        try { xhr.abort(); } catch (_) { /* ignore */ }
        finish(reject, err);
      }, timeoutMs || 65000);
      xhr.onload = () => {
        finish(resolve, {
          ok: xhr.status >= 200 && xhr.status < 300,
          status: xhr.status,
          json: () => {
            try { return Promise.resolve(JSON.parse(xhr.responseText)); }
            catch (_) { return Promise.resolve({}); }
          },
        });
      };
      xhr.onerror = () => finish(reject, new TypeError('XHR network error (Failed to fetch via XMLHttpRequest).'));
      xhr.onabort = () => { const err = new Error('XHR request aborted.'); err.name = 'AbortError'; finish(reject, err); };
      try {
        xhr.open('POST', url, true);
        if (headers) Object.keys(headers).forEach((k) => { try { xhr.setRequestHeader(k, headers[k]); } catch (_) { /* drop unsupported header */ } });
        xhr.send(body);
      } catch (e) { finish(reject, e); }
    });
  }

  /* True when the transport died with a NETWORK-level failure.
     We previously required the rejection to land within 250 ms
     (the original Android instant-fetch signature), but real
     carrier connections often take noticeably longer to fail,
     and the same network-stack bug can fire from XMLHttpRequest
     after a few seconds. We now accept ANY TypeError or XHR
     network error — if fetch/XHR died before producing a
     response, the CF Worker edge endpoint is the only path
     that uses a different network stack. */
  function networkFailure(e) {
    if (!e) return false;
    if (e.name === 'TypeError') return true;            /* fetch + XHR both throw TypeError on network failure */
    if (e.name === 'AbortError') return true;          /* our own XHR timeout */
    const m = String(e && e.message || '').toLowerCase();
    if (m.indexOf('xhr network error') > -1) return true;
    if (m.indexOf('failed to fetch') > -1) return true;
    if (m.indexOf('networkerror') > -1) return true;
    return false;
  }
  /* Backwards-compat alias used by other modules (mrn.js, solly-ai.js).
     Now ignores timing — the original 250 ms gate is what caused the
     CF Worker fallback to be skipped on real mobile networks where the
     XHR TypeError takes longer to surface. */
  function instantTypeReject(e, _sinceMs) { return networkFailure(e); }

  /* Short label for the CF Worker URL used in console diagnostics. */
  function CF_URL_NAME(u) {
    try { return new URL(u).host; } catch (_) { return 'cloudflare-worker'; }
  }

  async function geminiRequest(model, payload) {
    const t = geminiTarget(model);
    const body = t.wrap(payload);
    /* Cloudflare Worker edge endpoint — secondary fallback. Triggered on
       ANY network-level failure (TypeError, XHR network error, AbortError
       from our XHR timeout) regardless of how long it took to surface.
       Real mobile carriers can take seconds to fail; the original 250 ms
       timing gate skipped this fallback entirely on production phones. */
    const cfWorker = (window.CONFIG && CONFIG.OPENROUTER_CLOUDFLARE_WORKER_URL) || '';
    const t0 = Date.now();
    let res;
    try {
      res = await fetch(t.url, { method: 'POST', headers: t.headers, body: body, cache: 'no-store', credentials: 'omit', redirect: 'follow' });
    } catch (e) {
      /* network-level rejection (fetch died before producing a response) ->
         retry with the plainest possible request, regardless of timing */
      if (networkFailure(e)) {
        console.warn('[GEMINI] fetch network failure (' + ((Date.now() - t0) / 1000).toFixed(1) + 's) - retrying with clean minimal fetch');
        const t1 = Date.now();
        try {
          res = await fetch(t.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body });
        } catch (e2) {
          /* the clean fetch also failed at the network level -> send the
             exact same request over XMLHttpRequest, which Android Chrome
             routes through a different native network-stack path */
          if (networkFailure(e2)) {
            console.warn('[GEMINI] clean fetch also failed (' + ((Date.now() - t1) / 1000).toFixed(1) + 's) - retrying over XMLHttpRequest');
            try {
              res = await xhrPost(t.url, body, { 'Content-Type': 'application/json' }, 65000);
            } catch (e3) {
              /* XHR ALSO died at the network level -> final fallback: Cloudflare
                 Worker edge endpoint, which uses a completely different network
                 stack and is NOT affected by the same Android fetch/XHR rejection.
                 Trigger on ANY network failure (not just sub-250 ms) and pass the
                 exact same body & headers through. */
              if (cfWorker && networkFailure(e3)) {
                console.warn('[GEMINI] XHR also failed - retrying over Cloudflare Worker (' + CF_URL_NAME(cfWorker) + ')');
                res = await fetch(cfWorker, { method: 'POST', headers: t.headers, body: body, cache: 'no-store', credentials: 'omit', redirect: 'follow' });
              } else { throw e3; }
            }
          } else { throw e2; }
        }
      } else { throw e; }
    }
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
