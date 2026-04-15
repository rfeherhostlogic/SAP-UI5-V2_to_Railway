#!/usr/bin/env python3
"""
Dummy 14 – Terv-tény összehasonlítás (v2, javított)
Javítások a Dummy 13-hoz képest:
  - why_flagged: szöveges magyarázat minden evidence sor mellé
  - variance_category: szisztematikus vs egyszeri kategorizálás per csoport
  - project_insights: per-csoport vizsgálati szöveg ("Miért vizsgáld?")
  - suggested_thresholds: adatokon alapuló küszöbérték-javaslat
  - Jobb narratíva: valódi csoportneveket tartalmaz
"""
import argparse
import csv
import json
import math
import os
import sys
import unicodedata
from datetime import datetime


SUPPORTED_DELIMITERS = [",", ";", "\t", "|"]
SEMANTIC_FIELDS = [
    {"key": "date", "label": "Datum", "required": True},
    {"key": "amount", "label": "Osszeg", "required": True},
    {"key": "metric", "label": "Metrika", "required": False},
    {"key": "project", "label": "Projekt", "required": False},
    {"key": "cost_center", "label": "Koltseghely", "required": False},
    {"key": "account", "label": "Fokonyvi szamla", "required": False},
    {"key": "region", "label": "Regio", "required": False},
]
HEADER_SYNONYMS = {
    "date": ["date", "datum", "period", "posting", "book", "month", "honap"],
    "amount": ["amount", "osszeg", "ertek", "value", "teny", "actual", "plan", "sum", "net",
               "egyenleg", "bevetel", "kolt", "eredmeny", "marzs", "ora", "hour", "hours",
               "munkaora", "ledolgozottora", "tervezettora", "koltseg", "cost", "fee", "dij"],
    "metric": ["metric", "mutato", "measure", "sor", "line", "kategori", "category", "megnevezes",
               "tevekenyseg", "activity", "task", "feladat", "workitem", "work_item"],
    "project": ["project", "projekt", "job", "program"],
    "cost_center": ["costcenter", "cost_center", "koltseghely", "cc", "cost centre"],
    "account": ["account", "gl", "ledger", "fokonyv", "fokonyvi", "szamla"],
    "region": ["region", "territory", "orszag", "country", "area", "piac"],
}
DATE_FORMATS = [
    "%Y-%m-%d", "%Y.%m.%d", "%Y/%m/%d",
    "%d.%m.%Y", "%d/%m/%Y", "%m/%d/%Y",
    "%Y-%m", "%Y.%m", "%Y/%m",
]


def normalize_header(value):
    normalized = unicodedata.normalize("NFKD", str(value or "").strip())
    ascii_text = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return "".join(ch.lower() for ch in ascii_text if ch.isalnum())


def detect_dialect(file_path):
    try:
        with open(file_path, "r", encoding="utf-8-sig", errors="replace") as f:
            sample = f.read(8192)
        sniffer = csv.Sniffer()
        dialect = sniffer.sniff(sample, delimiters=",;\t|")
        return dialect
    except Exception:
        return csv.excel


def read_csv_preview(file_path):
    dialect = detect_dialect(file_path)
    columns = []
    sample_rows = []
    row_count = 0
    with open(file_path, "r", encoding="utf-8-sig", errors="replace") as f:
        reader = csv.DictReader(f, dialect=dialect)
        columns = list(reader.fieldnames or [])
        for row in reader:
            row_count += 1
            if len(sample_rows) < 10:
                sample_rows.append(dict(row))
    return {"columns": columns, "row_count": row_count, "sample_rows": sample_rows}


def is_mostly_numeric(values):
    populated = [v for v in values if str(v or "").strip()]
    if not populated:
        return False
    numeric = 0
    for value in populated:
        if not math.isnan(parse_number(value)):
            numeric += 1
    return numeric / max(len(populated), 1) >= 0.8


def score_amount_candidate(norm_col, sample_values):
    score = 0
    if not is_mostly_numeric(sample_values):
        return score

    score += 20
    if "ora" in norm_col or "hour" in norm_col:
        score += 70
    if "ledolgozott" in norm_col or "tervezett" in norm_col:
        score += 20
    if "koltseg" in norm_col or "cost" in norm_col:
        score += 45
    if "dij" in norm_col or "fee" in norm_col or "rate" in norm_col:
        score += 35
    if "amount" in norm_col or "osszeg" in norm_col or "value" in norm_col:
        score += 35
    return score


