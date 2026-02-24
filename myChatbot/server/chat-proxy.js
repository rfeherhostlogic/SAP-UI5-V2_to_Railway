require("dotenv").config();

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");
const sqlite3 = require("sqlite3").verbose();
const express = require("express");
const multer = require("multer");
const { PDFParse } = require("pdf-parse");
const PDFDocument = require("pdfkit");
const { executeDummy4, SQL_PROMPTS, SUMMARY_PROMPTS } = require("./dummy4Service");

const app = express();
const PORT = Number(process.env.PORT || process.env.CHAT_PROXY_PORT || 4000);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const DUMMY7_MODEL = process.env.DUMMY7_MODEL || "gpt-4.1";
const DUMMY7_VECTOR_STORE_ID = "vs_698f417bc0e481919720698508275ad3";
const APP_SESSION_SECRET = process.env.APP_SESSION_SECRET || "replace-this-in-production";
const APP_SESSION_TTL_MS = Number(process.env.APP_SESSION_TTL_MS || (1000 * 60 * 60 * 12));
const AUTH_COOKIE_NAME = "mychatbot_session";
const UI_DIST_DIR = path.resolve(__dirname, "../dist");
const UI_WEBAPP_DIR = path.resolve(__dirname, "../webapp");
const UI_STATIC_DIR = fs.existsSync(UI_DIST_DIR) ? UI_DIST_DIR : UI_WEBAPP_DIR;
const DISCOVERY_DB_PATH = path.resolve(
  process.env.SQLITE_DB_PATH || path.join(__dirname, "../webapp/model/db/sample.sqlite")
);
const DISCOVERY_TRAINING_PY = path.resolve(
  process.env.DISCOVERY_TRAINING_PY || path.join(__dirname, "ml_train_runner.py")
);
const DISCOVERY_JOBS_DIR = path.resolve(
  process.env.DISCOVERY_JOBS_DIR || path.join(__dirname, "jobs")
);

let oDummy4ChartCache = null;
const oDummy5Docs = new Map();
const oDiscoverySpecSessions = new Map();
const oDiscoveryJobs = new Map();
const oAuthSessions = new Map();
const AUTH_USERS = [
  {
    username: "HelloAdam",
    displayName: "HelloAdam",
    passwordSha256: "c908c1557b63583ef071b3a9c27dc2509eef6af4e4ba671a71ca1d8c60e243dc"
  },
  {
    username: "HelloLaci",
    displayName: "HelloLaci",
    passwordSha256: "93382a50bcaf2f0a87c86623165f72d63e7c52b46bfb6b49c60c67033da6b2df"
  },
  {
    username: "HelloRoli",
    displayName: "HelloRoli",
    passwordSha256: "6ba66bebd3913aebc9ec87bd84624410572101a7b5747770233829002ddc55e0"
  }
];
const oDummy5Upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

const NOAH_LOW_CONFIDENCE_THRESHOLD = Number(process.env.NOAH_LOW_CONFIDENCE_THRESHOLD || 0.55);
const NOAH_CARDS = [
  {
    id: "email-fix",
    name: "Email javitas",
    description: "Rovid, udvarias es professzionalis uzleti email ujrafogalmazasa.",
    prompt_template: [
      "Feladat: javitsd az uzleti email szoveget stilisztikailag es nyelvhelyesseg szerint.",
      "Hangnem: {{tone}}",
      "",
      "Eredeti szoveg:",
      "{{source_text}}"
    ].join("\n"),
    fields: [
      {
        field_id: "tone",
        label: "Kivant hangnem",
        type: "text",
        required: false,
        placeholder: "Pl. professzionalis, udvarias",
        validation: { maxLength: 100 }
      },
      {
        field_id: "source_text",
        label: "Eredeti szoveg",
        type: "textarea",
        required: true,
        placeholder: "Masold be az eredeti emailt",
        validation: { minLength: 10 }
      }
    ]
  },
  {
    id: "sensitive-translation",
    name: "Erzekeny uzleti adat forditas",
    description: "Bizalmas uzleti szoveg pontos, semleges forditasa.",
    prompt_template: [
      "Feladat: forditsd le az uzleti szoveget pontosan, semleges es professzionalis stilusban.",
      "Forras nyelv: {{source_language}}",
      "Cel nyelv: {{target_language}}",
      "",
      "Szoveg:",
      "{{source_text}}"
    ].join("\n"),
    fields: [
      {
        field_id: "source_language",
        label: "Forras nyelv",
        type: "text",
        required: false,
        placeholder: "Pl. angol",
        validation: { maxLength: 40 }
      },
      {
        field_id: "target_language",
        label: "Cel nyelv",
        type: "text",
        required: true,
        placeholder: "Pl. magyar",
        validation: { maxLength: 40 }
      },
      {
        field_id: "source_text",
        label: "Forditando szoveg",
        type: "textarea",
        required: true,
        placeholder: "Masold be a szoveget",
        validation: { minLength: 10 }
      }
    ]
  },
  {
    id: "summary",
    name: "Osszefoglalo",
    description: "Hosszu szoveg tomor, pontokba szedett osszefoglalasa.",
    prompt_template: [
      "Feladat: keszits tomor, pontokba szedett osszefoglalot.",
      "Fokusz: {{focus}}",
      "",
      "Bemeneti szoveg:",
      "{{source_text}}"
    ].join("\n"),
    fields: [
      {
        field_id: "focus",
        label: "Fokusz",
        type: "text",
        required: false,
        placeholder: "Pl. dontesi informaciok",
        validation: { maxLength: 120 }
      },
      {
        field_id: "source_text",
        label: "Osszefoglaland szoveg",
        type: "textarea",
        required: true,
        placeholder: "Masold be a szoveget",
        validation: { minLength: 20 }
      }
    ]
  },
  {
    id: "dummy-4",
    name: "Riportok",
    description: "Natural nyelv -> SQL SELECT + 1 mondatos osszegzes.",
    prompt_template: [
      "Feladat: natural nyelvu kerdes alapjan SQL riport kerdes ertelmezese.",
      "Kerdes: {{question}}",
      "Schema hint:",
      "{{schema_hint}}"
    ].join("\n"),
    fields: [
      {
        field_id: "question",
        label: "Riport kerdes",
        type: "textarea",
        required: true,
        placeholder: "Pl. Melyik ugyfelnek volt a legnagyobb netto forgalma 2024-ben?",
        validation: { minLength: 8 }
      },
      {
        field_id: "schema_hint",
        label: "Schema hint",
        type: "textarea",
        required: true,
        placeholder: "Customer: CustomerId, CustomerName, Country, Segment",
        validation: { minLength: 20 }
      }
    ]
  },
  {
    id: "dummy-5",
    name: "Dokumentum osszefoglalo",
    description: "Dokumentum alapu osszegzes es kerdes-valasz (metadata-only mod Noah-ban).",
    prompt_template: [
      "Feladat: dokumentum metadata + user kerdes alapjan adj ideiglenes orientacios valaszt.",
      "KerdeÌs: {{question}}",
      "Dokumentum kontextus: {{document_context}}",
      "Ha nincs eleg adat, jelezd roviden."
    ].join("\n"),
    fields: [
      {
        field_id: "question",
        label: "Kerdes",
        type: "textarea",
        required: true,
        placeholder: "Pl. Mik a dokumentum kulcspontjai?",
        validation: { minLength: 8 }
      },
      {
        field_id: "document_context",
        label: "Dokumentum kontextus",
        type: "textarea",
        required: false,
        placeholder: "Pl. PDF cime, tema, oldalhivatkozas",
        validation: { maxLength: 1500 }
      }
    ]
  },
  {
    id: "dummy-6",
    name: "RAG",
    description: "Generikus kerdesek belso dokumentumokrol.",
    prompt_template: [
      "Feladat: valaszolj a kerdesre a megadott kontextus alapjan.",
      "Kerdes: {{knowledge_question}}",
      "Kontekstus: {{context_hint}}"
    ].join("\n"),
    fields: [
      {
        field_id: "knowledge_question",
        label: "Kerdes",
        type: "textarea",
        required: true,
        placeholder: "Pl. Mi a belso szabalyzat fo hatarideje?",
        validation: { minLength: 8 }
      },
      {
        field_id: "context_hint",
        label: "Kontekstus",
        type: "textarea",
        required: false,
        placeholder: "Pl. dokumentum neve, fejezet",
        validation: { maxLength: 1200 }
      }
    ]
  },
  {
    id: "dummy-7",
    name: "Penzugyi osszehasonlitas (RAG)",
    description: "Ket ceg penzugyi osszehasonlitasa.",
    prompt_template: [
      "Feladat: keszits osszehasonlitast ket cegrol.",
      "Ceg A: {{company_a}}",
      "Ceg B: {{company_b}}",
      "Fokusz: {{focus}}"
    ].join("\n"),
    fields: [
      {
        field_id: "company_a",
        label: "Ceg A",
        type: "text",
        required: true,
        placeholder: "\"Roli Foods\"",
        validation: { minLength: 3, maxLength: 80 }
      },
      {
        field_id: "company_b",
        label: "Ceg B",
        type: "text",
        required: true,
        placeholder: "\"Varga Retail\"",
        validation: { minLength: 3, maxLength: 80 }
      },
      {
        field_id: "focus",
        label: "Fokusz",
        type: "text",
        required: false,
        placeholder: "Pl. leverage risk",
        validation: { maxLength: 120 }
      }
    ]
  },
  {
    id: "dummy-8",
    name: "Dummy 8",
    description: "Altalanos helyorzo workflow.",
    prompt_template: [
      "Feladat: valaszolj roviden a kovetkezo feladatra:",
      "{{task_text}}"
    ].join("\n"),
    fields: [
      {
        field_id: "task_text",
        label: "Feladat",
        type: "textarea",
        required: true,
        placeholder: "Ird le mit csinaljon a kartya",
        validation: { minLength: 5 }
      }
    ]
  }
];

app.use(express.json({ limit: "1mb" }));

function sha256(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function timingSafeHexEqual(a, b) {
  const sA = String(a || "");
  const sB = String(b || "");
  if (sA.length !== sB.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(sA, "hex"), Buffer.from(sB, "hex"));
}

function findAuthUser(username) {
  const sUsername = String(username || "").trim().toLowerCase();
  return AUTH_USERS.find(function(user) {
    return String(user.username || "").toLowerCase() === sUsername;
  }) || null;
}

function publicAuthUser(user) {
  if (!user) {
    return null;
  }
  return {
    username: user.username,
    displayName: user.displayName || user.username
  };
}

function parseCookies(req) {
  const header = String((req && req.headers && req.headers.cookie) || "");
  return header.split(";").reduce(function(acc, part) {
    const idx = part.indexOf("=");
    if (idx <= 0) {
      return acc;
    }
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    acc[key] = decodeURIComponent(val);
    return acc;
  }, {});
}

function setAuthCookie(res, token) {
  const isProduction = process.env.NODE_ENV === "production";
  const parts = [
    AUTH_COOKIE_NAME + "=" + encodeURIComponent(String(token || "")),
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=" + Math.max(0, Math.floor(APP_SESSION_TTL_MS / 1000))
  ];
  if (isProduction) {
    parts.push("Secure");
  }
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearAuthCookie(res) {
  res.setHeader("Set-Cookie", [
    AUTH_COOKIE_NAME + "=",
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0"
  ].join("; "));
}

function cleanupAuthSessions() {
  const now = Date.now();
  Array.from(oAuthSessions.entries()).forEach(function(entry) {
    const token = entry[0];
    const session = entry[1];
    if (!session || !session.expiresAt || session.expiresAt <= now) {
      oAuthSessions.delete(token);
    }
  });
}

function createAuthSession(user) {
  cleanupAuthSessions();
  const rawToken = crypto.randomBytes(32).toString("hex");
  const token = sha256(APP_SESSION_SECRET + ":" + rawToken);
  const now = Date.now();
  oAuthSessions.set(token, {
    token: token,
    username: user.username,
    displayName: user.displayName || user.username,
    createdAt: now,
    expiresAt: now + APP_SESSION_TTL_MS
  });
  return token;
}

function getAuthSession(req) {
  cleanupAuthSessions();
  const cookies = parseCookies(req);
  const token = String(cookies[AUTH_COOKIE_NAME] || "").trim();
  if (!token) {
    return null;
  }
  const session = oAuthSessions.get(token);
  if (!session) {
    return null;
  }
  if (session.expiresAt <= Date.now()) {
    oAuthSessions.delete(token);
    return null;
  }
  session.expiresAt = Date.now() + APP_SESSION_TTL_MS;
  return session;
}

function requireAuth(req, res, next) {
  const session = getAuthSession(req);
  if (!session) {
    res.status(401).json({ error: "Bejelentkezes szukseges." });
    return;
  }
  req.authUser = {
    username: session.username,
    displayName: session.displayName || session.username
  };
  next();
}

function dummy5Token() {
  return crypto.randomUUID ? crypto.randomUUID() : (Date.now() + "_" + Math.random().toString(36).slice(2));
}

function splitToChunks(text, maxLen, overlap) {
  const sText = String(text || "").replace(/\s+/g, " ").trim();
  if (!sText) {
    return [];
  }

  const chunks = [];
  let start = 0;
  const chunkSize = Math.max(400, maxLen || 1200);
  const step = Math.max(200, chunkSize - Math.max(0, overlap || 200));

  while (start < sText.length) {
    const end = Math.min(sText.length, start + chunkSize);
    chunks.push(sText.slice(start, end));
    if (end >= sText.length) {
      break;
    }
    start += step;
  }

  return chunks;
}

function dummy5Keywords(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9Ã¡Ã©Ã­Ã³Ã¶Å‘ÃºÃ¼Å±\s]/gi, " ")
    .split(/\s+/)
    .filter(function(token) {
      return token && token.length >= 3;
    });
}

