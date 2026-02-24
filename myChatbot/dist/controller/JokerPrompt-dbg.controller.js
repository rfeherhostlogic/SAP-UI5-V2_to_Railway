sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/suite/ui/commons/demo/tutorial/service/AiService"
], function(Controller, MessageToast, AiService) {
  "use strict";

  return Controller.extend("sap.suite.ui.commons.demo.tutorial.controller.JokerPrompt", {
    onInit: function() {
      this.getOwnerComponent().getRouter().getRoute("jokerPrompt").attachPatternMatched(this._onRouteMatched, this);
    },

    onGenerate: async function() {
      await this._runGenerate(true);
    },

    onSend: async function() {
      await this._runGenerate(false);
    },

    onRunDummy4: async function() {
      var oModel = this.getView().getModel("jokers");
      var sQuestion = (oModel.getProperty("/dummy4Question") || "").trim();
      var sSchemaHint = (oModel.getProperty("/dummy4SchemaHint") || "").trim();

      if (!sQuestion) {
        MessageToast.show("A kerdes mezot toltsd ki.");
        return;
      }

      if (!sSchemaHint) {
        MessageToast.show("A schema hint mezot toltsd ki.");
        return;
      }

      oModel.setProperty("/generating", true);
      oModel.setProperty("/dummy4GeneratedSql", "");
      oModel.setProperty("/dummy4Summary", "");
      oModel.setProperty("/dummy4Rows", []);

      try {
        var oResult = await AiService.runDummy4({
          question: sQuestion,
          schemaHint: sSchemaHint
        });

        oModel.setProperty("/dummy4GeneratedSql", oResult.generatedSql || "");
        oModel.setProperty("/dummy4Summary", oResult.summary || "");
        oModel.setProperty("/dummy4Rows", oResult.rows || []);
      } catch (oError) {
        MessageToast.show(oError && oError.message ? oError.message : "Dummy4 hiba tortent.");
      } finally {
        oModel.setProperty("/generating", false);
      }
    },

    onCancel: function() {
      var oModel = this.getView().getModel("jokers");
      oModel.setProperty("/promptInput", "");
      oModel.setProperty("/resultText", "");
      oModel.setProperty("/dummy4Question", "");
      oModel.setProperty("/dummy4GeneratedSql", "");
      oModel.setProperty("/dummy4Summary", "");
      oModel.setProperty("/dummy4Rows", []);
      this.getOwnerComponent().getRouter().navTo("mainMenu", { menuKey: "jokers" });
    },

    _onRouteMatched: function(oEvent) {
      var sJokerId = oEvent.getParameter("arguments").jokerId;
      var oModel = this.getView().getModel("jokers");
      var aTiles = oModel.getProperty("/tiles") || [];
      var oSelected = aTiles.find(function(oTile) {
        return oTile.id === sJokerId;
      });

      if (oSelected) {
        oModel.setProperty("/selectedJoker", oSelected);
        oModel.setProperty("/resultText", "");
        if (oSelected.id === "dummy-4") {
          oModel.setProperty("/dummy4GeneratedSql", "");
          oModel.setProperty("/dummy4Summary", "");
          oModel.setProperty("/dummy4Rows", []);
        }
      }
    },

    _runGenerate: async function(bUseSystemPrompt) {
      var oModel = this.getView().getModel("jokers");
      var oJoker = oModel.getProperty("/selectedJoker");
      var sInput = (oModel.getProperty("/promptInput") || "").trim();

      if (!oJoker) {
        MessageToast.show("Nincs kivalasztott joker.");
        return;
      }

      if (!sInput) {
        MessageToast.show("Adj meg szoveget a folytatashoz.");
        return;
      }

      oModel.setProperty("/generating", true);
      try {
        var sResult = await AiService.generate({
          title: oJoker.title,
          systemPrompt: bUseSystemPrompt ? oJoker.systemPrompt : "",
          inputText: sInput
        });
        oModel.setProperty("/resultText", sResult);
      } catch (oError) {
        MessageToast.show(oError && oError.message ? oError.message : "Hiba tortent a Generate hivaskor.");
      } finally {
        oModel.setProperty("/generating", false);
      }
    }
  });
});

