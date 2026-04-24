sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast"
], function(Controller, MessageToast) {
  "use strict";

  return Controller.extend("sap.suite.ui.commons.demo.tutorial.controller.Flow", {
    onInit: function() {
      var oModel = this.getOwnerComponent().getModel("flow");
      if (oModel) {
        this.getView().setModel(oModel, "flow");
      }
    },

    onAfterRendering: function() {
      this._updateAdvisorProcessFlow();
    },

    onConsultingPanelExpand: function(oEvent) {
      if (oEvent.getParameter("expand")) {
        this._updateAdvisorProcessFlow();
      }
    },

    onAdvisorNodePress: function(oEvent) {
      var vNodeId = oEvent.getParameter("nodeId");
      if (!vNodeId) {
        var oParams = oEvent.getParameters ? oEvent.getParameters() : null;
        if (oParams && typeof oParams.getNodeId === "function") {
          vNodeId = oParams.getNodeId();
        }
      }

      if (String(vNodeId || "") === "realize-3") {
        this.onOpenTestMigrationJoker();
        return;
      }

      MessageToast.show("Kattintott node: " + String(vNodeId || ""));
    },

    onOpenTestMigrationJoker: function() {
      this.getOwnerComponent().getRouter().navTo("jokerPrompt", {
        jokerId: "dummy-22"
      });
    },

    _updateAdvisorProcessFlow: function() {
      var oProcessFlow = this.byId("advisorProcessFlow");
      if (!oProcessFlow || typeof oProcessFlow.updateModel !== "function") {
        return;
      }
      setTimeout(function() {
        oProcessFlow.updateModel();
      }, 0);
    }
  });
});