def find_best_amount_column(columns, sample_rows):
    ranked = []
    for col in columns:
        norm_col = normalize_header(col)
        sample_values = [row.get(col, "") for row in sample_rows[:10]]
        score = score_amount_candidate(norm_col, sample_values)
        if score > 0:
            ranked.append({
                "column": col,
                "normalized": norm_col,
                "score": score,
                "unit": "hours" if ("ora" in norm_col or "hour" in norm_col) else (
                    "currency" if ("koltseg" in norm_col or "cost" in norm_col or "dij" in norm_col or "fee" in norm_col)
                    else "generic"
                )
            })
    ranked.sort(key=lambda item: item["score"], reverse=True)
    return ranked


def suggest_semantic_mapping(columns, sample_rows):
    norm_cols = {normalize_header(c): c for c in columns}
    suggestions = {}
    scores = {}
    for field in SEMANTIC_FIELDS:
        fkey = field["key"]
        best_col = ""
        best_score = 0
        synonyms = HEADER_SYNONYMS.get(fkey, [])
        for norm_c, orig_c in norm_cols.items():
            score = 0
            if norm_c == fkey:
                score = 100
            elif norm_c in synonyms:
                score = 80
            else:
                for syn in synonyms:
                    if syn in norm_c or norm_c in syn:
                        score = max(score, 60)
            if score > best_score:
                best_score = score
                best_col = orig_c
        suggestions[fkey] = best_col if best_score >= 60 else ""
        scores[fkey] = best_score
    amount_candidates = find_best_amount_column(columns, sample_rows)
    return {"suggestions": suggestions, "scores": scores, "amount_candidates": amount_candidates}


def build_preview_payload(plan_path, actual_path):
    plan_preview = read_csv_preview(plan_path)
    actual_preview = read_csv_preview(actual_path)
    plan_sug = suggest_semantic_mapping(plan_preview["columns"], plan_preview["sample_rows"])
    actual_sug = suggest_semantic_mapping(actual_preview["columns"], actual_preview["sample_rows"])
    plan_amount_candidates = plan_sug.get("amount_candidates", [])
    actual_amount_candidates = actual_sug.get("amount_candidates", [])
    preferred_unit = None
    if any(item["unit"] == "hours" for item in plan_amount_candidates) and any(item["unit"] == "hours" for item in actual_amount_candidates):
        preferred_unit = "hours"
    elif any(item["unit"] == "currency" for item in plan_amount_candidates) and any(item["unit"] == "currency" for item in actual_amount_candidates):
        preferred_unit = "currency"
    if preferred_unit:
        plan_match = next((item for item in plan_amount_candidates if item["unit"] == preferred_unit), None)
        actual_match = next((item for item in actual_amount_candidates if item["unit"] == preferred_unit), None)
        if plan_match and actual_match:
            plan_sug["suggestions"]["amount"] = plan_match["column"]
            actual_sug["suggestions"]["amount"] = actual_match["column"]
            plan_sug["scores"]["amount"] = max(plan_sug["scores"].get("amount", 0), plan_match["score"])
            actual_sug["scores"]["amount"] = max(actual_sug["scores"].get("amount", 0), actual_match["score"])
    all_scores = list(plan_sug["scores"].values()) + list(actual_sug["scores"].values())
    mapped_scores = [s for s in all_scores if s > 0]
    confidence = round(len(mapped_scores) / max(len(all_scores), 1) * 0.7 +
                       (sum(mapped_scores) / max(len(mapped_scores), 1)) / 100 * 0.3, 2)
    compare_keys = [k for k in ["project", "cost_center", "account", "region", "metric"]
                    if plan_sug["suggestions"].get(k) and actual_sug["suggestions"].get(k)]
    return {
        "plan_preview": plan_preview,
        "actual_preview": actual_preview,
        "suggested_mapping": {
            "plan": plan_sug["suggestions"],
            "actual": actual_sug["suggestions"],
            "compare_keys": compare_keys[:3],
            "mapping_confidence": confidence,
        },
        "semantic_fields": SEMANTIC_FIELDS,
    }


