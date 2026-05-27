sap.ui.define([
  "sap/ui/core/mvc/Controller"
], function(Controller) {
  "use strict";

  function normalizeTagKey(sTag) {
    var sValue = String(sTag || "").trim().toLowerCase();
    var mMap = {
      "osszes": "Osszes",
      "összes": "Osszes",
      "altalanos": "Altalanos",
      "általános": "Altalanos",
      "marketing": "Marketing",
      "idozitheto": "Idozitheto",
      "időzíthető": "Idozitheto",
      "gdc": "GDC",
      "tanacsado": "Tanacsado"
    };
    return mMap[sValue] || String(sTag || "").trim();
  }

  return Controller.extend("sap.suite.ui.commons.demo.tutorial.controller.Jokers", {
    onInit: function() {
      this._applyTagFilter();
    },

    onAfterRendering: function() {
      this._applyTagFilter();
    },

    onTagFilterChange: function(oEvent) {
      var oModel = this.getView().getModel("jokers") || this.getOwnerComponent().getModel("jokers");
      if (!oModel) {
        return;
      }

      var oSource = oEvent.getSource();
      var aSelectedKeys = typeof oSource.getSelectedKeys === "function" ? oSource.getSelectedKeys() : [];
      var sEventId = oEvent && typeof oEvent.getId === "function" ? oEvent.getId() : "";
      var oChangedItem = oEvent && typeof oEvent.getParameter === "function" ? oEvent.getParameter("changedItem") : null;
      var bSelected = oEvent && typeof oEvent.getParameter === "function" ? !!oEvent.getParameter("selected") : false;

      if (sEventId === "selectionChange" && oChangedItem && typeof oChangedItem.getKey === "function") {
        var sChangedKey = normalizeTagKey(oChangedItem.getKey());
        var aCurrentKeys = (oModel.getProperty("/activeTags") || []).map(normalizeTagKey);
        if (bSelected) {
          if (aCurrentKeys.indexOf(sChangedKey) < 0) {
            aCurrentKeys.push(sChangedKey);
          }
        } else {
          aCurrentKeys = aCurrentKeys.filter(function(sKey) {
            return sKey !== sChangedKey;
          });
        }
        aSelectedKeys = aCurrentKeys;
      }

      var aNormalized = aSelectedKeys.map(normalizeTagKey).filter(Boolean);
      if (aNormalized.length === 0 || aNormalized.indexOf("Osszes") >= 0) {
        aNormalized = ["Osszes"];
      } else {
        aNormalized = aNormalized.filter(function(sKey, idx, arr) {
          return sKey !== "Osszes" && arr.indexOf(sKey) === idx;
        });
      }

      oModel.setProperty("/activeTags", aNormalized);
      oModel.setProperty("/activeTag", aNormalized[0] || "Osszes");
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
        oJokersModel.setProperty("/dummy4DiscoveryBusy", false);
        oJokersModel.setProperty("/dummy4DiscoverySuggestions", []);
      } else if (oJoker.id === "dummy-9") {
        oJokersModel.setProperty("/dummy9Files", []);
        oJokersModel.setProperty("/dummy9Question", "");
        oJokersModel.setProperty("/dummy9ResultText", "");
        oJokersModel.setProperty("/dummy9Error", "");
        oJokersModel.setProperty("/dummy9Rows", []);
        oJokersModel.setProperty("/dummy9ChartReady", false);
        oJokersModel.setProperty("/dummy9SelectedSource", "");
        oJokersModel.setProperty("/dummy9MatchedFiles", []);
      } else if (oJoker.id === "dummy-21") {
        oJokersModel.setProperty("/rpt1File", null);
        oJokersModel.setProperty("/rpt1FileName", "");
        oJokersModel.setProperty("/rpt1Summary", "");
        oJokersModel.setProperty("/rpt1Error", "");
        oJokersModel.setProperty("/rpt1PredictionRows", []);
        oJokersModel.setProperty("/rpt1HasRun", false);
        oJokersModel.setProperty("/rpt1ChartReady", false);
        oJokersModel.setProperty("/rpt1ChartRows", (oJokersModel.getProperty("/rpt1DefaultChartRows") || []).map(function(row) {
          return Object.assign({}, row);
        }));
      } else if (oJoker.id === "dummy-10") {
        oJokersModel.setProperty("/dummy10Summary", "");
        oJokersModel.setProperty("/dummy10Rows", []);
        oJokersModel.setProperty("/dummy10SegmentItems", []);
      } else if (oJoker.id === "quote-builder") {
        oJokersModel.setProperty("/quoteSessionId", "");
        oJokersModel.setProperty("/quoteTemplateFileName", "");
        oJokersModel.setProperty("/quoteTemplatePreview", "");
        oJokersModel.setProperty("/quoteContextText", "");
        oJokersModel.setProperty("/quoteSummary", "");
        oJokersModel.setProperty("/quotePreviewUrl", "");
        oJokersModel.setProperty("/quotePdfDownloadUrl", "");
        oJokersModel.setProperty("/quoteDocxDownloadUrl", "");
        oJokersModel.setProperty("/quoteRevisionMessage", "");
        oJokersModel.setProperty("/quoteChatMessages", []);
        oJokersModel.setProperty("/quoteBusy", false);
        oJokersModel.setProperty("/quoteError", "");
        oJokersModel.setProperty("/quoteConversionMode", "");
      } else if (oJoker.id === "kpi-discovery") {
        oJokersModel.setProperty("/kpiDiscoveryError", "");
        oJokersModel.setProperty("/kpiDiscoverySchemaSummary", "");
        oJokersModel.setProperty("/kpiDiscoverySuggestions", []);
        oJokersModel.setProperty("/kpiDiscoverySelectedId", "");
        oJokersModel.setProperty("/kpiDiscoverySummary", "");
        oJokersModel.setProperty("/kpiDiscoveryComparison", null);
        oJokersModel.setProperty("/kpiDiscoveryMetrics", []);
        oJokersModel.setProperty("/kpiDiscoveryChartRows", []);
        oJokersModel.setProperty("/kpiDiscoveryRows", []);
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
        aActiveTags = [normalizeTagKey(oModel.getProperty("/activeTag") || "Osszes")];
        oModel.setProperty("/activeTags", aActiveTags);
      }

      aActiveTags = aActiveTags.map(normalizeTagKey);
      var bAll = aActiveTags.indexOf("Osszes") >= 0;
      var aFiltered = aTiles.filter(function(oTile) {
        if (oTile && oTile.id === "dummy-13") {
          return false;
        }
        if (bAll) {
          return true;
        }
        var aTags = Array.isArray(oTile && oTile.tags) ? oTile.tags.map(normalizeTagKey) : [];
        return aActiveTags.some(function(sTag) {
          return aTags.indexOf(sTag) >= 0;
        });
      });
      oModel.setProperty("/filteredTiles", aFiltered);
    }
  });
});
