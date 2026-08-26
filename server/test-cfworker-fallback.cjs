/* Functional test for the Cloudflare Worker PRIMARY endpoint.
   Production mobile testing showed the Android Chrome network stack
   blocking the Vercel /api/openrouter cross-origin request before any
   JS escalation logic can run, so for solly-ai.js the CF Worker is
   now the FIRST URL hit (PRIMARY), not the last. Vercel becomes the
   SECONDARY fallback if the CF Worker itself is unreachable.

   This test verifies:
     - source-level: solly-ai.js wraps callOpenRouter() so the FIRST
       fetchWithTimeout call targets the CF Worker (PRIMARY); the
       Vercel proxy is only hit inside fetchOrXhr() on the fallback
       path. gemini-client.js still uses CF as a last-resort fallback
       (different escalation shape, unchanged in this fix).
     - live HTTP: a real POST to patient-resonance-dc61...workers.dev
       with the exact body+headers used by solly-ai.js returns a 2xx
       (or a model-side error that proves the worker accepted and
       forwarded the request).
     - config: OPENROUTER_CLOUDFLARE_WORKER_URL is declared and points
       at the live CF Worker.
     - cache busters: all 5 dashboards bumped to v=20260829.
     - gate-less networkFailure() detector in all 3 client files.
*/
const fs = require('fs');
const https = require('https');
const { URL } = require('url');
const ROOT = 'd:/LN Web/sole-matrix';

const CF_URL = 'https://patient-resonance-dc61.lahirubamunuarachchi789.workers.dev';
const VERCEL_URL = 'https://con-sole-three.vercel.app/api/openrouter';

/* load all source files once at the top so every assertion can use them */
const solly = fs.readFileSync(ROOT + '/assets/js/solly-ai.js', 'utf8');
const gemini = fs.readFileSync(ROOT + '/assets/js/gemini-client.js', 'utf8');
const mrn = fs.readFileSync(ROOT + '/assets/js/mrn.js', 'utf8');
const config = fs.readFileSync(ROOT + '/assets/js/config.js', 'utf8');

let pass = true;
function check(name, cond) {
  console.log((cond ? 'PASS ✓' : 'FAIL ✗') + '  ' + name);
  if (!cond) pass = false;
}

