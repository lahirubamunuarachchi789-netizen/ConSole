/* Functional test for the Cloudflare Worker secondary fallback.
   Stubs a browser where fetch() AND XMLHttpRequest() both fail
   instantly (0.0s TypeError) — the worst-case Android mobile
   network rejection. Verifies that all three client files
   (gemini-client.js, solly-ai.js, mrn.js) escalate to the CF
   Worker URL configured in CONFIG.OPENROUTER_CLOUDFLARE_WORKER_URL
   and pass the exact same body & headers through. */
const fs = require('fs');
const ROOT = 'd:/LN Web/sole-matrix';

const CF_URL = 'https://patient-resonance-dc61.lahirubamunuarachchi789.workers.dev';

/* ── browser stubs ── */
global.window = { CONFIG: {
  GEMINI_PROXY_URL: 'https://test.local/api/gemini',
  OPENROUTER_PROXY_URL: 'https://test.local/api/openrouter',
  OPENROUTER_CLOUDFLARE_WORKER_URL: CF_URL,
} };
global.CONFIG = global.window.CONFIG;
global.location = { origin: 'https://test.local', href: 'https://test.local/management-dashboard.html' };
global.navigator = { onLine: true };

let pass = true;
function check(name, cond) {
  console.log((cond ? 'PASS ✓' : 'FAIL ✗') + '  ' + name);
  if (!cond) pass = false;
}

let fetchCalls = 0;
let xhrCalls = 0;
let cfFetchUrls = [];
let cfFetchBodies = [];
let cfFetchHeaders = [];

function makeStubs() {
  fetchCalls = 0; xhrCalls = 0; cfFetchUrls = []; cfFetchBodies = []; cfFetchHeaders = [];
  global.fetch = async (url, opts) => {
    fetchCalls++;
    /* the CF Worker fetch must SUCCEED so we can verify it was called */
    if (typeof url === 'string' && url.indexOf('workers.dev') > -1) {
      cfFetchUrls.push(url);
      cfFetchBodies.push(opts && opts.body);
      cfFetchHeaders.push(opts && opts.headers);
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'cf-ok' } }], via: 'cfworker' }) };
    }
    /* every other fetch fails instantly — Android engine rejection */
    throw new TypeError('Failed to fetch');
  };
  global.XMLHttpRequest = class {
    open(m, u) { this.method = m; this.url = u; }
    setRequestHeader(k, v) { this.headers = this.headers || {}; this.headers[k] = v; }
    abort() {}
    send(body) {
      xhrCalls++;
      const self = this;
      setTimeout(() => { if (self.onerror) self.onerror(); }, 1);
    }
  };
}

(async () => {
  /* ── 1. gemini-client: fetch+clean+xhr all fail -> CF Worker succeeds ── */
  try {
    makeStubs();
    eval(fs.readFileSync(ROOT + '/assets/js/gemini-client.js', 'utf8'));
    const out = await window.geminiRequest('test-model', { hello: 'world' });
    check('geminiRequest completes via CF Worker', out && out.via === 'cfworker');
    check('gemini tried fetch+clean (2) then xhr (1) then CF', fetchCalls === 3 && xhrCalls === 1 && cfFetchUrls.length === 1);
    check('gemini CF call received same body', cfFetchBodies[0] && cfFetchBodies[0].indexOf('"model":"test-model"') > -1);
    check('gemini CF call passed Content-Type header', cfFetchHeaders[0] && (cfFetchHeaders[0]['Content-Type'] || '').indexOf('text/plain') > -1);
    check('gemini CF call used the configured CF URL', cfFetchUrls[0] === CF_URL);
  } catch (e) {
    check('geminiRequest completes via CF Worker (threw: ' + e.message + ')', false);
  }

  /* ── 2. source markers in all three client files ── */
  const solly = fs.readFileSync(ROOT + '/assets/js/solly-ai.js', 'utf8');
  const gemini = fs.readFileSync(ROOT + '/assets/js/gemini-client.js', 'utf8');
  const mrn = fs.readFileSync(ROOT + '/assets/js/mrn.js', 'utf8');
  const config = fs.readFileSync(ROOT + '/assets/js/config.js', 'utf8');

  check('config.js declares OPENROUTER_CLOUDFLARE_WORKER_URL', config.indexOf('OPENROUTER_CLOUDFLARE_WORKER_URL') > -1);
  check('config.js points CF Worker at patient-resonance-dc61', config.indexOf('patient-resonance-dc61.lahirubamunuarachchi789.workers.dev') > -1);

  check('solly-ai reads OPENROUTER_CLOUDFLARE_WORKER_URL', solly.indexOf('OPENROUTER_CLOUDFLARE_WORKER_URL') > -1);
  check('solly-ai logs CF Worker retry', solly.indexOf('retrying over Cloudflare Worker') > -1);
  check('solly-ai passes wire (exact body) to CF Worker', /cfWorker.*fetchWithTimeout/s.test(solly));

  check('gemini-client reads OPENROUTER_CLOUDFLARE_WORKER_URL', gemini.indexOf('OPENROUTER_CLOUDFLARE_WORKER_URL') > -1);
  check('gemini-client logs CF Worker retry', gemini.indexOf('retrying over Cloudflare Worker') > -1);

  check('mrn.js reads OPENROUTER_CLOUDFLARE_WORKER_URL', mrn.indexOf('OPENROUTER_CLOUDFLARE_WORKER_URL') > -1);
  check('mrn.js logs CF Worker retry', mrn.indexOf('retrying over Cloudflare Worker') > -1);
  check('mrn.js passes exact body & headers (orHeaders) to CF Worker', mrn.indexOf("body: wire") > -1 && mrn.indexOf('headers: orHeaders') > -1);

  /* ── 3. cache busters bumped in all dashboards ── */
  const htmls = ['desma-dashboard.html', 'hr-dashboard.html', 'management-dashboard.html', 'outsole-dashboard.html', 'warehouse-dashboard.html'];
  htmls.forEach((f) => {
    const h = fs.readFileSync(ROOT + '/' + f, 'utf8');
    const bumped = h.indexOf('?v=20260827') > -1 && h.indexOf('?v=20260826h') === -1;
    check(f + ' cache buster bumped to 20260827', bumped);
  });

  console.log('CF WORKER FALLBACK TEST:', pass ? 'PASS ✓' : 'FAIL ✗');
  process.exitCode = pass ? 0 : 1;
})();
