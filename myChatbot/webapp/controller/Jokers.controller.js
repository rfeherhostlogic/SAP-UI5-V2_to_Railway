sap.ui.define([
  "sap/ui/core/mvc/Controller"
], function(Controller) {
  "use strict";

  return Controller.extend("sap.suite.ui.commons.demo.tutorial.controller.Jokers", {
    onInit: function() {
      this._applyTagFilter();
    },

    onAfterRendering: function() {
      this._applyTagFilter();
    },

    onTagFilterChange: function(oEvent) {
      var oSource = oEvent.getSource();
      var aSelectedKeys = typeof oSource.getSelectedKeys === "function" ? oSource.getSelectedKeys() : [];
      var aNormalized = aSelectedKeys.map(function(sKey) {
        return String(sKey || "").trim();
      }).filter(Boolean);
      if (aNormalized.length === 0 || aNormalized.indexOf("Összes") >= 0) {
        aNormalized = ["Összes"];
      } else {
        aNormalized = aNormalized.filter(function(sKey, idx, arr) {
          return sKey !== "Összes" && arr.indexOf(sKey) === idx;
        });
      }
      var oModel = this.getView().getModel("jokers") || this.getOwnerComponent().getModel("jokers");
      if (!oModel) {
        return;
      }
      oModel.setProperty("/activeTags", aNormalized);
      oModel.setProperty("/activeTag", aNormalized[0] || "Összes");
      this._applyTagFilter();
    },

    onTilePress: function(oEvent) {
      var oContext = oEvent.getSource().getBindingContext("jokers");
      if (!oContext) {
        return;
      }

      var oJoker = oContext.getObject();
      var oJokersModel = this.getView().getModel("jokers");
      oJokersModel.setProperty("/selectedJoker", oJoker);
      oJokersModel.setProperty("/promptInput", "");
      oJokersModel.setProperty("/resultText", "");
      if (oJoker.id === "dummy-4") {
        oJokersModel.setProperty("/dummy4GeneratedSql", "");
        oJokersModel.setProperty("/dummy4Summary", "");
        oJokersModel.setProperty("/dummy4Rows", []);
      } else if (oJoker.id === "dummy-9") {
        oJokersModel.setProperty("/dummy9Files", []);
        oJokersModel.setProperty("/dummy9Question", "");
        oJokersModel.setProperty("/dummy9ResultText", "");
        oJokersModel.setProperty("/dummy9Error", "");
        oJokersModel.setProperty("/dummy9Rows", []);
        oJokersModel.setProperty("/dummy9ChartReady", false);
        oJokersModel.setProperty("/dummy9SelectedSource", "");
        oJokersModel.setProperty("/dummy9MatchedFiles", []);
      } else if (oJoker.id === "dummy-10") {
        oJokersModel.setProperty("/dummy10Summary", "");
        oJokersModel.setProperty("/dummy10Rows", []);
        oJokersModel.setProperty("/dummy10SegmentItems", []);
      }

      this.getOwnerComponent().getRouter().navTo("jokerPrompt", {
        jokerId: oJoker.id
      });
    },

    _applyTagFilter: function() {
      var oModel = this.getView().getModel("jokers") || this.getOwnerComponent().getModel("jokers");
      if (!oModel) {
        return;
      }
      var aTiles = oModel.getProperty("/tiles") || [];
      var aActiveTags = oModel.getProperty("/activeTags");
      if (!Array.isArray(aActiveTags) || aActiveTags.length === 0) {
        var sFallbackTag = String(oModel.getProperty("/activeTag") || "Összes");
        aActiveTags = [sFallbackTag];
        oModel.setProperty("/activeTags", aActiveTags);
      }
      var bAll = aActiveTags.indexOf("Összes") >= 0;
      var aFiltered = aTiles.filter(function(oTile) {
        if (bAll) {
          return true;
        }
        var aTags = Array.isArray(oTile && oTile.tags) ? oTile.tags : [];
        return aActiveTags.some(function(sTag) {
          return aTags.indexOf(sTag) >= 0;
        });
      });
      oModel.setProperty("/filteredTiles", aFiltered);
    }
  });
});

