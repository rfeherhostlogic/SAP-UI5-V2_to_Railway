#!/usr/bin/env node
// Használat: node db/generate_seed.js > db/inventory_seed.sql
// Determinisztikus SAP HANA-kompatibilis INSERT utasításokat állít elő
// az INV_* készletgazdálkodási táblákhoz.
'use strict';

// Mulberry32 véletlenszám-generátor (determinisztikus)
function createRng(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = createRng(20250601);

function ri(min, max) { return Math.floor(min + rng() * (max - min + 1)); }
function rf(min, max, dp) {
  const v = min + rng() * (max - min);
  return Math.round(v * Math.pow(10, dp)) / Math.pow(10, dp);
}

function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }
function pad2(n) { return String(n).padStart(2, '0'); }
function dateStr(y, m, d) { return `${y}-${pad2(m)}-${pad2(d)}`; }

// Szezónális szorzó
function seasonalMult(pattern, month) {
  if (pattern === 'ppe')       return (month >= 4 && month <= 9) ? 1.4 : 0.75;
  if (pattern === 'chemical')  return (month <= 3 || month >= 10) ? 1.3 : 0.85;
  if (pattern === 'packaging') {
    if (month === 10 || month === 11) return 1.8;
    if (month === 9  || month === 12) return 1.3;
    return 0.85;
  }
  return 1.0;
}

// ================================================================
// TÖRZSADATOK
// ================================================================
const CATEGORIES = [
  ['CAT01', 'Elektronikai alkatrészek',         'Kábelek, csatlakozók, PLC és villamos alkatrészek'],
  ['CAT02', 'Csomagolóanyagok',                 'Dobozok, fóliák, ragasztószalagok és burkolóanyagok'],
  ['CAT03', 'Vegyszerek és kenőanyagok',        'Oldószerek, kenőzsírok, olajok és tisztítószerek'],
  ['CAT04', 'Mechanikai alkatrészek',           'Csavarok, csapágyak, tömítések és szerszámok'],
  ['CAT05', 'Egyéni védőeszközök (EPE)',        'Kesztyűk, szemüvegek, mellények és egyéb védőfelszerelések'],
  ['CAT06', 'Irodaszerek',                      'Papíráru, nyomtatási kellékek, irodai fogyóeszközök'],
];

const SUPPLIERS = [
  ['SUP01', 'GlobalElec Trade Zrt.',   'ertekesites@globalelec.hu',   7,  72.0],
  ['SUP02', 'PaperPack Hungary Kft.',  'megrendeles@paperpack.hu',    5,  88.0],
  ['SUP03', 'ChemSolutions Kft.',      'rendeles@chemsolutions.hu',  14,  85.0],
  ['SUP04', 'MetalFix Ipari Kft.',     'info@metalfix.hu',           10,  91.0],
  ['SUP05', 'SafetyFirst Kft.',        'webshop@safetyfirst.hu',      6,  89.0],
  ['SUP06', 'OfficeDirect Kft.',       'megrendeles@officedirect.hu', 3,  95.0],
  ['SUP07', 'Siemens AG',             'siemens.hu@siemens.com',     21,  97.0],
  ['SUP08', 'FlexoPack Kft.',         'flex@flexopack.hu',            4,  83.0],
];

