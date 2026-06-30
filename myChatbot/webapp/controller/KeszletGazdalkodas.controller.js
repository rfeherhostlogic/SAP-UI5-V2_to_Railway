sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast"
], function(Controller, MessageToast) {
  "use strict";

  return Controller.extend("sap.suite.ui.commons.demo.tutorial.controller.KeszletGazdalkodas", {

    onInit: function() {
      var oModel = this.getOwnerComponent().getModel("inv");
      oModel.setData({
        selectedTab:       "forecast",
        dataSource:        "db",
        horizonDays:       "30",
        csvFileName:       "",
        csvFileSize:       "",
        categories:        [],
        state:             "setup",
        errorMessage:      ""
      });
      this._csvFileBuffer = null;
      this._loadCategories();
    },

    onAfterRendering: function() {
      this._attachDropZoneEvents();
    },

    // ─── Adatforrás váltás ───────────────────────────────────────────────────

    onDataSourceChange: function() {
      var oModel = this.getOwnerComponent().getModel("inv");
      oModel.setProperty("/csvFileName",  "");
      oModel.setProperty("/csvFileSize",  "");
      oModel.setProperty("/errorMessage", "");
      this._csvFileBuffer = null;
    },

    // ─── CSV feltöltési zóna ─────────────────────────────────────────────────

    onCsvZonePress: function() {
      var oUploader = this.byId("invCsvUploader");
      if (oUploader) {
        // Native DOM click-ot indítunk a rejtett file inputon
        var oDomRef = oUploader.getDomRef();
        if (oDomRef) {
          var oInput = oDomRef.querySelector("input[type='file']");
          if (oInput) { oInput.click(); }
        }
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

    // ─── Horizont / kategória ────────────────────────────────────────────────

    onHorizonChange: function(oEvent) {
      var sKey = oEvent.getParameter("item") && oEvent.getParameter("item").getKey();
      if (sKey) {
        this.getOwnerComponent().getModel("inv").setProperty("/horizonDays", sKey);
      }
    },

    onCategoryChange: function() {
      // a kiválasztott elemek lekérése futtatáskor történik
    },

    // ─── Előrejelzés indítása ────────────────────────────────────────────────

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

      if (sDataSource === "db") {
        this._runDbForecast(Number(sHorizon), aCategoryIds.length === 1 ? aCategoryIds[0] : null);
      } else {
        this._runCsvForecast(Number(sHorizon), aCategoryIds);
      }
    },

    onBackToSetup: function() {
      var oModel = this.getOwnerComponent().getModel("inv");
      oModel.setProperty("/state",        "setup");
      oModel.setProperty("/errorMessage", "");
    },

    // ─── Kategóriák betöltése ────────────────────────────────────────────────

    _loadCategories: function() {
      var oModel = this.getOwnerComponent().getModel("inv");
      fetch("/api/inventory/categories")
        .then(function(res) { return res.json(); })
        .then(function(data) {
          if (data && Array.isArray(data.categories)) {
            oModel.setProperty("/categories", data.categories);
          }
        })
        .catch(function() {
          // Nem kritikus hiba — a szűrő üresen marad
        });
    },

    // ─── DB előrejelzés ──────────────────────────────────────────────────────

    _runDbForecast: function(iHorizon, iCategoryId) {
      var oModel = this.getOwnerComponent().getModel("inv");
      var oBody  = { horizon_days: iHorizon, data_source: "db" };
      if (iCategoryId) { oBody.category_id = iCategoryId; }

      fetch("/api/inventory/forecast", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(oBody)
      })
        .then(function(res) { return res.json().then(function(d) { return { ok: res.ok, data: d }; }); })
        .then(function(result) {
          if (!result.ok) {
            oModel.setProperty("/state",        "error");
            oModel.setProperty("/errorMessage", result.data.error || "Az előrejelzés futtatása sikertelen.");
            oModel.setProperty("/state",        "setup");
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
            // State 2 (eredmény) — ide kerül a megjelenítési logika a következő fejlesztési körben
            MessageToast.show("Az előrejelzés sikeresen lefutott. State 2 hamarosan elérhető.");
            oModel.setProperty("/state", "setup");
          }
        })
        .catch(function() {
          oModel.setProperty("/errorMessage", "Hálózati hiba. Az előrejelzés nem futtatható.");
          oModel.setProperty("/state",        "setup");
        });
    },

    // ─── CSV előrejelzés ──────────────────────────────────────────────────────

    _runCsvForecast: function(iHorizon, aCategoryIds) {
      var oModel      = this.getOwnerComponent().getModel("inv");
      var oFile       = this._csvFileBuffer;
      if (!oFile) {
        oModel.setProperty("/errorMessage", "Nem található a kiválasztott fájl. Kérjük, válassza ki újra.");
        oModel.setProperty("/state", "setup");
        return;
      }

      var oForm = new FormData();
      oForm.append("file",         oFile);
      oForm.append("horizon_days", String(iHorizon));
      if (aCategoryIds && aCategoryIds.length > 0) {
        oForm.append("category_filter", aCategoryIds[0]);
      }

      fetch("/api/inventory/upload-csv", { method: "POST", body: oForm })
        .then(function(res) { return res.json().then(function(d) { return { ok: res.ok, data: d }; }); })
        .then(function(result) {
          if (!result.ok) {
            oModel.setProperty("/errorMessage", result.data.error || "A CSV feldolgozása sikertelen.");
            oModel.setProperty("/state",        "setup");
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
            MessageToast.show("CSV előrejelzés sikeresen lefutott. State 2 hamarosan elérhető.");
            oModel.setProperty("/state", "setup");
          }
        })
        .catch(function() {
          oModel.setProperty("/errorMessage", "Hálózati hiba. A CSV feltöltése nem sikerült.");
          oModel.setProperty("/state",        "setup");
        });
    },

    // ─── Fájl alkalmazása (közös logika) ─────────────────────────────────────

    _applyFile: function(oFile) {
      var oModel   = this.getOwnerComponent().getModel("inv");
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

    // ─── Drag-and-drop natív események ───────────────────────────────────────

    _attachDropZoneEvents: function() {
      var oDropZone = this.byId("invCsvDropZone");
      if (!oDropZone) { return; }
      var oDom = oDropZone.getDomRef();
      if (!oDom) { return; }

      var that = this;

      oDom.addEventListener("dragover", function(e) {
        e.preventDefault();
        oDom.classList.add("invDropZoneActive");
      });
      oDom.addEventListener("dragleave", function() {
        oDom.classList.remove("invDropZoneActive");
      });
      oDom.addEventListener("drop", function(e) {
        e.preventDefault();
        oDom.classList.remove("invDropZoneActive");
        var aFiles = e.dataTransfer && e.dataTransfer.files;
        if (aFiles && aFiles.length > 0) {
          that._applyFile(aFiles[0]);
        }
      });

      // Kattintásra megnyitja a fájlválasztót
      oDom.addEventListener("click", function() {
        that.onCsvZonePress();
      });
    }
  });
});
