/* ═══════════════════════════════════════════════════════════════
   SOLE MATRIX — MRN Creation Module
   Concord Footwear (Pvt) Ltd
   ─────────────────────────────────────────────────────────────
   Flow:
     1. User uploads plan image or PDF
     2. OpenRouter AI vision (free high-context models) extracts the table
     3. Parsed data rendered as Digital MRN table
     4. User can download PDF, share, or submit
     5. On submit → PDF generated → uploaded to Cloudinary
        under sole-matrix/pending-mrn/
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   STATE
   ───────────────────────────────────────────────────────────── */
const MRN = {
  file:        null,   // File object from input
  fileDataURL: null,   // base64 data URL (for Gemini)
  fileMime:    null,   // MIME type
  rows:        [],     // parsed MRN rows [{po, model, color, sizes:{35:n,...}, total}]
  mrnNumber:   null,   // generated MRN reference
  pdfBlob:     null,   // generated PDF blob
  cloudUrl:    null,   // Cloudinary secure_url after upload
  step:        1,      // current UI step (1=upload, 2=review, 3=done)
};

/* ─────────────────────────────────────────────────────────────
   GEMINI PROMPT
   ───────────────────────────────────────────────────────────── */
const GEMINI_PROMPT = `
Extract production data from this Concord Footwear gluing plan table.

COLUMNS IN THE TABLE:
- Gluing Date
- PO (Purchase Order number - REQUIRED)
- Model (e.g., Elite, Epic, Storm)
- Style (e.g., 2451, 2452)
- Outsole Colour (e.g., Black, Gray)
- Size columns: 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48
- Total (sum of quantities)

EXTRACTION INSTRUCTIONS:
1. Extract EVERY row that has a PO number
2. Skip header rows and empty rows
3. For each row with a PO, create a JSON object with:
   - po: The PO number as a string (e.g., "147352")
   - model: The model name (e.g., "Elite")
   - color: The outsole colour (e.g., "Black")
   - sizes: Object with ONLY sizes that have numbers greater than 0
     * Skip cells with "-" or empty cells
     * Format: {"41": 1, "42": 2, "44": 5}
   - total: The total quantity (integer)

EXAMPLE INPUT ROW:
| 11-May | 147352 | Elite | 2451 | Black | - | - | - | - | - | - | 1 | - | - | - | - | - | - | - | 1 |

EXPECTED OUTPUT FOR THAT ROW:
{
  "po": "147352",
  "model": "Elite",
  "color": "Black",
  "sizes": {"41": 1},
  "total": 1
}

CRITICAL: Return ONLY a JSON array. No explanations, no markdown code blocks, no text before or after. Just the array.

EXAMPLE COMPLETE OUTPUT:
[{"po":"147352","model":"Elite","color":"Black","sizes":{"41":1},"total":1},{"po":"147422","model":"Elite","color":"Black","sizes":{"41":1},"total":1}]

If no valid rows exist, return: []
`;

/* ─────────────────────────────────────────────────────────────
   MRN NAME — derived from uploaded filename
   ───────────────────────────────────────────────────────────── */
function generateMRNNumber(fileName) {
  // Strip extension, clean special chars, uppercase
  const base = (fileName || 'MRN')
    .replace(/\.[^/.]+$/, '')          // remove extension
    .replace(/[^a-zA-Z0-9 _\-]/g, '') // remove special chars
    .trim()
    .replace(/\s+/g, '-')             // spaces → dashes
    .toUpperCase()
    .substring(0, 60);                // max 60 chars
  return base || 'MRN';
}

/* ─────────────────────────────────────────────────────────────
   COLOUR → HEX MAP  (for swatch dots in the table)
   ───────────────────────────────────────────────────────────── */
const COLOR_MAP = {
  'gray':        '#9ca3af',
  'grey':        '#9ca3af',
  'black':       '#374151',
  'black/lime':  '#4ade80',
  'lime':        '#a3e635',
  'yellow':      '#fbbf24',
  'white':       '#f1f5f9',
  'brown':       '#92400e',
  'red':         '#ef4444',
  'blue':        '#3b82f6',
  'navy':        '#1e3a5f',
  'green':       '#22c55e',
  'beige':       '#d4b896',
  'tan':         '#c8a882',
};

function colorToHex(colorStr) {
  if (!colorStr) return '#6b7280';
  const key = colorStr.toLowerCase().trim();
  if (COLOR_MAP[key]) return COLOR_MAP[key];
  // Try partial match
  for (const [k, v] of Object.entries(COLOR_MAP)) {
    if (key.includes(k)) return v;
  }
  return '#6b7280';
}

/* ─────────────────────────────────────────────────────────────
   BUILD MRN HTML — injected into modal body
   ───────────────────────────────────────────────────────────── */
