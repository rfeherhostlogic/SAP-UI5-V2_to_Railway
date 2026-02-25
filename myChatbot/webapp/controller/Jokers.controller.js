sap.ui.define([
  "sap/ui/core/mvc/Controller"
], function(Controller) {
  "use strict";

  return Controller.extend("sap.suite.ui.commons.demo.tutorial.controller.Jokers", {
    onInit: function() {
      this._applyTagFilter();
    },

    onTagFilterChange: function(oEvent) {
      var sKey = String(oEvent.getSource().getSelectedKey() || "Összes");
      this.getView().getModel("jokers").setProperty("/activeTag", sKey);
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
      }

      this.getOwnerComponent().getRouter().navTo("jokerPrompt", {
        jokerId: oJoker.id
      });
    },

    _applyTagFilter: function() {
      var oModel = this.getView().getModel("jokers");
      var aTiles = oModel.getProperty("/tiles") || [];
      var sActiveTag = String(oModel.getProperty("/activeTag") || "Összes");
      var aFiltered = aTiles.filter(function(oTile) {
        if (sActiveTag === "Összes") {
          return true;
        }
        var aTags = Array.isArray(oTile && oTile.tags) ? oTile.tags : [];
        return aTags.indexOf(sActiveTag) >= 0;
      });
      oModel.setProperty("/filteredTiles", aFiltered);
    }
  });
});

