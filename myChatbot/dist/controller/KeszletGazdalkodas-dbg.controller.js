sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast"
], function(Controller, MessageToast) {
  "use strict";

  return Controller.extend("sap.suite.ui.commons.demo.tutorial.controller.KeszletGazdalkodas", {

    onInit: function() {
      var oModel = this.getOwnerComponent().getModel("inv");
      oModel.setData({
        dataSource:        "db",
        horizonDays:       "30",
        csvFileName:       "",
        csvFileSize:       "",
        categories:        [],
        state:             "setup",
        errorMessage:      "",
        forecastTimestamp: "",
        resultsTab:        "critical",
        results:           {},
        noahZoneState:     "idle",
        noahMessages:      [],
        noahInput:         "",
        noahTurnCount:     0
      });
      this._csvFileBuffer        = null;
      this._lastForecastResult   = null;
      this._lastHorizon          = 30;
      this._chartA               = null;
      this._chartB               = null;
      this._loadCategories();
    },

    onAfterRendering: function() {
      this._attachDropZoneEvents();
      var oModel = this.getOwnerComponent().getModel("inv");
      if (oModel.getProperty("/state") === "results" && oModel.getProperty("/resultsTab") === "charts") {
        var that = this;
        setTimeout(function() { that._renderCharts(); }, 100);
      }
    },

    // ─── Adatforrás váltás ────────────────────────────────────────────────────

    onDataSourceChange: function() {
      var oModel = this.getOwnerComponent().getModel("inv");
      oModel.setProperty("/csvFileName",  "");
      oModel.setProperty("/csvFileSize",  "");
      oModel.setProperty("/errorMessage", "");
      this._csvFileBuffer = null;
    },

    // ─── CSV zóna ─────────────────────────────────────────────────────────────

    onCsvZonePress: function() {
      var oUploader = this.byId("invCsvUploader");
      if (!oUploader) { return; }
      var oDomRef = oUploader.getDomRef();
      if (oDomRef) {
        var oInput = oDomRef.querySelector("input[type='file']");
        if (oInput) { oInput.click(); }
      }
    },

    onCsvFileChange: function(oEvent) {
      var oFile = oEvent.getParameter("files") && oEvent.getParameter("files")[0];
      if (!oFile) { return; }
      this._applyFile(oFile);
    },

    onCsvRemove: function() {
      this._csvFileBuffer = null;
      var oModel = this.getOwnerComponent().getModel("inv");
      oModel.setProperty("/csvFileName",  "");
      oModel.setProperty("/csvFileSize",  "");
      oModel.setProperty("/errorMessage", "");
      var oUploader = this.byId("invCsvUploader");
      if (oUploader) { oUploader.clear(); }
    },

    onDownloadTemplate: function() {
      window.location.href = "/api/inventory/csv-template";
    },

    // ─── Horizont / kategória ─────────────────────────────────────────────────

    onHorizonChange: function(oEvent) {
      var sKey = oEvent.getParameter("item") && oEvent.getParameter("item").getKey();
      if (sKey) {
        this.getOwnerComponent().getModel("inv").setProperty("/horizonDays", sKey);
      }
    },

    onCategoryChange: function() {},

    // ─── Előrejelzés indítása ─────────────────────────────────────────────────

    onRunForecast: function() {
      var oModel      = this.getOwnerComponent().getModel("inv");
      var sDataSource = oModel.getProperty("/dataSource");
      var sHorizon    = oModel.getProperty("/horizonDays");
      var sCsvFile    = oModel.getProperty("/csvFileName");

      if (sDataSource === "csv" && !sCsvFile) {
        oModel.setProperty("/errorMessage", "CSV módban kötelező fájlt feltölteni az előrejelzés indítása előtt.");
        return;
      }

      oModel.setProperty("/errorMessage", "");
      oModel.setProperty("/state", "loading");

      var oCombo       = this.byId("invCategoryFilter");
      var aSelItems    = oCombo ? oCombo.getSelectedItems() : [];
      var aCategoryIds = aSelItems.map(function(oItem) { return Number(oItem.getKey()); });
      var iHorizon     = Number(sHorizon);

      if (sDataSource === "db") {
        this._runDbForecast(iHorizon, aCategoryIds);
      } else {
        this._runCsvForecast(iHorizon, aCategoryIds);
      }
    },

    onBackToSetup: function() {
      var oModel = this.getOwnerComponent().getModel("inv");
      oModel.setProperty("/state",        "setup");
      oModel.setProperty("/errorMessage", "");
      this._resetNoahZone(oModel);
      if (this._chartA) { try { this._chartA.destroy(); } catch(e) {} this._chartA = null; }
      if (this._chartB) { try { this._chartB.destroy(); } catch(e) {} this._chartB = null; }
    },

    // ─── Eredmény fülek ───────────────────────────────────────────────────────

    onResultsTabSelect: function(oEvent) {
      var oItem = oEvent.getParameter("item");
      if (!oItem) { return; }
      var that = this;
      if (oItem.getKey() === "charts") {
        setTimeout(function() { that._renderCharts(); }, 50);
      }
    },

    // ─── CSV exportálás ───────────────────────────────────────────────────────

    onExportCsv: function() {
      var oData = this._lastForecastResult;
      if (!oData) {
        MessageToast.show("Nincs exportálható adat.");
        return;
      }
      var oModel = this.getOwnerComponent().getModel("inv");
      var that   = this;

      fetch("/api/inventory/export-csv", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ forecast: oData, horizon_days: this._lastHorizon })
      })
        .then(function(res) {
          if (!res.ok) { return res.json().then(function(d) { return Promise.reject(d.error || "Exportálási hiba."); }); }
          var sDisp = res.headers.get("Content-Disposition") || "";
          return res.blob().then(function(blob) { return { blob: blob, disposition: sDisp }; });
        })
        .then(function(result) {
          var sMatch = result.disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
          var sFilename = sMatch ? sMatch[1].replace(/['"]/g, "") : "keszlet_elorejelzes.csv";
          var sUrl = URL.createObjectURL(result.blob);
          var oA  = document.createElement("a");
          oA.href = sUrl;
          oA.download = sFilename;
          document.body.appendChild(oA);
          oA.click();
          document.body.removeChild(oA);
          URL.revokeObjectURL(sUrl);
        })
        .catch(function(sErr) {
          oModel.setProperty("/errorMessage", typeof sErr === "string" ? sErr : "A CSV exportálás során hiba lépett fel.");
        });
    },

    onSendToFeed: function() {
      MessageToast.show("Hírfolyam integráció hamarosan elérhető.");
    },

    // ─── Kategóriák betöltése ─────────────────────────────────────────────────

    _loadCategories: function() {
      var oModel = this.getOwnerComponent().getModel("inv");
      fetch("/api/inventory/categories")
        .then(function(res) { return res.json(); })
        .then(function(data) {
          if (data && Array.isArray(data.categories)) {
            oModel.setProperty("/categories", data.categories);
          }
        })
        .catch(function() {});
    },

    // ─── DB előrejelzés ───────────────────────────────────────────────────────

    _runDbForecast: function(iHorizon, aCategoryIds) {
      var oModel = this.getOwnerComponent().getModel("inv");
      var that   = this;
      var oBody  = { horizon_days: iHorizon, data_source: "db" };
      if (aCategoryIds && aCategoryIds.length > 0) { oBody.category_ids = aCategoryIds; }

      fetch("/api/inventory/forecast", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(oBody)
      })
        .then(function(res) { return res.json().then(function(d) { return { ok: res.ok, data: d }; }); })
        .then(function(result) {
          if (!result.ok) {
            oModel.setProperty("/errorMessage", result.data.error || "Az előrejelzés futtatása sikertelen.");
            oModel.setProperty("/state", "setup");
            return;
          }
          var oData = result.data;
          var bEmpty = (!oData.critical || oData.critical.length === 0) &&
                       (!oData.warning  || oData.warning.length  === 0) &&
                       (!oData.stable   || oData.stable.length   === 0) &&
                       (!oData.excess   || oData.excess.length   === 0);
          if (bEmpty) {
            oModel.setProperty("/state", "empty");
          } else {
            that._displayResults(oData, iHorizon);
          }
        })
        .catch(function() {
          oModel.setProperty("/errorMessage", "Hálózati hiba. Az előrejelzés nem futtatható.");
          oModel.setProperty("/state", "setup");
        });
    },

    // ─── CSV előrejelzés ──────────────────────────────────────────────────────

    _runCsvForecast: function(iHorizon, aCategoryIds) {
      var oModel = this.getOwnerComponent().getModel("inv");
      var that   = this;
      var oFile  = this._csvFileBuffer;
      if (!oFile) {
        oModel.setProperty("/errorMessage", "Nem található a kiválasztott fájl. Kérjük, válassza ki újra.");
        oModel.setProperty("/state", "setup");
        return;
      }

      var oForm = new FormData();
      oForm.append("file",         oFile);
      oForm.append("horizon_days", String(iHorizon));
      if (aCategoryIds && aCategoryIds.length > 0) {
        oForm.append("category_ids", JSON.stringify(aCategoryIds));
      }

      fetch("/api/inventory/upload-csv", { method: "POST", body: oForm })
        .then(function(res) { return res.json().then(function(d) { return { ok: res.ok, data: d }; }); })
        .then(function(result) {
          if (!result.ok) {
            oModel.setProperty("/errorMessage", result.data.error || "A CSV feldolgozása sikertelen.");
            oModel.setProperty("/state", "setup");
            return;
          }
          var oData = result.data;
          var bEmpty = (!oData.critical || oData.critical.length === 0) &&
                       (!oData.warning  || oData.warning.length  === 0) &&
                       (!oData.stable   || oData.stable.length   === 0) &&
                       (!oData.excess   || oData.excess.length   === 0);
          if (bEmpty) {
            oModel.setProperty("/state", "empty");
          } else {
            that._displayResults(oData, iHorizon);
          }
        })
        .catch(function() {
          oModel.setProperty("/errorMessage", "Hálózati hiba. A CSV feltöltése nem sikerült.");
          oModel.setProperty("/state", "setup");
        });
    },

    // ─── Eredmény megjelenítés ────────────────────────────────────────────────

    _displayResults: function(oData, iHorizon) {
      var oModel = this.getOwnerComponent().getModel("inv");
      var that   = this;

      this._lastForecastResult = oData;
      this._lastHorizon        = iHorizon;

      // Timestamp
      var oGenDate  = new Date(oData.generated_at);
      var sTimestamp = "Előrejelzés készült: " + this._fmtDateLong(oGenDate) + "  |  Horizont: " + iHorizon + " nap";

      // KPI summary with formatted value
      var oSummary = Object.assign({}, oData.summary, {
        total_reorder_value_formatted: this._fmtHuf(oData.summary.total_reorder_value_huf)
      });

      // Combined critical + warning list for Tab 1
      var aCombined = [];
      (oData.critical || []).forEach(function(p) {
        aCombined.push(that._enrichProduct(p, "CRITICAL"));
      });
      (oData.warning || []).forEach(function(p) {
        aCombined.push(that._enrichProduct(p, "WARNING"));
      });

      // Excess list
      var aExcess = (oData.excess || []).map(function(p) {
        return Object.assign({}, p, {
          excess_value_formatted: that._fmtHuf(p.excess_value_huf || 0)
        });
      });

      // Order suggestions for Tab 2
      var todayMs = Date.now();
      var aOrders = [];
      aCombined.forEach(function(p) {
        if (!p.reorder_suggestion) { return; }
        var sDeadline  = p.reorder_suggestion.latest_order_deadline || "";
        var deadlineMs = sDeadline ? new Date(sDeadline).getTime() : Infinity;
        var daysLeft   = Math.round((deadlineMs - todayMs) / 86400000);
        aOrders.push(Object.assign({}, p, {
          statusLabel:     p.classification === "CRITICAL" ? "SÜRGŐS" : "TERVEZETT",
          statusBadgeClass: p.classification === "CRITICAL" ? "invStatusBadgeCritical" : "invStatusBadgeWarning",
          deadlineClass:   daysLeft <= 3 ? "invDeadlineUrgent" : ""
        }));
      });

      // Order summary footer text
      var totalOrderVal = aOrders.reduce(function(s, p) {
        return s + Number(p.reorder_suggestion && p.reorder_suggestion.estimated_value_huf ? p.reorder_suggestion.estimated_value_huf : 0);
      }, 0);
      var sOrderSummary = "Összesen: " + aOrders.length + " tétel  |  Teljes becsült érték: " + this._fmtHuf(totalOrderVal);

      this._resetNoahZone(oModel);
      oModel.setProperty("/forecastTimestamp",   sTimestamp);
      oModel.setProperty("/resultsTab",          "critical");
      oModel.setProperty("/results", {
        summary:               oSummary,
        criticalAndWarning:    aCombined,
        criticalWarningCount:  String(aCombined.length),
        excess:                aExcess,
        hasExcess:             aExcess.length > 0,
        orderSuggestions:      aOrders,
        orderSummaryText:      sOrderSummary,
        chartData:             oData.forecast_chart_data || {}
      });
      oModel.setProperty("/state", "results");
    },

    _enrichProduct: function(p, sClassification) {
      var that      = this;
      var oEnriched = Object.assign({}, p, {
        productCardClass:      "invProductCard invProductCard" + (sClassification === "CRITICAL" ? "Critical" : "Warning"),
        leftBarClass:          sClassification === "CRITICAL" ? "invLeftBarCritical" : "invLeftBarWarning",
        urgentBadge:           sClassification === "CRITICAL",
        classification:        sClassification,
        avg_daily_demand_fmt:  Math.round(Number(p.avg_daily_demand || 0) * 100) / 100,
        stockout_date_fmt:     p.stockout_date ? that._fmtDateShort(p.stockout_date) : "—"
      });

      if (oEnriched.reorder_suggestion) {
        oEnriched.reorder_suggestion = Object.assign({}, oEnriched.reorder_suggestion, {
          latest_order_deadline_fmt:  oEnriched.reorder_suggestion.latest_order_deadline
            ? that._fmtDateShort(oEnriched.reorder_suggestion.latest_order_deadline)
            : "—",
          estimated_value_formatted:  that._fmtHuf(oEnriched.reorder_suggestion.estimated_value_huf || 0),
          supplier_reliability:       Number(oEnriched.reorder_suggestion.supplier_reliability || 0)
        });
      }
      return oEnriched;
    },

    // ─── Chart.js ─────────────────────────────────────────────────────────────

    _ensureChartJs: function(fnCallback) {
      if (window.Chart) { fnCallback(); return; }
      var oScript   = document.createElement("script");
      oScript.src   = "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js";
      oScript.onload  = fnCallback;
      oScript.onerror = function() { console.warn("[inv] Chart.js betöltése sikertelen."); };
      document.head.appendChild(oScript);
    },

    _renderCharts: function() {
      var oModel    = this.getOwnerComponent().getModel("inv");
      var oChartData = oModel.getProperty("/results/chartData") || {};
      var aCritWarn  = oModel.getProperty("/results/criticalAndWarning") || [];
      var aExcess    = oModel.getProperty("/results/excess") || [];
      var that       = this;

      this._ensureChartJs(function() {
        setTimeout(function() {
          that._buildCategoryChart(oChartData);
          that._buildProductChart(aCritWarn, aExcess);
        }, 50);
      });
    },

    _buildCategoryChart: function(oChartData) {
      var oHost = this.byId("invChartAHost");
      if (!oHost || !oHost.getDomRef()) { return; }
      var oDom = oHost.getDomRef();
      oDom.innerHTML = "";

      var oCanvas       = document.createElement("canvas");
      oCanvas.style.height = "220px";
      oDom.appendChild(oCanvas);

      var aCategories = oChartData.category_summary || [];
      var aLabels     = aCategories.map(function(c) { return c.category_name; });
      var aHistorical = aCategories.map(function(c) { return c.historical_avg; });
      var aProjected  = aCategories.map(function(c) { return c.total_projected_demand; });

      if (this._chartA) { try { this._chartA.destroy(); } catch(e) {} }
      this._chartA = new window.Chart(oCanvas, {
        type: "bar",
        data: {
          labels: aLabels,
          datasets: [
            { label: "Historikus átlag", data: aHistorical, backgroundColor: "#B0BEC5", borderRadius: 4 },
            { label: "Előrejelzés",      data: aProjected,  backgroundColor: "#185FA5", borderRadius: 4 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "bottom", labels: { font: { size: 11 } } } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11 }, color: "#6a849d" } },
            y: { grid: { color: "rgba(0,0,0,0.05)" }, ticks: { count: 5, font: { size: 11 }, color: "#6a849d" } }
          }
        }
      });
    },

    _buildProductChart: function(aCritWarn, aExcess) {
      var oHost = this.byId("invChartBHost");
      if (!oHost || !oHost.getDomRef()) { return; }
      var oDom = oHost.getDomRef();
      oDom.innerHTML = "";

      var oCanvas       = document.createElement("canvas");
      oCanvas.style.height = "200px";
      oDom.appendChild(oCanvas);

      var aLabels = [];
      var aValues = [];
      var aColors = [];

      aCritWarn.slice(0, 5).forEach(function(p) {
        aLabels.push(String(p.product_name || "").slice(0, 30));
        aValues.push(Number(p.days_until_stockout || 0));
        aColors.push("#F09595");
      });
      aExcess.slice(0, 5).forEach(function(p) {
        aLabels.push(String(p.product_name || "").slice(0, 30));
        aValues.push(Number(p.days_of_excess_stock || 0));
        aColors.push("#185FA5");
      });

      if (this._chartB) { try { this._chartB.destroy(); } catch(e) {} }
      this._chartB = new window.Chart(oCanvas, {
        type: "bar",
        data: {
          labels: aLabels,
          datasets: [{ label: "Napok", data: aValues, backgroundColor: aColors, borderRadius: 4 }]
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: "rgba(0,0,0,0.05)" }, ticks: { font: { size: 11 }, color: "#6a849d" } },
            y: { grid: { display: false }, ticks: { font: { size: 11 }, color: "#6a849d" } }
          }
        }
      });
    },

    // ─── Fájl alkalmazása ─────────────────────────────────────────────────────

    _applyFile: function(oFile) {
      var oModel    = this.getOwnerComponent().getModel("inv");
      var MAX_BYTES = 5 * 1024 * 1024;
      if (oFile.size > MAX_BYTES) {
        oModel.setProperty("/errorMessage", "A kiválasztott fájl mérete meghaladja az 5 MB-os korlátot.");
        return;
      }
      if (!oFile.name.toLowerCase().endsWith(".csv")) {
        oModel.setProperty("/errorMessage", "Csak .csv formátumú fájl tölthető fel.");
        return;
      }
      this._csvFileBuffer = oFile;
      oModel.setProperty("/errorMessage", "");
      oModel.setProperty("/csvFileName",  oFile.name);
      oModel.setProperty("/csvFileSize",  this._formatBytes(oFile.size));
    },

    _formatBytes: function(nBytes) {
      if (nBytes < 1024) { return nBytes + " B"; }
      if (nBytes < 1024 * 1024) { return Math.round(nBytes / 1024) + " KB"; }
      return (nBytes / (1024 * 1024)).toFixed(1) + " MB";
    },

    // ─── Dátum / szám formázók ────────────────────────────────────────────────

    _fmtHuf: function(n) {
      return this._fmtNum(Math.round(Number(n || 0))) + " Ft";
    },

    _fmtNum: function(n) {
      return String(Math.round(Number(n || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    },

    _fmtDateShort: function(sIso) {
      try {
        return new Intl.DateTimeFormat("hu-HU", { year: "numeric", month: "short", day: "numeric" }).format(new Date(sIso));
      } catch(e) { return String(sIso); }
    },

    _fmtDateLong: function(oDate) {
      try {
        var sDate = new Intl.DateTimeFormat("hu-HU", { year: "numeric", month: "long", day: "numeric" }).format(oDate);
        var h = String(oDate.getHours()).padStart(2, "0");
        var m = String(oDate.getMinutes()).padStart(2, "0");
        return sDate + " " + h + ":" + m;
      } catch(e) { return oDate.toISOString(); }
    },

    onNavBack: function() {
      this.getOwnerComponent().getRouter().navTo("mainMenu", { menuKey: "jokers" });
    },

    // ─── Noah Q&A integráció ──────────────────────────────────────────────────

    onNoahSummarize: function() {
      var oModel = this.getOwnerComponent().getModel("inv");
      if (!this._lastForecastResult) { return; }
      oModel.setProperty("/noahZoneState", "typing");
      this._callInventorySummarize([], "");
    },

    onNoahFollowUp: function() {
      var oModel  = this.getOwnerComponent().getModel("inv");
      var sInput  = (oModel.getProperty("/noahInput") || "").trim();
      if (!sInput) { return; }

      var iTurns = Number(oModel.getProperty("/noahTurnCount") || 0);
      // After 5 answered turns, lock the zone
      if (iTurns >= 5) {
        oModel.setProperty("/noahZoneState", "limit");
        return;
      }

      // Snapshot history BEFORE adding the new user message
      var aHistory      = (oModel.getProperty("/noahMessages") || []).slice();
      var aWithUserMsg  = aHistory.concat([{ role: "user", content: sInput }]);

      oModel.setProperty("/noahMessages",  aWithUserMsg);
      oModel.setProperty("/noahInput",     "");
      oModel.setProperty("/noahZoneState", "typing");
      oModel.setProperty("/noahTurnCount", iTurns + 1);

      this._callInventorySummarize(aHistory, sInput);
    },

    _callInventorySummarize: function(aHistory, sUserMessage) {
      var oModel = this.getOwnerComponent().getModel("inv");
      var that   = this;

      fetch("/api/inventory/summarize", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          forecast_data: this._lastForecastResult,
          horizon_days:  this._lastHorizon,
          history:       aHistory,
          user_message:  sUserMessage
        })
      })
        .then(function(res) {
          return res.json().then(function(d) { return { ok: res.ok, data: d }; });
        })
        .then(function(result) {
          if (!result.ok) {
            oModel.setProperty("/errorMessage", result.data.error || "Az AI összefoglaló generálása sikertelen.");
            oModel.setProperty("/noahZoneState", "idle");
            return;
          }
          var sReply   = result.data.summary_text || "";
          var aUpdated = (oModel.getProperty("/noahMessages") || []).concat([{ role: "assistant", content: sReply }]);
          oModel.setProperty("/noahMessages", aUpdated);

          // Lock after 5 answered follow-up turns
          var iTurns = Number(oModel.getProperty("/noahTurnCount") || 0);
          oModel.setProperty("/noahZoneState", iTurns >= 5 ? "limit" : "chat");
        })
        .catch(function() {
          oModel.setProperty("/errorMessage", "Hálózati hiba. Az AI összefoglaló nem érhető el.");
          oModel.setProperty("/noahZoneState", "idle");
        });
    },

    _resetNoahZone: function(oModel) {
      oModel.setProperty("/noahZoneState", "idle");
      oModel.setProperty("/noahMessages",  []);
      oModel.setProperty("/noahInput",     "");
      oModel.setProperty("/noahTurnCount", 0);
    },

    // ─── Drag-and-drop ────────────────────────────────────────────────────────

    _attachDropZoneEvents: function() {
      var oDropZone = this.byId("invCsvDropZone");
      if (!oDropZone) { return; }
      var oDom = oDropZone.getDomRef();
      if (!oDom) { return; }
      var that = this;

      oDom.addEventListener("dragover",  function(e) { e.preventDefault(); oDom.classList.add("invDropZoneActive"); });
      oDom.addEventListener("dragleave", function()  { oDom.classList.remove("invDropZoneActive"); });
      oDom.addEventListener("drop",      function(e) {
        e.preventDefault();
        oDom.classList.remove("invDropZoneActive");
        var aFiles = e.dataTransfer && e.dataTransfer.files;
        if (aFiles && aFiles.length > 0) { that._applyFile(aFiles[0]); }
      });
      oDom.addEventListener("click", function() { that.onCsvZonePress(); });
    }
  });
});
