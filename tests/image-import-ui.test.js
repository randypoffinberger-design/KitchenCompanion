const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
const app = fs.readFileSync(path.resolve(__dirname, '..', 'app.js'), 'utf8');
const ocr = fs.readFileSync(path.resolve(__dirname, '..', 'ocr-service.js'), 'utf8');

assert.match(html, /id="parseRecognizedRecipe" hidden/);
assert.match(app, /function setImageImportStage\(stage\)/);
assert.match(app, /function previewRecipeImages\(\) \{\s*setImageImportStage\('select'\)/);
assert.match(ocr, /KCImageImportUi[?][.]setStage\('ready'\)/);
assert.match(ocr, /KCImageImportUi[?][.]setStage\('select'\)/);

console.log('Image import UI regression passed: Parse is gated behind successful OCR.');
