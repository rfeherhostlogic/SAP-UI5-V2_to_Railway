const path = require("path");
const crypto = require("crypto");
const sqlite3 = require("sqlite3").verbose();
const { parseSchemaHint, validateSelectSql } = require("./sqlValidator");

const DB_PATH = path.resolve(__dirname, "../webapp/model/db/sample.sqlite");
const SQL_DIALECT = process.env.SQL_DIALECT || "SQLite";

const SQL_PROMPTS = {
  system: [
    "Te egy SQL generátor vagy.",
    "Feladatod: a felhasználó természetes nyelvű kérdéséből pontos SQL SELECT lekérdezést készíteni a megadott sémából.",
    "",
    "Idezojeles szabalyok:",
    "- Ha a felhasznalo '...' jelet hasznal, azt oszlopra vagy mezojelolesre vonatkozo utalasnak tekintsd.",
    "- A '...' tartalom nem biztos, hogy pontos schema oszlopnev; valaszd ki a legvaloszinubb oszlopot a schema hint alapjan.",
    "- Ha a felhasznalo \"...\" jelet hasznal, azt mindig konkret keresett erteknek tekintsd, es WHERE feltetelben hasznald.",
    "",
    "Peldak:",
    "- 'Customer' = Melyik 'Ugyfel' hivjak \"Roli Foods\"-nak?",
    "- \"Roli Foods\" melyik 'orszag'-ban uzemel?",
    "",
    "A kerdesben szereplo konkret szavak, nevek, orszagok, szegmensek, penznemek, datumok vagy egyeb kifejezesek nagy valoszinuseggel oszloiertekek, nem oszlopnevek. Ezeket mindig probald meg a schema hint megfelelo oszlopara illeszteni, es WHERE feltetelben hasznald.",
    "",
    "Ha egy szoveg nem egyezik meg egyetlen oszlopnevvel sem, akkor feltetelezd, hogy az egy oszlop erteke, es keresd meg a legvaloszinubb oszlopot a semaban, amelyhez tartozhat.",
    "",
    "Tipikus megfeleltetesek:",
    "",
    "Cegnevek -> Customer.CustomerName",
    "",
    "Orszag -> Customer.Country",
    "",
    "Szegmens -> Customer.Segment",
    "",
    "Penznem -> SalesOrder.Currency",
    "",
    "Ev vagy honap -> SalesOrder.OrderDate szures",
    "Havi bontas eseten hasznalj honap kulcsot (SQLite: strftime('%Y-%m', SalesOrder.OrderDate)), aggregalj GROUP BY honap szerint.",
    "Ha a kerdes \"netto osszeg\" jellegu, hasznald a SUM(SalesOrder.NetAmount) aggregaciot.",
    "",
    "Ha konkret nev szerepel (peldaul \"Roli Foods\"), azt kezeld konkret rekordertekkent, es a megfelelo oszlopban keress ra WHERE feltetellel.",
    "",
    "Ha a kerdes egy adott entitas tulajdonsagara kerdez ra (peldaul \"melyik orszagban mukodik?\"), akkor csak a relevans oszlopot valaszd ki a SELECT reszben.",
    "",
    "Ha lista jellegu kerdes erkezik (peldaul \"milyen ugyfelek vannak Magyarorszagon?\"), akkor valaszd ki az azonositot es a nevet, es hasznalj DISTINCT-et, ha duplikacio elofordulhat.",
    "",
    "Ha a kerdes rendelesekhez vagy arbevetelhez kapcsolodik, akkor JOIN-olj a Customer es SalesOrder tablak kozott a CustomerId alapjan.",
    "",
    "Mindig csak a schema hintben szereplő táblákat és oszlopokat használd.",
    "Ne találj ki új oszlopot.",
    "Ha több lehetséges oszlop jöhet szóba, válaszd a legvalószínűbbet a séma alapján.",
    "",
    "Kimenet:",
    "",
    "Csak egyetlen SELECT statement",
    "",
    "Nincs pontosvessző",
    "",
    "Nincs komment",
    "",
    "Kötelező LIMIT 50",
    "",
    "Nincs markdown, nincs magyarázat, csak a SQL szöveg"
  ].join("\n"),
  userTemplate: [
    "Felhasznalo kerdese:",
    "{{question}}",
    "",
    "Schema hint:",
    "{{schemaHint}}",
    "",
    "SQL dialektus:",
    "{{dialect}}",
    "",
    "Kotelezo szabalyok:",
    "- Csak SELECT",
    "- Egyetlen statement",
    "- Nincs ';' es komment",
    "- Csak a schema hintben levo tablak/oszlopok",
    "- LIMIT 50 kotelezo",
    "",
    "Kimenet formatuma: csak a SQL szoveg, se markdown, se backtick."
  ].join("\n")
};

