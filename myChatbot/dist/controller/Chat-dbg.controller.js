sap.ui.define([
  "sap/ui/core/mvc/Controller"
], function(Controller) {
  "use strict";

  return Controller.extend("sap.suite.ui.commons.demo.tutorial.controller.Chat", {
    onSend: async function() {
      var oAppModel = this.getView().getModel("app");
      var oChatModel = this.getView().getModel("chat");
      var sText = (oAppModel.getProperty("/draftMessage") || "").trim();

      if (!sText) {
        return;
      }

      this._appendMessage("user", sText);
      oAppModel.setProperty("/draftMessage", "");
      oAppModel.setProperty("/busy", true);

      try {
        var aMessages = (oChatModel.getProperty("/messages") || []).map(function(oMsg) {
          return {
            role: oMsg.role,
            content: oMsg.content
          };
        });

        var oPayload = {
          message: sText,
          history: aMessages
        };

        var oResponse = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(oPayload)
        });

        if (!oResponse.ok) {
          var sErrText = await oResponse.text();
          this._appendMessage("assistant", "Hiba a valaszban: " + sErrText);
          return;
        }

        var oData = await oResponse.json();
        var sReply = this._extractReplyText(oData);
        this._appendMessage("assistant", sReply);
      } catch (e) {
        this._appendMessage("assistant", "Hiba tortent a hivas kozben. Ellenorizd az API endpointot.");
      } finally {
        oAppModel.setProperty("/busy", false);
      }
    },

    _extractReplyText: function(oData) {
      if (!oData) {
        return "Ures valasz.";
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
      if (oData.choices && oData.choices[0] && oData.choices[0].message && oData.choices[0].message.content) {
        return oData.choices[0].message.content;
      }
      return JSON.stringify(oData, null, 2);
    },

    _appendMessage: function(sRole, sContent) {
      var oChatModel = this.getView().getModel("chat");
      var aMessages = oChatModel.getProperty("/messages") || [];
      aMessages.push({
        role: sRole,
        content: sContent
      });
      oChatModel.setProperty("/messages", aMessages);
    }
  });
});
