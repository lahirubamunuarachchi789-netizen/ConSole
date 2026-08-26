#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
   SOLE MATRIX — AI Backend Proxy (zero dependencies, Node 18+)
   ───────────────────────────────────────────────────────────────────
   Keeps provider credentials OFF the client. The dashboard calls:
     POST /api/groq     { "model": "openai/gpt-oss-120b", "payload": {...} }
     POST /api/gemini   { "model": "gemini-...", "payload": {...} }
   Credential priority:
     1. SERVICE_ACCOUNT_FILE (service-account JSON key) → signed-JWT
        → OAuth2 access token (auto-refreshed)
     2. GEMINI_API_KEY → x-goog-api-key (Bearer if AUTH_MODE=bearer)
   Config: env vars override server/config.local.json (gitignored!).
   Run:  node server/gemini-proxy.mjs
   ═══════════════════════════════════════════════════════════════════ */
import http from 'node:http';
import https from 'node:https';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fileCfg = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'config.local.json'), 'utf8')); } catch { return {}; } })();
const env = (k, d) => (process.env[k] ?? fileCfg[k] ?? d);
/* Load server/.env natively (Node ≥ 20.12 — no dotenv needed) */
try { process.loadEnvFile(path.join(__dirname, '.env')); } catch {}

const PORT            = Number(env('PORT', 8787));
const API_KEY         = String(env('GEMINI_API_KEY', '')).trim();
const SA_FILE         = String(env('SERVICE_ACCOUNT_FILE', '')).trim();
const AUTH_MODE       = String(env('AUTH_MODE', 'auto')).trim();   /* auto | api-key | bearer */
const PROXY_TOKEN     = String(env('PROXY_TOKEN', '')).trim();
const ALLOWED_ORIGINS = String(env('ALLOWED_ORIGINS', '*')).split(',').map(s => s.trim()).filter(Boolean);
const MAX_BODY        = Number(env('MAX_BODY_MB', 30)) * 1024 * 1024;
const RATE_PER_MIN    = Number(env('RATE_PER_MIN', 60));
const UP_HOST   = 'generativelanguage.googleapis.com';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GQ_HOST        = 'api.groq.com';
const GROQ_KEY       = String(env('GROQ_API_KEY', '')).trim();
const GROQ_MODEL     = String(env('GROQ_MODEL', 'openai/gpt-oss-120b')).trim();
const OR_HOST          = 'openrouter.ai';
const OPENROUTER_KEY   = String(env('OPENROUTER_API_KEY', '')).trim();
const OPENROUTER_MODEL = String(env('OPENROUTER_MODEL', 'minimax/minimax-m3:free')).trim();

/* ── Optional service-account credential ─────────────────────────── */
let sa = null;
if (SA_FILE) {
  try {
    const j = JSON.parse(fs.readFileSync(path.resolve(__dirname, SA_FILE), 'utf8'));
    if (!j.client_email || !j.private_key) throw new Error('not a service-account key file');
    sa = { email: j.client_email, key: j.private_key };
    console.log('[auth] service account loaded:', sa.email);
  } catch (e) { console.error('[auth] SERVICE_ACCOUNT_FILE error:', e.message); process.exit(1); }
}

const b64u = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
let tok = { v: null, exp: 0 };
async function saToken() {
  const now = Math.floor(Date.now() / 1000);
  if (tok.v && now < tok.exp - 300) return tok.v;
  const input = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' +
    b64u(JSON.stringify({ iss: sa.email, scope: 'https://www.googleapis.com/auth/cloud-platform', aud: TOKEN_URL, iat: now, exp: now + 3600 }));
  const sig = b64u(crypto.createSign('RSA-SHA256').update(input).sign(sa.key));
  const res = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: input + '.' + sig }) });
  const j = await res.json();
  if (!res.ok) throw new Error('SA token exchange failed: ' + (j.error_description || j.error || res.status));
  tok = { v: j.access_token, exp: now + (j.expires_in || 3600) };
  return tok.v;
}

/* ── API-key auth (mode resolved once; auto-flips on 401) ────────── */
let keyMode = null;
function authHeaders() {
  if (!keyMode) keyMode = (AUTH_MODE !== 'auto') ? AUTH_MODE : 'api-key';
  return keyMode === 'bearer' ? { Authorization: 'Bearer ' + API_KEY } : { 'x-goog-api-key': API_KEY };
}

