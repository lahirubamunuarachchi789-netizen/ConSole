/* ═══════════════════════════════════════════════════════════════
   SOLE MATRIX — AI proxy (Vercel serverless function)
   ───────────────────────────────────────────────────────────────
   Routes (wired via vercel.json rewrites, ?route= fallback):
     POST /api/openrouter → openrouter.ai            (Solly + MRN vision)
     POST /api/groq       → api.groq.com             (MRN AI button / legacy)
     POST /api/gemini     → generativelanguage       (warehouse / legacy)
     GET  /health         → provider status

   Env (Vercel → Settings → Environment Variables):
     OPENROUTER_API_KEY, GROQ_API_KEY, GEMINI_API_KEY,
     OPENROUTER_MODEL (default minimax/minimax-m3:free),
     PROXY_TOKEN (optional), ALLOWED_ORIGINS (optional CSV, default *)

   Serverless notes: no in-memory rate limiting (instances do not
   share state) and Vercel caps request bodies at ~4.5 MB — compress
   large plan images client-side. Max execution: 60s (vercel.json).
   ═══════════════════════════════════════════════════════════════ */

const OPENROUTER_KEY   = (process.env.OPENROUTER_API_KEY || '').trim();
const GROQ_KEY         = (process.env.GROQ_API_KEY || '').trim();
const GEMINI_KEY       = (process.env.GEMINI_API_KEY || '').trim();
const OPENROUTER_MODEL = (process.env.OPENROUTER_MODEL || 'minimax/minimax-m3:free').trim();
const PROXY_TOKEN      = (process.env.PROXY_TOKEN || '').trim();
const ALLOWED_ORIGINS  = (process.env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim()).filter(Boolean);
const MAX_BODY = 4 * 1024 * 1024;   /* stay under Vercel's ~4.5MB platform body limit */

const PROVIDERS = {
  openrouter: {
    url: () => 'https://openrouter.ai/api/v1/chat/completions',
    headers: (key) => ({
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://sole-matrix.concordfootwear.local',
      'X-Title': 'SOLE MATRIX',
    }),
    key: OPENROUTER_KEY,
    needMsg: 'Proxy has no OPENROUTER_API_KEY configured (Vercel environment variables).',
  },
  groq: {
    url: () => 'https://api.groq.com/openai/v1/chat/completions',
    headers: (key) => ({ 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' }),
    key: GROQ_KEY,
    needMsg: 'Proxy has no GROQ_API_KEY configured (Vercel environment variables).',
  },
  gemini: {
    url: (model) => 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent',
    headers: (key) => ({ 'x-goog-api-key': key, 'Content-Type': 'application/json' }),
    key: GEMINI_KEY,
    needMsg: 'Proxy has no GEMINI_API_KEY configured (Vercel environment variables).',
  },
};

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const cors = ALLOWED_ORIGINS.includes('*') ? { 'Access-Control-Allow-Origin': '*' }
    : (ALLOWED_ORIGINS.includes(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {});
  const send = (code, body) => {
    res.writeHead(code, { 'Content-Type': 'application/json', ...cors });
    res.end(JSON.stringify(body));
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { ...cors, 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-proxy-token', 'Access-Control-Max-Age': '86400' });
    return res.end();
  }

  let u;
  try { u = new URL(req.url, 'https://internal'); } catch { return send(400, { error: { message: 'Bad URL.' } }); }
  const route = (u.searchParams.get('route') || u.pathname.replace(/\/+$/, '').replace(/^\//, '')).toLowerCase();

  if (req.method === 'GET' && (route === 'health' || u.pathname === '/health')) {
    return send(200, { ok: true, service: 'sole-matrix ai proxy (vercel)',
      openrouter: OPENROUTER_KEY ? 'configured (' + OPENROUTER_MODEL + ')' : 'NOT CONFIGURED',
      groq: GROQ_KEY ? 'configured' : 'NOT CONFIGURED',
      gemini: GEMINI_KEY ? 'configured' : 'NOT CONFIGURED' });
  }

  if (req.method !== 'POST' || !['openrouter', 'groq', 'gemini'].includes(route))
    return send(404, { error: { message: 'Not found. Use POST /api/openrouter, /api/groq or /api/gemini with { model, payload }.' } });

  if (PROXY_TOKEN && req.headers['x-proxy-token'] !== PROXY_TOKEN)
    return send(401, { error: { message: 'Invalid proxy token.' } });

  const chunks = []; let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) return send(413, { error: { message: 'Payload too large (Vercel limit ~4.5MB). Compress the image and retry.' } });
    chunks.push(c);
  }
  let reqBody;
  try { reqBody = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { return send(400, { error: { message: 'Invalid JSON body.' } }); }

  const model = String(reqBody.model || '');
  let payload = reqBody.payload;
  if (!payload || typeof payload !== 'object')
    return send(400, { error: { message: 'Body must be { "model": "...", "payload": { ... } }.' } });

  const prov = PROVIDERS[route];
  if (!prov.key) return send(500, { error: { message: prov.needMsg } });

  let target = prov.url(model);
  const headers = prov.headers(prov.key);
  if (route === 'openrouter') {
    const m = /^[\w.\-:\/]+$/.test(model) ? model : OPENROUTER_MODEL;
    payload = { ...payload, model: m };
  } else if (route === 'groq') {
    payload = { ...payload, model: /^[\w.\-:\/]+$/.test(model) ? model : 'openai/gpt-oss-120b' };
  }

  try {
    const body = Buffer.from(JSON.stringify(payload));
    headers['Content-Length'] = body.length;
    const r = await fetch(target, { method: 'POST', headers, body });
    const buf = Buffer.from(await r.arrayBuffer());
    if (r.status >= 400) console.log('[' + route + ']', model, '->', r.status);
    res.writeHead(r.status, { 'Content-Type': 'application/json', ...cors });
    res.end(buf);
  } catch (e) {
    send(502, { error: { message: 'Upstream call failed: ' + e.message } });
  }
}