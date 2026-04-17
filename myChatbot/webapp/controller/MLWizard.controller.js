sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/m/ColumnListItem",
  "sap/m/Column",
  "sap/m/Text",
  "sap/m/Token",
  "sap/ui/core/Item",
  "sap/suite/ui/commons/demo/tutorial/service/AiService"
], function(Controller, MessageToast, ColumnListItem, Column, Text, Token, CoreItem, AiService) {
  "use strict";

  var POLL_INTERVAL_MS = 1500;

  return Controller.extend("sap.suite.ui.commons.demo.tutorial.controller.MLWizard", {

    onInit: function() {
      this._profileTimer = null;
      this._trainTimer = null;
      this._simTimer = null;

      // Initialize model if not yet set (e.g. on re-entry)
      var oModel = this.getView().getModel("discovery");
      if (oModel && !oModel.getProperty("/wizardInitDone")) {
        this._resetModelData(oModel);
        oModel.setProperty("/wizardInitDone", true);
      }

      // Pre-load DB tables
      this._loadDbTables();
    },

    onExit: function() {
      this._clearAllTimers();
    },

    // ─── HELPERS ────────────────────────────────────────────────────────────────

    _model: function() {
      return this.getView().getModel("discovery");
    },

    _set: function(sPath, vValue) {
      this._model().setProperty(sPath, vValue);
    },

    _get: function(sPath) {
      return this._model().getProperty(sPath);
    },

    _clearAllTimers: function() {
      if (this._profileTimer) { clearInterval(this._profileTimer); this._profileTimer = null; }
      if (this._trainTimer) { clearInterval(this._trainTimer); this._trainTimer = null; }
      if (this._simTimer) { clearInterval(this._simTimer); this._simTimer = null; }
    },

    _resetModelData: function(oModel) {
      oModel.setData(Object.assign(oModel.getData(), {
        wizardError: "",
        sessionId: "",
        // Step 1
        step1Goal: "prediction",
        step1GoalHint: "Folyamatos értéket (pl. bevétel, mennyiség) jósolj meg.",
        step1SourceType: "csv",
        step1SelectedTable: "",
        step1AvailableTables: [],
        step1CsvFileName: "",
        step1ColumnPreview: [],
        step1RowCountEstimate: 0,
        step1AiGoalSuggestions: [],
        step1EarlyFeatureHints: [],
        step1AiBusy: false,
        step1Busy: false,
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
          {
            key: "fast",
            title: "Gyors",
            description: "Azonnali eredmény, egyszerűbb modell. Kisebb adathalmazhoz vagy gyors teszteléshez.",
            icon: "sap-icon://accelerated",
            color: "#e78c07",
            selected: false
          },
          {
            key: "balanced",
            title: "Kiegyensúlyozott",
            description: "Jó arány a pontosság és a futási idő között. Legtöbb esetben ez az ajánlott.",
            icon: "sap-icon://compare",
            color: "#0854a0",
            selected: true
          },
          {
            key: "accurate",
            title: "Pontos",
            description: "Maximális pontosság, hosszabb futási idő. Nagy adathalmazhoz és kritikus döntésekhez.",
            icon: "sap-icon://quality-issue",
            color: "#107e3e",
            selected: false
          }
        ],
        // Step 4
        step4PreviewRows: [],
        step4Metrics: null,
        step4MetricsItems: [],
        step4FeatureImportance: [],
        step4AiInsight: { executive_summary: "", insights: [], recommendations: [], risks: [] },
        step4CsvDownloadUrl: "",
        step4Busy: false,
        // Step 5
        step5SimulationChanges: [],
        step5SimulationResult: null,
        step5AiSimulationContext: "",
        step5SimBusy: false
      }));
    },

    _loadDbTables: function() {
      var that = this;
      AiService.mlWizardGetDbTables().then(function(oData) {
        that._set("/step1AvailableTables", oData.tables || []);
      }).catch(function() {
        // silently ignore – DB tables may not be available
      });
    },

    _getWizard: function() {
      return this.byId("mlWizard");
    },

    _getStep: function(sId) {
      return this.byId(sId);
    },

    _goToStep: function(sStepId) {
      var oWizard = this._getWizard();
      var oStep = this._getStep(sStepId);
      if (oWizard && oStep) {
        oWizard.goToStep(oStep, false);
      }
    },

    _validateStep: function(sStepId) {
      var oStep = this._getStep(sStepId);
      if (oStep) {
        oStep.setValidated(true);
      }
    },

    onClearError: function() {
      this._set("/wizardError", "");
    },

    // ─── STEP 1 HANDLERS ─────────────────────────────────────────────────────

    onStep1GoalChange: function(oEvent) {
      var sKey = oEvent.getParameter("key");
      this._set("/step1Goal", sKey);
      var hints = {
        prediction: "Folyamatos értéket (pl. bevétel, mennyiség) jósolj meg.",
        classification: "Kategóriába sorold az adatokat (pl. lemorzsolódik / nem, magas / alacsony kockázat).",
        optimization: "Optimális döntést vagy elosztást javasolj (pl. készlet, erőforrás, ütemezés)."
      };
      this._set("/step1GoalHint", hints[sKey] || "");
    },

    onStep1SourceTypeChange: function(oEvent) {
      var sKey = oEvent.getParameter("selectedKey") || oEvent.getParameter("key");
      this._set("/step1SourceType", sKey);
      this._set("/step1ColumnPreview", []);
      this._set("/step1RowCountEstimate", 0);
      this._set("/sessionId", "");
    },

    onStep1CsvSelected: function(oEvent) {
      var oFileUploader = oEvent.getSource();
      var oFiles = oFileUploader.oFileUpload && oFileUploader.oFileUpload.files;
      if (!oFiles || oFiles.length === 0) { return; }
      this._csvFile = oFiles[0];
      this._set("/step1CsvFileName", this._csvFile.name);
      MessageToast.show("CSV fájl kiválasztva: " + this._csvFile.name);
    },

    onStep1TableSelected: function(oEvent) {
      var sTable = oEvent.getParameter("selectedItem").getKey();
      this._set("/step1SelectedTable", sTable);
    },

    onStep1LoadAiSuggestions: function() {
      var sSessionId = this._get("/sessionId");
      if (!sSessionId) {
        MessageToast.show("Előbb töltsd fel az adatot (kattints a Tovább gombra).");
        return;
      }
      this._set("/step1AiBusy", true);
      var that = this;
      AiService.mlWizardStep1AiSuggestions({ session_id: sSessionId }).then(function(oData) {
        that._set("/step1AiGoalSuggestions", oData.goal_suggestions || []);
        that._set("/step1EarlyFeatureHints", oData.early_feature_hints || []);
      }).catch(function(err) {
        MessageToast.show("AI javaslat hiba: " + (err && err.message ? err.message : String(err)));
      }).finally(function() {
        that._set("/step1AiBusy", false);
      });
    },

    onStep1Next: function() {
      var sGoal = this._get("/step1Goal");
      var sSourceType = this._get("/step1SourceType");

      if (!sGoal) {
        MessageToast.show("Válassz ML célt a folytatáshoz.");
        return;
      }
      if (sSourceType === "csv" && !this._csvFile) {
        MessageToast.show("Tölts fel egy CSV fájlt a folytatáshoz.");
        return;
      }
      if (sSourceType === "db_table" && !this._get("/step1SelectedTable")) {
        MessageToast.show("Válassz adatbázis táblát a folytatáshoz.");
        return;
      }

      this._set("/step1Busy", true);
      this._set("/wizardError", "");
      var that = this;

      this._initSessionAndProfile().then(function() {
        that._validateStep("wizStep1");
        that._getWizard().nextStep();
        that._set("/step1Busy", false);
      }).catch(function(err) {
        that._set("/wizardError", "Inicializálási hiba: " + (err && err.message ? err.message : String(err)));
        that._set("/step1Busy", false);
      });
    },

    _initSessionAndProfile: function() {
      var that = this;
      var sSourceType = this._get("/step1SourceType");
      var sGoal = this._get("/step1Goal");

      return AiService.mlWizardInit({
        goal: sGoal,
        source_type: sSourceType,
        table_name: sSourceType === "db_table" ? this._get("/step1SelectedTable") : "",
        csv_file: sSourceType === "csv" ? this._csvFile : null
      }).then(function(oData) {
        that._set("/sessionId", oData.session_id);
        that._set("/step1ColumnPreview", oData.columns || []);
        that._set("/step1RowCountEstimate", oData.row_count_estimate || 0);

        // Start profile job
        return AiService.mlWizardStep2Profile({ session_id: oData.session_id });
      }).then(function(oJobData) {
        // Profile job started – set up Step 2 loading state
        that._set("/step2Busy", true);
        // Start polling but don't block the wizard navigation
        that._startProfilePoll(oJobData.job_id);
      });
    },

    _startProfilePoll: function(sJobId) {
      var that = this;
      that._clearTimer("profile");
      that._profileTimer = setInterval(function() {
        AiService.mlWizardGetJobStatus({ job_id: sJobId }).then(function(oData) {
          if (oData.status === "done") {
            clearInterval(that._profileTimer);
            that._profileTimer = null;
            that._loadProfileResult();
          } else if (oData.status === "error") {
            clearInterval(that._profileTimer);
            that._profileTimer = null;
            that._set("/step2Busy", false);
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

    _loadProfileResult: function() {
      var sSessionId = this._get("/sessionId");
      var that = this;
      AiService.mlWizardStep2ProfileResult({ session_id: sSessionId }).then(function(oData) {
        var oProfile = oData.profile || {};
        that._set("/step2Profile", oProfile);
        that._set("/step2QualityIssues", oProfile.quality_issues || []);
        that._set("/step2QualitySummary", oData.quality_summary || "");

        // Build column items for multiselect
        var aColumns = (oProfile.columns || []).map(function(c) {
          return { key: c.name, text: c.name + " (" + c.dtype + ")" };
        });
        that._set("/step2AvailableColumnItems", aColumns);

        // Build AI feature suggestions list (with selected: true by default for ready ones)
        var aSuggestions = (oData.ai_feature_suggestions || []).map(function(f) {
          return Object.assign({}, f, { selected: f.readiness === "ready" });
        });
        that._set("/step2AiFeatureSuggestions", aSuggestions);
        that._set("/step2SelectedFeatures", aSuggestions);
        that._set("/step2Busy", false);
      }).catch(function(err) {
        that._set("/step2Busy", false);
        that._set("/wizardError", "Profil betöltési hiba: " + (err && err.message ? err.message : String(err)));
      });
    },

    // ─── STEP 2 HANDLERS ─────────────────────────────────────────────────────

    onStep2InputColumnsChange: function(oEvent) {
      var aSelectedItems = oEvent.getSource().getSelectedItems();
      var aKeys = aSelectedItems.map(function(item) { return item.getKey(); });
      this._set("/step2InputColumns", aKeys);
    },

    onStep2TargetColumnChange: function(oEvent) {
      var sKey = oEvent.getParameter("selectedItem").getKey();
      this._set("/step2TargetColumn", sKey);
    },

    onFeatureCheckboxChange: function(oEvent) {
      var oCheckbox = oEvent.getSource();
      var oContext = oCheckbox.getBindingContext("discovery");
      if (oContext) {
        var sPath = oContext.getPath();
        this._model().setProperty(sPath + "/selected", oCheckbox.getSelected());
      }
    },

    onStep2Next: function() {
      var aInputColumns = this._get("/step2InputColumns");
      var sTargetColumn = this._get("/step2TargetColumn");

      if (!aInputColumns || aInputColumns.length === 0) {
        MessageToast.show("Válassz legalább egy bemeneti oszlopot.");
        return;
      }
      if (!sTargetColumn) {
        MessageToast.show("Válassz célváltozót.");
        return;
      }

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
        that._getWizard().nextStep();
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

      // Update selected flags
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
        model_tier: sTier
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
      that._clearTimer("train");
      that._trainTimer = setInterval(function() {
        AiService.mlWizardGetJobStatus({ job_id: sJobId }).then(function(oData) {
          that._set("/step3TrainingProgress", oData.progress || 0);
          that._set("/step3TrainingMessage", oData.message || "");

          if (oData.status === "done") {
            clearInterval(that._trainTimer);
            that._trainTimer = null;
            that._set("/step3TrainingStatus", "DONE");
            that._set("/step3TrainingProgress", 100);
            that._validateStep("wizStep3");
            that._getWizard().nextStep();
            // Immediately load results
            that._loadStep4Results();
          } else if (oData.status === "error") {
            clearInterval(that._trainTimer);
            that._trainTimer = null;
            that._set("/step3TrainingStatus", "ERROR");
            that._set("/wizardError", "Tréning hiba: " + (oData.message || "Ismeretlen hiba"));
          }
        }).catch(function() {});
      }, POLL_INTERVAL_MS);
    },

    // ─── STEP 4 HANDLERS ─────────────────────────────────────────────────────

    onStep4Next: function() {
      this._validateStep("wizStep4");
      this._getWizard().nextStep();
    },

    _loadStep4Results: function() {
      var sSessionId = this._get("/sessionId");
      var that = this;
      this._set("/step4Busy", true);

      AiService.mlWizardStep4Result({ session_id: sSessionId }).then(function(oData) {
        that._set("/step4PreviewRows", oData.preview_rows || []);
        that._set("/step4Metrics", oData.metrics || {});
        that._set("/step4CsvDownloadUrl", oData.csv_download_url || "");

        // Build metrics items for list binding
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

        // Feature importance with normalized percentage
        var aFI = oData.feature_importance || [];
        var maxImp = aFI.length > 0 ? Math.max.apply(null, aFI.map(function(f) { return f.importance || 0; })) : 1;
        var aFIWithPct = aFI.map(function(f) {
          return Object.assign({}, f, {
            importancePct: maxImp > 0 ? Math.round((f.importance / maxImp) * 100) : 0
          });
        });
        that._set("/step4FeatureImportance", aFIWithPct);

        // AI insight
        that._set("/step4AiInsight", oData.ai_insight || { executive_summary: "", insights: [], recommendations: [], risks: [] });

        // Build preview table dynamically
        that._buildPreviewTable(oData.preview_rows || []);
        that._set("/step4Busy", false);
      }).catch(function(err) {
        that._set("/step4Busy", false);
        that._set("/wizardError", "Eredmény betöltési hiba: " + (err && err.message ? err.message : String(err)));
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

    onDownloadResultCsv: function() {
      var sUrl = this._get("/step4CsvDownloadUrl");
      if (!sUrl) {
        MessageToast.show("Nincs letölthető eredmény.");
        return;
      }
      var oLink = document.createElement("a");
      oLink.href = sUrl;
      oLink.download = "ml_wizard_result.csv";
      document.body.appendChild(oLink);
      oLink.click();
      document.body.removeChild(oLink);
    },

    // ─── STEP 5 HANDLERS ─────────────────────────────────────────────────────

    onAddSimRow: function() {
      // Show a simple select dialog to pick a column
      var aColumns = this._get("/step2InputColumns") || [];
      if (aColumns.length === 0) {
        MessageToast.show("Nincs kiválasztott bemeneti oszlop.");
        return;
      }

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
      var sPath = oContext.getPath();
      var nIdx = parseInt(sPath.split("/").pop(), 10);
      var aChanges = this._get("/step5SimulationChanges") || [];
      aChanges.splice(nIdx, 1);
      this._set("/step5SimulationChanges", aChanges);
    },

    onStep5RunSimulation: function() {
      var sSessionId = this._get("/sessionId");
      var aChanges = this._get("/step5SimulationChanges") || [];

      var oChangesMap = {};
      aChanges.forEach(function(ch) {
        if (ch.column && ch.new_value !== "") {
          oChangesMap[ch.column] = ch.new_value;
        }
      });

      if (Object.keys(oChangesMap).length === 0) {
        MessageToast.show("Adj meg legalább egy változtatott értéket.");
        return;
      }

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
      that._clearTimer("sim");
      that._simTimer = setInterval(function() {
        AiService.mlWizardGetJobStatus({ job_id: sJobId }).then(function(oData) {
          if (oData.status === "done") {
            clearInterval(that._simTimer);
            that._simTimer = null;
            // Load sim result
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

    // ─── WIZARD NAV ─────────────────────────────────────────────────────────

    onWizardBack: function() {
      var oWizard = this._getWizard();
      if (oWizard) {
        oWizard.previousStep();
      }
    },

    onResetWizard: function() {
      this._clearAllTimers();
      this._csvFile = null;
      var oModel = this._model();
      this._resetModelData(oModel);

      var oWizard = this._getWizard();
      if (oWizard) {
        // Reset all steps to unvalidated
        ["wizStep1", "wizStep2", "wizStep3"].forEach(function(sId) {
          var oStep = this._getStep(sId);
          if (oStep) { oStep.setValidated(false); }
        }.bind(this));

        // Navigate back to step 1
        var oStep1 = this._getStep("wizStep1");
        if (oStep1) {
          oWizard.goToStep(oStep1, false);
        }
      }

      MessageToast.show("A varázsló visszaállítva.");
    }
  });
});
