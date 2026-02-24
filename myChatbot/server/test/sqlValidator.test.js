const test = require("node:test");
const assert = require("node:assert/strict");
const { parseSchemaHint, validateSelectSql } = require("../sqlValidator");

const schemaHint = [
  "Customer: CustomerId, CustomerName, Country, Segment",
  "SalesOrder: SalesOrderId, CustomerId, OrderDate, NetAmount, Currency"
].join("\n");

const tableMap = parseSchemaHint(schemaHint);

test("1) 1005 order id net amount + currency", () => {
  const sql = "SELECT SalesOrderId, NetAmount, Currency FROM SalesOrder WHERE SalesOrderId = 1005 LIMIT 50";
  const result = validateSelectSql(sql, tableMap);
  assert.equal(result.ok, true);
});

test("2) ismeretlen oszlop validacio", () => {
  const sql = "SELECT UnknownColumn FROM SalesOrder LIMIT 50";
  const result = validateSelectSql(sql, tableMap);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /ismeretlen|engedelyezett/i);
});

test("3) DROP TABLE tiltva", () => {
  const sql = "DROP TABLE SalesOrder";
  const result = validateSelectSql(sql, tableMap);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /tiltott|select/i);
});

test("4) ures talalat eseten SQL valid", () => {
  const sql = "SELECT SalesOrderId FROM SalesOrder WHERE SalesOrderId = 999999 LIMIT 50";
  const result = validateSelectSql(sql, tableMap);
  assert.equal(result.ok, true);
});

test("5) tobb statement tiltva", () => {
  const sql = "SELECT SalesOrderId FROM SalesOrder LIMIT 50; SELECT CustomerId FROM Customer LIMIT 50";
  const result = validateSelectSql(sql, tableMap);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /tiltott|statement|;/i);
});

test("6) havi aggregacio strftime + alias valid", () => {
  const sql = "SELECT strftime('%Y-%m', OrderDate) AS Honap, SUM(NetAmount) AS NettoOsszeg FROM SalesOrder WHERE strftime('%Y', OrderDate) = '2025' GROUP BY Honap ORDER BY Honap LIMIT 50";
  const result = validateSelectSql(sql, tableMap);
  assert.equal(result.ok, true);
});