function buildMRNShell() {
  return `
<div class="mrn-shell" id="mrnShell">

  <!-- ── Step progress ── -->
  <div class="mrn-steps" id="mrnSteps">
    <div class="mrn-step active" id="mrnStep1" aria-current="step">
      <div class="step-dot"><i class="fa-solid fa-upload" style="font-size:0.6rem"></i></div>
      <span class="step-label">Upload Plan</span>
    </div>
    <div class="mrn-step" id="mrnStep2">
      <div class="step-dot"><i class="fa-solid fa-table" style="font-size:0.6rem"></i></div>
      <span class="step-label">Review MRN</span>
    </div>
    <div class="mrn-step" id="mrnStep3">
      <div class="step-dot"><i class="fa-solid fa-circle-check" style="font-size:0.6rem"></i></div>
      <span class="step-label">Submitted</span>
    </div>
  </div>

  <!-- ══ STEP 1 — Upload ══════════════════════════════════════ -->
  <div class="mrn-upload-section" id="mrnUploadSection">

    <div class="mrn-upload-zone" id="mrnDropZone"
      role="button" tabindex="0" aria-label="Upload production plan">
      <input type="file" id="mrnFileInput"
        accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
        aria-label="Select production plan file" />

      <div class="upload-icon-ring" id="uploadIconRing">
        <i class="fa-solid fa-cloud-arrow-up" id="uploadZoneIcon"></i>
      </div>
      <p class="upload-title" id="uploadZoneTitle">Drop your production plan here</p>
      <p class="upload-sub" id="uploadZoneSub">
        Drag &amp; drop or click to browse.<br/>
        OpenRouter AI vision extracts the MRN data automatically.
      </p>
      <div class="upload-formats">
        <span class="fmt-badge"><i class="fa-regular fa-image"></i> PNG</span>
        <span class="fmt-badge"><i class="fa-regular fa-image"></i> JPG</span>
        <span class="fmt-badge"><i class="fa-regular fa-file-pdf"></i> PDF</span>
        <span class="fmt-badge"><i class="fa-regular fa-image"></i> WEBP</span>
      </div>
    </div>

    <!-- File preview strip (shown after file selected) -->
    <div class="upload-preview" id="uploadPreview">
      <div class="preview-thumb" id="previewThumb"></div>
      <div class="preview-info">
        <div class="preview-name" id="previewName"></div>
        <div class="preview-size" id="previewSize"></div>
      </div>
      <button class="btn-clear-file" id="btnClearFile"
        onclick="mrnClearFile()" aria-label="Remove file" title="Remove file">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>

    <!-- Analyse button -->
    <div class="mrn-upload-actions">
      <button class="btn-analyse" id="btnAnalyse" onclick="mrnAnalyse()" disabled>
        <i class="fa-solid fa-wand-magic-sparkles"></i>
        Analyse with OpenRouter AI
      </button>
    </div>

  </div><!-- /mrn-upload-section -->

  <!-- ══ AI PROCESSING OVERLAY ════════════════════════════════ -->
  <div class="mrn-ai-overlay" id="mrnAiOverlay">
    <div class="ai-spinner-ring"></div>
    <div>
      <p class="ai-status-title" id="aiStatusTitle">Sending to OpenRouter AI…</p>
      <p class="ai-status-sub">This usually takes 5–10 seconds.</p>
    </div>
    <ul class="ai-steps-list" id="aiStepsList">
      <li class="ai-step-item" id="aiS1">
        <span class="ai-step-icon"><i class="fa-solid fa-circle-notch"></i></span>
        Reading file
      </li>
      <li class="ai-step-item" id="aiS2">
        <span class="ai-step-icon"><i class="fa-solid fa-brain"></i></span>
        OpenRouter vision analysis
      </li>
      <li class="ai-step-item" id="aiS3">
        <span class="ai-step-icon"><i class="fa-solid fa-table-cells"></i></span>
        Extracting PO / Model / Size data
      </li>
      <li class="ai-step-item" id="aiS4">
        <span class="ai-step-icon"><i class="fa-solid fa-file-circle-check"></i></span>
        Building Digital MRN
      </li>
    </ul>
  </div>

  <!-- ══ PARSE ERROR ══════════════════════════════════════════ -->
  <div class="mrn-parse-error" id="mrnParseError">
    <div class="parse-error-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
    <p class="parse-error-title">Couldn't extract MRN data</p>
    <p class="parse-error-body" id="parseErrorMsg">
      The AI could not read the plan clearly. Please try a sharper image or a different file.
    </p>
    <button class="btn-mrn-action btn-reupload" onclick="mrnReset()" style="margin-top:8px">
      <i class="fa-solid fa-rotate-left"></i> Try Again
    </button>
    <button class="btn-mrn-action btn-reupload" onclick="mrnAnalyseWithOCR()" style="margin-top:8px">
      <i class="fa-solid fa-scanner-keyboard"></i> Try on-device OCR instead
    </button>
  </div>

  <!-- ══ STEP 2 — Digital MRN Table ═══════════════════════════ -->
  <div class="mrn-result-section" id="mrnResultSection">

    <!-- MRN document header -->
    <div class="mrn-doc-header">
      <div class="mrn-doc-brand">
        <span class="mrn-doc-company">Concord Footwear (Pvt) Ltd</span>
        <span class="mrn-doc-title">MATERIAL REQUISITION NOTE</span>
      </div>
      <div class="mrn-doc-meta">
        <div class="mrn-meta-row">
          <span class="mrn-meta-label">MRN No.</span>
          <span class="mrn-meta-value" id="mrnDisplayNumber">—</span>
        </div>
        <div class="mrn-meta-row">
          <span class="mrn-meta-label">Date</span>
          <span class="mrn-meta-value" id="mrnDisplayDate">—</span>
        </div>
        <div class="mrn-meta-row">
          <span class="mrn-meta-label">Prepared by</span>
          <span class="mrn-meta-value" id="mrnDisplayUser">—</span>
        </div>
        <div class="mrn-meta-row">
          <span class="mrn-meta-label">Department</span>
          <span class="mrn-meta-value">OUTSOLE PRODUCTION</span>
        </div>
      </div>
    </div>

    <!-- Data table -->
    <div class="mrn-table-wrap">
      <table class="mrn-table" id="mrnDataTable" aria-label="MRN data">
        <thead>
          <tr>
            <th>#</th>
            <th>PO Number</th>
            <th>Model</th>
            <th>Outsole Color</th>
            <th>Sizes &amp; Quantities</th>
            <th>Total QTY</th>
          </tr>
        </thead>
        <tbody id="mrnTableBody"></tbody>
        <tfoot id="mrnTableFoot"></tfoot>
      </table>
    </div>

    <!-- Action bar -->
    <div class="mrn-action-bar">
      <div class="mrn-action-left">
        <button class="btn-mrn-action btn-reupload" onclick="mrnReset()">
          <i class="fa-solid fa-rotate-left"></i> Re-upload
        </button>
        <button class="btn-mrn-action btn-download-pdf" id="btnDownloadPdf"
          onclick="mrnDownloadPDF()">
          <i class="fa-solid fa-file-arrow-down"></i> Download PDF
        </button>
        <button class="btn-mrn-action btn-share" id="btnShare"
          onclick="mrnShare()">
          <i class="fa-solid fa-share-nodes"></i> Share
        </button>
      </div>
      <div class="mrn-action-right">
        <button class="btn-mrn-action btn-submit-mrn" id="btnSubmitMrn"
          onclick="mrnSubmit()">
          <i class="fa-solid fa-paper-plane"></i>
          Submit &amp; Save
        </button>
      </div>
    </div>

  </div><!-- /mrn-result-section -->

  <!-- ══ STEP 3 — Success ═════════════════════════════════════ -->
  <div class="mrn-success-section" id="mrnSuccessSection">
    <div class="success-checkmark">
      <i class="fa-solid fa-circle-check"></i>
    </div>
    <h3 class="success-title">MRN Submitted!</h3>
    <p class="success-body">
      Your Digital MRN has been saved to the <strong>Pending MRN</strong> folder in Cloudinary
      and is ready for review.
    </p>
    <div class="success-cloudinary-info">
      <div class="cloudinary-row">
        <i class="fa-solid fa-file-pdf"></i>
        <span>MRN Number:</span>
        <span id="successMrnNo" style="color:var(--clr-text-primary);font-weight:700"></span>
      </div>
      <div class="cloudinary-row">
        <i class="fa-solid fa-cloud"></i>
        <span>Saved to:</span>
        <span style="color:#86efac;font-weight:600">sole-matrix/pending-mrn/</span>
      </div>
      <div class="cloudinary-row" id="cloudinaryLinkRow" style="display:none">
        <i class="fa-solid fa-link"></i>
        <span>View:</span>
        <a id="cloudinaryViewLink" href="#" target="_blank" rel="noopener">Open in Cloudinary</a>
      </div>
    </div>
    <!-- "Switch to WhatsApp" action (injected after submit & save) -->
    <div id="mrnWhatsAppAction"></div>
    <button class="btn-new-mrn" onclick="mrnReset()">
      <i class="fa-solid fa-plus"></i> Create Another MRN
    </button>
  </div>

</div><!-- /mrn-shell -->

<!-- Toast (global, appended once) -->
<div class="mrn-toast" id="mrnToast" role="status" aria-live="polite"></div>
`;
}

/* ─────────────────────────────────────────────────────────────
   ENTRY POINT — called by outsole-dashboard.js
   ───────────────────────────────────────────────────────────── */
function initMRNModule(bodyEl) {
  // Reset state
  Object.assign(MRN, {
    file: null, fileDataURL: null, fileMime: null,
    rows: [], mrnNumber: null, pdfBlob: null,
    cloudUrl: null, step: 1,
  });

  bodyEl.innerHTML = buildMRNShell();

  // Wire file input
  const fileInput = document.getElementById('mrnFileInput');
  const dropZone  = document.getElementById('mrnDropZone');

  fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) mrnHandleFile(e.target.files[0]);
  });

  // Drag-and-drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const f = e.dataTransfer.files[0];
    if (f) mrnHandleFile(f);
  });

  // Keyboard activate drop zone
  dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  // Populate user info
  const user = sessionStorage.getItem('sm_user') || 'Unknown';
  const el   = document.getElementById('mrnDisplayUser');
  if (el) el.textContent = user.toUpperCase();
}

/* ─────────────────────────────────────────────────────────────
   FILE HANDLING
   ───────────────────────────────────────────────────────────── */
