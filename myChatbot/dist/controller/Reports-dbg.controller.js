sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/Panel",
  "sap/m/Table",
  "sap/m/Column",
  "sap/m/Text",
  "sap/m/ColumnListItem",
  "sap/ui/model/json/JSONModel"
], function(Controller, Panel, Table, Column, Text, ColumnListItem, JSONModel) {
  "use strict";

  return Controller.extend("sap.suite.ui.commons.demo.tutorial.controller.Reports", {
    onInit: function() {
      var oModel = this.getView().getModel("reports");
      if (!oModel) {
        oModel = new JSONModel({
          busy: false,
          error: "",
          tables: []
        });
        this.getView().setModel(oModel, "reports");
      }
      this._loadDbPreview();
    },

    onRefreshPreview: function() {
      this._loadDbPreview();
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

    _renderDbTables: function(aTables) {
      var oHost = this.byId("dbPreviewHost");
      if (!oHost) {
        return;
      }
      oHost.removeAllItems();

      (aTables || []).forEach(function(oTableData) {
        var sTableName = String(oTableData && oTableData.tableName ? oTableData.tableName : "Ismeretlen tábla");
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
