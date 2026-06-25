const test = require("node:test");
const assert = require("node:assert/strict");
const PizZip = require("pizzip");

const {
  extractTemplatePlaceholders,
  extractDocxXmlPlainText,
  readDocxTemplatePlaceholders
} = require("../chat-proxy");

function buildDocxBuffer(mFiles) {
  const zip = new PizZip();
  Object.keys(mFiles).forEach(function(sPath) {
    zip.file(sPath, mFiles[sPath]);
  });
  return zip.generate({ type: "nodebuffer" });
}

test("extractTemplatePlaceholders finds {{name}} tokens once each", function() {
  const found = extractTemplatePlaceholders("Ajanlatszam: {{quote_no}}, Datum: {{ quote_date }}, ismet: {{quote_no}}");
  assert.deepEqual(found, ["quote_no", "quote_date"]);
});

test("extractDocxXmlPlainText reconstructs text split across <w:t> runs", function() {
  const xml = "<w:p><w:r><w:t>{{</w:t></w:r><w:r><w:t>cegnev</w:t></w:r><w:r><w:t>}}</w:t></w:r></w:p>";
  assert.equal(extractDocxXmlPlainText(xml), "{{cegnev}}");
});

test("readDocxTemplatePlaceholders detects a placeholder split across runs in document.xml", function() {
  const documentXml = "<w:p><w:r><w:t>{{</w:t></w:r><w:r><w:t>cegnev</w:t></w:r><w:r><w:t>}}</w:t></w:r></w:p>";
  const buffer = buildDocxBuffer({ "word/document.xml": documentXml });
  const found = readDocxTemplatePlaceholders(buffer, "");
  assert.deepEqual(found, ["cegnev"]);
});

test("readDocxTemplatePlaceholders scans headers and footers, not just document.xml", function() {
  const buffer = buildDocxBuffer({
    "word/document.xml": "<w:p><w:r><w:t>Teszt {{ajanlatszam}} szoveg</w:t></w:r></w:p>",
    "word/header1.xml": "<w:p><w:r><w:t>{{cegnev}}</w:t></w:r></w:p>",
    "word/footer1.xml": "<w:p><w:r><w:t>{{lablabel}}</w:t></w:r></w:p>"
  });
  const found = readDocxTemplatePlaceholders(buffer, "");
  assert.deepEqual(found.sort(), ["ajanlatszam", "cegnev", "lablabel"].sort());
});

test("readDocxTemplatePlaceholders returns an empty list when there are no placeholders", function() {
  const buffer = buildDocxBuffer({ "word/document.xml": "<w:p><w:r><w:t>Nincs token itt.</w:t></w:r></w:p>" });
  const found = readDocxTemplatePlaceholders(buffer, "");
  assert.deepEqual(found, []);
});
