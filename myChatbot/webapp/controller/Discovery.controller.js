sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/suite/ui/commons/demo/tutorial/service/AiService",
  "sap/m/Column",
  "sap/m/Text",
  "sap/m/ColumnListItem"
], function(Controller, MessageToast, AiService, Column, Text, ColumnListItem) {
  "use strict";

  return Controller.extend("sap.suite.ui.commons.demo.tutorial.controller.Discovery", {
    onInit: function() {
      var oRouter = this.getOwnerComponent().getRouter();
      this._statusTimer = null;

      oRouter.getRoute("discoveryHome").attachPatternMatched(this._onDiscoveryHomeMatched, this);
      oRouter.getRoute("discoveryStart").attachPatternMatched(this._onDiscoveryStartMatched, this);
      oRouter.getRoute("discoveryBusiness").attachPatternMatched(this._onDiscoveryBusinessMatched, this);
      oRouter.getRoute("discoveryAutoml").attachPatternMatched(this._onDiscoveryAutomlMatched, this);
      oRouter.getRoute("mainMenu").attachPatternMatched(this._onLegacyMainMenuMatched, this);
    },

    onExit: function() {
      this._clearStatusTimer();
    },

    onOpenDiscoveryAutoml: function() {
      this.getOwnerComponent().getRouter().navTo("discoveryAutoml");
    },

    onOpenDiscoveryStart: function() {
      this.getOwnerComponent().getRouter().navTo("discoveryStart");
    },

    onOpenDiscoveryBusiness: function() {
      this.getOwnerComponent().getRouter().navTo("discoveryBusiness");
    },

    onBackToDiscoveryHome: function() {
      this.getOwnerComponent().getRouter().navTo("discoveryHome");
    },

    onContactAutoml: function() {
      MessageToast.show("Keres rogzitve");
    },

    onStartDiscovery: async function() {
      var oModel = this.getView().getModel("discovery");
      oModel.setProperty("/busy", true);
      oModel.setProperty("/error", "");
      oModel.setProperty("/suggestions", []);

      try {
        var oResult = await AiService.runDiscovery();
        oModel.setProperty("/schemaTables", oResult.tables || []);
        oModel.setProperty("/promptPreview", oResult.prompt || "");
        oModel.setProperty("/suggestions", oResult.suggestions || []);
        this._resetMlFlow();
      } catch (oError) {
        var sMessage = this._extractError(oError, "Felfedezesi hiba tortent.");
        oModel.setProperty("/error", sMessage);
        MessageToast.show(sMessage);
      } finally {
        oModel.setProperty("/busy", false);
      }
    },

    onStartMlModel: async function(oEvent) {
      var oContext = oEvent.getSource().getBindingContext("discovery");
      var oSuggestion = oContext ? oContext.getObject() : null;
      if (!oSuggestion) {
        return;
      }
      await this._startMlModelForSuggestion(oSuggestion);
    },

    onSubmitSpecAnswer: async function() {
      var oModel = this.getView().getModel("discovery");
      var sSessionId = String(oModel.getProperty("/specSessionId") || "").trim();
      var sAnswer = String(oModel.getProperty("/specAnswerDraft") || "").trim();

      if (!sSessionId || !sAnswer) {
        return;
      }

      this._pushChatMessage("user", sAnswer);
      oModel.setProperty("/specAnswerDraft", "");
      oModel.setProperty("/specBusy", true);
      oModel.setProperty("/error", "");

      try {
        var oResp = await AiService.discoverySpecChatAnswer({
          session_id: sSessionId,
          answer: sAnswer
        });

        if (oResp && oResp.done) {
          oModel.setProperty("/specDone", true);
          this._pushChatMessage("assistant", "Koszonom, osszeallitom a trening specifikaciot es inditom a treninget.");
          await this._generateSpecAndStartTraining();
          return;
        }

        if (oResp && oResp.question) {
          oModel.setProperty("/specStep", Number(oResp.step || 1));
          oModel.setProperty("/specMaxSteps", Number(oResp.max_steps || 5));
          this._pushChatMessage("assistant", String(oResp.question));
        }
      } catch (oError) {
        var sMessage = this._extractError(oError, "Specifikacios valasz feldolgozasi hiba.");
        oModel.setProperty("/error", sMessage);
        oModel.setProperty("/trainingStatus", "ERROR");
        MessageToast.show(sMessage);
      } finally {
        oModel.setProperty("/specBusy", false);
      }
    },

    onRetrySpecGeneration: async function() {
      await this._generateSpecAndStartTraining();
    },

    onDownloadTrainingCsv: function() {
      var oModel = this.getView().getModel("discovery");
      var sUrl = String(oModel.getProperty("/csvDownloadUrl") || "").trim();
      if (!sUrl) {
        MessageToast.show("CSV link nem elerheto.");
        return;
      }
      window.open(sUrl, "_blank");
    },

    onResetMlFlow: function() {
      this._clearStatusTimer();
      this._resetMlFlow();
    },

    onBusinessCsvChange: async function(oEvent) {
      var oModel = this.getView().getModel("discovery");
      var aFiles = oEvent && oEvent.getParameter ? Array.prototype.slice.call(oEvent.getParameter("files") || []) : [];

      if (aFiles.length === 0) {
        return;
      }

      oModel.setProperty("/businessBusy", true);
      oModel.setProperty("/businessError", "");

      try {
        var oResp = await AiService.discoveryBusinessUploadCsv(aFiles);
        var aCurrent = oModel.getProperty("/businessCsvFiles") || [];
        var aMerged = aCurrent.concat(oResp && oResp.files ? oResp.files : []);
        oModel.setProperty("/businessCsvFiles", this._dedupeBusinessCsvFiles(aMerged));

        if (oResp && oResp.message) {
          this._pushBusinessChatMessage("assistant", oResp.message);
        }
      } catch (oError) {
        var sMessage = this._extractError(oError, "CSV feltoltesi hiba.");
        oModel.setProperty("/businessError", sMessage);
        MessageToast.show(sMessage);
      } finally {
        oModel.setProperty("/businessBusy", false);
      }
    },

    onRemoveBusinessCsv: function(oEvent) {
      var oCtx = oEvent.getSource().getBindingContext("discovery");
      if (!oCtx) {
        return;
      }

      var oModel = this.getView().getModel("discovery");
      var aFiles = oModel.getProperty("/businessCsvFiles") || [];
      var iIndex = parseInt(String(oCtx.getPath()).split("/").pop(), 10);
      if (!isFinite(iIndex) || iIndex < 0 || iIndex >= aFiles.length) {
        return;
      }

      aFiles.splice(iIndex, 1);
      oModel.setProperty("/businessCsvFiles", aFiles);
    },

    onSendBusinessMessage: async function() {
      var oModel = this.getView().getModel("discovery");
      var sMessage = String(oModel.getProperty("/businessDraft") || "").trim();

      if (!sMessage) {
        return;
      }

      oModel.setProperty("/businessBusy", true);
      oModel.setProperty("/businessError", "");
      this._pushBusinessChatMessage("user", sMessage);
      oModel.setProperty("/businessDraft", "");

      try {
        var oResp = await AiService.discoveryBusinessChat({
          message: sMessage,
          history: this._buildBusinessHistoryPayload(),
          csv_files: oModel.getProperty("/businessCsvFiles") || []
        });

        this._pushBusinessChatMessage("assistant", String(oResp && oResp.message ? oResp.message : "Nincs valasz."));
        if (oResp && oResp.suggested_use_case) {
          oModel.setProperty("/businessSuggestedUseCase", oResp.suggested_use_case);
          this._upsertSuggestionFromBusiness(oResp.suggested_use_case);
        }
      } catch (oError) {
        var sErr = this._extractError(oError, "Uzleti chatbot hiba.");
        oModel.setProperty("/businessError", sErr);
        MessageToast.show(sErr);
      } finally {
        oModel.setProperty("/businessBusy", false);
      }
    },

    onStartTrainingFromBusiness: function() {
      var oModel = this.getView().getModel("discovery");
      if (!oModel.getProperty("/businessSuggestedUseCase")) {
        MessageToast.show("Elobb keszuljon trening javaslat.");
        return;
      }
      oModel.setProperty("/businessAutoStartPending", true);
      this.getOwnerComponent().getRouter().navTo("discoveryStart");
    },

    _onLegacyMainMenuMatched: function(oEvent) {
      var sKey = String(oEvent.getParameter("arguments").menuKey || "");
      if (sKey === "discovery") {
        this._setCurrentPage("selector");
      }
    },

    _onDiscoveryHomeMatched: function() {
      this._setCurrentPage("selector");
    },

    _onDiscoveryAutomlMatched: function() {
      this._setCurrentPage("automl");
    },

    _onDiscoveryBusinessMatched: function() {
      this._setCurrentPage("business");
      this._ensureBusinessContext();
    },

    _onDiscoveryStartMatched: async function() {
      var oModel = this.getView().getModel("discovery");
      this._setCurrentPage("start");

      if (oModel.getProperty("/businessAutoStartPending") && oModel.getProperty("/businessSuggestedUseCase")) {
        oModel.setProperty("/businessAutoStartPending", false);
        await this._startMlModelForSuggestion(oModel.getProperty("/businessSuggestedUseCase"));
      }
    },

    _setCurrentPage: function(sPage) {
      var oModel = this.getView().getModel("discovery");
      oModel.setProperty("/currentPage", sPage);
    },

    _ensureBusinessContext: async function() {
      var oModel = this.getView().getModel("discovery");
      if ((oModel.getProperty("/businessChatMessages") || []).length === 0) {
        this._pushBusinessChatMessage(
          "assistant",
          "Ird le az uzleti problemat. Figyelembe veszem az elerheto SQL semat, es javaslok egy ML training koncepciot. Ha nem eleg az adat, CSV feltoltest fogok javasolni."
        );
      }

      if ((oModel.getProperty("/businessSchemaTables") || []).length > 0) {
        return;
      }

      try {
        var oResp = await AiService.discoveryGetSchema();
        oModel.setProperty("/businessSchemaTables", oResp && oResp.tables ? oResp.tables : []);
      } catch (oError) {
        oModel.setProperty("/businessError", this._extractError(oError, "Schema lekeresi hiba."));
      }
    },

    _startMlModelForSuggestion: async function(oSuggestion) {
      var oModel = this.getView().getModel("discovery");
      if (!oSuggestion) {
        return;
      }

      this._clearStatusTimer();
      this._resetMlFlow();
      oModel.setProperty("/activeUseCase", oSuggestion);
      oModel.setProperty("/specBusy", true);
      oModel.setProperty("/error", "");

      try {
        var oStart = await AiService.discoverySpecChatStart({
          use_case: oSuggestion
        });

        var sQuestion = String(oStart && oStart.question ? oStart.question : "").trim();
        oModel.setProperty("/specSessionId", oStart && oStart.session_id ? oStart.session_id : "");
        oModel.setProperty("/specStep", Number(oStart && oStart.step ? oStart.step : 1));
        oModel.setProperty("/specMaxSteps", Number(oStart && oStart.max_steps ? oStart.max_steps : 5));
        oModel.setProperty("/specDone", false);
        oModel.setProperty("/trainingStatus", "SPEC_CHAT");
        oModel.setProperty("/trainingMessage", "Uzleti pontositas: valaszolj a kerdesekre.");

        if (sQuestion) {
          oModel.setProperty("/specChatMessages", [{ role: "assistant", content: sQuestion }]);
        } else {
          oModel.setProperty("/specChatMessages", []);
        }
      } catch (oError) {
        var sMessage = this._extractError(oError, "Nem sikerult elinditani a specifikacios chatbotot.");
        oModel.setProperty("/error", sMessage);
        oModel.setProperty("/trainingStatus", "ERROR");
        MessageToast.show(sMessage);
      } finally {
        oModel.setProperty("/specBusy", false);
      }
    },

    _generateSpecAndStartTraining: async function() {
      var oModel = this.getView().getModel("discovery");
      var sSessionId = String(oModel.getProperty("/specSessionId") || "").trim();
      if (!sSessionId) {
        return;
      }

      oModel.setProperty("/trainingStatus", "SPEC_GENERATING");
      oModel.setProperty("/trainingMessage", "Training specifikacio generalasa...");
      oModel.setProperty("/error", "");

      try {
        var oSpecResp = await AiService.discoveryGenerateTrainingSpec({
          session_id: sSessionId
        });
        oModel.setProperty("/trainingSpecYaml", String(oSpecResp && oSpecResp.training_spec_yaml ? oSpecResp.training_spec_yaml : ""));

        oModel.setProperty("/trainingStatus", "TRAINING_STARTING");
        oModel.setProperty("/trainingMessage", "Training inditasa...");

        var oStartResp = await AiService.discoveryStartTraining({
          session_id: sSessionId
        });
        var sJobId = String(oStartResp && oStartResp.job_id ? oStartResp.job_id : "").trim();
        if (!sJobId) {
          throw new Error("A training job azonosito hianyzik.");
        }

        oModel.setProperty("/trainingJobId", sJobId);
        oModel.setProperty("/trainingStatus", "TRAINING_RUNNING");
        oModel.setProperty("/trainingProgress", 0);
        oModel.setProperty("/trainingMessage", "Training folyamatban...");
        this._startStatusPolling(sJobId);
      } catch (oError) {
        var sMessage = this._extractError(oError, "Training specifikacio/inditas hiba.");
        oModel.setProperty("/error", sMessage);
        oModel.setProperty("/trainingStatus", "ERROR");
        MessageToast.show(sMessage);
      }
    },

    _startStatusPolling: function(sJobId) {
      var that = this;
      var oModel = this.getView().getModel("discovery");

      this._clearStatusTimer();

      var fnPoll = async function() {
        try {
          var oStatus = await AiService.discoveryGetTrainingStatus({
            job_id: sJobId
          });

          oModel.setProperty("/trainingStatus", String(oStatus.status || "running").toUpperCase());
          oModel.setProperty("/trainingProgress", Number(oStatus.progress || 0));
          oModel.setProperty("/trainingMessage", String(oStatus.message || "Training folyamatban..."));

          if (oStatus.status === "done") {
            that._clearStatusTimer();
            await that._loadTrainingResult(sJobId);
            return;
          }

          if (oStatus.status === "error") {
            that._clearStatusTimer();
            oModel.setProperty("/trainingStatus", "ERROR");
            oModel.setProperty("/error", String(oStatus.message || "Training hiba."));
            return;
          }
        } catch (oError) {
          that._clearStatusTimer();
          var sMessage = that._extractError(oError, "Training status hiba.");
          oModel.setProperty("/error", sMessage);
          oModel.setProperty("/trainingStatus", "ERROR");
          MessageToast.show(sMessage);
          return;
        }

        that._statusTimer = setTimeout(fnPoll, 1500);
      };

      this._statusTimer = setTimeout(fnPoll, 500);
    },

    _loadTrainingResult: async function(sJobId) {
      var oModel = this.getView().getModel("discovery");
      try {
        var oResp = await AiService.discoveryGetTrainingResult({
          job_id: sJobId
        });

        var aRows = Array.isArray(oResp && oResp.preview_rows) ? oResp.preview_rows.slice(0, 50) : [];
        var aColumns = this._extractColumns(aRows);

        oModel.setProperty("/resultPreviewRows", aRows);
        oModel.setProperty("/resultColumns", aColumns);
        oModel.setProperty("/metricsItems", this._mapMetricsItems(oResp && oResp.metrics ? oResp.metrics : {}));
        oModel.setProperty("/businessSummary", String(oResp && oResp.business_summary ? oResp.business_summary : ""));
        oModel.setProperty("/csvDownloadUrl", String(oResp && oResp.csv_download_url ? oResp.csv_download_url : ""));

        if (oResp && oResp.training_spec_yaml) {
          oModel.setProperty("/trainingSpecYaml", String(oResp.training_spec_yaml));
        }

        oModel.setProperty("/trainingStatus", "RESULT_READY");
        oModel.setProperty("/trainingMessage", "Training befejezve.");
        this._rebindResultPreviewTable();
      } catch (oError) {
        var sMessage = this._extractError(oError, "Training eredmeny lekeresi hiba.");
        oModel.setProperty("/error", sMessage);
        oModel.setProperty("/trainingStatus", "ERROR");
        MessageToast.show(sMessage);
      }
    },

    _rebindResultPreviewTable: function() {
      var oTable = this.byId("discoveryPreviewTable");
      var oModel = this.getView().getModel("discovery");
      var aRows = oModel.getProperty("/resultPreviewRows") || [];
      var aColumns = oModel.getProperty("/resultColumns") || [];

      if (!oTable) {
        return;
      }

      oTable.unbindItems();
      oTable.removeAllColumns();

      if (aRows.length === 0 || aColumns.length === 0) {
        return;
      }

      aColumns.forEach(function(sName) {
        oTable.addColumn(new Column({
          header: new Text({ text: sName })
        }));
      });

      var aCells = aColumns.map(function(sName) {
        return new Text({
          text: "{discovery>" + sName + "}",
          wrapping: true
        });
      });

      oTable.bindItems({
        path: "discovery>/resultPreviewRows",
        template: new ColumnListItem({
          cells: aCells
        }),
        templateShareable: false
      });
    },

    _mapMetricsItems: function(oMetrics) {
      var aItems = [];
      var oData = oMetrics && typeof oMetrics === "object" ? oMetrics : {};
      Object.keys(oData).forEach(function(sKey) {
        var v = oData[sKey];
        aItems.push({
          key: sKey,
          value: typeof v === "object" ? JSON.stringify(v) : String(v)
        });
      });
      return aItems;
    },

    _extractColumns: function(aRows) {
      var mSeen = {};
      var aCols = [];
      (aRows || []).forEach(function(oRow) {
        Object.keys(oRow || {}).forEach(function(sKey) {
          if (mSeen[sKey]) {
            return;
          }
          mSeen[sKey] = true;
          aCols.push(sKey);
        });
      });
      return aCols;
    },

    _pushChatMessage: function(sRole, sContent) {
      var oModel = this.getView().getModel("discovery");
      var aMessages = oModel.getProperty("/specChatMessages") || [];
      aMessages.push({
        role: sRole,
        content: String(sContent || "")
      });
      oModel.setProperty("/specChatMessages", aMessages);
    },

    _pushBusinessChatMessage: function(sRole, sContent) {
      var oModel = this.getView().getModel("discovery");
      var aMessages = oModel.getProperty("/businessChatMessages") || [];
      aMessages.push({
        role: sRole,
        content: String(sContent || "")
      });
      oModel.setProperty("/businessChatMessages", aMessages);
    },

    _buildBusinessHistoryPayload: function() {
      var oModel = this.getView().getModel("discovery");
      return (oModel.getProperty("/businessChatMessages") || []).map(function(item) {
        return {
          role: item.role,
          content: item.content
        };
      });
    },

    _dedupeBusinessCsvFiles: function(aFiles) {
      var mSeen = {};
      return (aFiles || []).filter(function(item) {
        var sKey = [
          String(item && item.name ? item.name : ""),
          Number(item && item.row_count ? item.row_count : 0),
          Array.isArray(item && item.columns) ? item.columns.join("|") : ""
        ].join("|");
        if (!sKey || mSeen[sKey]) {
          return false;
        }
        mSeen[sKey] = true;
        return true;
      });
    },

    _upsertSuggestionFromBusiness: function(oSuggestion) {
      var oModel = this.getView().getModel("discovery");
      var aSuggestions = oModel.getProperty("/suggestions") || [];
      var sTitle = String(oSuggestion && oSuggestion.title ? oSuggestion.title : "");
      var aFiltered = aSuggestions.filter(function(item) {
        return String(item && item.title ? item.title : "") !== sTitle;
      });
      aFiltered.unshift(oSuggestion);
      oModel.setProperty("/suggestions", aFiltered.slice(0, 7));
    },

    _resetMlFlow: function() {
      var oModel = this.getView().getModel("discovery");
      oModel.setProperty("/activeUseCase", null);
      oModel.setProperty("/specSessionId", "");
      oModel.setProperty("/specChatMessages", []);
      oModel.setProperty("/specAnswerDraft", "");
      oModel.setProperty("/specStep", 0);
      oModel.setProperty("/specMaxSteps", 0);
      oModel.setProperty("/specDone", false);
      oModel.setProperty("/specBusy", false);
      oModel.setProperty("/trainingSpecYaml", "");
      oModel.setProperty("/trainingStatus", "IDLE");
      oModel.setProperty("/trainingProgress", 0);
      oModel.setProperty("/trainingMessage", "");
      oModel.setProperty("/trainingJobId", "");
      oModel.setProperty("/resultPreviewRows", []);
      oModel.setProperty("/resultColumns", []);
      oModel.setProperty("/metricsItems", []);
      oModel.setProperty("/businessSummary", "");
      oModel.setProperty("/csvDownloadUrl", "");
      this._rebindResultPreviewTable();
    },

    _clearStatusTimer: function() {
      if (this._statusTimer) {
        clearTimeout(this._statusTimer);
        this._statusTimer = null;
      }
    },

    _extractError: function(oError, sFallback) {
      return oError && oError.message ? oError.message : sFallback;
    }
  });
});
