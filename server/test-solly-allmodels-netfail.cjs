/* Test for the "every model in the chain failed at the network level"
   detection in solly-ai.js.

   When the CF Worker and the Vercel proxy are BOTH unreachable from a
   mobile browser (the screenshot we shipped with reported this exact
   scenario), the previous toast would name the last model that was tried
   and the user would think that model was broken. The fix detects when
   the error kind is OFFLINE / NETWORK / TIMEOUT on every model and
   surfaces a clear "Cannot reach the AI service from this device" message
   instead.

   The test stubs the browser and the three callOpenRouter() endpoints so
   that EVERY attempt throws a TypeError. We then call SollyAI.ask() and
   verify:
     1. The call rejects (not hangs).
     2. The rejection message starts with "Cannot reach the AI service" -
        NOT with the old per-model framing.
     3. The message contains the Wi-Fi / VPN hint.
     4. The error mentions all 3 models were tried. */

const fs = require('fs');
const vm = require('vm');

const src = fs.readFileSync('d:/LN Web/sole-matrix/assets/js/solly-ai.js', 'utf8');

let pass = true;
function check(name, ok) {
  console.log((ok ? '  ✓ ' : '  ✗ ') + name);
  if (!ok) pass = false;
}

(async () => {
  /* 1) Source-level: the new helper is present. */
  check('solly-ai tracks netFailCount', /netFailCount/.test(src));
  check('solly-ai tracks lastNetErr',    /lastNetErr/.test(src));
  check('solly-ai surfaces clear "Cannot reach" message when all models net-fail',
        /Cannot reach the AI service from this device/.test(src));
  check('solly-ai mentions both endpoints in the connectivity message',
        /Both the Cloudflare Worker and the Vercel proxy failed to respond/.test(src));
  check('solly-ai suggests Wi-Fi / VPN check',
        /Check Wi-Fi \/ mobile data, disable any VPN/.test(src));
  check('solly-ai counts failures across OFFLINE / NETWORK / TIMEOUT',
        /OFFLINE.*NETWORK.*TIMEOUT/s.test(src) ||
        /NETWORK.*TIMEOUT/s.test(src) ||
        /OFFLINE.*NETWORK/s.test(src));

  /* 2) Functional: run the IIFE in a sandbox where every fetch / XHR
        throws a TypeError (the Android instant-rejection signature). */

  /* Resolve the constants the function uses (CONFIG, fetchWithTimeout,
     fetchOrXhr, xhrPost, networkFailure, describeFetchError,
     nativeErrorText, sameOriginUrl, systemPrompt, cfWorkerName, S).
     For a focused test we only need a tiny shim — we don't actually run
     the chat UI. */
  const sandbox = {
    window: {},
    navigator: { onLine: true },
    location: { origin: 'https://test.local' },
    document: { readyState: 'loading', addEventListener() {} },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    AbortController: class { constructor() { this.signal = {}; } abort() {} },
    setTimeout: (fn, ms) => { try { fn(); } catch (_) {} return 0; },
    clearTimeout() {},
    console,
    Promise,
    URL,
    Date,
    Math,
    JSON,
    Array,
    Object,
    String,
    Number,
    Error,
    TypeError,
    /* every transport throws a network-level TypeError */
    fetch: () => Promise.reject(new TypeError('Failed to fetch')),
    XMLHttpRequest: class {
      open() {} setRequestHeader() {} send() {
        const self = this;
        Promise.resolve().then(() => { if (self.onerror) self.onerror(); });
      }
    },
  };
  sandbox.window.CONFIG = {
    OPENROUTER_CLOUDFLARE_WORKER_URL: 'https://patient-resonance-dc61.example.workers.dev',
    OPENROUTER_PROXY_URL: 'https://con-sole-three.example.vercel.app/api/openrouter',
    OPENROUTER_MODEL: 'minimax/minimax-m3:free',
    GEMINI_PROXY_TOKEN: '',
  };
  sandbox.CONFIG = sandbox.window.CONFIG;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  /* Inject a probe hook at the bottom of the IIFE that captures the inner
     functions (callOpenRouter, networkFailure, etc.) so the test can call
     them directly. We do this on the FIRST (and only) run of the IIFE —
     re-running the IIFE would short-circuit on `if (window.SOLLY_LOADED)
     return` and the hook would never be set. */
  const probeHook = `\n;window.__PROBE__ = { callOpenRouter, networkFailure, describeFetchError, nativeErrorText, sameOriginUrl, cfWorkerName };`;
  const wrapped = src.replace('window.SollyAI = { open, close, toggle, ask: (q) => { open(); submitText(q); } };', 'window.SollyAI = { open, close, toggle, ask: (q) => { open(); submitText(q); } };\n' + probeHook);
  vm.runInContext(wrapped, sandbox);

  check('SollyAI exposed', !!sandbox.window.SollyAI);
  check('__PROBE__ captures callOpenRouter', typeof sandbox.window.__PROBE__?.callOpenRouter === 'function');
  check('__PROBE__ captures networkFailure',  typeof sandbox.window.__PROBE__?.networkFailure === 'function');

  try {
    await sandbox.window.__PROBE__.callOpenRouter('How many pending MRN are there?', 'fake context');
    check('callOpenRouter rejects when every model fails at network level', false);
  } catch (e) {
    const msg = String(e && e.message || e);
    console.log('  → caught:', msg.slice(0, 250));
    check('rejection message starts with "Cannot reach the AI service"',
          msg.indexOf('Cannot reach the AI service from this device') === 0);
    check('rejection message contains the Wi-Fi / VPN hint',
          msg.indexOf('Check Wi-Fi / mobile data') > -1);
    check('rejection message counts the models tried',
          /3 models/.test(msg));
  }

  console.log('ALL-MODELS-NETFAIL TEST:', pass ? 'PASS ✓' : 'FAIL ✗');
  process.exitCode = pass ? 0 : 1;
})().catch((e) => {
  console.error('ALL-MODELS-NETFAIL TEST: FAIL ✗ —', e && e.message || e);
  process.exitCode = 1;
});