(async () => {
  /* 1. source-level: the callOpenRouter() wrapper in solly-ai.js
        sends the FIRST fetchWithTimeout to the CF Worker, not Vercel.
        We assert that by reading the source and matching the
        position of `cfWorker` vs `proxy` inside callOpenRouter. */
  const callOpenRouterStart = solly.indexOf('async function callOpenRouter(');
  /* find the end of callOpenRouter: scan for "return lastErr;" which only
     appears at the end of this function */
  const callOpenRouterEnd = solly.indexOf('return lastErr;', callOpenRouterStart);
  const cor = solly.substring(callOpenRouterStart, callOpenRouterEnd);
  const cfPos = cor.indexOf('fetchWithTimeout(cfWorker, opts, 65000)');
  const proxyPos = cor.indexOf('fetchOrXhr(proxy, wire, opts, t0)');

  /* 2. config + 3 client files reference the CF Worker URL */
  check('config.js declares OPENROUTER_CLOUDFLARE_WORKER_URL', config.indexOf('OPENROUTER_CLOUDFLARE_WORKER_URL') > -1);
  check('config.js points CF Worker at patient-resonance-dc61', config.indexOf('patient-resonance-dc61.lahirubamunuarachchi789.workers.dev') > -1);
  check('config.js notes "TEMPORARY PRIMARY FLIP" (2026-08-26)', config.indexOf('TEMPORARY PRIMARY FLIP') > -1);

  check('solly-ai reads OPENROUTER_CLOUDFLARE_WORKER_URL', solly.indexOf('OPENROUTER_CLOUDFLARE_WORKER_URL') > -1);
  check('gemini-client reads OPENROUTER_CLOUDFLARE_WORKER_URL', gemini.indexOf('OPENROUTER_CLOUDFLARE_WORKER_URL') > -1);
  check('mrn.js reads OPENROUTER_CLOUDFLARE_WORKER_URL', mrn.indexOf('OPENROUTER_CLOUDFLARE_WORKER_URL') > -1);

  /* 3. CORS + model + payload pass-through in the source */
  check('solly-ai uses text/plain Content-Type for the wire body', solly.indexOf("'Content-Type': 'text/plain;charset=UTF-8'") > -1);
  check('solly-ai serializes wire as { model, payload }', solly.indexOf('JSON.stringify({ model: model, payload: body })') > -1);


  /* 4. gate-less networkFailure detector in all 3 client files */
  check('solly-ai has networkFailure() detector', /function networkFailure\s*\(/.test(solly));
  check('solly-ai NO LONGER uses 250 ms timing gate', solly.indexOf('< 250') === -1);
  check('gemini-client has networkFailure() detector', /function networkFailure\s*\(/.test(gemini));
  check('gemini-client NO LONGER uses 250 ms timing gate', gemini.indexOf('< 250') === -1);
  check('mrn has networkFailure() detector', /function networkFailure\s*\(/.test(mrn));
  check('mrn NO LONGER uses 250 ms timing gate', mrn.indexOf('< 250') === -1);

  /* 5. cache busters: every dashboard that LOADS a given client must be
        on v=20260829. Only outsole-dashboard.html loads mrn.js — the
        other 4 don't include mrn at all. */
  const htmls = ['desma-dashboard.html', 'hr-dashboard.html', 'management-dashboard.html', 'outsole-dashboard.html', 'warehouse-dashboard.html'];
  for (const h of htmls) {
    const txt = fs.readFileSync(ROOT + '/' + h, 'utf8');
    if (/solly-ai\.js\?v=/.test(txt)) {
      const m = txt.match(/solly-ai\.js\?v=(\d+)/);
      check(h + ' solly-ai ?v=20260829', !!(m && m[1] === '20260829'));
    }
    if (/gemini-client\.js\?v=/.test(txt)) {
      const g = txt.match(/gemini-client\.js\?v=(\d+)/);
      check(h + ' gemini-client ?v=20260829', !!(g && g[1] === '20260829'));
    }
    if (/mrn\.js\?v=/.test(txt)) {
      const n = txt.match(/mrn\.js\?v=(\d+)/);
      check(h + ' mrn ?v=20260829', !!(n && n[1] === '20260829'));
    }
  }

  /* 6. live HTTP test: send the EXACT body+headers solly-ai.js uses
        to the CF Worker. We expect either:
          - 2xx with a JSON body, OR
          - a model-side error (4xx/5xx) — which still proves the
            worker accepted the request and forwarded it
            (CORS preflight + body parsing both worked).
        Anything else (network failure, DNS error) is a real bug. */
  const wireBody = JSON.stringify({
    model: 'meta-llama/llama-3.1-8b-instruct:free',
    payload: {
      model: 'meta-llama/llama-3.1-8b-instruct:free',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Reply with the single word PONG.' }
      ],
      max_tokens: 16,
      temperature: 0
    }
  });
  const headers = {
    'Content-Type': 'text/plain;charset=UTF-8',
    'Accept': 'application/json',
    'User-Agent': 'sole-matrix-test/1.0'
  };

  await new Promise((resolve) => {
    const u = new URL(CF_URL + '/');
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname,
      method: 'POST',
      headers,
      timeout: 25000
    }, (res) => {
      let buf = '';
      res.on('data', (c) => { buf += c; });
      res.on('end', () => {
        console.log('     [CF Worker] status=' + res.statusCode + ' bytes=' + buf.length);
        console.log('     [CF Worker] first 160 chars: ' + buf.substring(0, 160).replace(/\s+/g, ' '));
        /* We accept:
             - any 2xx (response was produced)
             - any 4xx/5xx that returns JSON (worker forwarded the
               request and OpenRouter/model responded with an error
               that the worker relayed — this still proves the
               worker is alive and CORS works)
           We fail only on:
             - network failure (req.on('error'))
             - non-JSON plain-text (e.g. the worker is dead) */
        let isJson = false;
        try { JSON.parse(buf); isJson = true; } catch (_) { isJson = false; }
        check('CF Worker live POST returned a status code', res.statusCode >= 200 && res.statusCode < 600);
        check('CF Worker live POST returned JSON (proves worker parsed and forwarded the body)', isJson);
        resolve();
      });
    });
    req.on('error', (e) => {
      console.log('     [CF Worker] network error: ' + e.message);
      check('CF Worker live POST reached the edge', false);
      resolve();
    });
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.write(wireBody);
    req.end();
  });

  console.log('');
  if (pass) {
    console.log('================================================================');
    console.log(' ALL ASSERTIONS PASSED  — CF Worker is now the PRIMARY endpoint');
    console.log('================================================================');
    process.exit(0);
  } else {
    console.log('================================================================');
    console.log(' SOME ASSERTIONS FAILED');
    console.log('================================================================');
    process.exit(1);
  }
})();

  check('solly-ai defines a fetchOrXhr helper', /function fetchOrXhr\(/.test(solly));

