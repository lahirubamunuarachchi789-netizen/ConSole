/* ═══════════════════════════════════════════════════════════════
   SOLE MATRIX — Gemini backend proxy — server/README.md
   ───────────────────────────────────────────────────────────────
   Keeps Google credentials off the client. The dashboards call
   this proxy instead of Google directly.
   ─────────────────────────────────────────────────────────────── */

## Quick start

```
cd server
node gemini-proxy.mjs        # → http://localhost:8787/api/gemini
```

`config.local.json` already points the app's `GEMINI_PROXY_URL`
(`assets/js/config.js`) at that address. No npm install needed —
the proxy uses only Node built-ins.

## OpenRouter — Solly chat (full-sheet reads)

Solly uses **OpenRouter** through the same proxy:

- Route: `POST /api/openrouter` — body `{ "model": "minimax/minimax-m3:free", "payload": { ...OpenAI chat body... } }`
- Upstream: `https://openrouter.ai/api/v1/chat/completions` (OpenAI-compatible)
- Key: `OPENROUTER_API_KEY` in `server/config.local.json`, sent as `Authorization: Bearer <key>`
- Model: `OPENROUTER_MODEL` (default `minimax/minimax-m3:free`, 1M-token context; fallbacks `google/gemma-4-31b-it:free`, `nvidia/nemotron-3.5-lightning:free`)
- Client: `solly-ai.js` → `CONFIG.OPENROUTER_PROXY_URL`, parses `data.choices[0].message.content`
- **No row caps / no truncation** — Solly sends the complete sheet snapshot (free models have up to 1M-token contexts).

## Groq — MRN AI fallback only

`POST /api/groq` (upstream `api.groq.com`) remains for the MRN module's
manual "Try AI extraction instead" button (`qwen/qwen3.6-27b` vision) and
any legacy direct calls. Key: `GROQ_API_KEY` in `server/config.local.json`.

## Configuration — `server/config.local.json` (gitignored!)

| Key | Meaning |
|---|---|
| `PORT` | Listen port (default 8787) |
| `GEMINI_API_KEY` | API key (`AIza…` or new `AQ…` auth key). **Never commit.** |
| `SERVICE_ACCOUNT_FILE` | Optional service-account JSON key file. When set, it takes priority: the proxy signs a JWT and uses OAuth2 access tokens (auto-refreshed). This is the true "Service Account" mode. |
| `AUTH_MODE` | `auto` (default) / `api-key` / `bearer` |
| `PROXY_TOKEN` | Optional shared secret; clients must send `x-proxy-token` header |
| `ALLOWED_ORIGINS` | Comma-separated origin allow-list, or `*` |
| `RATE_PER_MIN` | Per-IP request limit per minute (default 60) |
| `MAX_BODY_MB` | Max request body size (MRN sends base64 files) |

## Getting a service-account key (optional, most secure)

1. Google Cloud Console → **IAM & Admin → Service Accounts → Create**
2. Create a JSON key for it, save as `server/service-account.json`
3. Set `SERVICE_ACCOUNT_FILE: "service-account.json"` in `config.local.json`
4. Enable **Generative Language API** on the project

## Deploying to Render.com

1. Push this repo to GitHub (done).
2. Render dashboard → **New → Web Service** → connect `ConSole`.
3. **Root Directory:** `server` · **Runtime:** Node ·
   **Build Command:** `npm install` · **Start Command:** `npm start`
4. **Health Check Path:** `/health`
5. **Environment →** add:
   - `OPENROUTER_API_KEY` (required — Solly chat + MRN vision)
   - `GROQ_API_KEY`, `GEMINI_API_KEY` (optional legacy routes)
   - `ALLOWED_ORIGINS` = your dashboard's https origin (e.g. `https://sole-matrix.onrender.com`)
   - `OPENROUTER_MODEL` (default `minimax/minimax-m3:free`)
6. Deploy → note the service URL, e.g. `https://<name>.onrender.com`
7. In `assets/js/config.js` switch the proxy URLs from localhost:
   - `OPENROUTER_PROXY_URL: 'https://<name>.onrender.com/api/openrouter'`
   - `GROQ_PROXY_URL` / `GEMINI_PROXY_URL` likewise (if kept)
8. Commit + push that config change — done.

Notes: `PORT` is injected by Render automatically (the proxy reads
`process.env.PORT` first). Zero npm dependencies, so the build is
instant. Free Render instances sleep when idle; the first request
wakes them (~30-60s). `process.loadEnvFile` is skipped safely when
no `.env` exists — use Render Environment vars instead.

## Security notes

- `config.local.json` and any `service-account*.json` are gitignored — keep it that way.
- The proxy only talks to `generativelanguage.googleapis.com` and only accepts `gemini-*` models.
- With a proxy there is **no API key in the browser**, so Google's
  public-repo leak scanners have nothing to find and block.
