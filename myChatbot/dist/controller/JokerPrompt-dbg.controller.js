sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/suite/ui/commons/demo/tutorial/service/AiService",
  "sap/ui/model/odata/v2/ODataModel",
  "sap/ui/model/json/JSONModel",
  "sap/m/Column",
  "sap/m/Text",
  "sap/m/ColumnListItem",
  "sap/viz/ui5/controls/VizFrame",
  "sap/viz/ui5/data/FlattenedDataset",
  "sap/viz/ui5/data/DimensionDefinition",
  "sap/viz/ui5/data/MeasureDefinition",
  "sap/viz/ui5/controls/common/feeds/FeedItem"
], function(
  Controller,
  MessageToast,
  AiService,
  ODataModel,
  JSONModel,
  Column,
  Text,
  ColumnListItem,
  VizFrame,
  FlattenedDataset,
  DimensionDefinition,
  MeasureDefinition,
  FeedItem
) {
  "use strict";

  return Controller.extend("sap.suite.ui.commons.demo.tutorial.controller.JokerPrompt", {
    onInit: function() {
      this.getOwnerComponent().getRouter().getRoute("jokerPrompt").attachPatternMatched(this._onRouteMatched, this);
    },

    onGenerate: async function() {
      await this._runGenerate(true);
    },

    onSend: async function() {
      await this._runGenerate(false);
    },

    onDummy5FileChange: async function(oEvent) {
      var oModel = this.getView().getModel("jokers");
      var aFiles = oEvent && oEvent.getParameter ? oEvent.getParameter("files") : null;
      var oFile = aFiles && aFiles[0] ? aFiles[0] : null;

      if (!oFile) {
        MessageToast.show("Valassz egy PDF fajlt.");
        return;
      }

      oModel.setProperty("/generating", true);
      oModel.setProperty("/dummy5Summary", "");
      oModel.setProperty("/dummy5Answer", "");
      oModel.setProperty("/dummy5DocToken", "");

      try {
        var oUpload = await AiService.uploadDummy5Pdf(oFile);
        oModel.setProperty("/dummy5DocToken", oUpload.docToken || "");
        oModel.setProperty("/dummy5FileName", oUpload.fileName || oFile.name || "");
        MessageToast.show("PDF feltoltve es feldolgozva.");
      } catch (oError) {
        MessageToast.show(oError && oError.message ? oError.message : "PDF feltoltesi hiba.");
      } finally {
        oModel.setProperty("/generating", false);
      }
    },

    onRunDummy5Summary: async function() {
      var oModel = this.getView().getModel("jokers");
      var sDocToken = (oModel.getProperty("/dummy5DocToken") || "").trim();

      if (!sDocToken) {
        MessageToast.show("Elobb tolts fel egy PDF-et.");
        return;
      }

      oModel.setProperty("/generating", true);
      try {
        var oResult = await AiService.summarizeDummy5({
          docToken: sDocToken
        });
        oModel.setProperty("/dummy5Summary", oResult.summary || "");
      } catch (oError) {
        MessageToast.show(oError && oError.message ? oError.message : "PDF osszegzes hiba.");
      } finally {
        oModel.setProperty("/generating", false);
      }
    },

    onRunDummy5Ask: async function() {
      var oModel = this.getView().getModel("jokers");
      var sDocToken = (oModel.getProperty("/dummy5DocToken") || "").trim();
      var sQuestion = (oModel.getProperty("/dummy5Question") || "").trim();

      if (!sDocToken) {
        MessageToast.show("Elobb tolts fel egy PDF-et.");
        return;
      }

      if (!sQuestion) {
        MessageToast.show("A kerdes mezot toltsd ki.");
        return;
      }

      oModel.setProperty("/generating", true);
      try {
        var oResult = await AiService.askDummy5({
          docToken: sDocToken,
          question: sQuestion
        });
        oModel.setProperty("/dummy5Answer", oResult.answer || "");
      } catch (oError) {
        MessageToast.show(oError && oError.message ? oError.message : "PDF kerdes-valasz hiba.");
      } finally {
        oModel.setProperty("/generating", false);
      }
    },

    onRunDummy7Compare: async function() {
      var oModel = this.getView().getModel("jokers");
      var sCompanyA = (oModel.getProperty("/dummy7CompanyA") || "").trim();
      var sCompanyB = (oModel.getProperty("/dummy7CompanyB") || "").trim();
      var sFocus = (oModel.getProperty("/dummy7Focus") || "").trim();

      if (!sCompanyA || !sCompanyB) {
        MessageToast.show("Add meg mindket ceg nevet.");
        return;
      }

      if (sCompanyA.charAt(0) !== "\"" || sCompanyA.charAt(sCompanyA.length - 1) !== "\"" ||
          sCompanyB.charAt(0) !== "\"" || sCompanyB.charAt(sCompanyB.length - 1) !== "\"") {
        MessageToast.show("A ceg neveket idezojelben add meg, pl.: \"Roli Foods\".");
        return;
      }

      oModel.setProperty("/generating", true);
      oModel.setProperty("/dummy7Result", "PDF generalas folyamatban...");
      try {
        var oResult = await AiService.runDummy7Compare({
          companyA: sCompanyA,
          companyB: sCompanyB,
          focus: sFocus
        });
        this._downloadDummy7Pdf(oResult.blob, oResult.fileName || "dummy7_osszehasonlitas.pdf");
        oModel.setProperty("/dummy7Result", "Kesz. A PDF letoltes elindult.");
      } catch (oError) {
        MessageToast.show(oError && oError.message ? oError.message : "Dummy7 hiba tortent.");
        oModel.setProperty("/dummy7Result", "Hiba tortent a PDF generalas soran.");
      } finally {
        oModel.setProperty("/generating", false);
      }
    },

    onRunDummy4: async function() {
      var oModel = this.getView().getModel("jokers");
      var sQuestion = (oModel.getProperty("/dummy4Question") || "").trim();
      var sSchemaHint = (oModel.getProperty("/dummy4SchemaHint") || "").trim();

      if (!sQuestion) {
        MessageToast.show("A kerdes mezot toltsd ki.");
        return;
      }

      if (!sSchemaHint) {
        MessageToast.show("A schema hint mezot toltsd ki.");
        return;
      }

      oModel.setProperty("/generating", true);
      oModel.setProperty("/dummy4GeneratedSql", "");
      oModel.setProperty("/dummy4Summary", "");
      oModel.setProperty("/dummy4Rows", []);
      oModel.setProperty("/dummy4ChartReady", false);
      this._resetDummy4Chart();
      this._resetDummy4LocalChart();
      this._rebindDummy4PreviewTable();

      try {
        var oResult = await AiService.runDummy4({
          question: sQuestion,
          schemaHint: sSchemaHint
        });

        oModel.setProperty("/dummy4GeneratedSql", oResult.generatedSql || "");
        oModel.setProperty("/dummy4Summary", oResult.summary || "");
        oModel.setProperty("/dummy4Rows", oResult.rows || []);
        this._rebindDummy4PreviewTable();
        this._renderDummy4LocalChart(oResult.rows || []);
      } catch (oError) {
        MessageToast.show(oError && oError.message ? oError.message : "Dummy4 hiba tortent.");
      } finally {
        oModel.setProperty("/generating", false);
      }
    },

    onRefreshDummy4SchemaHint: async function() {
      var oModel = this.getView().getModel("jokers");
      oModel.setProperty("/generating", true);
      try {
        var oResp = await AiService.getDummy4SchemaHint();
        oModel.setProperty("/dummy4SchemaHint", oResp && oResp.schemaHint ? oResp.schemaHint : "");
        MessageToast.show("Schema hint frissitve.");
      } catch (oError) {
        MessageToast.show(oError && oError.message ? oError.message : "Schema hint frissitesi hiba.");
      } finally {
        oModel.setProperty("/generating", false);
      }
    },

    onCancel: function() {
      var oModel = this.getView().getModel("jokers");
      oModel.setProperty("/promptInput", "");
      oModel.setProperty("/resultText", "");
      oModel.setProperty("/dummy4Question", "");
      oModel.setProperty("/dummy4GeneratedSql", "");
      oModel.setProperty("/dummy4Summary", "");
      oModel.setProperty("/dummy4Rows", []);
      oModel.setProperty("/dummy4ChartReady", false);
      this._resetDummy5State();
      this._resetDummy7State();
      this._resetDummy4Chart();
      this._resetDummy4LocalChart();
      this._rebindDummy4PreviewTable();
      this.getOwnerComponent().getRouter().navTo("mainMenu", { menuKey: "jokers" });
    },

    _onRouteMatched: function(oEvent) {
      var sJokerId = oEvent.getParameter("arguments").jokerId;
      var oModel = this.getView().getModel("jokers");
      var aTiles = oModel.getProperty("/tiles") || [];
      var oSelected = aTiles.find(function(oTile) {
        return oTile.id === sJokerId;
      });

      if (oSelected) {
        oModel.setProperty("/selectedJoker", oSelected);
        oModel.setProperty("/resultText", "");
        if (oSelected.id === "dummy-4") {
          oModel.setProperty("/dummy4GeneratedSql", "");
          oModel.setProperty("/dummy4Summary", "");
          oModel.setProperty("/dummy4Rows", []);
          oModel.setProperty("/dummy4ChartReady", false);
          this._resetDummy4Chart();
          this._resetDummy4LocalChart();
          this._rebindDummy4PreviewTable();
        } else if (oSelected.id === "dummy-5") {
          this._resetDummy5State();
        } else if (oSelected.id === "dummy-7") {
          this._resetDummy7State();
        }
      }
    },

    _resetDummy5State: function() {
      var oModel = this.getView().getModel("jokers");
      oModel.setProperty("/dummy5DocToken", "");
      oModel.setProperty("/dummy5FileName", "");
      oModel.setProperty("/dummy5Summary", "");
      oModel.setProperty("/dummy5Question", "");
      oModel.setProperty("/dummy5Answer", "");

      var oFileUploader = this.byId("dummy5FileUploader");
      if (oFileUploader && oFileUploader.clear) {
        oFileUploader.clear();
      }
    },

    _resetDummy7State: function() {
      var oModel = this.getView().getModel("jokers");
      oModel.setProperty("/dummy7CompanyA", "");
      oModel.setProperty("/dummy7CompanyB", "");
      oModel.setProperty("/dummy7Focus", "");
      oModel.setProperty("/dummy7Result", "");
    },

    _downloadDummy7Pdf: function(oBlob, sFileName) {
      if (!oBlob) {
        return;
      }
      var sUrl = URL.createObjectURL(oBlob);
      var oLink = document.createElement("a");
      oLink.href = sUrl;
      oLink.download = sFileName || "dummy7_osszehasonlitas.pdf";
      document.body.appendChild(oLink);
      oLink.click();
      document.body.removeChild(oLink);
      URL.revokeObjectURL(sUrl);
    },

    _renderDummy4LocalChart: function(aRows) {
      var oHost = this.byId("dummy4LocalChartHost");
      var aColumns = this._extractDummy4Columns(aRows);
      var aNumericCols = this._findNumericColumns(aRows, aColumns);
      var sMeasure = aNumericCols[0] || "";
      var sDimension = aColumns.find(function(sCol) {
        return sCol !== sMeasure;
      }) || aColumns[0];

      this._resetDummy4LocalChart();

      if (!oHost || !sDimension || !sMeasure) {
        return;
      }

      var aChartRows = (aRows || []).map(function(oRow) {
        var oCopy = Object.assign({}, oRow || {});
        oCopy[sMeasure] = this._toNumberOrNull(oCopy[sMeasure]);
        return oCopy;
      }.bind(this));

      var oDataset = new FlattenedDataset({
        dimensions: [
          new DimensionDefinition({
            name: sDimension,
            value: "{" + sDimension + "}"
          })
        ],
        measures: [
          new MeasureDefinition({
            name: sMeasure,
            value: "{" + sMeasure + "}"
          })
        ],
        data: {
          path: "/rows"
        }
      });

      var oViz = new VizFrame({
        width: "100%",
        height: "360px",
        vizType: "column",
        dataset: oDataset
      });

      oViz.setModel(new JSONModel({ rows: aChartRows }));
      oViz.addFeed(new FeedItem({
        uid: "categoryAxis",
        type: "Dimension",
        values: [sDimension]
      }));
      oViz.addFeed(new FeedItem({
        uid: "valueAxis",
        type: "Measure",
        values: [sMeasure]
      }));
      oViz.setVizProperties({
        title: { visible: false },
        legend: { visible: false },
        plotArea: {
          dataLabel: { visible: true }
        }
      });

      oHost.addItem(oViz);
    },

    _resetDummy4LocalChart: function() {
      var oHost = this.byId("dummy4LocalChartHost");
      if (!oHost) {
        return;
      }
      oHost.removeAllItems();
    },

    _findNumericColumns: function(aRows, aColumns) {
      return (aColumns || []).filter(function(sCol) {
        var bSeen = false;
        var bAllNumeric = true;
        (aRows || []).forEach(function(oRow) {
          var vValue = oRow ? oRow[sCol] : null;
          if (vValue == null || vValue === "") {
            return;
          }
          bSeen = true;
          if (this._toNumberOrNull(vValue) == null) {
            bAllNumeric = false;
          }
        }.bind(this));
        return bSeen && bAllNumeric;
      }.bind(this));
    },

    _toNumberOrNull: function(vValue) {
      if (typeof vValue === "number" && isFinite(vValue)) {
        return vValue;
      }
      if (typeof vValue === "string") {
        var sTrimmed = vValue.trim();
        if (!sTrimmed) {
          return null;
        }
        var nValue = Number(sTrimmed);
        if (isFinite(nValue)) {
          return nValue;
        }
      }
      return null;
    },

    _rebindDummy4PreviewTable: function() {
      var oTable = this.byId("dummy4PreviewTable");
      var oModel = this.getView().getModel("jokers");
      var aRows = oModel.getProperty("/dummy4Rows") || [];
      var aColumns = this._extractDummy4Columns(aRows);

      if (!oTable) {
        return;
      }

      oTable.unbindItems();
      oTable.removeAllColumns();

      if (aColumns.length === 0) {
        return;
      }

      aColumns.forEach(function(sColName) {
        oTable.addColumn(new Column({
          header: new Text({ text: sColName })
        }));
      });

      var aCells = aColumns.map(function(sColName) {
        return new Text({
          text: "{jokers>" + sColName + "}",
          wrapping: true
        });
      });

      var oTemplate = new ColumnListItem({
        cells: aCells
      });

      oTable.bindItems({
        path: "jokers>/dummy4Rows",
        template: oTemplate,
        templateShareable: false
      });
    },

    _extractDummy4Columns: function(aRows) {
      var mSeen = {};
      var aCols = [];

      (aRows || []).forEach(function(oRow) {
        Object.keys(oRow || {}).forEach(function(sKey) {
          if (sKey.indexOf("__") === 0 || mSeen[sKey]) {
            return;
          }
          mSeen[sKey] = true;
          aCols.push(sKey);
        });
      });

      return aCols;
    },

    _bindDummy4SmartChart: function(sChartToken) {
      var oModel = this.getView().getModel("jokers");
      var oSmartChart = this.byId("dummy4SmartChart");
      var that = this;

      if (!oSmartChart || !sChartToken) {
        oModel.setProperty("/dummy4ChartReady", false);
        return;
      }

      var sServiceUrl = "/api/jokers/dummy4/chart/" + encodeURIComponent(sChartToken) + "/";
      var oChartModel = new ODataModel(sServiceUrl, {
        useBatch: false
      });

      oModel.setProperty("/dummy4ChartReady", false);

      oChartModel.attachMetadataLoaded(function() {
        oSmartChart.setModel(oChartModel);
        if (oSmartChart.setChartType) {
          oSmartChart.setChartType("column");
        }
        oModel.setProperty("/dummy4ChartReady", true);
        that._rebindDummy4SmartChartSafely(oSmartChart);
      });

      oChartModel.attachMetadataFailed(function() {
        oModel.setProperty("/dummy4ChartReady", false);
        MessageToast.show("Smart Chart metadata betoltese sikertelen.");
      });
    },

    _rebindDummy4SmartChartSafely: function(oSmartChart) {
      if (!oSmartChart) {
        return;
      }

      // SmartChart sometimes initializes later than metadata load.
      if (oSmartChart.isInitialised && oSmartChart.isInitialised()) {
        oSmartChart.rebindChart();
        return;
      }

      oSmartChart.attachInitialise(function() {
        oSmartChart.rebindChart();
      });
    },

    _resetDummy4Chart: function() {
      var oSmartChart = this.byId("dummy4SmartChart");

      if (!oSmartChart) {
        return;
      }

      var oChartModel = oSmartChart.getModel();
      if (oChartModel && oChartModel.destroy) {
        oChartModel.destroy();
      }

      oSmartChart.setModel(null);
    },

    _runGenerate: async function(bUseSystemPrompt) {
      var oModel = this.getView().getModel("jokers");
      var oJoker = oModel.getProperty("/selectedJoker");
      var sInput = (oModel.getProperty("/promptInput") || "").trim();

      if (!oJoker) {
        MessageToast.show("Nincs kivalasztott joker.");
        return;
      }

      if (!sInput) {
        MessageToast.show("Adj meg szoveget a folytatashoz.");
        return;
      }

      oModel.setProperty("/generating", true);
      try {
        var sResult = await AiService.generate({
          title: oJoker.title,
          systemPrompt: bUseSystemPrompt ? oJoker.systemPrompt : "",
          inputText: sInput
        });
        oModel.setProperty("/resultText", sResult);
      } catch (oError) {
        MessageToast.show(oError && oError.message ? oError.message : "Hiba tortent a Generate hivaskor.");
      } finally {
        oModel.setProperty("/generating", false);
      }
    }
  });
});
