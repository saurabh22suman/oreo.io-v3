"""
Export selected Postgres tables to Delta Lake.

Usage:
  python scripts/export_postgres_to_delta.py \
    --dsn postgresql://user:pass@host:5432/dbname \
    --tables users,projects,datasets \
    --delta-root ./delta-data

Notes:
- This script is intentionally standalone and uses psycopg2 to avoid adding PG deps
  to runtime services. Install extras with: pip install -r scripts/requirements-migrate.txt
- Requires pyarrow and deltalake.
"""
from __future__ import annotations
import argparse
import os
from typing import List

import psycopg2
import pandas as pd
from deltalake import write_deltalake
import pyarrow as pa


def export_table(conn, table: str, delta_root: str):
    print(f"Exporting {table} -> Delta...")
    df = pd.read_sql_query(f"SELECT * FROM {table}", conn)
    at = pa.Table.from_pandas(df, preserve_index=False)
    path = os.path.join(delta_root, table)
    os.makedirs(path, exist_ok=True)
    write_deltalake(path, at, mode="overwrite")
    print(f"  rows={len(df)} path={path}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dsn", required=True, help="Postgres DSN")
    ap.add_argument("--tables", required=True, help="Comma separated list of tables")
    ap.add_argument("--delta-root", default="./delta-data", help="Delta root directory")
    args = ap.parse_args()

    tables: List[str] = [t.strip() for t in args.tables.split(",") if t.strip()]
    os.makedirs(args.delta_root, exist_ok=True)

    with psycopg2.connect(args.dsn) as conn:
        for t in tables:
            export_table(conn, t, args.delta_root)

    print("Export completed.")


if __name__ == "__main__":
    main()
