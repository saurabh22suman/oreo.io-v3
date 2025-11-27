"""
Enhanced export: Dump Postgres tables to Parquet then write Delta; produce summary JSON.

Usage:
  python -m scripts.export_postgres_to_delta --dsn postgresql://user:pass@host:5432/db --tables users,projects --delta-root ./delta-data --out export_summary.json

Requires: psycopg2-binary, pandas, pyarrow, deltalake
"""
from __future__ import annotations
import argparse
import json
import os
from typing import List, Dict, Any

import psycopg2
import pandas as pd
import pyarrow as pa
from deltalake import write_deltalake


def export_table(conn, table: str, delta_root: str) -> Dict[str, Any]:
    df = pd.read_sql_query(f"SELECT * FROM {table}", conn)
    at = pa.Table.from_pandas(df, preserve_index=False)
    path = os.path.join(delta_root, table)
    os.makedirs(path, exist_ok=True)
    write_deltalake(path, at, mode="overwrite")
    return {"table": table, "rows": int(len(df)), "path": path}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dsn", required=True)
    ap.add_argument("--tables", required=True)
    ap.add_argument("--delta-root", default="./delta-data")
    ap.add_argument("--out", default="export_summary.json")
    args = ap.parse_args()

    tables: List[str] = [t.strip() for t in args.tables.split(",") if t.strip()]
    os.makedirs(args.delta_root, exist_ok=True)

    summary: Dict[str, Any] = {"tables": [], "total_rows": 0}
    with psycopg2.connect(args.dsn) as conn:
        for t in tables:
            info = export_table(conn, t, args.delta_root)
            summary["tables"].append(info)
            summary["total_rows"] += info["rows"]

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    print(json.dumps(summary))


if __name__ == "__main__":
    main()
