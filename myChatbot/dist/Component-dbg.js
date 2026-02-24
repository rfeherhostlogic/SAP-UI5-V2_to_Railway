sap.ui.define([
	"sap/ui/core/UIComponent",
	"sap/suite/ui/commons/demo/tutorial/model/models",
	"sap/ui/core/mvc/View",
	"sap/ui/model/json/JSONModel"
], function(UIComponent, models, View, JSONModel) {
	"use strict";

	return UIComponent.extend("sap.suite.ui.commons.demo.tutorial.Component", {

		metadata: {
			manifest: "json",
			interfaces: ["sap.ui.core.IAsyncContentCreation"]
		},

		/**
		 * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
		 * @public
		 * @override
		 */
		init: function() {
			// call the base component's init function
			UIComponent.prototype.init.apply(this, arguments);

			// set the device model
			this.setModel(models.createDeviceModel(), "device");

			// app/session model
			this.setModel(new JSONModel({
				isAuthenticated: false,
				userName: "",
				loginName: "",
				loginPassword: "",
				openAiApiKey: "",
				selectedMenuKey: "chat",
				draftMessage: "",
				busy: false
			}), "app");

			// chat model
			this.setModel(new JSONModel({
				messages: [{
					role: "assistant",
					content: "Ez egy uzenet az AI-nak"
				}]
			}), "chat");

			// jokers model
			this.setModel(new JSONModel({
				tiles: [
					{
						id: "email-fix",
						title: "Email javitas",
						subtitle: "Stilus es nyelvhelyesseg",
						footer: "AI Joker 01",
						description: "Megirt email szoveg stilisztikai es nyelvi javitasa.",
						systemPrompt: "Javitsd a kovetkezo email szoveget professzionalis, udvarias es rovid stilusban. Tartsd meg az eredeti jelentest."
					},
					{
						id: "sensitive-translation",
						title: "Erzekeny uzleti adat forditas",
						subtitle: "Bizalmas tartalom",
						footer: "AI Joker 02",
						description: "Bizalmas uzleti szoveg pontos forditasa.",
						systemPrompt: "Forditsd le a kovetkezo uzleti szoveget pontosan es semleges, professzionalis stilusban. Ne adj hozza extra magyarazatot."
					},
					{
						id: "summary",
						title: "Osszefoglalo",
						subtitle: "Hosszu szoveg roviden",
						footer: "AI Joker 03",
						description: "Hosszabb szoveg tomor, attekintheto osszefoglalasa.",
						systemPrompt: "Keszits tomor, pontokba szedett osszefoglalot a kovetkezo szovegrol. Emeld ki a lenyegi dontesi informaciokat."
					},
					{
						id: "dummy-4",
						title: "Dummy 4",
						subtitle: "Natural nyelv -> SQL",
						footer: "AI Joker 04",
						description: "Termeszetes nyelvu uzleti kerdesbol SQL generalas es 1 mondatos osszegzes.",
						systemPrompt: "Adj rovid valaszt a kovetkezo szovegre."
					},
					{
						id: "dummy-5",
						title: "Dummy 5",
						subtitle: "Helyorzo",
						footer: "AI Joker 05",
						description: "Helyorzo csempe kesobbi funkciohoz.",
						systemPrompt: "Adj rovid valaszt a kovetkezo szovegre."
					},
					{
						id: "dummy-6",
						title: "Dummy 6",
						subtitle: "Helyorzo",
						footer: "AI Joker 06",
						description: "Helyorzo csempe kesobbi funkciohoz.",
						systemPrompt: "Adj rovid valaszt a kovetkezo szovegre."
					},
					{
						id: "dummy-7",
						title: "Dummy 7",
						subtitle: "Helyorzo",
						footer: "AI Joker 07",
						description: "Helyorzo csempe kesobbi funkciohoz.",
						systemPrompt: "Adj rovid valaszt a kovetkezo szovegre."
					},
					{
						id: "dummy-8",
						title: "Dummy 8",
						subtitle: "Helyorzo",
						footer: "AI Joker 08",
						description: "Helyorzo csempe kesobbi funkciohoz.",
						systemPrompt: "Adj rovid valaszt a kovetkezo szovegre."
					}
				],
				selectedJoker: null,
				promptInput: "",
				resultText: "",
				generating: false,
				dummy4Question: "",
				dummy4SchemaHint: "Customer: CustomerId, CustomerName, Country, Segment\nSalesOrder: SalesOrderId, CustomerId, OrderDate, NetAmount, Currency",
				dummy4GeneratedSql: "",
				dummy4Summary: "",
				dummy4Rows: []
			}), "jokers");

			// create the views based on the url/hash
			this.getRouter().initialize();

			// simple auth guard
			this.getRouter().attachBeforeRouteMatched(function(oEvent) {
				var sName = oEvent.getParameter("name");
				var bAuthed = this.getModel("app").getProperty("/isAuthenticated");
				if (!bAuthed && sName !== "login") {
					this.getRouter().navTo("login", {}, true);
				}
			}.bind(this));
		},
		createContent: function() {
			// create root view
			return View.create({
				viewName: "sap.suite.ui.commons.demo.tutorial.view.App",
				type: "XML"
			});
		}
	});
});
