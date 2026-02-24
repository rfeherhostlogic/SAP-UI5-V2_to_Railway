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
				selectedMenuKey: "noah",
				sideNavExpanded: true,
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
						title: "Riportok",
						subtitle: "Natural nyelv -> SQL",
						footer: "AI Joker 04",
						description: "Hasznalat: '...' = oszlop/mezo jeloles (nem kotelezo a pontos oszlopnev), \"...\" = konkret ertek. A rendszer SQL SELECT-et general es 1 mondatos osszegzest ad.",
						systemPrompt: "Adj rovid valaszt a kovetkezo szovegre."
					},
					{
						id: "dummy-5",
						title: "Dokumentum összefoglaló",
						subtitle: "PDF Q&A + osszegzes",
						footer: "AI Joker 05",
						description: "PDF feltoltes, rovid osszegzes keszitese es kerdes-valasz a dokumentum alapjan.",
						systemPrompt: "Csak a feltoltott PDF tartalma alapjan valaszolj."
					},
					{
						id: "dummy-6",
						title: "RAG",
						subtitle: "Generikus kérdések belső dokumentumokról",
						footer: "AI Joker 06",
						description: "Helyorzo csempe kesobbi funkciohoz.",
						systemPrompt: "Adj rovid valaszt a kovetkezo szovegre."
					},
					{
						id: "dummy-7",
						title: "Penzugyi osszehasonlitas (RAG)",
						subtitle: "Kimutatasok osszevetese",
						footer: "AI Joker 07",
						description: "Kizarolag a RAG-ban tarolt 2023 auditált riportokbol hasonlit ossze ket ceget. Ceg nev formatum: \"Ceg nev\" (pl. \"Roli Foods\").",
						systemPrompt: "RAG alapu penzugyi elemzes ket ceg kozott, csak dokumentumbizonyitekkal."
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
				dummy4Rows: [],
				dummy4ChartReady: false,
				dummy5DocToken: "",
				dummy5FileName: "",
				dummy5Summary: "",
				dummy5Question: "",
				dummy5Answer: "",
				dummy7CompanyA: "",
				dummy7CompanyB: "",
				dummy7Focus: "",
				dummy7Result: ""
			}), "jokers");

			// discovery model
			this.setModel(new JSONModel({
				busy: false,
				error: "",
				promptPreview: "",
				schemaTables: [],
				suggestions: [],
				activeUseCase: null,
				specSessionId: "",
				specChatMessages: [],
				specAnswerDraft: "",
				specStep: 0,
				specMaxSteps: 0,
				specDone: false,
				specBusy: false,
				trainingSpecYaml: "",
				trainingStatus: "IDLE",
				trainingProgress: 0,
				trainingMessage: "",
				trainingJobId: "",
				resultPreviewRows: [],
				resultColumns: [],
				metricsItems: [],
				businessSummary: "",
				csvDownloadUrl: ""
			}), "discovery");

			// noah model
			this.setModel(new JSONModel({
				state: "IDLE",
				statusText: "",
				error: "",
				draftMessage: "",
				messages: [{
					role: "assistant",
					content: "Szia, en Noah vagyok. Irj szabad szovegesen, es kivalasztom a megfelelo Joker kartyat."
				}],
				attachments: [],
				routerLog: [],
				manualCardOptions: [{
					id: "",
					name: "Automatikus router"
				}],
				manualSelectedCardId: "",
				dummy4PreviewRows: [],
				dummy4GeneratedSql: "",
				activeCard: null,
				activeCardRuntimeFields: [],
				pendingConfirmation: null
			}), "noah");

			// create the views based on the url/hash
			this.getRouter().initialize();

			this._restoreAuthSession();

			// simple auth guard
			this.getRouter().attachBeforeRouteMatched(function(oEvent) {
				var sName = oEvent.getParameter("name");
				var bAuthed = this.getModel("app").getProperty("/isAuthenticated");
				if (!bAuthed && sName !== "login") {
					this.getRouter().navTo("login", {}, true);
				}
			}.bind(this));
		},
		_restoreAuthSession: function() {
			var oAppModel = this.getModel("app");

			fetch("/api/auth/me", {
				method: "GET",
				credentials: "same-origin"
			}).then(function(oResponse) {
				if (!oResponse.ok) {
					return null;
				}
				return oResponse.json();
			}).then(function(oData) {
				if (!oData || !oData.user) {
					return;
				}

				oAppModel.setProperty("/isAuthenticated", true);
				oAppModel.setProperty("/userName", oData.user.displayName || oData.user.username || "");
				oAppModel.setProperty("/loginName", oData.user.username || "");

				var sHash = window.location.hash || "";
				if (!sHash || sHash === "#" || sHash === "#/" || sHash.indexOf("login") >= 0) {
					this.getRouter().navTo("main", {}, true);
				}
			}.bind(this)).catch(function() {
				// No active session or server unavailable; keep login screen.
			});
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
