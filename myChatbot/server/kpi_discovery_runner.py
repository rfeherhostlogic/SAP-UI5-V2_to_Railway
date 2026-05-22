#!/usr/bin/env python3
import argparse
import json
import sqlite3
from datetime import datetime
from statistics import median


def quote_ident(name):
    return '"' + str(name).replace('"', '""') + '"'


def load_schema(conn):
    cur = conn.cursor()
    cur.execute(
        """
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
        ORDER BY name
        """
    )
    tables = []
    for item in cur.fetchall():
        table_name = item[0]
        cur.execute("PRAGMA table_info(" + quote_ident(table_name) + ")")
        columns = []
        for col in cur.fetchall():
            columns.append({
                "name": col[1],
                "type": str(col[2] or "").upper(),
                "notnull": bool(col[3]),
                "pk": bool(col[5])
            })
        cur.execute("SELECT COUNT(*) FROM " + quote_ident(table_name))
        tables.append({
            "name": table_name,
            "row_count": int(cur.fetchone()[0] or 0),
            "columns": columns
        })
    return tables


def is_numeric(col):
    col_type = str(col.get("type") or "").upper()
    name = str(col.get("name") or "").lower()
    if "INT" in col_type or "REAL" in col_type or "NUM" in col_type or "DEC" in col_type or "DOUBLE" in col_type or "FLOAT" in col_type:
        return True
    return any(token in name for token in ["amount", "price", "revenue", "qty", "quantity", "total", "value", "margin"])


def is_business_measure(col):
    name = str(col.get("name") or "").lower()
    if col.get("pk") or name == "id" or name.endswith("id") or name.endswith("_id"):
        return False
    if name in ["year", "fiscalyear", "period", "periodstart", "costelement"]:
        return False
    return is_numeric(col)


def is_date(col):
    col_type = str(col.get("type") or "").upper()
    name = str(col.get("name") or "").lower()
    return "DATE" in col_type or "TIME" in col_type or any(token in name for token in ["date", "time", "created", "posted"])


def build_schema_summary(tables):
    lines = []
    for table in tables:
        cols = ", ".join([c["name"] + (":" + c["type"] if c.get("type") else "") for c in table["columns"]])
        lines.append(f"{table['name']} ({table['row_count']} sor): {cols}")
    return "\n".join(lines)


def find_table(tables, expected):
    expected_lower = expected.lower()
    for table in tables:
        if table["name"].lower() == expected_lower:
            return table
    return None


def has_columns(table, names):
    available = {c["name"].lower(): c["name"] for c in table.get("columns", [])}
    result = []
    for name in names:
        if name.lower() not in available:
            return None
        result.append(available[name.lower()])
    return result


def add_suggestion(items, item):
    seen = {existing["id"] for existing in items}
    if item["id"] not in seen:
        items.append(item)


def make_suggestion(kpi_id, title, description, why, comparison, chart_type="bar"):
    return {
        "id": kpi_id,
        "title": title,
        "description": description,
        "why": why,
        "comparison": comparison,
        "chartType": chart_type
    }