const SUMMARY_PROMPTS = {
  system: "Te egy adatösszegzo vagy. Csak az átadott eredményadatokból dolgozol, nem találgatsz.",
  userTemplate: [
    "Eredeti kerdes:",
    "{{question}}",
    "",
    "Lefutott SQL:",
    "{{sql}}",
    "",
    "Oszlopok:",
    "{{columns}}",
    "",
    "Eredmenyadatok JSON:",
    "{{rows}}",
    "",
    "Instrukcio: pontosan 1 magyar mondatban valaszolj. Ha nincs adat, ezt ird: Nincs találat a megadott feltételekre."
  ].join("\n")
};

function normalizeForMatch(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function stripLikelyHungarianSuffixes(value) {
  const sValue = normalizeForMatch(value);
  const suffixes = [
    "kent", "ban", "ben", "nak", "nek", "val", "vel", "rol", "tol", "hoz", "hez", "hon", "on", "en", "an",
    "ra", "re", "ba", "be", "ot", "et", "at", "t", "n"
  ];

  for (let i = 0; i < suffixes.length; i += 1) {
    const suffix = suffixes[i];
    if (sValue.length > suffix.length + 2 && sValue.endsWith(suffix)) {
      return sValue.slice(0, -suffix.length);
    }
  }
  return sValue;
}

function levenshteinDistance(a, b) {
  const sA = String(a || "");
  const sB = String(b || "");
  const rows = sA.length + 1;
  const cols = sB.length + 1;
  const dp = Array.from({ length: rows }, function(_, i) {
    const row = new Array(cols);
    row[0] = i;
    return row;
  });

  for (let j = 0; j < cols; j += 1) {
    dp[0][j] = j;
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = sA[i - 1] === sB[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[rows - 1][cols - 1];
}

function buildSchemaColumnCandidates(schemaHint) {
  const candidates = [];
  String(schemaHint || "")
    .split(/\r?\n/)
    .map(function(line) {
      return line.trim();
    })
    .filter(Boolean)
    .forEach(function(line) {
      const parts = line.split(":");
      if (parts.length < 2) {
        return;
      }
      const table = String(parts[0] || "").trim();
      const cols = parts.slice(1).join(":").split(",");
      cols.forEach(function(colRaw) {
        const col = String(colRaw || "").trim();
        if (!table || !col) {
          return;
        }
        candidates.push({
          table: table,
          column: col,
          qualified: table + "." + col,
          normalizedColumn: normalizeForMatch(col)
        });
      });
    });
  return candidates;
}

function bestMatchColumn(term, candidates) {
  const raw = String(term || "").trim();
  if (!raw) {
    return null;
  }

  const normalized = normalizeForMatch(raw);
  const normalizedStripped = stripLikelyHungarianSuffixes(raw);
  let best = null;

  candidates.forEach(function(candidate) {
    const candidateNorm = candidate.normalizedColumn;
    if (!candidateNorm) {
      return;
    }

    let score = 0;
    if (normalized === candidateNorm) {
      score = 1;
    } else if (normalizedStripped === candidateNorm) {
      score = 0.99;
    } else if (candidateNorm.indexOf(normalizedStripped) >= 0 || normalizedStripped.indexOf(candidateNorm) >= 0) {
      score = 0.9;
    } else {
      const dist = levenshteinDistance(normalizedStripped, candidateNorm);
      const maxLen = Math.max(normalizedStripped.length, candidateNorm.length) || 1;
      score = 1 - (dist / maxLen);
    }

    if (!best || score > best.score) {
      best = {
        score: score,
        candidate: candidate
      };
    }
  });

  if (!best || best.score < 0.72) {
    return null;
  }

  return best.candidate;
}

function buildQuotedColumnResolutionHints(question, schemaHint) {
  const candidates = buildSchemaColumnCandidates(schemaHint);
  if (candidates.length === 0) {
    return "";
  }

  const matches = String(question || "").matchAll(/'([^']+)'/g);
  const lines = [];
  const used = new Set();

  for (const m of matches) {
    const token = String(m[1] || "").trim();
    if (!token) {
      continue;
    }
    const mapped = bestMatchColumn(token, candidates);
    if (!mapped) {
      continue;
    }
    const key = token.toLowerCase() + "=>" + mapped.qualified.toLowerCase();
    if (used.has(key)) {
      continue;
    }
    used.add(key);
    lines.push("- '" + token + "' -> " + mapped.qualified);
  }

  if (lines.length === 0) {
    return "";
  }

  return [
    "Feloldott oszloputalasok a kerdeshez (ezeket kezeld prioritasban):",
    lines.join("\n")
  ].join("\n");
}

function hashHint(schemaHint) {
  return crypto.createHash("sha256").update(String(schemaHint || "")).digest("hex").slice(0, 12);
}

function callOpenAiChatCompletion({ apiKey, model, messages, temperature }) {
  return fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiKey
    },
    body: JSON.stringify({
      model,
      messages,
      temperature
    })
  }).then(async (response) => {
    const raw = await response.text();
    let json;
    try {
      json = JSON.parse(raw);
    } catch (err) {
      json = null;
    }

    if (!response.ok) {
      throw new Error("OpenAI hiba: " + (json ? JSON.stringify(json) : raw));
    }

    const text = json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
    return String(text || "").trim();
  });
}

