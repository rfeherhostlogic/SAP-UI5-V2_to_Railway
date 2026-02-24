sap.ui.define([
  "sap/ui/core/mvc/Controller"
], function(Controller) {
  "use strict";

  return Controller.extend("sap.suite.ui.commons.demo.tutorial.controller.Main", {
    onInit: function() {
      var oRouter = this.getOwnerComponent().getRouter();
      oRouter.getRoute("main").attachPatternMatched(this._onMainMatched, this);
      oRouter.getRoute("mainMenu").attachPatternMatched(this._onMainMenuMatched, this);
      oRouter.getRoute("jokerPrompt").attachPatternMatched(this._onJokerPromptMatched, this);
    },

    onItemSelect: function(oEvent) {
      var sKey = oEvent.getParameter("item").getKey();
      if (sKey === "chat" || sKey === "reports" || sKey === "jokers" || sKey === "discovery" || sKey === "noah") {
        this.getOwnerComponent().getRouter().navTo("mainMenu", { menuKey: sKey });
      }
    },

    onLogout: async function() {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "same-origin"
        });
      } catch (_err) {
        // A kliensoldali kileptetes akkor is fusson le, ha a szerver nem elerheto.
      }

      var oAppModel = this.getView().getModel("app");
      oAppModel.setProperty("/isAuthenticated", false);
      oAppModel.setProperty("/userName", "");
      oAppModel.setProperty("/loginPassword", "");
      this.getOwnerComponent().getRouter().navTo("login", {}, true);
    },

    onToggleSideNav: function() {
      var oAppModel = this.getView().getModel("app");
      var bExpanded = !!oAppModel.getProperty("/sideNavExpanded");
      oAppModel.setProperty("/sideNavExpanded", !bExpanded);
    },

    _onMainMatched: function() {
      var sKey = this.getView().getModel("app").getProperty("/selectedMenuKey") || "noah";
      this._navigateByKey(sKey);
    },

    _onMainMenuMatched: function(oEvent) {
      var sKey = oEvent.getParameter("arguments").menuKey || "noah";
      if (sKey !== "chat" && sKey !== "reports" && sKey !== "jokers" && sKey !== "discovery" && sKey !== "noah") {
        sKey = "noah";
      }
      this.getView().getModel("app").setProperty("/selectedMenuKey", sKey);
      this._navigateByKey(sKey);
    },

    _onJokerPromptMatched: function() {
      this.getView().getModel("app").setProperty("/selectedMenuKey", "jokers");
      this._navigateByKey("jokerPrompt");
    },

    _navigateByKey: function(sKey) {
      var oNav = this.byId("mainNav");
      if (!oNav) {
        return;
      }
      var oPageMap = {
        chat: this.byId("chatView"),
        reports: this.byId("reportsView"),
        jokers: this.byId("jokersView"),
        discovery: this.byId("discoveryView"),
        noah: this.byId("noahView"),
        jokerPrompt: this.byId("jokerPromptView")
      };
      var oPage = oPageMap[sKey] || oPageMap.noah;
      if (oPage) {
        oNav.to(oPage);
      }
    }
  });
});
