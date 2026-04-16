sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/suite/ui/commons/demo/tutorial/service/AiService",
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

  var STATE = {
    IDLE: "IDLE",
    ROUTING: "ROUTING",
    CARD_LOADING: "CARD_LOADING",
    CARD_INPUT_REQUIRED: "CARD_INPUT_REQUIRED",
    RUNNING_CARD: "RUNNING_CARD",
    CHATTING: "CHATTING",
    ERROR: "ERROR"
  };

  return Controller.extend("sap.suite.ui.commons.demo.tutorial.controller.Noah2", {

    // ─────────────────────────────────────────────────────────────────
    // INIT
    // ─────────────────────────────────────────────────────────────────
    onInit: function() {
      this._activeAbortController = null;
      this._boundDropHandlers = false;
      this._loadManualCard2Options();
      this._rebindNoah2Dummy4PreviewTable();
    },

    onAfterRendering: function() {
      this._bindDrop2ZoneEvents();
      this._scrollNoah2ChatToBottom();
    },

    // ─────────────────────────────────────────────────────────────────
    // PROMPT JAVITO
    // ─────────────────────────────────────────────────────────────────

    /**
     * "Prompt Javito" gomb megnyomasa:
     *  1. Elküldi a draft message-t a dummy11 evaluate API-ra
     *  2. Visszakapja a javított promptot
     *  3. Az AI chat buborékban megjeleníti a javított promptot
     *  4. Megkérdezi: "Futtathatom-e a javított promptot?"
     *  5. Ha "igen" -> onSendNoah2 elindítja a futtatást
     */
    onImprovePrompt: async function() {
      var oModel = this.getView().getModel("noah2");
      var sRaw = (oModel.getProperty("/draftMessage") || "").trim();

      if (!sRaw) {
        MessageToast.show("Elobb irj be egy uzenetet, amit javitani szeretnel.");
        return;
      }

      this._appendNoah2Message("user", sRaw);
      oModel.setProperty("/draftMessage", "");
      oModel.setProperty("/promptImproverBusy", true);
      oModel.setProperty("/promptImproverAwaitingRun", false);
      oModel.setProperty("/promptImproverImprovedPrompt", "");
      oModel.setProperty("/error", "");

      try {
        var oResp = await AiService.evaluateDummy11({
          raw_request: sRaw,
          current_prompt: "",
          messages: [],
          feature_flags: {}
        });

        var sImproved = oResp && oResp.improved_prompt ? String(oResp.improved_prompt) : "";
        var sAssistant = oResp && oResp.assistant_message ? String(oResp.assistant_message) : "";

        if (!sImproved) {
          this._appendNoah2Message("assistant",
            "Nem sikerult javitott promptot generalnom. Probalj pontosabb leirast irni.\n\n" +
            (sAssistant || ""));
          return;
        }

        oModel.setProperty("/promptImproverImprovedPrompt", sImproved);
        oModel.setProperty("/promptImproverAwaitingRun", true);

        var sDisplayMsg = "Javitott prompt:\n\n" +
          sImproved +
          (sAssistant ? "\n\n---\n" + sAssistant : "") +
          "\n\n---\nFuttathatom-e a fenti javitott promptot? (Valaszolj 'igen' vagy 'nem'-mel.)";

        this._appendNoah2Message("assistant", sDisplayMsg);
        this._setState2(STATE.CARD_INPUT_REQUIRED, "Prompt javitva. Var megerositesre.");
      } catch (oError) {
        if (oError && oError.name === "AbortError") {
          this._setState2(STATE.IDLE, "Prompt javitas megszakitva.");
          return;
        }
        this._setError2(oError);
      } finally {
        oModel.setProperty("/promptImproverBusy", false);
      }
    },

    // ─────────────────────────────────────────────────────────────────
    // KULDES - fo uzenet kuldesi logika
    // ─────────────────────────────────────────────────────────────────
    onSendNoah2: async function() {
      var oModel = this.getView().getModel("noah2");
      var sMessage = (oModel.getProperty("/draftMessage") || "").trim();
      var aAttachments = this._getAttachments2Payload();
      var oPending = oModel.getProperty("/pendingConfirmation");
      var sManualCardId = String(oModel.getProperty("/manualSelectedCardId") || "").trim();
      var bAgentEnabled = !!oModel.getProperty("/agentEnabled");
      var bImproverAwaiting = !!oModel.getProperty("/promptImproverAwaitingRun");

      if (!sMessage && aAttachments.length === 0 && !sManualCardId) {
        return;
      }

      // --- Prompt javito varakozo allapot ---
      if (bImproverAwaiting) {
        var sLowerImp = sMessage.toLowerCase();
        this._appendNoah2Message("user", sMessage);
        oModel.setProperty("/draftMessage", "");

        if (sLowerImp === "igen" || sLowerImp === "ok" || sLowerImp === "futtasd" || sLowerImp === "igen, futtasd") {
          var sImprovedPrompt = String(oModel.getProperty("/promptImproverImprovedPrompt") || "");
          oModel.setProperty("/promptImproverAwaitingRun", false);
          oModel.setProperty("/promptImproverImprovedPrompt", "");

          if (!sImprovedPrompt) {
            this._appendNoah2Message("assistant", "Nem talaltam javitott promptot. Kerlek probalj ujra.");
            this._setState2(STATE.IDLE, "Kesz.");
            return;
          }

          // A javitott promptot futtatjuk le mint normál uzenet
          this._appendNoah2Message("assistant", "Rendben, futtatom a javitott promptot...");
          await this._runNoah2WithMessage(sImprovedPrompt, aAttachments, sManualCardId, bAgentEnabled);
          return;
        }

        if (sLowerImp === "nem" || sLowerImp === "megsem" || sLowerImp === "ne futtasd") {
          oModel.setProperty("/promptImproverAwaitingRun", false);
          oModel.setProperty("/promptImproverImprovedPrompt", "");
          this._appendNoah2Message("assistant", "Rendben, nem futtatom a javitott promptot. Irj uj uzenetet ha kesz vagy.");
          this._setState2(STATE.IDLE, "Prompt javitas elutasitva.");
          return;
        }

        // Egyeb valasz: normal send-kent kezeljuk
        oModel.setProperty("/promptImproverAwaitingRun", false);
        oModel.setProperty("/promptImproverImprovedPrompt", "");
        await this._runNoah2WithMessage(sMessage, aAttachments, sManualCardId, bAgentEnabled);
        return;
      }

      // --- Normal kuldesi flow ---
      if (oPending && !bAgentEnabled) {
        var sLower = sMessage.toLowerCase();
        if (sLower === "igen" || sLower === "ok" || sLower === "futtasd") {
          oModel.setProperty("/draftMessage", "");
          this._appendNoah2Message("user", sMessage);
          await this.onConfirmCard2Yes();
          return;
        }
        if (sLower === "nem" || sLower === "megsem") {
          oModel.setProperty("/draftMessage", "");
          this._appendNoah2Message("user", sMessage);
          this.onConfirmCard2No();
          return;
        }
      }

      this._appendNoah2Message("user", this._buildUserMsg2WithAttachments(sMessage, aAttachments));
      oModel.setProperty("/draftMessage", "");
      oModel.setProperty("/error", "");

      await this._runNoah2WithMessage(sMessage, aAttachments, sManualCardId, bAgentEnabled);
    },

    /**
     * Kozos belso kuldesi logika (prompt javito es normal kuldesnél is hasznalt)
     */
    _runNoah2WithMessage: async function(sMessage, aAttachments, sManualCardId, bAgentEnabled) {
      if (bAgentEnabled) {
        var oModel = this.getView().getModel("noah2");
        try {
          await this._planAgent2Flow(sMessage, !!oModel.getProperty("/agentApprovalPending"));
        } catch (oAgentError) {
          if (oAgentError && oAgentError.name === "AbortError") {
            this._setState2(STATE.IDLE, "Folyamat megszakitva.");
            return;
          }
          this._setError2(oAgentError);
        }
        return;
      }

      if (sManualCardId) {
        try {
          var oManualCard = await this._loadCard2ById(sManualCardId);
          this._pushManualRouter2Log(oManualCard);
          await this._prefillManualCard2AndRun(sManualCardId, sMessage, aAttachments);
        } catch (oManualError) {
          if (oManualError && oManualError.name === "AbortError") {
            this._setState2(STATE.IDLE, "Folyamat megszakitva.");
            return;
          }
          this._setError2(oManualError);
        }
        return;
      }

      // Automatikus router
      this._setState2(STATE.ROUTING, "Szandek felismerese folyamatban...");

      try {
        this._activeAbortController = new AbortController();
        var oRoute = await AiService.noahRoute({
          user_message: sMessage,
          attachments: aAttachments,
          history: this._getHistory2Payload()
        }, this._activeAbortController.signal);
        this._pushRouter2Log(oRoute);

        if (oRoute.selected_card_id) {
          await this._loadCard2AndContinue(oRoute, sMessage);
        } else {
          await this._runFallback2Chat(sMessage, aAttachments);
        }
      } catch (oError) {
        if (oError && oError.name === "AbortError") {
          this._setState2(STATE.IDLE, "Folyamat megszakitva.");
          return;
        }
        this._setError2(oError);
      } finally {
        this._activeAbortController = null;
      }
    },

    // ─────────────────────────────────────────────────────────────────
    // AGENT TOGGLE
    // ─────────────────────────────────────────────────────────────────
    onNoah2AgentToggle: function(oEvent) {
      var oModel = this.getView().getModel("noah2");
      var bState = !!(oEvent && oEvent.getParameter ? oEvent.getParameter("state") : false);
      oModel.setProperty("/agentEnabled", bState);
      // Agent bekapcsolasanal: kartya valaszto visszaall, kartyapanel eltuntetese
      if (bState) {
        oModel.setProperty("/manualSelectedCardId", "");
        oModel.setProperty("/activeCard", null);
        oModel.setProperty("/activeCardRuntimeFields", []);
        oModel.setProperty("/dummy4PreviewRows", []);
        oModel.setProperty("/dummy4GeneratedSql", "");
        this._rebindNoah2Dummy4PreviewTable();
        this._resetNoah2Dummy4Chart();
      }
      this._resetAgent2Plan();
      this._setState2(STATE.IDLE,
        bState ? "Agent mode aktiv. Irj le egy problemat, en lepesenkenti tervet kesztek." : "Automatikus router mod.");
    },

    // ─────────────────────────────────────────────────────────────────
    // AGENT - TERV GENERALAS
    // ─────────────────────────────────────────────────────────────────
    _planAgent2Flow: async function(sMessage, bIsFeedback) {
      var oModel = this.getView().getModel("noah2");
      var sProblem = String(oModel.getProperty("/agentProblemStatement") || "").trim();
      var oCurrentPlan = oModel.getProperty("/agentPlan");
      var aConstraints = oModel.getProperty("/agentConstraints") || [];
      var aExcluded = (oCurrentPlan && Array.isArray(oCurrentPlan.excluded_card_ids)
        ? oCurrentPlan.excluded_card_ids : []).concat(aConstraints);

      if (!bIsFeedback || !sProblem) {
        sProblem = sMessage;
        oModel.setProperty("/agentProblemStatement", sProblem);
        aExcluded = [];
        oModel.setProperty("/agentConstraints", []);
        oModel.setProperty("/agentStepResults", []);
      }

      oModel.setProperty("/agentBusy", true);
      oModel.setProperty("/agentApprovalPending", false);
      this._setState2(STATE.ROUTING, bIsFeedback ? "Agent terv ujratervezese..." : "Agent reasoning folyamatban...");

      try {
        this._activeAbortController = new AbortController();
        var oPlan = await AiService.noahAgentPlan({
          user_message: sProblem,
          attachments: this._getAttachments2Payload(),
          history: this._getHistory2Payload(),
          feedback: bIsFeedback ? sMessage : "",
          current_plan: oCurrentPlan,
          excluded_card_ids: aExcluded
        }, this._activeAbortController.signal);

        // Lepesek gazdagitasa lepesenkenti futtatasi adatokkal
        if (oPlan && Array.isArray(oPlan.steps)) {
          oPlan.steps = oPlan.steps.map(function(oStep, iIdx) {
            return Object.assign({}, oStep, {
              _index: iIdx,
              _status: "pending",
              _canRunNow: iIdx === 0 && !!oPlan.can_run,
              missing_required_fields: oStep.missing_required_fields || [],
              missing_required_labels: oStep.missing_required_labels || "",
              planned_inputs: oStep.planned_inputs || []
            });
          });
        }

        oModel.setProperty("/agentPlan", oPlan || null);
        oModel.setProperty("/agentConstraints", oPlan && oPlan.excluded_card_ids ? oPlan.excluded_card_ids : []);
        oModel.setProperty("/agentApprovalPending", oPlan && oPlan.steps && oPlan.steps.length > 0);

        if (oPlan && oPlan.can_run) {
          this._appendNoah2Message("assistant",
            "Elkeszult az agent terv " + (oPlan.steps ? oPlan.steps.length : 0) +
            " lepesssel. Ellenorizd a jobb oldali panelen, majd futtasd a lepeseket egyenkent.");
          this._setState2(STATE.CARD_INPUT_REQUIRED, "Agent terv jovahagyasra var - lepesenkenti futtas.");
        } else {
          this._appendNoah2Message("assistant",
            "Az agent terv elkeszult, de meg hianyzik nehany input. Irj pontositast, es ujratervezem.");
          this._setState2(STATE.CARD_INPUT_REQUIRED, "Agent input kiegeszitest var.");
        }
      } finally {
        oModel.setProperty("/agentBusy", false);
        this._activeAbortController = null;
      }
    },

    // ─────────────────────────────────────────────────────────────────
    // AGENT - LEPESENKENTI FUTTATÁS
    // ─────────────────────────────────────────────────────────────────
    onRunAgentStep: async function(oEvent) {
      var oModel = this.getView().getModel("noah2");
      var oCtx = oEvent && oEvent.getSource ? oEvent.getSource().getBindingContext("noah2") : null;
      var oStep = oCtx ? oCtx.getObject() : null;

      if (!oStep || !oStep._canRunNow) {
        return;
      }

      var iIndex = Number(oStep._index || 0);
      var oPlan = oModel.getProperty("/agentPlan");
      var aSteps = oPlan && Array.isArray(oPlan.steps) ? oPlan.steps : [];
      var aAttachments = this._getAttachments2Payload();
      var aOutputs = oModel.getProperty("/agentStepResults") || [];

      oModel.setProperty("/agentBusy", true);

      // Lepes statuszanak frissitese: fut
      aSteps[iIndex] = Object.assign({}, aSteps[iIndex], { _status: "running", _canRunNow: false });
      oModel.setProperty("/agentPlan/steps", aSteps);

      try {
        // Elozetes lepesek contextjenek osszealitasa
        var sExecutionMessage = this._buildAgent2ExecutionMessage(oStep, aOutputs);

        // Ha ai-chat tipusu lepes (nem kartya), akkor sima chat API-t hasznalunk
        if (!oStep.card_id || oStep.type === "ai-chat") {
          this._activeAbortController = new AbortController();
          var oChatResp = await AiService.noahChat({
            message: sExecutionMessage || oStep.rationale || oModel.getProperty("/agentProblemStatement") || "",
            attachments: aAttachments,
            history: this._getHistory2Payload()
          }, this._activeAbortController.signal);

          var sChatResult = oChatResp && oChatResp.message ? oChatResp.message : "Nincs valasz.";
          this._appendNoah2Message("assistant", "[" + (oStep.card_name || "AI Chat") + "]\n" + sChatResult);

          aOutputs.push({
            card_id: "ai-chat",
            card_name: oStep.card_name || "AI Chat",
            result: sChatResult
          });
        } else {
          // Kártyalapú lépés futtatása
          await this._loadCard2ById(oStep.card_id);
          this._applyPrefill2ValuesToRuntimeFields(oStep.prefill_values || {});

          var aMissing = this._validateRequired2Fields();
          if (aMissing.length > 0) {
            oModel.setProperty("/agentEditingStepIndex", iIndex);
            this._appendNoah2Message("assistant",
              "Az agent nem tudott tovabblepni. Hianyzik: " + aMissing.join(", "));
            this._setState2(STATE.CARD_INPUT_REQUIRED, "Agent input kiegeszitest var.");
            // Statusz visszaallitasa
            aSteps[iIndex] = Object.assign({}, aSteps[iIndex], { _status: "pending", _canRunNow: true });
            oModel.setProperty("/agentPlan/steps", aSteps);
            return;
          }

          var oResp = await this._runCard2WithFieldValues(
            oStep.card_id,
            sExecutionMessage,
            this._collectCard2FieldValues(),
            aAttachments,
            true
          );

          aOutputs.push({
            card_id: oStep.card_id,
            card_name: oResp && oResp.card_name ? oResp.card_name : oStep.card_name,
            result: oResp && oResp.result ? oResp.result : ""
          });
        }

        oModel.setProperty("/agentStepResults", aOutputs);

        // Lepes kesz
        oModel.setProperty("/agentEditingStepIndex", -1);
        aSteps[iIndex] = Object.assign({}, aSteps[iIndex], { _status: "done", _canRunNow: false });

        // Kovetkezo lepes engedelyezese
        var iNext = iIndex + 1;
        if (iNext < aSteps.length) {
          aSteps[iNext] = Object.assign({}, aSteps[iNext], { _canRunNow: true });
        } else {
          // Minden lepes lefutott
          this._setState2(STATE.IDLE, "Agent terv minden lepese lefutott.");
          this._appendNoah2Message("assistant",
            "Az agent terv mind a " + aSteps.length + " lepese sikeresen lefutott!");
          oModel.setProperty("/agentApprovalPending", false);
        }

        oModel.setProperty("/agentPlan/steps", aSteps);

      } catch (oError) {
        if (oError && oError.name === "AbortError") {
          this._setState2(STATE.IDLE, "Agent lepes megszakitva.");
          aSteps[iIndex] = Object.assign({}, aSteps[iIndex], { _status: "pending", _canRunNow: true });
          oModel.setProperty("/agentPlan/steps", aSteps);
          return;
        }
        this._setError2(oError);
        aSteps[iIndex] = Object.assign({}, aSteps[iIndex], { _status: "pending", _canRunNow: true });
        oModel.setProperty("/agentPlan/steps", aSteps);
      } finally {
        oModel.setProperty("/agentBusy", false);
        this._activeAbortController = null;
      }
    },

    // ─────────────────────────────────────────────────────────────────
    // KARTYA MUVELETEK
    // ─────────────────────────────────────────────────────────────────
    onNoah2FileChange: function(oEvent) {
      var aFiles = oEvent && oEvent.getParameter ? oEvent.getParameter("files") : [];
      this._appendFiles2AsAttachments(aFiles || []);
    },

    onRefreshCard2FieldDefault: async function(oEvent) {
      var oModel = this.getView().getModel("noah2");
      var oCard = oModel.getProperty("/activeCard");
      var oCtx = oEvent && oEvent.getSource ? oEvent.getSource().getBindingContext("noah2") : null;
      var oField = oCtx ? oCtx.getObject() : null;
      var sFieldId = oField && oField.field_id ? String(oField.field_id) : "";

      if (!oCard || !oCard.id || !sFieldId) {
        return;
      }

      try {
        this._setState2(STATE.CARD_LOADING, "Mezo frissitese folyamatban...");
        this._activeAbortController = new AbortController();
        var oCardResp = await AiService.noahGetCardConfig(oCard.id, this._activeAbortController.signal);
        var mDefaults = oCardResp && oCardResp.default_field_values ? oCardResp.default_field_values : {};

        if (!Object.prototype.hasOwnProperty.call(mDefaults, sFieldId)) {
          this._setState2(STATE.CARD_INPUT_REQUIRED, "Nincs uj ertek ehhez a mezohoz.");
          MessageToast.show("Nincs uj ertek a \"" + sFieldId + "\" mezohoz.");
          return;
        }

        this._applyPrefill2ValuesToRuntimeFields((function() {
          var out = {};
          out[sFieldId] = mDefaults[sFieldId];
          return out;
        })());

        this._setState2(STATE.CARD_INPUT_REQUIRED, "Mezo frissitve.");
        MessageToast.show("A mezo frissult a legfrissebb schema alapjan.");
      } catch (oError) {
        if (oError && oError.name === "AbortError") {
          this._setState2(STATE.IDLE, "Frissites megszakitva.");
          return;
        }
        this._setError2(oError);
      } finally {
        this._activeAbortController = null;
      }
    },

    onManualCard2SelectChange: async function(oEvent) {
      var sCardId = String(oEvent && oEvent.getSource ? oEvent.getSource().getSelectedKey() : "").trim();
      var oModel = this.getView().getModel("noah2");

      if (!sCardId) {
        oModel.setProperty("/activeCard", null);
        oModel.setProperty("/activeCardRuntimeFields", []);
        oModel.setProperty("/dummy4PreviewRows", []);
        oModel.setProperty("/dummy4GeneratedSql", "");
        oModel.setProperty("/dummy4Summary", "");
        oModel.setProperty("/dummy4ChartAvailable", false);
        oModel.setProperty("/schemaHintExpanded", false);
        this._rebindNoah2Dummy4PreviewTable();
        this._resetNoah2Dummy4Chart();
        this._setState2(STATE.IDLE, "Automatikus router mod.");
        return;
      }

      try {
        await this._loadCard2ById(sCardId);
        this._setState2(STATE.CARD_INPUT_REQUIRED, "Kartya betoltve. Add meg a mezoertekeket, vagy kuld uzenetet.");
      } catch (oError) {
        this._setError2(oError);
      }
    },

    onRemoveAttachment2: function(oEvent) {
      var oCtx = oEvent.getSource().getBindingContext("noah2");
      if (!oCtx) {
        return;
      }
      var oModel = this.getView().getModel("noah2");
      var sPath = oCtx.getPath();
      var aAttachments = oModel.getProperty("/attachments") || [];
      var iIndex = parseInt(sPath.split("/").pop(), 10);
      if (isNaN(iIndex) || iIndex < 0 || iIndex >= aAttachments.length) {
        return;
      }
      aAttachments.splice(iIndex, 1);
      oModel.setProperty("/attachments", aAttachments);
    },

    onRunActiveCard2: async function() {
      var oModel = this.getView().getModel("noah2");
      var oCard = oModel.getProperty("/activeCard");
      if (!oCard || !oCard.id) {
        return;
      }
      if (oModel.getProperty("/agentEnabled") && Number(oModel.getProperty("/agentEditingStepIndex")) >= 0) {
        await this._continueAgent2StepWithCurrentCard();
        return;
      }
      await this._runCard2(oCard.id, (oModel.getProperty("/draftMessage") || "").trim());
    },

    onConfirmCard2Yes: async function() {
      var oModel = this.getView().getModel("noah2");
      var oPending = oModel.getProperty("/pendingConfirmation");
      var oCard = oModel.getProperty("/activeCard");
      oModel.setProperty("/pendingConfirmation", null);
      if (!oPending || !oCard || !oCard.id) {
        return;
      }
      await this._runCard2(oCard.id, oPending.originalMessage || "");
    },

    onConfirmCard2No: function() {
      var oModel = this.getView().getModel("noah2");
      oModel.setProperty("/pendingConfirmation", null);
      this._appendNoah2Message("assistant",
        "Rendben, nem futtatom a kartyat. Irj pontosabban, vagy folytatom normal chat modban.");
      this._setState2(STATE.CARD_INPUT_REQUIRED, "Kartya megerosites elutasitva.");
    },

    onCancelRun2: function() {
      if (this._activeAbortController) {
        this._activeAbortController.abort();
        this._activeAbortController = null;
      }
      this._setState2(STATE.IDLE, "Folyamat megszakitva.");
    },

    onCopyNoah2Message: async function(oEvent) {
      var oCtx = oEvent.getSource().getBindingContext("noah2");
      var oMsg = oCtx ? oCtx.getObject() : null;
      var sText = String(oMsg && oMsg.content ? oMsg.content : "");
      if (!sText) {
        return;
      }
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(sText);
        } else {
          this._copyText2Fallback(sText);
        }
        MessageToast.show("AI valasz masolva.");
      } catch (_e) {
        try {
          this._copyText2Fallback(sText);
          MessageToast.show("AI valasz masolva.");
        } catch (_fallbackErr) {
          MessageToast.show("Masolas nem sikerult.");
        }
      }
    },

    // ─────────────────────────────────────────────────────────────────
    // BELSO KARTYA MUVELETEK
    // ─────────────────────────────────────────────────────────────────
    _loadCard2AndContinue: async function(oRoute, sOriginalMessage) {
      var oModel = this.getView().getModel("noah2");
      this._setState2(STATE.CARD_LOADING,
        "Kartya betoltese: " + (oRoute.ui_hint || oRoute.selected_card_id) + "...");

      var oCard = await this._loadCard2ById(oRoute.selected_card_id);
      var aDefaultPrefill = this._runtimeFields2ToPrefill(oModel.getProperty("/activeCardRuntimeFields") || []);
      var aRoutePrefill = (oRoute.required_fields || []).filter(function(item) {
        return item && item.field_id !== "schema_hint";
      });
      var aRuntimeFields = this._buildRuntimeFields2(oCard.fields || [], aDefaultPrefill.concat(aRoutePrefill));
      oModel.setProperty("/activeCard", oCard);
      oModel.setProperty("/activeCardRuntimeFields", aRuntimeFields);

      if (oCard.id === "dummy-4") {
        await this._refreshNoah2Dummy4SchemaHint();
      }

      if (oRoute.needs_confirmation || Number(oRoute.confidence || 0) < 0.55) {
        oModel.setProperty("/pendingConfirmation", { originalMessage: sOriginalMessage });
        this._appendNoah2Message("assistant",
          "Alacsony bizonyossag. Futtassam ezt a kartyat: " + oCard.name + "?");
        this._setState2(STATE.CARD_INPUT_REQUIRED, "Var megerositesre.");
        return;
      }

      await this._runCard2(oCard.id, sOriginalMessage);
    },

    _refreshNoah2Dummy4SchemaHint: async function() {
      var oModel = this.getView().getModel("noah2");
      var oCard = oModel.getProperty("/activeCard");
      if (!oCard || oCard.id !== "dummy-4") {
        return;
      }
      this._activeAbortController = new AbortController();
      var oCardResp = await AiService.noahGetCardConfig(oCard.id, this._activeAbortController.signal);
      var mDefaults = oCardResp && oCardResp.default_field_values ? oCardResp.default_field_values : {};
      if (!Object.prototype.hasOwnProperty.call(mDefaults, "schema_hint")) {
        return;
      }
      this._applyPrefill2ValuesToRuntimeFields({ schema_hint: mDefaults.schema_hint });
    },

    _runCard2: async function(sCardId, sMessage) {
      var aAttachments = this._getAttachments2Payload();
      var aMissing = this._validateRequired2Fields();
      if (aMissing.length > 0) {
        this._setState2(STATE.CARD_INPUT_REQUIRED,
          "Hianyzo kotelezo mezok: " + aMissing.join(", "));
        return;
      }
      try {
        await this._runCard2WithFieldValues(
          sCardId, sMessage, this._collectCard2FieldValues(), aAttachments, false);
      } catch (oError) {
        if (oError && oError.name === "AbortError") {
          this._setState2(STATE.IDLE, "Kartya futtatasa megszakitva.");
          return;
        }
        this._setError2(oError);
      }
    },

    _runFallback2Chat: async function(sMessage, aAttachments) {
      this._setState2(STATE.CHATTING, "Normal AI valasz keszitese...");
      try {
        this._activeAbortController = new AbortController();
        var oResp = await AiService.noahChat({
          message: sMessage || "",
          attachments: aAttachments || [],
          history: this._getHistory2Payload()
        }, this._activeAbortController.signal);
        this._appendNoah2Message("assistant", oResp && oResp.message ? oResp.message : "Nincs valasz.");
        this._clearComposer2AfterRun();
        this._setState2(STATE.IDLE, "Kesz.");
      } catch (oError) {
        if (oError && oError.name === "AbortError") {
          this._setState2(STATE.IDLE, "Chat megszakitva.");
          return;
        }
        this._setError2(oError);
      }
    },

    _runCard2WithFieldValues: async function(sCardId, sMessage, mFieldValues, aAttachments, bPreserveComposer) {
      var oModel = this.getView().getModel("noah2");
      this._setState2(STATE.RUNNING_CARD, "Kartya futtatasa folyamatban...");
      oModel.setProperty("/error", "");

      try {
        this._activeAbortController = new AbortController();
        var oResp = await AiService.noahRunCard({
          card_id: sCardId,
          user_message: sMessage || "",
          field_values: mFieldValues || {},
          attachments: aAttachments || []
        }, this._activeAbortController.signal);

        // dummy-4 eseten chart betoltese, SQL nelkul
        this._applyCard2SpecificPayload(sCardId, oResp && oResp.payload ? oResp.payload : null);
        this._appendNoah2Message("assistant",
          "[" + (oResp.card_name || sCardId) + "]\n" + (oResp.result || "Nincs valasz."));

        if (!bPreserveComposer) {
          this._clearComposer2AfterRun();
        }
        this._setState2(STATE.IDLE, "Kartya lefutott.");
        return oResp;
      } finally {
        this._activeAbortController = null;
      }
    },

    // ─────────────────────────────────────────────────────────────────
    // DUMMY-4 CHART (SQL NELKUL)
    // ─────────────────────────────────────────────────────────────────

    /**
     * dummy-4 payload kezelese: chart rendereles + tabla, SQL NELKUL
     */
    _applyCard2SpecificPayload: function(sCardId, oPayload) {
      var oModel = this.getView().getModel("noah2");
      if (sCardId === "dummy-4" && oPayload) {
        var aRows = Array.isArray(oPayload.rows) ? oPayload.rows : [];
        oModel.setProperty("/dummy4PreviewRows", aRows);
        oModel.setProperty("/dummy4Summary", String(oPayload.summary || ""));
        // Szandekosan NEM allitjuk be a dummy4GeneratedSql-t (3-as kovetelmenyek)
        this._rebindNoah2Dummy4PreviewTable();
        this._renderNoah2Dummy4Chart(aRows);
        return;
      }
      oModel.setProperty("/dummy4PreviewRows", []);
      oModel.setProperty("/dummy4GeneratedSql", "");
      oModel.setProperty("/dummy4Summary", "");
      oModel.setProperty("/dummy4ChartAvailable", false);
      this._rebindNoah2Dummy4PreviewTable();
      this._resetNoah2Dummy4Chart();
    },

    _renderNoah2Dummy4Chart: function(aRows) {
      var oHost = this.byId("noah2Dummy4ChartHost");
      var aColumns = this._extractNoah2Columns(aRows);
      var aNumericCols = this._findNoah2NumericColumns(aRows, aColumns);
      var sMeasure = aNumericCols[0] || "";
      var sDimension = aColumns.find(function(sCol) {
        return sCol !== sMeasure;
      }) || aColumns[0] || "";

      this._resetNoah2Dummy4Chart();

      if (!oHost || !sDimension || !sMeasure || aRows.length === 0) {
        this.getView().getModel("noah2").setProperty("/dummy4ChartAvailable", false);
        return;
      }

      var aChartRows = (aRows || []).map(function(oRow) {
        var oCopy = Object.assign({}, oRow || {});
        oCopy[sMeasure] = this._toNoah2Number(oCopy[sMeasure]);
        return oCopy;
      }.bind(this));

      var oChartModel = new JSONModel({ rows: aChartRows });

      var oDataset = new FlattenedDataset({
        dimensions: [new DimensionDefinition({ name: sDimension, value: "{" + sDimension + "}" })],
        measures: [new MeasureDefinition({ name: sMeasure, value: "{" + sMeasure + "}" })],
        data: { path: "/rows" }
      });

      var oViz = new VizFrame({
        width: "100%",
        height: "280px",
        vizType: "column",
        dataset: oDataset
      });

      oViz.setModel(oChartModel);
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
        plotArea: { dataLabel: { visible: true } }
      });

      oHost.addItem(oViz);
      this.getView().getModel("noah2").setProperty("/dummy4ChartAvailable", true);
    },

    _resetNoah2Dummy4Chart: function() {
      var oHost = this.byId("noah2Dummy4ChartHost");
      if (oHost) {
        oHost.removeAllItems();
      }
      this.getView().getModel("noah2").setProperty("/dummy4ChartAvailable", false);
    },

    _rebindNoah2Dummy4PreviewTable: function() {
      var oTable = this.byId("noah2Dummy4PreviewTable");
      var oModel = this.getView().getModel("noah2");
      var aRows = oModel ? (oModel.getProperty("/dummy4PreviewRows") || []) : [];

      if (!oTable) {
        return;
      }

      oTable.unbindItems();
      oTable.removeAllColumns();

      var aColumns = this._extractNoah2Columns(aRows);
      if (aColumns.length === 0) {
        return;
      }

      aColumns.forEach(function(sName) {
        oTable.addColumn(new Column({ header: new Text({ text: sName }) }));
      });

      var aCells = aColumns.map(function(sName) {
        return new Text({ text: "{noah2>" + sName + "}", wrapping: true });
      });

      oTable.bindItems({
        path: "noah2>/dummy4PreviewRows",
        template: new ColumnListItem({ cells: aCells }),
        templateShareable: false
      });
    },

    // ─────────────────────────────────────────────────────────────────
    // SEGÉDFÜGGVÉNYEK
    // ─────────────────────────────────────────────────────────────────
    _buildAgent2ExecutionMessage: function(oStep, aOutputs) {
      var oModel = this.getView().getModel("noah2");
      var sProblem = String(oModel.getProperty("/agentProblemStatement") || "").trim();
      var sOutputSummary = (aOutputs || []).map(function(item) {
        return "[" + (item.card_name || item.card_id || "lepes") + "] " + (item.result || "");
      }).join("\n\n");

      return [
        "Eredeti problema:",
        sProblem || "(nincs)",
        "",
        "Aktualis lepesterv:",
        (oStep && oStep.rationale) ? oStep.rationale : "",
        "",
        sOutputSummary ? ("Korabbi lepesek outputja:\n" + sOutputSummary) : ""
      ].filter(Boolean).join("\n");
    },

    _continueAgent2StepWithCurrentCard: async function() {
      var oModel = this.getView().getModel("noah2");
      var iIndex = Number(oModel.getProperty("/agentEditingStepIndex"));
      var oPlan = oModel.getProperty("/agentPlan");
      var aSteps = oPlan && Array.isArray(oPlan.steps) ? oPlan.steps : [];
      var oStep = aSteps[iIndex];
      var oCard = oModel.getProperty("/activeCard");
      var aAttachments = this._getAttachments2Payload();
      var aOutputs = oModel.getProperty("/agentStepResults") || [];

      if (iIndex < 0 || !oStep || !oCard || !oCard.id) {
        return;
      }

      var aMissing = this._validateRequired2Fields();
      if (aMissing.length > 0) {
        this._appendNoah2Message("assistant", "Az agent lepeshez tovabbra is hianyzik: " + aMissing.join(", "));
        this._setState2(STATE.CARD_INPUT_REQUIRED, "Agent input kiegeszitest var.");
        return;
      }

      oModel.setProperty("/agentBusy", true);
      aSteps[iIndex] = Object.assign({}, aSteps[iIndex], { _status: "running", _canRunNow: false });
      oModel.setProperty("/agentPlan/steps", aSteps);

      try {
        var sExecutionMessage = this._buildAgent2ExecutionMessage(oStep, aOutputs);
        var oResp = await this._runCard2WithFieldValues(
          oCard.id,
          sExecutionMessage,
          this._collectCard2FieldValues(),
          aAttachments,
          true
        );

        aOutputs.push({
          card_id: oStep.card_id,
          card_name: oResp && oResp.card_name ? oResp.card_name : oStep.card_name,
          result: oResp && oResp.result ? oResp.result : ""
        });
        oModel.setProperty("/agentStepResults", aOutputs);
        oModel.setProperty("/agentEditingStepIndex", -1);

        aSteps[iIndex] = Object.assign({}, aSteps[iIndex], { _status: "done", _canRunNow: false });
        if ((iIndex + 1) < aSteps.length) {
          aSteps[iIndex + 1] = Object.assign({}, aSteps[iIndex + 1], { _canRunNow: true });
        } else {
          this._setState2(STATE.IDLE, "Agent terv minden lepese lefutott.");
          this._appendNoah2Message("assistant", "Az agent terv mind a " + aSteps.length + " lepese sikeresen lefutott!");
          oModel.setProperty("/agentApprovalPending", false);
        }
        oModel.setProperty("/agentPlan/steps", aSteps);
      } catch (oError) {
        if (oError && oError.name === "AbortError") {
          this._setState2(STATE.IDLE, "Agent lepes megszakitva.");
        } else {
          this._setError2(oError);
        }
        aSteps[iIndex] = Object.assign({}, aSteps[iIndex], { _status: "pending", _canRunNow: true });
        oModel.setProperty("/agentPlan/steps", aSteps);
      } finally {
        oModel.setProperty("/agentBusy", false);
      }
    },

    _resetAgent2Plan: function() {
      var oModel = this.getView().getModel("noah2");
      oModel.setProperty("/agentPlan", null);
      oModel.setProperty("/agentConstraints", []);
      oModel.setProperty("/agentApprovalPending", false);
      oModel.setProperty("/agentBusy", false);
      oModel.setProperty("/agentProblemStatement", "");
      oModel.setProperty("/agentStepResults", []);
      oModel.setProperty("/agentEditingStepIndex", -1);
    },

    _bindDrop2ZoneEvents: function() {
      if (this._boundDropHandlers) {
        return;
      }
      var oDropZone = this.byId("noah2DropZone");
      if (!oDropZone || !oDropZone.getDomRef()) {
        return;
      }
      var dom = oDropZone.getDomRef();
      var that = this;

      dom.addEventListener("dragover", function(ev) {
        ev.preventDefault();
        dom.classList.add("noahDropZoneActive");
      });
      dom.addEventListener("dragleave", function() {
        dom.classList.remove("noahDropZoneActive");
      });
      dom.addEventListener("drop", function(ev) {
        ev.preventDefault();
        dom.classList.remove("noahDropZoneActive");
        var files = ev.dataTransfer && ev.dataTransfer.files ? ev.dataTransfer.files : [];
        that._appendFiles2AsAttachments(files);
      });

      this._boundDropHandlers = true;
    },

    _appendFiles2AsAttachments: function(aFilesLike) {
      var oModel = this.getView().getModel("noah2");
      var aCurrent = oModel.getProperty("/attachments") || [];
      var aFiles = Array.prototype.slice.call(aFilesLike || []);
      var mSeen = {};

      aCurrent.forEach(function(item) {
        mSeen[item.name + "|" + item.size + "|" + item.type] = true;
      });

      aFiles.forEach(function(oFile) {
        var oMeta = {
          name: oFile.name || "unknown",
          type: oFile.type || "application/octet-stream",
          size: Number(oFile.size || 0)
        };
        var sKey = oMeta.name + "|" + oMeta.size + "|" + oMeta.type;
        if (!mSeen[sKey]) {
          mSeen[sKey] = true;
          aCurrent.push(oMeta);
        }
      });

      oModel.setProperty("/attachments", aCurrent);
      MessageToast.show(aFiles.length + " fajl hozzaadva.");
    },

    _buildRuntimeFields2: function(aCardFields, aRequiredFields) {
      var mPrefill = {};
      (aRequiredFields || []).forEach(function(item) {
        if (item && item.field_id) {
          mPrefill[String(item.field_id)] = item.prefill == null ? "" : String(item.prefill);
        }
      });
      return (aCardFields || []).map(function(field) {
        var sId = String(field.field_id || "");
        return {
          field_id: sId,
          label: field.label || sId,
          type: field.type || "text",
          required: !!field.required,
          placeholder: field.placeholder || "",
          validation: field.validation || {},
          value: Object.prototype.hasOwnProperty.call(mPrefill, sId) ? mPrefill[sId] : ""
        };
      });
    },

    _validateRequired2Fields: function() {
      var oModel = this.getView().getModel("noah2");
      var aFields = oModel.getProperty("/activeCardRuntimeFields") || [];
      return aFields.filter(function(field) {
        return field.required && !String(field.value || "").trim();
      }).map(function(field) {
        return field.label || field.field_id;
      });
    },

    _collectCard2FieldValues: function() {
      var oModel = this.getView().getModel("noah2");
      var aFields = oModel.getProperty("/activeCardRuntimeFields") || [];
      var out = {};
      aFields.forEach(function(field) {
        out[field.field_id] = String(field.value == null ? "" : field.value).trim();
      });
      return out;
    },

    _getHistory2Payload: function() {
      var oModel = this.getView().getModel("noah2");
      return (oModel.getProperty("/messages") || []).map(function(item) {
        return { role: item.role, content: item.content };
      });
    },

    _getAttachments2Payload: function() {
      var oModel = this.getView().getModel("noah2");
      return (oModel.getProperty("/attachments") || []).map(function(file) {
        return { name: file.name, type: file.type, size: Number(file.size || 0) };
      });
    },

    _buildUserMsg2WithAttachments: function(sMessage, aAttachments) {
      var sText = String(sMessage || "");
      if (!aAttachments || aAttachments.length === 0) {
        return sText;
      }
      var sMeta = aAttachments.map(function(file) {
        return file.name + " (" + file.type + ", " + file.size + " B)";
      }).join(", ");
      return sText + "\n\n[Csatolmanyok: " + sMeta + "]";
    },

    _copyText2Fallback: function(sText) {
      var oTextArea = document.createElement("textarea");
      oTextArea.value = String(sText || "");
      oTextArea.setAttribute("readonly", "readonly");
      oTextArea.style.position = "fixed";
      oTextArea.style.left = "-9999px";
      document.body.appendChild(oTextArea);
      oTextArea.select();
      document.execCommand("copy");
      document.body.removeChild(oTextArea);
    },

    _appendNoah2Message: function(sRole, sContent) {
      var oModel = this.getView().getModel("noah2");
      var aMessages = oModel.getProperty("/messages") || [];
      aMessages.push({ role: sRole, content: String(sContent || "") });
      oModel.setProperty("/messages", aMessages);
      this._scrollNoah2ChatToBottom();
    },

    _pushRouter2Log: function(oRoute) {
      var oModel = this.getView().getModel("noah2");
      var aLog = oModel.getProperty("/routerLog") || [];
      aLog.unshift({
        selected_card_id: oRoute.selected_card_id,
        confidence: Number(oRoute.confidence || 0).toFixed(2),
        rationale_short: oRoute.rationale_short || "",
        timestamp: new Date().toLocaleString("hu-HU")
      });
      oModel.setProperty("/routerLog", aLog.slice(0, 20));
    },

    _pushManualRouter2Log: function(oCard) {
      var oModel = this.getView().getModel("noah2");
      var aLog = oModel.getProperty("/routerLog") || [];
      aLog.unshift({
        selected_card_id: oCard && oCard.id ? oCard.id : "manual",
        confidence: "1.00",
        rationale_short: "Manuálisan kiválasztva: " + (oCard && oCard.name ? oCard.name : "ismeretlen"),
        timestamp: new Date().toLocaleString("hu-HU")
      });
      oModel.setProperty("/routerLog", aLog.slice(0, 20));
    },

    _scrollNoah2ChatToBottom: function() {
      var oPanel = this.byId("noah2ChatPanel");
      if (!oPanel || !oPanel.getDomRef()) {
        return;
      }
      setTimeout(function() {
        var dom = oPanel.getDomRef();
        if (dom) {
          var oLastMessage = dom.querySelector(".sapMLIB:last-child");
          if (oLastMessage && oLastMessage.scrollIntoView) {
            oLastMessage.scrollIntoView({ block: "end", inline: "nearest" });
          } else {
            dom.scrollTop = dom.scrollHeight + 9999;
          }
        }
      }, 0);
    },

    _loadCard2ById: async function(sCardId) {
      this._activeAbortController = new AbortController();
      var oCardResp = await AiService.noahGetCardConfig(sCardId, this._activeAbortController.signal);
      var oCard = oCardResp && oCardResp.card ? oCardResp.card : null;
      if (!oCard) {
        throw new Error("Nem sikerult a kartya konfiguracio lekerese.");
      }
      var aDefaultPrefill = this._mapToPrefill2Array(
        oCardResp && oCardResp.default_field_values ? oCardResp.default_field_values : {});
      var oModel = this.getView().getModel("noah2");
      oModel.setProperty("/activeCard", oCard);
      oModel.setProperty("/activeCardRuntimeFields",
        this._buildRuntimeFields2(oCard.fields || [], aDefaultPrefill));
      oModel.setProperty("/schemaHintExpanded", false);
      this._setState2(STATE.CARD_LOADING, "Kartya betoltve: " + oCard.name);
      return oCard;
    },

    _prefillManualCard2AndRun: async function(sCardId, sMessage, aAttachments) {
      var oModel = this.getView().getModel("noah2");
      this._setState2(STATE.CARD_LOADING, "Kartya mezok automatikus kitoltese...");

      this._activeAbortController = new AbortController();
      var oPrefill = await AiService.noahPrefillCard({
        card_id: sCardId,
        user_message: sMessage || "",
        attachments: aAttachments || []
      }, this._activeAbortController.signal);

      var mValues = oPrefill && oPrefill.field_values ? oPrefill.field_values : {};
      this._applyPrefill2ValuesToRuntimeFields(mValues);

      var aMissing = this._validateRequired2Fields();
      if (aMissing.length > 0) {
        this._setState2(STATE.CARD_INPUT_REQUIRED, "Kártya érték megadás szükséges");
        this._appendNoah2Message("assistant", "Kártya érték megadás szükséges: " + aMissing.join(", "));
        return;
      }

      await this._runCard2(sCardId, sMessage || "");
      oModel.setProperty("/manualSelectedCardId", "");
    },

    _loadManualCard2Options: function() {
      var oModel = this.getView().getModel("noah2") || this.getOwnerComponent().getModel("noah2");
      AiService.noahListCards().then(function(oData) {
        var aCards = Array.isArray(oData && oData.cards) ? oData.cards : [];
        var aOptions = [{ id: "", name: "Automatikus router" }].concat(aCards.map(function(card) {
          return { id: card.id, name: card.name };
        }));
        oModel.setProperty("/manualCardOptions", aOptions);
      }).catch(function() {
        oModel.setProperty("/manualCardOptions", [{ id: "", name: "Automatikus router" }]);
      });
    },

    _applyPrefill2ValuesToRuntimeFields: function(mValues) {
      var oModel = this.getView().getModel("noah2");
      var aFields = oModel.getProperty("/activeCardRuntimeFields") || [];
      var aUpdated = aFields.map(function(field) {
        var sId = String(field.field_id || "");
        var hasValue = Object.prototype.hasOwnProperty.call(mValues || {}, sId);
        return Object.assign({}, field, {
          value: hasValue ? String(mValues[sId] == null ? "" : mValues[sId]) : field.value
        });
      });
      oModel.setProperty("/activeCardRuntimeFields", aUpdated);
    },

    _mapToPrefill2Array: function(mValues) {
      var aItems = [];
      var oValues = mValues && typeof mValues === "object" ? mValues : {};
      Object.keys(oValues).forEach(function(key) {
        aItems.push({ field_id: String(key), prefill: oValues[key] == null ? "" : String(oValues[key]) });
      });
      return aItems;
    },

    _runtimeFields2ToPrefill: function(aRuntimeFields) {
      return (aRuntimeFields || []).map(function(field) {
        return {
          field_id: String(field.field_id || ""),
          prefill: field.value == null ? "" : String(field.value)
        };
      }).filter(function(item) { return !!item.field_id; });
    },

    _clearComposer2AfterRun: function() {
      var oModel = this.getView().getModel("noah2");
      oModel.setProperty("/draftMessage", "");
      oModel.setProperty("/attachments", []);
    },

    _setState2: function(sState, sStatus) {
      var oModel = this.getView().getModel("noah2");
      oModel.setProperty("/state", sState);
      oModel.setProperty("/statusText", sStatus || "");
      if (sState !== STATE.ERROR) {
        oModel.setProperty("/error", "");
      }
    },

    _setError2: function(oError) {
      var sMsg = oError && oError.message ? oError.message : "Ismeretlen hiba.";
      var oModel = this.getView().getModel("noah2");
      oModel.setProperty("/error", sMsg);
      this._setState2(STATE.ERROR, "Hiba tortent.");
      MessageToast.show(sMsg);
    },

    // ─────────────────────────────────────────────────────────────────
    // CHART HELPER FUGGVENYEK
    // ─────────────────────────────────────────────────────────────────
    _extractNoah2Columns: function(aRows) {
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

    _findNoah2NumericColumns: function(aRows, aColumns) {
      return (aColumns || []).filter(function(sCol) {
        var bSeen = false;
        var bAllNumeric = true;
        (aRows || []).forEach(function(oRow) {
          var vValue = oRow ? oRow[sCol] : null;
          if (vValue == null || vValue === "") {
            return;
          }
          bSeen = true;
          if (this._toNoah2Number(vValue) == null) {
            bAllNumeric = false;
          }
        }.bind(this));
        return bSeen && bAllNumeric;
      }.bind(this));
    },

    _toNoah2Number: function(vValue) {
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
    }

  });
});
