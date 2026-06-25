sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/suite/ui/commons/demo/tutorial/service/AiService"
], function(Controller, AiService) {
  "use strict";

  var FEED_POLL_MS = 30 * 1000;

  return Controller.extend("sap.suite.ui.commons.demo.tutorial.controller.Feed", {
    onInit: function() {
      this._pollTimer = null;

      var oAppModel = this.getOwnerComponent().getModel("app");
      if (oAppModel && !oAppModel.getProperty("/isAuthenticated")) {
        // A bejelentkezes meg nincs lezarva (pl. a sessionre varunk) -
        // a hirfolyam hivasat addig nem inditjuk el, amig nincs ervenyes
        // bejelentkezett allapot, igy nem kuldunk hitelesites nelkuli kerest.
        return;
      }

      this._loadFeed();
      this._pollTimer = setInterval(this._loadFeed.bind(this), FEED_POLL_MS);
    },

    onAfterRendering: function() {
      this._scrollToBottom();
    },

    onExit: function() {
      if (this._pollTimer) {
        clearInterval(this._pollTimer);
        this._pollTimer = null;
      }
    },

    _loadFeed: async function() {
      var oModel = this.getView().getModel("feed") || this.getOwnerComponent().getModel("feed");
      if (!oModel || oModel.getProperty("/busy")) {
        return;
      }

      oModel.setProperty("/busy", true);
      oModel.setProperty("/error", "");

      try {
        var oResp = await AiService.reportsListFeed(10);
        var aItems = Array.isArray(oResp && oResp.items) ? oResp.items : [];
        oModel.setProperty("/messages", this._normalizeItems(aItems));
        oModel.setProperty("/lastUpdatedText", "Frissitve: " + new Date().toLocaleTimeString("hu-HU", {
          hour: "2-digit",
          minute: "2-digit"
        }));
        this._scrollToBottom();
      } catch (oError) {
        if (oError && oError.status === 401) {
          // A session lejart vagy ervenytelen - nem nyeljuk el csendben,
          // hanem visszairanyitjuk a felhasznalot a bejelentkezeshez.
          this._handleSessionExpired();
          return;
        }
        oModel.setProperty("/messages", this._normalizeItems([]));
        oModel.setProperty("/error", oError && oError.message ? oError.message : "A hirfolyam nem toltheto be.");
      } finally {
        oModel.setProperty("/busy", false);
      }
    },

    _handleSessionExpired: function() {
      if (this._pollTimer) {
        clearInterval(this._pollTimer);
        this._pollTimer = null;
      }

      var oAppModel = this.getOwnerComponent().getModel("app");
      if (oAppModel) {
        oAppModel.setProperty("/isAuthenticated", false);
        oAppModel.setProperty("/userName", "");
        oAppModel.setProperty("/loginPassword", "");
      }

      this.getOwnerComponent().getRouter().navTo("login", {}, true);
    },

    _normalizeItems: function(aItems) {
      if (!Array.isArray(aItems) || aItems.length === 0) {
        return [{
          id: "feed-empty",
          role: "assistant",
          title: "Nincs hirfolyam-bejegyzes",
          content: "Amint a Pajzs / Idozitesek alatt egy utemezett futas lefut, itt AI-uzenetkent is megjelenik.",
          subtitle: "",
          timestampLabel: ""
        }];
      }

      return aItems.map(function(item) {
        return {
          id: item.id,
          role: "assistant",
          title: String(item.title || ""),
          content: String(item.content || ""),
          subtitle: String(item.subtitle || ""),
          timestampLabel: String(item.timestampLabel || "")
        };
      });
    },

    _scrollToBottom: function() {
      var oPanel = this.byId("feedChatPanel");
      if (!oPanel || !oPanel.getDomRef()) {
        return;
      }

      setTimeout(function() {
        var oDomRef = oPanel.getDomRef();
        if (oDomRef) {
          oDomRef.scrollTop = oDomRef.scrollHeight + 9999;
        }
      }, 0);
    }
  });
});
