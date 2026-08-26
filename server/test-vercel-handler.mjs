/* Test the Vercel serverless handler locally (no deployment needed).
   Keys are read from server/config.local.json (gitignored) — NEVER hardcoded. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cfg = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'config.local.json'), 'utf8')); }
  catch { return {}; }
})();
process.env.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || cfg.OPENROUTER_API_KEY || '';
process.env.GEMINI_API_KEY     = process.env.GEMINI_API_KEY     || cfg.GEMINI_API_KEY     || '';
if (!process.env.OPENROUTER_API_KEY) {
  console.error('No OPENROUTER_API_KEY found (server/config.local.json). Skipping live tests — structure tests only.');
}

const { default: handler } = await import('../api/proxy.mjs');

function mockReq(method, url, bodyObj) {
  const buf = bodyObj ? Buffer.from(JSON.stringify(bodyObj)) : Buffer.alloc(0);
  return {
    method,
    url,
    headers: { 'content-type': 'application/json', origin: 'https://test.example' },
    async *[Symbol.asyncIterator]() { if (buf.length) yield buf; },
  };
}
function mockRes() {
  const state = { code: 0, headers: {}, body: '' };
  return { state,
    writeHead(code, headers) { state.code = code; Object.assign(state.headers, headers); },
    end(body) { state.body = body ? String(body) : ''; } };
}
async function call(method, url, bodyObj) {
  const res = mockRes();
  await handler(mockReq(method, url, bodyObj), res);
  let json = null; try { json = JSON.parse(res.state.body); } catch { /* ignore */ }
  return { code: res.state.code, cors: res.state.headers['Access-Control-Allow-Origin'], json };
}

/* 1. health */
const h = await call('GET', '/api/proxy?route=health');
console.log('health   =>', h.code, '|', h.json.openrouter, '|', h.json.groq);

/* 2. OPTIONS preflight */
const p = mockRes();
await handler(mockReq('OPTIONS', '/api/openrouter'), p);
console.log('preflight =>', p.state.code, '| cors:', p.state.headers['Access-Control-Allow-Origin']);

/* 3. OpenRouter real call (Solly shape) */
const o = await call('POST', '/api/proxy?route=openrouter', { model: 'minimax/minimax-m3:free',
  payload: { model: 'minimax/minimax-m3:free', messages: [{ role: 'user', content: 'Reply with exactly: VERCEL OK' }], max_tokens: 30, stream: false } });
console.log('openrouter =>', o.code, '|', o.json?.choices?.[0]?.message?.content ?? JSON.stringify(o.json?.error || {}).slice(0, 150));

/* 4. unknown route */
const u = await call('POST', '/api/proxy?route=bogus', { model: 'x', payload: {} });
console.log('unknown   =>', u.code, '|', (u.json?.error?.message || '').slice(0, 60));

/* 5. Gemini regression via vercel proxy */
const g = await call('POST', '/api/proxy?route=gemini', { model: 'gemini-3.6-flash',
  payload: { contents: [{ parts: [{ text: 'Reply with exactly: GEM VIA VERCEL' }] }] } });
console.log('gemini    =>', g.code, '|', g.json?.candidates?.[0]?.content?.parts?.[0]?.text ?? JSON.stringify(g.json?.error || {}).slice(0, 150));