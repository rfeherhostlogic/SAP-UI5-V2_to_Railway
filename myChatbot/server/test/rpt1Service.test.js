const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildChartRows,
  parseCsv,
  predictFromRows,
  splitPredictionRows
} = require("../rpt1Service");

test("parseCsv recognizes numbers, booleans, dates, and [PREDICT]", function() {
  const parsed = parseCsv([
    "Transaction ID,Days Late,Has Dispute,Expected Income date",
    "TXN-1,[PREDICT],FALSE,[PREDICT]",
    "TXN-2,12,TRUE,2026-05-01"
  ].join("\n"));

  assert.deepEqual(parsed.headers, [
    "Transaction ID",
    "Days Late",
    "Has Dispute",
    "Expected Income date"
  ]);
  assert.equal(parsed.rows[0]["Days Late"], "[PREDICT]");
  assert.equal(parsed.rows[0]["Expected Income date"], "[PREDICT]");
  assert.equal(parsed.rows[1]["Days Late"], 12);
  assert.equal(parsed.rows[1]["Has Dispute"], true);
  assert.equal(parsed.rows[1]["Expected Income date"], "2026-05-01");
});

test("splitPredictionRows separates context and query rows", function() {
  const split = splitPredictionRows([
    { "Transaction ID": "TXN-1", "Days Late": "[PREDICT]" },
    { "Transaction ID": "TXN-2", "Days Late": 5 }
  ]);

  assert.equal(split.queryRows.length, 1);
  assert.equal(split.contextRows.length, 1);
  assert.deepEqual(split.queryRows[0].__predictColumns, ["Days Late"]);
});

test("predictFromRows batches query rows and merges prediction output", async function() {
  const headers = ["Transaction ID", "Invoice Amount", "Days Late", "Expected Income date"];
  const rows = [];
  let fetchCalls = 0;

  for (let i = 0; i < 30; i += 1) {
    rows.push({
      "Transaction ID": "Q-" + i,
      "Invoice Amount": 100 + i,
      "Days Late": "[PREDICT]",
      "Expected Income date": "[PREDICT]"
    });
  }

  rows.push({
    "Transaction ID": "C-1",
    "Invoice Amount": 1000,
    "Days Late": 3,
    "Expected Income date": "2026-05-01"
  });
  rows.push({
    "Transaction ID": "C-2",
    "Invoice Amount": 2000,
    "Days Late": 8,
    "Expected Income date": "2026-06-01"
  });

  const fetchImpl = async function(_url, options) {
    fetchCalls += 1;
    const body = JSON.parse(options.body);
    const payloadRows = body.rows || body.data || [];
    const queryRows = payloadRows.filter(function(row) {
      return row["Days Late"] === "[PREDICT]" || row["Expected Income date"] === "[PREDICT]";
    });
    const predictions = queryRows.map(function(row, index) {
      return {
        "Transaction ID": row["Transaction ID"],
        "Days Late": [{ prediction: 10 + index, confidence: 0.9 }],
        "Expected Income date": [{ prediction: index % 2 === 0 ? "2026-05-20" : "2026-06-15", confidence: 0.8 }]
      };
    });
    return {
      ok: true,
      json: async function() {
        return {
          prediction: {
            predictions: predictions
          }
        };
      }
    };
  };

  const result = await predictFromRows(rows, headers, "token", fetchImpl);

  assert.equal(fetchCalls, 2);
  assert.equal(result.queryCount, 30);
  assert.equal(result.contextCount, 2);
  assert.equal(result.predictionRows.length, 30);
  assert.equal(result.predictionRows[0]["Predicted Days Late"], 10);
  assert.equal(result.predictionRows[0]["Predicted Expected Income date"], "2026-05-20");
});

test("buildChartRows merges predicted cashflow into the next three months", function() {
  const rows = [
    { "Invoice Amount": 100, "Expected Income date": "2026-05-11" },
    { "Invoice Amount": 250, "Expected Income date": "2026-06-02" },
    { "Invoice Amount": 75, "Expected Income date": "2026-07-19" },
    { "Invoice Amount": 999, "Expected Income date": "2026-08-01" }
  ];
  const chartRows = buildChartRows(rows, {
    amountColumn: "Invoice Amount",
    dateColumn: "Expected Income date"
  });

  assert.equal(chartRows[0].predictedIncrementalCashflow, 100);
  assert.equal(chartRows[1].predictedIncrementalCashflow, 250);
  assert.equal(chartRows[2].predictedIncrementalCashflow, 75);
  assert.equal(chartRows[0].predictedCashflow, 208262609.73);
  assert.equal(chartRows[1].predictedCashflow, 20908393.32);
  assert.equal(chartRows[2].predictedCashflow, 67206.92);
});
