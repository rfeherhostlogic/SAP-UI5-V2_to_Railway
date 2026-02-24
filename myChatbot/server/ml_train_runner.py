#!/usr/bin/env python3
import argparse
import csv
import hashlib
import json
import os
import sqlite3
import sys


def progress(value, msg):
    print(f"[progress] {int(value)} {msg}", flush=True)


def deterministic_score(row, keys):
    payload = "|".join(str(row.get(k, "")) for k in keys)
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()
    num = int(digest[:8], 16)
    return (num % 1000) / 1000.0


def derive_prediction_label_semantics(spec):
    semantics = spec.get("prediction_label_semantics") or {}
    field_name = str(semantics.get("field_name") or "prediction_label").strip() or "prediction_label"
    raw_labels = semantics.get("labels") or []
    labels = [str(x).strip() for x in raw_labels if str(x).strip()]
    labels = labels[:3]

    if len(labels) < 2:
        use_case = spec.get("use_case") or {}
        title = str(use_case.get("title") or spec.get("use_case_id") or "").lower()
        ml_type = str(use_case.get("ml_type") or "").lower()
        if "klaszter" in title or "cluster" in title or "klaszter" in ml_type:
            labels = ["Alacsony aktivitású ügyfél", "Visszatérő vevő", "Elkötelezett vevő"]
        elif "lemorzsol" in title or "churn" in title:
            labels = ["Megtartható ügyfél", "Lemorzsolódási kockázat"]
        else:
            labels = ["Alacsony prioritás", "Magas prioritás"]

    return field_name, labels


def map_score_to_label(score, labels):
    if len(labels) >= 3:
        if score < 0.34:
            return labels[0]
        if score < 0.67:
            return labels[1]
        return labels[2]
    return labels[1] if score >= 0.5 else labels[0]


def pick_table_and_columns(conn, spec):
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    tables = [r[0] for r in cur.fetchall()]
    preferred = spec.get("data", {}).get("tables", [])
    candidates = [t for t in preferred if t in tables] + [t for t in tables if t not in preferred]
    if not candidates:
        raise RuntimeError("Nincs elérhető tábla a tréninghez.")

    best_table = candidates[0]
    best_score = -1
    required_fields = set(spec.get("use_case", {}).get("required_fields", []))
    for table in candidates:
        cur.execute(f'PRAGMA table_info("{table}")')
        cols = [r[1] for r in cur.fetchall()]
        score = len(required_fields.intersection(set(cols)))
        if score > best_score:
            best_score = score
            best_table = table

    cur.execute(f'PRAGMA table_info("{best_table}")')
    columns = [r[1] for r in cur.fetchall()]
    return best_table, columns


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--job-dir", required=True)
    parser.add_argument("--spec-json", required=True)
    args = parser.parse_args()

    os.makedirs(args.job_dir, exist_ok=True)
    progress(5, "Specifikáció beolvasása")

    with open(args.spec_json, "r", encoding="utf-8") as fh:
        spec = json.load(fh)

    db_path = spec.get("data", {}).get("db_path")
    if not db_path or not os.path.exists(db_path):
        raise RuntimeError(f"SQLite adatbázis nem található: {db_path}")

    progress(20, "Adatforrás elemzése")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    table_name, columns = pick_table_and_columns(conn, spec)
    used_columns = columns[: min(8, len(columns))]
    col_expr = ", ".join([f'"{c}"' for c in used_columns]) if used_columns else "*"

    progress(45, "Minták előkészítése")
    cur = conn.cursor()
    cur.execute(f'SELECT {col_expr} FROM "{table_name}" LIMIT 1000')
    rows = [dict(r) for r in cur.fetchall()]

    label_field_name, label_names = derive_prediction_label_semantics(spec)

    enriched = []
    for row in rows:
        score = deterministic_score(row, used_columns)
        out = dict(row)
        out["prediction_score"] = round(score, 3)
        out[label_field_name] = map_score_to_label(score, label_names)
        enriched.append(out)

    progress(70, "Eredmények mentése")
    csv_path = os.path.join(args.job_dir, "result_full.csv")
    preview_path = os.path.join(args.job_dir, "result_preview.json")
    metrics_path = os.path.join(args.job_dir, "metrics.json")

    fieldnames = list(enriched[0].keys()) if enriched else ["prediction_score", "prediction_label"]
    with open(csv_path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        for row in enriched:
            writer.writerow(row)

    with open(preview_path, "w", encoding="utf-8") as fh:
        json.dump(enriched[:50], fh, ensure_ascii=False, indent=2)

    label_distribution = {}
    for r in enriched:
        lbl = str(r.get(label_field_name, ""))
        label_distribution[lbl] = label_distribution.get(lbl, 0) + 1

    metrics = {
        "selected_table": table_name,
        "row_count": len(enriched),
        "avg_score": round(sum(r["prediction_score"] for r in enriched) / len(enriched), 4) if enriched else 0,
        "prediction_label_field": label_field_name,
        "prediction_label_values": label_names,
        "label_distribution": label_distribution,
    }
    with open(metrics_path, "w", encoding="utf-8") as fh:
        json.dump(metrics, fh, ensure_ascii=False, indent=2)

    conn.close()
    progress(100, "Tréning kész")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr, flush=True)
        sys.exit(1)