def parse_number(value):
    if value is None:
        return float("nan")
    s = str(value).strip()
    if not s:
        return float("nan")
    negative = False
    if s.startswith("(") and s.endswith(")"):
        negative = True
        s = s[1:-1].strip()
    s = s.replace(" ", "").replace("\xa0", "")
    # European format: 1.234,56
    if "," in s and "." in s:
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    elif "," in s:
        if s.count(",") == 1 and len(s.split(",")[1]) <= 2:
            s = s.replace(",", ".")
        else:
            s = s.replace(",", "")
    try:
        result = float(s)
        return -result if negative else result
    except ValueError:
        return float("nan")


def parse_date(value):
    if value is None:
        return None
    s = str(value).strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def canonical_key(parts):
    return "|".join(str(p or "").lower().strip() for p in parts)


def build_canonical_records(file_path, mapping, compare_keys, source_label):
    dialect = detect_dialect(file_path)
    records = []
    quality = {
        "source": source_label,
        "total_rows": 0,
        "valid_rows": 0,
        "invalid_amount_rows": 0,
        "invalid_date_rows": 0,
        "missing_key_rows": 0,
        "duplicate_groups": 0,
    }
    with open(file_path, "r", encoding="utf-8-sig", errors="replace") as f:
        reader = csv.DictReader(f, dialect=dialect)
        for row_idx, row in enumerate(reader):
            quality["total_rows"] += 1
            row_id = source_label + "-" + str(row_idx + 1)
            amount_col = mapping.get("amount", "")
            date_col = mapping.get("date", "")
            amount_raw = row.get(amount_col, "") if amount_col else ""
            date_raw = row.get(date_col, "") if date_col else ""
            amount = parse_number(amount_raw)
            date_obj = parse_date(date_raw)
            if math.isnan(amount):
                quality["invalid_amount_rows"] += 1
                continue
            if date_obj is None:
                quality["invalid_date_rows"] += 1
                continue
            compare_values = {}
            missing_key = False
            for ck in compare_keys:
                col = mapping.get(ck, "")
                val = str(row.get(col, "") if col else "").strip()
                if not val:
                    missing_key = True
                    break
                compare_values[ck] = val
            if missing_key:
                quality["missing_key_rows"] += 1
                continue
            record = {
                "source": source_label,
                "row_id": row_id,
                "date": date_obj.strftime("%Y-%m-%d"),
                "amount": amount,
                "compare_values": compare_values,
            }
            for field in ["metric", "project", "cost_center", "account", "region"]:
                col = mapping.get(field, "")
                record[field] = str(row.get(col, "") if col else "").strip()
            quality["valid_rows"] += 1
            records.append(record)
    return {"records": records, "quality": quality}


def build_normalize_payload(plan_path, actual_path, config):
    mapping = config.get("mapping", {}) if config else {}
    compare_keys = config.get("compare_keys", []) if config else []
    mapping_confidence = float(config.get("mapping_confidence", 0) if config else 0)
    plan_map = mapping.get("plan", {})
    actual_map = mapping.get("actual", {})
    plan_data = build_canonical_records(plan_path, plan_map, compare_keys, "plan")
    actual_data = build_canonical_records(actual_path, actual_map, compare_keys, "actual")
    plan_keys = set(canonical_key(list(r["compare_values"].values())) for r in plan_data["records"])
    actual_keys = set(canonical_key(list(r["compare_values"].values())) for r in actual_data["records"])
    common = plan_keys & actual_keys
    total_keys = plan_keys | actual_keys
    coverage = round(len(common) / max(len(total_keys), 1), 2)
    return {
        "quality_summary": {
            "plan": plan_data["quality"],
            "actual": actual_data["quality"],
            "comparison_coverage": coverage,
            "mapping_confidence": mapping_confidence,
        },
        "normalized_samples": {
            "plan": plan_data["records"][:10],
            "actual": actual_data["records"][:10],
        },
    }


def bucket_period(date_str, granularity):
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        if granularity == "daily":
            return date_str
        return dt.strftime("%Y-%m")
    except Exception:
        return date_str