function mrnHandleFile(file) {
  const allowed = ['image/png','image/jpeg','image/webp','image/gif','application/pdf'];
  if (!allowed.includes(file.type)) {
    mrnToast('Unsupported file type. Use PNG, JPG, WEBP or PDF.', 'error');
    return;
  }
  
  // Reduce max file size to 10MB for better compatibility
  if (file.size > 10 * 1024 * 1024) {
    mrnToast('File too large. Maximum size is 10 MB. Please use a smaller or compressed file.', 'error');
    return;
  }
  
  console.log('[MRN] File selected:', file.name, file.type, file.size, 'bytes');

  MRN.file     = file;
  MRN.fileMime = file.type;

  // Read as base64
  const reader = new FileReader();
  reader.onload = (e) => {
    MRN.fileDataURL = e.target.result;
    console.log('[MRN] File read successfully, data URL length:', MRN.fileDataURL.length);
    mrnShowPreview(file, e.target.result);
    document.getElementById('btnAnalyse').disabled = false;
  };
  reader.onerror = (e) => {
    console.error('[MRN] FileReader error:', e);
    mrnToast('Failed to read file. Please try again.', 'error');
  };
  reader.readAsDataURL(file);
}

function mrnShowPreview(file, dataURL) {
  const zone    = document.getElementById('mrnDropZone');
  const preview = document.getElementById('uploadPreview');
  const thumb   = document.getElementById('previewThumb');
  const name    = document.getElementById('previewName');
  const size    = document.getElementById('previewSize');

  zone.classList.add('has-file');
  document.getElementById('uploadZoneTitle').textContent = 'File ready for analysis';
  document.getElementById('uploadZoneSub').textContent   = 'Click "Analyse with OpenRouter AI" to extract MRN data.';
  document.getElementById('uploadIconRing').querySelector('i').className = 'fa-solid fa-circle-check';

  name.textContent = file.name;
  size.textContent = formatBytes(file.size);

  if (file.type === 'application/pdf') {
    thumb.innerHTML = '<i class="pdf-icon fa-solid fa-file-pdf"></i>';
  } else {
    thumb.innerHTML = `<img src="${dataURL}" alt="Plan preview" />`;
  }

  preview.classList.add('visible');
}

function mrnClearFile() {
  MRN.file = MRN.fileDataURL = MRN.fileMime = null;

  const zone  = document.getElementById('mrnDropZone');
  const input = document.getElementById('mrnFileInput');

  zone.classList.remove('has-file');
  document.getElementById('uploadZoneTitle').textContent  = 'Drop your production plan here';
  document.getElementById('uploadZoneSub').textContent    = 'Drag & drop or click to browse.\nOpenRouter AI vision extracts the MRN data automatically.';
  document.getElementById('uploadIconRing').querySelector('i').className = 'fa-solid fa-cloud-arrow-up';
  document.getElementById('uploadPreview').classList.remove('visible');
  document.getElementById('btnAnalyse').disabled = true;
  document.getElementById('previewThumb').innerHTML = '';
  input.value = '';
}

/* ─────────────────────────────────────────────────────────────
   ANALYSE (primary) — vision extraction via OpenRouter
   Images are sent as data-URIs; PDFs are rasterized to page
   images (pdf.js) first. Fully independent of Gemini/Groq/OCR.
   ───────────────────────────────────────────────────────────── */