// [id, code, name, catId, unit, price, supId, lead, minStock, maxStock, reorderQty, avgDemand, trendFactor, seasonal]
const PRODUCTS = [
  // CAT01 – Elektronikai alkatrészek
  ['PROD01','EL-KAB-225',   'Rézkábel 2x2.5mm² (100m tekercs)',      'CAT01','tekercs',   8500,'SUP01', 7,  3, 15,  5, 0.30, 1.00,'normal'],
  ['PROD02','EL-KAB-466',   'Rézkábel 4x6mm² (100m tekercs)',         'CAT01','tekercs',  19800,'SUP01', 7,  2, 10,  3, 0.15, 1.00,'normal'],
  ['PROD03','EL-RJ45-C6',   'RJ45 csatlakozó Cat6 (100db/csomag)',    'CAT01','csomag',    4800,'SUP01', 7,  8, 40, 10, 0.80, 1.00,'normal'],
  ['PROD04','EL-CPU-S7120', 'Siemens S7-1200 CPU modul',              'CAT01','db',      189500,'SUP07',21,  2,  6,  2, 0.07, 1.00,'normal'],
  ['PROD05','EL-LED-E2710', 'LED izzó E27 10W (10db/csomag)',         'CAT01','csomag',    3200,'SUP01', 7, 15, 60, 15, 0.50, 1.00,'normal'],
  ['PROD06','EL-BIZ-16AT',  '16A biztosíték betét (50db/csomag)',     'CAT01','csomag',    2100,'SUP01', 7, 12, 50, 12, 0.60, 1.00,'normal'],
  // CAT02 – Csomagolóanyagok
  ['PROD07','CS-DOB-A4100', 'Kartondoboz A4 méret (100db/köteg)',     'CAT02','köteg',     8900,'SUP02', 5, 25,100, 25, 2.00, 1.00,'packaging'],
  ['PROD08','CS-BUB-12050', 'Buborékfólia 1.2m×50m (tekercs)',       'CAT02','tekercs',  12400,'SUP08', 5,  5, 20,  5, 0.30, 0.90,'packaging'],
  ['PROD09','CS-RAG-486',   'Ragasztószalag barna 48mm (6 tekercs)', 'CAT02','csomag',    1850,'SUP08', 4, 15, 70, 15, 1.50, 1.00,'packaging'],
  ['PROD10','CS-STR-500',   'Stretch fólia 500mm×250m (tekercs)',    'CAT02','tekercs',   6700,'SUP02', 5,  8, 40,  8, 0.80, 1.00,'packaging'],
  ['PROD11','CS-HOZ-40100', 'Hőzsugor fólia 40cm (100m)',            'CAT02','tekercs',   9800,'SUP08', 4,  4, 18,  4, 0.20, 1.00,'packaging'],
  ['PROD12','CS-DOB-604040','Kartondoboz 60x40x40cm (50db/köteg)',   'CAT02','köteg',    18500,'SUP02', 5, 12, 50, 12, 1.00, 1.00,'packaging'],
  // CAT03 – Vegyszerek és kenőanyagok
  ['PROD13','VE-ACE-1L',    'Aceton oldószer (1L)',                   'CAT03','liter',     2800,'SUP03',14, 15, 70, 20, 3.50, 1.00,'chemical'],
  ['PROD14','VE-KEN-5KG',   'Ipari kenőzsír (5kg vödör)',             'CAT03','kg',        8900,'SUP03',14,  4, 18,  5, 0.40, 1.00,'chemical'],
  ['PROD15','VE-GEP-500',   'Géptisztító spray (500ml)',              'CAT03','db',        3400,'SUP03',14, 12, 55, 15, 1.50, 1.05,'chemical'],
  ['PROD16','VE-HYD-2046',  'Hydraulikaolaj ISO 46 (20L kanna)',     'CAT03','kanna',    18500,'SUP03',14,  3, 12,  3, 0.20, 1.00,'chemical'],
  ['PROD17','VE-ROZ-400',   'Rozsdaoldó spray 400ml',                'CAT03','db',        2200,'SUP03',14, 12, 60, 15, 1.20, 1.00,'chemical'],
  // CAT04 – Mechanikai alkatrészek
  ['PROD18','ME-CSA-M830',  'M8×30 csavar (100db/csomag)',           'CAT04','csomag',    1400,'SUP04',10, 40,180, 40, 5.00, 1.00,'normal'],
  ['PROD19','ME-CSA-M1040', 'M10×40 csavar (100db/csomag)',          'CAT04','csomag',    1800,'SUP04',10, 25,110, 30, 3.00, 1.00,'normal'],
  ['PROD20','ME-CSA-6205',  '6205-ZZ golyóscsapágy',                 'CAT04','db',        3200,'SUP04',10, 12, 55, 15, 1.50, 1.00,'normal'],
  ['PROD21','ME-CSA-6305',  '6305-ZZ golyóscsapágy',                 'CAT04','db',        4100,'SUP04',10,  8, 38, 10, 1.00, 1.00,'normal'],
  ['PROD22','ME-TEF-12M',   'Teflon tömítőszalag 12mm (12m/tekercs)','CAT04','tekercs',    380,'SUP04',10, 16, 75, 20, 2.00, 1.00,'normal'],
  ['PROD23','ME-ORG-503',   'O-gyűrű 50×3mm (100db/csomag)',         'CAT04','csomag',    1900,'SUP04',10, 32,145, 40, 4.00, 1.00,'normal'],
  ['PROD24','ME-LAT-20M1',  'Lánctengely 20mm×1m',                   'CAT04','db',       12800,'SUP04',10,  2,  8,  2, 0.10, 1.00,'normal'],
  ['PROD25','ME-KUL-819',   'Lapos kulcs készlet 8-19mm',            'CAT04','készlet',   8400,'SUP04',10,  2,  8,  2, 0.05, 1.00,'normal'],
  // CAT05 – Egyéni védőeszközök
  ['PROD26','EV-KEZ-L12',   'Védőkesztyű L méret (12 pár/csomag)',  'CAT05','csomag',    3600,'SUP05', 6, 16, 70, 20, 2.00, 1.00,'ppe'],
  ['PROD27','EV-SZE-UV5',   'Védőszemüveg UV szűrős (5db)',         'CAT05','csomag',    4200,'SUP05', 6, 12, 55, 15, 1.50, 1.00,'ppe'],
  ['PROD28','EV-MEL-L5',    'Jólláthatósági mellény L (5db)',        'CAT05','csomag',    7800,'SUP05', 6,  4, 18,  5, 0.30, 1.00,'ppe'],
  ['PROD29','EV-SIS-EN397', 'Védősisak fehér EN397',                 'CAT05','db',        6500,'SUP05', 6,  3, 12,  3, 0.20, 1.00,'ppe'],
  ['PROD30','EV-FUL-30DB',  'Fülvédő tokos 30dB (5db/csomag)',      'CAT05','csomag',    9200,'SUP05', 6,  4, 18,  5, 0.40, 1.00,'ppe'],
  ['PROD31','EV-FFP-2M20',  'FFP2 szűrős maszk (20db/doboz)',       'CAT05','doboz',     4800,'SUP05', 6, 22, 95, 30, 3.00, 1.05,'ppe'],
  // CAT06 – Irodaszerek
  ['PROD32','IR-A4-80G',    'A4 nyomtatópapír 80g (5×500 lap)',     'CAT06','csomag',    3900,'SUP06', 3,  8, 35, 10, 0.50, 1.00,'normal'],
  ['PROD33','IR-TON-HPB',   'Toner HP LaserJet fekete',              'CAT06','db',       22500,'SUP06', 3,  4, 18,  5, 0.50, 0.90,'normal'],
  ['PROD34','IR-GOL-K50',   'Golyóstoll kék (50db/doboz)',           'CAT06','doboz',     2800,'SUP06', 3,  4, 18,  5, 0.30, 0.90,'normal'],
  ['PROD35','IR-FOL-100',   'Csomagoló műanyagfólia (100 lap)',      'CAT06','csomag',    1200,'SUP06', 3,  4, 18,  5, 0.40, 1.00,'normal'],
];

