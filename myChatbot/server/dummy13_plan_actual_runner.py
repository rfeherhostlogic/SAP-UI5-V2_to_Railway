#!/usr/bin/env python3
import argparse
import csv
import json
import math
import os
import sys
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
    "amount": ["amount", "osszeg", "ertek", "value", "teny", "actual", "plan", "sum", "net", "egyenleg"],
    "metric": ["metric", "mutato", "measure", "sor", "line", "kategori", "category", "megnevezes"],
    "project": ["project", "projekt", "job", "program"],
    "cost_center": ["costcenter", "cost_center", "koltseghely", "cc", "cost centre"],
    "account": ["account", "gl", "ledger", "fokonyv", "fokonyvi", "szamla"],
    "region": ["region", "territory", "orszag", "country", "area", "piac"],
}
DATE_FORMATS = [
    "%Y-%m-%d",
    "%Y.%m.%d",
    "%Y/%m/%d",
    "%d.%m.%Y",
    "%d/%m/%Y",
    "%m/%d/%Y",
    "%Y-%m",
    "%Y.%m",
    "%Y/%m",
]


def normalize_header(value):
    return "".join(ch.lower() for ch in str(value or "").strip() if ch.isalnum())


def detect_dialect(file_path):
    with open(file_path, "r", encoding="utf-8-sig", errors="replace", newline="") as handle:
        sample = handle.read(4096)
    if not sample.strip():
        return csv.excel
    try:
        return csv.Sniffer().sniff(sample, delimiters="".join(SUPPORTED_DELIMITERS))
    except Exception:
        return csv.excel


def read_csv_preview(file_path, sample_limit=10):
    dialect = detect_dialect(file_path)
    with open(file_path, "r", encoding="utf-8-sig", errors="replace", newline="") as handle:
        reader = csv.DictReader(handle, dialect=dialect)
        columns = [str(col or "").strip() for col in (reader.fieldnames or []) if str(col or "").strip()]
        rows = []
        row_count = 0
        for raw_row in reader:
            if raw_row is None:
                continue
            row_count += 1
            if len(rows) >= sample_limit:
                continue
            rows.append({col: str(raw_row.get(col, "") or "").strip() for col in columns})
    return {
        "columns": columns,
        "row_count": row_count,
        "sample_rows": rows,
    }


def suggest_semantic_mapping(columns):
    suggestions = {}
    scores = {}
    normalized = {col: normalize_header(col) for col in columns}
    for field in SEMANTIC_FIELDS:
      key = field["key"]
      best_col = ""
      best_score = 0
      for col in columns:
          normalized_col = normalized[col]
          score = 0
          for synonym in HEADER_SYNONYMS.get(key, []):
              synonym_norm = normalize_header(synonym)
              if not synonym_norm:
                  continue
              if normalized_col == synonym_norm:
                  score = max(score, 100)
              elif synonym_norm in normalized_col:
                  score = max(score, 70)
          if key == "amount" and any(token in normalized_col for token in ["terv", "teny", "actual", "plan"]):
              score = max(score, 60)
          if score > best_score:
              best_score = score
              best_col = col
      suggestions[key] = best_col
      scores[key] = best_score
    return suggestions, scores


def build_preview_payload(plan_path, actual_path):
    plan = read_csv_preview(plan_path)
    actual = read_csv_preview(actual_path)
    plan_map, plan_scores = suggest_semantic_mapping(plan["columns"])
    actual_map, actual_scores = suggest_semantic_mapping(actual["columns"])
    compare_candidates = []
    for field in ["project", "cost_center", "account", "region", "metric"]:
        if plan_map.get(field) and actual_map.get(field):
            compare_candidates.append(field)
    if not compare_candidates and plan_map.get("metric") and actual_map.get("metric"):
        compare_candidates = ["metric"]
    confidence_values = [plan_scores.get("amount", 0), actual_scores.get("amount", 0), plan_scores.get("date", 0), actual_scores.get("date", 0)]
    mapping_confidence = sum(confidence_values) / (len(confidence_values) * 100) if confidence_values else 0.0
    return {
        "plan_preview": plan,
        "actual_preview": actual,
        "suggested_mapping": {
            "plan": plan_map,
            "actual": actual_map,
            "compare_keys": compare_candidates,
            "mapping_confidence": round(mapping_confidence, 2),
        },
        "semantic_fields": SEMANTIC_FIELDS,
    }


