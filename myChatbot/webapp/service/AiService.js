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
    getDummy4SchemaHint: getDummy4SchemaHint,
    uploadDummy5Pdf: uploadDummy5Pdf,
    summarizeDummy5: summarizeDummy5,
    askDummy5: askDummy5,
    runDummy7Compare: runDummy7Compare,
    runDiscovery: runDiscovery,
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
    noahChat: noahChat
  };
});

