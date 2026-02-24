sap.ui.define([
  "sap/ui/core/mvc/Controller"
], function(Controller) {
  "use strict";

  return Controller.extend("sap.suite.ui.commons.demo.tutorial.controller.Reports", {
    onInit: function() {
      var oModel = this.getView().getModel("reports") || this.getOwnerComponent().getModel("reports");
      if (!this.getView().getModel("reports") && oModel) {
        this.getView().setModel(oModel, "reports");
      }
      if (oModel) {
        oModel.attachRequestCompleted(this._initSelection, this);
        this._initSelection();
      }
    },

    _initSelection: function() {
      var oModel = this.getView().getModel("reports");
      var aQueries = oModel.getProperty("/queries") || [];
      if (aQueries.length > 0) {
        oModel.setProperty("/selectedQueryId", aQueries[0].id);
        oModel.setProperty("/selectedQuery", aQueries[0]);
      }
    },

    onQueryChange: function(oEvent) {
      var sKey = oEvent.getSource().getSelectedKey();
      var oModel = this.getView().getModel("reports");
      var aQueries = oModel.getProperty("/queries") || [];
      var oSelected = aQueries.filter(function(oQuery) {
        return oQuery.id === sKey;
      })[0];
      if (oSelected) {
        oModel.setProperty("/selectedQueryId", sKey);
        oModel.setProperty("/selectedQuery", oSelected);
      }
    }
  });
});