function selectRelevantChunks(chunks, question, limit) {
  const qTokens = dummy5Keywords(question);
  const scored = (chunks || []).map(function(chunk, idx) {
    const cTokens = new Set(dummy5Keywords(chunk));
    let score = 0;
    qTokens.forEach(function(t) {
      if (cTokens.has(t)) {
        score += 1;
      }
    });
    return {
      idx: idx,
      score: score,
      text: chunk
    };
  });

  return scored
    .sort(function(a, b) {
      return b.score - a.score;
    })
    .slice(0, Math.max(1, limit || 6))
    .map(function(item) {
      return {
        idx: item.idx,
        text: item.text
      };
    });
}

function cleanupDummy5Docs() {
  const now = Date.now();
  const ttlMs = 1000 * 60 * 60 * 6;
  Array.from(oDummy5Docs.entries()).forEach(function(entry) {
    const token = entry[0];
    const doc = entry[1];
    if (!doc || !doc.createdAt || (now - doc.createdAt) > ttlMs) {
      oDummy5Docs.delete(token);
    }
  });
}

function parseOpenAiReply(rawText) {
  let json = null;
  try {
    json = JSON.parse(rawText);
  } catch (_e) {
    json = null;
  }
  return json;
}

function extractResponsesOutputText(responseJson) {
  if (!responseJson) {
    return "";
  }
  if (typeof responseJson.output_text === "string" && responseJson.output_text.trim()) {
    return responseJson.output_text.trim();
  }

  const output = Array.isArray(responseJson.output) ? responseJson.output : [];
  const parts = [];
  output.forEach(function(item) {
    const content = Array.isArray(item && item.content) ? item.content : [];
    content.forEach(function(c) {
      if (c && c.type === "output_text" && typeof c.text === "string") {
        parts.push(c.text);
      }
    });
  });
  return parts.join("\n").trim();
}

function buildPdfFromText(title, text) {
  return new Promise(function(resolve, reject) {
    const doc = new PDFDocument({
      size: "A4",
      margin: 50
    });
    const chunks = [];
    doc.on("data", function(chunk) {
      chunks.push(chunk);
    });
    doc.on("end", function() {
      resolve(Buffer.concat(chunks));
    });
    doc.on("error", reject);

    const normalFont = resolvePdfFontPath();
    if (normalFont) {
      doc.font(normalFont);
    }

    doc.fontSize(18).text(String(title || "Elemzesi eredmeny"), { underline: true });
    doc.moveDown(1.2);
    renderRichPdfBody(doc, String(text || "Nincs eredmeny."));
    doc.end();
  });
}

function resolvePdfFontPath() {
  const candidates = [
    process.env.PDF_FONT_PATH || "",
    path.join(process.env.WINDIR || "C:\\Windows", "Fonts", "arial.ttf"),
    path.join(process.env.WINDIR || "C:\\Windows", "Fonts", "segoeui.ttf")
  ].filter(Boolean);

  for (let i = 0; i < candidates.length; i += 1) {
    if (fs.existsSync(candidates[i])) {
      return candidates[i];
    }
  }
  return "";
}

function renderRichPdfBody(doc, text) {
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] || "";
    if (isTableBlockStart(lines, i)) {
      const block = [];
      while (i < lines.length && isPipeTableLine(lines[i])) {
        block.push(lines[i]);
        i += 1;
      }
      renderPdfTable(doc, block);
      doc.moveDown(0.8);
      continue;
    }

    if (!line.trim()) {
      doc.moveDown(0.5);
      i += 1;
      continue;
    }

    doc.fontSize(11).text(line, {
      align: "left",
      lineGap: 2
    });
    i += 1;
  }
}

function isPipeTableLine(line) {
  const s = String(line || "").trim();
  if (!s) {
    return false;
  }
  return (s.match(/\|/g) || []).length >= 2;
}

function isSeparatorRow(cells) {
  if (!Array.isArray(cells) || cells.length === 0) {
    return false;
  }
  return cells.every(function(cell) {
    const s = String(cell || "").trim();
    return !!s && /^:?-{3,}:?$/.test(s);
  });
}

function isTableBlockStart(lines, index) {
  if (!isPipeTableLine(lines[index])) {
    return false;
  }
  if (index + 1 >= lines.length) {
    return false;
  }
  const nextCells = parsePipeRow(lines[index + 1]);
  return isSeparatorRow(nextCells) || isPipeTableLine(lines[index + 1]);
}

function parsePipeRow(line) {
  const raw = String(line || "").trim();
  let row = raw;
  if (row.startsWith("|")) {
    row = row.slice(1);
  }
  if (row.endsWith("|")) {
    row = row.slice(0, -1);
  }
  return row.split("|").map(function(cell) {
    return String(cell || "").trim();
  });
}

function ensurePageSpace(doc, neededHeight) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + neededHeight > bottom) {
    doc.addPage();
  }
}

function renderPdfTable(doc, tableLines) {
  let rows = (tableLines || []).map(parsePipeRow).filter(function(r) {
    return r.length > 0;
  });
  rows = rows.filter(function(r) {
    return !isSeparatorRow(r);
  });

  if (rows.length === 0) {
    return;
  }

  const colCount = rows.reduce(function(max, row) {
    return Math.max(max, row.length);
  }, 0);

  if (colCount === 0) {
    return;
  }

  const normalizedRows = rows.map(function(row) {
    const copy = row.slice();
    while (copy.length < colCount) {
      copy.push("");
    }
    return copy;
  });

  const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidth = tableWidth / colCount;
  const padding = 4;

  for (let rowIndex = 0; rowIndex < normalizedRows.length; rowIndex += 1) {
    const row = normalizedRows[rowIndex];
    const heights = row.map(function(cell) {
      return doc.heightOfString(cell, { width: colWidth - padding * 2, lineGap: 1 });
    });
    const rowHeight = Math.max(18, Math.max.apply(null, heights) + padding * 2);

    ensurePageSpace(doc, rowHeight + 2);

    const y = doc.y;
    for (let colIndex = 0; colIndex < colCount; colIndex += 1) {
      const x = doc.page.margins.left + colIndex * colWidth;
      if (rowIndex === 0) {
        doc.rect(x, y, colWidth, rowHeight).fillAndStroke("#F2F4F7", "#3A3A3A");
      } else {
        doc.rect(x, y, colWidth, rowHeight).stroke("#3A3A3A");
      }
      doc.fillColor("#000000");
      doc.fontSize(10).text(row[colIndex], x + padding, y + padding, {
        width: colWidth - padding * 2,
        lineGap: 1
      });
    }
    doc.y = y + rowHeight;
  }
}

async function callOpenAiText(messages, temperature) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + OPENAI_API_KEY
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: messages,
      temperature: typeof temperature === "number" ? temperature : 0.2
    })
  });

  const raw = await response.text();
  const json = parseOpenAiReply(raw);

  if (!response.ok) {
    throw new Error("OpenAI hiba: " + (json ? JSON.stringify(json) : raw));
  }

  const text =
    json &&
    json.choices &&
    json.choices[0] &&
    json.choices[0].message &&
    json.choices[0].message.content;

  return String(text || "").trim();
}

function getNoahCardById(cardId) {
  const id = String(cardId || "").trim();
  return NOAH_CARDS.find(function(card) {
    return card.id === id;
  }) || null;
}

function toPublicNoahCard(card) {
  if (!card) {
    return null;
  }
  return {
    id: card.id,
    name: card.name,
    description: card.description,
    fields: card.fields
  };
}

function buildNoahRouterSystemPrompt() {
  return [
    "Te egy intent-router vagy a Noah chatbothoz.",
    "A feladatod: valaszd ki, hogy a felhasznalo uzenetehez melyik Joker kartya illeszkedik a legjobban.",
    "Ha egyik kartya sem relevans, selected_card_id legyen null.",
    "",
    "Szabalyok:",
    "- Csak az elerheto kartya id-k kozul valaszthatsz.",
    "- A confidence 0 es 1 kozotti szam legyen.",
    "- rationale_short maximum 1 mondat.",
    "- required_fields tombben csak a kivalsztott kartya field_id-ja szerepelhet.",
    "- needs_confirmation legyen true, ha a kerdes ketertelmu vagy confidence alacsony.",
    "",
    "Kimenet kotelezoen JSON objektum a schema szerint, extra szoveg nelkul."
  ].join("\n");
}

function normalizeRouterResponse(raw) {
  const out = {
    selected_card_id: null,
    confidence: 0,
    ui_hint: "Altalanos AI valasz",
    rationale_short: "",
    required_fields: [],
    needs_confirmation: false
  };

  if (!raw || typeof raw !== "object") {
    return out;
  }

  const selected = raw.selected_card_id == null ? null : String(raw.selected_card_id).trim();
  const card = selected ? getNoahCardById(selected) : null;
  out.selected_card_id = card ? card.id : null;
  out.ui_hint = String(raw.ui_hint || (card ? card.name : "Altalanos AI valasz"));
  out.rationale_short = String(raw.rationale_short || "");

  const confidence = Number(raw.confidence);
  out.confidence = Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0;

  const rawRequired = Array.isArray(raw.required_fields) ? raw.required_fields : [];
  if (card) {
    const allowed = new Set((card.fields || []).map(function(field) { return String(field.field_id); }));
    out.required_fields = rawRequired.map(function(item) {
      return {
        field_id: String(item && item.field_id ? item.field_id : "").trim(),
        prefill: item && item.prefill != null ? String(item.prefill) : null
      };
    }).filter(function(item) {
      return !!item.field_id && allowed.has(item.field_id);
    });
  }

  out.needs_confirmation = !!raw.needs_confirmation || (out.confidence < NOAH_LOW_CONFIDENCE_THRESHOLD && !!out.selected_card_id);
  return out;
}

