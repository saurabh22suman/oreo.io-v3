import os
import shutil
import tempfile
import pytest

try:
    from delta_adapter import DeltaStorageAdapter, DeltaConfig
    from deltalake import DeltaTable
    import duckdb  # noqa: F401
    import pyarrow as pa  # noqa: F401
except Exception:
    DeltaStorageAdapter = None  # type: ignore


pytestmark = pytest.mark.skipif(DeltaStorageAdapter is None, reason="delta dependencies not available")


def test_append_and_query_roundtrip():
    tmp = tempfile.mkdtemp()
    try:
        os.environ["DELTA_DATA_ROOT"] = tmp
        adapter = DeltaStorageAdapter(DeltaConfig.from_env())
        append_resp = adapter.append_rows("unit_people", [
            {"id": 1, "name": "alice"},
            {"id": 2, "name": "bob"},
            {"id": 3, "name": "carol"},
        ])
        assert append_resp["ok"] and append_resp["inserted"] == 3
        res = adapter.query("unit_people", sql_where="id >= 2", limit=10, offset=0)
        assert res["count"] == 2
        names = {r["name"] for r in res["rows"]}
        assert names == {"bob", "carol"}

        # Test merge fallback/native logic by upserting a changed row
        merge_resp = adapter.merge("unit_people", rows=[{"id": 2, "name": "bob2"}], keys=["id"])
        assert merge_resp["ok"]
        res2 = adapter.query("unit_people", sql_where="id = 2", limit=10, offset=0)
        assert res2["count"] == 1 and res2["rows"][0]["name"] == "bob2"

        hist = adapter.history("unit_people")
        assert isinstance(hist, list) and len(hist) >= 1
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
