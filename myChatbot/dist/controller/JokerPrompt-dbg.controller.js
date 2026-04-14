sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/suite/ui/commons/demo/tutorial/service/AiService",
  "sap/ui/model/odata/v2/ODataModel",
  "sap/ui/model/json/JSONModel",
  "sap/m/Column",
  "sap/m/Text",
  "sap/m/ColumnListItem",
  "sap/suite/ui/microchart/ComparisonMicroChart",
  "sap/suite/ui/microchart/ComparisonMicroChartData",
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
  ComparisonMicroChart,
  ComparisonMicroChartData,
  VizFrame,
  FlattenedDataset,
  DimensionDefinition,
  MeasureDefinition,
  FeedItem
) {
  "use strict";

  return Controller.extend("sap.suite.ui.commons.demo.tutorial.controller.JokerPrompt", {
    onInit: function() {
      this._dummy9DropZoneBound = false;
      this._dummy12SessionStorageKey = "ai_joker_12_session_v2";
      this.getOwnerComponent().getRouter().getRoute("jokerPrompt").attachPatternMatched(this._onRouteMatched, this);
    },

    onAfterRendering: function() {
      this._bindDummy9DropZoneEvents();
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

    onDummy9QuestionSubmit: async function() {
      await this.onRunDummy9();
    },

    onDummy9FileChange: function(oEvent) {
      var aFiles = oEvent && oEvent.getParameter ? oEvent.getParameter("files") : [];
      this._appendDummy9Files(aFiles || []);
    },

    onRemoveDummy9File: function(oEvent) {
      var oCtx = oEvent && oEvent.getSource ? oEvent.getSource().getBindingContext("jokers") : null;
      if (!oCtx) {
        return;
      }

      var oModel = this.getView().getModel("jokers");
      var sPath = oCtx.getPath();
      var aFiles = oModel.getProperty("/dummy9Files") || [];
      var iIndex = parseInt(String(sPath).split("/").pop(), 10);

      if (!isFinite(iIndex) || iIndex < 0 || iIndex >= aFiles.length) {
        return;
      }

      aFiles.splice(iIndex, 1);
      oModel.setProperty("/dummy9Files", aFiles);
    },

    onRunDummy9: async function() {
      var oModel = this.getView().getModel("jokers");
      var sQuestion = (oModel.getProperty("/dummy9Question") || "").trim();
      var aFiles = oModel.getProperty("/dummy9Files") || [];

      if (!sQuestion) {
        MessageToast.show("A kerdes mezot toltsd ki.");
        return;
      }

      if (aFiles.length === 0) {
        MessageToast.show("Tolts fel legalabb egy CSV fajlt.");
        return;
      }

      oModel.setProperty("/generating", true);
      oModel.setProperty("/dummy9ResultText", "");
      oModel.setProperty("/dummy9Error", "");
      oModel.setProperty("/dummy9Rows", []);
      oModel.setProperty("/dummy9ChartReady", false);
      oModel.setProperty("/dummy9SelectedSource", "");
      oModel.setProperty("/dummy9MatchedFiles", []);
      this._resetDummy9LocalChart();
      this._rebindDummy9PreviewTable();

      try {
        var oResult = await AiService.runDummy9({
          question: sQuestion,
          files: aFiles
        });

        oModel.setProperty("/dummy9ResultText", oResult.summary || "A feldolgozas sikeresen lefutott.");
        oModel.setProperty("/dummy9Rows", oResult.rows || []);
        oModel.setProperty("/dummy9SelectedSource", oResult.selectedSource || "");
        oModel.setProperty("/dummy9MatchedFiles", oResult.matchedFiles || []);
        this._rebindDummy9PreviewTable();
        this._renderDummy9LocalChart(oResult.rows || []);
      } catch (oError) {
        oModel.setProperty("/dummy9Error", "A CSV riport elkeszitese most nem sikerult. Probald meg ujra egy pontosabb kerdessel.");
        MessageToast.show(oError && oError.message ? oError.message : "Dummy9 hiba tortent.");
      } finally {
        oModel.setProperty("/generating", false);
      }
    },

    onRunDummy10: async function() {
      var oModel = this.getView().getModel("jokers");
      oModel.setProperty("/generating", true);
      oModel.setProperty("/dummy10Summary", "");
      oModel.setProperty("/dummy10Rows", []);
      oModel.setProperty("/dummy10SegmentItems", []);

      try {
        var oResp = await AiService.runDummy10();
        var oCounts = oResp && oResp.segment_counts ? oResp.segment_counts : {};
        var aItems = Object.keys(oCounts).sort().map(function(key) {
          return {
            segment: key,
            count: Number(oCounts[key] || 0)
          };
        });
        oModel.setProperty("/dummy10Summary", String(oResp && oResp.summary ? oResp.summary : ""));
        oModel.setProperty("/dummy10Rows", Array.isArray(oResp && oResp.rows) ? oResp.rows : []);
        oModel.setProperty("/dummy10SegmentItems", aItems);
        this._rebindDummy10PreviewTable();
      } catch (oError) {
        MessageToast.show(oError && oError.message ? oError.message : "Dummy10 hiba tortent.");
      } finally {
        oModel.setProperty("/generating", false);
      }
    },

    onSaveDummy10Schedule: async function() {
      await this._saveJokerSchedule("dummy-10", "dummy10", {});
    },

    onSaveDummy4Schedule: async function() {
      var oModel = this.getView().getModel("jokers");
      var sQuestion = String(oModel.getProperty("/dummy4Question") || "").trim();
      var sSchemaHint = String(oModel.getProperty("/dummy4SchemaHint") || "").trim();

      if (!sQuestion) {
        MessageToast.show("Az idoziteshez toltsd ki a Kerdes mezot.");
        return;
      }
      if (!sSchemaHint) {
        MessageToast.show("Az idoziteshez toltsd ki a Schema hint mezot.");
        return;
      }

      await this._saveJokerSchedule("dummy-4", "dummy4", {
        question: sQuestion,
        schemaHint: sSchemaHint
      });
    },

    onRunDummy11Evaluate: async function() {
      var oModel = this.getView().getModel("jokers");
      var sRawRequest = String(oModel.getProperty("/dummy11RawRequest") || "").trim();

      if (!sRawRequest) {
        MessageToast.show("Ird le, mit szeretnel, hogy az AI csinaljon.");
        return;
      }

      oModel.setProperty("/generating", true);
      oModel.setProperty("/dummy11Error", "");
      try {
        var oResp = await AiService.evaluateDummy11({
          raw_request: sRawRequest,
          current_prompt: String(oModel.getProperty("/dummy11ImprovedPrompt") || ""),
          messages: oModel.getProperty("/dummy11Messages") || [],
          feature_flags: {
            timing_enabled: !!oModel.getProperty("/dummy11TimingEnabled"),
            attachments_enabled: !!oModel.getProperty("/dummy11AttachmentsEnabled")
          },
          files: oModel.getProperty("/dummy11Files") || []
        });
        this._applyDummy11Evaluation(oResp, false);
      } catch (oError) {
        oModel.setProperty("/dummy11Error", oError && oError.message ? oError.message : "Dummy11 ertekelesi hiba.");
        MessageToast.show(oError && oError.message ? oError.message : "Dummy11 ertekelesi hiba.");
      } finally {
        oModel.setProperty("/generating", false);
      }
    },

    onDummy11SendReply: async function() {
      var oModel = this.getView().getModel("jokers");
      var sReply = String(oModel.getProperty("/dummy11ReplyDraft") || "").trim();
      if (!sReply) {
        MessageToast.show("Valaszolj az AI kerdesere.");
        return;
      }

      oModel.setProperty("/generating", true);
      oModel.setProperty("/dummy11Error", "");
      try {
        var aMessages = (oModel.getProperty("/dummy11Messages") || []).slice();
        aMessages.push({
          role: "user",
          content: sReply
        });
        var oResp = await AiService.evaluateDummy11({
          raw_request: String(oModel.getProperty("/dummy11RawRequest") || ""),
          current_prompt: String(oModel.getProperty("/dummy11ImprovedPrompt") || ""),
          messages: aMessages,
          feature_flags: {
            timing_enabled: !!oModel.getProperty("/dummy11TimingEnabled"),
            attachments_enabled: !!oModel.getProperty("/dummy11AttachmentsEnabled")
          },
          files: oModel.getProperty("/dummy11Files") || []
        });
        oModel.setProperty("/dummy11ReplyDraft", "");
        this._applyDummy11Evaluation(oResp, true, sReply);
      } catch (oError) {
        oModel.setProperty("/dummy11Error", oError && oError.message ? oError.message : "Dummy11 valaszfeldolgozasi hiba.");
        MessageToast.show(oError && oError.message ? oError.message : "Dummy11 valaszfeldolgozasi hiba.");
      } finally {
        oModel.setProperty("/generating", false);
      }
    },

    onDummy11FileChange: function(oEvent) {
      var aFiles = oEvent && oEvent.getParameter ? oEvent.getParameter("files") : [];
      this._appendDummy11Files(aFiles || []);
    },

    onRemoveDummy11File: function(oEvent) {
      var oCtx = oEvent && oEvent.getSource ? oEvent.getSource().getBindingContext("jokers") : null;
      if (!oCtx) {
        return;
      }
      var oModel = this.getView().getModel("jokers");
      var aFiles = oModel.getProperty("/dummy11Files") || [];
      var iIndex = parseInt(String(oCtx.getPath()).split("/").pop(), 10);
      if (!isFinite(iIndex) || iIndex < 0 || iIndex >= aFiles.length) {
        return;
      }
      aFiles.splice(iIndex, 1);
      oModel.setProperty("/dummy11Files", aFiles);
    },

    onSaveDummy11Draft: async function() {
      await this._saveDummy11Prompt("draft");
    },

    onSaveDummy11Prompt: async function() {
      await this._saveDummy11Prompt("final");
    },

    onRunDummy11Prompt: async function() {
      var oModel = this.getView().getModel("jokers");
      var sFinalPrompt = String(oModel.getProperty("/dummy11ImprovedPrompt") || "").trim();

      if (!sFinalPrompt) {
        MessageToast.show("Elobb generalj egy javitott promptot.");
        return;
      }

      oModel.setProperty("/generating", true);
      oModel.setProperty("/dummy11Error", "");
      oModel.setProperty("/dummy11ResultText", "");
      try {
        var oResp = await AiService.runDummy11Prompt({
          final_prompt: sFinalPrompt,
          files: oModel.getProperty("/dummy11Files") || []
        });
        oModel.setProperty("/dummy11ResultText", String(oResp && oResp.result ? oResp.result : ""));
      } catch (oError) {
        oModel.setProperty("/dummy11Error", oError && oError.message ? oError.message : "Dummy11 futtatasi hiba.");
        MessageToast.show(oError && oError.message ? oError.message : "Dummy11 futtatasi hiba.");
      } finally {
        oModel.setProperty("/generating", false);
      }
    },

    onDummy12AddCompetitor: function() {
      var oModel = this.getView().getModel("jokers");
      var aCompanies = (oModel.getProperty("/dummy12Companies") || []).slice();
      if (aCompanies.length >= 5) {
        MessageToast.show("Maximum 5 ceg elemezheto egyszerre.");
        return;
      }
      aCompanies.push(this._createDummy12Company(false, aCompanies.length));
      oModel.setProperty("/dummy12Companies", aCompanies);
      this._persistDummy12Session();
    },

    onDummy12RemoveCompany: function(oEvent) {
      var oCtx = oEvent && oEvent.getSource ? oEvent.getSource().getBindingContext("jokers") : null;
      if (!oCtx) {
        return;
      }
      var iIndex = parseInt(String(oCtx.getPath()).split("/").pop(), 10);
      if (!isFinite(iIndex) || iIndex <= 0) {
        MessageToast.show("A sajat ceg kartyaja nem torolheto.");
        return;
      }
      var oModel = this.getView().getModel("jokers");
      var aCompanies = (oModel.getProperty("/dummy12Companies") || []).slice();
      aCompanies.splice(iIndex, 1);
      aCompanies = aCompanies.map(function(oCompany, idx) {
        return Object.assign({}, oCompany, {
          slotLabel: idx === 0 ? "Sajat ceg" : ("Versenytars " + idx)
        });
      });
      oModel.setProperty("/dummy12Companies", aCompanies);
      this._persistDummy12Session();
    },

    onDummy12CompanyFieldChange: function() {
      this._persistDummy12Session();
    },

    onDummy12ReportFileChange: function(oEvent) {
      this._appendDummy12Files(oEvent, "annualReportFiles");
    },

    onDummy12RemoveReportFile: function(oEvent) {
      this._removeDummy12FileFromPath(oEvent, "annualReportFiles");
    },

    onDummy12ReportViewChange: function() {
      this._updateDummy12FinancialReportState();
      this._persistDummy12Session();
    },

    onRunDummy12Analysis: async function() {
      var oModel = this.getView().getModel("jokers");
      var aCompanies = oModel.getProperty("/dummy12Companies") || [];
      var oValidation = this._validateDummy12Companies(aCompanies);
      if (!oValidation.ok) {
        oModel.setProperty("/dummy12Error", oValidation.message);
        MessageToast.show(oValidation.message);
        return;
      }

      oModel.setProperty("/dummy12Busy", true);
      oModel.setProperty("/dummy12Error", "");
      oModel.setProperty("/dummy12ProgressPercent", 5);
      oModel.setProperty("/dummy12ProgressText", "Konkurenciaelemzes inditasa...");
      oModel.setProperty("/dummy12CurrentStep", 0);
      oModel.setProperty("/dummy12SessionRestored", false);
      oModel.setProperty("/dummy12SessionInfoText", "");
      oModel.setProperty("/dummy12SessionNeedsFiles", false);
      oModel.setProperty("/dummy12ExecutiveSummary", []);
      oModel.setProperty("/dummy12Competitors", []);
      oModel.setProperty("/dummy12ComparisonRows", []);
      oModel.setProperty("/dummy12KpiItems", []);
      oModel.setProperty("/dummy12KpiSummary", []);
      oModel.setProperty("/dummy12ExtractedFinancials", []);
      this._resetDummy12KpiCharts();
      this._resetDummy12ReportCharts();
      try {
        var oPayload = this._buildDummy12AnalyzePayload(aCompanies);
        var oStart = await AiService.startDummy12Analysis(oPayload);
        var sJobId = String(oStart && oStart.job_id ? oStart.job_id : "");
        if (!sJobId) {
          throw new Error("A Dummy12 feladat azonositoja nem erkezett vissza.");
        }
        oModel.setProperty("/dummy12JobId", sJobId);
        this._applyDummy12Status(oStart);
        await this._pollDummy12Job(sJobId);
      } catch (oError) {
        oModel.setProperty("/dummy12Error", oError && oError.message ? oError.message : "Dummy12 elemzesi hiba.");
        oModel.setProperty("/dummy12ProgressText", "");
        MessageToast.show(oError && oError.message ? oError.message : "Dummy12 elemzesi hiba.");
      } finally {
        oModel.setProperty("/dummy12Busy", false);
      }
    },

    onDummy12OpenPreview: function(oEvent) {
      var oCtx = oEvent && oEvent.getSource ? oEvent.getSource().getBindingContext("jokers") : null;
      var oItem = oCtx ? oCtx.getObject() : null;
      if (!oItem) {
        return;
      }
      var oModel = this.getView().getModel("jokers");
      var sPreviewId = String(oItem.previewId || "");
      oModel.setProperty("/dummy12SelectedPreviewId", sPreviewId);
      oModel.setProperty("/dummy12SelectedPreviewTitle", String((oItem.companyName || "") + " - " + (oItem.fileName || "")).trim());
      oModel.setProperty("/dummy12SelectedPreviewSummary", String(oItem.summary || ""));
      oModel.setProperty("/dummy12SelectedPreviewRows", (oItem.metricRows || []).concat(oItem.sectionRows || []));
      this._rebindDummy12PreviewTable();
    },

    onDownloadDummy12Summary: function() {
      var oModel = this.getView().getModel("jokers");
      var sText = String(oModel.getProperty("/dummy12ExportText") || "").trim();
      if (!sText) {
        MessageToast.show("Nincs letoltheto osszefoglalo.");
        return;
      }
      var oBlob = new Blob([sText], { type: "text/plain;charset=utf-8" });
      this._downloadDummy7Pdf = this._downloadDummy7Pdf; // keep linter calm in minified build context
      var sUrl = window.URL.createObjectURL(oBlob);
      var oLink = document.createElement("a");
      oLink.href = sUrl;
      oLink.download = "konkurencia_elemzes_osszefoglalo.txt";
      document.body.appendChild(oLink);
      oLink.click();
      document.body.removeChild(oLink);
      window.URL.revokeObjectURL(sUrl);
    },

    onRefreshDummy4SchemaHint: async function() {
      var oModel = this.getView().getModel("jokers");
      oModel.setProperty("/generating", true);
      try {
        var oResp = await AiService.getDummy4SchemaHint();
        oModel.setProperty("/dummy4SchemaHint", oResp && oResp.schemaHint ? oResp.schemaHint : "");
        oModel.setProperty("/dummy9SchemaHint", oResp && oResp.schemaHint ? oResp.schemaHint : "");
        MessageToast.show("Schema hint frissitve.");
      } catch (oError) {
        MessageToast.show(oError && oError.message ? oError.message : "Schema hint frissitesi hiba.");
      } finally {
        oModel.setProperty("/generating", false);
      }
    },

    onRunSmartSegmentation: async function() {
      var oModel = this.getView().getModel("jokers");
      var bSql = !!oModel.getProperty("/smartSegSqlEnabled");
      var bRag = !!oModel.getProperty("/smartSegRagEnabled");
      var sSqlPrompt = String(oModel.getProperty("/smartSegSqlPrompt") || "").trim();
      var sRagPrompt = String(oModel.getProperty("/smartSegRagPrompt") || "").trim();
      var sCombineMode = String(oModel.getProperty("/smartSegCombineMode") || "AND").toUpperCase();

      if (!bSql && !bRag) {
        MessageToast.show("Kapcsolj be legalabb egy adatforrast.");
        return;
      }
      if (bSql && !sSqlPrompt) {
        MessageToast.show("Az SQL szabadszavas felteteleket add meg.");
        return;
      }
      if (bRag && !sRagPrompt) {
        MessageToast.show("A RAG keresesi leirast add meg.");
        return;
      }

      oModel.setProperty("/smartSegBusy", true);
      oModel.setProperty("/smartSegError", "");
      this._smartSegAppendChat("user", [
        bSql ? ("[SQL] " + sSqlPrompt) : "",
        bRag ? ("[RAG] " + sRagPrompt) : "",
        (bSql && bRag) ? ("[Kombinalas] " + sCombineMode) : ""
      ].filter(Boolean).join("\n"));

      try {
        var oResp = await AiService.runSmartSegmentation({
          sql_enabled: bSql,
          rag_enabled: bRag,
          combine_mode: sCombineMode,
          sql_prompt: sSqlPrompt,
          rag_prompt: sRagPrompt
        });

        oModel.setProperty("/smartSegSqlMeta", oResp.sql || null);
        oModel.setProperty("/smartSegRagMeta", oResp.rag || null);
        oModel.setProperty("/smartSegResultRows", (oResp.result && oResp.result.rows) || []);
        oModel.setProperty("/smartSegResultColumns", (oResp.result && oResp.result.columns) || []);
        oModel.setProperty("/smartSegTotalCount", Number(oResp.result && oResp.result.total_count || 0));
        oModel.setProperty("/smartSegSelectedRecordIds", []);
        oModel.setProperty("/smartSegPage", 1);
        if (!oModel.getProperty("/smartSegSortKey")) {
          oModel.setProperty("/smartSegSortKey", ((oResp.result && oResp.result.columns) || [])[0] || "");
        }
        this._applySmartSegClientView();
        this._rebindSmartSegResultTable();

        this._smartSegAppendChat("assistant", this._buildSmartSegSummaryText(oResp));
      } catch (oError) {
        var sMsg = oError && oError.message ? oError.message : "Smart Segmentation hiba.";
        oModel.setProperty("/smartSegError", sMsg);
        this._smartSegAppendChat("assistant", "Hiba: " + sMsg);
        MessageToast.show(sMsg);
      } finally {
        oModel.setProperty("/smartSegBusy", false);
      }
    },

    onSmartSegSearch: function() {
      this._syncSmartSegSelectionsFromTable();
      this._applySmartSegClientView();
      this._rebindSmartSegResultTable();
    },

    onSmartSegSearchLive: function() {
      this._syncSmartSegSelectionsFromTable();
      this._applySmartSegClientView();
      this._rebindSmartSegResultTable();
    },

    onSmartSegSortChange: function() {
      this._syncSmartSegSelectionsFromTable();
      this._applySmartSegClientView();
      this._rebindSmartSegResultTable();
    },

    onSmartSegSortDirChange: function(oEvent) {
      var sKey = String(oEvent.getParameter("item").getKey() || "asc");
      this.getView().getModel("jokers").setProperty("/smartSegSortDir", sKey);
      this._syncSmartSegSelectionsFromTable();
      this._applySmartSegClientView();
      this._rebindSmartSegResultTable();
    },

    onSmartSegPrevPage: function() {
      var oModel = this.getView().getModel("jokers");
      this._syncSmartSegSelectionsFromTable();
      var iPage = Math.max(1, Number(oModel.getProperty("/smartSegPage") || 1) - 1);
      oModel.setProperty("/smartSegPage", iPage);
      this._applySmartSegClientView();
      this._rebindSmartSegResultTable();
    },

    onSmartSegNextPage: function() {
      var oModel = this.getView().getModel("jokers");
      this._syncSmartSegSelectionsFromTable();
      var iPage = Number(oModel.getProperty("/smartSegPage") || 1) + 1;
      oModel.setProperty("/smartSegPage", iPage);
      this._applySmartSegClientView();
      this._rebindSmartSegResultTable();
    },

    onSmartSegSelectionChange: function() {
      this._syncSmartSegSelectionsFromTable();
    },

    onSmartSegSendToCrm: async function() {
      var oModel = this.getView().getModel("jokers");
      var aIds = oModel.getProperty("/smartSegSelectedRecordIds") || [];
      try {
        var oResp = await AiService.sendSmartSegmentationToCrm({
          record_ids: aIds
        });
        MessageToast.show(oResp && oResp.message ? oResp.message : "Jövőbeli funkció.");
      } catch (_e) {
        MessageToast.show("Jövőbeli funkció.");
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
      this._resetDummy9State();
      this._resetDummy10State();
      this._resetDummy11State();
      this._resetDummy12State();
      this._resetDummy5State();
      this._resetDummy7State();
      this._resetSmartSegState();
      this._resetDummy4Chart();
      this._resetDummy4LocalChart();
      this._rebindDummy4PreviewTable();
      this._rebindDummy9PreviewTable();
      this._rebindDummy10PreviewTable();
      this._rebindSmartSegResultTable();
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
          this._loadJokerSchedule("dummy-4", "dummy4");
        } else if (oSelected.id === "dummy-9") {
          this._resetDummy9State();
          this._rebindDummy9PreviewTable();
        } else if (oSelected.id === "dummy-10") {
          this._resetDummy10State();
          this._rebindDummy10PreviewTable();
          this._loadJokerSchedule("dummy-10", "dummy10");
        } else if (oSelected.id === "dummy-11") {
          this._resetDummy11State();
          this._loadJokerSchedule("dummy-11", "dummy11");
        } else if (oSelected.id === "dummy-12") {
          this._resetDummy12State();
          this._loadDummy12Session();
        } else if (oSelected.id === "dummy-5") {
          this._resetDummy5State();
        } else if (oSelected.id === "dummy-7") {
          this._resetDummy7State();
        } else if (oSelected.id === "dummy-8") {
          this._resetSmartSegState();
          this._rebindSmartSegResultTable();
        }
      }
    },

    _resetDummy9State: function() {
      var oModel = this.getView().getModel("jokers");
      oModel.setProperty("/dummy9SchemaHint", oModel.getProperty("/dummy4SchemaHint") || oModel.getProperty("/dummy9SchemaHint") || "");
      oModel.setProperty("/dummy9Files", []);
      oModel.setProperty("/dummy9Question", "");
      oModel.setProperty("/dummy9ResultText", "");
      oModel.setProperty("/dummy9Error", "");
      oModel.setProperty("/dummy9Rows", []);
      oModel.setProperty("/dummy9ChartReady", false);
      oModel.setProperty("/dummy9SelectedSource", "");
      oModel.setProperty("/dummy9MatchedFiles", []);
      this._resetDummy9LocalChart();

      var oFileUploader = this.byId("dummy9FileUploader");
      if (oFileUploader && oFileUploader.clear) {
        oFileUploader.clear();
      }
    },

    _resetDummy10State: function() {
      var oModel = this.getView().getModel("jokers");
      oModel.setProperty("/dummy10Summary", "");
      oModel.setProperty("/dummy10Rows", []);
      oModel.setProperty("/dummy10SegmentItems", []);
      this._rebindDummy10PreviewTable();
    },

    _loadJokerSchedule: async function(sJokerId, sPrefix) {
      var oModel = this.getView().getModel("jokers");
      try {
        var oResp = await AiService.reportsListSchedules();
        var aItems = Array.isArray(oResp && oResp.items) ? oResp.items : [];
        var oSchedule = aItems.find(function(item) {
          return String(item && item.JokerId ? item.JokerId : "") === sJokerId;
        });
        if (!oSchedule) {
          oModel.setProperty("/" + sPrefix + "ScheduleId", 0);
          oModel.setProperty("/" + sPrefix + "ScheduleEnabled", false);
          if (sPrefix === "dummy11") {
            oModel.setProperty("/dummy11TimingEnabled", false);
          }
          return;
        }
        oModel.setProperty("/" + sPrefix + "ScheduleId", Number(oSchedule.ScheduleId || 0));
        oModel.setProperty("/" + sPrefix + "ScheduleEnabled", Number(oSchedule.Enabled || 0) === 1);
        oModel.setProperty("/" + sPrefix + "ScheduleFrequency", String(oSchedule.Frequency || "immediate"));
        oModel.setProperty("/" + sPrefix + "ScheduleWeeklyDay", Number(oSchedule.WeeklyDay != null ? oSchedule.WeeklyDay : 1));
        oModel.setProperty("/" + sPrefix + "ScheduleTime", String(oSchedule.TimeHHMM || "09:00"));
        if (sPrefix === "dummy11") {
          oModel.setProperty("/dummy11TimingEnabled", true);
        }
      } catch (_e) {
        // schedule lekeres hiba eseten maradnak a default ertekek
      }
    },

    _saveJokerSchedule: async function(sJokerId, sPrefix, oConfig) {
      var oModel = this.getView().getModel("jokers");
      var bEnabled = !!oModel.getProperty("/" + sPrefix + "ScheduleEnabled");
      var sFrequency = String(oModel.getProperty("/" + sPrefix + "ScheduleFrequency") || "immediate");
      var iWeeklyDay = Number(oModel.getProperty("/" + sPrefix + "ScheduleWeeklyDay") || 1);
      var sTime = String(oModel.getProperty("/" + sPrefix + "ScheduleTime") || "").trim();
      var iScheduleId = Number(oModel.getProperty("/" + sPrefix + "ScheduleId") || 0);

      if (!bEnabled) {
        MessageToast.show("Kapcsold be az Idozites kapcsolot a menteshez.");
        return;
      }

      if ((sFrequency === "daily" || sFrequency === "weekly") && !/^\d{1,2}:\d{2}$/.test(sTime)) {
        MessageToast.show("Adj meg ervenyes idot, pl. 09:30.");
        return;
      }

      var oPayload = {
        jokerId: sJokerId,
        enabled: true,
        frequency: sFrequency,
        weeklyDay: sFrequency === "weekly" ? iWeeklyDay : null,
        timeHHMM: (sFrequency === "daily" || sFrequency === "weekly") ? sTime : null,
        config: oConfig || {}
      };

      try {
        var oResp;
        if (iScheduleId > 0) {
          oResp = await AiService.reportsUpdateSchedule(Object.assign({ id: iScheduleId }, oPayload));
        } else {
          oResp = await AiService.reportsCreateSchedule(oPayload);
        }
        oModel.setProperty("/" + sPrefix + "ScheduleId", Number(oResp && oResp.item && oResp.item.ScheduleId ? oResp.item.ScheduleId : iScheduleId));
        MessageToast.show("Idozites mentve.");
      } catch (oError) {
        MessageToast.show(oError && oError.message ? oError.message : "Idozites mentesi hiba.");
      }
    },

    _getDummy11AttachmentMeta: function() {
      var oModel = this.getView().getModel("jokers");
      return (oModel.getProperty("/dummy11Files") || []).map(function(oFile) {
        return {
          name: oFile.name || "unknown",
          type: oFile.type || "application/octet-stream",
          size: Number(oFile.size || 0)
        };
      });
    },

    _appendDummy11Files: function(aFilesLike) {
      var oModel = this.getView().getModel("jokers");
      var aCurrent = oModel.getProperty("/dummy11Files") || [];
      var aFiles = Array.prototype.slice.call(aFilesLike || []);
      var mSeen = {};
      aCurrent.forEach(function(oFile) {
        mSeen[(oFile.name || "") + "|" + Number(oFile.size || 0) + "|" + (oFile.type || "")] = true;
      });
      aFiles.forEach(function(oFile) {
        var sKey = (oFile.name || "") + "|" + Number(oFile.size || 0) + "|" + (oFile.type || "");
        if (!mSeen[sKey]) {
          mSeen[sKey] = true;
          aCurrent.push(oFile);
        }
      });
      oModel.setProperty("/dummy11Files", aCurrent);
    },

    _applyDummy11Evaluation: function(oResp, bAppendUserReply, sUserReply) {
      var oModel = this.getView().getModel("jokers");
      var aMessages = oModel.getProperty("/dummy11Messages") || [];
      if (bAppendUserReply && sUserReply) {
        aMessages = aMessages.concat([{ role: "user", content: sUserReply }]);
      }
      if (oResp && oResp.assistant_message) {
        aMessages = aMessages.concat([{ role: "assistant", content: oResp.assistant_message }]);
      }
      oModel.setProperty("/dummy11Messages", aMessages);
      oModel.setProperty("/dummy11AssistantMessage", oResp && oResp.assistant_message ? oResp.assistant_message : "");
      oModel.setProperty("/dummy11ImprovedPrompt", oResp && oResp.improved_prompt ? oResp.improved_prompt : "");
      oModel.setProperty("/dummy11ScoreTotal", Number(oResp && oResp.scorecard && oResp.scorecard.total ? oResp.scorecard.total : 0));
      oModel.setProperty("/dummy11ScoreLabel", oResp && oResp.scorecard && oResp.scorecard.label ? oResp.scorecard.label : "Nincs ertekeles");
      oModel.setProperty("/dummy11CanSave", !!(oResp && oResp.scorecard && oResp.scorecard.eligible_to_save));
      oModel.setProperty("/dummy11NeedsClarification", !!(oResp && oResp.needs_clarification));
      oModel.setProperty("/dummy11PendingQuestions", oResp && oResp.follow_up_questions ? oResp.follow_up_questions : []);
      oModel.setProperty("/dummy11ScoreBreakdown", oResp && oResp.scorecard && oResp.scorecard.breakdown ? oResp.scorecard.breakdown : []);
      oModel.setProperty("/dummy11LastEvaluationId", oResp && oResp.evaluation_id ? oResp.evaluation_id : "");
      oModel.setProperty("/dummy11WhatImproved", oResp && oResp.what_improved ? oResp.what_improved : []);
      oModel.setProperty("/dummy11SaveBlockedReason", oResp && oResp.save_block && oResp.save_block.reason ? oResp.save_block.reason : "");
      oModel.setProperty("/dummy11SaveGuidance", oResp && oResp.save_block && oResp.save_block.guidance ? oResp.save_block.guidance : []);
      if (!oModel.getProperty("/dummy11Title")) {
        oModel.setProperty("/dummy11Title", "AI Joker 11 prompt");
      }
    },

    _saveDummy11Prompt: async function(sStatus) {
      var oModel = this.getView().getModel("jokers");
      var sTitle = String(oModel.getProperty("/dummy11Title") || "").trim() || "AI Joker 11 prompt";
      var sRawRequest = String(oModel.getProperty("/dummy11RawRequest") || "").trim();
      var sFinalPrompt = String(oModel.getProperty("/dummy11ImprovedPrompt") || "").trim();
      var fScore = Number(oModel.getProperty("/dummy11ScoreTotal") || 0);
      var bTimingEnabled = !!oModel.getProperty("/dummy11TimingEnabled");
      var bAttachmentsEnabled = !!oModel.getProperty("/dummy11AttachmentsEnabled");

      if (!sRawRequest) {
        MessageToast.show("A nyers keres kotelezo.");
        return;
      }
      if (!sFinalPrompt) {
        MessageToast.show("Elobb generalj egy javitott promptot.");
        return;
      }
      if (sStatus === "final" && fScore < 6) {
        var sReason = String(oModel.getProperty("/dummy11SaveBlockedReason") || "A prompt menteshez legalabb 6/10 pont szukseges.");
        oModel.setProperty("/dummy11Error", sReason);
        MessageToast.show(sReason);
        return;
      }

      oModel.setProperty("/generating", true);
      oModel.setProperty("/dummy11Error", "");
      try {
        var oSaveResp = await AiService.saveDummy11Prompt({
          title: sTitle,
          raw_request: sRawRequest,
          final_prompt: sFinalPrompt,
          score_total: fScore,
          scorecard: {
            total: fScore,
            breakdown: oModel.getProperty("/dummy11ScoreBreakdown") || []
          },
          messages: oModel.getProperty("/dummy11Messages") || [],
          attachments: this._getDummy11AttachmentMeta(),
          feature_flags: {
            timing_enabled: bTimingEnabled,
            attachments_enabled: bAttachmentsEnabled
          },
          status: sStatus
        });
        var iPromptId = Number(oSaveResp && oSaveResp.item && oSaveResp.item.PromptId ? oSaveResp.item.PromptId : 0);
        oModel.setProperty("/dummy11SavedPromptId", iPromptId);

        if (sStatus === "final" && bTimingEnabled && !!oModel.getProperty("/dummy11ScheduleEnabled")) {
          await this._saveJokerSchedule("dummy-11", "dummy11", {
            promptId: iPromptId,
            title: sTitle,
            finalPrompt: sFinalPrompt,
            scoreTotal: fScore,
            timing_enabled: bTimingEnabled,
            attachments_enabled: bAttachmentsEnabled
          });
        }

        MessageToast.show(sStatus === "final" ? "Prompt mentve." : "Piszkozat mentve.");
      } catch (oError) {
        oModel.setProperty("/dummy11Error", oError && oError.message ? oError.message : "Dummy11 mentesi hiba.");
        MessageToast.show(oError && oError.message ? oError.message : "Dummy11 mentesi hiba.");
      } finally {
        oModel.setProperty("/generating", false);
      }
    },

    _resetDummy11State: function() {
      var oModel = this.getView().getModel("jokers");
      oModel.setProperty("/dummy11RawRequest", "");
      oModel.setProperty("/dummy11Title", "");
      oModel.setProperty("/dummy11ReplyDraft", "");
      oModel.setProperty("/dummy11ImprovedPrompt", "");
      oModel.setProperty("/dummy11ResultText", "");
      oModel.setProperty("/dummy11ScoreTotal", 0);
      oModel.setProperty("/dummy11ScoreLabel", "Nincs ertekeles");
      oModel.setProperty("/dummy11CanSave", false);
      oModel.setProperty("/dummy11NeedsClarification", false);
      oModel.setProperty("/dummy11AssistantMessage", "");
      oModel.setProperty("/dummy11WhatImproved", []);
      oModel.setProperty("/dummy11Messages", []);
      oModel.setProperty("/dummy11PendingQuestions", []);
      oModel.setProperty("/dummy11ScoreBreakdown", []);
      oModel.setProperty("/dummy11Error", "");
      oModel.setProperty("/dummy11LastEvaluationId", "");
      oModel.setProperty("/dummy11SaveBlockedReason", "");
      oModel.setProperty("/dummy11SaveGuidance", []);
      oModel.setProperty("/dummy11SavedPromptId", 0);
      oModel.setProperty("/dummy11TimingEnabled", false);
      oModel.setProperty("/dummy11ScheduleEnabled", false);
      oModel.setProperty("/dummy11ScheduleId", 0);
      oModel.setProperty("/dummy11ScheduleFrequency", "immediate");
      oModel.setProperty("/dummy11ScheduleWeeklyDay", 1);
      oModel.setProperty("/dummy11ScheduleTime", "09:00");
      oModel.setProperty("/dummy11AttachmentsEnabled", false);
      oModel.setProperty("/dummy11Files", []);
      var oFileUploader = this.byId("dummy11FileUploader");
      if (oFileUploader && oFileUploader.clear) {
        oFileUploader.clear();
      }
    },

    _createDummy12Company: function(bOwn, iIndex) {
      return {
        slotLabel: bOwn ? "Sajat ceg" : ("Versenytars " + iIndex),
        companyName: "",
        websiteUrl: "",
        linkedinUrl: "",
        annualReportFiles: []
      };
    },

    _resetDummy12State: function() {
      var oModel = this.getView().getModel("jokers");
      oModel.setProperty("/dummy12Companies", [this._createDummy12Company(true, 0)]);
      oModel.setProperty("/dummy12Busy", false);
      oModel.setProperty("/dummy12Error", "");
      oModel.setProperty("/dummy12ProgressText", "");
      oModel.setProperty("/dummy12ProgressPercent", 0);
      oModel.setProperty("/dummy12CurrentStep", 0);
      oModel.setProperty("/dummy12JobId", "");
      oModel.setProperty("/dummy12StepItems", []);
      oModel.setProperty("/dummy12KpiItems", []);
      oModel.setProperty("/dummy12KpiSummary", []);
      oModel.setProperty("/dummy12ExtractedFinancials", []);
      oModel.setProperty("/dummy12ExecutiveSummary", []);
      oModel.setProperty("/dummy12OwnCompany", {});
      oModel.setProperty("/dummy12Competitors", []);
      oModel.setProperty("/dummy12ComparisonRows", []);
      oModel.setProperty("/dummy12FinancialInsights", []);
      oModel.setProperty("/dummy12OnlineInsights", []);
      oModel.setProperty("/dummy12HiringInsights", []);
      oModel.setProperty("/dummy12StrategicTakeaways", []);
      oModel.setProperty("/dummy12RecommendedActions", []);
      oModel.setProperty("/dummy12PressMentions", []);
      oModel.setProperty("/dummy12PressSummary", {});
      oModel.setProperty("/dummy12ExportText", "");
      oModel.setProperty("/dummy12SessionRestored", false);
      oModel.setProperty("/dummy12SessionInfoText", "");
      oModel.setProperty("/dummy12SessionNeedsFiles", false);
      oModel.setProperty("/dummy12ReportGranularity", "summary");
      oModel.setProperty("/dummy12ReportPeriod", "current");
      oModel.setProperty("/dummy12SelectedReportCompany", "");
      oModel.setProperty("/dummy12ReportCompanyOptions", []);
      oModel.setProperty("/dummy12HeadlineMetrics", []);
      oModel.setProperty("/dummy12BalanceChartRows", []);
      oModel.setProperty("/dummy12IncomeChartRows", []);
      oModel.setProperty("/dummy12AnnualReportPreviews", []);
      oModel.setProperty("/dummy12SelectedPreviewId", "");
      oModel.setProperty("/dummy12SelectedPreviewTitle", "");
      oModel.setProperty("/dummy12SelectedPreviewRows", []);
      oModel.setProperty("/dummy12SelectedPreviewSummary", "");
      this._resetDummy12KpiCharts();
      this._resetDummy12ReportCharts();
    },

    _appendDummy12Files: function(oEvent, sKey) {
      var oSource = oEvent && oEvent.getSource ? oEvent.getSource() : null;
      var oCtx = oSource ? oSource.getBindingContext("jokers") : null;
      var aFiles = oEvent && oEvent.getParameter ? Array.prototype.slice.call(oEvent.getParameter("files") || []) : [];
      if (!oCtx || aFiles.length === 0) {
        return;
      }
      var iIndex = parseInt(String(oCtx.getPath()).split("/").pop(), 10);
      var oModel = this.getView().getModel("jokers");
      var aCompanies = (oModel.getProperty("/dummy12Companies") || []).slice();
      var oCompany = Object.assign({}, aCompanies[iIndex] || {});
      var aCurrent = [];
      aFiles.forEach(function(oFile) {
        var sExt = String(oFile.name || "").toLowerCase();
        if (String(oFile.type || "").toLowerCase() !== "application/pdf" && sExt.slice(-4) !== ".pdf") {
          return;
        }
        aCurrent = [oFile];
      });
      oCompany[sKey] = aCurrent;
      aCompanies[iIndex] = oCompany;
      oModel.setProperty("/dummy12Companies", aCompanies);
      this._persistDummy12Session();
    },

    _removeDummy12FileFromPath: function(oEvent, sKey) {
      var oCtx = oEvent && oEvent.getSource ? oEvent.getSource().getBindingContext("jokers") : null;
      if (!oCtx) {
        return;
      }
      var aParts = String(oCtx.getPath()).split("/");
      var iCompanyIndex = parseInt(aParts[2], 10);
      var iFileIndex = parseInt(aParts[4], 10);
      if (!isFinite(iCompanyIndex) || !isFinite(iFileIndex)) {
        return;
      }
      var oModel = this.getView().getModel("jokers");
      var aCompanies = (oModel.getProperty("/dummy12Companies") || []).slice();
      var oCompany = Object.assign({}, aCompanies[iCompanyIndex] || {});
      var aFiles = Array.isArray(oCompany[sKey]) ? oCompany[sKey].slice() : [];
      aFiles.splice(iFileIndex, 1);
      oCompany[sKey] = aFiles;
      aCompanies[iCompanyIndex] = oCompany;
      oModel.setProperty("/dummy12Companies", aCompanies);
      this._persistDummy12Session();
    },

    _isDummy12PersistedOnlyFile: function(oFile) {
      return !!(oFile && oFile.__persistedOnly);
    },

    _hasDummy12LiveFile: function(aFiles) {
      return (aFiles || []).some(function(oFile) {
        return !!oFile && !oFile.__persistedOnly;
      });
    },

    _validateDummy12Companies: function(aCompanies) {
      if (!Array.isArray(aCompanies) || aCompanies.length === 0) {
        return { ok: false, message: "Legalabb a sajat ceg adatait add meg." };
      }
      if (aCompanies.length > 5) {
        return { ok: false, message: "Maximum 5 ceg elemezheto." };
      }
      if (!String(aCompanies[0].companyName || "").trim()) {
        return { ok: false, message: "A sajat ceg neve kotelezo." };
      }
      if (!Array.isArray(aCompanies[0].annualReportFiles) || aCompanies[0].annualReportFiles.length === 0) {
        return { ok: false, message: "A sajat ceghez pontosan egy eves beszamolo PDF kotelezo." };
      }
      if ((aCompanies[0].annualReportFiles || []).length > 1) {
        return { ok: false, message: "A sajat ceghez csak egy eves beszamolo PDF adhato meg." };
      }
      if (!this._hasDummy12LiveFile(aCompanies[0].annualReportFiles || [])) {
        return { ok: false, message: "Az elozo session PDF-neve visszatoltodott, de uj elemzeshez toltsd fel ujra a sajat ceg eves beszamolo PDF-et." };
      }
      for (var i = 0; i < aCompanies.length; i += 1) {
        var oCompany = aCompanies[i] || {};
        if (!String(oCompany.companyName || "").trim()) {
          return { ok: false, message: "Minden cegkartyan add meg a ceg nevet." };
        }
        if ((oCompany.annualReportFiles || []).length > 1) {
          return { ok: false, message: "Cegenkent csak egy eves beszamolo PDF adhato meg." };
        }
        if ((oCompany.annualReportFiles || []).length > 0 && !this._hasDummy12LiveFile(oCompany.annualReportFiles || [])) {
          return { ok: false, message: "A visszatoltott PDF-nevek tajekoztato jelleguek. Uj futtatas elott toltsd fel ujra az eves beszamolo PDF-eket." };
        }
        if (oCompany.websiteUrl && !/^https?:\/\/.+/i.test(String(oCompany.websiteUrl || "").trim())) {
          return { ok: false, message: "A weboldal URL csak http:// vagy https:// formatumu lehet." };
        }
        if (oCompany.linkedinUrl && !/^https?:\/\/.+/i.test(String(oCompany.linkedinUrl || "").trim())) {
          return { ok: false, message: "A LinkedIn URL csak http:// vagy https:// formatumu lehet." };
        }
      }
      return { ok: true };
    },

    _buildDummy12AnalyzePayload: function(aCompanies) {
      var aFiles = [];
      var aDescriptors = [];
      var aCompaniesPayload = (aCompanies || []).map(function(oCompany, iIndex) {
        (oCompany.annualReportFiles || []).forEach(function(oFile) {
          if (oFile && oFile.__persistedOnly) {
            return;
          }
          aFiles.push(oFile);
          aDescriptors.push({
            company_index: iIndex,
            kind: "annual_report",
            name: oFile.name || "annual_report.pdf"
          });
        });
        return {
          companyName: String(oCompany.companyName || "").trim(),
          websiteUrl: String(oCompany.websiteUrl || "").trim(),
          linkedinUrl: String(oCompany.linkedinUrl || "").trim()
        };
      });
      return {
        companies: aCompaniesPayload,
        files: aFiles,
        file_descriptors: aDescriptors
      };
    },

    _createDummy12FilePlaceholder: function(oFile) {
      return {
        name: String(oFile && oFile.name ? oFile.name : "eves_beszamolo.pdf"),
        size: Number(oFile && oFile.size ? oFile.size : 0),
        type: String(oFile && oFile.type ? oFile.type : "application/pdf"),
        __persistedOnly: true
      };
    },

    _buildDummy12SessionSnapshot: function(oResultOverride) {
      var oModel = this.getView().getModel("jokers");
      return {
        savedAt: new Date().toISOString(),
        companies: (oModel.getProperty("/dummy12Companies") || []).map(function(oCompany, iIndex) {
          return {
            slotLabel: iIndex === 0 ? "Sajat ceg" : ("Versenytars " + iIndex),
            companyName: String(oCompany && oCompany.companyName ? oCompany.companyName : ""),
            websiteUrl: String(oCompany && oCompany.websiteUrl ? oCompany.websiteUrl : ""),
            linkedinUrl: String(oCompany && oCompany.linkedinUrl ? oCompany.linkedinUrl : ""),
            annualReportFiles: (oCompany && oCompany.annualReportFiles ? oCompany.annualReportFiles : []).map(function(oFile) {
              return {
                name: String(oFile && oFile.name ? oFile.name : "eves_beszamolo.pdf"),
                size: Number(oFile && oFile.size ? oFile.size : 0),
                type: String(oFile && oFile.type ? oFile.type : "application/pdf")
              };
            })
          };
        }),
        reportGranularity: String(oModel.getProperty("/dummy12ReportGranularity") || "summary"),
        reportPeriod: String(oModel.getProperty("/dummy12ReportPeriod") || "current"),
        selectedReportCompany: String(oModel.getProperty("/dummy12SelectedReportCompany") || ""),
        result: oResultOverride || {
          extracted_financials: oModel.getProperty("/dummy12ExtractedFinancials") || [],
          kpi_items: oModel.getProperty("/dummy12KpiItems") || [],
          kpi_summary: oModel.getProperty("/dummy12KpiSummary") || [],
          executive_summary: oModel.getProperty("/dummy12ExecutiveSummary") || [],
          own_company: oModel.getProperty("/dummy12OwnCompany") || {},
          competitors: oModel.getProperty("/dummy12Competitors") || [],
          comparison_table: oModel.getProperty("/dummy12ComparisonRows") || [],
          financial_insights: oModel.getProperty("/dummy12FinancialInsights") || [],
          online_presence_insights: oModel.getProperty("/dummy12OnlineInsights") || [],
          hiring_insights: oModel.getProperty("/dummy12HiringInsights") || [],
          strategic_takeaways: oModel.getProperty("/dummy12StrategicTakeaways") || [],
          recommended_actions: oModel.getProperty("/dummy12RecommendedActions") || [],
          press_mentions: oModel.getProperty("/dummy12PressMentions") || [],
          press_summary: oModel.getProperty("/dummy12PressSummary") || {},
          export_text: oModel.getProperty("/dummy12ExportText") || ""
        }
      };
    },

    _persistDummy12Session: function(oResultOverride) {
      try {
        window.localStorage.setItem(this._dummy12SessionStorageKey, JSON.stringify(this._buildDummy12SessionSnapshot(oResultOverride)));
      } catch (_e) {
        // best-effort local session persistence
      }
    },

    _loadDummy12Session: function() {
      var oModel = this.getView().getModel("jokers");
      var oStored = null;
      try {
        oStored = JSON.parse(window.localStorage.getItem(this._dummy12SessionStorageKey) || "null");
      } catch (_e) {
        oStored = null;
      }
      if (!oStored) {
        return;
      }

      var aCompanies = Array.isArray(oStored.companies) && oStored.companies.length > 0 ? oStored.companies : [this._createDummy12Company(true, 0)];
      aCompanies = aCompanies.map(function(oCompany, iIndex) {
        return {
          slotLabel: iIndex === 0 ? "Sajat ceg" : ("Versenytars " + iIndex),
          companyName: String(oCompany && oCompany.companyName ? oCompany.companyName : ""),
          websiteUrl: String(oCompany && oCompany.websiteUrl ? oCompany.websiteUrl : ""),
          linkedinUrl: String(oCompany && oCompany.linkedinUrl ? oCompany.linkedinUrl : ""),
          annualReportFiles: (oCompany && oCompany.annualReportFiles ? oCompany.annualReportFiles : []).map(function(oFile) {
            return this._createDummy12FilePlaceholder(oFile);
          }.bind(this))
        };
      }.bind(this));

      oModel.setProperty("/dummy12Companies", aCompanies);
      oModel.setProperty("/dummy12ReportGranularity", String(oStored.reportGranularity || "summary"));
      oModel.setProperty("/dummy12ReportPeriod", String(oStored.reportPeriod || "current"));
      oModel.setProperty("/dummy12SelectedReportCompany", String(oStored.selectedReportCompany || ""));
      if (oStored.result) {
        this._applyDummy12Result(oStored.result);
      } else {
        this._updateDummy12FinancialReportState();
      }
      oModel.setProperty("/dummy12SessionRestored", true);
      oModel.setProperty("/dummy12SessionNeedsFiles", aCompanies.some(function(oCompany) {
        return (oCompany.annualReportFiles || []).length > 0;
      }));
      oModel.setProperty("/dummy12SessionInfoText", "Visszatoltottuk az elozo session cegadatait, versenytarsait es PDF-neveit. Uj elemzeshez a PDF-eket ujra fel kell tolteni.");
    },

    _pickDummy12Metric: function(oDataset, sKey, sPeriod) {
      var oMetrics = oDataset && oDataset.metrics ? oDataset.metrics : {};
      var oMetric = oMetrics[sKey] || {};
      return sPeriod === "previous" ? oMetric.previous : oMetric.current;
    },

    _formatDummy12MetricValue: function(vValue) {
      if (vValue == null || !isFinite(vValue)) {
        return "-";
      }
      return Number(vValue).toLocaleString("hu-HU", { maximumFractionDigits: 0 });
    },

    _updateDummy12FinancialReportState: function() {
      var oModel = this.getView().getModel("jokers");
      var aDatasets = oModel.getProperty("/dummy12ExtractedFinancials") || [];
      var sGranularity = String(oModel.getProperty("/dummy12ReportGranularity") || "summary");
      var sPeriod = String(oModel.getProperty("/dummy12ReportPeriod") || "current");
      var aCompanyOptions = aDatasets.map(function(oDataset) {
        return {
          key: String(oDataset && oDataset.company_name ? oDataset.company_name : ""),
          text: String(oDataset && oDataset.company_name ? oDataset.company_name : "")
        };
      }).filter(function(oItem) {
        return !!oItem.key;
      });
      var sSelectedCompany = String(oModel.getProperty("/dummy12SelectedReportCompany") || "");

      if (!sSelectedCompany && aCompanyOptions.length > 0) {
        sSelectedCompany = aCompanyOptions[0].key;
      }
      if (aCompanyOptions.length > 0 && !aCompanyOptions.some(function(oItem) { return oItem.key === sSelectedCompany; })) {
        sSelectedCompany = aCompanyOptions[0].key;
      }

      var aHeadlineDefs = [
        { key: "total_assets", label: "Eszkozok osszesen" },
        { key: "equity", label: "Sajat toke" },
        { key: "total_liabilities", label: "Kotelezettsegek" },
        { key: "revenue", label: "Arbevetel" },
        { key: "operating_profit", label: "Uzemi eredmeny" }
      ];
      var oOwnDataset = aDatasets[0] || null;
      var aBenchmarkDatasets = aDatasets.slice(1);
      var aHeadlineMetrics = aHeadlineDefs.map(function(oDef) {
        var nOwn = this._pickDummy12Metric(oOwnDataset, oDef.key, sPeriod);
        var aValues = aBenchmarkDatasets.map(function(oDataset) {
          return this._pickDummy12Metric(oDataset, oDef.key, sPeriod);
        }.bind(this)).filter(function(vValue) {
          return vValue != null && isFinite(vValue);
        });
        var nBenchmark = aValues.length ? aValues.reduce(function(sum, value) { return sum + Number(value); }, 0) / aValues.length : null;
        return {
          label: oDef.label,
          ownDisplayValue: this._formatDummy12MetricValue(nOwn),
          benchmarkDisplayValue: this._formatDummy12MetricValue(nBenchmark),
          ownValue: nOwn,
          benchmarkValue: nBenchmark
        };
      }.bind(this));

      var aBalanceSummary = [
        { key: "total_assets", label: "Eszkozok osszesen" },
        { key: "equity", label: "Sajat toke" },
        { key: "total_liabilities", label: "Kotelezettsegek" }
      ];
      var aBalanceDetails = [
        { key: "current_assets", label: "Forgoeszkozok" },
        { key: "inventory", label: "Keszletek" },
        { key: "receivables", label: "Vevok" },
        { key: "cash", label: "Penzeszkozok" },
        { key: "equity", label: "Sajat toke" },
        { key: "long_term_liabilities", label: "Hosszu lejaratu kotelezettsegek" },
        { key: "short_term_liabilities", label: "Rovid lejaratu kotelezettsegek" }
      ];
      var aBalanceDefs = sGranularity === "details" ? aBalanceDetails : aBalanceSummary;
      var aBalanceRows = [];

      aDatasets.forEach(function(oDataset) {
        aBalanceDefs.forEach(function(oDef) {
          var nValue = this._pickDummy12Metric(oDataset, oDef.key, sPeriod);
          if (nValue == null || !isFinite(nValue)) {
            return;
          }
          aBalanceRows.push({
            company: String(oDataset && oDataset.company_name ? oDataset.company_name : ""),
            category: oDef.label,
            value: Number(nValue)
          });
        }.bind(this));
      }.bind(this));

      var oIncomeDataset = aDatasets.find(function(oDataset) {
        return String(oDataset && oDataset.company_name ? oDataset.company_name : "") === sSelectedCompany;
      }) || aDatasets[0] || null;
      var aIncomeSummary = [
        { key: "revenue", label: "Arbevetel", sign: 1 },
        { key: "material_costs", label: "Anyagjellegu raforditas", sign: -1 },
        { key: "personnel_costs", label: "Szemelyi jellegu raforditas", sign: -1 },
        { key: "depreciation", label: "Ertekcsokkenes", sign: -1 },
        { key: "operating_profit", label: "Uzemi eredmeny", sign: 1 }
      ];
      var aIncomeDetails = [
        { key: "revenue", label: "Arbevetel", sign: 1 },
        { key: "material_costs", label: "Anyagjellegu raforditas", sign: -1 },
        { key: "personnel_costs", label: "Szemelyi jellegu raforditas", sign: -1 },
        { key: "salary_costs", label: "Berkoltseg", sign: -1 },
        { key: "depreciation", label: "Ertekcsokkenes", sign: -1 },
        { key: "operating_profit", label: "Uzemi eredmeny", sign: 1 }
      ];
      var aIncomeDefs = sGranularity === "details" ? aIncomeDetails : aIncomeSummary;
      var aIncomeRows = [];

      aIncomeDefs.forEach(function(oDef) {
        var nValue = this._pickDummy12Metric(oIncomeDataset, oDef.key, sPeriod);
        if (nValue == null || !isFinite(nValue)) {
          return;
        }
        aIncomeRows.push({
          step: oDef.label,
          value: Number(nValue) * Number(oDef.sign || 1)
        });
      }.bind(this));

      oModel.setProperty("/dummy12ReportCompanyOptions", aCompanyOptions);
      oModel.setProperty("/dummy12SelectedReportCompany", sSelectedCompany);
      oModel.setProperty("/dummy12HeadlineMetrics", aHeadlineMetrics);
      oModel.setProperty("/dummy12BalanceChartRows", aBalanceRows);
      oModel.setProperty("/dummy12IncomeChartRows", aIncomeRows);
      this._renderDummy12ReportCharts();
    },

    _applyDummy12Result: function(oResp) {
      var oModel = this.getView().getModel("jokers");
      oModel.setProperty("/dummy12ExtractedFinancials", Array.isArray(oResp && oResp.extracted_financials) ? oResp.extracted_financials : []);
      oModel.setProperty("/dummy12KpiItems", Array.isArray(oResp && oResp.kpi_items) ? oResp.kpi_items : []);
      oModel.setProperty("/dummy12KpiSummary", Array.isArray(oResp && oResp.kpi_summary) ? oResp.kpi_summary : []);
      oModel.setProperty("/dummy12ExecutiveSummary", Array.isArray(oResp && oResp.executive_summary) ? oResp.executive_summary : []);
      oModel.setProperty("/dummy12OwnCompany", oResp && oResp.own_company ? oResp.own_company : {});
      oModel.setProperty("/dummy12Competitors", Array.isArray(oResp && oResp.competitors) ? oResp.competitors : []);
      oModel.setProperty("/dummy12ComparisonRows", Array.isArray(oResp && oResp.comparison_table) ? oResp.comparison_table : []);
      oModel.setProperty("/dummy12FinancialInsights", Array.isArray(oResp && oResp.financial_insights) ? oResp.financial_insights : []);
      oModel.setProperty("/dummy12OnlineInsights", Array.isArray(oResp && oResp.online_presence_insights) ? oResp.online_presence_insights : []);
      oModel.setProperty("/dummy12HiringInsights", Array.isArray(oResp && oResp.hiring_insights) ? oResp.hiring_insights : []);
      oModel.setProperty("/dummy12StrategicTakeaways", Array.isArray(oResp && oResp.strategic_takeaways) ? oResp.strategic_takeaways : []);
      oModel.setProperty("/dummy12RecommendedActions", Array.isArray(oResp && oResp.recommended_actions) ? oResp.recommended_actions : []);
      oModel.setProperty("/dummy12PressMentions", Array.isArray(oResp && oResp.press_mentions) ? oResp.press_mentions : []);
      oModel.setProperty("/dummy12PressSummary", oResp && oResp.press_summary ? oResp.press_summary : {});
      oModel.setProperty("/dummy12ExportText", String(oResp && oResp.export_text ? oResp.export_text : ""));
      oModel.setProperty("/dummy12AnnualReportPreviews", Array.isArray(oResp && oResp.annual_report_previews) ? oResp.annual_report_previews : []);
      this._updateDummy12FinancialReportState();
      this._persistDummy12Session(oResp);
      this._renderDummy12KpiCharts();
    },

    _applyDummy12Status: function(oStatus) {
      var oModel = this.getView().getModel("jokers");
      oModel.setProperty("/dummy12ProgressPercent", Number(oStatus && oStatus.progress_percent ? oStatus.progress_percent : 0));
      oModel.setProperty("/dummy12ProgressText", String(oStatus && oStatus.progress_text ? oStatus.progress_text : ""));
      oModel.setProperty("/dummy12CurrentStep", Number(oStatus && oStatus.current_step ? oStatus.current_step : 0));
      oModel.setProperty("/dummy12StepItems", Array.isArray(oStatus && oStatus.steps) ? oStatus.steps : []);
      if (oStatus && oStatus.status === "done" && oStatus.result) {
        this._applyDummy12Result(oStatus.result);
        oModel.setProperty("/dummy12ProgressText", "Elemzes elkeszult.");
      }
      if (oStatus && oStatus.status === "error") {
        oModel.setProperty("/dummy12Error", String(oStatus.error || "Dummy12 elemzesi hiba."));
      }
    },

    _pollDummy12Job: async function(sJobId) {
      var oModel = this.getView().getModel("jokers");
      var iStartedAt = Date.now();
      var iTimeoutMs = 15 * 60 * 1000;
      while (Date.now() - iStartedAt < iTimeoutMs) {
        var oStatus = await AiService.getDummy12Status(sJobId);
        this._applyDummy12Status(oStatus);
        if (oStatus.status === "done") {
          return oStatus.result || {};
        }
        if (oStatus.status === "error") {
          throw new Error(oStatus.error || "Dummy12 elemzesi hiba.");
        }
        await new Promise(function(resolve) {
          window.setTimeout(resolve, 1500);
        });
      }
      oModel.setProperty("/dummy12ProgressText", "Az elemzes a vartnal tovabb fut. Probald meg ujra, vagy nezd meg par perc mulva.");
      throw new Error("A konkurenciaelemzes a vartnal tovabb futott. A feldolgozas a szerveren meg folytatodhat, probald meg ujra par perc mulva.");
    },

    _bindDummy9DropZoneEvents: function() {
      if (this._dummy9DropZoneBound) {
        return;
      }

      var oDropZone = this.byId("dummy9DropZone");
      if (!oDropZone || !oDropZone.getDomRef()) {
        return;
      }

      var dom = oDropZone.getDomRef();
      var that = this;

      dom.addEventListener("dragover", function(ev) {
        ev.preventDefault();
        dom.classList.add("dummy9DropZoneActive");
      });

      dom.addEventListener("dragleave", function() {
        dom.classList.remove("dummy9DropZoneActive");
      });

      dom.addEventListener("drop", function(ev) {
        ev.preventDefault();
        dom.classList.remove("dummy9DropZoneActive");
        var files = ev.dataTransfer && ev.dataTransfer.files ? ev.dataTransfer.files : [];
        that._appendDummy9Files(files);
      });

      this._dummy9DropZoneBound = true;
    },

    _appendDummy9Files: function(aFilesLike) {
      var oModel = this.getView().getModel("jokers");
      var aCurrent = oModel.getProperty("/dummy9Files") || [];
      var aFiles = Array.prototype.slice.call(aFilesLike || []);
      var mSeen = {};
      var iAdded = 0;

      aCurrent.forEach(function(oFile) {
        mSeen[(oFile.name || "") + "|" + Number(oFile.size || 0) + "|" + (oFile.type || "")] = true;
      });

      aFiles.forEach(function(oFile) {
        var sType = String(oFile.type || "");
        var sName = String(oFile.name || "");
        var bLooksLikeCsv = sType.indexOf("csv") >= 0 || /\.csv$/i.test(sName);
        var sKey = sName + "|" + Number(oFile.size || 0) + "|" + sType;
        if (!bLooksLikeCsv || mSeen[sKey]) {
          return;
        }
        mSeen[sKey] = true;
        aCurrent.push(oFile);
        iAdded += 1;
      });

      oModel.setProperty("/dummy9Files", aCurrent);
      if (iAdded > 0) {
        MessageToast.show(iAdded + " CSV fajl hozzaadva.");
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

    _resetSmartSegState: function() {
      var oModel = this.getView().getModel("jokers");
      oModel.setProperty("/smartSegSqlEnabled", true);
      oModel.setProperty("/smartSegRagEnabled", false);
      oModel.setProperty("/smartSegCombineMode", "AND");
      oModel.setProperty("/smartSegSqlPrompt", "");
      oModel.setProperty("/smartSegRagPrompt", "");
      oModel.setProperty("/smartSegChatMessages", []);
      oModel.setProperty("/smartSegBusy", false);
      oModel.setProperty("/smartSegError", "");
      oModel.setProperty("/smartSegSqlMeta", null);
      oModel.setProperty("/smartSegRagMeta", null);
      oModel.setProperty("/smartSegResultRows", []);
      oModel.setProperty("/smartSegResultColumns", []);
      oModel.setProperty("/smartSegDisplayRows", []);
      oModel.setProperty("/smartSegSearch", "");
      oModel.setProperty("/smartSegSortKey", "");
      oModel.setProperty("/smartSegSortDir", "asc");
      oModel.setProperty("/smartSegPage", 1);
      oModel.setProperty("/smartSegTotalCount", 0);
      oModel.setProperty("/smartSegFilteredCount", 0);
      oModel.setProperty("/smartSegSelectedRecordIds", []);
    },

    _smartSegAppendChat: function(sRole, sContent) {
      var oModel = this.getView().getModel("jokers");
      var aItems = oModel.getProperty("/smartSegChatMessages") || [];
      aItems.push({
        role: sRole,
        content: String(sContent || "")
      });
      oModel.setProperty("/smartSegChatMessages", aItems.slice(-20));
    },

    _buildSmartSegSummaryText: function(oResp) {
      var oSql = oResp && oResp.sql ? oResp.sql : {};
      var oRag = oResp && oResp.rag ? oResp.rag : {};
      var oCombine = oResp && oResp.combine ? oResp.combine : {};
      var aParts = [];
      if (oSql.active) {
        aParts.push("SQL talalatok: " + Number(oSql.matched_count || 0));
      }
      if (oRag.active) {
        aParts.push("RAG talalatok: " + Number(oRag.matched_count || 0));
      }
      aParts.push("Vegso talalatok (" + (oCombine.operator || "AND") + "): " + Number(oCombine.final_count || 0));
      if (oSql.interpreted_query) {
        aParts.push("SQL ertelmezes: " + oSql.interpreted_query);
      }
      if (oSql.generated_sql) {
        aParts.push("Generalt SQL:\n" + oSql.generated_sql);
      }
      if (oRag.note) {
        aParts.push("RAG megjegyzes: " + oRag.note);
      }
      return aParts.join("\n");
    },

    _applySmartSegClientView: function() {
      var oModel = this.getView().getModel("jokers");
      var aRows = (oModel.getProperty("/smartSegResultRows") || []).slice();
      var sSearch = String(oModel.getProperty("/smartSegSearch") || "").trim().toLowerCase();
      var sSortKey = String(oModel.getProperty("/smartSegSortKey") || "").trim();
      var sSortDir = String(oModel.getProperty("/smartSegSortDir") || "asc");
      var iPageSize = Math.max(1, Number(oModel.getProperty("/smartSegPageSize") || 20));
      var iPage = Math.max(1, Number(oModel.getProperty("/smartSegPage") || 1));

      if (sSearch) {
        aRows = aRows.filter(function(oRow) {
          return Object.keys(oRow || {}).some(function(sKey) {
            return String(oRow[sKey] == null ? "" : oRow[sKey]).toLowerCase().indexOf(sSearch) >= 0;
          });
        });
      }

      if (sSortKey) {
        aRows.sort(function(a, b) {
          var vA = a ? a[sSortKey] : null;
          var vB = b ? b[sSortKey] : null;
          var sA = String(vA == null ? "" : vA).toLowerCase();
          var sB = String(vB == null ? "" : vB).toLowerCase();
          if (sA === sB) {
            return 0;
          }
          return sA < sB ? -1 : 1;
        });
        if (sSortDir === "desc") {
          aRows.reverse();
        }
      }

      var iMaxPage = Math.max(1, Math.ceil(aRows.length / iPageSize));
      if (iPage > iMaxPage) {
        iPage = iMaxPage;
        oModel.setProperty("/smartSegPage", iPage);
      }
      var iStart = (iPage - 1) * iPageSize;
      var aPageRows = aRows.slice(iStart, iStart + iPageSize);

      oModel.setProperty("/smartSegFilteredCount", aRows.length);
      oModel.setProperty("/smartSegDisplayRows", aPageRows);
    },

    _rebindSmartSegResultTable: function() {
      var oTable = this.byId("smartSegResultTable");
      var oModel = this.getView().getModel("jokers");
      var aRows = oModel.getProperty("/smartSegDisplayRows") || [];
      var aColumns = oModel.getProperty("/smartSegResultColumns") || [];

      if (!oTable) {
        return;
      }
      oTable.unbindItems();
      oTable.removeAllColumns();
      oTable.removeSelections(true);

      if (!aColumns.length) {
        return;
      }

      aColumns.forEach(function(sCol) {
        oTable.addColumn(new Column({
          header: new Text({ text: sCol })
        }));
      });

      oTable.bindItems({
        path: "jokers>/smartSegDisplayRows",
        template: new ColumnListItem({
          cells: aColumns.map(function(sCol) {
            return new Text({
              text: "{jokers>" + sCol + "}",
              wrapping: true
            });
          })
        }),
        templateShareable: false
      });
      if (aRows.length > 0) {
        setTimeout(this._restoreSmartSegSelectionsToTable.bind(this), 0);
      }
    },

    _syncSmartSegSelectionsFromTable: function() {
      var oTable = this.byId("smartSegResultTable");
      var oModel = this.getView().getModel("jokers");
      if (!oTable) {
        return;
      }

      var aSelectedIds = oModel.getProperty("/smartSegSelectedRecordIds") || [];
      var mSelected = {};
      aSelectedIds.forEach(function(sId) { mSelected[String(sId)] = true; });

      (oTable.getItems() || []).forEach(function(oItem) {
        var oCtx = oItem.getBindingContext("jokers");
        var oRow = oCtx ? oCtx.getObject() : null;
        var sId = String(oRow && (oRow.record_id || oRow.CustomerId || "") || "");
        if (!sId) {
          return;
        }
        if (oItem.getSelected()) {
          mSelected[sId] = true;
        } else {
          delete mSelected[sId];
        }
      });

      oModel.setProperty("/smartSegSelectedRecordIds", Object.keys(mSelected));
    },

    _restoreSmartSegSelectionsToTable: function() {
      var oTable = this.byId("smartSegResultTable");
      var oModel = this.getView().getModel("jokers");
      var aSelectedIds = oModel.getProperty("/smartSegSelectedRecordIds") || [];
      var mSelected = {};
      aSelectedIds.forEach(function(sId) { mSelected[String(sId)] = true; });

      (oTable && oTable.getItems ? oTable.getItems() : []).forEach(function(oItem) {
        var oCtx = oItem.getBindingContext("jokers");
        var oRow = oCtx ? oCtx.getObject() : null;
        var sId = String(oRow && (oRow.record_id || oRow.CustomerId || "") || "");
        oItem.setSelected(!!mSelected[sId]);
      });
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

    _renderDummy9LocalChart: function(aRows) {
      var oModel = this.getView().getModel("jokers");
      var oHost = this.byId("dummy9LocalChartHost");
      var aColumns = this._extractDummy4Columns(aRows);
      var aNumericCols = this._findNumericColumns(aRows, aColumns);
      var sMeasure = aNumericCols[0] || "";
      var sDimension = aColumns.find(function(sCol) {
        return sCol !== sMeasure;
      }) || aColumns[0];

      this._resetDummy9LocalChart();
      oModel.setProperty("/dummy9ChartReady", false);

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
        height: "320px",
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
      oModel.setProperty("/dummy9ChartReady", true);
    },

    _resetDummy9LocalChart: function() {
      var oHost = this.byId("dummy9LocalChartHost");
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

    _rebindDummy9PreviewTable: function() {
      var oTable = this.byId("dummy9PreviewTable");
      var oModel = this.getView().getModel("jokers");
      var aRows = oModel.getProperty("/dummy9Rows") || [];
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
        path: "jokers>/dummy9Rows",
        template: oTemplate,
        templateShareable: false
      });
    },

    _rebindDummy10PreviewTable: function() {
      var oTable = this.byId("dummy10PreviewTable");
      var oModel = this.getView().getModel("jokers");
      var aRows = oModel.getProperty("/dummy10Rows") || [];
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

      oTable.bindItems({
        path: "jokers>/dummy10Rows",
        template: new ColumnListItem({
          cells: aCells
        }),
        templateShareable: false
      });
    },

    _rebindDummy12PreviewTable: function() {
      var oTable = this.byId("dummy12PreviewTable");
      var oModel = this.getView().getModel("jokers");
      var aRows = oModel.getProperty("/dummy12SelectedPreviewRows") || [];
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

      oTable.bindItems({
        path: "jokers>/dummy12SelectedPreviewRows",
        template: new ColumnListItem({
          cells: aCells
        }),
        templateShareable: false
      });
    },

    _resetDummy12KpiCharts: function() {
      var oHost = this.byId("dummy12KpiChartHost");
      if (!oHost) {
        return;
      }
      oHost.removeAllItems();
    },

    _renderDummy12KpiCharts: function() {
      var oHost = this.byId("dummy12KpiChartHost");
      var oModel = this.getView().getModel("jokers");
      var aItems = oModel.getProperty("/dummy12KpiItems") || [];

      this._resetDummy12KpiCharts();
      if (!oHost || aItems.length === 0) {
        return;
      }

      aItems.slice(0, 8).forEach(function(oItem) {
        var oPanel = new sap.m.Panel({
          headerText: String(oItem.name || "KPI"),
          width: "20rem"
        }).addStyleClass("sapUiTinyMarginEnd sapUiTinyMarginBottom");

        var oVBox = new sap.m.VBox({
          items: [
            new sap.m.ObjectStatus({
              text: String(oItem.category || ""),
              state: oItem.color === "Good" ? "Success" : (oItem.color === "Error" ? "Error" : "Information")
            }).addStyleClass("sapUiTinyMarginBottom"),
            new sap.m.Text({
              text: "Sajat ceg: " + String(oItem.ownDisplayValue || "-")
            }),
            new sap.m.Text({
              text: "Versenytars atlag: " + String(oItem.benchmarkDisplayValue || "-")
            }).addStyleClass("sapUiTinyMarginBottom"),
            new ComparisonMicroChart({
              size: "M",
              scale: "",
              data: [
                new ComparisonMicroChartData({
                  title: "Sajat ceg",
                  value: Number(oItem.ownValue || 0),
                  color: oItem.color === "Good" ? "Good" : (oItem.color === "Error" ? "Error" : "Neutral")
                }),
                new ComparisonMicroChartData({
                  title: "Versenytars atlag",
                  value: Number(oItem.benchmarkValue || 0),
                  color: "Neutral"
                })
              ]
            }),
            new sap.m.Text({
              text: String(oItem.formulaLabel || "")
            }).addStyleClass("sapUiTinyMarginTop")
          ]
        }).addStyleClass("sapUiSmallMargin");

        oPanel.addContent(oVBox);
        oHost.addItem(oPanel);
      });
    },

    _resetDummy12ReportCharts: function() {
      var oBalanceHost = this.byId("dummy12BalanceChartHost");
      var oIncomeHost = this.byId("dummy12IncomeChartHost");
      if (oBalanceHost) {
        oBalanceHost.removeAllItems();
      }
      if (oIncomeHost) {
        oIncomeHost.removeAllItems();
      }
    },

    _renderDummy12ReportCharts: function() {
      var oModel = this.getView().getModel("jokers");
      var aBalanceRows = oModel.getProperty("/dummy12BalanceChartRows") || [];
      var aIncomeRows = oModel.getProperty("/dummy12IncomeChartRows") || [];
      var oBalanceHost = this.byId("dummy12BalanceChartHost");
      var oIncomeHost = this.byId("dummy12IncomeChartHost");

      this._resetDummy12ReportCharts();
      if (oBalanceHost && aBalanceRows.length > 0) {
        oBalanceHost.addItem(this._createDummy12VizFrame({
          vizType: "stacked_column",
          width: "100%",
          height: "420px",
          rows: aBalanceRows,
          dimensions: [
            { name: "Ceg", value: "{company}" },
            { name: "Mutato", value: "{category}" }
          ],
          measures: [
            { name: "Ertek", value: "{value}" }
          ],
          feedItems: [
            { uid: "categoryAxis", type: "Dimension", values: ["Ceg"] },
            { uid: "color", type: "Dimension", values: ["Mutato"] },
            { uid: "valueAxis", type: "Measure", values: ["Ertek"] }
          ],
          vizProperties: {
            title: { visible: false },
            plotArea: { dataLabel: { visible: true } },
            legend: { visible: true }
          }
        }));
      }
      if (oIncomeHost && aIncomeRows.length > 0) {
        oIncomeHost.addItem(this._createDummy12VizFrame({
          vizType: "waterfall",
          width: "100%",
          height: "360px",
          rows: aIncomeRows,
          dimensions: [
            { name: "Lepes", value: "{step}" }
          ],
          measures: [
            { name: "Ertek", value: "{value}" }
          ],
          feedItems: [
            { uid: "categoryAxis", type: "Dimension", values: ["Lepes"] },
            { uid: "valueAxis", type: "Measure", values: ["Ertek"] }
          ],
          vizProperties: {
            title: { visible: false },
            plotArea: { dataLabel: { visible: true } },
            legend: { visible: false }
          }
        }));
      }
    },

    _createDummy12VizFrame: function(oConfig) {
      var oDataset = new FlattenedDataset({
        dimensions: (oConfig.dimensions || []).map(function(oItem) {
          return new DimensionDefinition({
            name: oItem.name,
            value: oItem.value
          });
        }),
        measures: (oConfig.measures || []).map(function(oItem) {
          return new MeasureDefinition({
            name: oItem.name,
            value: oItem.value
          });
        }),
        data: {
          path: "/rows"
        }
      });

      var oViz = new VizFrame({
        width: oConfig.width || "100%",
        height: oConfig.height || "320px",
        vizType: oConfig.vizType,
        dataset: oDataset
      });
      oViz.setModel(new JSONModel({ rows: oConfig.rows || [] }));
      (oConfig.feedItems || []).forEach(function(oFeed) {
        oViz.addFeed(new FeedItem({
          uid: oFeed.uid,
          type: oFeed.type,
          values: oFeed.values
        }));
      });
      oViz.setVizProperties(oConfig.vizProperties || {
        title: { visible: false }
      });
      return oViz;
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