async function runNoahIntentRouter(userMessage, attachments, history) {
  const publicCards = NOAH_CARDS.map(toPublicNoahCard);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + OPENAI_API_KEY
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "noah_intent_router",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              selected_card_id: {
                anyOf: [
                  { type: "string" },
                  { type: "null" }
                ]
              },
              confidence: { type: "number" },
              ui_hint: { type: "string" },
              rationale_short: { type: "string" },
              required_fields: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    field_id: { type: "string" },
                    prefill: {
                      anyOf: [
                        { type: "string" },
                        { type: "null" }
                      ]
                    }
                  },
                  required: ["field_id", "prefill"]
                }
              },
              needs_confirmation: { type: "boolean" }
            },
            required: ["selected_card_id", "confidence", "ui_hint", "rationale_short", "required_fields", "needs_confirmation"]
          }
        }
      },
      messages: [
        {
          role: "system",
          content: buildNoahRouterSystemPrompt()
        },
        {
          role: "user",
          content: JSON.stringify({
            user_message: String(userMessage || ""),
            attachments: Array.isArray(attachments) ? attachments : [],
            history: Array.isArray(history) ? history.slice(-8) : [],
            available_cards: publicCards
          }, null, 2)
        }
      ]
    })
  });

  const raw = await response.text();
  const json = parseOpenAiReply(raw);
  if (!response.ok) {
    throw new Error("OpenAI hiba: " + (json ? JSON.stringify(json) : raw));
  }

  const content =
    json &&
    json.choices &&
    json.choices[0] &&
    json.choices[0].message &&
    json.choices[0].message.content;

  let parsed = null;
  try {
    parsed = JSON.parse(String(content || "{}"));
  } catch (_err) {
    parsed = null;
  }

  return normalizeRouterResponse(parsed);
}

function applyPromptTemplate(template, values) {
  return String(template || "").replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, function(_m, fieldId) {
    const key = String(fieldId || "");
    if (values && Object.prototype.hasOwnProperty.call(values, key)) {
      return String(values[key] == null ? "" : values[key]);
    }
    return "";
  });
}

function normalizeAttachmentList(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list.map(function(item) {
    return {
      name: String(item && item.name ? item.name : ""),
      type: String(item && item.type ? item.type : ""),
      size: Number(item && item.size ? item.size : 0)
    };
  }).filter(function(item) {
    return !!item.name;
  });
}

function validateNoahFieldValues(card, fieldValues) {
  const values = fieldValues && typeof fieldValues === "object" ? fieldValues : {};
  const errors = [];

  (card.fields || []).forEach(function(field) {
    const id = String(field.field_id);
    const value = String(values[id] == null ? "" : values[id]).trim();
    if (field.required && !value) {
      errors.push("Hianyzo kotelezo mezo: " + id);
      return;
    }

    const minLength = Number(field.validation && field.validation.minLength);
    const maxLength = Number(field.validation && field.validation.maxLength);
    if (value && Number.isFinite(minLength) && minLength > 0 && value.length < minLength) {
      errors.push("Tul rovid mezo: " + id);
    }
    if (value && Number.isFinite(maxLength) && maxLength > 0 && value.length > maxLength) {
      errors.push("Tul hosszu mezo: " + id);
    }
  });

  return {
    ok: errors.length === 0,
    errors: errors
  };
}

async function inferNoahFieldPrefill(card, userMessage, attachments) {
  const fieldDefs = Array.isArray(card && card.fields) ? card.fields : [];
  const requiredFieldIds = fieldDefs.filter(function(field) {
    return !!field.required;
  }).map(function(field) {
    return String(field.field_id);
  });

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + OPENAI_API_KEY
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "noah_card_prefill",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              field_values: {
                type: "object",
                additionalProperties: {
                  anyOf: [
                    { type: "string" },
                    { type: "null" }
                  ]
                }
              }
            },
            required: ["field_values"]
          }
        }
      },
      messages: [
        {
          role: "system",
          content: [
            "Te egy mezo-kitoltÅ‘ asszisztens vagy.",
            "A feladatod: a felhasznaloi kerdesbol toltsd ki a kartya mezoket, ha egyertelmuen kinyerheto.",
            "Ne talalj ki adatot. Ha nincs biztos ertek, legyen null.",
            "Csak JSON objektumot adj vissza."
          ].join("\n")
        },
        {
          role: "user",
          content: JSON.stringify({
            card_id: card.id,
            card_name: card.name,
            fields: fieldDefs,
            required_field_ids: requiredFieldIds,
            user_message: String(userMessage || ""),
            attachments: Array.isArray(attachments) ? attachments : []
          }, null, 2)
        }
      ]
    })
  });

  const raw = await response.text();
  const json = parseOpenAiReply(raw);
  if (!response.ok) {
    throw new Error("OpenAI hiba: " + (json ? JSON.stringify(json) : raw));
  }

  const content =
    json &&
    json.choices &&
    json.choices[0] &&
    json.choices[0].message &&
    json.choices[0].message.content;

  let parsed = null;
  try {
    parsed = JSON.parse(String(content || "{}"));
  } catch (_err) {
    parsed = null;
  }

  const rawValues = parsed && parsed.field_values && typeof parsed.field_values === "object"
    ? parsed.field_values
    : {};

  const normalized = {};
  fieldDefs.forEach(function(field) {
    const id = String(field.field_id);
    const value = rawValues[id];
    normalized[id] = value == null ? "" : String(value).trim();
  });

  const missingRequired = fieldDefs.filter(function(field) {
    const id = String(field.field_id);
    return !!field.required && !String(normalized[id] || "").trim();
  }).map(function(field) {
    return String(field.field_id);
  });

  return {
    field_values: normalized,
    missing_required_fields: missingRequired
  };
}

function openSqliteReadOnly(dbPath) {
  return new Promise(function(resolve, reject) {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, function(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(db);
    });
  });
}

function sqliteAll(db, sql) {
  return new Promise(function(resolve, reject) {
    db.all(sql, [], function(err, rows) {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows || []);
    });
  });
}

