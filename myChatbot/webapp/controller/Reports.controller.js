sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/Panel",
  "sap/m/Table",
  "sap/m/Column",
  "sap/m/Text",
  "sap/m/ColumnListItem",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageToast",
  "sap/suite/ui/commons/demo/tutorial/service/AiService"
], function(Controller, Panel, Table, Column, Text, ColumnListItem, JSONModel, MessageToast, AiService) {
  "use strict";

  return Controller.extend("sap.suite.ui.commons.demo.tutorial.controller.Reports", {
    onInit: function() {
      var oModel = this.getView().getModel("reports");
      if (!oModel) {
        oModel = new JSONModel({
          busy: false,
          error: "",
          tables: [],
          selectedTab: "db",
          webhooks: [],
          webhookChannel: "",
          webhookUrl: "",
          webhookEditId: 0,
          schedules: []
        });
        this.getView().setModel(oModel, "reports");
      }
      oModel.setProperty("/busy", false);
      oModel.setProperty("/error", "");
      oModel.setProperty("/tables", []);
      oModel.setProperty("/selectedTab", "db");
      oModel.setProperty("/webhooks", []);
      oModel.setProperty("/webhookChannel", "");
      oModel.setProperty("/webhookUrl", "");
      oModel.setProperty("/webhookEditId", 0);
      oModel.setProperty("/schedules", []);
      this._loadDbPreview();
      this._loadWebhooks();
      this._loadSchedules();
    },

    onRefreshPreview: function() {
      this._loadDbPreview();
    },

    onRefreshShieldData: function() {
      this._loadWebhooks();
      this._loadSchedules();
    },

    onSaveWebhook: async function() {
      var oModel = this.getView().getModel("reports");
      var sChannel = String(oModel.getProperty("/webhookChannel") || "").trim();
      var sUrl = String(oModel.getProperty("/webhookUrl") || "").trim();
      var iEditId = Number(oModel.getProperty("/webhookEditId") || 0);
      if (!sChannel || !sUrl) {
        MessageToast.show("A csatorna es URL kotelezo.");
        return;
      }

      try {
        if (iEditId > 0) {
          await AiService.reportsUpdateWebhook({
            id: iEditId,
            channel: sChannel,
            url: sUrl
          });
          MessageToast.show("Webhook frissitve.");
        } else {
          await AiService.reportsCreateWebhook({
            channel: sChannel,
            url: sUrl
          });
          MessageToast.show("Webhook letrehozva.");
        }
        oModel.setProperty("/webhookChannel", "");
        oModel.setProperty("/webhookUrl", "");
        oModel.setProperty("/webhookEditId", 0);
        this._loadWebhooks();
      } catch (oError) {
        MessageToast.show(oError && oError.message ? oError.message : "Webhook mentesi hiba.");
      }
    },

    onEditWebhook: function(oEvent) {
      var oCtx = oEvent.getSource().getBindingContext("reports");
      var oItem = oCtx ? oCtx.getObject() : null;
      if (!oItem) {
        return;
      }
      var oModel = this.getView().getModel("reports");
      oModel.setProperty("/webhookEditId", Number(oItem.WebhookId || 0));
      oModel.setProperty("/webhookChannel", String(oItem.Channel || ""));
      oModel.setProperty("/webhookUrl", String(oItem.Url || ""));
    },

    onDeleteWebhook: async function(oEvent) {
      var oCtx = oEvent.getSource().getBindingContext("reports");
      var oItem = oCtx ? oCtx.getObject() : null;
      if (!oItem) {
        return;
      }

      try {
        await AiService.reportsDeleteWebhook({ id: oItem.WebhookId });
        MessageToast.show("Webhook torolve.");
        this._loadWebhooks();
      } catch (oError) {
        MessageToast.show(oError && oError.message ? oError.message : "Webhook torlesi hiba.");
      }
    },

    onCancelWebhookEdit: function() {
      var oModel = this.getView().getModel("reports");
      oModel.setProperty("/webhookEditId", 0);
      oModel.setProperty("/webhookChannel", "");
      oModel.setProperty("/webhookUrl", "");
    },

    onDeleteSchedule: async function(oEvent) {
      var oCtx = oEvent.getSource().getBindingContext("reports");
      var oItem = oCtx ? oCtx.getObject() : null;
      if (!oItem) {
        return;
      }

      try {
        await AiService.reportsDeleteSchedule({ id: oItem.ScheduleId });
        MessageToast.show("Idozites torolve.");
        this._loadSchedules();
      } catch (oError) {
        MessageToast.show(oError && oError.message ? oError.message : "Idozites torlesi hiba.");
      }
    },

    _loadDbPreview: function() {
      var oModel = this.getView().getModel("reports");
      oModel.setProperty("/busy", true);
      oModel.setProperty("/error", "");

      fetch("/api/reports/db-preview?maxRows=10", {
        method: "GET"
      }).then(function(oResponse) {
        if (!oResponse.ok) {
          return oResponse.text().then(function(sError) {
            throw new Error(sError || "DB preview hiba");
          });
        }
        return oResponse.json();
      }).then(function(oData) {
        var aTables = Array.isArray(oData && oData.tables) ? oData.tables : [];
        oModel.setProperty("/tables", aTables);
        this._renderDbTables(aTables);
      }.bind(this)).catch(function(oError) {
        oModel.setProperty("/error", oError && oError.message ? oError.message : "DB preview hiba.");
      }).finally(function() {
        oModel.setProperty("/busy", false);
      });
    },

    _loadWebhooks: async function() {
      var oModel = this.getView().getModel("reports");
      try {
        var oResp = await AiService.reportsListWebhooks();
        oModel.setProperty("/webhooks", Array.isArray(oResp && oResp.items) ? oResp.items : []);
      } catch (_e) {
        oModel.setProperty("/webhooks", []);
      }
    },

    _loadSchedules: async function() {
      var oModel = this.getView().getModel("reports");
      try {
        var oResp = await AiService.reportsListSchedules();
        oModel.setProperty("/schedules", Array.isArray(oResp && oResp.items) ? oResp.items : []);
      } catch (_e) {
        oModel.setProperty("/schedules", []);
      }
    },

    _renderDbTables: function(aTables) {
      var oHost = this.byId("dbPreviewHost");
      if (!oHost) {
        return;
      }
      oHost.removeAllItems();

      (aTables || []).forEach(function(oTableData) {
        var sTableName = String(oTableData && oTableData.tableName ? oTableData.tableName : "Ismeretlen tabla");
        var aColumns = Array.isArray(oTableData && oTableData.columns) ? oTableData.columns : [];
        var aRows = Array.isArray(oTableData && oTableData.rows) ? oTableData.rows : [];

        var oPanel = new Panel({
          headerText: sTableName + " (max 10 sor)",
          expandable: true,
          expanded: false
        }).addStyleClass("sapUiSmallMarginBottom");

        var oTable = new Table({
          inset: false,
          growing: true,
          growingThreshold: 10
        });

        aColumns.forEach(function(sColumnName) {
          oTable.addColumn(new Column({
            header: new Text({ text: sColumnName })
          }));
        });

        if (aColumns.length > 0) {
          var aCells = aColumns.map(function(sColumnName) {
            return new Text({
              text: "{row>" + sColumnName + "}",
              wrapping: true
            });
          });
          var oTemplate = new ColumnListItem({
            cells: aCells
          });
          oTable.setModel(new JSONModel({ rows: aRows }), "row");
          oTable.bindItems({
            path: "row>/rows",
            template: oTemplate,
            templateShareable: false
          });
        }

        oPanel.addContent(oTable);
        oHost.addItem(oPanel);
      });
    }
  });
});
