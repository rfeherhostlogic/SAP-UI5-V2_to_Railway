sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast"
], function(Controller, MessageToast) {
  "use strict";

  return Controller.extend("sap.suite.ui.commons.demo.tutorial.controller.Login", {
    onLogin: async function() {
      var oAppModel = this.getView().getModel("app");
      var sName = (oAppModel.getProperty("/loginName") || "").trim();
      var sPassword = oAppModel.getProperty("/loginPassword") || "";

      if (!sName || !sPassword) {
        MessageToast.show("Add meg a felhasznalonevet es a jelszot.");
        return;
      }

      try {
        var oResponse = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "same-origin",
          body: JSON.stringify({
            username: sName,
            password: sPassword
          })
        });
        var oData = await oResponse.json().catch(function() {
          return {};
        });

        if (!oResponse.ok) {
          MessageToast.show((oData && oData.error) || "Hibas belepesi adatok.");
          return;
        }

        oAppModel.setProperty("/isAuthenticated", true);
        oAppModel.setProperty("/userName", (oData.user && oData.user.displayName) || sName);
        oAppModel.setProperty("/loginName", (oData.user && oData.user.username) || sName);
        oAppModel.setProperty("/loginPassword", "");
        oAppModel.setProperty("/selectedMenuKey", "noah");
        this.getOwnerComponent().getRouter().navTo("main", {}, true);
      } catch (_err) {
        MessageToast.show("Belepesi hiba. Ellenorizd a szervert.");
      }
    }
  });
});
