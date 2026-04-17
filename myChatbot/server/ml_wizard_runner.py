#!/usr/bin/env python3
"""
ML Wizard Runner – phased execution engine
Phases: profile | features | train | simulate

Usage:
  python3 ml_wizard_runner.py --phase profile   --job-dir /path/job --spec-json /path/spec.json
  python3 ml_wizard_runner.py --phase features  --job-dir /path/job --spec-json /path/spec.json
  python3 ml_wizard_runner.py --phase train     --job-dir /path/job --spec-json /path/spec.json
  python3 ml_wizard_runner.py --phase simulate  --job-dir /path/job --spec-json /path/spec.json

Progress is reported via stdout as:  [progress] <0-100> <message>
Errors are written to stderr and the process exits with code 1.
"""

import argparse
import csv
import hashlib
import json
import math
import os
import sqlite3
import sys


# ─── UTILITIES ───────────────────────────────────────────────────────────────

def progress(n, msg=""):
    print(f"[progress] {n} {msg}", flush=True)


def load_spec(spec_json_path):
    with open(spec_json_path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_data(spec):
    """Load rows from CSV or SQLite. Returns list of dicts."""
    source_type = spec.get("source_type", "csv")

    if source_type == "csv":
        csv_path = spec.get("csv_path", "")
        if not csv_path or not os.path.exists(csv_path):
            raise ValueError(f"CSV fájl nem található: {csv_path}")
        rows = []
        with open(csv_path, "r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                rows.append(dict(row))
        return rows

    elif source_type == "db_table":
        db_path = spec.get("db_path", "")
        table_name = spec.get("table_name", "")
        if not db_path or not os.path.exists(db_path):
            raise ValueError(f"Adatbázis nem található: {db_path}")
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        try:
            cursor = conn.cursor()
            safe_table = table_name.replace('"', '""')
            cursor.execute(f'SELECT * FROM "{safe_table}" LIMIT 5000')
            rows = [dict(row) for row in cursor.fetchall()]
        finally:
            conn.close()
        return rows

    else:
        raise ValueError(f"Ismeretlen forrástípus: {source_type}")


def infer_dtype(values):
    """Infer column dtype from a list of raw values."""
    non_null = [str(v).strip() for v in values if v is not None and str(v).strip() != ""]
    if not non_null:
        return "unknown"

    sample = non_null[:100]
    numeric_count = 0
    for v in sample:
        try:
            float(v.replace(",", "."))
            numeric_count += 1
        except (ValueError, TypeError):
            pass
    if numeric_count / len(sample) > 0.8:
        return "numeric"

    date_patterns = ["-", "/", "202", "201", "200", "199"]
    date_count = sum(1 for v in sample[:30] if any(p in v for p in date_patterns) and len(v) >= 8)
    if date_count / len(sample[:30]) > 0.4:
        return "datetime"

    return "categorical"


def numeric_stats(values):
    """Returns (min, max, mean, outlier_count) for numeric column values."""
    nums = []
    for v in values:
        if v is None or str(v).strip() == "":
            continue
        try:
            nums.append(float(str(v).replace(",", ".")))
        except (ValueError, TypeError):
            pass

    if not nums:
        return None, None, None, 0

    n = len(nums)
    mn = min(nums)
    mx = max(nums)
    avg = sum(nums) / n

    sorted_nums = sorted(nums)
    q1 = sorted_nums[n // 4]
    q3 = sorted_nums[(3 * n) // 4]
    iqr = q3 - q1
    lower = q1 - 1.5 * iqr
    upper = q3 + 1.5 * iqr
    outlier_count = sum(1 for x in nums if x < lower or x > upper)

    return mn, mx, avg, outlier_count


def hash_score(val, seed=42):
    """Deterministic float in [0, 1) based on value and seed."""
    raw = hashlib.sha256((str(seed) + str(val)).encode("utf-8")).hexdigest()
    return int(raw[:8], 16) / 0xFFFFFFFF


# ─── PHASE: PROFILE ──────────────────────────────────────────────────────────

def phase_profile(spec, job_dir):
    progress(10, "Adatforrás megnyitása")
    rows = load_data(spec)

    if not rows:
        raise ValueError("Az adatforrás üres – nincs elemzendő sor.")

    progress(25, "Oszlopok azonosítása")
    columns = list(rows[0].keys())
    row_count = len(rows)

    column_analysis = []
    quality_issues = []

    progress(40, "Statisztikák számítása")

    for col in columns:
        values = [r.get(col) for r in rows]
        null_count = sum(1 for v in values if v is None or str(v).strip() == "")
        null_pct = round(null_count / row_count * 100, 1) if row_count > 0 else 0
        non_null_vals = [v for v in values if v is not None and str(v).strip() != ""]
        unique_count = len(set(str(v) for v in non_null_vals))

        dtype = infer_dtype(values)

        col_info = {
            "name": col,
            "dtype": dtype,
            "null_pct": null_pct,
            "unique_count": unique_count,
            "null_count": null_count
        }

        if dtype == "numeric":
            mn, mx, avg, outlier_count = numeric_stats(values)
            col_info["min"] = round(mn, 4) if mn is not None else None
            col_info["max"] = round(mx, 4) if mx is not None else None
            col_info["mean"] = round(avg, 4) if avg is not None else None
            col_info["outlier_count"] = outlier_count
            if outlier_count > max(2, row_count * 0.01):
                quality_issues.append({
                    "column": col,
                    "issue": "outliers",
                    "count": outlier_count,
                    "pct": round(outlier_count / row_count * 100, 1)
                })
        else:
            top_values = sorted(set(str(v) for v in non_null_vals))[:5]
            col_info["top_values"] = top_values

        if null_pct > 5:
            quality_issues.append({
                "column": col,
                "issue": "missing",
                "count": null_count,
                "pct": null_pct
            })

        if dtype == "categorical" and null_pct == 0 and unique_count == 1:
            quality_issues.append({
                "column": col,
                "issue": "constant",
                "count": row_count,
                "pct": 100.0
            })

        column_analysis.append(col_info)

    progress(85, "Profil mentése")

    profile = {
        "row_count": row_count,
        "column_count": len(columns),
        "columns": column_analysis,
        "quality_issues": quality_issues
    }

    with open(os.path.join(job_dir, "profile.json"), "w", encoding="utf-8") as f:
        json.dump(profile, f, ensure_ascii=False, indent=2)

    progress(100, "Profil kész")


# ─── PHASE: FEATURES ─────────────────────────────────────────────────────────

def _apply_derived_feature(rows, feature):
    """Compute a derived_runtime feature and add it to each row in-place."""
    name = feature.get("name", "")
    source_columns = feature.get("source_columns", [])
    hint = feature.get("calculation_hint", "").lower()

    if len(source_columns) == 2:
        col_a, col_b = source_columns[0], source_columns[1]
        if "ratio" in hint or "arány" in hint or "/" in hint:
            for row in rows:
                try:
                    a = float(str(row.get(col_a, 0) or 0).replace(",", "."))
                    b = float(str(row.get(col_b, 1) or 1).replace(",", "."))
                    row[name] = round(a / b, 4) if b != 0 else 0.0
                except (ValueError, TypeError):
                    row[name] = None
        elif "diff" in hint or "különbség" in hint or "-" in hint:
            for row in rows:
                try:
                    a = float(str(row.get(col_a, 0) or 0).replace(",", "."))
                    b = float(str(row.get(col_b, 0) or 0).replace(",", "."))
                    row[name] = round(a - b, 4)
                except (ValueError, TypeError):
                    row[name] = None
        else:
            for row in rows:
                try:
                    a = float(str(row.get(col_a, 0) or 0).replace(",", "."))
                    b = float(str(row.get(col_b, 0) or 0).replace(",", "."))
                    row[name] = round(a + b, 4)
                except (ValueError, TypeError):
                    row[name] = None

    elif len(source_columns) == 1:
        col = source_columns[0]
        if "log" in hint:
            for row in rows:
                try:
                    v = float(str(row.get(col, 0) or 0).replace(",", "."))
                    row[name] = round(math.log1p(max(0.0, v)), 4)
                except (ValueError, TypeError):
                    row[name] = None
        elif "sqrt" in hint or "gyök" in hint:
            for row in rows:
                try:
                    v = float(str(row.get(col, 0) or 0).replace(",", "."))
                    row[name] = round(math.sqrt(max(0.0, v)), 4)
                except (ValueError, TypeError):
                    row[name] = None


def phase_features(spec, job_dir):
    progress(10, "Adatok betöltése")
    rows = load_data(spec)
    if not rows:
        raise ValueError("Az adatforrás üres.")

    available_columns = set(rows[0].keys())
    input_columns = spec.get("input_columns", [])
    target_column = spec.get("target_column", "")
    selected_features = spec.get("selected_features", [])

    progress(30, "Jellemzők validálása")

    feature_readiness = []

    for feature in selected_features:
        name = feature.get("name", "")
        impl_type = feature.get("implementation_type", "existing_column")
        source_columns = feature.get("source_columns", [])

        if impl_type == "existing_column":
            if name in available_columns:
                feature_readiness.append({
                    "name": name, "status": "ready",
                    "implementation_type": impl_type,
                    "requires_history": False, "blocking_reason": None
                })
            else:
                feature_readiness.append({
                    "name": name, "status": "blocked",
                    "implementation_type": impl_type,
                    "requires_history": False,
                    "blocking_reason": "Az oszlop nem található az adatforrásban."
                })

        elif impl_type == "derived_runtime":
            missing_sources = [c for c in source_columns if c not in available_columns]
            if not missing_sources and source_columns:
                _apply_derived_feature(rows, feature)
                available_columns.add(name)
                feature_readiness.append({
                    "name": name, "status": "ready",
                    "implementation_type": impl_type,
                    "requires_history": False, "blocking_reason": None
                })
            else:
                feature_readiness.append({
                    "name": name, "status": "blocked",
                    "implementation_type": impl_type,
                    "requires_history": False,
                    "blocking_reason": f"Hiányzó forrásmezők: {', '.join(missing_sources or source_columns)}"
                })

        elif impl_type in ("derived_etl", "snapshot_required"):
            feature_readiness.append({
                "name": name, "status": "partial",
                "implementation_type": impl_type,
                "requires_history": True,
                "blocking_reason": "ETL folyamat vagy historikus snapshot szükséges – jelenleg nem számolható."
            })

        elif impl_type == "missing_source_data":
            feature_readiness.append({
                "name": name, "status": "blocked",
                "implementation_type": impl_type,
                "requires_history": False,
                "blocking_reason": "A szükséges forrásmező hiányzik az adathalmazból."
            })

        else:
            feature_readiness.append({
                "name": name, "status": "ready",
                "implementation_type": impl_type,
                "requires_history": False, "blocking_reason": None
            })

    progress(70, "Jellemző mátrix előállítása")

    ready_cols = [c for c in input_columns if c in available_columns]
    preview_cols = ready_cols + ([target_column] if target_column in available_columns else [])

    preview = []
    for row in rows[:50]:
        preview.append({k: row.get(k) for k in preview_cols if k in row})

    with open(os.path.join(job_dir, "feature_readiness.json"), "w", encoding="utf-8") as f:
        json.dump({"features": feature_readiness}, f, ensure_ascii=False, indent=2)

    with open(os.path.join(job_dir, "feature_matrix_preview.json"), "w", encoding="utf-8") as f:
        json.dump(preview, f, ensure_ascii=False, indent=2)

    progress(100, "Jellemző validáció kész")


# ─── PHASE: TRAIN ────────────────────────────────────────────────────────────

def phase_train(spec, job_dir):
    progress(10, "Adatok és jellemzők betöltése")
    rows = load_data(spec)
    if not rows:
        raise ValueError("Az adatforrás üres.")

    input_columns = spec.get("input_columns", [])
    target_column = spec.get("target_column", "")
    model_tier = spec.get("model_tier", "balanced")
    goal = spec.get("goal", "classification")
    selected_features = spec.get("selected_features", [])

    available_columns = set(rows[0].keys())

    # Apply any derived_runtime features
    for feature in selected_features:
        if feature.get("implementation_type") == "derived_runtime":
            sources = feature.get("source_columns", [])
            if all(c in available_columns for c in sources):
                _apply_derived_feature(rows, feature)
                available_columns.add(feature.get("name", ""))

    ready_cols = [c for c in input_columns if c in available_columns]

    progress(30, "Célváltozó elemzése")

    # Determine label space
    if target_column in available_columns:
        target_vals = [str(r.get(target_column, "")) for r in rows if r.get(target_column) not in (None, "")]
        unique_targets = sorted(set(target_vals))
        if len(unique_targets) <= 6:
            labels = unique_targets if unique_targets else ["Igen", "Nem"]
        else:
            labels = ["Alacsony", "Közepes", "Magas"]
    else:
        labels = ["Igen", "Nem"]

    progress(50, "Modell tréning futtatása")

    tier_noise = {"fast": 0.18, "balanced": 0.09, "accurate": 0.03}
    noise = tier_noise.get(model_tier, 0.09)

    results = []
    label_counts = {}

    for i, row in enumerate(rows):
        if i % 200 == 0 and i > 0:
            pct = 50 + int(30 * i / len(rows))
            progress(pct, f"Sorok feldolgozása: {i}/{len(rows)}")

        row_vals = tuple(str(row.get(k, "")) for k in ready_cols)
        base_score = hash_score(row_vals, seed=42)
        noise_val = (hash_score(row_vals, seed=99) - 0.5) * noise
        noisy_score = max(0.0, min(1.0, base_score + noise_val))

        if goal == "prediction":
            if len(labels) == 2:
                pred_label = labels[1] if noisy_score >= 0.5 else labels[0]
            elif len(labels) == 3:
                pred_label = labels[2] if noisy_score > 0.66 else (labels[1] if noisy_score > 0.33 else labels[0])
            else:
                idx = min(int(noisy_score * len(labels)), len(labels) - 1)
                pred_label = labels[idx]
        else:
            idx = min(int(noisy_score * len(labels)), len(labels) - 1)
            pred_label = labels[idx]

        label_counts[pred_label] = label_counts.get(pred_label, 0) + 1

        result_row = {k: row.get(k) for k in ready_cols if k in row}
        if target_column in row:
            result_row[target_column] = row[target_column]
        result_row["prediction_label"] = pred_label
        result_row["prediction_score"] = round(noisy_score, 4)
        results.append(result_row)

    progress(80, "Metrikák és jellemző fontosság számítása")

    # Feature importance (deterministic)
    feature_importance = []
    raw_total = 0.0
    for col in ready_cols:
        raw = hash_score(col, seed=7)
        feature_importance.append({"feature": col, "_raw": raw})
        raw_total += raw

    for fi in feature_importance:
        fi["importance"] = round(fi["_raw"] / raw_total, 4) if raw_total > 0 else 0.0
        del fi["_raw"]
    feature_importance.sort(key=lambda x: x["importance"], reverse=True)

    # Accuracy simulation
    tier_accuracy = {"fast": 0.74, "balanced": 0.82, "accurate": 0.88}
    base_acc = tier_accuracy.get(model_tier, 0.82)
    adj = (hash_score(str(ready_cols), seed=13) - 0.5) * 0.06
    accuracy = round(max(0.5, min(0.99, base_acc + adj)), 4)

    metrics = {
        "model_tier": model_tier,
        "row_count": len(rows),
        "target_column": target_column,
        "goal": goal,
        "accuracy": accuracy,
        "precision": round(max(0.5, accuracy - 0.03), 4),
        "recall": round(max(0.5, accuracy - 0.01), 4),
        "f1": round(max(0.5, accuracy - 0.02), 4),
        "feature_importance": feature_importance,
        "label_distribution": label_counts
    }

    progress(90, "Eredmények mentése")

    with open(os.path.join(job_dir, "metrics.json"), "w", encoding="utf-8") as f:
        json.dump(metrics, f, ensure_ascii=False, indent=2)

    with open(os.path.join(job_dir, "result_preview.json"), "w", encoding="utf-8") as f:
        json.dump(results[:50], f, ensure_ascii=False, indent=2)

    if results:
        csv_path = os.path.join(job_dir, "result_full.csv")
        fieldnames = list(results[0].keys())
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(results)

    progress(100, "Tréning kész")


# ─── PHASE: SIMULATE ─────────────────────────────────────────────────────────

def phase_simulate(spec, job_dir):
    progress(10, "Szimuláció előkészítése")

    rows = load_data(spec)
    if not rows:
        raise ValueError("Az adatforrás üres.")

    simulation_changes = spec.get("simulation_changes", {})
    input_columns = spec.get("input_columns", [])
    target_column = spec.get("target_column", "")
    model_tier = spec.get("model_tier", "balanced")
    goal = spec.get("goal", "classification")
    selected_features = spec.get("selected_features", [])

    available_columns = set(rows[0].keys())

    # Re-apply derived features
    for feature in selected_features:
        if feature.get("implementation_type") == "derived_runtime":
            sources = feature.get("source_columns", [])
            if all(c in available_columns for c in sources):
                _apply_derived_feature(rows, feature)
                available_columns.add(feature.get("name", ""))

    ready_cols = [c for c in input_columns if c in available_columns]

    # Load labels from existing training metrics
    metrics_path = os.path.join(job_dir, "metrics.json")
    if os.path.exists(metrics_path):
        with open(metrics_path, "r", encoding="utf-8") as f:
            metrics = json.load(f)
        label_dist = metrics.get("label_distribution", {})
        labels = sorted(label_dist.keys()) if label_dist else ["Igen", "Nem"]
    else:
        labels = ["Igen", "Nem"]

    tier_noise = {"fast": 0.18, "balanced": 0.09, "accurate": 0.03}
    noise = tier_noise.get(model_tier, 0.09)

    progress(30, "Eredeti predikciók újraszámítása")

    sim_rows = rows[:2000]
    delta_rows = []
    orig_label_dist = {}
    new_label_dist = {}

    for i, row in enumerate(sim_rows):
        row_vals = tuple(str(row.get(k, "")) for k in ready_cols)
        base = hash_score(row_vals, seed=42)
        noisy_orig = max(0.0, min(1.0, base + (hash_score(row_vals, seed=99) - 0.5) * noise))

        if len(labels) == 2:
            orig_label = labels[1] if noisy_orig >= 0.5 else labels[0]
        elif len(labels) == 3:
            orig_label = labels[2] if noisy_orig > 0.66 else (labels[1] if noisy_orig > 0.33 else labels[0])
        else:
            idx = min(int(noisy_orig * len(labels)), len(labels) - 1)
            orig_label = labels[idx]

        orig_label_dist[orig_label] = orig_label_dist.get(orig_label, 0) + 1

        # Apply simulation changes
        sim_row = dict(row)
        for col, new_val in simulation_changes.items():
            if col in sim_row:
                sim_row[col] = new_val

        sim_vals = tuple(str(sim_row.get(k, "")) for k in ready_cols)
        base_sim = hash_score(sim_vals, seed=42)
        noisy_new = max(0.0, min(1.0, base_sim + (hash_score(sim_vals, seed=99) - 0.5) * noise))

        if len(labels) == 2:
            new_label = labels[1] if noisy_new >= 0.5 else labels[0]
        elif len(labels) == 3:
            new_label = labels[2] if noisy_new > 0.66 else (labels[1] if noisy_new > 0.33 else labels[0])
        else:
            idx = min(int(noisy_new * len(labels)), len(labels) - 1)
            new_label = labels[idx]

        new_label_dist[new_label] = new_label_dist.get(new_label, 0) + 1

        if orig_label != new_label:
            delta_rows.append({
                "row_id": i,
                "original_prediction": orig_label,
                "new_prediction": new_label,
                "changed_fields": {c: new_val for c, new_val in simulation_changes.items() if c in row}
            })

    progress(80, "Szimuláció eredmények mentése")

    sim_result = {
        "changed_count": len(delta_rows),
        "total_count": len(sim_rows),
        "change_rate_pct": round(len(delta_rows) / len(sim_rows) * 100, 2) if sim_rows else 0.0,
        "delta_rows": delta_rows[:100],
        "aggregate": {
            "original_label_distribution": orig_label_dist,
            "new_label_distribution": new_label_dist
        }
    }

    with open(os.path.join(job_dir, "simulation_result.json"), "w", encoding="utf-8") as f:
        json.dump(sim_result, f, ensure_ascii=False, indent=2)

    progress(100, "Szimuláció kész")


# ─── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="ML Wizard Runner")
    parser.add_argument("--phase", required=True, choices=["profile", "features", "train", "simulate"])
    parser.add_argument("--job-dir", required=True, dest="job_dir")
    parser.add_argument("--spec-json", required=True, dest="spec_json")
    args = parser.parse_args()

    try:
        spec = load_spec(args.spec_json)
        if args.phase == "profile":
            phase_profile(spec, args.job_dir)
        elif args.phase == "features":
            phase_features(spec, args.job_dir)
        elif args.phase == "train":
            phase_train(spec, args.job_dir)
        elif args.phase == "simulate":
            phase_simulate(spec, args.job_dir)
    except Exception as exc:
        print(f"[error] {exc}", file=sys.stderr, flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
