sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/suite/ui/commons/demo/tutorial/service/AiService",
  "sap/m/Column",
  "sap/m/Text",
  "sap/m/ColumnListItem"
], function(Controller, MessageToast, AiService, Column, Text, ColumnListItem) {
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

  return Controller.extend("sap.suite.ui.commons.demo.tutorial.controller.Noah", {
    onInit: function() {
      this._activeAbortController = null;
      this._boundDropHandlers = false;
      this._loadManualCardOptions();
      this._rebindDummy4PreviewTable();
    },

    onAfterRendering: function() {
      this._bindDropZoneEvents();
      this._scrollChatToBottom();
    },

    onSendNoah: async function() {
      var oModel = this.getView().getModel("noah");
      var sMessage = (oModel.getProperty("/draftMessage") || "").trim();
      var aAttachments = this._getAttachmentsPayload();
      var oPending = oModel.getProperty("/pendingConfirmation");
      var sManualCardId = String(oModel.getProperty("/manualSelectedCardId") || "").trim();

      if (!sMessage && aAttachments.length === 0 && !sManualCardId) {
        return;
      }

      if (oPending) {
        var sLower = sMessage.toLowerCase();
        if (sLower === "igen" || sLower === "ok" || sLower === "futtasd") {
          oModel.setProperty("/draftMessage", "");
          await this.onConfirmCardYes();
          return;
        }
        if (sLower === "nem" || sLower === "megsem") {
          oModel.setProperty("/draftMessage", "");
          this.onConfirmCardNo();
          return;
        }
      }

      this._appendMessage("user", this._buildUserMessageWithAttachments(sMessage, aAttachments));
      oModel.setProperty("/draftMessage", "");
      oModel.setProperty("/error", "");

      if (sManualCardId) {
        try {
          var oManualCard = await this._loadCardById(sManualCardId);
          this._pushManualRouterLog(oManualCard);
          await this._prefillManualCardAndRun(sManualCardId, sMessage, aAttachments);
        } catch (oManualError) {
          if (oManualError && oManualError.name === "AbortError") {
            this._setState(STATE.IDLE, "Folyamat megszakitva.");
            return;
          }
          this._setError(oManualError);
        }
        return;
      }

      this._setState(STATE.ROUTING, "Szandek felismerese folyamatban...");

      try {
        this._activeAbortController = new AbortController();
        var oRoute = await AiService.noahRoute({
          user_message: sMessage,
          attachments: aAttachments,
          history: this._getHistoryPayload()
        }, this._activeAbortController.signal);
        this._pushRouterLog(oRoute);

        if (oRoute.selected_card_id) {
          await this._loadCardAndContinue(oRoute, sMessage);
        } else {
          await this._runFallbackChat(sMessage, aAttachments);
        }
      } catch (oError) {
        if (oError && oError.name === "AbortError") {
          this._setState(STATE.IDLE, "Folyamat megszakitva.");
          return;
        }
        this._setError(oError);
      } finally {
        this._activeAbortController = null;
      }
    },

    onNoahFileChange: function(oEvent) {
      var aFiles = oEvent && oEvent.getParameter ? oEvent.getParameter("files") : [];
      this._appendFilesAsAttachments(aFiles || []);
    },

    onRefreshCardFieldDefault: async function(oEvent) {
      var oModel = this.getView().getModel("noah");
      var oCard = oModel.getProperty("/activeCard");
      var oCtx = oEvent && oEvent.getSource ? oEvent.getSource().getBindingContext("noah") : null;
      var oField = oCtx ? oCtx.getObject() : null;
      var sFieldId = oField && oField.field_id ? String(oField.field_id) : "";

      if (!oCard || !oCard.id || !sFieldId) {
        return;
      }

      try {
        this._setState(STATE.CARD_LOADING, "Mezo frissitese folyamatban...");
        this._activeAbortController = new AbortController();
        var oCardResp = await AiService.noahGetCardConfig(oCard.id, this._activeAbortController.signal);
        var mDefaults = oCardResp && oCardResp.default_field_values ? oCardResp.default_field_values : {};

        if (!Object.prototype.hasOwnProperty.call(mDefaults, sFieldId)) {
          this._setState(STATE.CARD_INPUT_REQUIRED, "Nincs uj ertek ehhez a mezohoz.");
          MessageToast.show("Nincs uj ertek a \"" + sFieldId + "\" mezohöz.");
          return;
        }

        this._applyPrefillValuesToRuntimeFields((function() {
          var out = {};
          out[sFieldId] = mDefaults[sFieldId];
          return out;
        })());

        this._setState(STATE.CARD_INPUT_REQUIRED, "Mezo frissitve.");
        MessageToast.show("A mezo frissult a legfrissebb schema alapjan.");
      } catch (oError) {
        if (oError && oError.name === "AbortError") {
          this._setState(STATE.IDLE, "Frissites megszakitva.");
          return;
        }
        this._setError(oError);
      } finally {
        this._activeAbortController = null;
      }
    },

    onManualCardSelectChange: async function(oEvent) {
      var sCardId = String(oEvent && oEvent.getSource ? oEvent.getSource().getSelectedKey() : "").trim();
      var oModel = this.getView().getModel("noah");

      if (!sCardId) {
        oModel.setProperty("/activeCard", null);
        oModel.setProperty("/activeCardRuntimeFields", []);
        oModel.setProperty("/dummy4PreviewRows", []);
        oModel.setProperty("/dummy4GeneratedSql", "");
        this._rebindDummy4PreviewTable();
        this._setState(STATE.IDLE, "Automatikus router mod.");
        return;
      }

      try {
        await this._loadCardById(sCardId);
        this._setState(STATE.CARD_INPUT_REQUIRED, "Kartya betoltve. Add meg a mezoertekeket, vagy kuld uzenetet.");
      } catch (oError) {
        this._setError(oError);
      }
    },

    onRemoveAttachment: function(oEvent) {
      var oCtx = oEvent.getSource().getBindingContext("noah");
      if (!oCtx) {
        return;
      }

      var oModel = this.getView().getModel("noah");
      var sPath = oCtx.getPath();
      var aAttachments = oModel.getProperty("/attachments") || [];
      var iIndex = parseInt(sPath.split("/").pop(), 10);
      if (isNaN(iIndex) || iIndex < 0 || iIndex >= aAttachments.length) {
        return;
      }
      aAttachments.splice(iIndex, 1);
      oModel.setProperty("/attachments", aAttachments);
    },

    onRunActiveCard: async function() {
      var oModel = this.getView().getModel("noah");
      var oCard = oModel.getProperty("/activeCard");
      if (!oCard || !oCard.id) {
        return;
      }
      await this._runCard(oCard.id, (oModel.getProperty("/draftMessage") || "").trim());
    },

    onConfirmCardYes: async function() {
      var oModel = this.getView().getModel("noah");
      var oPending = oModel.getProperty("/pendingConfirmation");
      var oCard = oModel.getProperty("/activeCard");

      oModel.setProperty("/pendingConfirmation", null);
      if (!oPending || !oCard || !oCard.id) {
        return;
      }
      await this._runCard(oCard.id, oPending.originalMessage || "");
    },

    onConfirmCardNo: function() {
      var oModel = this.getView().getModel("noah");
      oModel.setProperty("/pendingConfirmation", null);
      this._appendMessage("assistant", "Rendben, nem futtatom a kartyat. Irj pontosabban, vagy folytatom normal chat modban.");
      this._setState(STATE.CARD_INPUT_REQUIRED, "Kartya megerosites elutasitva.");
    },

    onCancelRun: function() {
      if (this._activeAbortController) {
        this._activeAbortController.abort();
        this._activeAbortController = null;
      }
      this._setState(STATE.IDLE, "Folyamat megszakitva.");
    },

    _loadCardAndContinue: async function(oRoute, sOriginalMessage) {
      var oModel = this.getView().getModel("noah");
      this._setState(STATE.CARD_LOADING, "Kartya betoltese: " + (oRoute.ui_hint || oRoute.selected_card_id) + "...");

      var oCard = await this._loadCardById(oRoute.selected_card_id);
      var aDefaultPrefill = this._runtimeFieldsToPrefill(oModel.getProperty("/activeCardRuntimeFields") || []);
      var aRoutePrefill = (oRoute.required_fields || []).filter(function(item) {
        return item && item.field_id !== "schema_hint";
      });
      var aRuntimeFields = this._buildRuntimeFields(oCard.fields || [], aDefaultPrefill.concat(aRoutePrefill));
      oModel.setProperty("/activeCard", oCard);
      oModel.setProperty("/activeCardRuntimeFields", aRuntimeFields);

      // Dummy-4 system field must always be refreshed from live DB schema metadata.
      if (oCard.id === "dummy-4") {
        await this._refreshDummy4SchemaHintFromSource();
      }

      if (oRoute.needs_confirmation || Number(oRoute.confidence || 0) < 0.55) {
        oModel.setProperty("/pendingConfirmation", {
          originalMessage: sOriginalMessage
        });
        this._appendMessage("assistant", "Alacsony bizonyossag. Futtassam ezt a kartyat: " + oCard.name + "?");
        this._setState(STATE.CARD_INPUT_REQUIRED, "Var megerositesre.");
        return;
      }

      await this._runCard(oCard.id, sOriginalMessage);
    },

    _refreshDummy4SchemaHintFromSource: async function() {
      var oModel = this.getView().getModel("noah");
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

      this._applyPrefillValuesToRuntimeFields({
        schema_hint: mDefaults.schema_hint
      });
    },

    _runCard: async function(sCardId, sMessage) {
      var oModel = this.getView().getModel("noah");
      var aAttachments = this._getAttachmentsPayload();
      var mFieldValues = this._collectCardFieldValues();
      var aMissing = this._validateRequiredFields();

      if (aMissing.length > 0) {
        this._setState(STATE.CARD_INPUT_REQUIRED, "Hianyzo kotelezo mezok: " + aMissing.join(", "));
        return;
      }

      this._setState(STATE.RUNNING_CARD, "Kartya futtatasa folyamatban...");
      oModel.setProperty("/error", "");

      try {
        this._activeAbortController = new AbortController();
        var oResp = await AiService.noahRunCard({
          card_id: sCardId,
          user_message: sMessage || "",
          field_values: mFieldValues,
          attachments: aAttachments
        }, this._activeAbortController.signal);

        this._applyCardSpecificPayload(sCardId, oResp && oResp.payload ? oResp.payload : null);
        this._appendMessage("assistant", "[" + (oResp.card_name || sCardId) + "]\n" + (oResp.result || "Nincs valasz."));
        this._clearComposerAfterRun();
        this._setState(STATE.IDLE, "Kartya lefutott.");
      } catch (oError) {
        if (oError && oError.name === "AbortError") {
          this._setState(STATE.IDLE, "Kartya futtatasa megszakitva.");
          return;
        }
        this._setError(oError);
      } finally {
        this._activeAbortController = null;
      }
    },

    _runFallbackChat: async function(sMessage, aAttachments) {
      this._setState(STATE.CHATTING, "Normal AI valasz keszitese...");
      try {
        this._activeAbortController = new AbortController();
        var oResp = await AiService.noahChat({
          message: sMessage || "",
          attachments: aAttachments || [],
          history: this._getHistoryPayload()
        }, this._activeAbortController.signal);
        this._appendMessage("assistant", oResp && oResp.message ? oResp.message : "Nincs valasz.");
        this._clearComposerAfterRun();
        this._setState(STATE.IDLE, "Kesz.");
      } catch (oError) {
        if (oError && oError.name === "AbortError") {
          this._setState(STATE.IDLE, "Chat megszakitva.");
          return;
        }
        this._setError(oError);
      }
    },

    _bindDropZoneEvents: function() {
      if (this._boundDropHandlers) {
        return;
      }

      var oDropZone = this.byId("noahDropZone");
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
        that._appendFilesAsAttachments(files);
      });

      this._boundDropHandlers = true;
    },

    _appendFilesAsAttachments: function(aFilesLike) {
      var oModel = this.getView().getModel("noah");
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

    _buildRuntimeFields: function(aCardFields, aRequiredFields) {
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

    _validateRequiredFields: function() {
      var oModel = this.getView().getModel("noah");
      var aFields = oModel.getProperty("/activeCardRuntimeFields") || [];
      return aFields.filter(function(field) {
        return field.required && !String(field.value || "").trim();
      }).map(function(field) {
        return field.label || field.field_id;
      });
    },

    _collectCardFieldValues: function() {
      var oModel = this.getView().getModel("noah");
      var aFields = oModel.getProperty("/activeCardRuntimeFields") || [];
      var out = {};
      aFields.forEach(function(field) {
        out[field.field_id] = String(field.value == null ? "" : field.value).trim();
      });
      return out;
    },

    _getHistoryPayload: function() {
      var oModel = this.getView().getModel("noah");
      return (oModel.getProperty("/messages") || []).map(function(item) {
        return {
          role: item.role,
          content: item.content
        };
      });
    },

    _getAttachmentsPayload: function() {
      var oModel = this.getView().getModel("noah");
      return (oModel.getProperty("/attachments") || []).map(function(file) {
        return {
          name: file.name,
          type: file.type,
          size: Number(file.size || 0)
        };
      });
    },

    _buildUserMessageWithAttachments: function(sMessage, aAttachments) {
      var sText = String(sMessage || "");
      if (!aAttachments || aAttachments.length === 0) {
        return sText;
      }
      var sMeta = aAttachments.map(function(file) {
        return file.name + " (" + file.type + ", " + file.size + " B)";
      }).join(", ");
      return sText + "\n\n[Csatolmanyok: " + sMeta + "]";
    },

    _appendMessage: function(sRole, sContent) {
      var oModel = this.getView().getModel("noah");
      var aMessages = oModel.getProperty("/messages") || [];
      aMessages.push({
        role: sRole,
        content: String(sContent || "")
      });
      oModel.setProperty("/messages", aMessages);
      this._scrollChatToBottom();
    },

    _pushRouterLog: function(oRoute) {
      var oModel = this.getView().getModel("noah");
      var aLog = oModel.getProperty("/routerLog") || [];
      aLog.unshift({
        selected_card_id: oRoute.selected_card_id,
        confidence: Number(oRoute.confidence || 0).toFixed(2),
        rationale_short: oRoute.rationale_short || "",
        timestamp: new Date().toLocaleString("hu-HU")
      });
      oModel.setProperty("/routerLog", aLog.slice(0, 20));
    },

    _scrollChatToBottom: function() {
      var oPanel = this.byId("noahChatPanel");
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

    _loadCardById: async function(sCardId) {
      this._activeAbortController = new AbortController();
      var oCardResp = await AiService.noahGetCardConfig(sCardId, this._activeAbortController.signal);
      var oCard = oCardResp && oCardResp.card ? oCardResp.card : null;
      if (!oCard) {
        throw new Error("Nem sikerult a kartya konfiguracio lekerese.");
      }
      var aDefaultPrefill = this._mapToPrefillArray(oCardResp && oCardResp.default_field_values ? oCardResp.default_field_values : {});
      this.getView().getModel("noah").setProperty("/activeCard", oCard);
      this.getView().getModel("noah").setProperty("/activeCardRuntimeFields", this._buildRuntimeFields(oCard.fields || [], aDefaultPrefill));
      this._setState(STATE.CARD_LOADING, "Kartya betoltve: " + oCard.name);
      return oCard;
    },

    _prefillManualCardAndRun: async function(sCardId, sMessage, aAttachments) {
      var oModel = this.getView().getModel("noah");
      this._setState(STATE.CARD_LOADING, "Kartya mezok automatikus kitoltese...");

      this._activeAbortController = new AbortController();
      var oPrefill = await AiService.noahPrefillCard({
        card_id: sCardId,
        user_message: sMessage || "",
        attachments: aAttachments || []
      }, this._activeAbortController.signal);

      var mValues = oPrefill && oPrefill.field_values ? oPrefill.field_values : {};
      this._applyPrefillValuesToRuntimeFields(mValues);

      var aMissing = this._validateRequiredFields();
      if (aMissing.length > 0) {
        this._setState(STATE.CARD_INPUT_REQUIRED, "Kártya érték megadás szükséges");
        this._appendMessage("assistant", "Kártya érték megadás szükséges");
        return;
      }

      await this._runCard(sCardId, sMessage || "");
      oModel.setProperty("/manualSelectedCardId", "");
    },

    _loadManualCardOptions: function() {
      var oModel = this.getView().getModel("noah") || this.getOwnerComponent().getModel("noah");
      AiService.noahListCards().then(function(oData) {
        var aCards = Array.isArray(oData && oData.cards) ? oData.cards : [];
        var aOptions = [{
          id: "",
          name: "Automatikus router"
        }].concat(aCards.map(function(card) {
          return {
            id: card.id,
            name: card.name
          };
        }));
        oModel.setProperty("/manualCardOptions", aOptions);
      }).catch(function() {
        oModel.setProperty("/manualCardOptions", [{
          id: "",
          name: "Automatikus router"
        }]);
      });
    },

    _pushManualRouterLog: function(oCard) {
      var oModel = this.getView().getModel("noah");
      var aLog = oModel.getProperty("/routerLog") || [];
      aLog.unshift({
        selected_card_id: oCard && oCard.id ? oCard.id : "manual",
        confidence: "1.00",
        rationale_short: "Manuálisan kiválasztva: " + (oCard && oCard.name ? oCard.name : "ismeretlen") + " Joker.",
        timestamp: new Date().toLocaleString("hu-HU")
      });
      oModel.setProperty("/routerLog", aLog.slice(0, 20));
    },

    _applyCardSpecificPayload: function(sCardId, oPayload) {
      var oModel = this.getView().getModel("noah");
      if (sCardId === "dummy-4" && oPayload) {
        var aRows = Array.isArray(oPayload.rows) ? oPayload.rows : [];
        oModel.setProperty("/dummy4PreviewRows", aRows);
        oModel.setProperty("/dummy4GeneratedSql", String(oPayload.generatedSql || ""));
        this._rebindDummy4PreviewTable();
        return;
      }

      oModel.setProperty("/dummy4PreviewRows", []);
      oModel.setProperty("/dummy4GeneratedSql", "");
      this._rebindDummy4PreviewTable();
    },

    _rebindDummy4PreviewTable: function() {
      var oTable = this.byId("noahDummy4PreviewTable");
      var oModel = this.getView().getModel("noah");
      var aRows = oModel ? (oModel.getProperty("/dummy4PreviewRows") || []) : [];

      if (!oTable) {
        return;
      }

      oTable.unbindItems();
      oTable.removeAllColumns();

      var aColumns = this._extractColumns(aRows);
      if (aColumns.length === 0) {
        return;
      }

      aColumns.forEach(function(sName) {
        oTable.addColumn(new Column({
          header: new Text({ text: sName })
        }));
      });

      var aCells = aColumns.map(function(sName) {
        return new Text({
          text: "{noah>" + sName + "}",
          wrapping: true
        });
      });

      oTable.bindItems({
        path: "noah>/dummy4PreviewRows",
        template: new ColumnListItem({
          cells: aCells
        }),
        templateShareable: false
      });
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

    _applyPrefillValuesToRuntimeFields: function(mValues) {
      var oModel = this.getView().getModel("noah");
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

    _mapToPrefillArray: function(mValues) {
      var aItems = [];
      var oValues = mValues && typeof mValues === "object" ? mValues : {};
      Object.keys(oValues).forEach(function(key) {
        aItems.push({
          field_id: String(key),
          prefill: oValues[key] == null ? "" : String(oValues[key])
        });
      });
      return aItems;
    },

    _runtimeFieldsToPrefill: function(aRuntimeFields) {
      return (aRuntimeFields || []).map(function(field) {
        return {
          field_id: String(field.field_id || ""),
          prefill: field.value == null ? "" : String(field.value)
        };
      }).filter(function(item) {
        return !!item.field_id;
      });
    },

    _clearComposerAfterRun: function() {
      var oModel = this.getView().getModel("noah");
      oModel.setProperty("/draftMessage", "");
      oModel.setProperty("/attachments", []);
    },

    _setState: function(sState, sStatus) {
      var oModel = this.getView().getModel("noah");
      oModel.setProperty("/state", sState);
      oModel.setProperty("/statusText", sStatus || "");
      if (sState !== STATE.ERROR) {
        oModel.setProperty("/error", "");
      }
    },

    _setError: function(oError) {
      var oModel = this.getView().getModel("noah");
      var sMsg = oError && oError.message ? oError.message : "Ismeretlen hiba.";
      oModel.setProperty("/error", sMsg);
      this._setState(STATE.ERROR, "Hiba tortent.");
      MessageToast.show(sMsg);
    }
  });
});
