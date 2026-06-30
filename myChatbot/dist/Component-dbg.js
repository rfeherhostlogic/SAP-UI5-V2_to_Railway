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

			this.setModel(new JSONModel({
				busy: false,
				error: "",
				lastUpdatedText: "",
				messages: []
			}), "feed");

			this.setModel(new JSONModel({
				categories: [
					{
						id: "consulting",
						title: "Tanacsado",
						icon: "sap-icon://customer-financial-fact-sheet",
						description: "SAP Activate-alapu tanacsadoi folyamatok es projektfazisok."
					},
					{
						id: "sales-marketing",
						title: "Sales es Marketing",
						icon: "sap-icon://sales-order",
						description: "Leadtol a kampanyokig terjedo ertekesitesi es marketing folyamatok."
					},
					{
						id: "logistics",
						title: "Logisztika",
						icon: "sap-icon://shipping-status",
						description: "Beszerzes, raktar, szallitas es teljesitesi folyamatok."
					},
					{
						id: "manufacturing",
						title: "Gyartas",
						icon: "sap-icon://factory",
						description: "Tervezes, vegrehajtas, minoseg es karbantartasi folyamatok."
					},
					{
						id: "finance",
						title: "Penzugy",
						icon: "sap-icon://account",
						description: "Penzugyi tervezes, konyveles, controlling es cashflow folyamatok."
					}
				],
				advisorLanes: [
					{ id: "discover", icon: "sap-icon://begin", label: "Discover", position: 0 },
					{ id: "prepare", icon: "sap-icon://activate", label: "Prepare", position: 1 },
					{ id: "explore", icon: "sap-icon://inspect", label: "Explore", position: 2 },
					{ id: "realize", icon: "sap-icon://process", label: "Realize", position: 3 },
					{ id: "deploy", icon: "sap-icon://flag", label: "Deploy", position: 4 },
					{ id: "run", icon: "sap-icon://customer-history", label: "Run", position: 5 }
				],
				advisorNodes: [
					{ id: "discover-1", lane: "discover", title: "Bevezetes es indulas", titleAbbreviation: "Onboarding", children: ["discover-2"], state: "Positive", stateText: "Discover", focused: true, highlighted: false, texts: ["Getting Started & Onboarding"] },
					{ id: "discover-2", lane: "discover", title: "Projektinditas es iranyitas", titleAbbreviation: "Governance", children: ["discover-3"], state: "Positive", stateText: "Discover", focused: false, highlighted: false, texts: ["Project Initiation & Governance"] },
					{ id: "discover-3", lane: "discover", title: "Felfedezesi ertekeles", titleAbbreviation: "Assessment", children: ["prepare-1"], state: "Positive", stateText: "Discover", focused: false, highlighted: false, texts: ["Discovery Assessment"] },
					{ id: "prepare-1", lane: "prepare", title: "Projekt szabvanyok es inditas", titleAbbreviation: "Kick-off", children: ["prepare-2"], state: "Positive", stateText: "Prepare", focused: false, highlighted: false, texts: ["Project Standards & Kick-off"] },
					{ id: "prepare-2", lane: "prepare", title: "Megoldas hatokorenek meghatarozasa", titleAbbreviation: "Scope", children: ["prepare-3"], state: "Positive", stateText: "Prepare", focused: false, highlighted: false, texts: ["Solution Scope"] },
					{ id: "prepare-3", lane: "prepare", title: "Uzletvezerelt konfiguracios felmeres", titleAbbreviation: "BCA", children: ["explore-1"], state: "Positive", stateText: "Prepare", focused: false, highlighted: false, texts: ["Business Driven Configuration Assessment"] },
					{ id: "explore-1", lane: "explore", title: "Fit-to-Standard elemzes", titleAbbreviation: "Fit", children: ["explore-2"], state: "Positive", stateText: "Explore", focused: false, highlighted: false, texts: ["Fit-to-Standard analysis"] },
					{ id: "explore-2", lane: "explore", title: "Fit-to-Standard dokumentacio", titleAbbreviation: "Docs", children: ["explore-3"], state: "Positive", stateText: "Explore", focused: false, highlighted: false, texts: ["Fit-to-Standard documentation"] },
					{ id: "explore-3", lane: "explore", title: "Integracio tervezese es kialakitasa", titleAbbreviation: "Integration", children: ["realize-1"], state: "Positive", stateText: "Explore", focused: false, highlighted: false, texts: ["Integration Planning and Design"] },
					{ id: "realize-1", lane: "realize", title: "Sprint tervezes es vegrehajtas", titleAbbreviation: "Sprint", children: ["realize-2"], state: "Neutral", stateText: "Realize", focused: false, highlighted: false, texts: ["Sprint Planning and Execution"] },
					{ id: "realize-2", lane: "realize", title: "Megoldas konfiguralasa", titleAbbreviation: "Config", children: ["realize-3"], state: "Neutral", stateText: "Realize", focused: false, highlighted: false, texts: ["Solution Configuration"] },
					{ id: "realize-3", lane: "realize", title: "Teszt Migracio", titleAbbreviation: "Migration", children: ["realize-4"], state: "Critical", stateText: "Joker nyithato", focused: false, highlighted: true, texts: ["Test Migration", "Kattintasra Joker kartya"] },
					{ id: "realize-4", lane: "realize", title: "Teszt vegrehajtas", titleAbbreviation: "Execution", children: ["deploy-1"], state: "Neutral", stateText: "Realize", focused: false, highlighted: false, texts: ["Test Execution"] },
					{ id: "deploy-1", lane: "deploy", title: "Eles indulas", titleAbbreviation: "Go-Live", children: ["deploy-2"], state: "Positive", stateText: "Deploy", focused: false, highlighted: false, texts: ["System Go-Live"] },
					{ id: "deploy-2", lane: "deploy", title: "Elesitesi atallas", titleAbbreviation: "Cutover", children: ["run-1"], state: "Positive", stateText: "Deploy", focused: false, highlighted: false, texts: ["Production Cutover"] },
					{ id: "run-1", lane: "run", title: "Folyamatos mukodes", titleAbbreviation: "Operations", children: ["run-2"], state: "Positive", stateText: "Run", focused: false, highlighted: false, texts: ["Ongoing Operations"] },
					{ id: "run-2", lane: "run", title: "Folyamatos fejlesztes", titleAbbreviation: "Improvement", children: ["run-3"], state: "Positive", stateText: "Run", focused: false, highlighted: false, texts: ["Continuous Improvement"] },
					{ id: "run-3", lane: "run", title: "Kiadasi es frissitesi ciklusok", titleAbbreviation: "Release", children: [], state: "Positive", stateText: "Run", focused: false, highlighted: false, texts: ["Release & Update Cycles"] }
				],
				advisorLegend: [
					{ uiState: "Success", label: "Kesz vagy standard teendo" },
					{ uiState: "Information", label: "Aktiv megvalositasi lepes" },
					{ uiState: "Warning", label: "Akcio / Joker kapcsolat" }
				]
			}), "flow");

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
						primaryTag: "Altalanos",
						tags: ["Altalanos"],
						footer: "AI Joker 01",
						description: "Megirt email szoveg stilisztikai es nyelvi javitasa.",
						systemPrompt: "Javitsd a kovetkezo email szoveget professzionalis, udvarias es rovid stilusban. Tartsd meg az eredeti jelentest."
					},
					{
						id: "sensitive-translation",
						title: "Erzekeny uzleti adat forditas",
						subtitle: "Bizalmas tartalom",
						primaryTag: "Altalanos",
						tags: ["Altalanos"],
						footer: "AI Joker 02",
						description: "Bizalmas uzleti szoveg pontos forditasa.",
						systemPrompt: "Forditsd le a kovetkezo uzleti szoveget pontosan es semleges, professzionalis stilusban. Ne adj hozza extra magyarazatot."
					},
					{
						id: "summary",
						title: "Osszefoglalo",
						subtitle: "Hosszu szoveg roviden",
						primaryTag: "Altalanos",
						tags: ["Altalanos"],
						footer: "AI Joker 03",
						description: "Hosszabb szoveg tomor, attekintheto osszefoglalasa.",
						systemPrompt: "Keszits tomor, pontokba szedett osszefoglalot a kovetkezo szovegrol. Emeld ki a lenyegi dontesi informaciokat."
					},
					{
						id: "dummy-4",
						title: "Riportok",
						subtitle: "Natural nyelv -> SQL",
						primaryTag: "Altalanos",
						tags: ["Altalanos"],
						footer: "AI Joker 04",
						description: "Hasznalat: '...' = oszlop/mezo jeloles (nem kotelezo a pontos oszlopnev), \"...\" = konkret ertek. A rendszer SQL SELECT-et general es 1 mondatos osszegzest ad.",
						systemPrompt: "Adj rovid valaszt a kovetkezo szovegre."
					},
					{
						id: "dummy-5",
						title: "Dokumentum osszefoglalo",
						subtitle: "PDF Q&A + osszegzes",
						primaryTag: "Altalanos",
						tags: ["Altalanos"],
						footer: "AI Joker 05",
						description: "PDF feltoltes, rovid osszegzes keszitese es kerdes-valasz a dokumentum alapjan.",
						systemPrompt: "Csak a feltoltott PDF tartalma alapjan valaszolj."
					},
					{
						id: "dummy-6",
						title: "RAG",
						subtitle: "Generikus kerdesek belso dokumentumokrol",
						primaryTag: "Altalanos",
						tags: ["Altalanos"],
						footer: "AI Joker 06",
						description: "Helyorzo csempe kesobbi funkciohoz.",
						systemPrompt: "Adj rovid valaszt a kovetkezo szovegre."
					},
					{
						id: "quote-builder",
						title: "Arajanlat keszito",
						subtitle: "Word sablon -> PDF ajanlat",
						primaryTag: "Altalanos",
						tags: ["Altalanos"],
						footer: "AI Joker Quote",
						inDevelopment: true,
						description: "Word sablon, szoveges kontextus es Vector Store arak alapjan letoltheto Word/PDF arajanlatot keszit PDF preview-val es chat-alapu modositassal.",
						systemPrompt: "Keszits strukturalt, arakkal alatamasztott arajanlatot."
					},
					{
						id: "dummy-7",
						title: "Penzugyi osszehasonlitas (RAG)",
						subtitle: "Kimutatasok osszevetese",
						primaryTag: "Altalanos",
						tags: ["Altalanos"],
						footer: "AI Joker 07",
						description: "Kizarolag a RAG-ban tarolt 2023 auditalt riportokbol hasonlit ossze ket ceget. Ceg nev formatum: \"Ceg nev\" (pl. \"Roli Foods\").",
						systemPrompt: "RAG alapu penzugyi elemzes ket ceg kozott, csak dokumentumbizonyitekkal."
					},
					{
						id: "dummy-8",
						title: "Smart Segmentation",
						subtitle: "SQL + RAG szegmensek",
						primaryTag: "Marketing",
						tags: ["Marketing"],
						footer: "AI Joker 08",
						description: "Szabadszavas szegmentacio SQL es RAG adatforrasok kombinaciojaval, AND/OR logikaval.",
						systemPrompt: "Segits smart szegmenseket tervezni es futtatni."
					},
					{
						id: "dummy-9",
						title: "CSV Riport Asszisztens",
						subtitle: "CSV Q&A + preview",
						primaryTag: "Altalanos",
						tags: ["Altalanos"],
						footer: "AI Joker 09",
						description: "A csatolt CSV allomanyok kerdes-alapu attekintese szoveges osszegzessel, tablazatos es diagram preview-val.",
						systemPrompt: "A csatolt CSV adatok alapjan valaszolj rovid, riport-szeru stilusban."
					},
					{
						id: "dummy-10",
						title: "Lemorzsolodo ugyfelek azonositasa",
						subtitle: "RFM + K-Means szegmentacio",
						primaryTag: "Marketing",
						tags: ["Marketing", "Idozitheto"],
						footer: "AI Joker 10",
						description: "Vasarlasi adatokbol RFM modellt es K-Means alapu ugyfelszegmenseket keszit (Champions, Loyal, At Risk, Lost).",
						systemPrompt: "Adj rovid osszegzest az RFM szegmentaciorol."
					},
					{
						id: "kpi-discovery",
						title: "KPI felfedezes",
						subtitle: "Adatbazis -> KPI javaslatok",
						primaryTag: "Altalanos",
						tags: ["Altalanos"],
						footer: "AI Joker KPI",
						inDevelopment: true,
						description: "Az adatbazis tablait atnezve hasznos KPI-okat javasol, majd a kivalasztott KPI-t Python alapu szamitassal futtatja es diagramon is megjeleniti.",
						systemPrompt: "KPI felfedezes es determinisztikus Python KPI futtatas."
					},
					{
						id: "dummy-11",
						title: "Prompt Epito Asszisztens",
						subtitle: "Gyenge otletbol jo prompt",
						primaryTag: "Altalanos",
						tags: ["Altalanos", "Idozitheto"],
						footer: "AI Joker 11",
						description: "Szabadszavas igenybol production-ready AI promptot epit scorecarddal, tisztazo kerdesekkel es mentesi kuszobbel.",
						systemPrompt: "Segits jo minosegu, production-ready promptot irni."
					},
					{
						id: "dummy-12",
						title: "Konkurencia elemzes",
						subtitle: "Sajat ceg + versenytars benchmark",
						primaryTag: "Marketing",
						tags: ["Marketing", "Altalanos"],
						footer: "AI Joker 12",
						description: "Lepeses konkurenciaelemzes PDF-adatkinyeressel, KPI-osszefoglaloval es CFO-szintu vezetoi outputtal.",
						systemPrompt: "Keszits strukturalt konkurenciaelemzest a megadott cegekrol."
					},
					{
						id: "dummy-13",
						title: "Terv-teny osszehasonlitas",
						subtitle: "CSV mapping, variancia, anomalia",
						primaryTag: "Altalanos",
						tags: ["Altalanos"],
						footer: "AI Joker 13",
						description: "Ket CSV alapjan terv-teny eltéréseket elemez wizardban, determinisztikus Python szamitasokkal es bizonyitek-alapu osszegzessel.",
						systemPrompt: "Segits terv-teny adatokat strukturaltan osszehasonlitani."
					},
					{
						id: "dummy-14",
						title: "Terv-teny osszehasonlitas v2",
						subtitle: "Miért nem sikerült? Projekt-szintű elemzés",
						primaryTag: "Altalanos",
						tags: ["Altalanos"],
						footer: "AI Joker 14",
						description: "Javított terv-tény elemzés: szisztematikus vs. egyszeri eltérés azonosítása, projekt-szintű 'Miért vizsgáld?' magyarázatok, küszöbérték-javaslatok és részletes ok-szövegek.",
						systemPrompt: "Segits terv-teny adatokat strukturaltan osszehasonlitani es az okokat azonositani."
					},
					{
						id: "dummy-15",
						title: "Gyartastervezes",
						subtitle: "Kapacitas, prioritas, utemezes",
						primaryTag: "Altalanos",
						tags: ["Altalanos"],
						footer: "AI Joker 15",
						description: "Gyartasi igenyek, kapacitasok, hataridok es korlatok alapjan strukturalt termelesi tervet es prioritasokat javasol.",
						systemPrompt: "Segits gyartastervet kesziteni a megadott igenyek, hataridok, kapacitasok es korlatok alapjan. Adj egyertelmu prioritasokat, javasolt utemezest, fobb kockazatokat es gyakorlati kovetkezo lepeseket roviden, uzletileg erthetoen."
					},
					{
						id: "dummy-16",
						title: "Készletgazdálkodás",
						subtitle: "Előrejelzés és rendelési javaslatok",
						primaryTag: "Altalanos",
						tags: ["Altalanos"],
						footer: "AI Joker 16",
						inDevelopment: true,
						description: "Adatbázis vagy CSV alapján kiszámítja a várható készlethiányokat, kritikus cikkeket és optimális rendelési mennyiségeket, Noah AI összefoglalóval.",
						systemPrompt: ""
					},
					{
						id: "dummy-17",
						title: "Tanacsado",
						subtitle: "Uzleti helyzetek gyors attekintese",
						primaryTag: "Altalanos",
						tags: ["Altalanos"],
						footer: "AI Joker 17",
						description: "Altalanos uzleti, mukodesi vagy dontesi helyzetekre ad strukturalt tanacsot, opciokat es kovetkezo lepeseket.",
						systemPrompt: "Viselkedj tapasztalt uzleti tanacsadokent. Ertsd meg a helyzetet, foglald ossze roviden a problemat, adj 2-4 realis opciot az elonyokkel es kockazatokkal, majd javasolj vilagos kovetkezo lepeseket."
					},
					{
						id: "dummy-18",
						title: "GDC: Prediktiv karbantartas",
						subtitle: "Meghibasodas-elorejelzes es prioritas",
						primaryTag: "GDC",
						tags: ["GDC"],
						footer: "AI Joker 18",
						description: "Berendezesek, szenzoradatok, hibak es uzemeltetesi mintak alapjan elorejelzi a karbantartasi kockazatot, majd priorizalt beavatkozasi javaslatot ad.",
						systemPrompt: "Elemezd a megadott uzemeltetesi vagy karbantartasi helyzetet prediktiv karbantartasi szemlelettel. Azonositsd a legfontosabb meghibasodasi kockazatokat, a varhato uzleti hatast, majd adj rovid, priorizalt beavatkozasi javaslatokat es kovetkezo lepeseket."
					},
					{
						id: "dummy-19",
						title: "GDC: Freight Audit automatizalas",
						subtitle: "Fuvarszamlak, elteresek es kontroll",
						primaryTag: "GDC",
						tags: ["GDC"],
						footer: "AI Joker 19",
						description: "Fuvarszamlak, szallitasi adatok es szerzodeses feltetelek alapjan feltarja az eltereseket, tulszamlazasokat es automatizalasi lehetosegeket.",
						systemPrompt: "Vizsgald meg a freight audit helyzetet uzleti es operacios szemszogbol. Emeld ki a valoszinu eltereseket, tulszamlazasi vagy folyamatbeli kockazatokat, majd adj rovid, priorizalt automatizalasi es kontroll-javaslatokat."
					},
					{
						id: "dummy-20",
						title: "GDC: Chatbot es ugyfelkezeles automatizalas",
						subtitle: "Routing, SLA es support-hatekonysag",
						primaryTag: "GDC",
						tags: ["GDC"],
						footer: "AI Joker 20",
						description: "Ugyfelszolgalati folyamatok, megkereses-tipusok es SLA-k alapjan chatbot- es workflow-automatizalasi javaslatokat ad.",
						systemPrompt: "Ertekeld a chatbot- es ugyfelkezelesi folyamatot. Azonositsd az automatizalhato lepeseket, a routing- es SLA-kockazatokat, majd adj rovid, uzletileg ertheto javaslatot a hatekonysag es ugyfelelmeny javitasara."
					},
					{
						id: "dummy-22",
						title: "Teszt Migracio (Test Migration)",
						subtitle: "Tesztadat es migralasi felkeszules",
						primaryTag: "Tanacsado",
						tags: ["Tanacsado", "Altalanos"],
						footer: "AI Joker 22",
						description: "Teszt migracios lepesek, ellenorzolista, kockazatok es kovetkezo teendok attekintese.",
						systemPrompt: "Segits a teszt migracios tevekenysegek megtervezeseben. Adj strukturalt ellenorzolistat, kockazatokat, dontesi pontokat es kovetkezo lepeseket."
					},
					{
						id: "dummy-21",
						title: "RPT1-Fizetesi kesedelem elorejelzes",
						subtitle: "CSV upload + SAP RPT1 predikcio",
						primaryTag: "Altalanos",
						tags: ["Altalanos"],
						footer: "AI Joker 21",
						description: "CSV feltoltes utan az RPT1 API a [PREDICT] mezokre elorejelzest ad, majd megjelenik a varhato cashflow a kovetkezo 3 honapra.",
						systemPrompt: "Futtasd le a fizetesi kesedelem elorejelzest a feltoltott CSV alapjan."
					}
				],
				filteredTiles: [],
				availableTags: ["Osszes", "Altalanos", "Marketing", "Idozitheto", "GDC", "Tanacsado"],
				activeTags: ["Osszes"],
				activeTag: "Osszes",
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
				dummy4DiscoveryBusy: false,
				dummy4DiscoverySuggestions: [],
				dummy4ScheduleEnabled: false,
				dummy4ScheduleId: 0,
				dummy4ScheduleFrequency: "immediate",
				dummy4ScheduleWeeklyDay: 1,
				dummy4ScheduleTime: "09:00",
				dummy9Question: "",
				dummy9SchemaHint: "Customer: CustomerId, CustomerName, Country, Segment\nSalesOrder: SalesOrderId, CustomerId, OrderDate, NetAmount, Currency",
				dummy9Files: [],
				dummy9ResultText: "",
				dummy9Error: "",
				dummy9Rows: [],
				dummy9ChartReady: false,
				dummy9SelectedSource: "",
				dummy9MatchedFiles: [],
				rpt1File: null,
				rpt1FileName: "",
				rpt1Summary: "",
				rpt1Error: "",
				rpt1PredictionRows: [],
				rpt1HasRun: false,
				rpt1ChartReady: false,
				rpt1DefaultChartRows: [
					{ monthKey: "2026-05", monthLabel: "2026 Majus", actualCashflow: 208262509.73, predictedIncrementalCashflow: 0, predictedCashflow: 208262509.73, actualCashflowFormatted: "208.262.509,73 Ft", predictedIncrementalCashflowFormatted: "0,00 Ft", predictedCashflowFormatted: "208.262.509,73 Ft" },
					{ monthKey: "2026-06", monthLabel: "2026 Junius", actualCashflow: 20908143.32, predictedIncrementalCashflow: 0, predictedCashflow: 20908143.32, actualCashflowFormatted: "20.908.143,32 Ft", predictedIncrementalCashflowFormatted: "0,00 Ft", predictedCashflowFormatted: "20.908.143,32 Ft" },
					{ monthKey: "2026-07", monthLabel: "2026 Julius", actualCashflow: 67131.92, predictedIncrementalCashflow: 0, predictedCashflow: 67131.92, actualCashflowFormatted: "67.131,92 Ft", predictedIncrementalCashflowFormatted: "0,00 Ft", predictedCashflowFormatted: "67.131,92 Ft" }
				],
				rpt1ChartRows: [
					{ monthKey: "2026-05", monthLabel: "2026 Majus", actualCashflow: 208262509.73, predictedIncrementalCashflow: 0, predictedCashflow: 208262509.73, actualCashflowFormatted: "208.262.509,73 Ft", predictedIncrementalCashflowFormatted: "0,00 Ft", predictedCashflowFormatted: "208.262.509,73 Ft" },
					{ monthKey: "2026-06", monthLabel: "2026 Junius", actualCashflow: 20908143.32, predictedIncrementalCashflow: 0, predictedCashflow: 20908143.32, actualCashflowFormatted: "20.908.143,32 Ft", predictedIncrementalCashflowFormatted: "0,00 Ft", predictedCashflowFormatted: "20.908.143,32 Ft" },
					{ monthKey: "2026-07", monthLabel: "2026 Julius", actualCashflow: 67131.92, predictedIncrementalCashflow: 0, predictedCashflow: 67131.92, actualCashflowFormatted: "67.131,92 Ft", predictedIncrementalCashflowFormatted: "0,00 Ft", predictedCashflowFormatted: "67.131,92 Ft" }
				],
				dummy10Summary: "",
				dummy10Rows: [],
				dummy10SegmentItems: [],
				dummy10ScheduleEnabled: false,
				dummy10ScheduleId: 0,
				dummy10ScheduleFrequency: "immediate",
				dummy10ScheduleWeeklyDay: 1,
				dummy10ScheduleTime: "09:00",
				kpiDiscoveryBusy: false,
				kpiDiscoverySuggestionsLoading: false,
				kpiDiscoveryError: "",
				kpiDiscoverySchemaSummary: "",
				kpiDiscoverySuggestions: [],
				kpiDiscoverySelectedId: "",
				kpiDiscoverySelectedIds: [],
				kpiDiscoveryMaxReached: false,
				kpiDiscoveryTrayItems: [],
				kpiDiscoveryMultiResults: [],
				kpiDiscoveryResultsView: false,
				kpiDiscoverySummary: "",
				kpiDiscoveryComparison: null,
				kpiDiscoveryMetrics: [],
				kpiDiscoveryChartRows: [],
				kpiDiscoveryRows: [],
				dummy11RawRequest: "",
				dummy11Title: "",
				dummy11ReplyDraft: "",
				dummy11ImprovedPrompt: "",
				dummy11ResultText: "",
				dummy11ScoreTotal: 0,
				dummy11ScoreLabel: "Nincs ertekeles",
				dummy11CanSave: false,
				dummy11NeedsClarification: false,
				dummy11AssistantMessage: "",
				dummy11WhatImproved: [],
				dummy11Messages: [],
				dummy11PendingQuestions: [],
				dummy11ScoreBreakdown: [],
				dummy11Error: "",
				dummy11LastEvaluationId: "",
				dummy11SaveBlockedReason: "",
				dummy11SaveGuidance: [],
				dummy11SavedPromptId: 0,
				dummy11TimingEnabled: false,
				dummy11ScheduleEnabled: false,
				dummy11ScheduleId: 0,
				dummy11ScheduleFrequency: "immediate",
				dummy11ScheduleWeeklyDay: 1,
				dummy11ScheduleTime: "09:00",
				dummy11AttachmentsEnabled: false,
				dummy11Files: [],
				dummy12Companies: [],
				dummy12Busy: false,
				dummy12Error: "",
				dummy12ProgressText: "",
				dummy12ProgressPercent: 0,
				dummy12CurrentStep: 0,
				dummy12JobId: "",
				dummy12StepItems: [],
				dummy12KpiItems: [],
				dummy12KpiSummary: [],
				dummy12ExtractedFinancials: [],
				dummy12ExecutiveSummary: [],
				dummy12OwnCompany: {},
				dummy12Competitors: [],
				dummy12ComparisonRows: [],
				dummy12FinancialInsights: [],
				dummy12OnlineInsights: [],
				dummy12HiringInsights: [],
				dummy12StrategicTakeaways: [],
				dummy12RecommendedActions: [],
				dummy12PressMentions: [],
				dummy12PressSummary: {},
				dummy12ExportText: "",
				dummy12SessionRestored: false,
				dummy12SessionInfoText: "",
				dummy12SessionNeedsFiles: false,
				dummy12ReportGranularity: "summary",
				dummy12ReportPeriod: "current",
				dummy12SelectedReportCompany: "",
				dummy12ReportCompanyOptions: [],
				dummy12HeadlineMetrics: [],
				dummy12BalanceChartRows: [],
				dummy12IncomeChartRows: [],
				dummy12AnnualReportPreviews: [],
				dummy12SelectedPreviewId: "",
				dummy12SelectedPreviewTitle: "",
				dummy12SelectedPreviewRows: [],
				dummy12SelectedPreviewSummary: "",
				dummy13AnalysisRunId: "",
				dummy13PlanFile: null,
				dummy13ActualFile: null,
				dummy13PlanFileName: "",
				dummy13ActualFileName: "",
				dummy13Busy: false,
				dummy13Error: "",
				dummy13ProgressText: "",
				dummy13ProgressPercent: 0,
				dummy13JobId: "",
				dummy13StepItems: [],
				dummy13PlanColumns: [],
				dummy13ActualColumns: [],
				dummy13PlanPreviewRows: [],
				dummy13ActualPreviewRows: [],
				dummy13PlanColumnsText: "",
				dummy13ActualColumnsText: "",
				dummy13PlanPreviewText: "",
				dummy13ActualPreviewText: "",
				dummy13SemanticMappings: [],
				dummy13CompareKeyOptions: [],
				dummy13CompareKeys: [],
				dummy13MappingConfidence: 0,
				dummy13MappingConfidenceText: "",
				dummy13MappingAiSummary: "",
				dummy13CompareKeyHelpText: "",
				dummy13QualitySummary: null,
				dummy13QualityItems: [],
				dummy13Granularity: "monthly",
				dummy13MetricMode: "sum_amount",
				dummy13GroupingKeys: [],
				dummy13ThresholdPct: 10,
				dummy13AbsoluteThreshold: 100000,
				dummy13ZscoreCutoff: 2.5,
				dummy13SummaryTotals: {},
				dummy13ResultRows: [],
				dummy13EvidenceRows: [],
				dummy13TopDrivers: [],
				dummy13NarrativeHeadline: "",
				dummy13NarrativeSummary: "",
				dummy13NarrativeBullets: [],
				dummy13NarrativeLimitations: [],
				dummy13RecommendedActions: [],
				dummy14AnalysisRunId: "",
				dummy14PlanFile: null,
				dummy14ActualFile: null,
				dummy14PlanFileName: "",
				dummy14ActualFileName: "",
				dummy14Busy: false,
				dummy14Error: "",
				dummy14ProgressText: "",
				dummy14ProgressPercent: 0,
				dummy14JobId: "",
				dummy14StepItems: [],
				dummy14PlanColumns: [],
				dummy14ActualColumns: [],
				dummy14PlanPreviewRows: [],
				dummy14ActualPreviewRows: [],
				dummy14PlanColumnsText: "",
				dummy14ActualColumnsText: "",
				dummy14PlanPreviewText: "",
				dummy14ActualPreviewText: "",
				dummy14SemanticMappings: [],
				dummy14CompareKeyOptions: [],
				dummy14CompareKeys: [],
				dummy14MappingConfidence: 0,
				dummy14MappingConfidenceText: "",
				dummy14MappingAiSummary: "",
				dummy14CompareKeyHelpText: "",
				dummy14QualitySummary: null,
				dummy14QualityItems: [],
				dummy14Granularity: "monthly",
				dummy14MetricMode: "sum_amount",
				dummy14GroupingKeys: [],
				dummy14ThresholdPct: 10,
				dummy14AbsoluteThreshold: 100000,
				dummy14ZscoreCutoff: 2.5,
				dummy14SummaryTotals: {},
				dummy14ResultRows: [],
				dummy14EvidenceRows: [],
				dummy14TopDrivers: [],
				dummy14ProjectInsights: [],
				dummy14SuggestedThresholds: null,
				dummy14NarrativeHeadline: "",
				dummy14NarrativeSummary: "",
				dummy14NarrativeBullets: [],
				dummy14NarrativeLimitations: [],
				dummy14RecommendedActions: [],
				dummy5DocToken: "",
				dummy5FileName: "",
				dummy5Summary: "",
				dummy5Question: "",
				dummy5Answer: "",
				quoteState: "input",
				quoteSessionId: "",
				quoteTemplateFileName: "",
				quoteTemplatePreview: "",
				quoteTemplatePlaceholders: [],
				quoteTemplateFields: [],
				quoteCanGenerate: false,
				quoteMissingPlaceholders: [],
				quotePlaceholderValues: {},
				quoteContextText: "",
				quoteTextSampleKey: "",
				quoteTextSamples: [
					{
						key: "altalanos",
						title: "Altalanos szolgaltatas ajanlat",
						text: "Uj ugyfel erdeklodik altalanos szolgaltatasunk irant. Kerlek keszits arajanlatot havi tamogatasi csomagra, kb. 20 munkaorat tartalmazva, 30 napos fizetesi hataridovel."
					},
					{
						key: "termek",
						title: "Termekertekesitesi ajanlat",
						text: "Az ugyfel 50 darab termeket szeretne rendelni, mennyisegi kedvezmenyt kerve. Kerlek keszits arajanlatot a rendeles mennyisegere, szallitasi hataridovel es 15 napos fizetesi feltetellel."
					},
					{
						key: "projekt",
						title: "Projekt alapu ajanlat",
						text: "Egyedi fejlesztesi projektrol van szo, kb. 3 honapos futamidovel. Kerlek keszits arajanlatot mernoki napokra bontva, mertfoldkovenkenti szamlazassal."
					}
				],
				quote: null,
				quoteSummary: "",
				quotePreviewUrl: "",
				quotePdfDownloadUrl: "",
				quoteDocxDownloadUrl: "",
				quoteFileName: "",
				quoteRevisionMessage: "",
				quoteChatMessages: [],
				quoteBusy: false,
				quotePdfBusy: false,
				quoteError: "",
				quoteConversionMode: "",
				quoteFieldValues: {},
				quoteExtraFields: [],
				quoteResultPage: 1,
				quoteResultValidationActive: false,
				quoteResultGenerateBusy: false,
				dummy7CompanyA: "",
				dummy7CompanyB: "",
				dummy7Focus: "",
				dummy7Result: "",
				smartSegSqlEnabled: true,
				smartSegRagEnabled: false,
				smartSegCombineMode: "AND",
				smartSegSqlPrompt: "",
				smartSegRagPrompt: "",
				smartSegChatMessages: [],
				smartSegBusy: false,
				smartSegError: "",
				smartSegSqlMeta: null,
				smartSegRagMeta: null,
				smartSegResultRows: [],
				smartSegResultColumns: [],
				smartSegDisplayRows: [],
				smartSegSearch: "",
				smartSegSortKey: "",
				smartSegSortDir: "asc",
				smartSegPage: 1,
				smartSegPageSize: 20,
				smartSegTotalCount: 0,
				smartSegFilteredCount: 0,
				smartSegSelectedRecordIds: []
			}), "jokers");

			// discovery model – ML Wizard
			this.setModel(new JSONModel({
				wizardInitDone: false,
				wizardError: "",
				entryMode: "launcher",
				sessionId: "",
				launcherTiles: [
					{
						id: "advisor",
						title: "1. Felfedezes",
						subtitle: "AI altal javasolt uzleti lehetosegek",
						icon: "sap-icon://lightbulb"
					},
					{
						id: "classic",
						title: "2. Klasszikus ML trening",
						subtitle: "A jelenlegi varazslo teljes folyamata",
						icon: "sap-icon://machine"
					},
					{
						id: "structured",
						title: "3. Strukturalt AI modell (RPT1)",
						subtitle: "Altalanos CSV predikcio strukturalt modellhez",
						icon: "sap-icon://ai"
					}
				],
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
					{ key: "fast",     title: "Gyors",           description: "Azonnali eredmény, egyszerűbb modell. Kisebb adathalmazhoz vagy gyors teszteléshez.", icon: "sap-icon://accelerated",  color: "#e78c07", selected: false },
					{ key: "balanced", title: "Kiegyensúlyozott", description: "Jó arány a pontosság és a futási idő között. Legtöbb esetben ez az ajánlott.",      icon: "sap-icon://compare",      color: "#0854a0", selected: true },
					{ key: "accurate", title: "Pontos",           description: "Maximális pontosság, hosszabb futási idő. Nagy adathalmazhoz és kritikus döntésekhez.", icon: "sap-icon://quality-issue", color: "#107e3e", selected: false }
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
			}), "discovery");

			// noah model
			this.setModel(new JSONModel({
				state: "IDLE",
				statusText: "",
				error: "",
				agentEnabled: false,
				agentBusy: false,
				agentPlan: null,
				agentConstraints: [],
				agentApprovalPending: false,
				agentProblemStatement: "",
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

			// noah2 model
			this.setModel(new JSONModel({
				state: "IDLE",
				statusText: "",
				error: "",
				hasConversationStarted: false,
				autoScrollEnabled: true,
				showScrollToBottom: false,
				promptImproverBusy: false,
				promptImproverImprovedPrompt: "",
				promptImproverAwaitingRun: false,
				agentEnabled: false,
				businessAiEnabled: true,
				automationMode: "immediate",
				automationLabel: "Azonnali",
				agentBusy: false,
				agentPlan: null,
				agentConstraints: [],
				agentApprovalPending: false,
				agentProblemStatement: "",
				agentStepResults: [],
				insightsOpen: false,
				dictationSupported: false,
				dictationActive: false,
				dictationUnavailableReason: "",
				selectedInsightMessageIndex: -1,
				selectedJokerLabel: "Automatikus router",
				draftMessage: "",
				messages: [],
				attachments: [],
				routerLog: [],
				manualCardOptions: [{
					id: "",
					name: "Automatikus router"
				}],
				manualSelectedCardId: "",
				dummy4PreviewRows: [],
				dummy4GeneratedSql: "",
				dummy4Summary: "",
				dummy4ChartAvailable: false,
				dummy9PreviewRows: [],
				dummy9Summary: "",
				dummy9ChartAvailable: false,
				dummy9SelectedSource: "",
				schemaHintExpanded: false,
				agentEditingStepIndex: -1,
				activeCard: null,
				activeCardRuntimeFields: [],
				pendingConfirmation: null
			}), "noah2");

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
