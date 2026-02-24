sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast"
], function(Controller, MessageToast) {
  "use strict";

  return Controller.extend("sap.suite.ui.commons.demo.tutorial.controller.Login", {
    onLogin: function() {
      var oAppModel = this.getView().getModel("app");
      var sName = (oAppModel.getProperty("/loginName") || "").trim();
      var sPassword = (oAppModel.getProperty("/loginPassword") || "").trim();

      if (sName === "Roli" && sPassword === "demo") {
        oAppModel.setProperty("/isAuthenticated", true);
        oAppModel.setProperty("/userName", sName);
        oAppModel.setProperty("/selectedMenuKey", "noah");
        this.getOwnerComponent().getRouter().navTo("main");
      } else {
        MessageToast.show("Hibas belepesi adatok.");
      }
    }
  });
});