function closeSqlite(db) {
  return new Promise(function(resolve, reject) {
    if (!db) {
      resolve();
      return;
    }
    db.close(function(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

function escapeSqliteIdentifier(name) {
  return String(name || "").replace(/"/g, "\"\"");
}

async function loadSqlTableMetadata(dbPath) {
  const db = await openSqliteReadOnly(dbPath);
  try {
    const tables = await sqliteAll(
      db,
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );

    const result = [];
    for (let i = 0; i < tables.length; i += 1) {
      const tableName = String(tables[i] && tables[i].name ? tables[i].name : "").trim();
      if (!tableName) {
        continue;
      }

      const pragmaSql = "PRAGMA table_info(\"" + escapeSqliteIdentifier(tableName) + "\")";
      const columns = await sqliteAll(db, pragmaSql);
      const normalizedColumns = columns.map(function(col) {
        return {
          name: String(col && col.name ? col.name : ""),
          type: String(col && col.type ? col.type : "").trim() || "ismeretlen"
        };
      });

      result.push({
        tableName: tableName,
        columns: normalizedColumns
      });
    }

    return result;
  } finally {
    await closeSqlite(db);
  }
}

async function loadSqlTablePreviews(dbPath, rowLimit) {
  const db = await openSqliteReadOnly(dbPath);
  const maxRows = Math.max(1, Math.min(10, Number(rowLimit || 10)));
  try {
    const tables = await sqliteAll(
      db,
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );

    const previews = [];
    for (let i = 0; i < tables.length; i += 1) {
      const tableName = String(tables[i] && tables[i].name ? tables[i].name : "").trim();
      if (!tableName) {
        continue;
      }

      const columns = await sqliteAll(db, "PRAGMA table_info(\"" + escapeSqliteIdentifier(tableName) + "\")");
      const rows = await sqliteAll(
        db,
        "SELECT * FROM \"" + escapeSqliteIdentifier(tableName) + "\" LIMIT " + maxRows
      );

      previews.push({
        tableName: tableName,
        columns: columns.map(function(col) {
          return String(col && col.name ? col.name : "");
        }).filter(Boolean),
        rows: rows
      });
    }

    return previews;
  } finally {
    await closeSqlite(db);
  }
}

function buildDiscoveryPrompt(tables) {
  function displayTableName(tableName) {
    if (String(tableName || "").trim().toLowerCase() === "ksb1") {
      return "ksb1 (Cost Centers: Actual Line Items)";
    }
    return String(tableName || "");
  }

  const sections = (tables || []).map(function(table) {
    const lines = (table.columns || []).map(function(column) {
      return "- " + column.name + " (" + column.type + ")";
    });
    return displayTableName(table.tableName) + "\n" + lines.join("\n");
  });

  return [
    "Az alÃ¡bbi SQL adattÃ¡blÃ¡k Ã©s mezÅ‘ik Ã¡llnak rendelkezÃ©sre:",
    "",
    sections.join("\n\n"),
    "",
    "KÃ©rlek javasolj 5-7 Ã¼zletileg hasznos Machine Learning elemzÃ©si lehetÅ‘sÃ©get,",
    "amelyek ezen adatok alapjÃ¡n megvalÃ³sÃ­thatÃ³k.",
    "",
    "Minden javaslat tartalmazza:",
    "- Az elemzÃ©s nevÃ©t",
    "- RÃ¶vid Ã¼zleti magyarÃ¡zatot",
    "- Milyen tÃ­pusÃº ML modell illeszkedik hozzÃ¡ (pl. klasszifikÃ¡ciÃ³, regressziÃ³, klaszterezÃ©s, anomÃ¡lia detektÃ¡lÃ¡s)",
    "- Milyen fÅ‘ mezÅ‘k szÃ¼ksÃ©gesek hozzÃ¡",
    "",
    "A valasz kotelezoen JSON tomb legyen, elemenkent ilyen mezokkel:",
    "title, business_value, ml_type, required_fields"
  ].join("\n");
}

function buildSchemaHintFromTables(tables) {
  function decorateTableName(tableName) {
    const sName = String(tableName || "").trim();
    if (sName.toLowerCase() === "ksb1") {
      return "ksb1 [Cost Centers: Actual Line Items]";
    }
    return sName;
  }

  const rows = (tables || []).map(function(table) {
    const tableName = String(table && table.tableName ? table.tableName : "").trim();
    const columnNames = Array.isArray(table && table.columns)
      ? table.columns.map(function(col) { return String(col && col.name ? col.name : "").trim(); }).filter(Boolean)
      : [];
    if (!tableName || columnNames.length === 0) {
      return "";
    }
    return decorateTableName(tableName) + ": " + columnNames.join(", ");
  }).filter(Boolean);

  return rows.join("\n");
}

async function getNoahDynamicDefaultFieldValues(cardId) {
  const id = String(cardId || "").trim();
  if (id !== "dummy-4") {
    return {};
  }

  const tables = await loadSqlTableMetadata(DISCOVERY_DB_PATH);
  const schemaHint = buildSchemaHintFromTables(tables);
  return {
    schema_hint: schemaHint
  };
}

function normalizeDiscoverySuggestions(payload) {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload.map(function(item) {
    return {
      title: String(item && item.title ? item.title : "").trim(),
      business_value: String(item && item.business_value ? item.business_value : "").trim(),
      ml_type: String(item && item.ml_type ? item.ml_type : "").trim(),
      required_fields: Array.isArray(item && item.required_fields)
        ? item.required_fields.map(function(field) { return String(field || "").trim(); }).filter(Boolean)
        : []
    };
  }).filter(function(item) {
    return item.title && item.business_value && item.ml_type && item.required_fields.length > 0;
  }).slice(0, 7);
}

function discoveryToken(prefix) {
  const core = crypto.randomUUID ? crypto.randomUUID() : (Date.now() + "_" + Math.random().toString(36).slice(2));
  return String(prefix || "d") + "_" + core;
}

function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function toSimpleYaml(value, indent) {
  const space = " ".repeat(indent || 0);
  if (value == null) {
    return "null";
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }
    return value.map(function(item) {
      const rendered = toSimpleYaml(item, (indent || 0) + 2);
      if (typeof item === "object" && item !== null) {
        return space + "-\n" + rendered.split("\n").map(function(line) {
          return " ".repeat((indent || 0) + 2) + line;
        }).join("\n");
      }
      return space + "- " + rendered;
    }).join("\n");
  }
  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      return "{}";
    }
    return keys.map(function(key) {
      const v = value[key];
      if (typeof v === "object" && v !== null) {
        return space + key + ":\n" + toSimpleYaml(v, (indent || 0) + 2);
      }
      return space + key + ": " + toSimpleYaml(v, 0);
    }).join("\n");
  }
  if (typeof value === "string") {
    if (!value) {
      return "\"\"";
    }
    if (/[:#\-\n]/.test(value) || /\s/.test(value)) {
      return "\"" + value.replace(/"/g, "\\\"") + "\"";
    }
    return value;
  }
  return String(value);
}

async function generateDiscoveryBusinessQuestions(useCase, schemaTables) {
  const mandatoryLabelQuestion = [
    "Kérdés: Hogyan nevezzük üzletileg a prediction_label kategóriákat ennél a use case-nél (pl. \"Elkötelezett vevő\", \"Új vevő\"), és melyik mit jelent?",
    "Miért fontos: A modell kimenete csak akkor használható döntéshozatalra, ha a címkék üzletileg egyértelműek és közösen értelmezettek.",
    "Üzleti hatás: Ez meghatározza, milyen üzleti akció induljon a modell által adott kategória alapján."
  ].join("\\n");
  const fallbackQuestions = [
    "Kérdés: Melyik üzleti döntést szeretnéd támogatni ezzel az elemzéssel?\\nMiért fontos: A modell célját ehhez a döntéshez kell igazítani.\\nÜzleti hatás: Ettől függ, hogy a kimenet valóban használható-e a napi működésben.",
    "Kérdés: Milyen időtávra kérsz előrejelzést vagy értékelést (pl. 30 nap, negyedév)?\\nMiért fontos: Az időtáv meghatározza, milyen mintákat tekintünk relevánsnak.\\nÜzleti hatás: Rossz időtáv esetén a kimenet nem lesz beilleszthető a tervezési ciklusba.",
    "Kérdés: Milyen bontásban szeretnéd látni az eredményt (pl. ügyfél, ország, termék)?\\nMiért fontos: A megfelelő részletezettség nélkül a modell output nehezen használható.\\nÜzleti hatás: A döntések pontossága és sebessége romolhat.",
    mandatoryLabelQuestion,
    "Kérdés: Mi alapján tekintjük sikeresnek a modellt üzletileg?\\nMiért fontos: A siker kritériumát előre rögzíteni kell az értékeléshez.\\nÜzleti hatás: Ez dönti el, hogy a modell éles használatra alkalmas-e."
  ];

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + OPENAI_API_KEY
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.2,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "discovery_question_set",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                questions: {
                  type: "array",
                  minItems: 3,
                  maxItems: 5,
                  items: { type: "string" }
                }
              },
              required: ["questions"]
            }
          }
        },
        messages: [
          {
            role: "system",
            content: [
              "Te egy üzleti szemléletű ML asszisztens vagy, aki adatmérnöki háttérrel rendelkezik.",
              "Üzleti döntéshozókkal kommunikálsz.",
              "",
              "Feladatod:",
              "Maximum 5 kérdést tegyél fel a megadott use case alapján.",
              "",
              "A kérdések érinthetik:",
              "- adatmodellezést",
              "- algoritmus működését",
              "- adatelőkészítést",
              "- modell célját és működési logikáját",
              "",
              "A kérdések nem lehetnek technikai zsargonban megfogalmazva.",
              "A kérdéseknek egy üzleti felhasználó számára érthetőnek kell lenniük.",
              "",
              "Minden kérdés után röviden (1-2 mondatban) magyarázd el:",
              "- Miért fontos ez a kérdés?",
              "- Hogyan befolyásolja a modell működését vagy az üzleti eredményt?",
              "",
              "Ne kérdezz rendszerarchitektúráról vagy IT infrastruktúráról.",
              "Az egyik kérdés kötelezően kérdezzen rá a prediction_label üzleti elnevezésére és jelentésére.",
              "",
              "A questions tömb minden eleme egyetlen szöveg legyen ebben a formátumban:",
              "Kérdés: ...\\nMiért fontos: ...\\nÜzleti hatás: ..."
            ].join("\n")
          },
          {
            role: "user",
            content: JSON.stringify({
              use_case: useCase,
              data_schema: schemaTables
            }, null, 2)
          }
        ]
      })
    });

    const raw = await response.text();
    const json = parseOpenAiReply(raw);
    if (!response.ok) {
      throw new Error("OpenAI hiba: " + (json ? JSON.stringify(json) : raw));
    }
    const content = json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
    const parsed = JSON.parse(String(content || "{}"));
    const questions = Array.isArray(parsed && parsed.questions) ? parsed.questions.map(function(q) { return String(q || "").trim(); }).filter(Boolean) : [];
    if (questions.length > 0) {
      const hasLabelQuestion = questions.some(function(q) {
        const s = String(q || "").toLowerCase();
        return s.indexOf("prediction_label") >= 0 || s.indexOf("címk") >= 0 || (s.indexOf("label") >= 0 && s.indexOf("üzleti") >= 0);
      });
      if (!hasLabelQuestion) {
        if (questions.length >= 5) {
          questions[questions.length - 1] = mandatoryLabelQuestion;
        } else {
          questions.push(mandatoryLabelQuestion);
        }
      }
      return questions.slice(0, 5);
    }
    return fallbackQuestions;
  } catch (_e) {
    return fallbackQuestions;
  }
}
async function generateDiscoveryTrainingSpec(useCase, qa, schemaTables) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + OPENAI_API_KEY
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.1,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "discovery_training_spec",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              use_case_id: { type: "string" },
              business_goal: { type: "string" },
              prediction_horizon: { type: "string" },
              aggregation_level: { type: "string" },
              optimization_target: { type: "string" },
              priorities: { type: "array", items: { type: "string" } },
              success_criteria: { type: "string" },
              prediction_label_semantics: {
                type: "object",
                additionalProperties: false,
                properties: {
                  field_name: { type: "string" },
                  labels: {
                    type: "array",
                    minItems: 2,
                    maxItems: 3,
                    items: { type: "string" }
                  },
                  label_meaning: { type: "string" }
                },
                required: ["field_name", "labels", "label_meaning"]
              }
            },
            required: [
              "use_case_id",
              "business_goal",
              "prediction_horizon",
              "aggregation_level",
              "optimization_target",
              "priorities",
              "success_criteria",
              "prediction_label_semantics"
            ]
          }
        }
      },
      messages: [
        {
          role: "system",
          content: [
            "Te egy ML trÃ©ning specifikÃ¡ciÃ³ Ã¶sszeÃ¡llÃ­tÃ³ vagy.",
            "Csak Ã¼zleti specifikÃ¡ciÃ³bÃ³l dolgozz, technikai paramÃ©tert ne talÃ¡lj ki.",
            "A prediction_label_semantics mezÅ‘ben 2-3 darab Ã¼zletileg Ã©rthetÅ‘ cÃ­mkÃ©t adj meg (ne technikai cÃ­mkÃ©ket, pl. ne csak 'normal')."
          ].join("\n")
        },
        {
          role: "user",
          content: JSON.stringify({
            use_case: useCase,
            qa: qa,
            data_schema: schemaTables
          }, null, 2)
        }
      ]
    })
  });

  const raw = await response.text();
  const json = parseOpenAiReply(raw);
  if (!response.ok) {
    throw new Error("OpenAI hiba: " + (json ? JSON.stringify(json) : raw));
  }
  const content = json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
  const parsed = JSON.parse(String(content || "{}"));
  const specObject = Object.assign({}, parsed, {
    data: {
      source: "sqlite",
      db_path: DISCOVERY_DB_PATH,
      tables: (schemaTables || []).map(function(t) { return t.tableName; })
    },
    output: {
      preview_max_rows: 50,
      csv_export: true
    }
  });
  const yaml = toSimpleYaml(specObject, 0);
  return {
    specObject: specObject,
    yaml: yaml
  };
}

function spawnDiscoveryTrainingJob(jobId, session, specObject, yaml) {
  ensureDirectory(DISCOVERY_JOBS_DIR);
  const jobDir = path.join(DISCOVERY_JOBS_DIR, jobId);
  ensureDirectory(jobDir);
  const specJsonPath = path.join(jobDir, "training_spec.json");
  const specYamlPath = path.join(jobDir, "training_spec.yaml");
  fs.writeFileSync(specJsonPath, JSON.stringify(specObject, null, 2), "utf8");
  fs.writeFileSync(specYamlPath, yaml, "utf8");

  const pyExec = process.env.PYTHON_BIN || "python";
  const child = spawn(pyExec, [
    DISCOVERY_TRAINING_PY,
    "--job-dir", jobDir,
    "--spec-json", specJsonPath
  ], {
    cwd: __dirname,
    env: Object.assign({}, process.env)
  });

  const job = {
    id: jobId,
    sessionId: session.id,
    dir: jobDir,
    status: "running",
    progress: 0,
    message: "Trening folyamatban...",
    startedAt: Date.now(),
    endedAt: null,
    specYaml: yaml,
    summary: "",
    child: child
  };
  oDiscoveryJobs.set(jobId, job);

  child.stdout.on("data", function(chunk) {
    const text = String(chunk || "").trim();
    if (!text) {
      return;
    }
    const lines = text.split(/\r?\n/);
    lines.forEach(function(line) {
      const m = /^\[progress\]\s*(\d+)\s*(.*)$/i.exec(line);
      if (m) {
        job.progress = Math.max(0, Math.min(100, Number(m[1]) || 0));
        job.message = m[2] ? m[2].trim() : job.message;
      }
    });
  });

  child.stderr.on("data", function(chunk) {
    const text = String(chunk || "").trim();
    if (text) {
      job.message = text;
    }
  });

  child.on("close", function(code) {
    job.endedAt = Date.now();
    job.child = null;
    if (Number(code) === 0) {
      job.status = "done";
      job.progress = 100;
      job.message = "Trening befejezve.";
      return;
    }
    job.status = "error";
    job.message = "Trening hiba (exit code: " + code + ").";
  });

  return job;
}

function readDiscoveryJobResult(job) {
  const previewPath = path.join(job.dir, "result_preview.json");
  const metricsPath = path.join(job.dir, "metrics.json");
  const csvPath = path.join(job.dir, "result_full.csv");
  const previewRows = fs.existsSync(previewPath) ? parseOpenAiReply(fs.readFileSync(previewPath, "utf8")) || [] : [];
  const metrics = fs.existsSync(metricsPath) ? parseOpenAiReply(fs.readFileSync(metricsPath, "utf8")) || {} : {};
  return {
    previewRows: Array.isArray(previewRows) ? previewRows.slice(0, 50) : [],
    metrics: metrics,
    csvPath: csvPath
  };
}

async function generateDiscoveryBusinessSummary(session, jobResult) {
  const messages = [
    {
      role: "system",
      content: [
        "Te egy Ã¼zleti elemzÅ‘ asszisztens vagy.",
        "A feladatod: a trÃ©ning eredmÃ©nyt Ã©rtelmezni dÃ¶ntÃ©shozÃ³knak."
      ].join("\n")
    },
    {
      role: "user",
      content: JSON.stringify({
        business_goal: session.useCase && session.useCase.business_value ? session.useCase.business_value : "",
        use_case: session.useCase,
        qa: session.qa,
        metrics: jobResult.metrics,
        preview_rows: jobResult.previewRows
      }, null, 2)
    }
  ];

  try {
    return await callOpenAiText(messages, 0.2);
  } catch (_e) {
    return "Az automatikus Ã¼zleti Ã¶sszefoglalÃ³ nem elÃ©rhetÅ‘. KÃ©rlek ellenÅ‘rizd a metrikÃ¡kat Ã©s az eredmÃ©ny mintÃ¡t.";
  }
}

