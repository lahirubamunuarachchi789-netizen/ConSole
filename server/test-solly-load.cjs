/* Smoke-test solly-ai.js in Node: stub the browser globals, evaluate the
   whole IIFE and verify it initialises without throwing (widget build is
   deferred because readyState stays 'loading'). Also verifies the clean
   single-proxy design plus the mobile-resilience features: a warm-up GET,
   a per-attempt timeout, a REAL network-failure retry inside the catch
   (the old one was dead code — fetch() throws, it never resolves falsy),
   and a clear message when every model fails at the connection level.  */
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
    simpleProxyFetch: src.indexOf('fetchWithTimeout(proxy,') > -1,
    /* mobile resilience: warm-up ping, per-attempt timeout, REAL retry */
    warmUpPing: src.indexOf('warm-up ping') > -1,
    perAttemptTimeout: src.indexOf('}, 45000)') > -1,
    realRetry: /catch \(netErr\)[\s\S]{0,600}retrying with a bare POST/.test(src),
    bareRetryIsSimpleRequest: /bare POST[\s\S]{0,400}text\/plain;charset=UTF-8/.test(src),
    allModelsNetFailHint: src.indexOf('every model failed at the connection level') > -1,
  };
  console.log('SOLLY SMOKE →', JSON.stringify(checks, null, 1));
  const pass = checks.evaluates && checks.SOLLY_LOADED && checks.publicApi &&
               checks.describesError && checks.offlineGuard &&
               checks.fetchTabTimeout && checks.sameOriginCollapse && checks.simpleRequest &&
               checks.fetchOptions && checks.nativeError && checks.originAbsolute &&
               checks.abortGuard && checks.noCloudflare && checks.noXhr &&
               checks.noXhrRetryLog && checks.simpleProxyFetch &&
               checks.warmUpPing && checks.perAttemptTimeout && checks.realRetry &&
               checks.bareRetryIsSimpleRequest && checks.allModelsNetFailHint;
  console.log('SOLLY SMOKE TEST:', pass ? 'PASS ✓' : 'FAIL ✗');
  process.exitCode = pass ? 0 : 1;
} catch (e) {
  console.error('SOLLY SMOKE TEST: FAIL ✗ —', e.message);
  process.exitCode = 1;
}