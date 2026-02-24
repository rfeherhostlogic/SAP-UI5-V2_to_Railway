const BANNED_KEYWORDS = [
  "insert",
  "update",
  "delete",
  "drop",
  "alter",
  "create",
  "truncate",
  "merge",
  "grant",
  "revoke",
  "exec",
  "execute",
  "call",
  "attach",
  "detach",
  "pragma"
];

const SQL_KEYWORDS = new Set([
  "select", "from", "where", "join", "left", "right", "inner", "outer", "on", "and", "or", "not",
  "as", "group", "by", "order", "limit", "offset", "having", "asc", "desc", "distinct", "count",
  "sum", "avg", "min", "max", "like", "in", "is", "null", "case", "when", "then", "else", "end",
  "between"
]);

const SQL_FUNCTIONS = new Set([
  "strftime", "date", "datetime", "julianday", "time",
  "coalesce", "ifnull", "nullif", "round", "abs",
  "lower", "upper", "substr", "replace", "trim",
  "cast"
]);

function parseSchemaHint(schemaHint) {
  const tableMap = {};
  const lines = String(schemaHint || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  lines.forEach((line) => {
    const separatorIndex = line.lastIndexOf(":");
    if (separatorIndex < 0) {
      return;
    }

    const tablePart = String(line.slice(0, separatorIndex) || "").trim();
    const columnsPart = String(line.slice(separatorIndex + 1) || "").trim();
    if (!tablePart || !columnsPart) {
      return;
    }

    const tablePhysical = extractPhysicalTableName(tablePart);
    const table = normalizeIdentifier(tablePhysical);
    if (!table) {
      return;
    }

    const cols = columnsPart
      .split(",")
      .map((c) => normalizeIdentifier(c))
      .filter(Boolean);

    tableMap[table] = new Set(cols);
  });

  return tableMap;
}

function extractPhysicalTableName(tablePart) {
  const raw = String(tablePart || "").trim();
  if (!raw) {
    return "";
  }

  // Supports decorated names like: ksb1 [Cost Centers: Actual Line Items]
  // Physical SQL name is the first token before any whitespace.
  const first = raw.split(/\s+/)[0];
  return String(first || "").trim();
}

function normalizeIdentifier(value) {
  return String(value || "")
    .trim()
    .replace(/[`"'\[\]]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function removeStringLiterals(sql) {
  return sql
    .replace(/'[^']*'/g, "''")
    .replace(/"[^"]*"/g, "\"\"");
}

function validateSelectSql(sql, tableMap) {
  const errors = [];
  const source = String(sql || "").trim();
  const cleaned = removeStringLiterals(source).toLowerCase();

  if (!source) {
    return { ok: false, errors: ["Ures SQL."] };
  }

  if (!/^select\b/i.test(source)) {
    errors.push("Csak SELECT engedelyezett.");
  }

  if (/[;]/.test(source) || /--|\/\*|\*\//.test(source)) {
    errors.push("Tiltott karakter vagy komment talalhato (;, --, /* */).");
  }

  BANNED_KEYWORDS.forEach((keyword) => {
    if (new RegExp("\\b" + keyword + "\\b", "i").test(cleaned)) {
      errors.push("Tiltott kulcsszo: " + keyword);
    }
  });

  if (!/\blimit\s+\d+\b/i.test(cleaned)) {
    errors.push("Kotelezo a LIMIT klauzula.");
  }

  const allowedTables = new Set(Object.keys(tableMap || {}));
  if (allowedTables.size === 0) {
    errors.push("Ures vagy ervenytelen schema hint.");
  }

  const aliasToTable = {};
  const aliasNames = new Set();
  const functionNames = new Set();
  const tableMatches = source.matchAll(/\b(?:from|join)\s+([a-zA-Z_][\w]*)\s*(?:as\s+)?([a-zA-Z_][\w]*)?/gi);

  for (const match of tableMatches) {
    const table = normalizeIdentifier(match[1]);
    const alias = normalizeIdentifier(match[2]);

    if (!allowedTables.has(table)) {
      errors.push("Nem engedelyezett tabla: " + (match[1] || ""));
    }

    if (table) {
      aliasToTable[table] = table;
      if (alias) {
        aliasToTable[alias] = table;
        aliasNames.add(alias);
      }
    }
  }

  const selectAliasMatches = source.matchAll(/\bas\s+([a-zA-Z_][\w]*)\b/gi);
  for (const match of selectAliasMatches) {
    const alias = normalizeIdentifier(match[1]);
    if (alias) {
      aliasNames.add(alias);
    }
  }

  const functionMatches = source.matchAll(/\b([a-zA-Z_][\w]*)\s*\(/g);
  for (const match of functionMatches) {
    const fn = normalizeIdentifier(match[1]);
    if (fn) {
      functionNames.add(fn);
    }
  }

  const qualifiedColumnMatches = source.matchAll(/\b([a-zA-Z_][\w]*)\.([a-zA-Z_][\w]*)\b/g);
  for (const match of qualifiedColumnMatches) {
    const alias = normalizeIdentifier(match[1]);
    const col = normalizeIdentifier(match[2]);
    const table = aliasToTable[alias] || alias;
    const allowedCols = tableMap[table];

    if (!allowedCols) {
      errors.push("Ismeretlen tabla/alias hivatkozas: " + match[1]);
      continue;
    }

    if (!allowedCols.has(col)) {
      errors.push("Nem engedelyezett oszlop: " + match[1] + "." + match[2]);
    }
  }

  const allAllowedCols = new Set();
  Object.values(tableMap || {}).forEach((set) => {
    set.forEach((c) => allAllowedCols.add(c));
  });

  const tokenMatches = source.matchAll(/\b([a-zA-Z_][\w]*)\b/g);
  for (const match of tokenMatches) {
    const token = normalizeIdentifier(match[1]);

    if (!token || SQL_KEYWORDS.has(token)) {
      continue;
    }

    if (SQL_FUNCTIONS.has(token) || functionNames.has(token)) {
      continue;
    }

    if (allowedTables.has(token) || aliasToTable[token] || allAllowedCols.has(token)) {
      continue;
    }

    if (aliasNames.has(token)) {
      continue;
    }

    if (/^\d+$/.test(token)) {
      continue;
    }

    // likely alias or function name; keep permissive but block obvious unknown identifiers
    if (/^[a-z_]+$/i.test(token)) {
      // tolerate common aliases of length <=2
      if (token.length <= 2) {
        continue;
      }
      errors.push("Ismeretlen azonosito: " + match[1]);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    sanitizedSql: source
  };
}

module.exports = {
  parseSchemaHint,
  validateSelectSql
};

