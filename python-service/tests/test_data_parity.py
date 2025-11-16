import os
import json
import tempfile
import shutil
import pytest

try:
    import pandas as pd
    import pyarrow as pa
    from deltalake import DeltaTable, write_deltalake
    from great_expectations.dataset import PandasDataset
except Exception:
    pd = None

pytestmark = pytest.mark.skipif(pd is None, reason="delta/ge deps not available")


def run_parity_check(df: 'pd.DataFrame', delta_path: str) -> dict:
    at = pa.Table.from_pandas(df, preserve_index=False)
    write_deltalake(delta_path, at, mode="overwrite")
    # load back
    dt = DeltaTable(delta_path)
    at2 = dt.to_pyarrow_table()
    df2 = at2.to_pandas()

    # Great Expectations checks
    ge1 = PandasDataset(df)
    ge2 = PandasDataset(df2)

    results = {
        "row_count_match": len(df) == len(df2),
        "nulls_match": True,
        "dtypes_match": True,
        "mismatches": {}
    }

    # simple type check on columns present in both
    common_cols = set(df.columns) & set(df2.columns)
    for c in common_cols:
        if str(df[c].dtype) != str(df2[c].dtype):
            results["dtypes_match"] = False
            results["mismatches"].setdefault("dtypes", []).append(c)
        # null parity
        null1 = df[c].isna().sum()
        null2 = df2[c].isna().sum()
        if int(null1) != int(null2):
            results["nulls_match"] = False
            results["mismatches"].setdefault("nulls", []).append(c)

    return results


def test_data_parity_basic():
    tmp = tempfile.mkdtemp()
    try:
        delta_path = os.path.join(tmp, "people")
        df = pd.DataFrame([
            {"id": 1, "name": "alice", "age": 30},
            {"id": 2, "name": "bob", "age": 40},
            {"id": 3, "name": None, "age": None},
        ])
        res = run_parity_check(df, delta_path)
        assert res["row_count_match"], json.dumps(res)
        assert res["nulls_match"], json.dumps(res)
        assert res["dtypes_match"], json.dumps(res)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
