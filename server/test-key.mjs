#!/usr/bin/env node
/* Diagnostic: test which auth mode(s) a Gemini credential works with.
   Usage: node test-key.mjs [model]   (key read from config.local.json or GEMINI_API_KEY env) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let key = process.env.GEMINI_API_KEY || '';
if (!key) { try { key = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.local.json'), 'utf8')).GEMINI_API_KEY || ''; } catch {} }
if (!key) { console.error('No key found (config.local.json or GEMINI_API_KEY env).'); process.exit(1); }

const model = process.argv[2] || 'gemini-2.5-flash';
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
const body = JSON.stringify({ contents: [{ parts: [{ text: 'Say OK' }] }] });

function summarize(status, text) {
  try {
    const j = JSON.parse(text);
    if (status === 200) return 'OK -> ' + JSON.stringify(j.candidates?.[0]?.content?.parts?.[0]?.text);
    return `ERROR: ${j.error?.message} | reason=${j.error?.details?.[0]?.reason || '-'}`;
  } catch { return text.slice(0, 200); }
}

console.log(`Key: ${key.slice(0, 8)}...${key.slice(-4)}  Model: ${model}\n`);
const modes = [
  ['x-goog-api-key', { 'Content-Type': 'application/json', 'x-goog-api-key': key }],
  ['Bearer', { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }],
];
for (const [name, headers] of modes) {
  try {
    const r = await fetch(url, { method: 'POST', headers, body });
    console.log(name.padEnd(15), '=>', r.status, summarize(r.status, await r.text()));
  } catch (e) { console.log(name.padEnd(15), '=> FETCH FAILED:', e.message); }
}
try {
  const r = await fetch(`${url}?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  console.log('query ?key='.padEnd(15), '=>', r.status, summarize(r.status, await r.text()));
} catch (e) { console.log('query ?key='.padEnd(15), '=> FETCH FAILED:', e.message); }