// [product_id, current_quantity, warehouse_zone]
// Design:
//   CRITICAL (5): PROD03, PROD04, PROD13, PROD20, PROD26
//   WARNING  (4): PROD01, PROD15, PROD22, PROD31
//   EXCESS   (6): PROD08, PROD10, PROD17, PROD29, PROD33, PROD34
//   STABLE  (20): a többi
const CURRENT_STOCK = [
  // CRITICAL – days_until_stockout <= lead_time_days
  ['PROD03',  5.0, 'A-01'],  // avg=0.80 → days=6  ≤ lead=7
  ['PROD04',  1.0, 'A-02'],  // avg=0.07 → days=14 ≤ lead=21
  ['PROD13', 10.0, 'B-01'],  // avg=3.50 → days=2  ≤ lead=14
  ['PROD20',  8.0, 'C-01'],  // avg=1.50 → days=5  ≤ lead=10
  ['PROD26',  8.0, 'C-03'],  // avg=2.00 → days=4  ≤ lead=6
  // WARNING – lead < days <= lead+7
  ['PROD01',  4.0, 'A-01'],  // avg=0.30 → days=13, 7<13≤14
  ['PROD15', 28.0, 'B-01'],  // avg=1.50 → days=18, 14<18≤21
  ['PROD22', 24.0, 'C-02'],  // avg=2.00 → days=12, 10<12≤17
  ['PROD31', 24.0, 'C-04'],  // avg=3.00 → days=8,  6<8≤13
  // EXCESS – current_quantity > max_stock_level
  ['PROD08', 28.0, 'B-02'],  // max=20
  ['PROD10', 58.0, 'B-02'],  // max=40
  ['PROD17', 80.0, 'B-01'],  // max=60
  ['PROD29', 18.0, 'C-04'],  // max=12
  ['PROD33', 28.0, 'D-01'],  // max=18
  ['PROD34', 30.0, 'D-01'],  // max=18
  // STABLE – minden más termék
  ['PROD02',  6.0, 'A-01'],
  ['PROD05', 45.0, 'A-02'],
  ['PROD06', 35.0, 'A-02'],
  ['PROD07', 60.0, 'B-02'],
  ['PROD09', 50.0, 'B-02'],
  ['PROD11', 10.0, 'B-02'],
  ['PROD12', 30.0, 'B-02'],
  ['PROD14', 12.0, 'B-01'],
  ['PROD16',  7.0, 'B-01'],
  ['PROD18',120.0, 'C-01'],
  ['PROD19', 70.0, 'C-01'],
  ['PROD21', 25.0, 'C-01'],
  ['PROD23',100.0, 'C-02'],
  ['PROD24',  4.0, 'C-01'],
  ['PROD25',  5.0, 'C-01'],
  ['PROD27', 35.0, 'C-03'],
  ['PROD28', 12.0, 'C-04'],
  ['PROD30', 12.0, 'C-04'],
  ['PROD32', 25.0, 'D-01'],
  ['PROD35', 12.0, 'D-01'],
];