def load_json(path_value):
    with open(path_value, "r", encoding="utf-8") as handle:
        return json.load(handle)


def parse_number(value):
    text = str(value or "").strip()
    if not text:
        return None
    negative = False
    if text.startswith("(") and text.endswith(")"):
        negative = True
        text = text[1:-1]
    text = text.replace("\u00a0", " ").replace(" ", "")
    if "," in text and "." in text:
        if text.rfind(",") > text.rfind("."):
            text = text.replace(".", "").replace(",", ".")
        else:
            text = text.replace(",", "")
    elif "," in text:
        if text.count(",") == 1:
            text = text.replace(",", ".")
        else:
            text = text.replace(",", "")
    try:
        number = float(text)
    except Exception:
        return None
    return -number if negative else number


def parse_date(value):
    text = str(value or "").strip()
    if not text:
        return None
    for fmt in DATE_FORMATS:
        try:
            parsed = datetime.strptime(text, fmt)
            if fmt in ("%Y-%m", "%Y.%m", "%Y/%m"):
                return datetime(parsed.year, parsed.month, 1)
            return parsed
        except Exception:
            continue
    try:
        return datetime.fromisoformat(text[:10])
    except Exception:
        return None


def canonical_key(parts):
    return "|".join(str(part or "").strip().lower() for part in parts)


def build_canonical_records(file_path, source_name, mapping, compare_keys):
    preview = read_csv_preview(file_path, sample_limit=999999)
    rows = preview["sample_rows"]
    total_rows = len(rows)
    valid_rows = []
    quality = {
        "source": source_name,
        "total_rows": total_rows,
        "valid_rows": 0,
        "invalid_amount_rows": 0,
        "invalid_date_rows": 0,
        "missing_key_rows": 0,
        "duplicate_groups": 0,
    }
    seen_keys = {}
    for idx, row in enumerate(rows):
        amount_col = mapping.get("amount") or ""
        date_col = mapping.get("date") or ""
        amount = parse_number(row.get(amount_col, "")) if amount_col else None
        date_obj = parse_date(row.get(date_col, "")) if date_col else None
        if amount is None:
            quality["invalid_amount_rows"] += 1
            continue
        if date_col and date_obj is None:
            quality["invalid_date_rows"] += 1
            continue
        semantic_values = {}
        missing_key = False
        for field in SEMANTIC_FIELDS:
            field_key = field["key"]
            source_col = mapping.get(field_key) or ""
            semantic_values[field_key] = str(row.get(source_col, "") or "").strip() if source_col else ""
        compare_values = []
        for key in compare_keys:
            value = str(semantic_values.get(key, "") or "").strip()
            compare_values.append(value)
            if not value:
                missing_key = True
        if missing_key:
            quality["missing_key_rows"] += 1
            continue
        dedupe_key = canonical_key([semantic_values.get("date", ""), semantic_values.get("metric", "")] + compare_values)
        seen_keys[dedupe_key] = seen_keys.get(dedupe_key, 0) + 1
        valid_rows.append({
            "source": source_name,
            "row_id": source_name + "-" + str(idx + 1),
            "date": date_obj.strftime("%Y-%m-%d") if date_obj else "",
            "amount": amount,
            "metric": semantic_values.get("metric", ""),
            "project": semantic_values.get("project", ""),
            "cost_center": semantic_values.get("cost_center", ""),
            "account": semantic_values.get("account", ""),
            "region": semantic_values.get("region", ""),
            "compare_values": {key: semantic_values.get(key, "") for key in compare_keys},
            "raw_row": row,
        })
    quality["valid_rows"] = len(valid_rows)
    quality["duplicate_groups"] = sum(1 for count in seen_keys.values() if count > 1)
    return {
        "columns": preview["columns"],
        "records": valid_rows,
        "quality": quality,
        "sample": valid_rows[:10],
    }


