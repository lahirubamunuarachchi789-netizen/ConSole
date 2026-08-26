// ═══════════════════════════════════════════════════════════════
//  SOLE MATRIX — Google Apps Script Backend
//  Concord Footwear (Pvt) Ltd
// ───────────────────────────────────────────────────────────────
//  ⚠  NOT REQUIRED — The app now uses SheetBest API directly.
//     This file is kept for reference only.
//     API endpoint: https://api.sheetbest.com/sheets/dd583123-...
// ───────────────────────────────────────────────────────────────
//  DEPLOYMENT INSTRUCTIONS (archived):
//  1. Open Google Sheets → Extensions → Apps Script
//  2. Paste this entire file into the editor
//  3. Click Deploy → New Deployment
//  4. Type: Web App
//  5. Execute as: Me
//  6. Who has access: Anyone  (or "Anyone with Google account")
//  7. Click Deploy → Authorise
//  8. Copy the Web App URL into assets/js/config.js → APPS_SCRIPT_URL
// ═══════════════════════════════════════════════════════════════

// ─── Configuration ────────────────────────────────────────────
const SHEET_NAME = 'Login';  // Name of the sheet tab

// Column positions (1-indexed)
const COL_USERNAME   = 1;  // Column A
const COL_PASSWORD   = 2;  // Column B
const COL_DEPARTMENT = 3;  // Column C


// ─── CORS Headers helper ──────────────────────────────────────
function buildOutput(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}


// ─── Entry Point ──────────────────────────────────────────────
// Handles GET requests from the web app
function doGet(e) {
  try {
    const action = (e.parameter.action || '').toLowerCase().trim();

    if (action === 'login') {
      return handleLogin(e.parameter);
    }

    if (action === 'register') {
      return handleRegister(e.parameter);
    }

    // Health check
    if (action === 'ping') {
      return buildOutput({ success: true, message: 'SOLE MATRIX API is online.' });
    }

    return buildOutput({ success: false, message: 'Unknown action.' });

  } catch (err) {
    console.error('doGet error:', err);
    return buildOutput({ success: false, message: 'Internal server error: ' + err.message });
  }
}


// ─── doPost (optional — same logic, supports POST requests) ───
function doPost(e) {
  return doGet(e);
}


// ─── LOGIN ────────────────────────────────────────────────────
function handleLogin(params) {
  const username = sanitize(params.username || '');
  const password = sanitize(params.password || '');

  // Basic input validation
  if (!username || !password) {
    return buildOutput({ success: false, message: 'Username and password are required.' });
  }

  const sheet = getLoginSheet();
  if (!sheet) {
    return buildOutput({ success: false, message: 'Login sheet not found. Please contact your administrator.' });
  }

  const data = sheet.getDataRange().getValues();

  for (let i = 0; i < data.length; i++) {
    const row        = data[i];
    const rowUser    = String(row[COL_USERNAME - 1] || '').trim();
    const rowPass    = String(row[COL_PASSWORD - 1] || '').trim();
    const rowDept    = String(row[COL_DEPARTMENT - 1] || '').trim();

    // Case-insensitive username match, exact password match
    if (rowUser.toLowerCase() === username.toLowerCase() && rowPass === password) {
      return buildOutput({
        success:    true,
        username:   rowUser,
        department: rowDept,
        token:      generateToken(rowUser),  // Simple session token
        message:    'Login successful.',
      });
    }
  }

  return buildOutput({ success: false, message: 'Incorrect username or password.' });
}


// ─── REGISTER ─────────────────────────────────────────────────
function handleRegister(params) {
  const username   = sanitize(params.username   || '');
  const password   = sanitize(params.password   || '');
  const department = sanitize(params.department || '');

  // Validate required fields
  if (!username || !password || !department) {
    return buildOutput({ success: false, message: 'Username, password and department are all required.' });
  }

  // Validate username format
  if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
    return buildOutput({ success: false, message: 'Username contains invalid characters.' });
  }

  if (username.length < 3) {
    return buildOutput({ success: false, message: 'Username must be at least 3 characters.' });
  }

  if (password.length < 6) {
    return buildOutput({ success: false, message: 'Password must be at least 6 characters.' });
  }

  const sheet = getLoginSheet();
  if (!sheet) {
    return buildOutput({ success: false, message: 'Login sheet not found. Please contact your administrator.' });
  }

  // Check if username already exists (case-insensitive)
  const data = sheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    const rowUser = String(data[i][COL_USERNAME - 1] || '').trim();
    if (rowUser.toLowerCase() === username.toLowerCase()) {
      return buildOutput({ success: false, message: 'This username is already taken. Please choose another.' });
    }
  }

  // Append new user row: [Username, Password, Department]
  sheet.appendRow([username, password, department]);

  // Log registration event
  console.log(`[SOLE MATRIX] New user registered: ${username} | Department: ${department}`);

  return buildOutput({
    success:  true,
    username: username,
    message:  'Registration successful.',
  });
}


// ─── HELPERS ──────────────────────────────────────────────────

/**
 * Returns the Login sheet, or null if it doesn't exist.
 */
function getLoginSheet() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);

    // Auto-create the sheet with headers if it doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.getRange(1, COL_USERNAME).setValue('Username');
      sheet.getRange(1, COL_PASSWORD).setValue('Password');
      sheet.getRange(1, COL_DEPARTMENT).setValue('Department');

      // Style the header row
      const header = sheet.getRange(1, 1, 1, 3);
      header.setBackground('#1a1a2e');
      header.setFontColor('#f97316');
      header.setFontWeight('bold');
      header.setFontSize(11);

      // Freeze header row
      sheet.setFrozenRows(1);

      // Set column widths
      sheet.setColumnWidth(COL_USERNAME,   180);
      sheet.setColumnWidth(COL_PASSWORD,   180);
      sheet.setColumnWidth(COL_DEPARTMENT, 220);

      console.log('[SOLE MATRIX] Login sheet created with headers.');
    }

    return sheet;
  } catch (err) {
    console.error('getLoginSheet error:', err);
    return null;
  }
}

/**
 * Removes leading/trailing whitespace and strips HTML-like characters.
 */
function sanitize(value) {
  return String(value)
    .trim()
    .replace(/[<>"'`]/g, '');
}

/**
 * Generates a lightweight session token (not cryptographic — for
 * basic session identification only). For production, use proper
 * JWT or OAuth.
 */
function generateToken(username) {
  const ts     = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `${username}-${ts}-${random}`;
}
