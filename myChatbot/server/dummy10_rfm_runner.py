#!/usr/bin/env python3
import argparse
import json
import math
import random
import sqlite3
from datetime import datetime


def parse_date(value):
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return datetime.strptime(text[:10], "%Y-%m-%d")
    except Exception:
        return None


def mean(values):
    vals = [float(v) for v in values]
    return sum(vals) / len(vals) if vals else 0.0


def std(values, m):
    vals = [float(v) for v in values]
    if not vals:
        return 1.0
    variance = sum((v - m) ** 2 for v in vals) / len(vals)
    return math.sqrt(variance) if variance > 1e-9 else 1.0


def normalize_features(rows):
    recency = [float(r["RecencyDays"]) for r in rows]
    frequency = [float(r["Frequency"]) for r in rows]
    monetary = [float(r["Monetary"]) for r in rows]

    m_r, m_f, m_m = mean(recency), mean(frequency), mean(monetary)
    s_r, s_f, s_m = std(recency, m_r), std(frequency, m_f), std(monetary, m_m)

    for r in rows:
        r["f_recency"] = (float(r["RecencyDays"]) - m_r) / s_r
        r["f_frequency"] = (float(r["Frequency"]) - m_f) / s_f
        r["f_monetary"] = (float(r["Monetary"]) - m_m) / s_m


def euclidean2(a, b):
    return (
        (a[0] - b[0]) ** 2 +
        (a[1] - b[1]) ** 2 +
        (a[2] - b[2]) ** 2
    )


def kmeans(rows, k=4, iterations=30):
    points = [(r["f_recency"], r["f_frequency"], r["f_monetary"]) for r in rows]
    if not points:
        return [], []

    k = min(k, len(points))
    random.seed(42)
    centroids = [points[i] for i in random.sample(range(len(points)), k)]

    assignments = [0] * len(points)
    for _ in range(iterations):
        changed = False
        for i, point in enumerate(points):
            best_idx = 0
            best_dist = euclidean2(point, centroids[0])
            for cidx in range(1, len(centroids)):
                dist = euclidean2(point, centroids[cidx])
                if dist < best_dist:
                    best_dist = dist
                    best_idx = cidx
            if assignments[i] != best_idx:
                assignments[i] = best_idx
                changed = True

        groups = [[] for _ in range(len(centroids))]
        for idx, point in enumerate(points):
            groups[assignments[idx]].append(point)

        new_centroids = []
        for cidx, group in enumerate(groups):
            if not group:
                new_centroids.append(centroids[cidx])
                continue
            x = sum(p[0] for p in group) / len(group)
            y = sum(p[1] for p in group) / len(group)
            z = sum(p[2] for p in group) / len(group)
            new_centroids.append((x, y, z))
        centroids = new_centroids
        if not changed:
            break

    return assignments, centroids


def map_cluster_labels(centroids):
    cluster_scores = []
    for idx, c in enumerate(centroids):
        score = (-1.2 * c[0]) + (0.9 * c[1]) + (1.0 * c[2])
        cluster_scores.append((idx, score))
    cluster_scores.sort(key=lambda item: item[1])

    labels = ["Lost", "At Risk", "Loyal", "Champions"]
    selected = labels[-len(cluster_scores):]
    mapping = {}
    for rank, (idx, _score) in enumerate(cluster_scores):
        mapping[idx] = selected[rank]
    return mapping


def load_rfm_rows(db_path):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute(
        """
        SELECT
          c.CustomerId,
          c.CustomerName,
          c.Country,
          c.Segment AS OriginalSegment,
          COUNT(so.SalesOrderId) AS Frequency,
          ROUND(COALESCE(SUM(so.NetAmount), 0), 2) AS Monetary,
          MAX(so.OrderDate) AS LastOrderDate
        FROM Customer c
        LEFT JOIN SalesOrder so ON so.CustomerId = c.CustomerId
        GROUP BY c.CustomerId, c.CustomerName, c.Country, c.Segment
        ORDER BY c.CustomerId ASC
        """
    )
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()

    today = datetime.utcnow()
    for row in rows:
        dt = parse_date(row.get("LastOrderDate"))
        recency_days = (today - dt).days if dt else 999
        row["RecencyDays"] = int(max(0, recency_days))
        row["Frequency"] = int(row.get("Frequency") or 0)
        row["Monetary"] = float(row.get("Monetary") or 0.0)
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-path", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    rows = load_rfm_rows(args.db_path)
    if not rows:
        result = {
            "rows": [],
            "segment_counts": {}
        }
        with open(args.output, "w", encoding="utf-8") as fh:
            json.dump(result, fh, ensure_ascii=False, indent=2)
        return

    normalize_features(rows)
    assignments, centroids = kmeans(rows, k=4, iterations=40)
    label_map = map_cluster_labels(centroids)

    segment_counts = {}
    out_rows = []
    for idx, row in enumerate(rows):
        cluster_idx = assignments[idx] if idx < len(assignments) else 0
        segment = label_map.get(cluster_idx, "At Risk")
        segment_counts[segment] = int(segment_counts.get(segment, 0)) + 1
        out_rows.append({
            "CustomerId": int(row["CustomerId"]),
            "CustomerName": row.get("CustomerName") or "",
            "Country": row.get("Country") or "",
            "RecencyDays": int(row.get("RecencyDays") or 0),
            "Frequency": int(row.get("Frequency") or 0),
            "Monetary": round(float(row.get("Monetary") or 0.0), 2),
            "Segment": segment
        })

    result = {
      "rows": out_rows,
      "segment_counts": segment_counts
    }
    with open(args.output, "w", encoding="utf-8") as fh:
        json.dump(result, fh, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