def build_normalize_payload(plan_path, actual_path, config):
    mapping = config.get("mapping", {})
    compare_keys = config.get("compare_keys", [])
    plan = build_canonical_records(plan_path, "plan", mapping.get("plan", {}), compare_keys)
    actual = build_canonical_records(actual_path, "actual", mapping.get("actual", {}), compare_keys)
    total_rows = plan["quality"]["total_rows"] + actual["quality"]["total_rows"]
    valid_rows = plan["quality"]["valid_rows"] + actual["quality"]["valid_rows"]
    coverage = float(valid_rows) / float(total_rows) if total_rows else 0.0
    return {
        "quality_summary": {
            "plan": plan["quality"],
            "actual": actual["quality"],
            "comparison_coverage": round(coverage, 2),
            "mapping_confidence": round(float(config.get("mapping_confidence", 0) or 0), 2),
        },
        "normalized_samples": {
            "plan": plan["sample"],
            "actual": actual["sample"],
        },
    }


def bucket_period(date_text, granularity):
    if not date_text:
        return "n/a"
    if granularity == "daily":
        return date_text
    return date_text[:7]


def average(values):
    valid = [float(v) for v in values if v is not None]
    if not valid:
        return 0.0
    return sum(valid) / len(valid)


def std_dev(values, mean_value):
    valid = [float(v) for v in values if v is not None]
    if not valid:
        return 1.0
    variance = sum((value - mean_value) ** 2 for value in valid) / len(valid)
    return math.sqrt(variance) if variance > 1e-9 else 1.0


