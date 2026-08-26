/* Functional test for the Android fetch-rejection XHR fallback.
   Stubs a browser where fetch() ALWAYS rejects instantly (0.0s TypeError,
   the Android engine-level rejection) while XMLHttpRequest works — then
   verifies gemini-client.js still completes its request via the XHR path.
   Also asserts the fallback markers exist in all three client files. */
const fs = require('fs');
const ROOT = 'd:/LN Web/sole-matrix';

/* ── browser stubs ── */
global.window = { CONFIG: { GEMINI_PROXY_URL: 'https://test.local/api/gemini' } };
global.CONFIG = global.window.CONFIG;   /* client reads the bare global too */
global.location = { origin: 'https://test.local', href: 'https://test.local/management-dashboard.html' };
global.navigator = { onLine: true };

let fetchCalls = 0;
let xhrCalls = 0;
let xhrShouldFail = false;
global.fetch = async () => {
  fetchCalls++;
  throw new TypeError('Failed to fetch');   /* instant engine rejection */
};
global.XMLHttpRequest = class {
  open(m, u) { this.method = m; this.url = u; }
  setRequestHeader(k, v) { this.headers = this.headers || {}; this.headers[k] = v; }
  abort() {}
  send(body) {
    xhrCalls++;
    const self = this;
    setTimeout(() => {
      if (xhrShouldFail) {
        if (self.onerror) self.onerror();
        return;
      }
      self.status = 200;
      self.responseText = JSON.stringify({ choices: [{ message: { content: 'xhr-ok' } }], via: 'xhr', echoBytes: body.length });
      if (self.onload) self.onload();
    }, 5);
  }
};

let pass = true;
function check(name, cond) {
  console.log((cond ? 'PASS ✓' : 'FAIL ✗') + '  ' + name);
  if (!cond) pass = false;
}

(async () => {
  /* ── 1. functional: gemini-client falls back fetch -> clean fetch -> XHR ── */
  try {
    eval(fs.readFileSync(ROOT + '/assets/js/gemini-client.js', 'utf8'));
    const out = await window.geminiRequest('test-model', { hello: 'world' });
    check('geminiRequest resolves via XHR when fetch rejects instantly', out && out.via === 'xhr' && out.choices[0].message.content === 'xhr-ok');
    check('fetch attempted twice (rich + clean) before XHR', fetchCalls === 2);
    check('XHR attempted once after both fetches failed', xhrCalls === 1);
  } catch (e) {
    check('geminiRequest resolves via XHR when fetch rejects instantly (threw: ' + e.message + ')', false);
  }

  /* ── 2. functional: when XHR also fails, the error propagates (no hang) ── */
  try {
    fetchCalls = xhrCalls = 0;
    xhrShouldFail = true;
    await window.geminiRequest('test-model', { hello: 'world' });
    check('error propagates when XHR also fails', false);
  } catch (e) {
    check('error propagates when XHR also fails', e.name === 'TypeError' && xhrCalls === 1);
  }

  /* ── 3. source markers in all three clients ── */
  const solly = fs.readFileSync(ROOT + '/assets/js/solly-ai.js', 'utf8');
  const gemini = fs.readFileSync(ROOT + '/assets/js/gemini-client.js', 'utf8');
  const mrn = fs.readFileSync(ROOT + '/assets/js/mrn.js', 'utf8');
  const all = [solly, gemini, mrn];
  all.forEach((src, i) => {
    const name = ['solly-ai.js', 'gemini-client.js', 'mrn.js'][i];
    check(name + ' defines xhrPost transport', src.indexOf('function xhrPost') > -1);
    check(name + ' defines instantTypeReject detector', src.indexOf('function instantTypeReject') > -1);
    check(name + ' wires the XHR retry into its fetch catch', /instantTypeReject\(/.test(src) && /xhrPost\(/.test(src));
  });
  check('solly-ai logs the XHR retry', solly.indexOf('retrying same request over XMLHttpRequest') > -1);
  check('mrn logs the XHR retry', mrn.indexOf('retrying over XMLHttpRequest') > -1);
  check('gemini logs the XHR retry', gemini.indexOf('retrying over XMLHttpRequest') > -1);

  console.log('XHR FALLBACK TEST:', pass ? 'PASS ✓' : 'FAIL ✗');
  process.exitCode = pass ? 0 : 1;
})();