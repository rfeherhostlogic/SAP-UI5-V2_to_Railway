"use strict";

const RPT1_API_URL = "https://rpt.cloud.sap/api/predict";
const RPT1_MAX_QUERY_ROWS = 25;
const RPT1_MAX_CONTEXT_ROWS = 2048;
const PREDICT_PLACEHOLDER = "[PREDICT]";
const DEFAULT_CASHFLOW_ROWS = [
  {
    monthKey: "2026-05",
    monthLabel: "2026 Majus",
    actualCashflow: 208262509.73,
    predictedIncrementalCashflow: 0,
    predictedCashflow: 208262509.73
  },
  {
    monthKey: "2026-06",
    monthLabel: "2026 Junius",
    actualCashflow: 20908143.32,
    predictedIncrementalCashflow: 0,
    predictedCashflow: 20908143.32
  },
  {
    monthKey: "2026-07",
    monthLabel: "2026 Julius",
    actualCashflow: 67131.92,
    predictedIncrementalCashflow: 0,
    predictedCashflow: 67131.92
  }
];

function cloneDefaultCashflowRows() {
  return DEFAULT_CASHFLOW_ROWS.map(function(row) {
    return Object.assign({}, row);
  });
}

function parseCsv(text) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;
  let i;

  for (i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") {
        i += 1;
      }
      row.push(current);
      current = "";
      if (row.some(function(cell) { return cell !== ""; })) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    current += ch;
  }

  row.push(current);
  if (row.some(function(cell) { return cell !== ""; })) {
    rows.push(row);
  }

  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = rows[0].map(function(cell) {
    return String(cell || "").trim();
  });

  const records = rows.slice(1).map(function(cells) {
    const record = {};
    headers.forEach(function(header, index) {
      record[header] = parseCsvCell(cells[index]);
    });
    return record;
  }).filter(function(record) {
    return Object.keys(record).some(function(key) {
      const value = record[key];
      return value !== "" && value != null;
    });
  });

  return { headers: headers, rows: records };
}

function parseCsvCell(value) {
  const text = String(value == null ? "" : value).trim();

  if (!text) {
    return "";
  }
  if (text === PREDICT_PLACEHOLDER) {
    return PREDICT_PLACEHOLDER;
  }
  if (/^(true|false)$/i.test(text)) {
    return /^true$/i.test(text);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }
  if (/^-?\d+(?:\.\d+)?$/.test(text)) {
    return Number(text);
  }
  return text;
}

function hasPredictPlaceholder(row) {
  return Object.keys(row || {}).some(function(key) {
    return String(row[key] == null ? "" : row[key]).trim() === PREDICT_PLACEHOLDER;
  });
}

function getPredictColumns(row) {
  return Object.keys(row || {}).filter(function(key) {
    return String(row[key] == null ? "" : row[key]).trim() === PREDICT_PLACEHOLDER;
  });
}

function chooseIndexColumn(headers) {
  const preferred = [
    "Transaction ID",
    "TransactionID",
    "transaction_id",
    "Customer ID",
    "CustomerID",
    "customer_id"
  ];
  const normalized = {};

  (headers || []).forEach(function(header) {
    normalized[String(header).toLowerCase()] = header;
  });

  for (let i = 0; i < preferred.length; i += 1) {
    const match = normalized[String(preferred[i]).toLowerCase()];
    if (match) {
      return match;
    }
  }
  return headers && headers.length ? headers[0] : "";
}

function splitPredictionRows(rows) {
  const contextRows = [];
  const queryRows = [];

  (rows || []).forEach(function(row, index) {
    const clone = Object.assign({}, row, {
      __rowIndex: index,
      __predictColumns: getPredictColumns(row)
    });
    if (hasPredictPlaceholder(row)) {
      queryRows.push(clone);
    } else {
      contextRows.push(clone);
    }
  });

  return {
    contextRows: contextRows,
    queryRows: queryRows
  };
}

function stripInternalFields(row) {
  const clean = {};
  Object.keys(row || {}).forEach(function(key) {
    if (key.indexOf("__") === 0) {
      return;
    }
    clean[key] = row[key];
  });
  return clean;
}

function buildBatches(contextRows, queryRows) {
  const context = (contextRows || []).slice(0, RPT1_MAX_CONTEXT_ROWS).map(stripInternalFields);
  const out = [];

  for (let i = 0; i < queryRows.length; i += RPT1_MAX_QUERY_ROWS) {
    out.push({
      contextRows: context,
      queryRows: queryRows.slice(i, i + RPT1_MAX_QUERY_ROWS)
    });
  }

  return out;
}

function parseRetryAfterSeconds(value) {
  const seconds = Number(value);
  if (isFinite(seconds) && seconds > 0) {
    return seconds;
  }
  return 1;
}

async function callRpt1Predict(options) {
  const fetchImpl = options.fetchImpl || fetch;
  const headers = {
    "Authorization": "Bearer " + options.token,
    "Content-Type": "application/json"
  };
  const bodies = [
    {
      rows: options.rows,
      index_column: options.indexColumn || undefined
    },
    {
      data: options.rows,
      index_column: options.indexColumn || undefined
    }
  ];
  let lastError = null;

  for (let bodyIndex = 0; bodyIndex < bodies.length; bodyIndex += 1) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetchImpl(RPT1_API_URL, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(bodies[bodyIndex])
      });

      if (response.ok) {
        return response.json();
      }

      const text = await response.text();
      const error = new Error("RPT1 API hiba (" + response.status + "): " + text);
      error.status = response.status;
      lastError = error;

      if ((response.status === 429 || response.status === 503) && attempt < 2) {
        const retryAfter = parseRetryAfterSeconds(response.headers.get("Retry-After"));
        await wait(retryAfter * 1000);
        continue;
      }

      if (response.status === 400 && bodyIndex === 0) {
        break;
      }

      throw error;
    }
  }

  throw lastError || new Error("Az RPT1 API hivas sikertelen volt.");
}

