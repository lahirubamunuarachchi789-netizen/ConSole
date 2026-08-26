/* Smoke-test solly-ai.js in Node: stub the browser globals, evaluate the
   whole IIFE and verify it initialises without throwing (widget build is
   deferred because readyState stays 'loading'). Also verifies the new
   mobile-diagnostics helpers are present in the source. */
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
    describeFetchError: src.indexOf('function describeFetchError') > -1,
    retryLogic: src.indexOf('netAttempt') > -1 && src.indexOf('45000') > -1,
    offlineGuard: src.indexOf('navigator.onLine === false') > -1,
    fetchTabTimeout: src.indexOf('fetchWithTimeout(full, { method: \'GET\'') > -1,
    sameOriginCollapse: src.indexOf('function sameOriginUrl') > -1 && src.indexOf('sameOriginUrl((window.CONFIG') > -1,
    simpleRequest: src.indexOf("text/plain;charset=UTF-8") > -1,
    fetchOptions: src.indexOf("credentials: 'omit'") > -1 && src.indexOf("cache: 'no-store'") > -1,
  };
  console.log('SOLLY SMOKE →', JSON.stringify(checks, null, 1));
  const pass = checks.evaluates && checks.SOLLY_LOADED && checks.publicApi &&
               checks.describeFetchError && checks.retryLogic && checks.offlineGuard &&
               checks.fetchTabTimeout && checks.sameOriginCollapse && checks.simpleRequest && checks.fetchOptions;
  console.log('SOLLY SMOKE TEST:', pass ? 'PASS ✓' : 'FAIL ✗');
  process.exitCode = pass ? 0 : 1;
} catch (e) {
  console.error('SOLLY SMOKE TEST: FAIL ✗ —', e.message);
  process.exitCode = 1;
}