async function mrnAnalyse() {
  if (!MRN.fileDataURL) return;
  
  // Validate AI configuration — OpenRouter vision via the backend proxy
  const hasOpenRouter = !!(CONFIG.OPENROUTER_PROXY_URL || CONFIG.GROQ_PROXY_URL || CONFIG.GEMINI_PROXY_URL);
  if (!hasOpenRouter) {
    mrnToast('OpenRouter is not configured (no proxy URL). Check config.js', 'error');
    showSection('error');
    document.getElementById('parseErrorMsg').textContent = 
      'OpenRouter extraction is not configured. Please check config.js (proxy settings).';
    return;
  }

  // Show AI overlay, hide upload
  showSection('aiOverlay');
  setAIStep(1, 'active');

  try {
    // ── Step 1: Read file ─────────────────────────────────────
    await delay(400);
    setAIStep(1, 'done');
    setAIStep(2, 'active');
    document.getElementById('aiStatusTitle').textContent = 'Sending to OpenRouter AI…';

    // ── Step 2: Vision extraction via OpenRouter ─────────────
    // Images → sent directly as data-URIs.
    // PDFs   → rasterized to page images first (pdf.js), because
    //           chat models cannot ingest PDF files directly.
    const base64Data = MRN.fileDataURL.split(',')[1];

    if (!base64Data) {
      throw new Error('Failed to read file data. Please try re-uploading.');
    }
    console.log('[MRN] Base64 length:', base64Data.length, 'MIME:', MRN.fileMime);

    /* Build the image parts: the uploaded image, or rendered PDF pages */
    let imageDataUrls;
    if (MRN.fileMime === 'application/pdf') {
      document.getElementById('aiStatusTitle').textContent = 'Rendering PDF pages…';
      imageDataUrls = await ocrPdfToImages(MRN.fileDataURL);
    } else {
      imageDataUrls = ['data:' + MRN.fileMime + ';base64,' + base64Data];
    }

    const contentParts = [{ type: 'text', text: GEMINI_PROMPT }];
    imageDataUrls.forEach((u) => contentParts.push({ type: 'image_url', image_url: { url: u } }));

    let orProxy = (window.CONFIG && CONFIG.OPENROUTER_PROXY_URL)
      || (window.CONFIG && CONFIG.GROQ_PROXY_URL ? CONFIG.GROQ_PROXY_URL.replace('/api/groq', '/api/openrouter') : '')
      || 'http://localhost:8787/api/openrouter';
    /* collapse to a relative URL when the proxy shares this page's host —
       keeps the request same-origin on phones (no CORS/preflight at all) */
    try {
      const u = new URL(orProxy, location.href);
      if (u.origin === location.origin) orProxy = u.pathname + u.search;
    } catch (_) { /* keep absolute */ }
    const modelsToTry = ['minimax/minimax-m3:free', 'google/gemma-4-31b-it:free', 'dots-studio/dots-3-note-preview:free', 'google/gemma-4-26b-a4b-it:free', 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free'];
    let rawText = '';
    let lastError = null;

    /* text/plain = CORS "simple request" (no OPTIONS preflight); the proxy
       parses the raw JSON body regardless of Content-Type. */
    const orHeaders = { 'Content-Type': 'text/plain;charset=UTF-8' };
    if (CONFIG.GEMINI_PROXY_TOKEN) orHeaders['x-proxy-token'] = CONFIG.GEMINI_PROXY_TOKEN;

    /* Each model gets up to 2 passes: reasoning models can burn the whole
       max_tokens budget on internal thinking (empty content, finish_reason
       = "length"), so pass 2 doubles the token budget before we move on
       to the next model. Every model has its own rate-limit bucket. */
    outer: for (const model of modelsToTry) {
      let maxTokens = 8192;
      for (let pass = 0; pass < 2; pass++, maxTokens = Math.min(16384, maxTokens * 2)) {
        try {
          console.log('[MRN] Trying OpenRouter vision: ' + model + ' (pass ' + (pass + 1) + ', max_tokens ' + maxTokens + ')');
          const orBody = {
            model: model,
            messages: [{ role: 'user', content: contentParts }],
            temperature: 0.1,
            max_tokens: maxTokens,
            stream: false,
          };
          const attempt = await fetchWithTimeout(orProxy, {
            method: 'POST',
            headers: orHeaders,
            body: JSON.stringify({ model: model, payload: orBody }),
            cache: 'no-store',
            credentials: 'omit',
            redirect: 'follow',
          }, 180000);

          const d = await attempt.json().catch(() => ({}));
          if (!attempt.ok) {
            console.warn('[MRN] OpenRouter model ' + model + ' failed (' + attempt.status + '):', d && d.error && d.error.message);
            lastError = (d && d.error && d.error.message) || ('HTTP ' + attempt.status);
            break;   /* model-level failure - try the next model */
          }
          const msg = d?.choices?.[0]?.message || {};
          const fin = d?.choices?.[0]?.finish_reason || '';
          rawText = String(msg.content || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
          console.log('[MRN] OpenRouter ' + model + ' -> finish:' + fin + ' contentLen:' + rawText.length);
          if (rawText) break outer;
          /* empty content + token exhaustion: retry same model with double budget */
          if (fin === 'length' && pass === 0 && maxTokens < 16384) { maxTokens = 16384; continue; }
          lastError = 'Empty response from ' + model + ' (finish: ' + (fin || 'unknown') + ')';
          break;   /* try the next model */
        } catch (err) {
          console.warn('[MRN] OpenRouter model ' + model + ' threw:', err.message);
          lastError = err.message;
          break;
        }
      }
    }

    if (!rawText) {
      throw new Error(lastError || 'All OpenRouter vision models are currently unavailable. Please try again later.');
    }

    setAIStep(2, 'done');
    setAIStep(3, 'active');
    document.getElementById('aiStatusTitle').textContent = 'Extracting data…';
    await delay(300);

    // ── Step 3: Parse JSON from the vision response (OpenRouter) ──
    
    const rows = parseGeminiResponse(rawText);

    /* ── Automatic on-device OCR fallback when AI vision yields nothing ── */
    if (!rows || rows.length === 0) {
      console.warn('[MRN] AI vision produced no rows - auto-falling back to on-device OCR...');
      document.getElementById('aiStatusTitle').textContent = 'AI vision failed - trying on-device OCR...';
      setAIStep(2, 'active');
      try {
        const ocr = await mrnRunOcrExtraction();
        if (ocr.rows && ocr.rows.length) {
          rows = ocr.rows;
          mrnToast('AI vision could not read the plan - recovered with on-device OCR. Please verify the table before submitting.', 'error');
        }
      } catch (ocrErr) {
        console.warn('[MRN] OCR fallback failed:', ocrErr.message);
      }
    }

    if (!rows || rows.length === 0) {
      let errorMsg = 'No production data could be extracted from this file. ';
      if (lastError) errorMsg += 'Last AI error: ' + lastError + '. ';
      errorMsg += 'Try a sharper, well-lit, straight photo showing the full plan table - or use "Try on-device OCR instead".';
      throw new Error(errorMsg);
    }

    setAIStep(3, 'done');
    setAIStep(4, 'active');
    document.getElementById('aiStatusTitle').textContent = 'Building Digital MRN…';
    await delay(400);

    // ── Step 4: Render MRN ────────────────────────────────────
    MRN.rows      = rows;
    MRN.mrnNumber = generateMRNNumber(MRN.file ? MRN.file.name : 'MRN');

    renderMRNTable(rows);
    populateMRNMeta();

    setAIStep(4, 'done');
    await delay(300);

    showSection('result');
    setStep(2);
    mrnToast('MRN extracted successfully!', 'success');

  } catch (err) {
    console.error('[MRN] Gemini error:', err);
    showSection('error');
    const msgEl = document.getElementById('parseErrorMsg');
    if (msgEl) msgEl.textContent = err.message || 'An unexpected error occurred. Please try again.';
  }
}

/* ─────────────────────────────────────────────────────────────
   PARSE GEMINI RESPONSE
   ───────────────────────────────────────────────────────────── */
function parseGeminiResponse(text) {
  if (!text || typeof text !== 'string') {
    console.warn('[MRN] Empty or invalid text from Gemini');
    return [];
  }
  
  console.log('[MRN] Raw Gemini response (first 500 chars):', text.substring(0, 500));
  
  // Strip markdown code fences if present
  let clean = text.trim();
  clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // Find the JSON array - be more flexible
  let start = clean.indexOf('[');
  let end   = clean.lastIndexOf(']');
  
  // If no array brackets found, return empty
  if (start === -1 || end === -1) {
    console.warn('[MRN] No JSON array brackets found in response');
    return [];
  }

  const jsonStr = clean.slice(start, end + 1);
  console.log('[MRN] Extracted JSON string:', jsonStr);

  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) {
      console.warn('[MRN] Parsed result is not an array:', typeof parsed);
      return [];
    }

    console.log('[MRN] Successfully parsed array with', parsed.length, 'items');

    // Normalise and validate each row - be more lenient
    const validRows = parsed
      .filter(r => {
        if (!r || typeof r !== 'object') {
          console.warn('[MRN] Skipping invalid row (not an object):', r);
          return false;
        }
        // Must have at least po
        if (!r.po || String(r.po).trim() === '') {
          console.warn('[MRN] Skipping row without PO:', r);
          return false;
        }
        return true;
      })
      .map((r, index) => {
        const row = {
          po:    String(r.po   || '').trim(),
          model: String(r.model|| r.style || 'Unknown').trim(), // Accept style as model fallback
          color: String(r.color|| r.colour || 'Not specified').trim(), // Accept colour spelling
          sizes: normalizeSizes(r.sizes),
          total: parseInt(r.total) || 0,
        };
        console.log(`[MRN] Row ${index + 1}:`, row);
        return row;
      });
      
    console.log('[MRN] Validated', validRows.length, 'rows from', parsed.length, 'total');
    return validRows;
    
  } catch (err) {
    console.error('[MRN] JSON parse error:', err.message);
    console.error('[MRN] Failed JSON string (first 1000 chars):', jsonStr.substring(0, 1000));
    return [];
  }
}

function normalizeSizes(sizesObj) {
  if (!sizesObj || typeof sizesObj !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(sizesObj)) {
    const qty = parseInt(v);
    if (!isNaN(qty) && qty > 0) {
      out[String(k)] = qty;
    }
  }
  return out;
}

/* ─────────────────────────────────────────────────────────────
   RENDER MRN TABLE
   ───────────────────────────────────────────────────────────── */
function renderMRNTable(rows) {
  const tbody = document.getElementById('mrnTableBody');
  const tfoot = document.getElementById('mrnTableFoot');
  if (!tbody || !tfoot) return;

  let grandTotal = 0;

  tbody.innerHTML = rows.map((row, i) => {
    grandTotal += row.total;
    const hex       = colorToHex(row.color);
    const sizePills = Object.entries(row.sizes)
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
      .map(([sz, qty]) =>
        `<span class="size-pill">
          <span>${sz}</span>
          <span class="pill-qty">×${qty}</span>
        </span>`
      ).join('');

    return `
      <tr>
        <td style="color:var(--clr-text-muted);font-size:0.72rem;font-weight:600">${String(i + 1).padStart(2, '0')}</td>
        <td><span class="po-badge">${escapeHTML(row.po)}</span></td>
        <td style="font-weight:600">${escapeHTML(row.model)}</td>
        <td>
          <div class="color-swatch">
            <span class="swatch-dot" style="background:${hex}"></span>
            ${escapeHTML(row.color)}
          </div>
        </td>
        <td><div class="size-pills">${sizePills || '<span style="color:var(--clr-text-muted)">—</span>'}</div></td>
        <td><span class="qty-total">${row.total}</span></td>
      </tr>`;
  }).join('');

  tfoot.innerHTML = `
    <tr>
      <td colspan="5" style="text-align:right;letter-spacing:0.06em;font-size:0.72rem;text-transform:uppercase;color:var(--clr-text-muted)">
        Grand Total
      </td>
      <td><span class="grand-total-val">${grandTotal}</span></td>
    </tr>`;
}

