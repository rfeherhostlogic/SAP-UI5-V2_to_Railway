const test = require("node:test");
const assert = require("node:assert/strict");
const { buildQuotedColumnResolutionHints, buildSqlUserPrompt } = require("../dummy4Service");

const schemaHint = [
  "Customer: CustomerId, CustomerName, Country, Segment",
  "SalesOrder: SalesOrderId, CustomerId, OrderDate, NetAmount, Currency"
].join("\n");

test("1) quoted typo column maps to closest schema column", function() {
  const question = "Mennyi 'NetAmount' volt 2025-ben 'Currencyn'kent?";
  const hints = buildQuotedColumnResolutionHints(question, schemaHint);
  assert.match(hints, /'NetAmount' -> SalesOrder\.NetAmount/);
  assert.match(hints, /'Currencyn' -> SalesOrder\.Currency/);
});

test("2) sql user prompt includes resolved column hints", function() {
  const question = "Mennyi 'NetAmount' volt 2025-ben 'Currencyn'kent?";
  const prompt = buildSqlUserPrompt({
    question: question,
    schemaHint: schemaHint,
    dialect: "SQLite",
    retryError: ""
  });

  assert.match(prompt, /Feloldott oszloputalasok a kerdeshez/);
  assert.match(prompt, /SalesOrder\.Currency/);
});