def discover_kpis(tables):
    suggestions = []
    sales = find_table(tables, "SalesOrder")
    customer = find_table(tables, "Customer")

    if sales:
        cols = has_columns(sales, ["SalesOrderId", "NetAmount"])
        if cols:
            add_suggestion(suggestions, make_suggestion(
                "sales_revenue_vs_best_month",
                "Arbevetel a legjobb honaphoz kepest",
                "Aktualis havi NetAmount osszeg osszevetese a historikus legjobb honappal.",
                "Nem csak az osszforgalmat mutatja, hanem azt is, mennyire kozelitjuk a sajat maximumot.",
                "Legjobb korabbi havi ertek",
                "bar"
            ))

        cols = has_columns(sales, ["OrderDate", "NetAmount"])
        if cols:
            add_suggestion(suggestions, make_suggestion(
                "sales_revenue_vs_previous_month",
                "Arbevetel elozo honaphoz kepest",
                "Legutolso lezart/adott honap arbevetele az elozo honappal osszevetve.",
                "KPI-kent a trendirany a lenyeg: javult vagy romlott az elozo idoszakhoz kepest.",
                "Elozo honap",
                "line"
            ))

        cols = has_columns(sales, ["CustomerId", "NetAmount"])
        if cols:
            add_suggestion(suggestions, make_suggestion(
                "sales_top_customer_vs_median",
                "Top ugyfel a median ugyfelhez kepest",
                "A legnagyobb ugyfel forgalma osszevetve a median ugyfelforgalommal.",
                "Megmutatja a koncentracios kockazatot: mennyire huzza egy ugyfel a teljesitmenyt.",
                "Median ugyfelforgalom",
                "bar"
            ))

            add_suggestion(suggestions, make_suggestion(
                "sales_avg_order_vs_median_order",
                "Atlagos rendeles a medianhoz kepest",
                "Atlagos NetAmount osszevetese a rendelesek median ertekevel.",
                "A kulonbseg jelzi, hogy nehany nagy rendeles torzitja-e az atlagot.",
                "Median rendelesertek",
                "bar"
            ))

    if customer:
        segment_cols = has_columns(customer, ["Segment", "CustomerId"])
        if segment_cols:
            add_suggestion(suggestions, make_suggestion(
                "customer_largest_segment_vs_median",
                "Legnagyobb szegmens a medianhoz kepest",
                "A legnagyobb ugyfelszegmens merete osszevetve a szegmensek median meretevel.",
                "Segit latni, hogy kiegyensulyozott vagy egyetlen szegmensre nehezedik az ugyfelbazis.",
                "Median szegmensmeret",
                "bar"
            ))

    for table in tables:
        numeric_cols = [c for c in table["columns"] if is_business_measure(c)]
        date_cols = [c for c in table["columns"] if is_date(c)]
        if numeric_cols:
            col = numeric_cols[0]["name"]
            add_suggestion(suggestions, make_suggestion(
                "generic_sum_vs_average_row__" + table["name"] + "__" + col,
                table["name"] + " - " + col + " osszeg vs atlagos sor",
                table["name"] + "." + col + " osszesitett erteke az atlagos sorszintu ertekhez viszonyitva.",
                "Altalanos KPI, ami megmutatja az aggregalt nagysagrendet es a tipikus rekord erteket.",
                "Atlagos rekord ertek",
                "bar"
            ))
        if numeric_cols and date_cols:
            add_suggestion(suggestions, make_suggestion(
                "generic_monthly_sum_vs_previous__" + table["name"] + "__" + numeric_cols[0]["name"] + "__" + date_cols[0]["name"],
                table["name"] + " - havi " + numeric_cols[0]["name"] + " vs elozo idoszak",
                numeric_cols[0]["name"] + " legutolso havi osszege az elozo idoszakhoz viszonyitva.",
                "Idosoros KPI, ahol a valtozas iranya es merteke fontosabb, mint a puszta ertek.",
                "Elozo idoszak",
                "line"
            ))

    return suggestions[:12]


def execute_sql(conn, sql, params=None):
    cur = conn.cursor()
    cur.execute(sql, params or [])
    columns = [d[0] for d in cur.description] if cur.description else []
    rows = [dict(zip(columns, row)) for row in cur.fetchall()]
    return rows


def metric(label, value, unit=""):
    return {"label": label, "value": value, "unit": unit}


def numeric_sql_expr(col):
    return "CAST(REPLACE(" + quote_ident(col) + ", ',', '.') AS REAL)"


def pct_delta(current, reference):
    ref = float(reference or 0)
    if abs(ref) < 1e-9:
        return None
    return round(((float(current or 0) - ref) / abs(ref)) * 100, 2)


def build_comparison(label, current, reference, reference_label, unit="", higher_is_better=True):
    current = round(float(current or 0), 2)
    reference = round(float(reference or 0), 2)
    delta = round(current - reference, 2)
    delta_pct = pct_delta(current, reference)
    status = "Neutral"
    if abs(delta) > 1e-9:
        is_good = delta > 0 if higher_is_better else delta < 0
        status = "Good" if is_good else "Warning"
    return {
        "label": label,
        "current": current,
        "reference": reference,
        "referenceLabel": reference_label,
        "delta": delta,
        "deltaPct": delta_pct,
        "unit": unit,
        "status": status
    }


def comparison_summary(cmp):
    pct = "n/a" if cmp.get("deltaPct") is None else f"{cmp['deltaPct']}%"
    unit = (" " + cmp.get("unit", "")) if cmp.get("unit") else ""
    return (
        f"{cmp['label']}: aktualis {cmp['current']:,.2f}{unit}, "
        f"viszonyitasi alap ({cmp['referenceLabel']}) {cmp['reference']:,.2f}{unit}, "
        f"elteres {cmp['delta']:,.2f}{unit} ({pct})."
    )


