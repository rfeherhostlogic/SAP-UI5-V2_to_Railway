#!/usr/bin/env python3
import argparse
import csv
import json
import os
import sys


MAX_SAMPLE_ROWS_PER_FILE = 80
MAX_CELL_LENGTH = 240
SUPPORTED_DELIMITERS = [",", ";", "\t", "|"]


def detect_dialect(file_path):
    with open(file_path, "r", encoding="utf-8-sig", errors="replace", newline="") as fh:
        sample = fh.read(4096)

    if not sample.strip():
        return csv.excel

    try:
        return csv.Sniffer().sniff(sample, delimiters="".join(SUPPORTED_DELIMITERS))
    except Exception:
        return csv.excel


def clean_value(value):
    text = str("" if value is None else value).strip()
    if len(text) > MAX_CELL_LENGTH:
        return text[: MAX_CELL_LENGTH - 3] + "..."
    return text


def read_csv_file(file_path):
    dialect = detect_dialect(file_path)
    file_name = os.path.basename(file_path)

    with open(file_path, "r", encoding="utf-8-sig", errors="replace", newline="") as fh:
        reader = csv.DictReader(fh, dialect=dialect)
        columns = [str(col or "").strip() for col in (reader.fieldnames or []) if str(col or "").strip()]
        sample_rows = []
        row_count = 0

        for raw_row in reader:
            if raw_row is None:
                continue
            row_count += 1
            if len(sample_rows) >= MAX_SAMPLE_ROWS_PER_FILE:
                continue

            out_row = {}
            for key in columns:
                out_row[key] = clean_value(raw_row.get(key, ""))
            sample_rows.append(out_row)

    return {
        "name": file_name,
        "columns": columns,
        "row_count": row_count,
        "sample_rows": sample_rows,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("files", nargs="+")
    args = parser.parse_args()

    files_payload = []
    merged_sample_rows = []

    for file_path in args.files:
        if not os.path.exists(file_path):
            continue
        payload = read_csv_file(file_path)
        files_payload.append(payload)

        for row in payload["sample_rows"]:
            if len(merged_sample_rows) >= 200:
                break
            row_copy = dict(row)
            row_copy["__source_file"] = payload["name"]
            merged_sample_rows.append(row_copy)

    output = {
        "file_count": len(files_payload),
        "files": files_payload,
        "merged_sample_rows": merged_sample_rows,
    }

    with open(args.output, "w", encoding="utf-8") as fh:
        json.dump(output, fh, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr, flush=True)
        sys.exit(1)