/* ── Upstream POST helper ────────────────────────────────────────── */
function upstream(host, p, headers, bodyBuf) {
  return new Promise((resolve, reject) => {
    const req = https.request({ host: host, path: p, method: 'POST', headers }, (res) => {
      const ch = []; res.on('data', (c) => ch.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(ch) }));
    });
    req.setTimeout(120000, () => req.destroy(new Error('upstream timeout')));
    req.on('error', reject);
    req.end(bodyBuf);
  });
}

/* ── Simple per-IP rate limit (fixed 60s window) ─────────────────── */
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now(), h = hits.get(ip) || { n: 0, t: now };
  if (now - h.t > 60000) { h.n = 0; h.t = now; }
  h.n++; hits.set(ip, h);
  if (hits.size > 5000) hits.clear();
  return h.n > RATE_PER_MIN;
}
/* ── HTTP server ─────────────────────────────────────────────────── */
const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || '';
  const cors = ALLOWED_ORIGINS.includes('*') ? { 'Access-Control-Allow-Origin': '*' }
    : (ALLOWED_ORIGINS.includes(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {});
  const send = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json', ...cors }); res.end(JSON.stringify(body)); };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { ...cors, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, x-proxy-token', 'Access-Control-Max-Age': '86400' });
    return res.end();
  }
  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    return send(200, { ok: true, service: 'sole-matrix ai proxy',
      gemini: sa ? 'service-account' : (API_KEY ? 'api-key/' + (keyMode || AUTH_MODE) : 'NOT CONFIGURED'),
      groq: GROQ_KEY ? 'configured (' + GROQ_MODEL + ')' : 'NOT CONFIGURED',
      openrouter: OPENROUTER_KEY ? 'configured (' + OPENROUTER_MODEL + ')' : 'NOT CONFIGURED', ratePerMin: RATE_PER_MIN });
  }
  const route = req.url.split('?')[0].replace(/\/+$/, '');
  const isGroq = req.method === 'POST' && route === '/api/groq';
  const isOpenRouter = req.method === 'POST' && route === '/api/openrouter';
  if (req.method !== 'POST' || (route !== '/api/gemini' && !isGroq && !isOpenRouter))
    return send(404, { error: { message: 'Not found. Use POST /api/gemini, /api/groq or /api/openrouter with { model, payload }.' } });
  if (PROXY_TOKEN && req.headers['x-proxy-token'] !== PROXY_TOKEN)
    return send(401, { error: { message: 'Invalid proxy token.' } });

  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '?').split(',')[0].trim();
  if (rateLimited(ip)) return send(429, { error: { message: 'Rate limit exceeded. Try again shortly.' } });

  const chunks = []; let size = 0, tooBig = false;
  for await (const c of req) { size += c.length; if (size > MAX_BODY) { tooBig = true; break; } chunks.push(c); }
  if (tooBig) return send(413, { error: { message: 'Payload too large.' } });
  let reqBody; try { reqBody = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return send(400, { error: { message: 'Invalid JSON body.' } }); }
  const model = String(reqBody.model || ''), payload = reqBody.payload;
  if (!payload || typeof payload !== 'object')
    return send(400, { error: { message: 'Body must be { "model": "...", "payload": { ... } }.' } });

  /* ── Groq route (Solly) — OpenAI-style chat/completions ───────── */
  if (isGroq) {
    if (!GROQ_KEY) return send(500, { error: { message: 'Proxy has no GROQ_API_KEY configured (server/config.local.json).' } });
    const m = /^[\w.\-:\/]+$/.test(model) ? model : GROQ_MODEL;
    const gqBuf = Buffer.from(JSON.stringify({ ...payload, model: m }));
    try {
      const r = await upstream(GQ_HOST, '/openai/v1/chat/completions', { Authorization: 'Bearer ' + GROQ_KEY, 'Content-Type': 'application/json', 'Content-Length': gqBuf.length }, gqBuf);
      if (r.status >= 400) console.log('[groq]', m, '->', r.status);
      res.writeHead(r.status, { 'Content-Type': 'application/json', ...cors });
      return res.end(r.body);
    } catch (e) { return send(502, { error: { message: 'Upstream call failed: ' + e.message } }); }
  }

  /* ── OpenRouter route (Solly) — OpenAI-style chat/completions ── */
  if (isOpenRouter) {
    if (!OPENROUTER_KEY) return send(500, { error: { message: 'Proxy has no OPENROUTER_API_KEY configured (server/config.local.json).' } });
    const m = /^[\w.\-:\/]+$/.test(model) ? model : OPENROUTER_MODEL;
    const orBuf = Buffer.from(JSON.stringify({ ...payload, model: m }));
    const orHeaders = {
      'Authorization': 'Bearer ' + OPENROUTER_KEY,
      'Content-Type': 'application/json',
      'Content-Length': orBuf.length,
      'HTTP-Referer': 'https://sole-matrix.concordfootwear.local',
      'X-Title': 'SOLE MATRIX',
    };
    try {
      const r = await upstream(OR_HOST, '/api/v1/chat/completions', orHeaders, orBuf);
      if (r.status >= 400) console.log('[openrouter]', m, '->', r.status);
      res.writeHead(r.status, { 'Content-Type': 'application/json', ...cors });
      return res.end(r.body);
    } catch (e) { return send(502, { error: { message: 'Upstream call failed: ' + e.message } }); }
  }

  if (!/^[\w.\-]+$/.test(model) || !/gemini/i.test(model))
    return send(400, { error: { message: 'Gemini route needs { "model": "gemini-...", "payload": { ... } }.' } });

  const bodyBuf = Buffer.from(JSON.stringify(payload));
  const pathname = `/v1beta/models/${model}:generateContent`;
  try {
    const headers = sa ? { Authorization: 'Bearer ' + (await saToken()) }
      : (API_KEY ? authHeaders() : null);
    if (!headers) return send(500, { error: { message: 'Proxy has no credential configured (set GEMINI_API_KEY or SERVICE_ACCOUNT_FILE in server/config.local.json).' } });
    let r = await upstream(UP_HOST, pathname, { ...headers, 'Content-Type': 'application/json', 'Content-Length': bodyBuf.length }, bodyBuf);
    if (r.status === 401 && !sa && AUTH_MODE === 'auto' && keyMode === 'api-key') {
      keyMode = 'bearer';
      console.log('[auth] 401 on api-key mode — retrying as Bearer');
      r = await upstream(UP_HOST, pathname, { ...authHeaders(), 'Content-Type': 'application/json', 'Content-Length': bodyBuf.length }, bodyBuf);
    }
    if (r.status >= 400) console.log(`[gemini] ${model} -> ${r.status}`);
    res.writeHead(r.status, { 'Content-Type': 'application/json', ...cors });
    res.end(r.body);
  } catch (e) { send(502, { error: { message: 'Upstream call failed: ' + e.message } }); }
});

server.listen(PORT, () => {
  console.log('══ SOLE MATRIX — AI proxy ══');
  console.log('  endpoints : http://localhost:' + PORT + '/api/gemini  (MRN/warehouse vision)');
  console.log('              http://localhost:' + PORT + '/api/groq  (Solly chat)');
  console.log('  gemini    : ' + (sa ? 'service-account (' + sa.email + ')' : API_KEY ? 'api-key [' + API_KEY.slice(0, 6) + '…' + API_KEY.slice(-4) + '] mode=' + (keyMode || AUTH_MODE) : '⚠ NOT CONFIGURED'));
  console.log('  groq      : ' + (GROQ_KEY ? 'configured (' + GROQ_MODEL + ')' : '⚠ NOT CONFIGURED'));
  console.log('  openrouter: ' + (OPENROUTER_KEY ? 'configured (' + OPENROUTER_MODEL + ')' : '⚠ NOT CONFIGURED'));
  console.log('  cors      : ' + ALLOWED_ORIGINS.join(', ') + ' | rate ' + RATE_PER_MIN + '/min | maxBody ' + Math.round(MAX_BODY / 1048576) + 'MB');
});
server.on('error', (e) => { console.error('Cannot start proxy:', e.message); process.exit(1); });

