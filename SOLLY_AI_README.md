# SOLLY — AI Data Assistant 💜

**SOLE MATRIX · Concord Footwear (Pvt) Ltd**

Solly is a small **circular, animated female AI avatar** that lives on the bottom-right corner of **every department dashboard**. Tap her to open a chat panel and ask questions about the **live Google Sheet data** — she answers through the **Google Gemini API**.

---

## ✨ What Solly Can Do

| Feature | Details |
|---|---|
| 🧍 Animated avatar | Pure-SVG female AI character — blinks, floats, talks (mouth animates while answering), glowing headset + twinkling hair-star |
| 📊 Live sheet analysis | Pulls all 6 tabs from SheetBest with a 60-second cache and a 🔄 refresh chip |
| 🤖 Gemini powered | `gemini-2.5-flash` with automatic fallback models, same key as the rest of the app |
| 🏭 Department aware | Detects the dashboard you're on (Warehouse / Outsole / Desma / Management / HR) and prioritises that department's tabs |
| 💬 Smart chat | Markdown answers (tables, lists, bold), typing indicator, "Analyzed tabs" badge on every reply |
| ⚡ Quick chips | One-tap suggested questions tailored per department |
| 🎤 Voice input | Talk to Solly with the mic button — live interim transcript, auto-sends when you stop speaking |
| 🔊 Female voice replies | Solly speaks her answers aloud with a feminine voice (pitch-boosted TTS, female-voice matching) |
| 🌐 Trilingual | Full support for **English 🇬🇧 · Sinhala සිංහල 🇱🇰 · Tamil தமிழ் 🇱🇰** — speech recognition, Gemini answers and TTS all switch language |

## 📋 Sheets Solly Understands

1. **Pending_MRN** — MRN requests raised by Outsole Production (incl. `Rows_JSON` model/colour/size breakdowns)
2. **Storse To GFU Gatepass** — Gatepasses from Stores → Outsole Production (GFU), with Management/HR approvals & vehicle assignment
3. **Storse Out** — Items scanned out of Stores against an MRN
4. **GFU Out** — Production output recorded at GFU
5. **Desma In Gatepass** — Gatepasses from Outsole Production → Desma
6. **Planned** — Daily production plan: Date (US `M/D/YYYY`), **Planed QTY** (the planned production quantity for that date — the sheet header is spelled with one "n") and **Available Hours** (production hours available that day)

## 🚀 Usage

1. Open any department dashboard — Solly's circular icon appears bottom-right.
2. Click the icon (or call `SollyAI.open()` from the console).
3. She greets you with a **live record count** synced from the sheet.
4. Type a question or tap a suggestion chip, e.g.:
   - *"How many pending MRNs are there?"*
   - *"What is today's GFU Out production total?"*
   - *"What is the plan QTY for today?"*
   - *"Which gatepasses are pending HR approval?"*
   - *"Status of MRN 1ST-EXTRA-GLUING-PLAN-WEEK-24"*

### Console API
```js
SollyAI.open()            // open the chat
SollyAI.close()           // close it
SollyAI.toggle()          // toggle
SollyAI.ask("question")   // open + ask immediately
```

## 🎙️ Talking to Solly (Voice Mode)

| Control | Where | What it does |
|---|---|---|
| **Mic button** | left of the input box | Starts voice input — pulses red while listening, transcript appears live in the input, auto-sends on silence |
| **Language button** (`EN` / `සිං` / `தமிழ்`) | left of the mic | Cycles the speech-recognition language: English (en-US) → Sinhala (si-LK) → Tamil (ta-IN) |
| **Speaker button** | chat header | Toggles voice replies on/off (red = muted) |

**How the trilingual flow works:**
1. Pick your language on the language button, then tap the mic and speak — e.g. *"ලංචා තියෙන MRN ගාන කීයද?"* or *"இன்று எத்தனை கேட்பாஸ்?"*
2. The transcript is sent to Gemini with a system rule: **answer in the same language the user used** (English, Sinhala script, or Tamil script).
3. Solly detects the answer's language by Unicode script (Sinhala `U+0D80–0DFF`, Tamil `U+0B80–0BFF`) and picks the best **female** TTS voice installed on the device for that language, with graceful fallback.
4. Her avatar's mouth animates in sync while she speaks. Sending a new message, closing the chat, or muting the speaker stops the voice instantly.

> 💡 Voice input uses the Web Speech API (best in Chrome/Edge). Sinhala/Tamil voices depend on the operating system's installed TTS voices — Android/Windows with language packs give the best results.

## ⚙️ How It Works (internals)

```
User question
   │
   ├─► SheetBest fetch (all 6 tabs, 60s cache, parallel)
   │
   ├─► Context builder
   │     • keyword extraction (MRN names, PO/model numbers, dates, "today")
   │     • relevance scoring → most relevant rows first (60–140 rows/tab)
   │     • Rows_JSON auto-summarised (model/colour/sizes/total)
   │
   ├─► Gemini generateContent (system prompt = Solly persona + sheet
   │     dictionary + workflow context + today's date in Asia/Colombo)
   │
   └─► Markdown-rendered answer + "📊 Analyzed: …" badge
```

- **File:** `assets/js/solly-ai.js` (fully self-contained — injects its own CSS, no dependencies)
- **Config:** uses `CONFIG.GEMINI_*` and `CONFIG.SHEETBEST_*` from `assets/js/config.js`
- **Session:** greets you by `sm_user` and tunes itself to `sm_dept`
- **Security:** all user/AI content is HTML-escaped before rendering

## 🎨 Avatar Animations

| State | Animation |
|---|---|
| Idle | Gentle float, blinking eyes, pulsing halo ring, glowing earpiece dots, twinkling hair-star |
| Thinking | Ring spins faster, avatar bobs quicker, wave bars in header, typing dots |
| Speaking | Mouth animates in sync with the TTS voice, ring glows in a slower spin |
| Listening | Mic button pulses red, "Listening in …" banner with animated dots |
| Hover | Tooltip "Hi! I'm Solly ✨ Ask me anything" |
| First load | One-time attention wiggle after 2s |