function populateMRNMeta() {
  const now  = new Date();
  const opts = { day: '2-digit', month: 'short', year: 'numeric' };

  const numEl  = document.getElementById('mrnDisplayNumber');
  const dateEl = document.getElementById('mrnDisplayDate');
  if (numEl)  numEl.textContent  = MRN.mrnNumber;
  if (dateEl) dateEl.textContent = now.toLocaleDateString('en-GB', opts).toUpperCase();
}

/* ─────────────────────────────────────────────────────────────
   PDF GENERATION  — Professional factory layout (A4 landscape)
   ───────────────────────────────────────────────────────────── */
function buildPDFDoc() {
  const { jsPDF } = window.jspdf;
  const doc    = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW  = doc.internal.pageSize.getWidth();   // 297
  const pageH  = doc.internal.pageSize.getHeight();  // 210
  const margin = 12;
  const now    = new Date();
  const user   = (sessionStorage.getItem('sm_user') || 'Unknown').toUpperCase();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();

  // ── Colour palette ──────────────────────────────────────────
  const C = {
    headerBg:   [0, 51, 102],      // dark navy
    headerText: [255, 255, 255],
    accentBg:   [0, 102, 153],     // medium blue
    accentText: [255, 255, 255],
    metaBg:     [240, 245, 250],   // very light blue-grey
    metaLabel:  [80, 100, 120],
    metaValue:  [20, 30, 50],
    tablHead:   [0, 71, 122],
    tablHeadT:  [255, 255, 255],
    tablFoot:   [220, 235, 245],
    tablFootT:  [0, 51, 102],
    rowEven:    [255, 255, 255],
    rowOdd:     [245, 250, 255],
    border:     [180, 200, 220],
    footerText: [140, 155, 170],
    red:        [180, 30, 30],
  };

  // ═══════════════════════════════════════════════════════════
  // HEADER BAR  (full-width navy)
  // ═══════════════════════════════════════════════════════════
  doc.setFillColor(...C.headerBg);
  doc.rect(0, 0, pageW, 22, 'F');

  // Company name — left
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...C.headerText);
  doc.text('CONCORD FOOTWEAR (PVT) LTD', margin, 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(180, 210, 240);
  doc.text('Outsole Production Department', margin, 16);

  // Document title — right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...C.headerText);
  doc.text('MATERIAL REQUISITION NOTE', pageW - margin, 10, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(180, 210, 240);
  doc.text('SOLE MATRIX — Production Tracking System', pageW - margin, 16, { align: 'right' });

  // ═══════════════════════════════════════════════════════════
  // META BOX  (light background, 3-column grid)
  // ═══════════════════════════════════════════════════════════
  const metaY = 24;
  const metaH = 18;
  doc.setFillColor(...C.metaBg);
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, metaY, pageW - margin * 2, metaH, 1, 1, 'FD');

  const colW   = (pageW - margin * 2) / 4;
  const labelY = metaY + 5.5;
  const valueY = metaY + 12;

  const metaFields = [
    { label: 'MRN REFERENCE',  value: MRN.mrnNumber },
    { label: 'DATE ISSUED',    value: dateStr },
    { label: 'PREPARED BY',    value: user },
    { label: 'DEPARTMENT',     value: 'OUTSOLE PRODUCTION' },
  ];

  metaFields.forEach((f, i) => {
    const x = margin + i * colW + 4;
    // Label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...C.metaLabel);
    doc.text(f.label, x, labelY);
    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...C.metaValue);
    doc.text(f.value, x, valueY);
    // Vertical divider (except last)
    if (i < 3) {
      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.2);
      doc.line(margin + (i + 1) * colW, metaY + 2, margin + (i + 1) * colW, metaY + metaH - 2);
    }
  });

  // ═══════════════════════════════════════════════════════════
  // DATA TABLE
  // ═══════════════════════════════════════════════════════════
  const allSizes = [...new Set(
    MRN.rows.flatMap(r => Object.keys(r.sizes).map(Number))
  )].sort((a, b) => a - b);

  const colHeaders = ['#', 'PO NUMBER', 'MODEL', 'OUTSOLE COLOUR', ...allSizes.map(String), 'TOTAL QTY'];

  const tableData = MRN.rows.map((row, i) => [
    String(i + 1).padStart(2, '0'),
    row.po,
    row.model,
    row.color,
    ...allSizes.map(sz => {
      const q = row.sizes[String(sz)];
      return q ? String(q) : '';
    }),
    String(row.total),
  ]);

  const grandTotal = MRN.rows.reduce((s, r) => s + r.total, 0);
  const footRow = [
    '', '', '', 'GRAND TOTAL',
    ...allSizes.map(sz => {
      const sum = MRN.rows.reduce((s, r) => s + (r.sizes[String(sz)] || 0), 0);
      return sum > 0 ? String(sum) : '';
    }),
    String(grandTotal),
  ];

  const sizeColW = Math.min(9, (pageW - margin * 2 - 8 - 26 - 20 - 28 - 18) / Math.max(allSizes.length, 1));

  const colStyles = {
    0: { halign: 'center', cellWidth: 8,  fontStyle: 'normal' },
    1: { halign: 'center', cellWidth: 26, fontStyle: 'bold'   },
    2: { halign: 'left',   cellWidth: 20                      },
    3: { halign: 'left',   cellWidth: 28                      },
    [colHeaders.length - 1]: { halign: 'center', cellWidth: 18, fontStyle: 'bold' },
  };
  // Size columns
  for (let i = 4; i < colHeaders.length - 1; i++) {
    colStyles[i] = { halign: 'center', cellWidth: sizeColW };
  }

  doc.autoTable({
    head:   [colHeaders],
    body:   tableData,
    foot:   [footRow],
    startY: metaY + metaH + 4,
    margin: { left: margin, right: margin },
    tableLineColor: C.border,
    tableLineWidth: 0.3,
    styles: {
      fontSize:    8,
      cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
      textColor:   C.metaValue,
      lineColor:   C.border,
      lineWidth:   0.2,
    },
    headStyles: {
      fillColor:  C.tablHead,
      textColor:  C.tablHeadT,
      fontStyle:  'bold',
      halign:     'center',
      fontSize:   7.5,
      cellPadding: { top: 4, right: 3, bottom: 4, left: 3 },
    },
    footStyles: {
      fillColor:  C.tablFoot,
      textColor:  C.tablFootT,
      fontStyle:  'bold',
      fontSize:   8.5,
    },
    alternateRowStyles: {
      fillColor: C.rowOdd,
    },
    bodyStyles: {
      fillColor: C.rowEven,
    },
    columnStyles: colStyles,
    didDrawPage: (data) => {
      // ── Page footer ────────────────────────────────────────
      const footY = pageH - 7;
      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.3);
      doc.line(margin, footY - 2, pageW - margin, footY - 2);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...C.footerText);
      doc.text(`MRN: ${MRN.mrnNumber}`, margin, footY + 1);
      doc.text(
        `Page ${data.pageNumber} — Generated by SOLE MATRIX on ${dateStr}`,
        pageW / 2, footY + 1,
        { align: 'center' }
      );
      doc.text('CONCORD FOOTWEAR (PVT) LTD — CONFIDENTIAL', pageW - margin, footY + 1, { align: 'right' });

      // ── "NOT VALID WITHOUT SIGNATURE" watermark row ────────
      const signY = pageH - 17;
      doc.setFillColor(250, 245, 230);
      doc.setDrawColor(200, 170, 100);
      doc.setLineWidth(0.2);
      doc.roundedRect(margin, signY, pageW - margin * 2, 8, 1, 1, 'FD');

      const sigColW = (pageW - margin * 2) / 3;
      const sigFields = ['PREPARED BY:', 'CHECKED BY:', 'APPROVED BY:'];
      sigFields.forEach((label, idx) => {
        const sx = margin + idx * sigColW + 3;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(120, 90, 30);
        doc.text(label, sx, signY + 3.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 60, 20);
        doc.text('_________________________', sx + 20, signY + 3.5);
        doc.text('Signature / Date', sx + 20, signY + 6.5);
      });
    },
  });

  return doc;
}