async function generateDiscoverySuggestions(prompt, tables) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + OPENAI_API_KEY
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "ml_discovery_suggestions",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              suggestions: {
                type: "array",
                minItems: 5,
                maxItems: 7,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    title: { type: "string" },
                    business_value: { type: "string" },
                    ml_type: { type: "string" },
                    required_fields: {
                      type: "array",
                      minItems: 1,
                      items: { type: "string" }
                    }
                  },
                  required: ["title", "business_value", "ml_type", "required_fields"]
                }
              }
            },
            required: ["suggestions"]
          }
        }
      },
      messages: [
        {
          role: "system",
          content: "Te egy adatelemzesi AI asszisztens vagy. Csak valid JSON tombot adj vissza."
        },
        {
          role: "user",
          content: [
            prompt,
            "",
            "Strukturalt sema JSON:",
            JSON.stringify({ tables: tables }, null, 2)
          ].join("\n")
        }
      ]
    })
  });

  const raw = await response.text();
  const json = parseOpenAiReply(raw);
  if (!response.ok) {
    throw new Error("OpenAI hiba: " + (json ? JSON.stringify(json) : raw));
  }

  const content =
    json &&
    json.choices &&
    json.choices[0] &&
    json.choices[0].message &&
    json.choices[0].message.content;

  let parsed = null;
  try {
    parsed = JSON.parse(String(content || "[]"));
  } catch (_e) {
    parsed = null;
  }

  const rawSuggestions = Array.isArray(parsed)
    ? parsed
    : (parsed && Array.isArray(parsed.suggestions) ? parsed.suggestions : []);
  const normalized = normalizeDiscoverySuggestions(rawSuggestions);
  if (normalized.length === 0) {
    throw new Error("Az OpenAI valasz nem tartalmazott ervenyes discovery JSON-t.");
  }

  return normalized;
}

function escapeXml(sValue) {
  return String(sValue == null ? "" : sValue)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sanitizePropertyName(sName, iIndex) {
  const sSanitized = String(sName || "")
    .replace(/[^A-Za-z0-9_]/g, "_")
    .replace(/^[^A-Za-z_]/, "_$&");
  return sSanitized || ("Col_" + (iIndex + 1));
}

function toNumberOrNull(vValue) {
  if (typeof vValue === "number" && Number.isFinite(vValue)) {
    return vValue;
  }
  if (typeof vValue === "string") {
    const sTrimmed = vValue.trim();
    if (!sTrimmed) {
      return null;
    }
    const nValue = Number(sTrimmed);
    if (Number.isFinite(nValue)) {
      return nValue;
    }
  }
  return null;
}

async function inferChartPlanWithOpenAI({ question, generatedSql, columns, sampleRows }) {
  const messages = [
    {
      role: "system",
      content: [
        "Te egy BI chart konfiguracio generalo vagy.",
        "A feladatod: add vissza, mely oszlopok legyenek dimenziok es melyek mertekek SmartCharthoz.",
        "Csak JSON-t adj vissza, semmi mast."
      ].join("\n")
    },
    {
      role: "user",
      content: JSON.stringify({
        task: "Valassz legalabb 1 dimenziot es 1 merteket a chart megjeleniteshez.",
        question: question,
        generatedSql: generatedSql,
        availableColumns: columns,
        sampleRows: sampleRows
      })
    }
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + OPENAI_API_KEY
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: messages
    })
  });

  const raw = await response.text();
  let json = null;
  try {
    json = JSON.parse(raw);
  } catch (_e) {
    json = null;
  }

  if (!response.ok) {
    throw new Error("OpenAI chart plan hiba: " + (json ? JSON.stringify(json) : raw));
  }

  const content = json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
  let plan = null;
  try {
    plan = JSON.parse(String(content || "{}"));
  } catch (_e) {
    plan = null;
  }
  if (!plan || typeof plan !== "object") {
    throw new Error("OpenAI chart plan ervenytelen valasz.");
  }
  return plan;
}

async function resolveChartRolesViaOpenAI({ question, generatedSql, sourceColumns, sampleRows }) {
  const plan = await inferChartPlanWithOpenAI({
    question: question,
    generatedSql: generatedSql,
    columns: sourceColumns,
    sampleRows: sampleRows
  });

  const allowed = new Set(sourceColumns.map(function(c) { return String(c); }));
  const dims = Array.isArray(plan.dimensions) ? plan.dimensions.map(String).filter(function(c) { return allowed.has(c); }) : [];
  const measures = Array.isArray(plan.measures) ? plan.measures.map(String).filter(function(c) { return allowed.has(c); }) : [];

  if (dims.length === 0 || measures.length === 0) {
    throw new Error("OpenAI chart plan nem adott ervenyes dimenzio/mertek kiosztast.");
  }

  return {
    dimensions: dims,
    measures: measures
  };
}

function isLikelyNumericColumn(rows, columnName) {
  let seen = false;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] || {};
    const value = row[columnName];
    if (value == null || value === "") {
      continue;
    }
    seen = true;
    if (toNumberOrNull(value) == null) {
      return false;
    }
  }
  return seen;
}

function normalizeChartRoles(roles, sourceColumns, rows) {
  const numericColumns = sourceColumns.filter(function(col) {
    return isLikelyNumericColumn(rows, col);
  });

  let measures = (roles.measures || []).filter(function(col) {
    return numericColumns.indexOf(col) >= 0;
  });

  if (measures.length === 0 && numericColumns.length > 0) {
    measures = [numericColumns[0]];
  }

  let dimensions = (roles.dimensions || []).filter(function(col) {
    return measures.indexOf(col) < 0;
  });

  if (dimensions.length === 0) {
    dimensions = sourceColumns.filter(function(col) {
      return measures.indexOf(col) < 0;
    });
  }

  if (dimensions.length === 0 && sourceColumns.length > 0) {
    dimensions = [sourceColumns[0]];
  }

  return {
    dimensions: dimensions,
    measures: measures
  };
}

function buildMetadataXml(oPayload) {
  const sNamespace = "DUMMY4_CHART_SRV";
  const aDimCandidates = oPayload.dimensions.filter(function(sName) {
    return sName !== "__RowId";
  });
  const aAnnotationDimensions = (aDimCandidates.length ? aDimCandidates : ["__RowId"]).slice(0, 2);
  const aAnnotationMeasures = oPayload.measures.slice(0, 2);

  const aPropertyLines = [];
  aPropertyLines.push(
    '<Property Name="__RowId" Type="Edm.Int32" Nullable="false" sap:aggregation-role="dimension" sap:label="Row ID" sap:sortable="true" sap:filterable="true" />'
  );

  if (oPayload.dimensions.indexOf("__Category") >= 0) {
    aPropertyLines.push(
      '<Property Name="__Category" Type="Edm.String" Nullable="false" sap:aggregation-role="dimension" sap:label="Category" sap:sortable="true" sap:filterable="true" />'
    );
  }

  oPayload.columns.forEach(function(oCol) {
    if (oCol.isMeasure) {
      aPropertyLines.push(
        '<Property Name="' + escapeXml(oCol.propertyName) + '" Type="Edm.Double" Nullable="true" sap:aggregation-role="measure" sap:label="' + escapeXml(oCol.label) + '" sap:sortable="true" sap:filterable="true" />'
      );
      return;
    }
    aPropertyLines.push(
      '<Property Name="' + escapeXml(oCol.propertyName) + '" Type="Edm.String" Nullable="true" sap:aggregation-role="dimension" sap:label="' + escapeXml(oCol.label) + '" sap:sortable="true" sap:filterable="true" />'
    );
  });

  if (oPayload.measures.indexOf("__Count") >= 0) {
    aPropertyLines.push(
      '<Property Name="__Count" Type="Edm.Int32" Nullable="false" sap:aggregation-role="measure" sap:label="Count" sap:sortable="true" sap:filterable="true" />'
    );
  }

  const sDimensionsXml = aAnnotationDimensions
    .map(function(sName) {
      return "<PropertyPath>" + escapeXml(sName) + "</PropertyPath>";
    })
    .join("");

  const sMeasuresXml = aAnnotationMeasures
    .map(function(sName) {
      return "<PropertyPath>" + escapeXml(sName) + "</PropertyPath>";
    })
    .join("");

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<edmx:Edmx Version="1.0" xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx" xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata" xmlns:sap="http://www.sap.com/Protocols/SAPData">',
    '<edmx:DataServices m:DataServiceVersion="2.0">',
    '<Schema Namespace="' + sNamespace + '" sap:schema-version="1" xmlns="http://schemas.microsoft.com/ado/2008/09/edm">',
    '<EntityType Name="Result" sap:semantics="aggregate">',
    "<Key><PropertyRef Name=\"__RowId\" /></Key>",
    aPropertyLines.join(""),
    "</EntityType>",
    '<EntityContainer Name="' + sNamespace + '" m:IsDefaultEntityContainer="true">',
    '<EntitySet Name="ResultSet" EntityType="' + sNamespace + '.Result" sap:creatable="false" sap:updatable="false" sap:deletable="false" sap:pageable="false" sap:content-version="1" />',
    "</EntityContainer>",
    '<Annotations Target="' + sNamespace + '.Result" xmlns="http://docs.oasis-open.org/odata/ns/edm">',
    '<Annotation Term="com.sap.vocabularies.UI.v1.Chart">',
    "<Record>",
    '<PropertyValue Property="ChartType" EnumMember="com.sap.vocabularies.UI.v1.ChartType/Column" />',
    "<PropertyValue Property=\"Dimensions\"><Collection>" + sDimensionsXml + "</Collection></PropertyValue>",
    "<PropertyValue Property=\"Measures\"><Collection>" + sMeasuresXml + "</Collection></PropertyValue>",
    "</Record>",
    "</Annotation>",
    "</Annotations>",
    "</Schema>",
    "</edmx:DataServices>",
    "</edmx:Edmx>"
  ].join("");
}

async function buildDummy4ChartPayload({ rows, question, generatedSql }) {
  const aRows = rows;
  if (!Array.isArray(aRows) || aRows.length === 0) {
    return null;
  }

  const aSourceColumns = [];
  const mSeenColumns = new Set();
  aRows.forEach(function(oRow) {
    Object.keys(oRow || {}).forEach(function(sKey) {
      if (sKey.indexOf("__") === 0 || mSeenColumns.has(sKey)) {
        return;
      }
      mSeenColumns.add(sKey);
      aSourceColumns.push(sKey);
    });
  });

  if (aSourceColumns.length === 0) {
    return null;
  }

  let roles;
  try {
    roles = await resolveChartRolesViaOpenAI({
      question: question,
      generatedSql: generatedSql,
      sourceColumns: aSourceColumns,
      sampleRows: aRows.slice(0, 10)
    });
  } catch (err) {
    console.warn("[dummy4:chart] OpenAI role inference failed", err && err.message ? err.message : String(err));
    // Emergency fallback only if OpenAI response is invalid/unavailable.
    roles = {
      dimensions: [aSourceColumns[0]],
      measures: [aSourceColumns[Math.min(1, aSourceColumns.length - 1)]]
    };
  }

  roles = normalizeChartRoles(roles, aSourceColumns, aRows);

  const mUsedPropertyNames = new Set();
  const aColumns = aSourceColumns.map(function(sName, iIndex) {
    let sPropertyName = sanitizePropertyName(sName, iIndex);
    let iSuffix = 1;
    while (mUsedPropertyNames.has(sPropertyName)) {
      sPropertyName = sPropertyName + "_" + iSuffix;
      iSuffix += 1;
    }
    mUsedPropertyNames.add(sPropertyName);
    return {
      sourceName: sName,
      propertyName: sPropertyName,
      label: sName,
      isMeasure: roles.measures.indexOf(sName) >= 0
    };
  });

  const aMeasures = aColumns.filter(function(oCol) {
    return oCol.isMeasure;
  }).map(function(oCol) {
    return oCol.propertyName;
  });
  const aDimensions = aColumns.filter(function(oCol) {
    return !oCol.isMeasure;
  }).map(function(oCol) {
    return oCol.propertyName;
  });

  const bNeedsCategory = aDimensions.length === 0;
  const bNeedsCount = aMeasures.length === 0;

  const aOdataRows = aRows.map(function(oRow, iIndex) {
    const oTarget = {
      __RowId: iIndex + 1
    };

    if (bNeedsCategory) {
      oTarget.__Category = "All";
    }

    aColumns.forEach(function(oCol) {
      const vValue = oRow ? oRow[oCol.sourceName] : null;
      if (oCol.isMeasure) {
        const nValue = toNumberOrNull(vValue);
        oTarget[oCol.propertyName] = nValue == null ? 0 : nValue;
        return;
      }
      oTarget[oCol.propertyName] = vValue == null ? "" : String(vValue);
    });

    if (bNeedsCount) {
      oTarget.__Count = 1;
    }

    return oTarget;
  });

  const aFinalDimensions = ["__RowId"].concat(aDimensions);
  if (bNeedsCategory) {
    aFinalDimensions.push("__Category");
  }

  const aFinalMeasures = aMeasures.slice();
  if (bNeedsCount) {
    aFinalMeasures.push("__Count");
  }

  const oPayload = {
    token: crypto.randomUUID ? crypto.randomUUID() : (Date.now() + "_" + Math.random().toString(36).slice(2)),
    columns: aColumns,
    dimensions: aFinalDimensions,
    measures: aFinalMeasures,
    rows: aOdataRows
  };
  oPayload.metadataXml = buildMetadataXml(oPayload);
  return oPayload;
}