def build_analysis_payload(plan_path, actual_path, config):
    mapping = config.get("mapping", {})
    compare_keys = config.get("compare_keys", [])
    rules = config.get("rules", {})
    granularity = str(rules.get("granularity", "monthly") or "monthly")
    grouping_keys = rules.get("grouping_keys", compare_keys) or compare_keys
    threshold_pct = float(rules.get("threshold_pct", 10) or 10)
    absolute_threshold = float(rules.get("absolute_threshold", 100000) or 100000)
    zscore_cutoff = float(rules.get("zscore_cutoff", 2.5) or 2.5)

    plan = build_canonical_records(plan_path, "plan", mapping.get("plan", {}), compare_keys)
    actual = build_canonical_records(actual_path, "actual", mapping.get("actual", {}), compare_keys)

    aggregates = {}

    def consume(records, field_name):
        for record in records:
            key_parts = [bucket_period(record.get("date", ""), granularity)]
            group_obj = {"period": bucket_period(record.get("date", ""), granularity)}
            for grouping_key in grouping_keys:
                value = str(record.get(grouping_key, "") or record.get("compare_values", {}).get(grouping_key, "")).strip()
                key_parts.append(value)
                group_obj[grouping_key] = value
            aggregate_key = canonical_key(key_parts)
            bucket = aggregates.setdefault(aggregate_key, {
                "group": group_obj,
                "plan": 0.0,
                "actual": 0.0,
                "plan_count": 0,
                "actual_count": 0
            })
            bucket[field_name] += float(record.get("amount", 0) or 0)
            bucket[field_name + "_count"] += 1

    consume(plan["records"], "plan")
    consume(actual["records"], "actual")

    rows = []
    for bucket in aggregates.values():
        plan_value = float(bucket.get("plan", 0) or 0)
        actual_value = float(bucket.get("actual", 0) or 0)
        variance = actual_value - plan_value
        variance_pct = ((variance / abs(plan_value)) * 100.0) if abs(plan_value) > 1e-9 else None
        row = {
            "period": bucket["group"].get("period", ""),
            "groupLabel": ", ".join(["{}={}".format(key, bucket["group"].get(key, "")) for key in grouping_keys if bucket["group"].get(key, "")]) or "(nincs kulcs)",
            "plan": round(plan_value, 2),
            "actual": round(actual_value, 2),
            "variance": round(variance, 2),
            "variancePct": round(variance_pct, 2) if variance_pct is not None else None,
            "planCount": int(bucket.get("plan_count", 0)),
            "actualCount": int(bucket.get("actual_count", 0)),
            "group": bucket["group"],
            "flags": [],
        }
        rows.append(row)

    variance_values = [row["variance"] for row in rows]
    mean_value = average(variance_values)
    std_value = std_dev(variance_values, mean_value)

    for row in rows:
        zscore = (row["variance"] - mean_value) / std_value if std_value > 1e-9 else 0.0
        row["zscore"] = round(zscore, 2)
        if abs(row["variance"]) >= absolute_threshold:
            row["flags"].append("threshold_abs")
        if row["variancePct"] is not None and abs(row["variancePct"]) >= threshold_pct:
            row["flags"].append("threshold_pct")
        if abs(zscore) >= zscore_cutoff:
            row["flags"].append("zscore")

    rows.sort(key=lambda item: abs(item["variance"]), reverse=True)
    top_drivers = rows[:10]
    evidence = [row for row in rows if row["flags"]][:15] or rows[:10]

    coverage = 0.0
    total_rows = plan["quality"]["total_rows"] + actual["quality"]["total_rows"]
    valid_rows = plan["quality"]["valid_rows"] + actual["quality"]["valid_rows"]
    if total_rows:
        coverage = float(valid_rows) / float(total_rows)
    mapping_confidence = float(config.get("mapping_confidence", 0) or 0)
    confidence_score = round((coverage * 0.7) + (mapping_confidence * 0.3), 2)
    if confidence_score >= 0.8:
        confidence_label = "magas"
    elif confidence_score >= 0.6:
        confidence_label = "kozepes"
    else:
        confidence_label = "alacsony"

    total_plan = round(sum(row["plan"] for row in rows), 2)
    total_actual = round(sum(row["actual"] for row in rows), 2)
    total_variance = round(total_actual - total_plan, 2)
    total_variance_pct = round(((total_variance / abs(total_plan)) * 100.0), 2) if abs(total_plan) > 1e-9 else None

    bullets = []
    limitations = []
    if total_variance_pct is not None:
        direction = "meghaladta" if total_variance > 0 else "elmaradt"
        bullets.append("A tenyleges ertek {} a tervet, az elteres {}%.".format(direction, total_variance_pct))
    if top_drivers:
        top = top_drivers[0]
        bullets.append("A legnagyobb hozzajarulas innen jott: {} (variancia: {}).".format(top["groupLabel"], top["variance"]))
    if evidence:
        bullets.append("A kiemelt allitasok {} bizonyitekalapu aggregalt csoporton alapulnak.".format(len(evidence)))
    if coverage < 0.6:
        limitations.append("Az ervenyes coverage alacsony, ezert a kovetkeztetesek korlatozottan megbizhatoak.")
    if mapping_confidence < 0.6:
        limitations.append("A mezomapping bizonytalansaga miatt erdemes felulvizsgalni a mappinget.")
    if not evidence:
        limitations.append("Nincs elegendo bizonyitek eros allitas megfogalmazasahoz.")

    return {
        "quality_summary": {
            "plan": plan["quality"],
            "actual": actual["quality"],
            "comparison_coverage": round(coverage, 2),
            "mapping_confidence": round(mapping_confidence, 2),
            "confidence_score": confidence_score,
            "confidence_label": confidence_label,
        },
        "summary_totals": {
            "plan_total": total_plan,
            "actual_total": total_actual,
            "variance_total": total_variance,
            "variance_pct_total": total_variance_pct,
        },
        "result_rows": rows[:200],
        "top_drivers": top_drivers,
        "evidence_rows": evidence,
        "narrative": {
            "headline": "Terv-teny osszevetes elkeszult",
            "bullets": bullets,
            "limitations": limitations,
        },
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", required=True, choices=["preview", "normalize", "analyze"])
    parser.add_argument("--plan", required=True)
    parser.add_argument("--actual", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--config")
    args = parser.parse_args()

    if args.mode == "preview":
        payload = build_preview_payload(args.plan, args.actual)
    else:
        config = load_json(args.config) if args.config else {}
        if args.mode == "normalize":
            payload = build_normalize_payload(args.plan, args.actual, config)
        else:
            payload = build_analysis_payload(args.plan, args.actual, config)

    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr, flush=True)
        sys.exit(1)
