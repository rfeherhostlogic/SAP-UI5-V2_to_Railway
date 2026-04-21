sap.ui.define([], function() {
  "use strict";

  function _extractReplyText(oData) {
    if (!oData) {
      return "Ures valasz erkezett.";
    }
    if (typeof oData === "string") {
      return oData;
    }
    if (oData.message) {
      return oData.message;
    }
    if (oData.answer) {
      return oData.answer;
    }
    if (oData.text) {
      return oData.text;
    }
    return JSON.stringify(oData, null, 2);
  }

  function _buildMessage(mPayload) {
    var aParts = [];

    if (mPayload.systemPrompt) {
      aParts.push("System utasitas:\n" + mPayload.systemPrompt);
    }

    aParts.push("Joker tipus: " + mPayload.title);
    aParts.push("Felhasznaloi szoveg:\n" + mPayload.inputText);

    return aParts.join("\n\n");
  }

  function generate(mPayload) {
    return fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: _buildMessage(mPayload),
        history: []
      })
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    }).then(function(oData) {
      return _extractReplyText(oData);
    });
  }

  function runDummy4(mPayload) {
    return fetch("/api/jokers/dummy4", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        question: mPayload.question,
        schemaHint: mPayload.schemaHint
      })
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function runDummy9(mPayload) {
    var oFormData = new FormData();
    oFormData.append("question", mPayload.question || "");
    (mPayload.files || []).forEach(function(oFile) {
      oFormData.append("files", oFile);
    });

    return fetch("/api/jokers/dummy9/run", {
      method: "POST",
      body: oFormData
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function runDummy10() {
    return fetch("/api/jokers/dummy10/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function evaluateDummy11(mPayload) {
    var oFormData = new FormData();
    oFormData.append("raw_request", mPayload.raw_request || "");
    oFormData.append("current_prompt", mPayload.current_prompt || "");
    oFormData.append("messages", JSON.stringify(mPayload.messages || []));
    oFormData.append("feature_flags", JSON.stringify(mPayload.feature_flags || {}));
    (mPayload.files || []).forEach(function(oFile) {
      oFormData.append("files", oFile);
    });

    return fetch("/api/jokers/dummy11/evaluate", {
      method: "POST",
      body: oFormData
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function saveDummy11Prompt(mPayload) {
    return fetch("/api/jokers/dummy11/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(mPayload || {})
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function runDummy11Prompt(mPayload) {
    var oFormData = new FormData();
    oFormData.append("final_prompt", mPayload.final_prompt || "");
    (mPayload.files || []).forEach(function(oFile) {
      oFormData.append("files", oFile);
    });

    return fetch("/api/jokers/dummy11/run", {
      method: "POST",
      body: oFormData
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function startDummy12Analysis(mPayload) {
    var oFormData = new FormData();
    oFormData.append("companies", JSON.stringify(mPayload.companies || []));
    oFormData.append("file_descriptors", JSON.stringify(mPayload.file_descriptors || []));
    (mPayload.files || []).forEach(function(oFile) {
      oFormData.append("files", oFile);
    });

    return fetch("/api/jokers/dummy12/start", {
      method: "POST",
      body: oFormData
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function getDummy12Status(sJobId) {
    return fetch("/api/jokers/dummy12/status/" + encodeURIComponent(String(sJobId || "")), {
      method: "GET"
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function startDummy13AnalysisRun(mPayload) {
    var oFormData = new FormData();
    if (mPayload.planFile) {
      oFormData.append("planFile", mPayload.planFile);
    }
    if (mPayload.actualFile) {
      oFormData.append("actualFile", mPayload.actualFile);
    }
    return fetch("/api/jokers/dummy13/start", {
      method: "POST",
      body: oFormData
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function normalizeDummy13(mPayload) {
    return fetch("/api/jokers/dummy13/normalize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(mPayload || {})
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function runDummy13Analysis(mPayload) {
    return fetch("/api/jokers/dummy13/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(mPayload || {})
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function getDummy13Status(sJobId) {
    return fetch("/api/jokers/dummy13/status/" + encodeURIComponent(String(sJobId || "")), {
      method: "GET"
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function startDummy14AnalysisRun(mPayload) {
    var oFormData = new FormData();
    if (mPayload.planFile) { oFormData.append("planFile", mPayload.planFile); }
    if (mPayload.actualFile) { oFormData.append("actualFile", mPayload.actualFile); }
    return fetch("/api/jokers/dummy14/start", {
      method: "POST",
      body: oFormData
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) { throw new Error("API hiba: " + sError); });
      }
      return oResponse.json();
    });
  }

  function normalizeDummy14(mPayload) {
    return fetch("/api/jokers/dummy14/normalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mPayload || {})
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) { throw new Error("API hiba: " + sError); });
      }
      return oResponse.json();
    });
  }

  function runDummy14Analysis(mPayload) {
    return fetch("/api/jokers/dummy14/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mPayload || {})
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) { throw new Error("API hiba: " + sError); });
      }
      return oResponse.json();
    });
  }

  function getDummy14Status(sJobId) {
    return fetch("/api/jokers/dummy14/status/" + encodeURIComponent(String(sJobId || "")), {
      method: "GET"
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) { throw new Error("API hiba: " + sError); });
      }
      return oResponse.json();
    });
  }

  function getDummy4SchemaHint() {
    return fetch("/api/jokers/dummy4/schema-hint", {
      method: "GET"
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function uploadDummy5Pdf(oFile) {
    var oFormData = new FormData();
    oFormData.append("file", oFile);

    return fetch("/api/jokers/dummy5/upload", {
      method: "POST",
      body: oFormData
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function summarizeDummy5(mPayload) {
    return fetch("/api/jokers/dummy5/summarize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        docToken: mPayload.docToken
      })
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function askDummy5(mPayload) {
    return fetch("/api/jokers/dummy5/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        docToken: mPayload.docToken,
        question: mPayload.question
      })
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function runDummy7Compare(mPayload) {
    return fetch("/api/jokers/dummy7/compare", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        companyA: mPayload.companyA,
        companyB: mPayload.companyB,
        focus: mPayload.focus || ""
      })
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      var sDisposition = oResponse.headers.get("Content-Disposition") || "";
      var aMatch = /filename=\"?([^\";]+)\"?/i.exec(sDisposition);
      return oResponse.blob().then(function(oBlob) {
        return {
          blob: oBlob,
          fileName: aMatch && aMatch[1] ? aMatch[1] : "dummy7_osszehasonlitas.pdf"
        };
      });
    });
  }

  function runSmartSegmentation(mPayload) {
    return fetch("/api/jokers/smart-segmentation/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sql_enabled: !!mPayload.sql_enabled,
        rag_enabled: !!mPayload.rag_enabled,
        combine_mode: mPayload.combine_mode || "AND",
        sql_prompt: mPayload.sql_prompt || "",
        rag_prompt: mPayload.rag_prompt || ""
      })
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function sendSmartSegmentationToCrm(mPayload) {
    return fetch("/api/jokers/smart-segmentation/crm/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        record_ids: mPayload.record_ids || []
      })
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function runDiscovery() {
    return fetch("/api/discovery/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function reportsListWebhooks() {
    return fetch("/api/reports/webhooks", {
      method: "GET"
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function reportsCreateWebhook(mPayload) {
    return fetch("/api/reports/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: mPayload.channel || "",
        url: mPayload.url || ""
      })
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function reportsUpdateWebhook(mPayload) {
    return fetch("/api/reports/webhooks/" + encodeURIComponent(mPayload.id), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: mPayload.channel || "",
        url: mPayload.url || ""
      })
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function reportsDeleteWebhook(mPayload) {
    return fetch("/api/reports/webhooks/" + encodeURIComponent(mPayload.id), {
      method: "DELETE"
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function reportsListSchedules() {
    return fetch("/api/reports/schedules", {
      method: "GET"
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function reportsListFeed(iLimit) {
    var iParsedLimit = Number(iLimit || 10);
    var iSafeLimit = Number.isFinite(iParsedLimit) ? Math.max(1, Math.min(iParsedLimit, 50)) : 10;
    return fetch("/api/reports/feed?limit=" + encodeURIComponent(String(iSafeLimit)), {
      method: "GET"
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function reportsCreateSchedule(mPayload) {
    return fetch("/api/reports/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mPayload || {})
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function reportsUpdateSchedule(mPayload) {
    return fetch("/api/reports/schedules/" + encodeURIComponent(mPayload.id), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mPayload || {})
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function reportsDeleteSchedule(mPayload) {
    return fetch("/api/reports/schedules/" + encodeURIComponent(mPayload.id), {
      method: "DELETE"
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function discoveryGetSchema() {
    return fetch("/api/discovery/schema", {
      method: "GET"
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function discoveryBusinessChat(mPayload) {
    return fetch("/api/discovery/business/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: mPayload.message || "",
        history: mPayload.history || [],
        csv_files: mPayload.csv_files || []
      })
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function discoveryBusinessUploadCsv(aFiles) {
    var oFormData = new FormData();
    (aFiles || []).forEach(function(oFile) {
      oFormData.append("files", oFile);
    });

    return fetch("/api/discovery/business/upload-csv", {
      method: "POST",
      body: oFormData
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function discoverySpecChatStart(mPayload) {
    return fetch("/api/discovery/spec-chat/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        use_case: mPayload.use_case
      })
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function discoverySpecChatAnswer(mPayload) {
    return fetch("/api/discovery/spec-chat/answer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        session_id: mPayload.session_id,
        answer: mPayload.answer
      })
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function discoveryGenerateTrainingSpec(mPayload) {
    return fetch("/api/discovery/training/spec", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        session_id: mPayload.session_id
      })
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function discoveryStartTraining(mPayload) {
    return fetch("/api/discovery/training/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        session_id: mPayload.session_id
      })
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function discoveryGetTrainingStatus(mPayload) {
    return fetch("/api/discovery/training/status/" + encodeURIComponent(mPayload.job_id), {
      method: "GET"
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function discoveryGetTrainingResult(mPayload) {
    return fetch("/api/discovery/training/result/" + encodeURIComponent(mPayload.job_id), {
      method: "GET"
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function noahRoute(mPayload, oSignal) {
    return fetch("/api/noah/router", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      signal: oSignal || undefined,
      body: JSON.stringify({
        user_message: mPayload.user_message || "",
        attachments: mPayload.attachments || [],
        history: mPayload.history || []
      })
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function noahGetCardConfig(sCardId, oSignal) {
    return fetch("/api/noah/cards/" + encodeURIComponent(sCardId), {
      method: "GET",
      signal: oSignal || undefined
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function noahListCards(oSignal) {
    return fetch("/api/noah/cards", {
      method: "GET",
      signal: oSignal || undefined
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function noahPrefillCard(mPayload, oSignal) {
    return fetch("/api/noah/prefill-card", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      signal: oSignal || undefined,
      body: JSON.stringify({
        card_id: mPayload.card_id,
        user_message: mPayload.user_message || "",
        attachments: mPayload.attachments || []
      })
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function noahRunCard(mPayload, oSignal) {
    return fetch("/api/noah/run-card", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      signal: oSignal || undefined,
      body: JSON.stringify({
        card_id: mPayload.card_id,
        user_message: mPayload.user_message || "",
        field_values: mPayload.field_values || {},
        attachments: mPayload.attachments || []
      })
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  function noahAgentPlan(mPayload, oSignal) {
    return fetch("/api/noah/agent/plan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      signal: oSignal || undefined,
      body: JSON.stringify({
        user_message: mPayload.user_message || "",
        attachments: mPayload.attachments || [],
        history: mPayload.history || [],
        feedback: mPayload.feedback || "",
        current_plan: mPayload.current_plan || null,
        excluded_card_ids: mPayload.excluded_card_ids || []
      })
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  // ─── ML WIZARD API ──────────────────────────────────────────────────────────

  function mlWizardInit(mPayload) {
    var oFormData = new FormData();
    oFormData.append("goal", mPayload.goal || "prediction");
    oFormData.append("source_type", mPayload.source_type || "csv");
    // Több tábla: JSON tömb stringként
    oFormData.append("table_names", JSON.stringify(mPayload.table_names || []));
    // Visszafelé-kompatibilitás (single table_name)
    if (mPayload.table_name) { oFormData.append("table_name", mPayload.table_name); }
    // Több CSV fájl
    (mPayload.csv_files || []).forEach(function(oFile) {
      oFormData.append("csv_files", oFile);
    });
    // Egyes fájl fallback
    if (mPayload.csv_file) { oFormData.append("csv_files", mPayload.csv_file); }
    return fetch("/api/ml-wizard/init", {
      method: "POST",
      body: oFormData
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) { throw new Error("API hiba: " + sError); });
      }
      return oResponse.json();
    });
  }

  function mlWizardGetDbTables() {
    return fetch("/api/ml-wizard/db-tables", { method: "GET" }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) { throw new Error("API hiba: " + sError); });
      }
      return oResponse.json();
    });
  }

  function mlWizardStep1AiSuggestions(mPayload) {
    return fetch("/api/ml-wizard/step1/ai-suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: mPayload.session_id || "" })
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) { throw new Error("API hiba: " + sError); });
      }
      return oResponse.json();
    });
  }

  // Új: AI javaslatok oszlopnév-lista alapján (session nélkül)
  function mlWizardStep1AiSuggestionsFromColumns(mPayload) {
    return fetch("/api/ml-wizard/step1/ai-suggestions-from-columns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        goal: mPayload.goal || "prediction",
        source_type: mPayload.source_type || "csv",
        column_names: mPayload.column_names || []
      })
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) { throw new Error("API hiba: " + sError); });
      }
      return oResponse.json();
    });
  }

  // Új: Szabadszavas cél AI finomítása
  function mlWizardStep1RefineGoal(mPayload) {
    return fetch("/api/ml-wizard/step1/refine-goal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        goal_text: mPayload.goal_text || "",
        column_names: mPayload.column_names || [],
        source_type: mPayload.source_type || "csv"
      })
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) { throw new Error("API hiba: " + sError); });
      }
      return oResponse.json();
    });
  }

  // Új: Adatkapcsolás AI javaslat
  function mlWizardStep1bAiJoin(mPayload) {
    return fetch("/api/ml-wizard/step1b/ai-join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: mPayload.session_id || "" })
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) { throw new Error("API hiba: " + sError); });
      }
      return oResponse.json();
    });
  }

  // Új: Aggregálás AI javaslat
  function mlWizardStep1cAiAggregation(mPayload) {
    return fetch("/api/ml-wizard/step1c/ai-aggregation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: mPayload.session_id || "",
        goal_text: mPayload.goal_text || ""
      })
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) { throw new Error("API hiba: " + sError); });
      }
      return oResponse.json();
    });
  }

  // Új: Vezető összefoglaló (cél-alapú) külön lekérdezés
  function mlWizardStep4ExecutiveSummary(mPayload) {
    return fetch("/api/ml-wizard/step4/executive-summary/" + encodeURIComponent(String(mPayload.session_id || "")), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal_text: mPayload.goal_text || "" })
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) { throw new Error("API hiba: " + sError); });
      }
      return oResponse.json();
    });
  }

  function mlWizardStep5SuggestedInputs(mPayload) {
    return fetch("/api/ml-wizard/step5/suggested-inputs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: mPayload.session_id || "",
        goal_text: mPayload.goal_text || "",
        column_names: mPayload.column_names || [],
        date_column: mPayload.date_column || "",
        group_by_keys: mPayload.group_by_keys || []
      })
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) { throw new Error("API hiba: " + sError); });
      }
      return oResponse.json();
    });
  }

  function mlWizardStep2Profile(mPayload) {
    return fetch("/api/ml-wizard/step2/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: mPayload.session_id || "" })
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) { throw new Error("API hiba: " + sError); });
      }
      return oResponse.json();
    });
  }

  function mlWizardGetJobStatus(mPayload) {
    return fetch("/api/ml-wizard/status/" + encodeURIComponent(String(mPayload.job_id || "")), {
      method: "GET"
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) { throw new Error("API hiba: " + sError); });
      }
      return oResponse.json();
    });
  }

  function mlWizardStep2ProfileResult(mPayload) {
    return fetch("/api/ml-wizard/step2/profile-result/" + encodeURIComponent(String(mPayload.session_id || "")), {
      method: "GET"
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) { throw new Error("API hiba: " + sError); });
      }
      return oResponse.json();
    });
  }

  function mlWizardStep2ConfirmFeatures(mPayload) {
    return fetch("/api/ml-wizard/step2/confirm-features", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: mPayload.session_id || "",
        input_columns: mPayload.input_columns || [],
        target_column: mPayload.target_column || "",
        selected_features: mPayload.selected_features || []
      })
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) { throw new Error("API hiba: " + sError); });
      }
      return oResponse.json();
    });
  }

  function mlWizardStep3StartTraining(mPayload) {
    return fetch("/api/ml-wizard/step3/start-training", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: mPayload.session_id || "",
        model_tier: mPayload.model_tier || "balanced",
        date_column: mPayload.date_column || "",
        time_level: mPayload.time_level || "",
        group_by_keys: mPayload.group_by_keys || [],
        forecast_horizon: mPayload.forecast_horizon || 3
      })
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) { throw new Error("API hiba: " + sError); });
      }
      return oResponse.json();
    });
  }

  function mlWizardStep4Result(mPayload) {
    return fetch("/api/ml-wizard/step4/result/" + encodeURIComponent(String(mPayload.session_id || "")), {
      method: "GET"
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) { throw new Error("API hiba: " + sError); });
      }
      return oResponse.json();
    });
  }

  function mlWizardStep5Simulate(mPayload) {
    return fetch("/api/ml-wizard/step5/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: mPayload.session_id || "",
        simulation_changes: mPayload.simulation_changes || {}
      })
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) { throw new Error("API hiba: " + sError); });
      }
      return oResponse.json();
    });
  }

  function mlWizardStep5SimulationResult(mPayload) {
    return fetch("/api/ml-wizard/step5/simulation-result/" + encodeURIComponent(String(mPayload.session_id || "")), {
      method: "GET"
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) { throw new Error("API hiba: " + sError); });
      }
      return oResponse.json();
    });
  }

  // ─── ML WIZARD API END ───────────────────────────────────────────────────────

  function noahChat(mPayload, oSignal) {
    return fetch("/api/noah/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      signal: oSignal || undefined,
      body: JSON.stringify({
        message: mPayload.message || "",
        attachments: mPayload.attachments || [],
        history: mPayload.history || []
      })
    }).then(function(oResponse) {
      if (!oResponse.ok) {
        return oResponse.text().then(function(sError) {
          throw new Error("API hiba: " + sError);
        });
      }
      return oResponse.json();
    });
  }

  return {
    generate: generate,
    runDummy4: runDummy4,
    runDummy9: runDummy9,
    runDummy10: runDummy10,
    evaluateDummy11: evaluateDummy11,
    saveDummy11Prompt: saveDummy11Prompt,
    runDummy11Prompt: runDummy11Prompt,
    startDummy12Analysis: startDummy12Analysis,
    getDummy12Status: getDummy12Status,
    startDummy13AnalysisRun: startDummy13AnalysisRun,
    normalizeDummy13: normalizeDummy13,
    runDummy13Analysis: runDummy13Analysis,
    getDummy13Status: getDummy13Status,
    startDummy14AnalysisRun: startDummy14AnalysisRun,
    normalizeDummy14: normalizeDummy14,
    runDummy14Analysis: runDummy14Analysis,
    getDummy14Status: getDummy14Status,
    getDummy4SchemaHint: getDummy4SchemaHint,
    uploadDummy5Pdf: uploadDummy5Pdf,
    summarizeDummy5: summarizeDummy5,
    askDummy5: askDummy5,
    runDummy7Compare: runDummy7Compare,
    runSmartSegmentation: runSmartSegmentation,
    sendSmartSegmentationToCrm: sendSmartSegmentationToCrm,
    runDiscovery: runDiscovery,
    reportsListWebhooks: reportsListWebhooks,
    reportsCreateWebhook: reportsCreateWebhook,
    reportsUpdateWebhook: reportsUpdateWebhook,
    reportsDeleteWebhook: reportsDeleteWebhook,
    reportsListSchedules: reportsListSchedules,
    reportsListFeed: reportsListFeed,
    reportsCreateSchedule: reportsCreateSchedule,
    reportsUpdateSchedule: reportsUpdateSchedule,
    reportsDeleteSchedule: reportsDeleteSchedule,
    discoveryGetSchema: discoveryGetSchema,
    discoveryBusinessChat: discoveryBusinessChat,
    discoveryBusinessUploadCsv: discoveryBusinessUploadCsv,
    discoverySpecChatStart: discoverySpecChatStart,
    discoverySpecChatAnswer: discoverySpecChatAnswer,
    discoveryGenerateTrainingSpec: discoveryGenerateTrainingSpec,
    discoveryStartTraining: discoveryStartTraining,
    discoveryGetTrainingStatus: discoveryGetTrainingStatus,
    discoveryGetTrainingResult: discoveryGetTrainingResult,
    noahRoute: noahRoute,
    noahListCards: noahListCards,
    noahPrefillCard: noahPrefillCard,
    noahGetCardConfig: noahGetCardConfig,
    noahRunCard: noahRunCard,
    noahAgentPlan: noahAgentPlan,
    noahChat: noahChat,
    mlWizardInit: mlWizardInit,
    mlWizardGetDbTables: mlWizardGetDbTables,
    mlWizardStep1AiSuggestions: mlWizardStep1AiSuggestions,
    mlWizardStep1AiSuggestionsFromColumns: mlWizardStep1AiSuggestionsFromColumns,
    mlWizardStep1RefineGoal: mlWizardStep1RefineGoal,
    mlWizardStep1bAiJoin: mlWizardStep1bAiJoin,
    mlWizardStep1cAiAggregation: mlWizardStep1cAiAggregation,
    mlWizardStep4ExecutiveSummary: mlWizardStep4ExecutiveSummary,
    mlWizardStep2Profile: mlWizardStep2Profile,
    mlWizardGetJobStatus: mlWizardGetJobStatus,
    mlWizardStep2ProfileResult: mlWizardStep2ProfileResult,
    mlWizardStep2ConfirmFeatures: mlWizardStep2ConfirmFeatures,
    mlWizardStep3StartTraining: mlWizardStep3StartTraining,
    mlWizardStep4Result: mlWizardStep4Result,
    mlWizardStep5SuggestedInputs: mlWizardStep5SuggestedInputs,
    mlWizardStep5Simulate: mlWizardStep5Simulate,
    mlWizardStep5SimulationResult: mlWizardStep5SimulationResult
  };
});