function getValidChartCache(req) {
  const sToken = String(
    (req.params && req.params.token) || (req.query && req.query.token) || ""
  ).trim();
  if (!oDummy4ChartCache) {
    return null;
  }
  if (!sToken) {
    return oDummy4ChartCache;
  }
  if (oDummy4ChartCache.token !== sToken) {
    console.warn("[dummy4:chart] token mismatch, fallback to latest cache", JSON.stringify({
      requested: sToken,
      available: oDummy4ChartCache.token
    }));
    return oDummy4ChartCache;
  }
  return oDummy4ChartCache;
}

function buildOdataResultSetPayload(rows, query) {
  const aRows = Array.isArray(rows) ? rows : [];
  const total = aRows.length;
  const skip = Math.max(0, parseInt((query && query.$skip) || "0", 10) || 0);
  const topRaw = parseInt((query && query.$top) || String(total), 10);
  const top = Number.isFinite(topRaw) && topRaw >= 0 ? topRaw : total;
  const sliced = aRows.slice(skip, skip + top);

  return {
    d: {
      results: sliced,
      __count: String(total)
    }
  };
}

app.get("/api/health", function(_req, res) {
  res.json({ ok: true });
});

app.get("/api/auth/me", function(req, res) {
  const session = getAuthSession(req);
  if (!session) {
    res.status(401).json({ error: "Nincs aktiv session." });
    return;
  }
  res.json({
    authenticated: true,
    user: {
      username: session.username,
      displayName: session.displayName || session.username
    }
  });
});

app.post("/api/auth/login", function(req, res) {
  const username = String(req.body && req.body.username ? req.body.username : "").trim();
  const password = String(req.body && req.body.password ? req.body.password : "");

  if (!username || !password) {
    res.status(400).json({ error: "Felhasznalonev es jelszo kotelezo." });
    return;
  }

  const user = findAuthUser(username);
  const passwordHash = sha256(password);
  if (!user || !timingSafeHexEqual(passwordHash, user.passwordSha256)) {
    res.status(401).json({ error: "Hibas belepesi adatok." });
    return;
  }

  const token = createAuthSession(user);
  setAuthCookie(res, token);
  res.json({
    authenticated: true,
    user: publicAuthUser(user)
  });
});

app.post("/api/auth/logout", function(req, res) {
  const session = getAuthSession(req);
  if (session && session.token) {
    oAuthSessions.delete(session.token);
  } else {
    const cookies = parseCookies(req);
    const token = String(cookies[AUTH_COOKIE_NAME] || "").trim();
    if (token) {
      oAuthSessions.delete(token);
    }
  }
  clearAuthCookie(res);
  res.json({ ok: true });
});

app.use("/api", function(req, res, next) {
  if (req.path === "/health" || req.path === "/auth/me" || req.path === "/auth/login" || req.path === "/auth/logout") {
    next();
    return;
  }
  requireAuth(req, res, next);
});

app.get("/api/prompts/dummy4", function(_req, res) {
  res.json({
    sqlPrompt: SQL_PROMPTS,
    summaryPrompt: SUMMARY_PROMPTS
  });
});

app.get("/api/reports/db-preview", async function(req, res) {
  try {
    const maxRows = parseInt(String(req.query && req.query.maxRows ? req.query.maxRows : "10"), 10);
    const tables = await loadSqlTablePreviews(DISCOVERY_DB_PATH, Number.isFinite(maxRows) ? maxRows : 10);
    res.json({
      tables: tables,
      maxRowsPerTable: Math.max(1, Math.min(10, Number.isFinite(maxRows) ? maxRows : 10))
    });
  } catch (err) {
    res.status(500).json({
      error: "Reports DB preview hiba",
      details: err && err.message ? err.message : String(err)
    });
  }
});

app.get("/api/jokers/dummy4/schema-hint", async function(_req, res) {
  try {
    const tables = await loadSqlTableMetadata(DISCOVERY_DB_PATH);
    const schemaHint = buildSchemaHintFromTables(tables);
    res.json({
      schemaHint: schemaHint
    });
  } catch (err) {
    res.status(500).json({
      error: "Dummy4 schema hint lekeresi hiba",
      details: err && err.message ? err.message : String(err)
    });
  }
});

app.post("/api/noah/router", async function(req, res) {
  try {
    if (!OPENAI_API_KEY) {
      res.status(500).json({ error: "OPENAI_API_KEY hianyzik" });
      return;
    }

    const userMessage = String(req.body && req.body.user_message ? req.body.user_message : "").trim();
    const attachments = normalizeAttachmentList(req.body && req.body.attachments);
    const history = Array.isArray(req.body && req.body.history) ? req.body.history : [];

    if (!userMessage && attachments.length === 0) {
      res.status(400).json({ error: "user_message vagy attachments kotelezo." });
      return;
    }

    const routerResp = await runNoahIntentRouter(userMessage, attachments, history);
    console.log("[noah:router]", JSON.stringify({
      selected_card_id: routerResp.selected_card_id,
      confidence: routerResp.confidence,
      needs_confirmation: routerResp.needs_confirmation
    }));

    res.json(routerResp);
  } catch (err) {
    res.status(500).json({
      error: "Noah router hiba",
      details: err && err.message ? err.message : String(err)
    });
  }
});

app.get("/api/noah/cards", function(_req, res) {
  res.json({
    cards: NOAH_CARDS.map(toPublicNoahCard)
  });
});

app.post("/api/noah/prefill-card", async function(req, res) {
  try {
    if (!OPENAI_API_KEY) {
      res.status(500).json({ error: "OPENAI_API_KEY hianyzik" });
      return;
    }

    const cardId = String(req.body && req.body.card_id ? req.body.card_id : "").trim();
    const userMessage = String(req.body && req.body.user_message ? req.body.user_message : "").trim();
    const attachments = normalizeAttachmentList(req.body && req.body.attachments);

    if (!cardId) {
      res.status(400).json({ error: "card_id kotelezo." });
      return;
    }

    const card = getNoahCardById(cardId);
    if (!card) {
      res.status(404).json({ error: "Ismeretlen card_id." });
      return;
    }

    const dynamicDefaults = await getNoahDynamicDefaultFieldValues(card.id);
    const prefill = await inferNoahFieldPrefill(card, userMessage, attachments);
    const mergedFieldValues = Object.assign({}, dynamicDefaults || {}, prefill.field_values || {});

    // Dynamic defaults are authoritative for system-derived fields like schema_hint.
    Object.keys(dynamicDefaults || {}).forEach(function(key) {
      mergedFieldValues[key] = dynamicDefaults[key];
    });

    const missingRequired = (card.fields || []).filter(function(field) {
      const id = String(field.field_id);
      return !!field.required && !String(mergedFieldValues[id] == null ? "" : mergedFieldValues[id]).trim();
    }).map(function(field) {
      return String(field.field_id);
    });

    res.json({
      card_id: card.id,
      field_values: mergedFieldValues,
      missing_required_fields: missingRequired
    });
  } catch (err) {
    res.status(500).json({
      error: "Noah prefill hiba",
      details: err && err.message ? err.message : String(err)
    });
  }
});

app.get("/api/noah/cards/:cardId", async function(req, res) {
  try {
    const cardId = String(req.params && req.params.cardId ? req.params.cardId : "").trim();
    const card = getNoahCardById(cardId);
    if (!card) {
      res.status(404).json({ error: "Ismeretlen card_id." });
      return;
    }

    const defaultFieldValues = await getNoahDynamicDefaultFieldValues(card.id);
    res.json({
      card: toPublicNoahCard(card),
      default_field_values: defaultFieldValues
    });
  } catch (err) {
    res.status(500).json({
      error: "Noah card lekeresi hiba",
      details: err && err.message ? err.message : String(err)
    });
  }
});

app.post("/api/noah/run-card", async function(req, res) {
  try {
    if (!OPENAI_API_KEY) {
      res.status(500).json({ error: "OPENAI_API_KEY hianyzik" });
      return;
    }

    const cardId = String(req.body && req.body.card_id ? req.body.card_id : "").trim();
    const userMessage = String(req.body && req.body.user_message ? req.body.user_message : "").trim();
    const fieldValues = req.body && req.body.field_values ? req.body.field_values : {};
    const attachments = normalizeAttachmentList(req.body && req.body.attachments);

    const card = getNoahCardById(cardId);
    if (!card) {
      res.status(400).json({ error: "Ervenytelen card_id." });
      return;
    }

    const validation = validateNoahFieldValues(card, fieldValues);
    if (!validation.ok) {
      res.status(400).json({
        error: "Mezo validacios hiba",
        details: validation.errors
      });
      return;
    }

    if (card.id === "dummy-4") {
      const question = String(fieldValues.question || userMessage || "").trim();
      const schemaHint = String(fieldValues.schema_hint || "").trim();
      if (!question || !schemaHint) {
        res.status(400).json({
          error: "Dummy-4 mezok hianyoznak",
          details: ["question es schema_hint kotelezo"]
        });
        return;
      }

      const d4 = await executeDummy4({
        apiKey: OPENAI_API_KEY,
        model: OPENAI_MODEL,
        question: question,
        schemaHint: schemaHint
      });

      res.json({
        card_id: card.id,
        card_name: card.name,
        result: [
          "General SQL:",
          d4.generatedSql || "",
          "",
          "Osszegzes:",
          d4.summary || ""
        ].join("\n"),
        payload: {
          generatedSql: d4.generatedSql || "",
          summary: d4.summary || "",
          rows: d4.rows || []
        },
        used_fields: fieldValues,
        attachments: attachments
      });
      return;
    }

    const renderedPrompt = applyPromptTemplate(card.prompt_template, fieldValues);
    const attachmentsText = attachments.length > 0
      ? attachments.map(function(file) {
        return "- " + file.name + " (" + file.type + ", " + file.size + " B)";
      }).join("\n")
      : "Nincs csatolmany.";

    const result = await callOpenAiText([
      {
        role: "system",
        content: "Te a Noah kartya-futtato asszisztense vagy. A valasz legyen konkret, rovid es gyakorlatias."
      },
      {
        role: "user",
        content: [
          "Kartya:",
          card.name,
          "",
          "Kartya prompt:",
          renderedPrompt,
          "",
          "Felhasznaloi uzenet:",
          userMessage || "(nincs)",
          "",
          "Csatolmany metadata:",
          attachmentsText
        ].join("\n")
      }
    ], 0.2);

    res.json({
      card_id: card.id,
      card_name: card.name,
      result: result,
      used_fields: fieldValues,
      attachments: attachments
    });
  } catch (err) {
    res.status(500).json({
      error: "Noah run-card hiba",
      details: err && err.message ? err.message : String(err)
    });
  }
});

