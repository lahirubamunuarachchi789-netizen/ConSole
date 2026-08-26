const fs = require('fs');
const code = fs.readFileSync('d:/LN Web/sole-matrix/assets/js/mrn.js', 'utf8');
const prelude = 'var CONFIG = { GEMINI_MODEL:"gemini-3.6-flash", GEMINI_API_KEY:"", GEMINI_PROXY_URL:"http://localhost:8787/api/gemini", GROQ_PROXY_URL:"http://localhost:8787/api/groq", GEMINI_PROXY_TOKEN:"", SHEETBEST_MRN_URL:"" };';
eval(prelude + '\n' + code + '\n;globalThis.__T = { parseOcrWordsToRows, parseOcrTextLines,\n  ocrPdfToImages: typeof ocrPdfToImages,\n  runOcr: typeof runOcr,\n  mrnAnalyse: typeof mrnAnalyse,\n  mrnAnalyseWithOCR: typeof mrnAnalyseWithOCR,\n  mrnRunOcrExtraction: typeof mrnRunOcrExtraction };');
console.log('FUNCTIONS →', JSON.stringify(globalThis.__T));

const T = globalThis.__T;
function W(text, x0, y0, x1, y1) { return { text, bbox: { x0, y0, x1, y1 } }; }

/* synthetic plan table: header + 2 data rows */
const words = [
  W('PO', 10, 0, 30, 12), W('MODEL', 110, 0, 160, 12), W('COLOUR', 210, 0, 265, 12),
  W('40', 310, 0, 330, 12), W('41', 410, 0, 430, 12), W('42', 510, 0, 530, 12), W('TOTAL', 610, 0, 655, 12),
  W('147352', 5, 20, 55, 32), W('Elite', 110, 20, 145, 32), W('Black', 210, 20, 250, 32),
  W('12', 312, 20, 328, 32), W('30', 412, 20, 428, 32), W('24', 512, 20, 528, 32), W('66', 615, 20, 635, 32),
  W('147353', 5, 40, 55, 52), W('Epic', 110, 40, 140, 52), W('Gray', 210, 40, 245, 52),
  W('5', 314, 40, 326, 52), W('10', 414, 40, 426, 52), W('-', 514, 40, 520, 52), W('15', 618, 40, 634, 52),
];

const rows = T.parseOcrWordsToRows(words);
console.log('GRID PARSE →', JSON.stringify(rows, null, 1));

const pass1 = rows.length === 2
  && rows[0].po === '147352' && rows[0].model === 'Elite' && rows[0].color === 'Black'
  && rows[0].sizes['40'] === 12 && rows[0].sizes['41'] === 30 && rows[0].sizes['42'] === 24 && rows[0].total === 66
  && rows[1].po === '147353' && rows[1].sizes['40'] === 5 && rows[1].sizes['41'] === 10
  && !rows[1].sizes['42'] && rows[1].total === 15;
console.log('GRID TEST:', pass1 ? 'PASS ✓' : 'FAIL ✗');

const fb = T.parseOcrTextLines(['147352 Elite Black 12 30 24 66', 'no po here', '147353 Epic Gray 5 10 15']);
console.log('FALLBACK PARSE →', JSON.stringify(fb));
const pass2 = fb.length === 2 && fb[0].po === '147352' && fb[0].total === 66 && fb[1].po === '147353';
console.log('FALLBACK TEST:', pass2 ? 'PASS ✓' : 'FAIL ✗');

process.exit(pass1 && pass2 ? 0 : 1);