function buildSqlUserPrompt({ question, schemaHint, dialect, retryError }) {
  const resolutionHints = buildQuotedColumnResolutionHints(question, schemaHint);
  let prompt = SQL_PROMPTS.userTemplate
    .replace("{{question}}", question)
    .replace("{{schemaHint}}", schemaHint)
    .replace("{{dialect}}", dialect);

  if (resolutionHints) {
    prompt += "\n\n" + resolutionHints;
  }

  if (retryError) {
    prompt += "\n\nElozo SQL hiba/validacio:\n" + retryError + "\nKeszits javitott SQL-t ugyanezen szabalyok szerint.";
  }

  return prompt;
}

function buildSummaryUserPrompt({ question, sql, columns, rows }) {
  return SUMMARY_PROMPTS.userTemplate
    .replace("{{question}}", question)
    .replace("{{sql}}", sql)
    .replace("{{columns}}", JSON.stringify(columns))
    .replace("{{rows}}", JSON.stringify(rows));
}

function runQuery(sql) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        reject(err);
      }
    });

    db.all(sql, [], (err, rows) => {
      db.close();
      if (err) {
        reject(err);
        return;
      }
      resolve(rows || []);
    });
  });
}

async function generateValidatedSql({ apiKey, model, question, schemaHint, dialect }) {
  const tableMap = parseSchemaHint(schemaHint);
  let lastError = "";
  const hintHash = hashHint(schemaHint);

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const sql = await callOpenAiChatCompletion({
      apiKey,
      model,
      temperature: 0,
      messages: [
        { role: "system", content: SQL_PROMPTS.system },
        {
          role: "user",
          content: buildSqlUserPrompt({
            question,
            schemaHint,
            dialect,
            retryError: lastError || ""
          })
        }
      ]
    });

    const validation = validateSelectSql(sql, tableMap);
    console.log("[dummy4:validation]", JSON.stringify({
      attempt,
      schemaHintHash: hintHash,
      sql,
      ok: validation.ok,
      errors: validation.errors
    }));

    if (!validation.ok) {
      lastError = validation.errors.join(" | ");
      continue;
    }

    try {
      const rows = await runQuery(validation.sanitizedSql);
      return {
        sql: validation.sanitizedSql,
        rows,
        tableMap
      };
    } catch (dbErr) {
      lastError = "DB hiba: " + dbErr.message;
    }
  }

  throw new Error("Nem sikerult ervenyes SQL-t generalni: " + lastError);
}

async function summarizeResult({ apiKey, model, question, sql, rows }) {
  if (!rows || rows.length === 0) {
    return "Nincs találat a megadott feltételekre.";
  }

  const columns = Object.keys(rows[0] || {});
  const text = await callOpenAiChatCompletion({
    apiKey,
    model,
    temperature: 0.2,
    messages: [
      { role: "system", content: SUMMARY_PROMPTS.system },
      {
        role: "user",
        content: buildSummaryUserPrompt({
          question,
          sql,
          columns,
          rows
        })
      }
    ]
  });

  return text;
}

async function executeDummy4({ apiKey, model, question, schemaHint }) {
  const start = Date.now();
  const hintHash = hashHint(schemaHint);

  const result = await generateValidatedSql({
    apiKey,
    model,
    question,
    schemaHint,
    dialect: SQL_DIALECT
  });

  const summary = await summarizeResult({
    apiKey,
    model,
    question,
    sql: result.sql,
    rows: result.rows
  });

  const ms = Date.now() - start;
  console.log("[dummy4]", JSON.stringify({
    question,
    schemaHintHash: hintHash,
    generatedSql: result.sql,
    validation: "ok",
    rowsCount: result.rows.length,
    durationMs: ms
  }));

  return {
    generatedSql: result.sql,
    summary,
    rows: result.rows.slice(0, 50)
  };
}

module.exports = {
  SQL_PROMPTS,
  SUMMARY_PROMPTS,
  buildSqlUserPrompt,
  buildQuotedColumnResolutionHints,
  executeDummy4
};