def comparison_chart(cmp):
    return [
        {"label": "Aktualis", "value": cmp["current"]},
        {"label": cmp["referenceLabel"], "value": cmp["reference"]}
    ]


def run_kpi(conn, tables, kpi_id):
    customer = find_table(tables, "Customer")
    has_customer = customer and has_columns(customer, ["CustomerId", "CustomerName"])

    if kpi_id == "sales_revenue_vs_best_month":
        rows = execute_sql(conn, """
            SELECT substr(OrderDate, 1, 7) AS label,
                   ROUND(SUM(NetAmount), 2) AS value,
                   COUNT(*) AS order_count
            FROM SalesOrder
            WHERE OrderDate IS NOT NULL
            GROUP BY substr(OrderDate, 1, 7)
            ORDER BY label
        """)
        current = float(rows[-1]["value"] or 0) if rows else 0.0
        best = max([float(r["value"] or 0) for r in rows], default=0.0)
        cmp = build_comparison("Havi arbevetel", current, best, "Legjobb honap", "EUR")
        return {
            "summary": comparison_summary(cmp),
            "comparison": cmp,
            "metrics": [metric("Aktualis", cmp["current"], "EUR"), metric("Legjobb honap", cmp["reference"], "EUR")],
            "chart": comparison_chart(cmp),
            "rows": rows
        }

    if kpi_id == "sales_revenue_vs_previous_month":
        rows = execute_sql(conn, """
            SELECT substr(OrderDate, 1, 7) AS label,
                   ROUND(SUM(NetAmount), 2) AS value,
                   COUNT(*) AS order_count
            FROM SalesOrder
            WHERE OrderDate IS NOT NULL
            GROUP BY substr(OrderDate, 1, 7)
            ORDER BY label
        """)
        current = float(rows[-1]["value"] or 0) if rows else 0.0
        previous = float(rows[-2]["value"] or 0) if len(rows) > 1 else 0.0
        cmp = build_comparison("Havi arbevetel", current, previous, "Elozo honap", "EUR")
        return {
            "summary": comparison_summary(cmp),
            "comparison": cmp,
            "metrics": [metric("Aktualis", cmp["current"], "EUR"), metric("Elozo honap", cmp["reference"], "EUR")],
            "chart": [{"label": r["label"], "value": float(r["value"] or 0)} for r in rows],
            "rows": rows
        }

    if kpi_id == "sales_top_customer_vs_median":
        if has_customer:
            rows = execute_sql(conn, """
                SELECT c.CustomerName AS label,
                       ROUND(SUM(so.NetAmount), 2) AS value,
                       COUNT(so.SalesOrderId) AS order_count
                FROM SalesOrder so
                JOIN Customer c ON c.CustomerId = so.CustomerId
                GROUP BY c.CustomerId, c.CustomerName
                ORDER BY value DESC
                LIMIT 10
            """)
        else:
            rows = execute_sql(conn, """
                SELECT CAST(CustomerId AS TEXT) AS label,
                       ROUND(SUM(NetAmount), 2) AS value,
                       COUNT(*) AS order_count
                FROM SalesOrder
                GROUP BY CustomerId
                ORDER BY value DESC
                LIMIT 10
            """)
        values = [float(r["value"] or 0) for r in rows]
        current = values[0] if values else 0.0
        ref = median(values) if values else 0.0
        cmp = build_comparison("Top ugyfel forgalma", current, ref, "Median ugyfel", "EUR")
        return {
            "summary": comparison_summary(cmp),
            "comparison": cmp,
            "metrics": [metric("Top ugyfel", cmp["current"], "EUR"), metric("Median ugyfel", cmp["reference"], "EUR")],
            "chart": comparison_chart(cmp),
            "rows": rows
        }

    if kpi_id == "sales_avg_order_vs_median_order":
        detail_rows = execute_sql(conn, "SELECT ROUND(NetAmount, 2) AS value FROM SalesOrder ORDER BY value")
        values = [float(r["value"] or 0) for r in detail_rows]
        avg_value = sum(values) / len(values) if values else 0.0
        median_value = median(values) if values else 0.0
        cmp = build_comparison("Atlagos rendelesertek", avg_value, median_value, "Median rendeles", "EUR")
        return {
            "summary": comparison_summary(cmp),
            "comparison": cmp,
            "metrics": [metric("Atlag", cmp["current"], "EUR"), metric("Median", cmp["reference"], "EUR")],
            "chart": comparison_chart(cmp),
            "rows": detail_rows
        }

    if kpi_id == "customer_largest_segment_vs_median":
        rows = execute_sql(conn, """
            SELECT COALESCE(Segment, 'Nincs szegmens') AS label,
                   COUNT(CustomerId) AS value
            FROM Customer
            GROUP BY COALESCE(Segment, 'Nincs szegmens')
            ORDER BY value DESC
        """)
        values = [float(r["value"] or 0) for r in rows]
        cmp = build_comparison("Legnagyobb szegmens merete", values[0] if values else 0, median(values) if values else 0, "Median szegmens")
        return {
            "summary": comparison_summary(cmp),
            "comparison": cmp,
            "metrics": [metric("Legnagyobb", cmp["current"]), metric("Median", cmp["reference"])],
            "chart": comparison_chart(cmp),
            "rows": rows
        }

    if kpi_id.startswith("generic_sum_vs_average_row__"):
        _prefix, table, col = kpi_id.split("__", 2)
        expr = numeric_sql_expr(col)
        sql = "SELECT ROUND(SUM(" + expr + "), 2) AS value, ROUND(AVG(" + expr + "), 2) AS reference, COUNT(*) AS row_count FROM " + quote_ident(table)
        rows = execute_sql(conn, sql)
        value = float(rows[0]["value"] or 0) if rows else 0.0
        reference = float(rows[0]["reference"] or 0) if rows else 0.0
        cmp = build_comparison(table + "." + col + " osszeg", value, reference, "Atlagos rekord")
        return {
            "summary": comparison_summary(cmp),
            "comparison": cmp,
            "metrics": [metric("Osszeg", cmp["current"]), metric("Atlagos rekord", cmp["reference"])],
            "chart": comparison_chart(cmp),
            "rows": rows
        }

    if kpi_id.startswith("generic_monthly_sum_vs_previous__"):
        _prefix, table, rest = kpi_id.split("__", 2)
        col, date_col = rest.split("__", 1)
        expr = numeric_sql_expr(col)
        sql = (
            "SELECT substr(" + quote_ident(date_col) + ", 1, 7) AS label, "
            "ROUND(SUM(" + expr + "), 2) AS value, COUNT(*) AS row_count "
            "FROM " + quote_ident(table) + " "
            "WHERE " + quote_ident(date_col) + " IS NOT NULL "
            "GROUP BY substr(" + quote_ident(date_col) + ", 1, 7) "
            "ORDER BY label"
        )
        rows = execute_sql(conn, sql)
        current = float(rows[-1]["value"] or 0) if rows else 0.0
        previous = float(rows[-2]["value"] or 0) if len(rows) > 1 else 0.0
        cmp = build_comparison(table + "." + col, current, previous, "Elozo idoszak")
        return {
            "summary": comparison_summary(cmp),
            "comparison": cmp,
            "metrics": [metric("Aktualis", cmp["current"]), metric("Elozo idoszak", cmp["reference"])],
            "chart": [{"label": r["label"], "value": float(r["value"] or 0)} for r in rows],
            "rows": rows
        }

    raise ValueError("Ismeretlen KPI azonosito: " + str(kpi_id))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-path", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--mode", choices=["discover", "run"], default="discover")
    parser.add_argument("--kpi-id", default="")
    args = parser.parse_args()

    conn = sqlite3.connect(args.db_path)
    try:
        tables = load_schema(conn)
        suggestions = discover_kpis(tables)
        result = {
            "generatedAt": datetime.utcnow().isoformat(timespec="seconds") + "Z",
            "schemaSummary": build_schema_summary(tables),
            "tables": tables,
            "suggestions": suggestions
        }
        if args.mode == "run":
            result["run"] = run_kpi(conn, tables, args.kpi_id)
            result["selectedKpiId"] = args.kpi_id
        with open(args.output, "w", encoding="utf-8") as fh:
            json.dump(result, fh, ensure_ascii=False, indent=2)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