async function mrnDownloadPDF() {
  if (!MRN.rows.length) return;
  mrnToast('Generating PDF…', 'info');
  try {
    const doc = buildPDFDoc();
    doc.save(`${MRN.mrnNumber}.pdf`);
    mrnToast('PDF downloaded!', 'success');
  } catch (err) {
    console.error('[MRN] PDF error:', err);
    mrnToast('PDF generation failed. Please try again.', 'error');
  }
}

/* ─────────────────────────────────────────────────────────────
   SHARE  (Web Share API with PDF fallback)
   ───────────────────────────────────────────────────────────── */
async function mrnShare() {
  if (!MRN.rows.length) return;

  try {
    const doc  = buildPDFDoc();
    const blob = doc.output('blob');
    const file = new File([blob], `${MRN.mrnNumber}.pdf`, { type: 'application/pdf' });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title:  `MRN — ${MRN.mrnNumber}`,
        text:   `Material Requisition Note ${MRN.mrnNumber} from Concord Footwear (Pvt) Ltd`,
        files:  [file],
      });
    } else {
      // Fallback — download the PDF and show a message
      doc.save(`${MRN.mrnNumber}.pdf`);
      mrnToast('Sharing not supported — PDF downloaded instead.', 'info');
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('[MRN] Share error:', err);
      mrnToast('Could not share. PDF downloaded instead.', 'info');
    }
  }
}

/* ─────────────────────────────────────────────────────────────
   SUBMIT — generate PDF → upload to Cloudinary → save to Sheets
   ───────────────────────────────────────────────────────────── */
async function mrnSubmit() {
  if (!MRN.rows.length) return;

  const btn = document.getElementById('btnSubmitMrn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…';

  mrnToast('Generating PDF…', 'info');

  try {
    // 1. Build PDF blob
    const doc  = buildPDFDoc();
    const blob = doc.output('blob');
    MRN.pdfBlob = blob;

    mrnToast('Uploading to Cloudinary…', 'info');

    // 2. Upload to Cloudinary via signed upload
    const cloudUrl = await uploadToCloudinary(blob, MRN.mrnNumber);
    MRN.cloudUrl   = cloudUrl;

    // 3. Save MRN record + row data to Google Sheets (Pending_MRN tab)
    try {
      const user = sessionStorage.getItem('sm_user') || 'Unknown';
      const now  = new Date().toISOString();
      await fetch(CONFIG.SHEETBEST_MRN_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          MRN_Name:      MRN.mrnNumber,
          Cloudinary_URL: cloudUrl || '',
          Created_By:    user,
          Created_At:    now,
          Status:        'Pending',
          Row_Count:     MRN.rows.length,
          Grand_Total:   MRN.rows.reduce((s, r) => s + (r.total || 0), 0),
          // Store full row data as JSON string so Warehouse can read without Gemini
          Rows_JSON:     JSON.stringify(MRN.rows),
        }),
      });
      console.log('[MRN] Record + rows saved to Pending_MRN sheet');
    } catch (sheetErr) {
      console.warn('[MRN] Sheet save failed (non-blocking):', sheetErr.message);
    }

    // 4. Show success screen
    showSection('success');
    setStep(3);

    const successNo = document.getElementById('successMrnNo');
    if (successNo) successNo.textContent = MRN.mrnNumber;

    const linkRow = document.getElementById('cloudinaryLinkRow');
    const link    = document.getElementById('cloudinaryViewLink');
    if (cloudUrl && linkRow && link) {
      link.href = cloudUrl;
      linkRow.style.display = 'flex';
    }

    mrnToast('MRN saved to Cloudinary!', 'success');

    // ── "Switch to WhatsApp" action (MRN submitted & saved) ──
    if (typeof injectWhatsAppButton === 'function') {
      const waUser = sessionStorage.getItem('sm_user') || 'Unknown';
      const waNow  = new Date();
      injectWhatsAppButton(
        'mrnWhatsAppAction',
        waMsg([
          '*SOLE MATRIX — MRN Submitted*',
          '',
          '📄 MRN: ' + MRN.mrnNumber,
          '👤 Submitted by: ' + waUser + ' (Outsole Production)',
          '📅 Date: ' + waNow.toLocaleDateString('en-GB') + ' ' +
            waNow.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          '📦 Lines: ' + MRN.rows.length +
            ' | Total QTY: ' + MRN.rows.reduce((s, r) => s + (r.total || 0), 0),
          '📌 Status: Pending — ready for Warehouse & Logistics review',
        ]),
        {
          label: 'Switch to WhatsApp',
          sub: 'Notify the team about this MRN',
          scenario: WA_SCENARIOS.MRN_SUBMITTED,
        }
      );
    }

  } catch (err) {
    console.error('[MRN] Submit error:', err);
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit & Save';
    mrnToast(err.message || 'Upload failed. Please try again.', 'error');
  }
}

/* ─────────────────────────────────────────────────────────────
   CLOUDINARY UPLOAD  — signed upload (no preset required)
   ───────────────────────────────────────────────────────────── */
async function uploadToCloudinary(pdfBlob, mrnNumber) {
  const timestamp = Math.floor(Date.now() / 1000);
  const folder    = CONFIG.CLOUDINARY_FOLDER;   // sole-matrix/pending-mrn
  const publicId  = mrnNumber;                  // just the filename, NOT including folder

  // Cloudinary signature: params in STRICT alphabetical order, raw values, NO encoding
  // Format: "key1=val1&key2=val2&key3=val3" + API_SECRET  (no & before secret)
  const sigStr = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${CONFIG.CLOUDINARY_API_SECRET}`;

  console.log('[Cloudinary] String to sign:', sigStr);

  // SHA-1 via Web Crypto API
  const msgBuffer  = new TextEncoder().encode(sigStr);
  const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer);
  const signature  = Array.from(new Uint8Array(hashBuffer))
                         .map(b => b.toString(16).padStart(2, '0')).join('');

  console.log('[Cloudinary] Signature:', signature);
  console.log('[Cloudinary] Uploading to folder:', folder, '| public_id:', publicId);

  const formData = new FormData();
  formData.append('file',          pdfBlob, `${mrnNumber}.pdf`);
  formData.append('api_key',       CONFIG.CLOUDINARY_API_KEY);
  formData.append('timestamp',     String(timestamp));
  formData.append('signature',     signature);
  formData.append('folder',        folder);
  formData.append('public_id',     publicId);
  formData.append('resource_type', 'raw');

  const url = `https://api.cloudinary.com/v1_1/${CONFIG.CLOUDINARY_CLOUD_NAME}/raw/upload`;

  const res = await fetchWithTimeout(url, { method: 'POST', body: formData }, 30000);

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error('[Cloudinary] Upload error:', err);
    throw new Error(err?.error?.message || `Cloudinary upload error ${res.status}`);
  }

  const data = await res.json();
  console.log('[Cloudinary] Upload success:', data.secure_url);
  return data.secure_url || null;
}

