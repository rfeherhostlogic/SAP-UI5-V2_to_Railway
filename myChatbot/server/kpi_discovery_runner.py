#!/usr/bin/env python3
import argparse
import json
import sqlite3
from datetime import datetime


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
    return any(token in name for token in ["amount", "price", "revenue", "qty", "quantity", "total", "value", "cost", "margin"])


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


def discover_kpis(tables):
    suggestions = []
    sales = find_table(tables, "SalesOrder")
    customer = find_table(tables, "Customer")

    if sales:
        cols = has_columns(sales, ["SalesOrderId", "NetAmount"])
        if cols:
            add_suggestion(suggestions, {
                "id": "sales_total_revenue",
                "title": "Teljes arbevetel",
                "description": "A SalesOrder tabla NetAmount osszege, teljes rendelesei volumennel.",
                "why": "Alap penzugyi teljesitmeny KPI, azonnal mutatja a teljes forgalmat.",
                "chartType": "bar"
            })

        cols = has_columns(sales, ["OrderDate", "NetAmount"])
        if cols:
            add_suggestion(suggestions, {
                "id": "sales_monthly_revenue",
                "title": "Havi arbevetel trend",
                "description": "NetAmount havi bontasban, rendeles darabszammal.",
                "why": "Segit latni a szezonalitast, visszaesest vagy novekedest.",
                "chartType": "line"
            })

        cols = has_columns(sales, ["CustomerId", "NetAmount"])
        if cols:
            add_suggestion(suggestions, {
                "id": "sales_top_customers",
                "title": "Top ugyfelek arbevetel szerint",
                "description": "Legnagyobb forgalmu ugyfelek, Customer tablaval osszekotve ha elerheto.",
                "why": "Megmutatja a koncentracios kockazatot es a legfontosabb ugyfeleket.",
                "chartType": "bar"
            })

            add_suggestion(suggestions, {
                "id": "sales_avg_order_value",
                "title": "Atlagos rendeleseertek",
                "description": "NetAmount atlag es rendelesei darabszam.",
                "why": "Gyors kepet ad a kosarertekrol es pricing hatasokrol.",
                "chartType": "bar"
            })

    if customer:
        segment_cols = has_columns(customer, ["Segment", "CustomerId"])
        if segment_cols:
            add_suggestion(suggestions, {
                "id": "customer_segment_count",
                "title": "Ugyfelek szegmens szerint",
                "description": "Customer rekordok megoszlasa Segment szerint.",
                "why": "Lathatova teszi az ugyfelbazis szerkezetet.",
                "chartType": "bar"
            })

    for table in tables:
        numeric_cols = [c for c in table["columns"] if is_numeric(c) and not c.get("pk")]
        date_cols = [c for c in table["columns"] if is_date(c)]
        if numeric_cols:
            col = numeric_cols[0]["name"]
            add_suggestion(suggestions, {
                "id": "generic_sum__" + table["name"] + "__" + col,
                "title": table["name"] + " - " + col + " osszeg",
                "description": table["name"] + "." + col + " osszesitett erteke.",
                "why": "Numerikus uzleti mezo, erdemes aggregaltan kovetni.",
                "chartType": "bar"
            })
        if numeric_cols and date_cols:
            add_suggestion(suggestions, {
                "id": "generic_monthly_sum__" + table["name"] + "__" + numeric_cols[0]["name"] + "__" + date_cols[0]["name"],
                "title": table["name"] + " - havi " + numeric_cols[0]["name"],
                "description": numeric_cols[0]["name"] + " havi trend " + date_cols[0]["name"] + " alapjan.",
                "why": "Idosoros KPI, ami trendet es torpontokat mutat.",
                "chartType": "line"
            })

    return suggestions[:12]


def execute_sql(conn, sql, params=None):
    cur = conn.cursor()
    cur.execute(sql, params or [])
    columns = [d[0] for d in cur.description] if cur.description else []
    rows = [dict(zip(columns, row)) for row in cur.fetchall()]
    return rows


def metric(label, value, unit=""):
    return {"label": label, "value": value, "unit": unit}