app.post("/api/noah/chat", async function(req, res) {
  try {
    if (!OPENAI_API_KEY) {
      res.status(500).json({ error: "OPENAI_API_KEY hianyzik" });
      return;
    }

    const message = String(req.body && req.body.message ? req.body.message : "").trim();
    const attachments = normalizeAttachmentList(req.body && req.body.attachments);
    const history = Array.isArray(req.body && req.body.history) ? req.body.history : [];

    if (!message && attachments.length === 0) {
      res.status(400).json({ error: "Ures noah chat uzenet." });
      return;
    }

    const historyMessages = history
      .filter(function(item) {
        return item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string";
      })
      .slice(-8)
      .map(function(item) {
        return {
          role: item.role,
          content: item.content
        };
      });

    const attachmentText = attachments.length > 0
      ? attachments.map(function(file) {
        return "- " + file.name + " (" + file.type + ", " + file.size + " B)";
      }).join("\n")
      : "Nincs csatolmany.";

    const messages = [
      {
        role: "system",
        content: "Te Noah vagy: modern, letszitult chat asszisztens. Valaszolj magyarul, roviden es pontosan."
      }
    ].concat(historyMessages).concat([
      {
        role: "user",
        content: [
          message || "(nincs uzenet, csak csatolmany metadata)",
          "",
          "Csatolmany metadata:",
          attachmentText
        ].join("\n")
      }
    ]);

    const reply = await callOpenAiText(messages, 0.5);
    res.json({ message: reply });
  } catch (err) {
    res.status(500).json({
      error: "Noah chat hiba",
      details: err && err.message ? err.message : String(err)
    });
  }
});

app.post("/api/discovery/spec-chat/start", async function(req, res) {
  try {
    if (!OPENAI_API_KEY) {
      res.status(500).json({ error: "OPENAI_API_KEY hianyzik" });
      return;
    }

    const useCase = req.body && req.body.use_case ? req.body.use_case : null;
    if (!useCase || !useCase.title) {
      res.status(400).json({ error: "use_case kotelezo." });
      return;
    }

    const schemaTables = await loadSqlTableMetadata(DISCOVERY_DB_PATH);
    const questions = await generateDiscoveryBusinessQuestions(useCase, schemaTables);
    const sessionId = discoveryToken("spec");

    oDiscoverySpecSessions.set(sessionId, {
      id: sessionId,
      useCase: useCase,
      schemaTables: schemaTables,
      questions: questions.slice(0, 5),
      qa: [],
      createdAt: Date.now(),
      trainingSpecYaml: "",
      trainingSpecObject: null
    });

    res.json({
      session_id: sessionId,
      question: questions[0] || "",
      step: 1,
      max_steps: Math.min(5, questions.length)
    });
  } catch (err) {
    res.status(500).json({
      error: "Discovery spec-chat start hiba",
      details: err && err.message ? err.message : String(err)
    });
  }
});

app.post("/api/discovery/spec-chat/answer", function(req, res) {
  try {
    const sessionId = String(req.body && req.body.session_id ? req.body.session_id : "").trim();
    const answer = String(req.body && req.body.answer ? req.body.answer : "").trim();
    if (!sessionId || !oDiscoverySpecSessions.has(sessionId)) {
      res.status(404).json({ error: "Spec session nem talalhato." });
      return;
    }
    if (!answer) {
      res.status(400).json({ error: "Valasz kotelezo." });
      return;
    }

    const session = oDiscoverySpecSessions.get(sessionId);
    const idx = session.qa.length;
    const question = session.questions[idx] || "";
    session.qa.push({
      question: question,
      answer: answer
    });

    const nextIndex = session.qa.length;
    if (nextIndex < session.questions.length && nextIndex < 5) {
      res.json({
        done: false,
        session_id: sessionId,
        question: session.questions[nextIndex],
        step: nextIndex + 1,
        max_steps: Math.min(5, session.questions.length)
      });
      return;
    }

    res.json({
      done: true,
      session_id: sessionId,
      qa: session.qa
    });
  } catch (err) {
    res.status(500).json({
      error: "Discovery spec-chat answer hiba",
      details: err && err.message ? err.message : String(err)
    });
  }
});

app.post("/api/discovery/training/spec", async function(req, res) {
  try {
    if (!OPENAI_API_KEY) {
      res.status(500).json({ error: "OPENAI_API_KEY hianyzik" });
      return;
    }

    const sessionId = String(req.body && req.body.session_id ? req.body.session_id : "").trim();
    if (!sessionId || !oDiscoverySpecSessions.has(sessionId)) {
      res.status(404).json({ error: "Spec session nem talalhato." });
      return;
    }

    const session = oDiscoverySpecSessions.get(sessionId);
    const spec = await generateDiscoveryTrainingSpec(session.useCase, session.qa, session.schemaTables);
    session.trainingSpecYaml = spec.yaml;
    session.trainingSpecObject = Object.assign({}, spec.specObject, {
      use_case: session.useCase,
      qa: session.qa
    });

    res.json({
      session_id: sessionId,
      training_spec_yaml: session.trainingSpecYaml
    });
  } catch (err) {
    res.status(500).json({
      error: "Discovery training spec hiba",
      details: err && err.message ? err.message : String(err)
    });
  }
});

app.post("/api/discovery/training/start", function(req, res) {
  try {
    const sessionId = String(req.body && req.body.session_id ? req.body.session_id : "").trim();
    if (!sessionId || !oDiscoverySpecSessions.has(sessionId)) {
      res.status(404).json({ error: "Spec session nem talalhato." });
      return;
    }

    const session = oDiscoverySpecSessions.get(sessionId);
    if (!session.trainingSpecObject || !session.trainingSpecYaml) {
      res.status(400).json({ error: "Training specifikacio hianyzik." });
      return;
    }

    const jobId = discoveryToken("job");
    spawnDiscoveryTrainingJob(jobId, session, session.trainingSpecObject, session.trainingSpecYaml);

    res.json({
      job_id: jobId
    });
  } catch (err) {
    res.status(500).json({
      error: "Discovery training start hiba",
      details: err && err.message ? err.message : String(err)
    });
  }
});

app.get("/api/discovery/training/status/:jobId", function(req, res) {
  const jobId = String(req.params && req.params.jobId ? req.params.jobId : "").trim();
  const job = oDiscoveryJobs.get(jobId);
  if (!job) {
    res.status(404).json({ error: "Job nem talalhato." });
    return;
  }
  res.json({
    job_id: job.id,
    status: job.status,
    progress: job.progress,
    message: job.message
  });
});

app.get("/api/discovery/training/result/:jobId", async function(req, res) {
  try {
    const jobId = String(req.params && req.params.jobId ? req.params.jobId : "").trim();
    const job = oDiscoveryJobs.get(jobId);
    if (!job) {
      res.status(404).json({ error: "Job nem talalhato." });
      return;
    }
    if (job.status !== "done") {
      res.status(409).json({ error: "Job meg nem kesz." });
      return;
    }

    const session = oDiscoverySpecSessions.get(job.sessionId);
    const result = readDiscoveryJobResult(job);
    if (!job.summary) {
      job.summary = await generateDiscoveryBusinessSummary(session || { qa: [], useCase: {} }, result);
    }

    res.json({
      job_id: job.id,
      preview_rows: result.previewRows.slice(0, 50),
      metrics: result.metrics,
      csv_download_url: "/api/discovery/training/result/" + encodeURIComponent(job.id) + "/download.csv",
      business_summary: job.summary,
      training_spec_yaml: job.specYaml
    });
  } catch (err) {
    res.status(500).json({
      error: "Discovery result hiba",
      details: err && err.message ? err.message : String(err)
    });
  }
});

app.get("/api/discovery/training/result/:jobId/download.csv", function(req, res) {
  const jobId = String(req.params && req.params.jobId ? req.params.jobId : "").trim();
  const job = oDiscoveryJobs.get(jobId);
  if (!job) {
    res.status(404).json({ error: "Job nem talalhato." });
    return;
  }
  const csvPath = path.join(job.dir, "result_full.csv");
  if (!fs.existsSync(csvPath)) {
    res.status(404).json({ error: "CSV nem talalhato." });
    return;
  }
  res.download(csvPath, "training_result_" + jobId + ".csv");
});

app.post("/api/discovery/run", async function(_req, res) {
  try {
    if (!OPENAI_API_KEY) {
      res.status(500).json({
        error: "OPENAI_API_KEY hianyzik"
      });
      return;
    }

    const tables = await loadSqlTableMetadata(DISCOVERY_DB_PATH);
    if (tables.length === 0) {
      res.status(400).json({ error: "Nem talalhato adattabla az adatbazisban." });
      return;
    }

    const prompt = buildDiscoveryPrompt(tables);
    const suggestions = await generateDiscoverySuggestions(prompt, tables);

    res.json({
      tables: tables,
      prompt: prompt,
      suggestions: suggestions
    });
  } catch (err) {
    res.status(500).json({
      error: "Discovery feldolgozasi hiba",
      details: err && err.message ? err.message : String(err)
    });
  }
});

app.post("/api/jokers/dummy5/upload", oDummy5Upload.single("file"), async function(req, res) {
  try {
    cleanupDummy5Docs();

    if (!req.file || !req.file.buffer) {
      res.status(400).json({ error: "PDF fajl kotelezo." });
      return;
    }

    const mime = String(req.file.mimetype || "").toLowerCase();
    const name = String(req.file.originalname || "document.pdf");
    if (mime !== "application/pdf" && !name.toLowerCase().endsWith(".pdf")) {
      res.status(400).json({ error: "Csak PDF fajl tamogatott." });
      return;
    }

    const parser = new PDFParse({ data: req.file.buffer });
    let parsed;
    try {
      parsed = await parser.getText();
    } finally {
      await parser.destroy();
    }
    const text = String(parsed && parsed.text ? parsed.text : "").trim();
    if (!text) {
      res.status(400).json({ error: "A PDF-bol nem sikerult olvashato szoveget kinyerni." });
      return;
    }

    const chunks = splitToChunks(text, 1400, 250);
    const token = dummy5Token();
    oDummy5Docs.set(token, {
      token: token,
      fileName: name,
      text: text,
      chunks: chunks,
      createdAt: Date.now()
    });

    res.json({
      docToken: token,
      fileName: name,
      chunks: chunks.length,
      textLength: text.length
    });
  } catch (err) {
    res.status(500).json({
      error: "PDF feldolgozasi hiba",
      details: err && err.message ? err.message : String(err)
    });
  }
});

app.post("/api/jokers/dummy5/summarize", async function(req, res) {
  try {
    if (!OPENAI_API_KEY) {
      res.status(500).json({ error: "OPENAI_API_KEY hianyzik" });
      return;
    }

    const docToken = String(req.body && req.body.docToken ? req.body.docToken : "").trim();
    if (!docToken) {
      res.status(400).json({ error: "docToken kotelezo." });
      return;
    }

    const doc = oDummy5Docs.get(docToken);
    if (!doc) {
      res.status(404).json({ error: "A dokumentum nem talalhato vagy lejart." });
      return;
    }

    const context = (doc.chunks || []).slice(0, 8).join("\n\n---\n\n");
    const summary = await callOpenAiText([
      {
        role: "system",
        content: "Te egy PDF osszegzo asszisztens vagy. Csak a kapott dokumentumreszletek alapjan valaszolj, tomoren magyarul."
      },
      {
        role: "user",
        content: [
          "Keszits rovid (max 5 mondat) osszegzest a dokumentumrol.",
          "Ha nem egyertelmu, azt jelezd.",
          "",
          "Dokumentumreszletek:",
          context
        ].join("\n")
      }
    ], 0.2);

    res.json({ summary: summary });
  } catch (err) {
    res.status(500).json({
      error: "Dummy5 osszegzesi hiba",
      details: err && err.message ? err.message : String(err)
    });
  }
});