/* ─────────────────────────────────────────────────────────────
   RESET — go back to step 1
   ───────────────────────────────────────────────────────────── */
function mrnReset() {
  // Reset state
  Object.assign(MRN, {
    file: null, fileDataURL: null, fileMime: null,
    rows: [], mrnNumber: null, pdfBlob: null, cloudUrl: null, step: 1,
  });

  // Reset step indicators
  setStep(1);

  // Clear table
  const tbody = document.getElementById('mrnTableBody');
  const tfoot = document.getElementById('mrnTableFoot');
  if (tbody) tbody.innerHTML = '';
  if (tfoot) tfoot.innerHTML = '';

  // Reset submit button
  const btn = document.getElementById('btnSubmitMrn');
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit & Save';
  }

  // Reset AI steps
  ['aiS1','aiS2','aiS3','aiS4'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.className = 'ai-step-item';
  });

  // Reset file input visually
  mrnClearFile();

  // Show upload section
  showSection('upload');
}

/* ─────────────────────────────────────────────────────────────
   SECTION VISIBILITY
   ───────────────────────────────────────────────────────────── */
function showSection(which) {
  const sections = {
    upload:    'mrnUploadSection',
    aiOverlay: 'mrnAiOverlay',
    error:     'mrnParseError',
    result:    'mrnResultSection',
    success:   'mrnSuccessSection',
  };

  for (const [key, id] of Object.entries(sections)) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (key === which) {
      el.classList.add('visible');
      // Upload section uses block display, not flex, handle it:
      if (id === 'mrnUploadSection') {
        el.style.display = 'block';
      }
    } else {
      el.classList.remove('visible');
      if (id === 'mrnUploadSection') {
        el.style.display = which === 'upload' ? 'block' : 'none';
      }
    }
  }
  // Upload section has no .visible class — handle display directly
  const uploadEl = document.getElementById('mrnUploadSection');
  if (uploadEl) {
    uploadEl.style.display = which === 'upload' ? 'block' : 'none';
  }
}

/* ─────────────────────────────────────────────────────────────
   STEP INDICATOR
   ───────────────────────────────────────────────────────────── */
function setStep(n) {
  MRN.step = n;
  for (let i = 1; i <= 3; i++) {
    const el = document.getElementById(`mrnStep${i}`);
    if (!el) continue;
    el.classList.remove('active', 'done');
    if (i < n)      el.classList.add('done');
    else if (i === n) el.classList.add('active');
  }
}

function setAIStep(n, state) {
  const el = document.getElementById(`aiS${n}`);
  if (!el) return;
  el.classList.remove('active', 'done');
  el.classList.add(state);
}

/* ─────────────────────────────────────────────────────────────
   TOAST
   ───────────────────────────────────────────────────────────── */
let _toastTimer = null;