def run_kpi(conn, tables, kpi_id):
    customer = find_table(tables, "Customer")
    has_customer = customer and has_columns(customer, ["CustomerId", "CustomerName"])

    if kpi_id == "sales_total_revenue":
        rows = execute_sql(conn, "SELECT ROUND(SUM(NetAmount), 2) AS value, COUNT(*) AS order_count FROM SalesOrder")
        value = float(rows[0]["value"] or 0) if rows else 0.0
        count = int(rows[0]["order_count"] or 0) if rows else 0
        return {
            "summary": f"Teljes arbevetel: {value:,.2f} EUR, {count} rendeles alapjan.",
            "metrics": [metric("Arbevetel", round(value, 2), "EUR"), metric("Rendelesek", count)],
            "chart": [{"label": "Arbevetel", "value": round(value, 2)}],
            "rows": rows
        }

    if kpi_id == "sales_monthly_revenue":
        rows = execute_sql(conn, """
            SELECT substr(OrderDate, 1, 7) AS label,
                   ROUND(SUM(NetAmount), 2) AS value,
                   COUNT(*) AS order_count
            FROM SalesOrder
            WHERE OrderDate IS NOT NULL
            GROUP BY substr(OrderDate, 1, 7)
            ORDER BY label
        """)
        total = sum(float(r["value"] or 0) for r in rows)
        return {
            "summary": f"Havi arbevetel trend lefutott. Osszesen {total:,.2f} EUR {len(rows)} idoszakban.",
            "metrics": [metric("Osszes arbevetel", round(total, 2), "EUR"), metric("Honapok", len(rows))],
            "chart": [{"label": r["label"], "value": float(r["value"] or 0)} for r in rows],
            "rows": rows
        }

    if kpi_id == "sales_top_customers":
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
        leader = rows[0]["label"] if rows else "nincs adat"
        return {
            "summary": "Top ugyfel arbevetel szerint: " + str(leader) + ".",
            "metrics": [metric("Top lista elemszam", len(rows))],
            "chart": [{"label": r["label"], "value": float(r["value"] or 0)} for r in rows],
            "rows": rows
        }

    if kpi_id == "sales_avg_order_value":
        rows = execute_sql(conn, "SELECT ROUND(AVG(NetAmount), 2) AS value, COUNT(*) AS order_count FROM SalesOrder")
        value = float(rows[0]["value"] or 0) if rows else 0.0
        count = int(rows[0]["order_count"] or 0) if rows else 0
        return {
            "summary": f"Atlagos rendeleseertek: {value:,.2f} EUR.",
            "metrics": [metric("Atlagos rendeles", round(value, 2), "EUR"), metric("Rendelesek", count)],
            "chart": [{"label": "Atlagos rendeles", "value": round(value, 2)}],
            "rows": rows
        }

    if kpi_id == "customer_segment_count":
        rows = execute_sql(conn, """
            SELECT COALESCE(Segment, 'Nincs szegmens') AS label,
                   COUNT(CustomerId) AS value
            FROM Customer
            GROUP BY COALESCE(Segment, 'Nincs szegmens')
            ORDER BY value DESC
        """)
        return {
            "summary": "Ugyfelszegmens megoszlas kiszamolva.",
            "metrics": [metric("Szegmensek", len(rows))],
            "chart": [{"label": r["label"], "value": int(r["value"] or 0)} for r in rows],
            "rows": rows
        }

    if kpi_id.startswith("generic_sum__"):
        _prefix, table, col = kpi_id.split("__", 2)
        sql = "SELECT ROUND(SUM(" + quote_ident(col) + "), 2) AS value, COUNT(*) AS row_count FROM " + quote_ident(table)
        rows = execute_sql(conn, sql)
        value = float(rows[0]["value"] or 0) if rows else 0.0
        return {
            "summary": f"{table}.{col} osszeg: {value:,.2f}.",
            "metrics": [metric("Osszeg", round(value, 2)), metric("Sorok", int(rows[0]["row_count"] or 0) if rows else 0)],
            "chart": [{"label": col, "value": round(value, 2)}],
            "rows": rows
        }

    if kpi_id.startswith("generic_monthly_sum__"):
        _prefix, table, rest = kpi_id.split("__", 2)
        col, date_col = rest.split("__", 1)
        sql = (
            "SELECT substr(" + quote_ident(date_col) + ", 1, 7) AS label, "
            "ROUND(SUM(" + quote_ident(col) + "), 2) AS value, COUNT(*) AS row_count "
            "FROM " + quote_ident(table) + " "
            "WHERE " + quote_ident(date_col) + " IS NOT NULL "
            "GROUP BY substr(" + quote_ident(date_col) + ", 1, 7) "
            "ORDER BY label"
        )
        rows = execute_sql(conn, sql)
        total = sum(float(r["value"] or 0) for r in rows)
        return {
            "summary": f"{table}.{col} havi trend lefutott. Osszesen {total:,.2f}.",
            "metrics": [metric("Osszeg", round(total, 2)), metric("Idoszakok", len(rows))],
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
