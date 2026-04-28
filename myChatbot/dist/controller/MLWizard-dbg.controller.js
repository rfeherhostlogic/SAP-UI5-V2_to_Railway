sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/ui/core/BusyIndicator",
  "sap/m/ColumnListItem",
  "sap/m/Column",
  "sap/m/Text",
  "sap/m/Token",
  "sap/ui/core/Item",
  "sap/suite/ui/commons/demo/tutorial/service/AiService"
], function(Controller, MessageToast, BusyIndicator, ColumnListItem, Column, Text, Token, CoreItem, AiService) {
  "use strict";

  var POLL_INTERVAL_MS = 1500;

  return Controller.extend("sap.suite.ui.commons.demo.tutorial.controller.MLWizard", {

    onInit: function() {
      this._profileTimer = null;
      this._trainTimer = null;
      this._simTimer = null;
      this._stepHistory = [];   // history-alapú back navigációhoz
      this._csvFiles = [];      // FileList tömb
      this._structuredAiFile = null;

      var oModel = this.getView().getModel("discovery");
      if (oModel && !oModel.getProperty("/wizardInitDone")) {
        this._resetModelData(oModel);
        oModel.setProperty("/wizardInitDone", true);
      }

      this._loadDbTables();
    },

    onExit: function() {
      this._clearAllTimers();
    },

    // ─── HELPERS ────────────────────────────────────────────────────────────────

    _model: function() { return this.getView().getModel("discovery"); },
    _set: function(sPath, vValue) { this._model().setProperty(sPath, vValue); },
    _get: function(sPath) { return this._model().getProperty(sPath); },

    _attachDiscoveryRoutes: function() {
      var oRouter = this.getOwnerComponent().getRouter();
      if (!oRouter || this._discoveryRoutesAttached) {
        return;
      }
      oRouter.getRoute("discoveryHome").attachPatternMatched(this._onDiscoveryHomeMatched, this);
      oRouter.getRoute("discoveryStart").attachPatternMatched(this._onDiscoveryAdvisorMatched, this);
      oRouter.getRoute("discoveryBusiness").attachPatternMatched(this._onDiscoveryClassicMatched, this);
      oRouter.getRoute("discoveryAutoml").attachPatternMatched(this._onDiscoveryStructuredMatched, this);
      this._discoveryRoutesAttached = true;
    },

    _onDiscoveryHomeMatched: function() {
      this._set("/entryMode", "launcher");
    },

    _onDiscoveryAdvisorMatched: function() {
      this._set("/entryMode", "advisor");
      this._loadDiscoveryAdvisorSuggestions();
    },

    _onDiscoveryClassicMatched: function() {
      this._set("/entryMode", "classic");
    },

    _onDiscoveryStructuredMatched: function() {
      this._set("/entryMode", "structured");
    },

    _normalizeAggregationRecommendation: function(vRecommendation) {
      var sValue = String(vRecommendation || "").trim().toLowerCase();
      if (!sValue) {
        return "";
      }
      if (["ajanlott", "ajánlott", "recommended"].indexOf(sValue) >= 0) {
        return "recommended";
      }
      if (["bizonytalan", "uncertain"].indexOf(sValue) >= 0) {
        return "uncertain";
      }
      if (["nem szukseges", "nem szükséges", "not_needed", "not-needed", "not needed", "none"].indexOf(sValue) >= 0) {
        return "not_needed";
      }
      return sValue;
    },

    _getSelectedGoalText: function() {
      return this._get("/step1SelectedGoalText") ||
        this._get("/step1FreeTextRefined") ||
        this._get("/step1FreeTextGoal") ||
        this._get("/step1Goal") ||
        "";
    },

    _extractForecastHorizon: function(sGoalText) {
      var sText = String(sGoalText || "").toLowerCase();
      var aPatterns = [
        { regex: /(\d+)\s*h[oó]nap/, value: null },
        { regex: /(\d+)\s*month/, value: null },
        { regex: /k[oö]vetkez[oő]\s+negyed[eé]v/, value: 3 },
        { regex: /next\s+quarter/, value: 3 }
      ];
      var i;
      var oMatch;

      for (i = 0; i < aPatterns.length; i++) {
        oMatch = aPatterns[i].regex.exec(sText);
        if (oMatch) {
          if (aPatterns[i].value !== null) {
            return aPatterns[i].value;
          }
          return Math.max(1, parseInt(oMatch[1], 10) || 3);
        }
      }

      return 3;
    },

    _isDateLikeColumn: function(sName) {
      return /date|_dt|time|datum|d[aá]tum|nap|day|week|h[eé]t|month|h[oó]nap|quarter|negyed|year|[ée]v/i.test(String(sName || ""));
    },

    _isLikelyIdColumn: function(sName) {
      return /(^|_|-)(id|key)$|identifier|azonosito|azonosító/i.test(String(sName || ""));
    },

    _isLikelyDimensionColumn: function(sName, sDtype) {
      if (this._isDateLikeColumn(sName) || this._isLikelyIdColumn(sName)) {
        return true;
      }
      return /(category|kategoria|kateg[oó]ria|segment|szegmens|group|csoport|region|orszag|ország|country|channel|termek|termék|customer|ugyfel|ügyfél|partner)/i.test(String(sName || "")) ||
        /char|string|object|category/i.test(String(sDtype || ""));
    },

    _isLikelyMeasureColumn: function(sName, sDtype) {
      if (this._isDateLikeColumn(sName) || this._isLikelyIdColumn(sName)) {
        return false;
      }
      if (!/int|float|double|decimal|number|numeric|long|short/i.test(String(sDtype || ""))) {
        return /(amount|qty|quantity|count|db|darab|sales|revenue|arbev|árbev|bev[eé]tel|profit|cost|ertek|érték|order|rendel)/i.test(String(sName || ""));
      }
      return true;
    },

    _pickTargetColumn: function(aColumns) {
      var sGoalText = this._getSelectedGoalText().toLowerCase();
      var aPriorityPatterns = [
        /(rendel[eé]s|order).*(db|darab|count|qty|quantity)|(db|darab|count|qty|quantity).*(rendel[eé]s|order)/i,
        /(bev[eé]tel|revenue|sales|forgalom|amount|netamount)/i,
        /(profit|margin|cost|k[oö]lts[eé]g)/i
      ];
      var aMeasures = (aColumns || []).filter(function(oColumn) {
        return this._isLikelyMeasureColumn(oColumn.name, oColumn.dtype);
      }.bind(this));
      var i;
      var oFound;

      for (i = 0; i < aPriorityPatterns.length; i++) {
        oFound = aMeasures.find(function(oColumn) {
          return aPriorityPatterns[i].test(String(oColumn.name || "")) && (!sGoalText || aPriorityPatterns[i].test(sGoalText));
        });
        if (oFound) {
          return oFound.name;
        }
      }

      oFound = aMeasures.find(function(oColumn) {
        return sGoalText && sGoalText.indexOf(String(oColumn.name || "").toLowerCase()) >= 0;
      });
      if (oFound) {
        return oFound.name;
      }

      return aMeasures.length > 0 ? aMeasures[0].name : "";
    },

    _prefillStep2Selections: function(oProfile, aFeatureSuggestions) {
      var aColumns = (oProfile && oProfile.columns) || [];
      var sTargetColumn = this._get("/step2TargetColumn");
      var aInputColumns = this._get("/step2InputColumns") || [];
      var aSelectedFeatures = aFeatureSuggestions || [];
      var aCandidateInputs;
      var aSuggestedFeatureNames;
      var oInputMulti;

      if (!sTargetColumn) {
        sTargetColumn = this._pickTargetColumn(aColumns);
        if (sTargetColumn) {
          this._set("/step2TargetColumn", sTargetColumn);
        }
      }

      if (aInputColumns.length === 0) {
        aCandidateInputs = [];

        if (this._get("/stepAggrDateColumn")) {
          aCandidateInputs.push(this._get("/stepAggrDateColumn"));
        }
        (this._get("/stepAggrGroupKeys") || []).forEach(function(sKey) {
          if (aCandidateInputs.indexOf(sKey) < 0) {
            aCandidateInputs.push(sKey);
          }
        });

        aSuggestedFeatureNames = aSelectedFeatures
          .filter(function(oFeature) {
            return oFeature && oFeature.selected && oFeature.readiness === "ready";
          })
          .map(function(oFeature) {
            return oFeature.name || oFeature.label || "";
          })
          .filter(Boolean);

        aColumns.forEach(function(oColumn) {
          var sName = oColumn.name;
          var bSuggested = aSuggestedFeatureNames.some(function(sFeatureName) {
            return sFeatureName.toLowerCase() === String(sName || "").toLowerCase();
          });
          var bUsefulByType = this._isDateLikeColumn(sName) || this._isLikelyDimensionColumn(sName, oColumn.dtype);
          if (sName && sName !== sTargetColumn && (bSuggested || bUsefulByType) && aCandidateInputs.indexOf(sName) < 0) {
            aCandidateInputs.push(sName);
          }
        }.bind(this));

        if (aCandidateInputs.length === 0) {
          aCandidateInputs = aColumns
            .filter(function(oColumn) { return oColumn.name && oColumn.name !== sTargetColumn; })
            .slice(0, 5)
            .map(function(oColumn) { return oColumn.name; });
        }

        this._set("/step2InputColumns", aCandidateInputs);
        oInputMulti = this.byId("inputColumnsMulti");
        if (oInputMulti) {
          oInputMulti.setSelectedKeys(aCandidateInputs);
        }
      }
    },

    _goToStep: function(sStepId) {
      var oWizard = this._getWizard();
      var oStep = this._getStep(sStepId);
      var aSteps;
      var iTargetIndex;
      var iStepIndex;
      var oProgressStep;
      var iProgressIndex;
      if (!oWizard || !oStep) {
        return;
      }
      if (this._stepHistory[this._stepHistory.length - 1] !== sStepId) {
        this._stepHistory.push(sStepId);
      }

      aSteps = oWizard.getSteps ? oWizard.getSteps() : [];
      iTargetIndex = aSteps.indexOf(oStep);

      if (iTargetIndex >= 0 && oWizard.validateStep) {
        for (iStepIndex = 0; iStepIndex <= iTargetIndex; iStepIndex += 1) {
          oWizard.validateStep(aSteps[iStepIndex]);
        }
      }

      oProgressStep = oWizard.getProgressStep ? oWizard.getProgressStep() : null;
      iProgressIndex = aSteps.indexOf(oProgressStep);

      if (iTargetIndex >= 0 && iProgressIndex >= 0 && oWizard.nextStep) {
        while (iProgressIndex < iTargetIndex) {
          oWizard.nextStep();
          iProgressIndex += 1;
        }
      }

      oWizard.goToStep(oStep, true);
    },

    _clearAllTimers: function() {
      if (this._profileTimer) { clearInterval(this._profileTimer); this._profileTimer = null; }
      if (this._trainTimer) { clearInterval(this._trainTimer); this._trainTimer = null; }
      if (this._simTimer) { clearInterval(this._simTimer); this._simTimer = null; }
    },

    _resetModelData: function(oModel) {
      oModel.setData(Object.assign(oModel.getData(), {
        wizardError: "",
        entryMode: "launcher",
        sessionId: "",
        advisorBusy: false,
        advisorAvailableSources: [],
        advisorSuggestions: [],
        advisorSummary: "",
        structuredAiBusy: false,
        structuredAiFile: null,
        structuredAiFileName: "",
        structuredAiSummary: "",
        structuredAiError: "",
        structuredAiMetrics: null,
        structuredAiPredictionRows: [],
        structuredAiChartRows: [],
        // Step 1
        step1GoalMode: "ai_suggested",
        step1Goal: "prediction",
        step1GoalHint: "Folyamatos értéket (pl. bevétel, mennyiség) jósolj meg.",
        step1FreeTextGoal: "",
        step1FreeTextRefined: "",
        step1FreeTextBusy: false,
        step1SourceType: "csv",
        step1SelectedTables: [],
        step1AvailableTables: [],
        step1CsvFiles: [],
        step1ColumnPreview: [],
        step1AiGoalSuggestions: [],
        step1EarlyFeatureHints: [],
        step1SelectedGoalText: "",
        step1AggregationRecommendation: "",
        step1AiBusy: false,
        step1Busy: false,
        step1StatusText: "",
        showStepJoin: false,
        showStepAggr: false,
        // Step Join (1b)
        stepJoinSourceOptions: [],
        stepJoinMainSource: "",
        stepJoinMappings: [],
        stepJoinPreviewCount: 0,
        stepJoinPreviewError: "",
        stepJoinBusy: false,
        // Step Aggr (1c)
        stepAggrUnit: "",
        stepAggrGroupKeys: [],
        stepAggrDateColumn: "",
        stepAggrTimeLevel: "monthly",
        stepAggrTimePeriod: "all",
        stepAggrTimePeriodFrom: "",
        stepAggrTimePeriodTo: "",
        stepAggrAvailableColumns: [],
        stepAggrAvailableDateColumns: [],
        stepAggrPreviewBefore: null,
        stepAggrPreviewAfter: null,
        stepAggrPreviewError: "",
        stepAggrBusy: false,
        // Step 2
        step2Profile: null,
        step2QualityIssues: [],
        step2QualitySummary: "",
        step2AiFeatureSuggestions: [],
        step2AvailableColumnItems: [],
        step2InputColumns: [],
        step2TargetColumn: "",
        step2SelectedFeatures: [],
        step2ReadinessSummary: "",
        step2Busy: false,
        // Step 3
        step3ModelTier: "balanced",
        step3AiTierExplanation: "",
        step3TrainingJobId: "",
        step3TrainingProgress: 0,
        step3TrainingMessage: "",
        step3TrainingStatus: "IDLE",
        step3TierOptions: [
          { key: "fast",     title: "Gyors",           description: "Azonnali eredmény, egyszerűbb modell. Kisebb adathalmazhoz vagy gyors teszteléshez.", icon: "sap-icon://accelerated", color: "#e78c07", selected: false },
          { key: "balanced", title: "Kiegyensúlyozott", description: "Jó arány a pontosság és a futási idő között. Legtöbb esetben ez az ajánlott.",      icon: "sap-icon://compare",     color: "#0854a0", selected: true },
          { key: "accurate", title: "Pontos",           description: "Maximális pontosság, hosszabb futási idő. Nagy adathalmazhoz és kritikus döntésekhez.", icon: "sap-icon://quality-issue",color: "#107e3e", selected: false }
        ],
        // Step 4
        step4PreviewRows: [],
        step4Metrics: null,
        step4MetricsItems: [],
        step4FeatureImportance: [],
        step4AiInsight: { model_evaluation: "", insights: [], recommendations: [], risks: [] },
        step4ExecutiveSummary: "",
        step4ExecutiveSummaryBusy: false,
        step4PredictionDistribution: [],
        step4CsvDownloadUrl: "",
        step4Busy: false,
        // Step 5
        step5SuggestedInputs: [],
        step5SuggestedInputsBusy: false,
        step5SimulationChanges: [],
        step5SimulationResult: null,
        step5AiSimulationContext: "",
        step5SimBusy: false,
        step5ScheduleEnabled: false,
        step5ScheduleId: 0,
        step5ScheduleFrequency: "immediate",
        step5ScheduleWeeklyDay: 1,
        step5ScheduleTime: "09:00",
        step5ScheduleStatusText: "",
        step5ScheduleError: false
      }));
    },

    // DB táblák betöltése – elsődlegesen a dedikált ML Wizard végpontról.
    // Ha ez nem elérhető, fallbackként használjuk a Riportok schema hintet.
    _loadDbTables: function() {
      var that = this;
      AiService.mlWizardGetDbTables().then(function(oData) {
        var aTables = Array.isArray(oData && oData.tables) ? oData.tables.filter(Boolean) : [];
        that._set("/step1AvailableTables", aTables);
      }).catch(function() {
        return AiService.getDummy4SchemaHint().then(function(oData) {
          var sHint = String(oData && oData.schemaHint ? oData.schemaHint : "");
          var aTables = sHint.split("\n")
            .map(function(l) { return l.split(":")[0].trim(); })
            .filter(Boolean);
          that._set("/step1AvailableTables", aTables);
        });
      }).catch(function() {
        // silently ignore – DB tables may not be available
      });
    },

    _getWizard: function() { return this.byId("mlWizard"); },
    _getStep: function(sId) { return this.byId(sId); },

    _validateStep: function(sStepId) {
      var oStep = this._getStep(sStepId);
      if (oStep) { oStep.setValidated(true); }
    },

    // History-alapú navigáció
    _navigateTo: function(sStepId) {
      this._stepHistory.push(sStepId);
      var oWizard = this._getWizard();
      var oStep = this._getStep(sStepId);
      if (oWizard && oStep) {
        oWizard.goToStep(oStep, false);
      }
    },

    onClearError: function() { this._set("/wizardError", ""); },

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

    _loadDiscoveryAdvisorSuggestions: function() {
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
            return that._mapDiscoveryAdvisorSuggestion(oGoal, oData, aSchemaColumns.concat(aTables));
          }).catch(function() {
            return that._buildFallbackDiscoverySuggestion(oGoal, aTables);
          });
        }));
      }).then(function(aSuggestions) {
        that._set("/advisorSuggestions", aSuggestions);
        that._set("/advisorSummary",
          "Az elerheto adatforrasok alapjan az AI " + aSuggestions.length +
          " uzleti iranyt javasol, amelyek kozul valaszthatsz a klasszikus ML trening es a strukturalt AI modell kozott."
        );
      }).catch(function(err) {
        that._set("/wizardError", "Felfedezesi javaslat hiba: " + (err && err.message ? err.message : String(err)));
      }).finally(function() {
        that._set("/advisorBusy", false);
      });
    },

    _mapDiscoveryAdvisorSuggestion: function(oGoal, oData, aColumns) {
      var aSuggestions = Array.isArray(oData && oData.goal_suggestions) ? oData.goal_suggestions : [];
      var oTopSuggestion = aSuggestions.length > 0 ? aSuggestions[0] : {
        text: oGoal.label + " jellegu uzleti elemzes",
        rationale: "A jelenlegi adatforrasok alapjan ez a legkezenfekvobb kiindulasi pont."
      };
      var sText = typeof oTopSuggestion === "string" ? oTopSuggestion : String(oTopSuggestion.text || "");
      var sRationale = typeof oTopSuggestion === "string" ? "" : String(oTopSuggestion.rationale || "");
      var oRecommendation = this._recommendDiscoveryModel(oGoal.key, sText, aColumns);

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

    _buildFallbackDiscoverySuggestion: function(oGoal, aTables) {
      var oRecommendation = this._recommendDiscoveryModel(oGoal.key, oGoal.label, aTables || []);
      return {
        title: oGoal.label + " lehetoseg az elerheto forrasokbol",
        problemType: oGoal.label,
        rationale: "A rendszer az elerheto adatforrasok alapjan ezt a problematipust tekinti jo kiindulopontnak.",
        modelTitle: oRecommendation.title,
        modelDescription: oRecommendation.description,
        routeName: oRecommendation.routeName,
        featureHints: []
      };
    },

    _recommendDiscoveryModel: function(sGoalKey, sText, aColumns) {
      var sCorpus = (String(sText || "") + " " + (aColumns || []).join(" ")).toLowerCase();
      var bStructuredPattern = /(invoice|cashflow|payment|days late|due date|income date|expected income|fizetes|kesedelem)/.test(sCorpus);

      if (sGoalKey === "prediction" && bStructuredPattern) {
        return {
          title: "Strukturalt AI modell (RPT1)",
          description: "Az adatszerkezet alapjan ez jo jelolt strukturalt, sor-szintu predikciohoz.",
          routeName: "discoveryAutoml"
        };
      }

      return {
        title: "Klasszikus ML trening",
        description: "A problemahoz a jelenlegi wizard altalanos ML trening folyamata a legjobb kiindulasi pont.",
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
    },

    // ─── STEP 1 HANDLERS ─────────────────────────────────────────────────────

    onStep1GoalModeChange: function(oEvent) {
      var sKey = oEvent.getParameter("key");
      this._set("/step1GoalMode", sKey);
      // AI javasolt módban: ha már van forrás, auto-indítjuk
      if (sKey === "ai_suggested") {
        var bHasSource = this._get("/step1SourceType") === "csv"
          ? this._get("/step1CsvFiles").length > 0
          : this._get("/step1SelectedTables").length > 0;
        if (bHasSource) {
          this.onStep1LoadAiSuggestions();
        }
      }
    },

    onStep1GoalChange: function(oEvent) {
      var sKey = oEvent.getParameter("key");
      this._set("/step1Goal", sKey);
      var hints = {
        prediction:     "Folyamatos értéket (pl. bevétel, mennyiség) jósolj meg.",
        classification: "Kategóriába sorold az adatokat (pl. lemorzsolódik / nem, magas / alacsony kockázat).",
        optimization:   "Optimális döntést vagy elosztást javasolj (pl. készlet, erőforrás, ütemezés)."
      };
      this._set("/step1GoalHint", hints[sKey] || "");
      // Szinkronizáld az AI javaslatokat az új céltípushoz
      var bHasSource = this._get("/step1SourceType") === "csv"
        ? this._get("/step1CsvFiles").length > 0
        : this._get("/step1SelectedTables").length > 0;
      if (bHasSource) {
        this._set("/step1AiGoalSuggestions", []);
        this.onStep1LoadAiSuggestions();
      }
    },

    onStep1SourceTypeChange: function(oEvent) {
      var sKey = oEvent.getParameter("selectedKey") || oEvent.getParameter("key");
      this._set("/step1SourceType", sKey);
      this._set("/step1ColumnPreview", []);
      this._set("/sessionId", "");
      this._set("/step1AiGoalSuggestions", []);
      this._set("/step1AggregationRecommendation", "");
    },

    onStep1CsvSelected: function(oEvent) {
      var oFileUploader = oEvent.getSource();
      var oFiles = oEvent.getParameter("files");
      if (!oFiles || oFiles.length === 0) {
        oFiles = oFileUploader.oFileUpload && oFileUploader.oFileUpload.files;
      }
      if (!oFiles || oFiles.length === 0) { return; }

      this._csvFiles = Array.from(oFiles);

      // Kliens oldali gyors fejléc-elemzés
      var aFileItems = [];
      var aColumnPreview = [];
      var nParsed = 0;
      var that = this;

      var fnDone = function() {
        that._set("/step1CsvFiles", aFileItems);
        that._set("/step1ColumnPreview", aColumnPreview);
        // AI javasolt módban auto-töltés
        if (that._get("/step1GoalMode") === "ai_suggested") {
          that.onStep1LoadAiSuggestions();
        }
      };

      Array.from(oFiles).forEach(function(oFile) {
        var oReader = new FileReader();
        oReader.onload = function(e) {
          var sContent = e.target.result || "";
          var aLines = sContent.split(/\r?\n/).filter(function(l) { return l.trim(); });
          var nRows = Math.max(0, aLines.length - 1);
          var aHeaders = aLines.length > 0
            ? aLines[0].split(",").map(function(h) { return h.replace(/^"|"$/g, "").trim(); })
            : [];

          aFileItems.push({ name: oFile.name, rowCount: nRows });
          aHeaders.forEach(function(sCol) {
            aColumnPreview.push({ source: oFile.name, name: sCol, dtype_hint: "unknown" });
          });

          nParsed++;
          if (nParsed === oFiles.length) { fnDone(); }
        };
        oReader.readAsText(oFile.slice(0, 8192)); // csak az első 8KB kell a fejléchez
      });
    },

    onStep1TablesSelected: function(oEvent) {
      var oMulti = oEvent.getSource();
      var aSelected = oMulti.getSelectedItems().map(function(i) { return i.getKey(); });
      this._set("/step1SelectedTables", aSelected);
      this._set("/step1AiGoalSuggestions", []);
      this._set("/step1AggregationRecommendation", "");

      if (aSelected.length === 0) {
        this._set("/step1ColumnPreview", []);
        return;
      }

      // Előnézet: azonnal betöltjük az első tábla oszlopait (dummy4 séma alapján)
      var that = this;
      var aPreview = [];
      var sTables = this._get("/step1AvailableTables");
      // Egyszerű megközelítés: a schema hintből kiszedett neveket használjuk
      aSelected.forEach(function(sTable) {
        aPreview.push({ source: sTable, name: "(oszlopok betöltés alatt...)", dtype_hint: "" });
      });
      this._set("/step1ColumnPreview", aPreview);

      // AI javasolt módban auto-töltés
      if (this._get("/step1GoalMode") === "ai_suggested") {
        // Kis késleltetés, hogy a multicombobox stabilizálódjon
        setTimeout(function() { that.onStep1LoadAiSuggestions(); }, 300);
      }
    },

    onStep1LoadAiSuggestions: function() {
      var sGoal = this._get("/step1Goal");
      var sSourceType = this._get("/step1SourceType");
      var aColumns = this._get("/step1ColumnPreview") || [];
      var aColumnNames = aColumns.map(function(c) { return c.name; });

      if (aColumnNames.length === 0 && sSourceType === "csv") {
        MessageToast.show("Előbb tölts fel CSV fájlt.");
        return;
      }
      if (this._get("/step1SelectedTables").length === 0 && sSourceType === "db_table") {
        MessageToast.show("Előbb válassz adatbázis táblát.");
        return;
      }

      this._set("/step1AiBusy", true);
      var that = this;
      AiService.mlWizardStep1AiSuggestionsFromColumns({
        goal: sGoal,
        source_type: sSourceType,
        column_names: aColumnNames
      }).then(function(oData) {
        // goal_suggestions: [{text, rationale}]
        var aSuggestions = (oData.goal_suggestions || []).map(function(item) {
          var oItem = typeof item === "string" ? { text: item, rationale: "" } : item;
          return Object.assign({}, oItem, { selected: false });
        });
        that._set("/step1AiGoalSuggestions", aSuggestions);
        that._set("/step1EarlyFeatureHints", oData.early_feature_hints || []);
        that._set("/step1AggregationRecommendation", that._normalizeAggregationRecommendation(oData.aggregation_recommendation));

        // Ha az AI osztályozást/optimalizációt javasol, auto-beállítjuk
        if (oData.suggested_goal_type && ["prediction","classification","optimization"].indexOf(oData.suggested_goal_type) >= 0) {
          that._set("/step1Goal", oData.suggested_goal_type);
          var hints = {
            prediction:     "Folyamatos értéket (pl. bevétel, mennyiség) jósolj meg.",
            classification: "Kategóriába sorold az adatokat (pl. lemorzsolódik / nem, magas / alacsony kockázat).",
            optimization:   "Optimális döntést vagy elosztást javasolj (pl. készlet, erőforrás, ütemezés)."
          };
          that._set("/step1GoalHint", hints[oData.suggested_goal_type] || "");
        }
      }).catch(function(err) {
        MessageToast.show("AI javaslat hiba: " + (err && err.message ? err.message : String(err)));
      }).finally(function() {
        that._set("/step1AiBusy", false);
      });
    },

    onStep1RefineGoal: function() {
      var sFreeText = this._get("/step1FreeTextGoal");
      if (!sFreeText) { return; }

      var aColumns = (this._get("/step1ColumnPreview") || []).map(function(c) { return c.name; });
      this._set("/step1FreeTextBusy", true);
      var that = this;

      AiService.mlWizardStep1RefineGoal({
        goal_text: sFreeText,
        column_names: aColumns,
        source_type: this._get("/step1SourceType")
      }).then(function(oData) {
        that._set("/step1FreeTextRefined", oData.refined_text || "");

        // Auto-beállítja a céltípust
        if (oData.goal_type && ["prediction","classification","optimization"].indexOf(oData.goal_type) >= 0) {
          that._set("/step1Goal", oData.goal_type);
          var hints = {
            prediction:     "Folyamatos értéket (pl. bevétel, mennyiség) jósolj meg.",
            classification: "Kategóriába sorold az adatokat (pl. lemorzsolódik / nem, magas / alacsony kockázat).",
            optimization:   "Optimális döntést vagy elosztást javasolj (pl. készlet, erőforrás, ütemezés)."
          };
          that._set("/step1GoalHint", hints[oData.goal_type] || "");
        }

        // Javasolt célkitűzések
        var aSuggestions = (oData.goal_suggestions || []).map(function(item) {
          var oItem = typeof item === "string" ? { text: item, rationale: "" } : item;
          return Object.assign({}, oItem, { selected: false });
        });
        that._set("/step1AiGoalSuggestions", aSuggestions);
        that._set("/step1EarlyFeatureHints", oData.early_feature_hints || []);
        that._set("/step1AggregationRecommendation", that._normalizeAggregationRecommendation(oData.aggregation_recommendation));
      }).catch(function(err) {
        MessageToast.show("AI javítás hiba: " + (err && err.message ? err.message : String(err)));
      }).finally(function() {
        that._set("/step1FreeTextBusy", false);
      });
    },

    onStep1GoalSuggestionSelect: function(oEvent) {
      var oListItem = oEvent.getParameter("listItem");
      var oContext = oListItem && oListItem.getBindingContext("discovery");
      if (!oContext) { return; }

      var sSelectedPath = oContext.getPath();
      var aItems = this._get("/step1AiGoalSuggestions") || [];
      aItems.forEach(function(item, idx) {
        item.selected = ("/step1AiGoalSuggestions/" + idx) === sSelectedPath;
      });
      this._set("/step1AiGoalSuggestions", aItems);

      var oSelected = this._model().getProperty(sSelectedPath);
      this._set("/step1SelectedGoalText", oSelected && oSelected.text ? oSelected.text : "");
    },

    onStep1Next: function() {
      var sGoal = this._get("/step1Goal");
      var sSourceType = this._get("/step1SourceType");

      if (!sGoal) {
        MessageToast.show("Válassz ML célt a folytatáshoz.");
        return;
      }
      if (sSourceType === "csv" && this._csvFiles.length === 0) {
        MessageToast.show("Tölts fel legalább egy CSV fájlt a folytatáshoz.");
        return;
      }
      if (sSourceType === "db_table" && this._get("/step1SelectedTables").length === 0) {
        MessageToast.show("Válassz legalább egy adatbázis táblát a folytatáshoz.");
        return;
      }

      this._set("/step1Busy", true);
      this._set("/step1StatusText", "Adatforras ellenorzese es kovetkezo lepes elokeszitese...");
      this._set("/wizardError", "");
      BusyIndicator.show(0);
      var that = this;

      this._initSessionAndProfile().then(function() {
        that._validateStep("wizStep1");
        that._set("/step1StatusText", "");
        that._set("/step1Busy", false);
        BusyIndicator.hide();
        that._set("/step1StatusText", "A profilozas elindult. Betoltjuk a kovetkezo lepest...");
        BusyIndicator.hide();

        var bMultiSource = that._get("/step1CsvFiles").length > 1 ||
          that._get("/step1SelectedTables").length > 1 ||
          (that._get("/step1CsvFiles").length >= 1 && that._get("/step1SelectedTables").length >= 1);
        var sAggrRec = that._normalizeAggregationRecommendation(that._get("/step1AggregationRecommendation"));
        var bNeedAggr = sAggrRec === "recommended" || sAggrRec === "uncertain";
        that._set("/showStepJoin", bMultiSource);
        that._set("/showStepAggr", bNeedAggr);
        that._set("/step1AggregationRecommendation", sAggrRec);

        // Mindig előkészítjük mindkét lépést (felhasználó mindig látja)
        that._buildJoinSourceOptions();
        that._buildAggrColumns();
        if (bMultiSource) {
          that.onLoadJoinAiSuggestion();
        }
        if (bNeedAggr) {
          that.onLoadAggrAiSuggestion();
        }

        that._stepHistory = ["wizStep1"];
        that._goToStep("wizStepJoin");
        return;
      }).catch(function(err) {
        that._set("/wizardError", "Inicializálási hiba: " + (err && err.message ? err.message : String(err)));
        that._set("/step1Busy", false);
      });
    },

    _initSessionAndProfile: function() {
      var that = this;
      var sSourceType = this._get("/step1SourceType");
      var sGoal = this._get("/step1Goal");
      var sSelectedGoal = this._get("/step1SelectedGoalText") || sGoal;

      return AiService.mlWizardInit({
        goal: sSelectedGoal,
        source_type: sSourceType,
        table_names: sSourceType === "db_table" ? this._get("/step1SelectedTables") : [],
        csv_files: sSourceType === "csv" ? this._csvFiles : []
      }).then(function(oData) {
        that._set("/sessionId", oData.session_id);

        // Pontosabb oszlop-lista a backendről
        if (oData.columns && oData.columns.length > 0) {
          that._set("/step1ColumnPreview", oData.columns);
        }

        // Profile job indítása
        return AiService.mlWizardStep2Profile({ session_id: oData.session_id });
      }).then(function(oJobData) {
        that._set("/step2Busy", true);
        that._startProfilePoll(oJobData.job_id);
      });
    },

    _startProfilePoll: function(sJobId) {
      var that = this;
      this._clearTimer("profile");
      this._profileTimer = setInterval(function() {
        AiService.mlWizardGetJobStatus({ job_id: sJobId }).then(function(oData) {
          if (oData.status === "done") {
            clearInterval(that._profileTimer);
            that._profileTimer = null;
            that._set("/step1StatusText", "Az adatok elemzese befejezodott.");
            that._loadProfileResult();
          } else if (oData.status === "error") {
            clearInterval(that._profileTimer);
            that._profileTimer = null;
            that._set("/step2Busy", false);
            that._set("/step1StatusText", "");
            that._set("/wizardError", "Adatelemzési hiba: " + (oData.message || "Ismeretlen hiba"));
          }
        }).catch(function() {});
      }, POLL_INTERVAL_MS);
    },

    _clearTimer: function(sType) {
      if (sType === "profile" && this._profileTimer) { clearInterval(this._profileTimer); this._profileTimer = null; }
      if (sType === "train" && this._trainTimer) { clearInterval(this._trainTimer); this._trainTimer = null; }
      if (sType === "sim" && this._simTimer) { clearInterval(this._simTimer); this._simTimer = null; }
    },

    _loadProfileResult: function(iAttempt) {
      var sSessionId = this._get("/sessionId");
      var that = this;
      var iRetryCount = typeof iAttempt === "number" ? iAttempt : 0;
      AiService.mlWizardStep2ProfileResult({ session_id: sSessionId }).then(function(oData) {
        var oProfile = oData.profile || {};
        that._set("/step2Profile", oProfile);
        that._set("/step2QualityIssues", oProfile.quality_issues || []);
        that._set("/step2QualitySummary", oData.quality_summary || "");

        var aColumns = (oProfile.columns || []).map(function(c) {
          return { key: c.name, text: c.name + " (" + c.dtype + ")" };
        });
        that._set("/step2AvailableColumnItems", aColumns);

        var aSuggestions = (oData.ai_feature_suggestions || []).map(function(f) {
          return Object.assign({}, f, { selected: f.readiness === "ready" });
        });
        that._set("/step2AiFeatureSuggestions", aSuggestions);
        that._set("/step2SelectedFeatures", aSuggestions);
        that._prefillStep2Selections(oProfile, aSuggestions);
        that._set("/step1StatusText", "");
        that._set("/step2Busy", false);
      }).catch(function(err) {
        if (err && err.status === 404 && iRetryCount < 6) {
          that._set("/step1StatusText", "Az adatok elemzese folyamatban van, varunk az eredmenyre...");
          setTimeout(function() {
            that._loadProfileResult(iRetryCount + 1);
          }, 1000);
          return;
        }
        that._set("/step1StatusText", "");
        that._set("/step2Busy", false);
        that._set("/wizardError", "Profil betöltési hiba: " + (err && err.message ? err.message : String(err)));
      });
    },

    // ─── STEP JOIN (1b) HANDLERS ─────────────────────────────────────────────

    _buildJoinSourceOptions: function() {
      var aSources = [];
      (this._get("/step1CsvFiles") || []).forEach(function(f) { aSources.push(f.name); });
      (this._get("/step1SelectedTables") || []).forEach(function(t) { aSources.push(t); });
      this._set("/stepJoinSourceOptions", aSources);
      if (aSources.length > 0) {
        this._set("/stepJoinMainSource", aSources[0]);
      }
    },

    onAddJoinRow: function() {
      var aMappings = this._get("/stepJoinMappings") || [];
      aMappings.push({ left_col: "", join_type: "left", right_col: "" });
      this._set("/stepJoinMappings", aMappings);
    },

    onRemoveJoinRow: function(oEvent) {
      var oListItem = oEvent.getSource().getParent();
      var oContext = oListItem.getBindingContext("discovery");
      if (!oContext) { return; }
      var nIdx = parseInt(oContext.getPath().split("/").pop(), 10);
      var aMappings = this._get("/stepJoinMappings") || [];
      aMappings.splice(nIdx, 1);
      this._set("/stepJoinMappings", aMappings);
    },

    onLoadJoinAiSuggestion: function() {
      var sSessionId = this._get("/sessionId");
      if (!sSessionId) { MessageToast.show("Session nem elérhető."); return; }
      this._set("/stepJoinBusy", true);
      var that = this;
      AiService.mlWizardStep1bAiJoin({ session_id: sSessionId }).then(function(oData) {
        that._set("/stepJoinMainSource", oData.main_source || that._get("/stepJoinMainSource"));
        that._set("/stepJoinMappings", oData.join_mappings || []);
      }).catch(function(err) {
        MessageToast.show("Join AI hiba: " + (err && err.message ? err.message : String(err)));
      }).finally(function() {
        that._set("/stepJoinBusy", false);
      });
    },

    onStepJoinNext: function() {
      this._validateStep("wizStepJoin");
      this._goToStep("wizStepAggr");
      return;
    },

    // ─── STEP AGGR (1c) HANDLERS ─────────────────────────────────────────────

    _buildAggrColumns: function() {
      var aPreview = this._get("/step1ColumnPreview") || [];
      var aAll = aPreview.map(function(c) { return { key: c.name, text: c.name }; });
      // Dátum gyanús oszlopok: tartalmazza a "date", "dt", "time", "datum", "nap" szavakat
      var aDateCols = aPreview
        .filter(function(c) { return /date|_dt|time|datum|nap|day|hét|week/i.test(c.name); })
        .map(function(c) { return c.name; });
      if (aDateCols.length === 0) {
        aDateCols = aPreview.map(function(c) { return c.name; }); // ha nincs találat, mindet felvesszük
      }
      this._set("/stepAggrAvailableColumns", aAll);
      this._set("/stepAggrAvailableDateColumns", aDateCols);
    },

    onAggrGroupKeysChange: function(oEvent) {
      var aItems = oEvent.getSource().getSelectedItems();
      this._set("/stepAggrGroupKeys", aItems.map(function(i) { return i.getKey(); }));
    },

    onLoadAggrAiSuggestion: function() {
      var sSessionId = this._get("/sessionId");
      var sSelectedGoal = this._getSelectedGoalText();
      if (!sSessionId) { MessageToast.show("Session nem elérhető."); return; }
      this._set("/stepAggrBusy", true);
      var that = this;
      AiService.mlWizardStep1cAiAggregation({
        session_id: sSessionId,
        goal_text: sSelectedGoal
      }).then(function(oData) {
        that._set("/stepAggrUnit", oData.unit || "");
        that._set("/stepAggrGroupKeys", oData.group_keys || []);
        if (oData.date_column) { that._set("/stepAggrDateColumn", oData.date_column); }
        if (oData.time_level) { that._set("/stepAggrTimeLevel", oData.time_level); }
        // Előnézet-adatok
        if (oData.preview_before) { that._set("/stepAggrPreviewBefore", oData.preview_before); }
        if (oData.preview_after) { that._set("/stepAggrPreviewAfter", oData.preview_after); }

        // Frissítsük a MultiComboBox-ot
        var oMulti = that.byId("aggrGroupKeysMulti");
        if (oMulti && oData.group_keys) {
          oMulti.setSelectedKeys(oData.group_keys);
        }
      }).catch(function(err) {
        MessageToast.show("Aggregálás AI hiba: " + (err && err.message ? err.message : String(err)));
      }).finally(function() {
        that._set("/stepAggrBusy", false);
      });
    },

    onStepAggrNext: function() {
      if (this._get("/showStepAggr")) {
        if (!this._get("/stepAggrUnit")) {
          MessageToast.show("Add meg az elemzesi egyseget.");
          return;
        }
        if ((this._get("/stepAggrGroupKeys") || []).length === 0) {
          MessageToast.show("Valassz legalabb egy csoportositasi kulcsot.");
          return;
        }
      }
      this._validateStep("wizStepAggr");
      this._goToStep("wizStep2");
      return;
    },

    // ─── STEP 2 HANDLERS ─────────────────────────────────────────────────────

    onStep2InputColumnsChange: function(oEvent) {
      var aSelectedItems = oEvent.getSource().getSelectedItems();
      this._set("/step2InputColumns", aSelectedItems.map(function(item) { return item.getKey(); }));
    },

    onStep2TargetColumnChange: function(oEvent) {
      this._set("/step2TargetColumn", oEvent.getParameter("selectedItem").getKey());
    },

    onFeatureCheckboxChange: function(oEvent) {
      var oCheckbox = oEvent.getSource();
      var oContext = oCheckbox.getBindingContext("discovery");
      if (oContext) {
        this._model().setProperty(oContext.getPath() + "/selected", oCheckbox.getSelected());
      }
    },

    onStep2Next: function() {
      var aInputColumns = this._get("/step2InputColumns");
      var sTargetColumn = this._get("/step2TargetColumn");
      if (!aInputColumns || aInputColumns.length === 0) { MessageToast.show("Válassz legalább egy bemeneti oszlopot."); return; }
      if (!sTargetColumn) { MessageToast.show("Válassz célváltozót."); return; }

      var aAllFeatures = this._get("/step2SelectedFeatures") || [];
      var aSelected = aAllFeatures.filter(function(f) { return f.selected; });
      var sSessionId = this._get("/sessionId");
      var that = this;

      AiService.mlWizardStep2ConfirmFeatures({
        session_id: sSessionId,
        input_columns: aInputColumns,
        target_column: sTargetColumn,
        selected_features: aSelected
      }).then(function(oData) {
        that._set("/step2ReadinessSummary", oData.readiness_summary || "");
        that._validateStep("wizStep2");
        that._goToStep("wizStep3");
      }).catch(function(err) {
        that._set("/wizardError", "Feature megerősítési hiba: " + (err && err.message ? err.message : String(err)));
      });
    },

    // ─── STEP 3 HANDLERS ─────────────────────────────────────────────────────

    onStep3TierSelect: function(oEvent) {
      var oListItem = oEvent.getParameter("listItem");
      var oContext = oListItem.getBindingContext("discovery");
      if (!oContext) { return; }
      var sKey = this._model().getProperty(oContext.getPath() + "/key");
      this._set("/step3ModelTier", sKey);
      var aTiers = this._get("/step3TierOptions");
      aTiers.forEach(function(t) { t.selected = (t.key === sKey); });
      this._set("/step3TierOptions", aTiers);
    },

    onStep3StartTraining: function() {
      var sSessionId = this._get("/sessionId");
      var sTier = this._get("/step3ModelTier");
      var that = this;

      this._set("/step3TrainingStatus", "RUNNING");
      this._set("/step3TrainingProgress", 0);
      this._set("/step3TrainingMessage", "Tréning indítása...");

      AiService.mlWizardStep3StartTraining({
        session_id: sSessionId,
        model_tier: sTier,
        date_column: that._get("/stepAggrDateColumn") || "",
        time_level: that._get("/stepAggrTimeLevel") || "monthly",
        group_by_keys: that._get("/stepAggrGroupKeys") || [],
        forecast_horizon: that._extractForecastHorizon(that._getSelectedGoalText())
      }).then(function(oData) {
        that._set("/step3AiTierExplanation", oData.ai_tier_explanation || "");
        that._set("/step3TrainingJobId", oData.job_id);
        that._startTrainPoll(oData.job_id);
      }).catch(function(err) {
        that._set("/step3TrainingStatus", "ERROR");
        that._set("/step3TrainingMessage", "Hiba: " + (err && err.message ? err.message : String(err)));
        that._set("/wizardError", "Tréning indítási hiba: " + (err && err.message ? err.message : String(err)));
      });
    },

    _startTrainPoll: function(sJobId) {
      var that = this;
      this._clearTimer("train");
      this._trainTimer = setInterval(function() {
        AiService.mlWizardGetJobStatus({ job_id: sJobId }).then(function(oData) {
          that._set("/step3TrainingProgress", oData.progress || 0);
          that._set("/step3TrainingMessage", oData.message || "");

          if (oData.status === "done") {
            clearInterval(that._trainTimer);
            that._trainTimer = null;
            that._set("/step3TrainingStatus", "DONE");
            that._set("/step3TrainingProgress", 100);
            that._set("/step3TrainingMessage", "Tréning kész! Kattints az 'Elfogadás és folytatás' gombra.");
          } else if (oData.status === "error") {
            clearInterval(that._trainTimer);
            that._trainTimer = null;
            that._set("/step3TrainingStatus", "ERROR");
            that._set("/wizardError", "Tréning hiba: " + (oData.message || "Ismeretlen hiba"));
          }
        }).catch(function() {});
      }, POLL_INTERVAL_MS);
    },

    onStep3Next: function() {
      if (this._get("/step3TrainingStatus") !== "DONE") {
        MessageToast.show("Várj a tréning befejezéséig.");
        return;
      }
      this._validateStep("wizStep3");
      this._goToStep("wizStep4");
      this._loadStep4Results();
    },

    // ─── STEP 4 HANDLERS ─────────────────────────────────────────────────────

    onStep4Next: function() {
      this._validateStep("wizStep4");
      this._goToStep("wizStep5");
      this._loadStep5SuggestedInputs();
    },

    _loadStep4Results: function() {
      var sSessionId = this._get("/sessionId");
      var that = this;
      this._set("/step4Busy", true);

      AiService.mlWizardStep4Result({ session_id: sSessionId }).then(function(oData) {
        // Előnézet: előrejelzési sorok ha rendelkezésre állnak (jövőbeli előrejelzés), egyébként teszt sorok
        var aRows = (oData.forecast_rows && oData.forecast_rows.length > 0)
          ? oData.forecast_rows
          : (oData.preview_rows || []);
        that._set("/step4PreviewRows", aRows);
        that._set("/step4Metrics", oData.metrics || {});
        that._set("/step4CsvDownloadUrl", oData.csv_download_url || "");

        // Metrikák lista
        var oMetrics = oData.metrics || {};
        var aMetricItems = [];
        var tierLabels = { fast: "Gyors", balanced: "Kiegyensúlyozott", accurate: "Pontos" };
        if (oMetrics.model_tier) { aMetricItems.push({ key: "Modell szint", value: tierLabels[oMetrics.model_tier] || oMetrics.model_tier }); }
        if (oMetrics.row_count) { aMetricItems.push({ key: "Sorok száma", value: String(oMetrics.row_count) }); }
        if (oMetrics.accuracy) { aMetricItems.push({ key: "Pontosság", value: (oMetrics.accuracy * 100).toFixed(1) + "%" }); }
        if (oMetrics.precision) { aMetricItems.push({ key: "Precizitás", value: (oMetrics.precision * 100).toFixed(1) + "%" }); }
        if (oMetrics.recall) { aMetricItems.push({ key: "Visszahívás", value: (oMetrics.recall * 100).toFixed(1) + "%" }); }
        if (oMetrics.f1) { aMetricItems.push({ key: "F1 pontszám", value: (oMetrics.f1 * 100).toFixed(1) + "%" }); }
        if (oMetrics.target_column) { aMetricItems.push({ key: "Célváltozó", value: oMetrics.target_column }); }
        that._set("/step4MetricsItems", aMetricItems);

        // Jellemző fontosság
        var aFI = oData.feature_importance || [];
        var maxImp = aFI.length > 0 ? Math.max.apply(null, aFI.map(function(f) { return f.importance || 0; })) : 1;
        that._set("/step4FeatureImportance", aFI.map(function(f) {
          return Object.assign({}, f, { importancePct: maxImp > 0 ? Math.round((f.importance / maxImp) * 100) : 0 });
        }));

        // AI insight (Modell értékelése panel)
        that._set("/step4AiInsight", oData.ai_insight || { model_evaluation: "", insights: [], recommendations: [], risks: [] });

        // Előrejelzési előnézet tábla (20 sor)
        that._buildPreviewTable(aRows);

        // Előrejelzés eloszlás chart
        that._buildPredictionDistribution(aRows, oMetrics.target_column);

        // Vezető összefoglaló (cél alapú) – ha a backend visszaadja
        if (oData.executive_summary) {
          that._set("/step4ExecutiveSummary", oData.executive_summary);
        } else {
          // Késleltetett betöltés
          that._loadExecutiveSummary(sSessionId);
        }

        that._set("/step4Busy", false);
      }).catch(function(err) {
        that._set("/step4Busy", false);
        that._set("/wizardError", "Eredmény betöltési hiba: " + (err && err.message ? err.message : String(err)));
      });
    },

    _loadExecutiveSummary: function(sSessionId) {
      var that = this;
      var sSelectedGoal = this._getSelectedGoalText();
      this._set("/step4ExecutiveSummaryBusy", true);
      AiService.mlWizardStep4ExecutiveSummary({
        session_id: sSessionId,
        goal_text: sSelectedGoal
      }).then(function(oData) {
        that._set("/step4ExecutiveSummary", oData.executive_summary || "");
      }).catch(function() {
        // silently ignore – not critical
      }).finally(function() {
        that._set("/step4ExecutiveSummaryBusy", false);
      });
    },

    _buildPreviewTable: function(aRows) {
      if (!aRows || aRows.length === 0) { return; }
      var oTable = this.byId("mlPreviewTable");
      if (!oTable) { return; }

      var aColumns = Object.keys(aRows[0]);
      oTable.destroyColumns();
      oTable.destroyItems();

      aColumns.forEach(function(sCol) {
        oTable.addColumn(new Column({ header: new Text({ text: sCol }) }));
      });

      aRows.forEach(function(oRow) {
        var oCLI = new ColumnListItem();
        aColumns.forEach(function(sCol) {
          oCLI.addCell(new Text({ text: String(oRow[sCol] !== null && oRow[sCol] !== undefined ? oRow[sCol] : "") }));
        });
        oTable.addItem(oCLI);
      });
    },

    _buildPredictionDistribution: function(aRows, sTargetColumn) {
      if (!aRows || aRows.length === 0) { return; }
      // Az előrejelzett oszlop neve: "predicted" vagy a céloszlop neve
      var sPredCol = "predicted";
      if (aRows.length > 0 && !aRows[0].hasOwnProperty("predicted") && sTargetColumn) {
        sPredCol = sTargetColumn;
      }

      var oDistribution = {};
      aRows.forEach(function(r) {
        var sVal = String(r[sPredCol] !== null && r[sPredCol] !== undefined ? r[sPredCol] : "(üres)");
        oDistribution[sVal] = (oDistribution[sVal] || 0) + 1;
      });

      var nTotal = aRows.length;
      var aDistItems = Object.keys(oDistribution).map(function(k) {
        return {
          label: k,
          count: oDistribution[k],
          pct: Math.round((oDistribution[k] / nTotal) * 100)
        };
      }).sort(function(a, b) { return b.count - a.count; });

      this._set("/step4PredictionDistribution", aDistItems);
    },

    onDownloadResultCsv: function() {
      var sUrl = this._get("/step4CsvDownloadUrl");
      if (!sUrl) { MessageToast.show("Nincs letölthető eredmény."); return; }
      var oLink = document.createElement("a");
      oLink.href = sUrl;
      oLink.download = "ml_wizard_result.csv";
      document.body.appendChild(oLink);
      oLink.click();
      document.body.removeChild(oLink);
    },

    _loadStep5SuggestedInputs: function() {
      var sSessionId = this._get("/sessionId");
      if (!sSessionId) { return; }
      var sGoal = this._getSelectedGoalText();
      var aColumns = (this._get("/step1ColumnPreview") || []).map(function(c) { return c.name; });
      var that = this;
      this._set("/step5SuggestedInputsBusy", true);
      this._set("/step5SuggestedInputs", []);
      AiService.mlWizardStep5SuggestedInputs({
        session_id: sSessionId,
        goal_text: sGoal,
        column_names: aColumns,
        date_column: this._get("/stepAggrDateColumn") || "",
        group_by_keys: this._get("/stepAggrGroupKeys") || []
      }).then(function(oData) {
        that._set("/step5SuggestedInputs", oData.suggested_inputs || []);
      }).catch(function() {
        // silently ignore
      }).finally(function() {
        that._set("/step5SuggestedInputsBusy", false);
      });
    },

    // ─── STEP 5 HANDLERS ─────────────────────────────────────────────────────

    onAddSimRow: function() {
      var aColumns = this._get("/step2InputColumns") || [];
      if (aColumns.length === 0) { MessageToast.show("Nincs kiválasztott bemeneti oszlop."); return; }
      var aChanges = this._get("/step5SimulationChanges") || [];
      var sFirstUnused = aColumns.find(function(c) {
        return !aChanges.some(function(ch) { return ch.column === c; });
      }) || aColumns[0];
      aChanges.push({ column: sFirstUnused, new_value: "" });
      this._set("/step5SimulationChanges", aChanges);
    },

    onRemoveSimRow: function(oEvent) {
      var oListItem = oEvent.getSource().getParent();
      var oContext = oListItem.getBindingContext("discovery");
      if (!oContext) { return; }
      var nIdx = parseInt(oContext.getPath().split("/").pop(), 10);
      var aChanges = this._get("/step5SimulationChanges") || [];
      aChanges.splice(nIdx, 1);
      this._set("/step5SimulationChanges", aChanges);
    },

    onStep5RunSimulation: function() {
      var sSessionId = this._get("/sessionId");
      var aChanges = this._get("/step5SimulationChanges") || [];
      var oChangesMap = {};
      aChanges.forEach(function(ch) {
        if (ch.column && ch.new_value !== "") { oChangesMap[ch.column] = ch.new_value; }
      });
      if (Object.keys(oChangesMap).length === 0) { MessageToast.show("Adj meg legalább egy változtatott értéket."); return; }

      this._set("/step5SimBusy", true);
      this._set("/step5AiSimulationContext", "");
      var that = this;

      AiService.mlWizardStep5Simulate({
        session_id: sSessionId,
        simulation_changes: oChangesMap
      }).then(function(oData) {
        that._set("/step5AiSimulationContext", oData.ai_simulation_context || "");
        that._startSimPoll(oData.job_id, sSessionId);
      }).catch(function(err) {
        that._set("/step5SimBusy", false);
        that._set("/wizardError", "Szimuláció indítási hiba: " + (err && err.message ? err.message : String(err)));
      });
    },

    _startSimPoll: function(sJobId, sSessionId) {
      var that = this;
      this._clearTimer("sim");
      this._simTimer = setInterval(function() {
        AiService.mlWizardGetJobStatus({ job_id: sJobId }).then(function(oData) {
          if (oData.status === "done") {
            clearInterval(that._simTimer);
            that._simTimer = null;
            AiService.mlWizardStep5SimulationResult({ session_id: sSessionId }).then(function(oResult) {
              that._set("/step5SimulationResult", oResult);
              that._set("/step5SimBusy", false);
            }).catch(function(err) {
              that._set("/step5SimBusy", false);
              that._set("/wizardError", "Szimuláció eredmény hiba: " + (err && err.message ? err.message : String(err)));
            });
          } else if (oData.status === "error") {
            clearInterval(that._simTimer);
            that._simTimer = null;
            that._set("/step5SimBusy", false);
            that._set("/wizardError", "Szimuláció hiba: " + (oData.message || "Ismeretlen hiba"));
          }
        }).catch(function() {});
      }, POLL_INTERVAL_MS);
    },

    // Időzítés
    onStep5ScheduleToggle: function(oEvent) {
      this._set("/step5ScheduleEnabled", oEvent.getParameter("state"));
    },

    onSaveMlWizardSchedule: function() {
      var that = this;
      var bEnabled = !!this._get("/step5ScheduleEnabled");
      if (!bEnabled) { MessageToast.show("Kapcsold be az időzítést a mentéshez."); return; }

      var sFrequency = this._get("/step5ScheduleFrequency") || "immediate";
      var iWeeklyDay = Number(this._get("/step5ScheduleWeeklyDay") || 1);
      var sTime = String(this._get("/step5ScheduleTime") || "").trim();
      var iScheduleId = Number(this._get("/step5ScheduleId") || 0);
      var sSessionId = this._get("/sessionId");

      if ((sFrequency === "daily" || sFrequency === "weekly") && !/^\d{1,2}:\d{2}$/.test(sTime)) {
        MessageToast.show("Adj meg érvényes időpontot, pl. 09:30."); return;
      }

      var oPayload = {
        jokerId: "ml-wizard",
        enabled: true,
        frequency: sFrequency,
        weeklyDay: sFrequency === "weekly" ? iWeeklyDay : null,
        timeHHMM: (sFrequency === "daily" || sFrequency === "weekly") ? sTime : null,
        config: { session_id: sSessionId }
      };

      var oPromise = iScheduleId > 0
        ? AiService.reportsUpdateSchedule(Object.assign({ id: iScheduleId }, oPayload))
        : AiService.reportsCreateSchedule(oPayload);

      oPromise.then(function(oResp) {
        var oItem = oResp && oResp.item ? oResp.item : {};
        that._set("/step5ScheduleId", Number(oItem.ScheduleId || 0));
        that._set("/step5ScheduleStatusText", "Időzítés mentve! (" + sFrequency + ")");
        that._set("/step5ScheduleError", false);
      }).catch(function(err) {
        that._set("/step5ScheduleStatusText", "Mentési hiba: " + (err && err.message ? err.message : String(err)));
        that._set("/step5ScheduleError", true);
      });
    },

    onClearScheduleStatus: function() {
      this._set("/step5ScheduleStatusText", "");
      this._set("/step5ScheduleError", false);
    },

    // ─── WIZARD NAVIGÁCIÓ ────────────────────────────────────────────────────

    onWizardBack: function() {
      if (!this._stepHistory || this._stepHistory.length <= 1) { return; }
      this._stepHistory.pop(); // aktuális eltávolítása
      var sPrevStep = this._stepHistory[this._stepHistory.length - 1];
      var oWizard = this._getWizard();
      var oStep = this._getStep(sPrevStep);
      if (oWizard && oStep) {
        oWizard.goToStep(oStep, false);
      }
    },

    onResetWizard: function() {
      this._clearAllTimers();
      this._csvFiles = [];
      this._stepHistory = [];

      var oModel = this._model();
      this._resetModelData(oModel);
      oModel.setProperty("/wizardInitDone", true); // ne resetelődjön megint init-re

      var oWizard = this._getWizard();
      if (oWizard) {
        ["wizStep1", "wizStep2", "wizStep3", "wizStepJoin", "wizStepAggr"].forEach(function(sId) {
          var oStep = this._getStep(sId);
          if (oStep) { oStep.setValidated(false); }
        }.bind(this));

        var oStep1 = this._getStep("wizStep1");
        if (oStep1) { oWizard.goToStep(oStep1, false); }
      }

      MessageToast.show("A varázsló visszaállítva.");
    }
  });
});