function mrnToast(message, type = 'info') {
  // Find or create toast (it may live outside mrnShell)
  let toast = document.getElementById('mrnToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id        = 'mrnToast';
    toast.className = 'mrn-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
  }

  const icons = { success: 'fa-circle-check', error: 'fa-circle-exclamation', info: 'fa-circle-info' };
  toast.innerHTML  = `<i class="fa-solid ${icons[type] || icons.info}"></i> ${escapeHTML(message)}`;
  toast.className  = `mrn-toast toast-${type} show`;

  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

/* ─────────────────────────────────────────────────────────────
   UTILITIES
   ───────────────────────────────────────────────────────────── */
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatBytes(bytes) {
  if (bytes < 1024)       return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function fetchWithTimeout(url, options, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs/1000}s. This may be due to a slow connection, large file size, or API issues. Try using a smaller or clearer image.`);
    }
    throw err;
  }
}

/* ═══════════════════════════════════════════════════════════════
   OCR ENGINE (Module 01) — Tesseract.js + pdf.js, fully on-device
   ───────────────────────────────────────────────────────────────
   Primary extraction path for MRN Creation. No API keys, no token
   limits, no data leaves the browser (only the CDN script loads).

   Pipeline:
     image → Tesseract.recognize (word bounding boxes)
     PDF   → pdf.js renders each page to canvas → same OCR
     words → group into lines (y-overlap) → cluster into columns
             (x-gaps) → detect header (PO/Model/Colour/Size/Total)
             → map data lines to {po, model, color, sizes, total}
   ═══════════════════════════════════════════════════════════════ */

const OCR_CDN = {
  tesseract: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',
  pdfjs:     'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  pdfWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
};

function loadScriptOnce(src, id) {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) return resolve();
    const s = document.createElement('script');
    s.id = id;
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load the OCR library from ' + src + '. Check your internet connection and try again.'));
    document.head.appendChild(s);
  });
}

/* ── PDF → canvas images (pdf.js), one data-URL per page (max 5) ── */
async function ocrPdfToImages(dataUrl) {
  await loadScriptOnce(OCR_CDN.pdfjs, 'pdfJsCdnScript');
  pdfjsLib.GlobalWorkerOptions.workerSrc = OCR_CDN.pdfWorker;
  const resp = await fetch(dataUrl);
  const buf  = await resp.arrayBuffer();
  const doc  = await pdfjsLib.getDocument({ data: buf }).promise;
  const pages = Math.min(doc.numPages, 5);
  const out   = [];
  for (let p = 1; p <= pages; p++) {
    const page     = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 2 });
    const canvas   = document.createElement('canvas');
    canvas.width   = viewport.width;
    canvas.height  = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    out.push(canvas.toDataURL('image/png'));
  }
  return out;
}

/* ── Run Tesseract over one or more images ───────────────────────── */
async function runOcr(imageUrls, statusCb) {
  await loadScriptOnce(OCR_CDN.tesseract, 'tesseractCdnScript');
  if (statusCb) statusCb('Loading OCR engine…');
  const worker = await Tesseract.createWorker('eng', 1, {
    logger: (m) => {
      if (m && m.status && typeof m.progress === 'number' && statusCb) {
        statusCb('OCR: ' + m.status + ' ' + Math.round(m.progress * 100) + '%');
      }
    },
  });
  try {
    await worker.setParameters({ tessedit_pageseg_mode: '6' });   /* uniform text block — best for tables */
    let words = [], textLines = [], confSum = 0, confN = 0;
    for (const url of imageUrls) {
      const { data } = await worker.recognize(url, {}, { text: true, blocks: true });
      confSum += data.confidence || 0;
      confN   += 1;
      if (data.words && data.words.length) words = words.concat(data.words);
      textLines = textLines.concat(String(data.text || '').split(/\r?\n/));
    }
    return { words, textLines, confidence: confN ? Math.round(confSum / confN) : 0 };
  } finally {
    try { await worker.terminate(); } catch (e) { /* ignore */ }
  }
}

/* ── Reconstruct table rows from OCR word boxes ──────────────────── */
function parseOcrWordsToRows(words) {
  const ws = (words || []).filter((w) => w && w.text && String(w.text).trim() !== '');
  if (ws.length < 8) return [];

  /* 1) group words into text lines by vertical centre */
  const sorted = ws.slice().sort((a, b) =>
    ((a.bbox.y0 + a.bbox.y1) / 2) - ((b.bbox.y0 + b.bbox.y1) / 2));
  const lines = [];
  let cur = null;
  sorted.forEach((w) => {
    const cy = (w.bbox.y0 + w.bbox.y1) / 2;
    const h  = w.bbox.y1 - w.bbox.y0;
    if (!cur || cy > cur.maxCy + h * 0.6) {
      cur = { words: [w], minCy: cy, maxCy: cy };
      lines.push(cur);
    } else {
      cur.words.push(w);
      cur.minCy = Math.min(cur.minCy, cy);
      cur.maxCy = Math.max(cur.maxCy, cy);
    }
  });
  lines.forEach((ln) => ln.words.sort((a, b) => a.bbox.x0 - b.bbox.x0));

  /* 2) split each line into cells on horizontal gaps */
  const rowsCells = lines.map((ln) => {
    const cells = [];
    let cell = null;
    ln.words.forEach((w) => {
      if (!cell) { cell = { text: w.text, x0: w.bbox.x0, x1: w.bbox.x1 }; return; }
      const gap   = w.bbox.x0 - cell.x1;
      const charW = Math.max(3, (cell.x1 - cell.x0) / Math.max(1, cell.text.length));
      if (gap > Math.max(charW * 2.2, 14)) {
        cells.push(cell);
        cell = { text: w.text, x0: w.bbox.x0, x1: w.bbox.x1 };
      } else {
        cell.text += ' ' + w.text;
        cell.x1    = Math.max(cell.x1, w.bbox.x1);
      }
    });
    if (cell) cells.push(cell);
    return cells;
  }).filter((cells) => cells.length >= 3);
  if (rowsCells.length < 2) return [];

  /* 3) find the header line and map its columns */
  let headerIdx = -1, colMap = null;
  for (let i = 0; i < Math.min(rowsCells.length, 8); i++) {
    const m = mapOcrHeaderRow(rowsCells[i]);
    if (m && m.po !== undefined && (m.total !== undefined || Object.keys(m.sizes).length >= 1)) {
      headerIdx = i;
      colMap    = m;
      break;
    }
  }
  if (headerIdx === -1) return [];

  /* 4) map every data line under the header */
  const out = [];
  for (let i = headerIdx + 1; i < rowsCells.length; i++) {
    const row = rowFromOcrCells(rowsCells[i], colMap);
    if (row) out.push(row);
  }
  return out;
}

function mapOcrHeaderRow(cells) {
  const map = { sizes: {} };
  cells.forEach((c, idx) => {
    const t = String(c.text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!t) return;
    if (map.po === undefined && /^po$|^pono$|^ponumber$|^purchasenumber$/.test(t)) map.po = idx;
    else if (map.model === undefined && /model|^art/.test(t)) map.model = idx;
    else if (map.color === undefined && /colou?r/.test(t)) map.color = idx;
    else if (map.total === undefined && /total|qty|quantity|grand/.test(t)) map.total = idx;
    else if (/^\d{2}$/.test(t) && +t >= 30 && +t <= 50) map.sizes[idx] = t;
    else if (/^size(\d{2})$/.test(t)) { const n = +t.replace('size', ''); if (n >= 30 && n <= 50) map.sizes[idx] = String(n); }
  });
  return map;
}

function rowFromOcrCells(cells, map) {
  const get = (idx) => (idx === undefined || !cells[idx]) ? '' : String(cells[idx].text || '').trim();
  const po  = get(map.po).replace(/[^\d]/g, '');
  if (!po || po.length < 4) return null;
  const sizes = {};
  let sum = 0;
  Object.keys(map.sizes).forEach((idx) => {
    const v = get(+idx).replace(/[^0-9]/g, '');
    const n = v === '' ? 0 : parseInt(v, 10);
    if (!isNaN(n) && n > 0) { sizes[map.sizes[idx]] = n; sum += n; }
  });
  if (!Object.keys(sizes).length) return null;
  let total = sum;
  if (map.total !== undefined) {
    const t = parseInt(get(map.total).replace(/[^0-9]/g, ''), 10);
    if (!isNaN(t) && t > 0) total = t;
  }
  return {
    po,
    model: get(map.model) || 'Unknown',
    color: get(map.color) || 'Not specified',
    sizes,
    total,
  };
}

/* ── Fallback: plain text line parsing (when word boxes are absent) ── */
function parseOcrTextLines(lines) {
  const rows = [];
  (lines || []).forEach((line) => {
    const t = String(line || '').replace(/\|/g, '  ').trim();
    if (!t) return;
    const poMatch = t.match(/\b(\d{5,9})\b/);
    if (!poMatch) return;
    const po    = poMatch[1];
    const after = t.slice(t.indexOf(po) + po.length);
    const nums  = (after.match(/\d+/g) || []).map(Number).filter((n) => n >= 1 && n <= 999);
    const words = after.split(/[\s|]+/).filter((w) => /^[A-Za-z]{3,}$/.test(w));
    if (!rows.some((r) => r.po === po)) {
      rows.push({
        po,
        model: words[0] || 'Unknown',
        color: words[1] || 'Not specified',
        sizes: {},
        total: nums.length ? nums[nums.length - 1] : 0,
      });
    }
  });
  return rows;
}

/* ── OCR extraction used by mrnAnalyse() ─────────────────────────── */
async function mrnRunOcrExtraction() {
  const status = (msg) => {
    const el = document.getElementById('aiStatusTitle');
    if (el) el.textContent = msg;
  };

  let imageUrls;
  if (MRN.fileMime === 'application/pdf') {
    status('Rendering PDF pages…');
    imageUrls = await ocrPdfToImages(MRN.fileDataURL);
  } else {
    imageUrls = [MRN.fileDataURL];
  }

  status('Scanning with OCR…');
  const ocr = await runOcr(imageUrls, status);

  setAIStep(2, 'done');
  setAIStep(3, 'active');
  status('Extracting data…');
  await delay(200);

  let rows = [];
  try { rows = parseOcrWordsToRows(ocr.words); } catch (e) { console.warn('[MRN][OCR] grid parse failed:', e); }
  if (!rows.length) rows = parseOcrTextLines(ocr.textLines);

  return { rows, confidence: ocr.confidence };
}

/* ─────────────────────────────────────────────────────────────
   ANALYSE (backup) — on-device OCR extraction
   Invoked from the parse-error screen ("Try on-device OCR instead")
   when the OpenRouter vision path cannot read the plan.
   ───────────────────────────────────────────────────────────── */
async function mrnAnalyseWithOCR() {
  if (!MRN.fileDataURL) return;

  showSection('aiOverlay');
  setAIStep(1, 'active');

  try {
    // ── Step 1: Read file ─────────────────────────────────────
    await delay(300);
    setAIStep(1, 'done');

    // ── Step 2: OCR scan (Tesseract; pdf.js for PDFs) ─────────
    setAIStep(2, 'active');
    const { rows, confidence } = await mrnRunOcrExtraction();

    if (!rows || rows.length === 0) {
      throw new Error('OCR could not find any production-plan rows in this file. ' +
        'Make sure the whole table is visible, well-lit and straight, then try again.');
    }

    if (confidence && confidence < 60) {
      mrnToast('Low OCR confidence (' + confidence + '%) — please double-check the table before submitting.', 'error');
    }

    setAIStep(3, 'done');
    setAIStep(4, 'active');
    {
      const el = document.getElementById('aiStatusTitle');
      if (el) el.textContent = 'Building Digital MRN…';
    }
    await delay(400);

    // ── Step 4: Render MRN ────────────────────────────────────
    MRN.rows      = rows;
    MRN.mrnNumber = generateMRNNumber(MRN.file ? MRN.file.name : 'MRN');

    renderMRNTable(rows);
    populateMRNMeta();

    setAIStep(4, 'done');
    await delay(300);

    showSection('result');
    setStep(2);
    mrnToast('MRN extracted with on-device OCR!', 'success');

  } catch (err) {
    console.error('[MRN] OCR error:', err);
    showSection('error');
    const msgEl = document.getElementById('parseErrorMsg');
    if (msgEl) msgEl.textContent = (err.message || 'OCR failed unexpectedly.') + ' Tip: use "Try AI extraction instead" below.';
  }
}