function wait(ms) {
  return new Promise(function(resolve) {
    setTimeout(resolve, ms);
  });
}

function extractPredictionScalar(value) {
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];
    if (first && typeof first === "object" && Object.prototype.hasOwnProperty.call(first, "prediction")) {
      return first.prediction;
    }
  }
  if (value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "prediction")) {
    return value.prediction;
  }
  return value;
}

function extractPredictionConfidence(value) {
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];
    if (first && typeof first === "object" && Object.prototype.hasOwnProperty.call(first, "confidence")) {
      return first.confidence;
    }
  }
  if (value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "confidence")) {
    return value.confidence;
  }
  return null;
}

function mergePredictions(queryRows, predictionItems, indexColumn) {
  const byIndex = {};

  (predictionItems || []).forEach(function(item) {
    const key = indexColumn ? String(item && item[indexColumn]) : "";
    if (key) {
      byIndex[key] = item;
    }
  });

  return (queryRows || []).map(function(row) {
    const cleanRow = stripInternalFields(row);
    const prediction = indexColumn ? byIndex[String(cleanRow[indexColumn])] : (predictionItems || [])[0];
    const out = Object.assign({}, cleanRow);
    const predictColumns = row.__predictColumns || [];

    predictColumns.forEach(function(columnName) {
      const rawValue = prediction ? prediction[columnName] : null;
      out[columnName] = extractPredictionScalar(rawValue);
      out["Predicted " + columnName] = extractPredictionScalar(rawValue);
      out["Predicted " + columnName + " Confidence"] = extractPredictionConfidence(rawValue);
    });

    return out;
  });
}

function aggregatePredictedCashflow(predictionRows, amountColumn, dateColumn, allowedMonthKeys) {
  const totals = {};

  (allowedMonthKeys || []).forEach(function(monthKey) {
    totals[monthKey] = 0;
  });

  (predictionRows || []).forEach(function(row) {
    const dateValue = String(row && row[dateColumn] != null ? row[dateColumn] : row["Predicted " + dateColumn] || "").trim();
    const monthKey = dateValue.slice(0, 7);
    const amount = Number(row && row[amountColumn]);

    if (!totals.hasOwnProperty(monthKey) || !isFinite(amount)) {
      return;
    }
    totals[monthKey] += amount;
  });

  return totals;
}

function buildChartRows(predictionRows, options) {
  const baseRows = cloneDefaultCashflowRows();
  const totals = aggregatePredictedCashflow(
    predictionRows,
    options.amountColumn || "Invoice Amount",
    options.dateColumn || "Expected Income date",
    baseRows.map(function(row) { return row.monthKey; })
  );

  return baseRows.map(function(row) {
    const predictedIncrementalCashflow = roundCurrency(totals[row.monthKey] || 0);
    return Object.assign({}, row, {
      predictedIncrementalCashflow: predictedIncrementalCashflow,
      predictedCashflow: roundCurrency(Number(row.actualCashflow || 0) + predictedIncrementalCashflow)
    });
  });
}

function roundCurrency(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

async function predictFromRows(rows, headers, token, fetchImpl) {
  const split = splitPredictionRows(rows);

  if (split.queryRows.length === 0) {
    throw new Error("A CSV-ben legalabb 1 [PREDICT] sort meg kell adni.");
  }
  if (split.contextRows.length < 2) {
    throw new Error("A predikciohoz legalabb 2 teljes context sor szukseges.");
  }

  const indexColumn = chooseIndexColumn(headers);
  const batches = buildBatches(split.contextRows, split.queryRows);
  const mergedRows = [];
  let apiCalls = 0;

  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];
    const payloadRows = batch.contextRows.concat(batch.queryRows.map(stripInternalFields));
    const response = await callRpt1Predict({
      token: token,
      rows: payloadRows,
      indexColumn: indexColumn,
      fetchImpl: fetchImpl
    });
    const prediction = response && response.prediction ? response.prediction : {};
    const predictionItems = Array.isArray(prediction.predictions) ? prediction.predictions : [];
    const batchRows = mergePredictions(batch.queryRows, predictionItems, indexColumn);

    batchRows.forEach(function(row) {
      mergedRows.push(row);
    });
    apiCalls += 1;
  }

  return {
    predictionRows: mergedRows,
    queryCount: split.queryRows.length,
    contextCount: split.contextRows.length,
    apiCalls: apiCalls,
    indexColumn: indexColumn,
    predictColumns: split.queryRows[0].__predictColumns || []
  };
}

async function predictFromCsvBuffer(buffer, token, fetchImpl) {
  const parsed = parseCsv(String(buffer || ""));
  return predictFromRows(parsed.rows, parsed.headers, token, fetchImpl);
}

module.exports = {
  DEFAULT_CASHFLOW_ROWS: DEFAULT_CASHFLOW_ROWS,
  PREDICT_PLACEHOLDER: PREDICT_PLACEHOLDER,
  aggregatePredictedCashflow: aggregatePredictedCashflow,
  buildChartRows: buildChartRows,
  chooseIndexColumn: chooseIndexColumn,
  cloneDefaultCashflowRows: cloneDefaultCashflowRows,
  parseCsv: parseCsv,
  predictFromCsvBuffer: predictFromCsvBuffer,
  predictFromRows: predictFromRows,
  splitPredictionRows: splitPredictionRows
};
