const test = require("node:test");
const assert = require("node:assert/strict");
const PizZip = require("pizzip");

const {
  extractTemplatePlaceholders,
  extractDocxXmlPlainText,
  extractDocxXmlParagraphs,
  readDocxTemplatePlaceholders,
  buildPlaceholderContextMap,
  isQuoteGroupBPlaceholder,
  labelForPlaceholder,
  classifyQuotePlaceholders,
  generateQuotePlaceholderValues,
  buildQuoteDocxBuffer
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

test("readDocxTemplatePlaceholders returns a sorted, deduplicated list", function() {
  const buffer = buildDocxBuffer({
    "word/document.xml": "<w:p><w:r><w:t>{{total_net}} {{customer_legal_name}} {{customer_legal_name}}</w:t></w:r></w:p>"
  });
  const found = readDocxTemplatePlaceholders(buffer, "");
  assert.deepEqual(found, ["customer_legal_name", "total_net"]);
});

test("isQuoteGroupBPlaceholder classifies block fields correctly", function() {
  assert.equal(isQuoteGroupBPlaceholder("pricing_block"), true);
  assert.equal(isQuoteGroupBPlaceholder("product_introduction"), true);
  assert.equal(isQuoteGroupBPlaceholder("customer_legal_name"), false);
  assert.equal(isQuoteGroupBPlaceholder("unknown_field"), false);
});

test("labelForPlaceholder returns the Hungarian mapping for known fields", function() {
  assert.equal(labelForPlaceholder("customer_legal_name"), "Ügyfél teljes neve");
  assert.equal(labelForPlaceholder("proposal_title"), "Ajánlat címe");
});

test("labelForPlaceholder falls back to a readable title for unknown fields", function() {
  assert.equal(labelForPlaceholder("some_unknown_field"), "Some Unknown Field");
});

test("classifyQuotePlaceholders attaches name/label/group/documentContext to every placeholder", function() {
  const classified = classifyQuotePlaceholders(["customer_legal_name", "pricing_block"]);
  assert.deepEqual(classified, [
    { name: "customer_legal_name", label: "Ügyfél teljes neve", group: "simple", documentContext: "" },
    { name: "pricing_block", label: "Árazási szakasz", group: "block", documentContext: "" }
  ]);
});

test("classifyQuotePlaceholders includes documentContext from contextMap when provided", function() {
  const contextMap = { customer_legal_name: "Jelen ajánlat {{customer_legal_name}} részére készült." };
  const classified = classifyQuotePlaceholders(["customer_legal_name", "pricing_block"], contextMap);
  assert.equal(classified[0].documentContext, "Jelen ajánlat {{customer_legal_name}} részére készült.");
  assert.equal(classified[1].documentContext, "");
});

test("extractDocxXmlParagraphs splits XML into paragraph text strings", function() {
  const xml = [
    "<w:p><w:r><w:t>Elso bekezdes.</w:t></w:r></w:p>",
    "<w:p><w:r><w:t>Masodik bekezdes {{cegnev}} szoveggel.</w:t></w:r></w:p>",
    "<w:p><w:r><w:t>Harmadik bekezdes.</w:t></w:r></w:p>"
  ].join("");
  const paras = extractDocxXmlParagraphs(xml);
  assert.equal(paras.length, 3);
  assert.equal(paras[1], "Masodik bekezdes {{cegnev}} szoveggel.");
});

test("buildPlaceholderContextMap returns the paragraph containing each placeholder", function() {
  // Both sentences are >60 chars without their placeholder, so no neighbour expansion occurs.
  const cegnev = "Jelen ajanlat kizarolag {{customer_legal_name}} szamara keszult es bizalmasan kezelendo.";
  const ervenyesseg = "Az ajanlat {{validity_period}} napig ervenyes a kiallitas datumatol szamitott lejartaig.";
  const documentXml = [
    "<w:p><w:r><w:t>Bevezeto mondat elszigeteleshez.</w:t></w:r></w:p>",
    "<w:p><w:r><w:t>" + cegnev + "</w:t></w:r></w:p>",
    "<w:p><w:r><w:t>" + ervenyesseg + "</w:t></w:r></w:p>"
  ].join("");
  const buffer = buildDocxBuffer({ "word/document.xml": documentXml });
  const contextMap = buildPlaceholderContextMap(buffer);
  assert.equal(contextMap["customer_legal_name"], cegnev);
  assert.equal(contextMap["validity_period"], ervenyesseg);
});

test("buildPlaceholderContextMap expands context for short paragraphs with adjacent sentences", function() {
  const documentXml = [
    "<w:p><w:r><w:t>Az ajanlat a kovetkező felek kozott jontre.</w:t></w:r></w:p>",
    "<w:p><w:r><w:t>{{customer_legal_name}}</w:t></w:r></w:p>",
    "<w:p><w:r><w:t>mint megrendelő reszere.</w:t></w:r></w:p>"
  ].join("");
  const buffer = buildDocxBuffer({ "word/document.xml": documentXml });
  const contextMap = buildPlaceholderContextMap(buffer);
  // Short paragraph → should include neighbors
  assert.ok(contextMap["customer_legal_name"].includes("{{customer_legal_name}}"));
  assert.ok(contextMap["customer_legal_name"].includes("Az ajanlat"));
  assert.ok(contextMap["customer_legal_name"].includes("mint megrendelő"));
});

test("buildPlaceholderContextMap returns empty object for buffer with no placeholders", function() {
  const buffer = buildDocxBuffer({ "word/document.xml": "<w:p><w:r><w:t>Nincs token.</w:t></w:r></w:p>" });
  const contextMap = buildPlaceholderContextMap(buffer);
  assert.deepEqual(contextMap, {});
});

test("generateQuotePlaceholderValues uses manual values when no placeholderContextMap in session", async function() {
  const session = {
    templatePlaceholders: ["customer_legal_name", "scope_block"]
  };
  const manualValues = {
    customer_legal_name: "Acme Kft.",
    scope_block: "A projekt 3 honapig tart."
  };
  const result = await generateQuotePlaceholderValues(session, "Context szoveg", manualValues);
  assert.equal(result.values["customer_legal_name"], "Acme Kft.");
  assert.equal(result.values["scope_block"], "A projekt 3 honapig tart.");
  assert.deepEqual(result.missingPlaceholders, []);
});

test("generateQuotePlaceholderValues sets empty simple field as missing when no context map", async function() {
  const session = {
    templatePlaceholders: ["customer_legal_name"]
  };
  const result = await generateQuotePlaceholderValues(session, "Context szoveg", {});
  assert.equal(result.values.customer_legal_name, "");
  assert.equal(result.missingPlaceholders.length, 1);
  assert.equal(result.missingPlaceholders[0].name, "customer_legal_name");
});

test("buildQuoteDocxBuffer replaces unresolved placeholders with [TÖLTSE KI] and leaves no raw {{...}} tokens", async function() {
  const documentXml = "<w:p><w:r><w:t>Ugyfel: {{customer_legal_name}}, Cim: {{proposal_title}}</w:t></w:r></w:p>";
  const templateBuffer = buildDocxBuffer({
    "[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    "_rels/.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    "word/document.xml": documentXml
  });
  const session = {
    templateBuffer: templateBuffer,
    templatePlaceholders: ["customer_legal_name", "proposal_title"],
    placeholderValues: { customer_legal_name: "Acme Kft." }
  };
  const outBuffer = await buildQuoteDocxBuffer(null, session);
  const outZip = new PizZip(outBuffer);
  const outXml = outZip.file("word/document.xml").asText();
  assert.match(outXml, /Acme Kft\./);
  assert.match(outXml, /\[TÖLTSE KI\]/);
  assert.doesNotMatch(outXml, /\{\{/);
});
