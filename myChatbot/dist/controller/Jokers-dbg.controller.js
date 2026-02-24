sap.ui.define([
  "sap/ui/core/mvc/Controller"
], function(Controller) {
  "use strict";

  return Controller.extend("sap.suite.ui.commons.demo.tutorial.controller.Jokers", {
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
    }
  });
});