// ================================================================
// SQL GENERÁLÁS
// ================================================================
const today = new Date();

function sq(v) {
  // SQL string-literal escape (HANA-kompatibilis)
  return "'" + String(v).replace(/'/g, "''") + "'";
}
function hd(d) {
  // HANA date literal: DATE'YYYY-MM-DD'
  return "DATE'" + d + "'";
}

const out = [];
out.push('-- ================================================================');
out.push('-- KÉSZLETGAZDÁLKODÁS – SEED ADATOK (SAP HANA kompatibilis)');
out.push('-- Generálva: ' + today.toISOString().slice(0, 10));
out.push('-- ================================================================');
out.push('');
out.push('BEGIN TRANSACTION;');
out.push('');

// --- Kategóriák ---
out.push('-- Kategóriák');
for (const [id, name, desc] of CATEGORIES) {
  out.push(`INSERT INTO INV_CATEGORIES (category_id, category_name, description) VALUES (${sq(id)}, ${sq(name)}, ${sq(desc)});`);
}
out.push('');

// --- Szállítók ---
out.push('-- Szállítók');
for (const [id, name, email, lead, rel] of SUPPLIERS) {
  out.push(`INSERT INTO INV_SUPPLIERS (supplier_id, supplier_name, contact_email, default_lead_days, reliability_score) VALUES (${sq(id)}, ${sq(name)}, ${sq(email)}, ${lead}, ${rel});`);
}
out.push('');

// --- Termékek ---
out.push('-- Termékek (35 db)');
for (const p of PRODUCTS) {
  const [id, code, name, catId, unit, price, supId, lead, minS, maxS, reorder] = p;
  out.push(
    `INSERT INTO INV_PRODUCTS (product_id, product_code, product_name, category_id, unit, unit_price, supplier_id, lead_time_days, min_stock_level, max_stock_level, reorder_quantity) VALUES (${sq(id)}, ${sq(code)}, ${sq(name)}, ${sq(catId)}, ${sq(unit)}, ${price}, ${sq(supId)}, ${lead}, ${minS}, ${maxS}, ${reorder});`
  );
}
out.push('');

// --- Készletmozgások (18 hónap, napi egyedi kiadások + havi bevételezések) ---
out.push('-- Készletmozgások (~2 900 sor, 18 hónap, 35 termék)');
out.push('-- movement_id: GENERATED BY DEFAULT AS IDENTITY – nem szükséges megadni');
out.push('');

let movSeq = 1; // HANA identity – itt a seed explicit megadja az ID-t az ismételhetőség érdekében

for (const p of PRODUCTS) {
  const [prodId,,,,,,,,,,,avgDemand, trendFactor, seasonal] = p;

  // Elmúlt 90 nap: napi OUT mozgások (trend utolsó 30 napban)
  for (let d = 90; d >= 1; d--) {
    const movDate = new Date(today.getTime() - d * 86400000);
    const y = movDate.getFullYear();
    const mo = movDate.getMonth() + 1;
    const dy = movDate.getDate();
    const ds = dateStr(y, mo, dy);

    const sm = seasonalMult(seasonal, mo);
    const ef = d <= 30 ? trendFactor : 1.0;
    const variance = 0.65 + rng() * 0.70;
    const qty = Math.max(0.1, Math.round(avgDemand * ef * sm * variance * 10) / 10);
    const ref = `SZ-${y}${pad2(mo)}${pad2(dy)}-${String(movSeq % 9000 + 1000).slice(0, 4)}`;
    out.push(`INSERT INTO INV_STOCK_MOVEMENTS (product_id, movement_date, quantity, movement_type, reference_doc) VALUES (${sq(prodId)}, ${hd(ds)}, ${-qty}, 'OUT', ${sq(ref)});`);
    movSeq++;
  }

  // Negyedévente bevételezés az elmúlt 90 napban (30, 60, 90 napja)
  for (const daysAgo of [89, 59, 29]) {
    const movDate = new Date(today.getTime() - daysAgo * 86400000);
    const y = movDate.getFullYear();
    const mo = movDate.getMonth() + 1;
    const dy = movDate.getDate();
    const ds = dateStr(y, mo, dy);
    const inQty = Math.round(avgDemand * 30 * 1.3 * 10) / 10;
    const ref = `PO-${y}${pad2(mo)}${pad2(dy)}-${String(movSeq % 9000 + 1000).slice(0, 4)}`;
    out.push(`INSERT INTO INV_STOCK_MOVEMENTS (product_id, movement_date, quantity, movement_type, reference_doc) VALUES (${sq(prodId)}, ${hd(ds)}, ${inQty}, 'IN', ${sq(ref)});`);
    movSeq++;
  }

  // 3–18 hónap: havi batch OUT + kéthavonkénti IN
  for (let mAgo = 3; mAgo <= 18; mAgo++) {
    const baseDate = new Date(today.getFullYear(), today.getMonth() - mAgo, 1);
    const y = baseDate.getFullYear();
    const mo = baseDate.getMonth() + 1;
    const maxDay = daysInMonth(y, mo);
    const sm = seasonalMult(seasonal, mo);
    const monthlyTotal = avgDemand * 30 * sm;

    // 4–6 OUT mozgás havonta
    const numOut = ri(4, 6);
    let remaining = monthlyTotal;
    for (let i = 0; i < numOut; i++) {
      const frac = i < numOut - 1 ? (0.1 + rng() * 0.25) : 1.0;
      const qty = Math.max(0.1, Math.round(remaining * (i < numOut - 1 ? frac : 1.0) * 10) / 10);
      if (i < numOut - 1) { remaining = Math.max(0.1, remaining - qty); }
      const dy = ri(1, maxDay);
      const ds = dateStr(y, mo, dy);
      const ref = `SZ-${y}${pad2(mo)}${pad2(dy)}-${String(movSeq % 9000 + 1000).slice(0, 4)}`;
      out.push(`INSERT INTO INV_STOCK_MOVEMENTS (product_id, movement_date, quantity, movement_type, reference_doc) VALUES (${sq(prodId)}, ${hd(ds)}, ${-qty}, 'OUT', ${sq(ref)});`);
      movSeq++;
    }

    // Kéthavonként bevételezés
    if (mAgo % 2 === 0) {
      const inQty = Math.round(monthlyTotal * rf(1.8, 2.5, 1) * 10) / 10;
      const dy = ri(2, Math.min(8, maxDay));
      const ds = dateStr(y, mo, dy);
      const ref = `PO-${y}${pad2(mo)}${pad2(dy)}-${String(movSeq % 9000 + 1000).slice(0, 4)}`;
      out.push(`INSERT INTO INV_STOCK_MOVEMENTS (product_id, movement_date, quantity, movement_type, reference_doc) VALUES (${sq(prodId)}, ${hd(ds)}, ${inQty}, 'IN', ${sq(ref)});`);
      movSeq++;
    }
  }
  out.push(''); // termékek közé üres sor az olvashatóságért
}

// --- Aktuális készletszintek ---
out.push('-- Aktuális készletszintek (INV_CURRENT_STOCK)');
for (const [prodId, qty, zone] of CURRENT_STOCK) {
  out.push(`INSERT INTO INV_CURRENT_STOCK (product_id, current_quantity, warehouse_zone) VALUES (${sq(prodId)}, ${qty}, ${sq(zone)});`);
}
out.push('');
out.push('COMMIT;');
out.push('');
out.push(`-- Összesen beillesztett mozgás-sor: ${movSeq - 1}`);
out.push(`-- Termékek: ${PRODUCTS.length}  |  Szállítók: ${SUPPLIERS.length}  |  Kategóriák: ${CATEGORIES.length}`);

console.log(out.join('\n'));
