sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/m/ColumnListItem",
  "sap/m/Column",
  "sap/m/Text",
  "sap/suite/ui/commons/demo/tutorial/service/AiService"
], function(Controller, MessageToast, ColumnListItem, Column, Text, AiService) {
  "use strict";

  return Controller.extend("sap.suite.ui.commons.demo.tutorial.controller.Discovery", {
    onInit: function() {
      var oModel = this.getOwnerComponent().getModel("discovery");
      if (oModel) {
        this.getView().setModel(oModel, "discovery");
      }
      this._structuredAiFile = null;
      this._attachRoutes();
    },

    _attachRoutes: function() {
      var oRouter = this.getOwnerComponent().getRouter();
      if (!oRouter || this._routesAttached) {
        return;
      }
      oRouter.getRoute("discoveryHome").attachPatternMatched(this._onHomeMatched, this);
      oRouter.getRoute("discoveryStart").attachPatternMatched(this._onAdvisorMatched, this);
      oRouter.getRoute("discoveryBusiness").attachPatternMatched(this._onClassicMatched, this);
      oRouter.getRoute("discoveryAutoml").attachPatternMatched(this._onStructuredMatched, this);
      this._routesAttached = true;
    },

    _model: function() {
      return this.getView().getModel("discovery");
    },

    _set: function(sPath, vValue) {
      this._model().setProperty(sPath, vValue);
    },

    _get: function(sPath) {
      return this._model().getProperty(sPath);
    },

    _onHomeMatched: function() {
      this._set("/entryMode", "launcher");
    },

    _onAdvisorMatched: function() {
      this._set("/entryMode", "advisor");
      this._loadAdvisorSuggestions();
    },

    _onClassicMatched: function() {
      this._set("/entryMode", "classic");
    },

    _onStructuredMatched: function() {
      this._set("/entryMode", "structured");
    },

    onOpenDiscoveryAdvisor: function() {
      this.getOwnerComponent().getRouter().navTo("discoveryStart");
    },

    onOpenDiscoveryClassic: function() {
      this.getOwnerComponent().getRouter().navTo("discoveryBusiness");
    },

    onOpenDiscoveryStructured: function() {
      this.getOwnerComponent().getRouter().navTo("discoveryAutoml");
    },

    onBackToDiscoveryLauncher: function() {
      this.getOwnerComponent().getRouter().navTo("discoveryHome");
    },

    _loadAdvisorSuggestions: function() {
      var that = this;
      this._set("/advisorBusy", true);
      this._set("/advisorSuggestions", []);
      this._set("/advisorSummary", "");

      Promise.all([
        AiService.mlWizardGetDbTables().catch(function() { return { tables: [] }; }),
        AiService.getDummy4SchemaHint().catch(function() { return { schemaHint: "" }; })
      ]).then(function(aResults) {
        var aTables = Array.isArray(aResults[0] && aResults[0].tables) ? aResults[0].tables.filter(Boolean) : [];
        var sSchemaHint = String(aResults[1] && aResults[1].schemaHint ? aResults[1].schemaHint : "");
        var aSchemaColumns = [];
        var aSchemaSources = [];
        var aGoals = [
          { key: "prediction", label: "Elorejelzes" },
          { key: "classification", label: "Osztalyozas" },
          { key: "optimization", label: "Optimalizacio" }
        ];

        sSchemaHint.split("\n").forEach(function(sLine) {
          var aParts = sLine.split(":");
          var sSource = String(aParts[0] || "").trim();
          if (sSource) {
            aSchemaSources.push(sSource);
          }
          if (aParts[1]) {
            aParts[1].split(",").forEach(function(sColumn) {
              var sClean = String(sColumn || "").trim();
              if (sClean) {
                aSchemaColumns.push(sClean);
              }
            });
          }
        });

        that._set("/advisorAvailableSources", Array.from(new Set(aTables.concat(aSchemaSources))));

        return Promise.all(aGoals.map(function(oGoal) {
          return AiService.mlWizardStep1AiSuggestionsFromColumns({
            goal: oGoal.key,
            source_type: "db_table",
            column_names: Array.from(new Set(aSchemaColumns.concat(aTables)))
          }).then(function(oData) {
            return that._mapAdvisorSuggestion(oGoal, oData, aSchemaColumns.concat(aTables));
          }).catch(function() {
            return that._fallbackAdvisorSuggestion(oGoal, aTables);
          });
        }));
      }).then(function(aSuggestions) {
        that._set("/advisorSuggestions", aSuggestions);
        that._set("/advisorSummary",
          "Az elerheto adatforrasok alapjan " + aSuggestions.length +
          " uzleti problematipust javasolt az AI. Mindegyiknel latszik, hogy klasszikus ML trening vagy strukturalt AI modell a jobb valasztas."
        );
      }).catch(function(err) {
        that._set("/wizardError", "Felfedezesi javaslat hiba: " + (err && err.message ? err.message : String(err)));
      }).finally(function() {
        that._set("/advisorBusy", false);
      });
    },

    _mapAdvisorSuggestion: function(oGoal, oData, aColumns) {
      var aSuggestions = Array.isArray(oData && oData.goal_suggestions) ? oData.goal_suggestions : [];
      var oTop = aSuggestions.length > 0 ? aSuggestions[0] : {
        text: oGoal.label + " jellegu uzleti elemzes",
        rationale: "A jelenlegi adatforrasok alapjan ez egy jo kiindulopont."
      };
      var sText = typeof oTop === "string" ? oTop : String(oTop.text || "");
      var sRationale = typeof oTop === "string" ? "" : String(oTop.rationale || "");
      var oRecommendation = this._recommendModel(oGoal.key, sText, aColumns);

      return {
        title: sText,
        problemType: oGoal.label,
        rationale: sRationale,
        modelTitle: oRecommendation.title,
        modelDescription: oRecommendation.description,
        routeName: oRecommendation.routeName,
        featureHints: (oData && oData.early_feature_hints ? oData.early_feature_hints : []).slice(0, 3).map(function(oHint) {
          return oHint && oHint.name ? oHint.name : "";
        }).filter(Boolean)
      };
    },

    _fallbackAdvisorSuggestion: function(oGoal, aTables) {
      var oRecommendation = this._recommendModel(oGoal.key, oGoal.label, aTables || []);
      return {
        title: oGoal.label + " lehetoseg az elerheto forrasok alapjan",
        problemType: oGoal.label,
        rationale: "A rendszer ezt a problematipust ajanlja a jelenlegi forrasok alapjan.",
        modelTitle: oRecommendation.title,
        modelDescription: oRecommendation.description,
        routeName: oRecommendation.routeName,
        featureHints: []
      };
    },

    _recommendModel: function(sGoalKey, sText, aColumns) {
      var sCorpus = (String(sText || "") + " " + (aColumns || []).join(" ")).toLowerCase();
      var bStructuredPattern = /(invoice|cashflow|payment|days late|due date|income date|expected income|fizetes|kesedelem)/.test(sCorpus);

      if (sGoalKey === "prediction" && bStructuredPattern) {
        return {
          title: "Strukturalt AI modell (RPT1)",
          description: "Az adatszerkezet es a predikcios cel alapjan strukturalt, sor-szintu modell javasolt.",
          routeName: "discoveryAutoml"
        };
      }

      return {
        title: "Klasszikus ML trening",
        description: "A jelenlegi wizard altalanos ML workflow-ja a legjobb kovetkezo lepes.",
        routeName: "discoveryBusiness"
      };
    },

    onSelectAdvisorSuggestion: function(oEvent) {
      var oCtx = oEvent.getSource().getBindingContext("discovery");
      var oSuggestion = oCtx ? oCtx.getObject() : null;
      if (!oSuggestion || !oSuggestion.routeName) {
        return;
      }
      this.getOwnerComponent().getRouter().navTo(oSuggestion.routeName);
    },

    onStructuredAiFileSelected: function(oEvent) {
      var oUploader = oEvent.getSource();
      var aFiles = oEvent.getParameter("files");
      if (!aFiles || aFiles.length === 0) {
        aFiles = oUploader.oFileUpload && oUploader.oFileUpload.files;
      }
      if (!aFiles || aFiles.length === 0) {
        return;
      }
      this._structuredAiFile = aFiles[0];
      this._set("/structuredAiFileName", String(this._structuredAiFile.name || ""));
      this._set("/structuredAiError", "");
    },

    onRunStructuredAiPrediction: function() {
      var that = this;
      if (!this._structuredAiFile) {
        MessageToast.show("Elobb valassz ki egy CSV fajlt.");
        return;
      }

      this._set("/structuredAiBusy", true);
      this._set("/structuredAiError", "");
      this._set("/structuredAiPredictionRows", []);
      this._set("/structuredAiChartRows", []);

      AiService.runRpt1Generic({
        file: this._structuredAiFile
      }).then(function(oData) {
        that._set("/structuredAiSummary", String(oData && oData.summary ? oData.summary : ""));
        that._set("/structuredAiMetrics", oData && oData.metrics ? oData.metrics : null);
        that._set("/structuredAiPredictionRows", Array.isArray(oData && oData.predictionRows) ? oData.predictionRows : []);
        that._set("/structuredAiChartRows", Array.isArray(oData && oData.chartRows) ? oData.chartRows.map(function(oRow) {
          return Object.assign({}, oRow, {
            predictedCashflowFormatted: Number(oRow && oRow.predictedCashflow ? oRow.predictedCashflow : 0).toLocaleString("hu-HU", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            }) + " Ft"
          });
        }) : []);
        that._buildStructuredPredictionTable(that._get("/structuredAiPredictionRows"));
      }).catch(function(err) {
        that._set("/structuredAiError", err && err.message ? err.message : String(err));
      }).finally(function() {
        that._set("/structuredAiBusy", false);
      });
    },

    _buildStructuredPredictionTable: function(aRows) {
      var oTable = this.byId("structuredPredictionTable");
      var aColumns;
      if (!oTable) {
        return;
      }
      oTable.destroyColumns();
      oTable.destroyItems();
      if (!aRows || aRows.length === 0) {
        return;
      }

      aColumns = Object.keys(aRows[0]);
      aColumns.forEach(function(sCol) {
        oTable.addColumn(new Column({ header: new Text({ text: sCol }) }));
      });

      aRows.forEach(function(oRow) {
        var oItem = new ColumnListItem();
        aColumns.forEach(function(sCol) {
          oItem.addCell(new Text({ text: String(oRow[sCol] == null ? "" : oRow[sCol]) }));
        });
        oTable.addItem(oItem);
      });
    }
  });
});
