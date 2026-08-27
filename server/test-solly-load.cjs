/* Smoke-test solly-ai.js in Node: stub the browser globals, evaluate the
   whole IIFE and verify it initialises without throwing (widget build is
   deferred because readyState stays 'loading'). Also verifies the new
   clean single-proxy design in the source: solly talks straight to the
   same-origin Vercel /api/openrouter endpoint — no Cloudflare Worker and
   no XMLHttpRequest fallback stack. */
const fs = require('fs');
const src = fs.readFileSync('d:/LN Web/sole-matrix/assets/js/solly-ai.js', 'utf8');

/* stubs */
global.window = {};
global.navigator = { onLine: true };
global.location = { origin: 'https://test.local', pathname: '/management-dashboard.html' };
global.document = {
  readyState: 'loading',
  addEventListener() {},
  createElement() { return { style: {}, classList: { add() {}, remove() {} }, addEventListener() {}, setAttribute() {}, appendChild() {}, querySelector() { return null; } }; },
  body: { appendChild() {} },
};
global.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };

try {
  eval(src);
  const checks = {
    evaluates: true,
    SOLLY_LOADED: global.window.SOLLY_LOADED === true,
    publicApi: !!(global.window.SollyAI && global.window.SollyAI.ask),
    describesError: src.indexOf('function describeFetchError') > -1,
    offlineGuard: src.indexOf('navigator.onLine === false') > -1,
    fetchTabTimeout: src.indexOf('fetchWithTimeout(full, { method: \'GET\'') > -1,
    sameOriginCollapse: src.indexOf('function sameOriginUrl') > -1 && src.indexOf('sameOriginUrl((window.CONFIG') > -1,
    simpleRequest: src.indexOf("text/plain;charset=UTF-8") > -1,
    fetchOptions: src.indexOf("credentials: 'omit'") > -1 && src.indexOf("cache: 'no-store'") > -1,
    nativeError: src.indexOf('function nativeErrorText') > -1,
    originAbsolute: src.indexOf('u.origin + u.pathname + u.search') > -1,
    abortGuard: src.indexOf('try { controller = new AbortController(); }') > -1,
    /* the removed fallback stack must be GONE */
    noCloudflare: src.indexOf('OPENROUTER_CLOUDFLARE_WORKER_URL') === -1,
    noXhr: src.indexOf('function xhrPost') === -1 && src.indexOf('XMLHttpRequest') === -1,
    noXhrRetryLog: src.indexOf('retrying same request over XMLHttpRequest') === -1,
    simpleProxyFetch: src.indexOf('fetch(proxy, {') > -1 || src.indexOf('let res = await fetch(proxy, {') > -1,
  };
  console.log('SOLLY SMOKE →', JSON.stringify(checks, null, 1));
  const pass = checks.evaluates && checks.SOLLY_LOADED && checks.publicApi &&
               checks.describesError && checks.offlineGuard &&
               checks.fetchTabTimeout && checks.sameOriginCollapse && checks.simpleRequest &&
               checks.fetchOptions && checks.nativeError && checks.originAbsolute &&
               checks.abortGuard && checks.noCloudflare && checks.noXhr &&
               checks.noXhrRetryLog && checks.simpleProxyFetch;
  console.log('SOLLY SMOKE TEST:', pass ? 'PASS ✓' : 'FAIL ✗');
  process.exitCode = pass ? 0 : 1;
} catch (e) {
  console.error('SOLLY SMOKE TEST: FAIL ✗ —', e.message);
  process.exitCode = 1;
}