def average(values):
    if not values:
        return 0.0
    return sum(values) / len(values)


def std_dev(values):
    if len(values) < 2:
        return 0.0
    mu = average(values)
    variance = sum((v - mu) ** 2 for v in values) / (len(values) - 1)
    return math.sqrt(variance)


def percentile(sorted_values, pct):
    if not sorted_values:
        return 0.0
    idx = (len(sorted_values) - 1) * pct / 100.0
    lo = int(math.floor(idx))
    hi = int(math.ceil(idx))
    if lo == hi:
        return sorted_values[lo]
    return sorted_values[lo] + (sorted_values[hi] - sorted_values[lo]) * (idx - lo)


def build_why_flagged_text(variance, variance_pct, zscore, flags, threshold_pct, absolute_threshold, zscore_cutoff):
    """Szöveges magyarázat a flagelt sorokhoz."""
    parts = []
    if "zscore" in flags:
        direction = "fölötte" if zscore > 0 else "alatta"
        parts.append("Statisztikai kiugró: a sor {:.1f} szórásnyira van az átlagtól ({:.1f}>{:.1f})".format(
            abs(zscore), abs(zscore), zscore_cutoff))
    if "threshold_pct" in flags:
        direction = "túllépés" if variance > 0 else "elmaradás"
        parts.append("Százalékos küszöb ({}) megsértve: {:.1f}% eltérés (limit: {}%)".format(
            direction, abs(variance_pct) if not math.isnan(variance_pct) else 0,
            threshold_pct))
    if "threshold_abs" in flags:
        direction = "túllépés" if variance > 0 else "elmaradás"
        parts.append("Abszolút küszöb ({}) megsértve: {:,.0f} eltérés (limit: {:,.0f})".format(
            direction, abs(variance), absolute_threshold))
    if not parts:
        parts.append("Kiugró érték több szűrő kombinációja alapján")
    return "; ".join(parts)


def classify_pattern(variances_by_period):
    """
    Szisztematikus: a periódusok >= 75%-ában azonos irányú az eltérés.
    Egyszeri: csak 1 periódusban van flagelt eltérés.
    Vegyes: se nem szisztematikus, se nem egyszeri.
    """
    if not variances_by_period:
        return "ismeretlen"
    positive = sum(1 for v in variances_by_period if v > 0)
    negative = sum(1 for v in variances_by_period if v < 0)
    total = len(variances_by_period)
    if total == 1:
        return "egyszeri"
    if positive / total >= 0.75:
        return "szisztematikus_tulkoltekezs"
    if negative / total >= 0.75:
        return "szisztematikus_elmarads"
    return "vegyesen"


def build_investigation_text(group_label, pattern_type, total_variance, periods_with_data,
                              periods_over, periods_under, confidence_label):
    """Szöveges vizsgálati javaslat per csoport."""
    direction_text = ""
    if total_variance > 0:
        direction_text = "túllépte a tervet"
    else:
        direction_text = "elmaradt a tervtől"

    pattern_text = ""
    if pattern_type == "szisztematikus_tulkoltekezs":
        pattern_text = (
            "{} periódusból {}×-ban konzisztensen túllépte a tervet – valószínűleg "
            "alultervezett tétel vagy strukturális probléma.".format(
                periods_with_data, periods_over))
    elif pattern_type == "szisztematikus_elmarads":
        pattern_text = (
            "{} periódusból {}×-ban konzisztensen elmaradt a tervtől – "
            "érdemes megvizsgálni, hogy a terv túl optimista volt-e.".format(
                periods_with_data, periods_under))
    elif pattern_type == "egyszeri":
        pattern_text = "Csak 1 periódusban mutat eltérést – valószínűleg egyszeri esemény."
    else:
        pattern_text = (
            "{} periódusból {}× volt túllépés és {}× elmaradás – "
            "vegyes minta, érdemes részletesebben elemezni.".format(
                periods_with_data, periods_over, periods_under))

    confidence_warn = ""
    if confidence_label == "alacsony":
        confidence_warn = " (Figyelem: alacsony konfidencia – az adatok lefedettségét érdemes ellenőrizni.)"

    return "{}: {:,.0f} összesített eltéréssel {}. {}{}".format(
        group_label, abs(total_variance), direction_text, pattern_text, confidence_warn)


