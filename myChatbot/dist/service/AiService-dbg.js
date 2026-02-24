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

  return {
    generate: generate,
    runDummy4: runDummy4
  };
});