app.post("/api/jokers/dummy5/ask", async function(req, res) {
  try {
    if (!OPENAI_API_KEY) {
      res.status(500).json({ error: "OPENAI_API_KEY hianyzik" });
      return;
    }

    const docToken = String(req.body && req.body.docToken ? req.body.docToken : "").trim();
    const question = String(req.body && req.body.question ? req.body.question : "").trim();
    if (!docToken) {
      res.status(400).json({ error: "docToken kotelezo." });
      return;
    }
    if (!question) {
      res.status(400).json({ error: "question kotelezo." });
      return;
    }

    const doc = oDummy5Docs.get(docToken);
    if (!doc) {
      res.status(404).json({ error: "A dokumentum nem talalhato vagy lejart." });
      return;
    }

    const relevant = selectRelevantChunks(doc.chunks || [], question, 6);
    const context = relevant.map(function(r) {
      return "[Chunk " + r.idx + "]\n" + r.text;
    }).join("\n\n---\n\n");

    const answer = await callOpenAiText([
      {
        role: "system",
        content: "Te egy PDF kerdes-valasz asszisztens vagy. Kizarolag a kapott dokumentumreszletekre tamaszkodj. Ha nincs eleg adat, jelezd egyertelmuen."
      },
      {
        role: "user",
        content: [
          "Kerdes:",
          question,
          "",
          "Dokumentumreszletek:",
          context
        ].join("\n")
      }
    ], 0.2);

    res.json({
      answer: answer,
      usedChunkIndexes: relevant.map(function(r) { return r.idx; })
    });
  } catch (err) {
    res.status(500).json({
      error: "Dummy5 kerdes-valasz hiba",
      details: err && err.message ? err.message : String(err)
    });
  }
});

app.post("/api/jokers/dummy7/compare", async function(req, res) {
  try {
    if (!OPENAI_API_KEY) {
      res.status(500).json({ error: "OPENAI_API_KEY hianyzik" });
      return;
    }

    const companyA = String(req.body && req.body.companyA ? req.body.companyA : "").trim();
    const companyB = String(req.body && req.body.companyB ? req.body.companyB : "").trim();
    const focus = String(req.body && req.body.focus ? req.body.focus : "").trim();

    if (!companyA || !companyB) {
      res.status(400).json({ error: "companyA es companyB kotelezo." });
      return;
    }

    const systemPrompt = [
      "You are a senior financial analyst AI operating strictly in RAG mode.",
      "",
      "You must answer ONLY using information retrieved from the connected vector database containing the official 2023 audited annual reports of the companies.",
      "",
      "STRICT RULES:",
      "- Do NOT use prior knowledge.",
      "- Do NOT make assumptions.",
      "- Do NOT estimate missing values.",
      "- If a requested metric is not found in the retrieved documents, explicitly write:",
      "  \"Not found in document.\"",
      "",
      "INPUT FORMAT RULE:",
      "- Company names are always provided as: \"CÃ©g nÃ©v\" (for example: \"Roli Foods\").",
      "",
      "RETRIEVAL PRIORITY:",
      "1. Audited financial tables",
      "2. Consolidated financial statements",
      "3. Notes to the financial statements",
      "4. Narrative management discussion (lowest priority)",
      "",
      "When comparing companies:",
      "- Use exact reported figures.",
      "- Specify currency and units exactly as shown.",
      "- Clearly indicate which company each figure belongs to.",
      "- If conflicting values appear, prefer audited consolidated statements.",
      "",
      "OUTPUT FORMAT (MANDATORY):",
      "",
      "1. Comparison Table",
      "   - Revenue",
      "   - Gross Profit",
      "   - Operating Income (EBIT)",
      "   - Net Income",
      "   - Total Assets",
      "   - Total Liabilities",
      "   - Equity",
      "   - Operating Cash Flow",
      "",
      "2. Variance Analysis",
      "   - Absolute differences",
      "   - Percentage differences (only if both values are found)",
      "",
      "3. Risk Assessment",
      "   - Leverage risk",
      "   - Liquidity risk",
      "   - Profitability risk",
      "",
      "4. Executive Summary (maximum 200 words)",
      "",
      "If insufficient retrieved evidence exists for a proper comparison, clearly state the limitation.",
      "",
      "LANGUAGE:",
      "- The final answer must be in Hungarian.",
      "",
      "FORMATTING FOR PDF (MANDATORY):",
      "- Use plain text with short lines.",
      "- Use clear section headers exactly as numbered above.",
      "- For section 1 and 2, use valid markdown tables only.",
      "- Do not use HTML.",
      "- Do not use bullet nesting.",
      "- Keep cell text compact and avoid multi-line table cells.",
      "- Use UTF-8 characters normally (e.g., Å‘, Å±, Ã¡).",
      "- Do not add decorative symbols."
    ].join("\n");

    const userPrompt = [
      "Compare the following companies using only retrieved document evidence.",
      "Company A: " + companyA,
      "Company B: " + companyB,
      focus ? ("Focus: " + focus) : ""
    ].filter(Boolean).join("\n");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + OPENAI_API_KEY
      },
      body: JSON.stringify({
        model: DUMMY7_MODEL,
        instructions: systemPrompt,
        input: userPrompt,
        tools: [{
          type: "file_search",
          vector_store_ids: [DUMMY7_VECTOR_STORE_ID]
        }]
      })
    });

    const raw = await response.text();
    const json = parseOpenAiReply(raw);
    if (!response.ok) {
      res.status(response.status).json({
        error: "Dummy7 OpenAI hiba",
        details: json || raw
      });
      return;
    }

    const resultText = extractResponsesOutputText(json) || "Nincs erdemi valasz.";
    const pdfBuffer = await buildPdfFromText("Dummy 7 - Penzugyi osszehasonlitas", resultText);
    const fileName = "dummy7_osszehasonlitas.pdf";

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=\"" + fileName + "\"");
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({
      error: "Dummy7 feldolgozasi hiba",
      details: err && err.message ? err.message : String(err)
    });
  }
});

app.get("/api/jokers/dummy4/chart/", function(req, res) {
  const oCache = getValidChartCache(req);
  if (!oCache) {
    res.status(404).json({ error: "Nincs elerheto chart adat ehhez a tokenhez." });
    return;
  }
  res.setHeader("DataServiceVersion", "2.0");
  res.json({
    d: {
      EntitySets: ["ResultSet"]
    }
  });
});

app.get("/api/jokers/dummy4/chart/:meta", function(req, res, next) {
  const sMeta = decodeURIComponent(String(req.params.meta || ""));
  if (sMeta !== "$metadata") {
    next();
    return;
  }
  const oCache = getValidChartCache(req);
  if (!oCache) {
    res.status(404).type("text/plain").send("Nincs elerheto chart metadata ehhez a tokenhez.");
    return;
  }
  res.setHeader("DataServiceVersion", "2.0");
  res.type("application/xml").send(oCache.metadataXml);
});

app.get("/api/jokers/dummy4/chart/ResultSet", function(req, res) {
  const oCache = getValidChartCache(req);
  if (!oCache) {
    res.status(404).json({ error: "Nincs elerheto chart adat ehhez a tokenhez." });
    return;
  }
  res.setHeader("DataServiceVersion", "2.0");
  res.json(buildOdataResultSetPayload(oCache.rows, req.query));
});

app.get("/api/jokers/dummy4/chart/:token/", function(req, res) {
  const oCache = getValidChartCache(req);
  if (!oCache) {
    res.status(404).json({ error: "Nincs elerheto chart adat ehhez a tokenhez." });
    return;
  }
  res.setHeader("DataServiceVersion", "2.0");
  res.json({
    d: {
      EntitySets: ["ResultSet"]
    }
  });
});

app.get("/api/jokers/dummy4/chart/:token/:meta", function(req, res, next) {
  const sMeta = decodeURIComponent(String(req.params.meta || ""));
  if (sMeta !== "$metadata") {
    next();
    return;
  }
  const oCache = getValidChartCache(req);
  if (!oCache) {
    res.status(404).type("text/plain").send("Nincs elerheto chart metadata ehhez a tokenhez.");
    return;
  }
  res.setHeader("DataServiceVersion", "2.0");
  res.type("application/xml").send(oCache.metadataXml);
});

app.get("/api/jokers/dummy4/chart/:token/ResultSet", function(req, res) {
  const oCache = getValidChartCache(req);
  if (!oCache) {
    res.status(404).json({ error: "Nincs elerheto chart adat ehhez a tokenhez." });
    return;
  }
  res.setHeader("DataServiceVersion", "2.0");
  res.json(buildOdataResultSetPayload(oCache.rows, req.query));
});

app.post("/api/chat", async function(req, res) {
  try {
    if (!OPENAI_API_KEY) {
      res.status(500).json({
        error: "OPENAI_API_KEY hianyzik. Allitsd be kornyezeti valtozokent."
      });
      return;
    }

    var sMessage = (req.body && req.body.message ? String(req.body.message) : "").trim();
    var aHistory = Array.isArray(req.body && req.body.history) ? req.body.history : [];

    if (!sMessage) {
      res.status(400).json({ error: "Ures message mezot kaptam." });
      return;
    }

    var aMessages = aHistory
      .filter(function(o) {
        return o && (o.role === "user" || o.role === "assistant") && typeof o.content === "string";
      })
      .map(function(o) {
        return {
          role: o.role,
          content: o.content
        };
      });

    if (aMessages.length === 0 || aMessages[aMessages.length - 1].content !== sMessage) {
      aMessages.push({ role: "user", content: sMessage });
    }

    var oOpenAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + OPENAI_API_KEY
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: aMessages,
        temperature: 0.7
      })
    });

    var sRaw = await oOpenAiResponse.text();
    var oJson = null;
    try {
      oJson = JSON.parse(sRaw);
    } catch (_err) {
      oJson = null;
    }

    if (!oOpenAiResponse.ok) {
      res.status(oOpenAiResponse.status).json({
        error: "OpenAI hiba",
        details: oJson || sRaw
      });
      return;
    }

    var sReply =
      oJson &&
      oJson.choices &&
      oJson.choices[0] &&
      oJson.choices[0].message &&
      oJson.choices[0].message.content
        ? oJson.choices[0].message.content
        : "Ures valasz erkezett.";

    res.json({ message: sReply });
  } catch (err) {
    res.status(500).json({
      error: "Szerver oldali hiba",
      details: err && err.message ? err.message : String(err)
    });
  }
});

app.post("/api/jokers/dummy4", async function(req, res) {
  try {
    if (!OPENAI_API_KEY) {
      res.status(500).json({
        error: "OPENAI_API_KEY hianyzik"
      });
      return;
    }

    const question = String(req.body && req.body.question ? req.body.question : "").trim();
    const schemaHint = String(req.body && req.body.schemaHint ? req.body.schemaHint : "").trim();

    if (!question) {
      res.status(400).json({ error: "A kerdes kotelezo." });
      return;
    }

    if (!schemaHint) {
      res.status(400).json({ error: "A schema hint kotelezo." });
      return;
    }

    const result = await executeDummy4({
      apiKey: OPENAI_API_KEY,
      model: OPENAI_MODEL,
      question,
      schemaHint
    });

    const previewRows = result.rows.map(function(row) {
      return {
        __rowText: JSON.stringify(row),
        ...row
      };
    });

    oDummy4ChartCache = await buildDummy4ChartPayload({
      rows: result.rows,
      question: question,
      generatedSql: result.generatedSql
    });

    res.json({
      generatedSql: result.generatedSql,
      summary: result.summary,
      rows: previewRows,
      chartToken: oDummy4ChartCache ? oDummy4ChartCache.token : ""
    });
  } catch (err) {
    res.status(500).json({
      error: "Dummy4 feldolgozasi hiba",
      details: err && err.message ? err.message : String(err)
    });
  }
});

app.use(express.static(UI_STATIC_DIR));

app.get("*", function(req, res) {
  if (String(req.path || "").startsWith("/api/")) {
    res.status(404).json({ error: "Ismeretlen API endpoint." });
    return;
  }
  res.sendFile(path.join(UI_STATIC_DIR, "index.html"));
});

app.listen(PORT, function() {
  console.log("Chat proxy elindult: http://127.0.0.1:" + PORT);
  console.log("UI static dir:", UI_STATIC_DIR);
});