def build_analysis_payload(plan_path, actual_path, config):
    mapping = config.get("mapping", {}) if config else {}
    compare_keys = config.get("compare_keys", []) if config else []
    rules = config.get("rules", {}) if config else {}
    mapping_confidence = float(config.get("mapping_confidence", 0) if config else 0)

    granularity = str(rules.get("granularity", "monthly"))
    grouping_keys = list(rules.get("grouping_keys", compare_keys) or compare_keys)
    threshold_pct = float(rules.get("threshold_pct", 10))
    absolute_threshold = float(rules.get("absolute_threshold", 100000))
    zscore_cutoff = float(rules.get("zscore_cutoff", 2.5))

    plan_map = mapping.get("plan", {})
    actual_map = mapping.get("actual", {})
    plan_data = build_canonical_records(plan_path, plan_map, compare_keys, "plan")
    actual_data = build_canonical_records(actual_path, actual_map, compare_keys, "actual")

    plan_records = plan_data["records"]
    actual_records = actual_data["records"]

    plan_keys = set(canonical_key(list(r["compare_values"].values())) for r in plan_records)
    actual_keys = set(canonical_key(list(r["compare_values"].values())) for r in actual_records)
    common_keys = plan_keys & actual_keys
    total_keys = plan_keys | actual_keys
    coverage = round(len(common_keys) / max(len(total_keys), 1), 2)

    # Aggregation: period + grouping_keys → {plan: sum, actual: sum}
    aggregates = {}
    group_labels = {}

    def get_group_key(record, keys):
        parts = [record["compare_values"].get(k, "") for k in keys]
        return canonical_key(parts)

    def get_group_label(record, keys):
        parts = [record["compare_values"].get(k, "") for k in keys]
        return " | ".join(p for p in parts if p)

    for rec in plan_records:
        period = bucket_period(rec["date"], granularity)
        gkey = get_group_key(rec, grouping_keys)
        agg_key = canonical_key([period, gkey])
        if agg_key not in aggregates:
            aggregates[agg_key] = {"period": period, "plan": 0.0, "actual": 0.0,
                                    "plan_count": 0, "actual_count": 0, "gkey": gkey}
            group_labels[agg_key] = get_group_label(rec, grouping_keys)
        aggregates[agg_key]["plan"] += rec["amount"]
        aggregates[agg_key]["plan_count"] += 1

    for rec in actual_records:
        period = bucket_period(rec["date"], granularity)
        gkey = get_group_key(rec, grouping_keys)
        agg_key = canonical_key([period, gkey])
        if agg_key not in aggregates:
            aggregates[agg_key] = {"period": period, "plan": 0.0, "actual": 0.0,
                                    "plan_count": 0, "actual_count": 0, "gkey": gkey}
            group_labels[agg_key] = get_group_label(rec, grouping_keys)
        aggregates[agg_key]["actual"] += rec["amount"]
        aggregates[agg_key]["actual_count"] += 1

    # Variance calculation
    result_rows = []
    for agg_key, agg in aggregates.items():
        plan_val = agg["plan"]
        actual_val = agg["actual"]
        variance = actual_val - plan_val
        variance_pct = (variance / plan_val * 100) if plan_val != 0 else float("nan")
        result_rows.append({
            "agg_key": agg_key,
            "gkey": agg["gkey"],
            "period": agg["period"],
            "groupLabel": group_labels.get(agg_key, ""),
            "plan": round(plan_val, 2),
            "actual": round(actual_val, 2),
            "variance": round(variance, 2),
            "variancePct": round(variance_pct, 2) if not math.isnan(variance_pct) else None,
            "planCount": agg["plan_count"],
            "actualCount": agg["actual_count"],
            "flags": [],
            "zscore": 0.0,
            "variance_category": "",
            "why_flagged": "",
        })

    # Z-score calculation
    variances = [r["variance"] for r in result_rows]
    mu = average(variances)
    sigma = std_dev(variances)

    for row in result_rows:
        z = (row["variance"] - mu) / sigma if sigma > 0 else 0.0
        row["zscore"] = round(z, 2)
        flags = []
        vp = row["variancePct"]
        if abs(row["variance"]) >= absolute_threshold:
            flags.append("threshold_abs")
        if vp is not None and abs(vp) >= threshold_pct:
            flags.append("threshold_pct")
        if abs(z) >= zscore_cutoff:
            flags.append("zscore")
        row["flags"] = flags
        if flags:
            row["why_flagged"] = build_why_flagged_text(
                row["variance"], vp if vp is not None else 0.0,
                z, flags, threshold_pct, absolute_threshold, zscore_cutoff)

    # Suggested thresholds based on data
    abs_variances_sorted = sorted([abs(r["variance"]) for r in result_rows])
    pct_variances_sorted = sorted([abs(r["variancePct"]) for r in result_rows
                                    if r["variancePct"] is not None])
    suggested_abs = round(percentile(abs_variances_sorted, 75), 0) if abs_variances_sorted else absolute_threshold
    suggested_pct = round(percentile(pct_variances_sorted, 75), 1) if pct_variances_sorted else threshold_pct
    suggested_thresholds = {
        "absolute_threshold": suggested_abs,
        "threshold_pct": suggested_pct,
        "basis": "Az adatok 75. percentilise alapján javasolt küszöbértékek."
    }

    # Top drivers
    result_rows_sorted = sorted(result_rows, key=lambda r: abs(r["variance"]), reverse=True)
    top_drivers = result_rows_sorted[:10]

    # Evidence rows: flagged rows
    evidence_rows = [r for r in result_rows if r["flags"]]
    if not evidence_rows:
        evidence_rows = result_rows_sorted[:10]
    else:
        evidence_rows = sorted(evidence_rows, key=lambda r: abs(r["variance"]), reverse=True)[:15]

    # Project insights: per gkey analysis
    gkey_to_rows = {}
    for row in result_rows:
        gk = row["gkey"]
        if gk not in gkey_to_rows:
            gkey_to_rows[gk] = []
        gkey_to_rows[gk].append(row)

    confidence_score = round(coverage * 0.7 + mapping_confidence * 0.3, 2)
    if confidence_score >= 0.8:
        confidence_label = "magas"
    elif confidence_score >= 0.6:
        confidence_label = "kozepes"
    else:
        confidence_label = "alacsony"

    project_insights = []
    for gk, rows in gkey_to_rows.items():
        total_variance = sum(r["variance"] for r in rows)
        variances_list = [r["variance"] for r in rows]
        periods_over = sum(1 for v in variances_list if v > 0)
        periods_under = sum(1 for v in variances_list if v < 0)
        pattern_type = classify_pattern(variances_list)
        group_label = rows[0]["groupLabel"] if rows else gk
        investigation_text = build_investigation_text(
            group_label, pattern_type, total_variance,
            len(rows), periods_over, periods_under, confidence_label)
        project_insights.append({
            "group": group_label,
            "gkey": gk,
            "total_variance": round(total_variance, 2),
            "periods_with_data": len(rows),
            "periods_over": periods_over,
            "periods_under": periods_under,
            "pattern_type": pattern_type,
            "is_systematic": pattern_type.startswith("szisztematikus"),
            "investigation_text": investigation_text,
        })
    project_insights.sort(key=lambda x: abs(x["total_variance"]), reverse=True)

    # Add variance_category to result rows
    gkey_pattern = {ins["gkey"]: ins["pattern_type"] for ins in project_insights}
    for row in result_rows:
        row["variance_category"] = gkey_pattern.get(row["gkey"], "")

    # Summary totals
    plan_total = sum(r["plan"] for r in result_rows)
    actual_total = sum(r["actual"] for r in result_rows)
    variance_total = actual_total - plan_total
    variance_pct_total = (variance_total / plan_total * 100) if plan_total != 0 else None

    # Narrative bullets (deterministic, with real group names)
    top_driver_label = top_drivers[0]["groupLabel"] if top_drivers else "ismeretlen"
    top_driver_variance = top_drivers[0]["variance"] if top_drivers else 0
    direction = "meghaladta" if variance_total > 0 else "elmaradt"
    direction2 = "túllépés" if top_driver_variance > 0 else "elmaradás"
    systematic_count = sum(1 for ins in project_insights if ins["is_systematic"])

    bullets = [
        "Az összes tény {:,.0f} egységgel {} a tervet ({:.1f}%).".format(
            abs(variance_total), direction,
            abs(variance_pct_total) if variance_pct_total is not None else 0),
        "Legnagyobb eltérés: {} ({:,.0f} {}).".format(
            top_driver_label, abs(top_driver_variance), direction2),
    ]
    if systematic_count > 0:
        bullets.append("{} csoport mutat szisztematikus eltérést (minden vagy majdnem minden periódusban).".format(
            systematic_count))
    if evidence_rows:
        bullets.append("{} sor flagelve lett küszöbérték vagy statisztikai szűrő alapján.".format(
            len(evidence_rows)))

    limitations = []
    if coverage < 0.7:
        limitations.append("Alacsony lefedettség ({:.0f}%): nem minden terv-tény pár egyeztethető össze.".format(
            coverage * 100))
    if mapping_confidence < 0.6:
        limitations.append("Alacsony mapping konfidencia: a mezőfelismerés bizonytalan.")
    if not evidence_rows:
        limitations.append("Nem volt egyetlen flagelt sor sem a megadott küszöbértékekkel.")

    clean_rows = []
    for r in result_rows[:200]:
        clean_rows.append({
            "period": r["period"],
            "groupLabel": r["groupLabel"],
            "plan": r["plan"],
            "actual": r["actual"],
            "variance": r["variance"],
            "variancePct": r["variancePct"],
            "zscore": r["zscore"],
            "flags": r["flags"],
            "variance_category": r["variance_category"],
            "why_flagged": r["why_flagged"],
        })

    clean_evidence = []
    for r in evidence_rows:
        clean_evidence.append({
            "period": r["period"],
            "groupLabel": r["groupLabel"],
            "plan": r["plan"],
            "actual": r["actual"],
            "variance": r["variance"],
            "variancePct": r["variancePct"],
            "zscore": r["zscore"],
            "flags": r["flags"],
            "variance_category": r["variance_category"],
            "why_flagged": r["why_flagged"],
        })

    clean_top = []
    for r in top_drivers:
        clean_top.append({
            "period": r["period"],
            "groupLabel": r["groupLabel"],
            "plan": r["plan"],
            "actual": r["actual"],
            "variance": r["variance"],
            "variancePct": r["variancePct"],
            "zscore": r["zscore"],
            "flags": r["flags"],
            "variance_category": r["variance_category"],
            "why_flagged": r["why_flagged"],
        })

    return {
        "quality_summary": {
            "plan": plan_data["quality"],
            "actual": actual_data["quality"],
            "comparison_coverage": coverage,
            "mapping_confidence": mapping_confidence,
            "confidence_score": confidence_score,
            "confidence_label": confidence_label,
        },
        "summary_totals": {
            "plan_total": round(plan_total, 2),
            "actual_total": round(actual_total, 2),
            "variance_total": round(variance_total, 2),
            "variance_pct_total": round(variance_pct_total, 2) if variance_pct_total is not None else None,
        },
        "result_rows": clean_rows,
        "top_drivers": clean_top,
        "evidence_rows": clean_evidence,
        "project_insights": project_insights,
        "suggested_thresholds": suggested_thresholds,
        "narrative": {
            "headline": "Terv-tény összehasonlítás elkészült",
            "bullets": bullets,
            "limitations": limitations,
        },
    }


def main():
    parser = argparse.ArgumentParser(description="Dummy14 Plan-Actual Runner")
    parser.add_argument("--mode", choices=["preview", "normalize", "analyze"], required=True)
    parser.add_argument("--plan", required=True)
    parser.add_argument("--actual", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--config", default=None)
    args = parser.parse_args()

    config = None
    if args.config:
        with open(args.config, "r", encoding="utf-8") as f:
            config = json.load(f)

    if args.mode == "preview":
        result = build_preview_payload(args.plan, args.actual)
    elif args.mode == "normalize":
        result = build_normalize_payload(args.plan, args.actual, config)
    else:
        result = build_analysis_payload(args.plan, args.actual, config)

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("HIBA: " + str(exc), file=sys.stderr)
        sys.exit(1)
