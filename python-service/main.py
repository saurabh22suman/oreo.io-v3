from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, field_validator, ConfigDict
from typing import List, Dict, Any, Optional
from jsonschema import Draft202012Validator, exceptions as js_exceptions
import io
import json
import os
try:
    import pandas as pd
except Exception:  # optional dependency guard
    pd = None

try:
    from delta_adapter import DeltaStorageAdapter
    _delta_adapter = DeltaStorageAdapter()
except Exception:
    _delta_adapter = None

try:
    from merge_executor import get_merge_executor, MergeConflict, MergeValidationError
    _merge_executor = get_merge_executor()
except Exception as e:
    _merge_executor = None
    print(f"Warning: Merge executor not available: {e}")

# Import centralized DuckDB connection pool
try:
    from duckdb_pool import get_connection as get_duckdb_read_connection, health_check as duckdb_health_check
except ImportError:
    # Fallback if duckdb_pool module not available
    _duckdb_read_connection = None
    
    def get_duckdb_read_connection():
        """Fallback: Get or create a global DuckDB connection with Delta extension loaded."""
        global _duckdb_read_connection
        if _duckdb_read_connection is None:
            import duckdb
            print("[DuckDB] Initializing global read connection with Delta extension...")
            _duckdb_read_connection = duckdb.connect()
            _duckdb_read_connection.execute("INSTALL delta;")
            _duckdb_read_connection.execute("LOAD delta;")
            print("[DuckDB] Global read connection ready")
        return _duckdb_read_connection
    
    def duckdb_health_check():
        return {"ok": False, "message": "duckdb_pool module not available"}

app = FastAPI(title="Oreo.io-v2 Python Service")


class ValidateRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    json_schema: Dict[str, Any]
    data: List[Dict[str, Any]]

    @field_validator("json_schema", mode="before")
    @classmethod
    def accept_legacy_schema(cls, v, values):
        # Allow clients to send { "schema": ... } for backwards compatibility
        if v is None and isinstance(values, dict) and "schema" in values:
            return values["schema"]
        return v


@app.on_event("startup")
async def startup_event():
    """Log startup - DuckDB will be lazily initialized on first query."""
    print("[Startup] Python service ready. DuckDB will be initialized on first query.")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/health/duckdb")
def health_duckdb():
    """Health check for DuckDB connection pool."""
    import time
    start = time.time()
    result = duckdb_health_check()
    result["response_time_ms"] = int((time.time() - start) * 1000)
    return result


@app.post("/validate")
def validate(req: ValidateRequest):
    # Compile validator once per request (small overhead, OK for now)
    try:
        validator = Draft202012Validator(req.json_schema)
    except js_exceptions.SchemaError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON Schema: {e.message}")

    if not isinstance(req.data, list):
        raise HTTPException(status_code=400, detail="'data' must be a list")

    errors = []
    for idx, item in enumerate(req.data):
        for err in validator.iter_errors(item):
            path = list(err.path)
            errors.append({
                "row": idx,
                "path": path,
                "message": err.message,
                "keyword": err.validator,
            })

    return {"valid": len(errors) == 0, "errors": errors}


@app.post("/infer-schema")
def infer_schema(file: UploadFile = File(...)):
    if pd is None:
        raise HTTPException(status_code=500, detail="pandas not available for inference")
    content = file.file.read()
    # Try CSV first; could expand to Excel/Parquet later
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception:
        try:
            df = pd.read_excel(io.BytesIO(content))
        except Exception:
            raise HTTPException(status_code=400, detail="Unsupported file format")

    # Build a very simple JSON Schema from dtypes
    type_map = {
        'int64': 'integer',
        'Int64': 'integer',
        'float64': 'number',
        'boolean': 'boolean',
        'bool': 'boolean',
        'datetime64[ns]': 'string',  # could use format: date-time
        'object': 'string',
        'string': 'string',
    }
    properties = {}
    required = []
    for col in df.columns:
        dtype = str(df[col].dtype)
        json_type = type_map.get(dtype, 'string')
        properties[col] = {"type": json_type}
        # If column has no nulls, mark as required
        if not df[col].isna().any():
            required.append(col)

    schema: Dict[str, Any] = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": properties,
    }
    if required:
        schema["required"] = required

    return {"schema": schema, "columns": list(df.columns)}


class SchemaCompareRequest(BaseModel):
    """Request to compare uploaded file schema against expected schema"""
    model_config = ConfigDict(extra="ignore")
    expected_schema: Dict[str, Any]  # JSON Schema with properties


@app.post("/compare-schema")
def compare_schema(
    file: UploadFile = File(...),
    expected_schema: str = Form(...)
):
    """
    Compare the schema of an uploaded file against the expected dataset schema.
    
    Returns detailed information about:
    - Missing columns (in file but expected in schema)
    - Extra columns (in file but not in schema)
    - Type mismatches
    
    This provides user-friendly feedback when appending data.
    """
    if pd is None:
        raise HTTPException(status_code=500, detail="pandas not available for schema comparison")
    
    # Parse expected schema
    try:
        expected = json.loads(expected_schema)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid expected_schema JSON")
    
    # Read uploaded file
    content = file.file.read()
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception:
        try:
            df = pd.read_excel(io.BytesIO(content))
        except Exception:
            raise HTTPException(status_code=400, detail="Unsupported file format")
    
    # Get columns from uploaded file
    file_columns = set(df.columns.tolist())
    
    # Get expected columns from schema
    expected_properties = expected.get("properties", {})
    expected_columns = set(expected_properties.keys())
    
    # Find mismatches
    missing_columns = list(expected_columns - file_columns)  # Expected but not in file
    extra_columns = list(file_columns - expected_columns)    # In file but not expected
    matching_columns = list(file_columns & expected_columns)
    
    # Check type mismatches for matching columns
    type_map = {
        'int64': 'integer',
        'Int64': 'integer',
        'float64': 'number',
        'boolean': 'boolean',
        'bool': 'boolean',
        'datetime64[ns]': 'string',
        'object': 'string',
        'string': 'string',
    }
    
    type_mismatches = []
    for col in matching_columns:
        file_dtype = str(df[col].dtype)
        file_json_type = type_map.get(file_dtype, 'string')
        expected_type = expected_properties.get(col, {}).get("type", "string")
        
        # Allow some flexibility: number can match integer, string matches most things
        compatible = (
            file_json_type == expected_type or
            (file_json_type == "integer" and expected_type == "number") or
            (file_json_type == "number" and expected_type == "integer") or
            (expected_type == "string")  # string accepts anything
        )
        
        if not compatible:
            type_mismatches.append({
                "column": col,
                "expected_type": expected_type,
                "actual_type": file_json_type,
                "message": f"Column '{col}' has type '{file_json_type}' but expected '{expected_type}'"
            })
    
    # Determine if schema matches
    is_compatible = len(missing_columns) == 0 and len(type_mismatches) == 0
    # Note: extra columns are allowed (will be ignored during append)
    
    # Build user-friendly messages
    messages = []
    if missing_columns:
        messages.append(f"Missing columns: {', '.join(sorted(missing_columns))}")
    if extra_columns:
        messages.append(f"Extra columns (will be ignored): {', '.join(sorted(extra_columns))}")
    if type_mismatches:
        for tm in type_mismatches:
            messages.append(tm["message"])
    
    return {
        "compatible": is_compatible,
        "file_columns": sorted(list(file_columns)),
        "expected_columns": sorted(list(expected_columns)),
        "missing_columns": sorted(missing_columns),
        "extra_columns": sorted(extra_columns),
        "type_mismatches": type_mismatches,
        "messages": messages,
        "summary": "Schema matches" if is_compatible else "Schema mismatch detected"
    }


# ---------- Data Operations ----------

class TransformOp(BaseModel):
    op: str
    columns: Optional[List[str]] = None
    mapping: Optional[Dict[str, str]] = None
    column: Optional[str] = None
    value: Optional[Any] = None
    values: Optional[List[Any]] = None
    n: Optional[int] = None
    sep: Optional[str] = " "
    # for future-safe extension; extra fields ignored
    model_config = ConfigDict(extra="ignore")


class TransformRequest(BaseModel):
    data: List[Dict[str, Any]]
    ops: List[TransformOp]


@app.post("/transform")
def transform(req: TransformRequest):
    rows = req.data or []
    if pd is not None:
        try:
            df = pd.DataFrame(rows)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Unable to build DataFrame: {e}")

        for op in req.ops:
            if op.op == "select":
                cols = op.columns or []
                df = df[cols]
            elif op.op == "rename":
                if not op.mapping:
                    continue
                df = df.rename(columns=op.mapping)
            elif op.op == "filter_equals":
                if op.column is None:
                    continue
                df = df[df[op.column] == op.value]
            elif op.op == "filter_in":
                if op.column is None or op.values is None:
                    continue
                df = df[df[op.column].isin(op.values)]
            elif op.op == "dropna":
                df = df.dropna(subset=op.columns) if op.columns else df.dropna()
            elif op.op == "limit":
                if isinstance(op.n, int):
                    df = df.head(op.n)
            elif op.op == "derive_concat":
                if op.columns:
                    sep = op.sep or " "
                    df[op.column or "derived"] = df[op.columns].astype(str).agg(lambda r: sep.join(r.values.tolist()), axis=1)
            else:
                # unknown op -> ignore for forward-compat
                continue

        out = df.to_dict(orient="records")
        return {"data": out, "rows": len(out), "columns": list(df.columns)}

    # Fallback: operate with pure Python minimally (select, rename, limit)
    result = rows
    for op in req.ops:
        if op.op == "select" and op.columns:
            cols = set(op.columns)
            result = [{k: r.get(k) for k in op.columns} for r in result]
        elif op.op == "rename" and op.mapping:
            result = [{(op.mapping.get(k) or k): v for k, v in r.items()} for r in result]
        elif op.op == "limit" and isinstance(op.n, int):
            result = result[: op.n]
        # other ops are no-ops in fallback

    cols = list(result[0].keys()) if result else []
    return {"data": result, "rows": len(result), "columns": cols}

# --------- Delta Lake adapter (experimental, non-breaking) ---------
try:
    from delta_adapter import DeltaStorageAdapter
    _delta_adapter = DeltaStorageAdapter()
except Exception as e:
    # Surface detailed import/initialization errors to logs to aid debugging
    import sys, traceback
    print(f"[DeltaAdapterInitError] {type(e).__name__}: {e}", file=sys.stderr)
    traceback.print_exc()
    _delta_adapter = None


class DeltaAppendPayload(BaseModel):
    table: str
    rows: List[Dict[str, Any]]

class DeltaEnsurePayload(BaseModel):
    model_config = ConfigDict(extra="ignore")
    project_id: Optional[int] = None
    dataset_id: Optional[int] = None
    table: Optional[str] = None  # Legacy support
    schema: Dict[str, Any]


@app.post("/delta/ensure")
def delta_ensure(payload: DeltaEnsurePayload):
    if _delta_adapter is None:
        raise HTTPException(status_code=500, detail="Delta adapter not available")
    
    # Prefer hierarchical path
    if payload.project_id is not None and payload.dataset_id is not None:
        try:
            _delta_adapter.ensure_main_table(payload.project_id, payload.dataset_id, payload.schema or {})
            return {"ok": True}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    elif payload.table:
        # Legacy support
        try:
            _delta_adapter.ensure_empty_table(payload.table, payload.schema or {})
            return {"ok": True}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    else:
        raise HTTPException(status_code=400, detail="Either (project_id + dataset_id) or table is required")



@app.post("/delta/append")
def delta_append(payload: DeltaAppendPayload):
    if _delta_adapter is None:
        raise HTTPException(status_code=500, detail="Delta adapter not available")
    if not payload.table:
        raise HTTPException(status_code=400, detail="table is required")
    _delta_adapter.append_rows(payload.table, payload.rows or [])
    return {"ok": True}


@app.post("/delta/append-file")
def delta_append_file(
    file: UploadFile = File(...),
    project_id: Optional[int] = Form(None),
    dataset_id: Optional[int] = Form(None),
    table: Optional[str] = Form(None)  # Legacy support
):
    if _delta_adapter is None:
        raise HTTPException(status_code=500, detail="Delta adapter not available")
    
    # Prefer hierarchical path with project_id/dataset_id
    if project_id is not None and dataset_id is not None:
        use_hierarchical = True
    elif table:
        use_hierarchical = False
    else:
        raise HTTPException(status_code=400, detail="Either (project_id + dataset_id) or table is required")
    content = file.file.read()
    # Try CSV, JSON, Excel
    rows: List[Dict[str, Any]] = []
    if pd is None:
        # minimal fallback: attempt JSON only
        try:
            import json as _json
            arr = _json.loads(content.decode("utf-8"))
            if isinstance(arr, list):
                rows = [r for r in arr if isinstance(r, dict)]
        except Exception:
            raise HTTPException(status_code=400, detail="pandas not available; send JSON array")
    else:
        try:
            df = None
            # Heuristic by filename
            name = (file.filename or "").lower()
            import io as _io
            bio = _io.BytesIO(content)
            if name.endswith(".csv"):
                df = pd.read_csv(bio)
            elif name.endswith(".xlsx") or name.endswith(".xls"):
                df = pd.read_excel(bio)
            elif name.endswith(".json"):
                # load as JSON array of objects
                import json as _json
                arr = _json.loads(content.decode("utf-8"))
                if isinstance(arr, list):
                    rows = [r for r in arr if isinstance(r, dict)]
            if df is not None:
                rows = df.to_dict(orient="records")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Unsupported or invalid file: {e}")
    if not isinstance(rows, list):
        raise HTTPException(status_code=400, detail="invalid rows")
    
    if use_hierarchical:
        result = _delta_adapter.append_to_main(project_id, dataset_id, rows or [])
        return {
            "ok": True, 
            "total_rows": len(rows), 
            "inserted": result.get("inserted", len(rows)),
            "duplicates": result.get("duplicates", 0)
        }
    else:
        _delta_adapter.append_rows(table, rows or [])  # Legacy
    
    return {"ok": True, "inserted": len(rows)}


# --------- Staging Upload for Dataset Creation ---------
# These endpoints support a two-step dataset creation flow:
# 1. Upload file to staging (no dataset created yet)
# 2. Finalize: create the Delta table from staging data

@app.post("/staging/upload")
def staging_upload(
    file: UploadFile = File(...),
):
    """Upload a file to staging for later dataset creation.
    
    Returns a staging_id that can be used to finalize the dataset creation.
    The staged file will be automatically cleaned up after 24 hours if not finalized.
    """
    import uuid
    import time
    
    staging_id = str(uuid.uuid4())
    staging_root = os.environ.get("DELTA_DATA_ROOT", "/data/delta")
    staging_dir = os.path.join(staging_root, "pending_uploads", staging_id)
    os.makedirs(staging_dir, exist_ok=True)
    
    # Save the raw file
    file_path = os.path.join(staging_dir, file.filename or "upload.csv")
    content = file.file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Save metadata for cleanup
    meta_path = os.path.join(staging_dir, "_meta.json")
    import json
    with open(meta_path, "w") as f:
        json.dump({
            "staging_id": staging_id,
            "filename": file.filename,
            "created_at": time.time(),
            "file_path": file_path
        }, f)
    
    # Also parse and validate the file, infer schema
    rows = []
    schema = None
    if pd is not None:
        try:
            import io as _io
            bio = _io.BytesIO(content)
            name = (file.filename or "").lower()
            df = None
            if name.endswith(".csv"):
                df = pd.read_csv(bio)
            elif name.endswith(".xlsx") or name.endswith(".xls"):
                df = pd.read_excel(bio)
            elif name.endswith(".json"):
                import json as _json
                arr = _json.loads(content.decode("utf-8"))
                if isinstance(arr, list):
                    rows = [r for r in arr if isinstance(r, dict)]
            if df is not None:
                rows = df.to_dict(orient="records")
                # Infer schema from DataFrame
                schema = {"type": "object", "properties": {}}
                for col in df.columns:
                    dtype = str(df[col].dtype)
                    if "int" in dtype:
                        schema["properties"][col] = {"type": "integer"}
                    elif "float" in dtype:
                        schema["properties"][col] = {"type": "number"}
                    elif "bool" in dtype:
                        schema["properties"][col] = {"type": "boolean"}
                    elif "datetime" in dtype:
                        schema["properties"][col] = {"type": "datetime"}
                    else:
                        schema["properties"][col] = {"type": "string"}
        except Exception as e:
            # Don't fail, just skip schema inference
            pass
    
    return {
        "staging_id": staging_id,
        "filename": file.filename,
        "row_count": len(rows),
        "schema": schema
    }


@app.get("/staging/{staging_id}")
def staging_get(staging_id: str):
    """Get information about a staged upload."""
    import json
    staging_root = os.environ.get("DELTA_DATA_ROOT", "/data/delta")
    staging_dir = os.path.join(staging_root, "pending_uploads", staging_id)
    meta_path = os.path.join(staging_dir, "_meta.json")
    
    if not os.path.exists(meta_path):
        raise HTTPException(status_code=404, detail="Staging not found")
    
    with open(meta_path, "r") as f:
        meta = json.load(f)
    
    return meta


@app.delete("/staging/{staging_id}")
def staging_delete(staging_id: str):
    """Delete a staged upload (cleanup)."""
    import shutil
    staging_root = os.environ.get("DELTA_DATA_ROOT", "/data/delta")
    staging_dir = os.path.join(staging_root, "pending_uploads", staging_id)
    
    if os.path.exists(staging_dir):
        shutil.rmtree(staging_dir, ignore_errors=True)
    
    return {"ok": True}


@app.post("/staging/{staging_id}/finalize")
def staging_finalize(
    staging_id: str,
    project_id: int = Form(...),
    dataset_id: int = Form(...),
):
    """Finalize a staged upload by writing data to the Delta table.
    
    This creates the actual Delta table with the data from staging.
    """
    import json
    import shutil
    
    if _delta_adapter is None:
        raise HTTPException(status_code=500, detail="Delta adapter not available")
    
    staging_root = os.environ.get("DELTA_DATA_ROOT", "/data/delta")
    staging_dir = os.path.join(staging_root, "pending_uploads", staging_id)
    meta_path = os.path.join(staging_dir, "_meta.json")
    
    if not os.path.exists(meta_path):
        raise HTTPException(status_code=404, detail="Staging not found")
    
    with open(meta_path, "r") as f:
        meta = json.load(f)
    
    file_path = meta.get("file_path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Staged file not found")
    
    # Read and parse the file
    with open(file_path, "rb") as f:
        content = f.read()
    
    rows = []
    if pd is not None:
        try:
            import io as _io
            bio = _io.BytesIO(content)
            name = (meta.get("filename") or "").lower()
            df = None
            if name.endswith(".csv"):
                df = pd.read_csv(bio)
            elif name.endswith(".xlsx") or name.endswith(".xls"):
                df = pd.read_excel(bio)
            elif name.endswith(".json"):
                import json as _json
                arr = _json.loads(content.decode("utf-8"))
                if isinstance(arr, list):
                    rows = [r for r in arr if isinstance(r, dict)]
            if df is not None:
                rows = df.to_dict(orient="records")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse staged file: {e}")
    
    if not rows:
        raise HTTPException(status_code=400, detail="No data in staged file")
    
    # Write to Delta table
    try:
        _delta_adapter.append_to_main(project_id, dataset_id, rows)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write to Delta: {e}")
    
    # Clean up staging
    shutil.rmtree(staging_dir, ignore_errors=True)
    
    return {"ok": True, "inserted": len(rows)}


class DeltaQueryPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")
    table: Optional[str] = None
    path: Optional[str] = None
    where: Optional[str] = None
    filters: Optional[Dict[str, Any]] = None
    order_by: Optional[str] = None
    sql: Optional[str] = None
    limit: int = 100
    offset: int = 0


@app.post("/delta/query/legacy")
def delta_query_legacy(payload: DeltaQueryPayload):
    if _delta_adapter is None:
        raise HTTPException(status_code=500, detail="Delta adapter not available")
    # accept either table or full path
    tbl = payload.table
    if not tbl and payload.path:
        # derive name from path by stripping root prefix
        try:
            from delta_adapter import DeltaConfig  # local import to avoid top-level cycles
            root = DeltaConfig.from_env().root
        except Exception:
            root = "/data/delta"
        p = payload.path.replace("\\", "/")
        r = root.rstrip("/\\")
        if p.startswith(r):
            tbl = p[len(r):].lstrip("/\\")
        else:
            # fallback: use last segment as table name
            tbl = p.strip("/\\").split("/")[-1]
    if not tbl:
        raise HTTPException(status_code=400, detail="table or path is required")
    # prefer payload.sql if present (backend may choose to use it)
    where = payload.where
    res = _delta_adapter.query(tbl, where, payload.limit, payload.offset, filters=payload.filters, order_by=payload.order_by)
    return res


@app.get("/delta/history/{table}")
def delta_history(table: str):
    """Get Delta table history using table name (legacy endpoint)."""
    if _delta_adapter is None:
        raise HTTPException(status_code=500, detail="Delta adapter not available")
    # Parse table name if it contains project/dataset info
    # Format could be: "project_id/dataset_id" or just a table name
    parts = table.split("/")
    if len(parts) == 2:
        try:
            project_id = int(parts[0])
            dataset_id = int(parts[1])
            return {"history": _delta_adapter.history(project_id, dataset_id)}
        except ValueError:
            pass
    # Fallback: treat as simple table name (not supported by current adapter)
    return {"history": []}


@app.get("/delta/history/{project_id}/{dataset_id}")
def delta_history_by_ids(project_id: int, dataset_id: int):
    """Get Delta table history using project and dataset IDs."""
    if _delta_adapter is None:
        raise HTTPException(status_code=500, detail="Delta adapter not available")
    try:
        return {"history": _delta_adapter.history(project_id, dataset_id)}
    except Exception as e:
        # Table might not exist yet
        return {"history": []}


class RestoreRequest(BaseModel):
    """Request model for Delta table restore operation."""
    model_config = ConfigDict(extra="ignore")
    project_id: int
    dataset_id: int
    version: int


@app.post("/delta/restore")
def delta_restore_new(payload: RestoreRequest):
    """Restore a Delta table to a specific version using delta-rs.
    
    This endpoint uses the native DeltaTable.restore() method which creates
    a new commit restoring the state to the specified version.
    
    Safety checks:
    - Validates version exists
    - Returns error if files were deleted by VACUUM
    
    Returns:
    - status: "ok" on success
    - restored_to_version: The version restored to
    - rows_before: Row count before restore
    - rows_after: Row count after restore (total_rows)
    - rows_added: Rows added (if restoring to version with more rows)
    - rows_deleted: Rows deleted (if restoring to version with fewer rows)
    """
    if _delta_adapter is None:
        raise HTTPException(status_code=500, detail="Delta adapter not available")
    
    try:
        result = _delta_adapter.restore(payload.project_id, payload.dataset_id, payload.version)
        return {
            "status": "ok",
            "restored_to_version": result["restored_to"],
            "method": result.get("method", "delta-rs"),
            "rows_before": result.get("rows_before", 0),
            "rows_after": result.get("rows_after", 0),
            "rows_added": result.get("rows_added", 0),
            "rows_deleted": result.get("rows_deleted", 0),
            "total_rows": result.get("total_rows", 0)
        }
    except ValueError as e:
        # Version doesn't exist or files were vacuumed
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Restore failed: {str(e)}")


@app.get("/delta/stats/{project_id}/{dataset_id}")
def delta_operation_stats(project_id: int, dataset_id: int):
    """Get stats from the latest Delta table operation.
    
    Returns operation metrics from the most recent commit including:
    - rows_added: Number of rows added
    - rows_updated: Number of rows updated  
    - rows_deleted: Number of rows deleted
    - total_rows: Current total row count
    - operation: The operation type (WRITE, MERGE, RESTORE, etc.)
    - version: The version number
    """
    if _delta_adapter is None:
        raise HTTPException(status_code=500, detail="Delta adapter not available")
    
    try:
        return _delta_adapter.get_latest_operation_stats(project_id, dataset_id)
    except Exception as e:
        return {"rows_added": 0, "rows_updated": 0, "rows_deleted": 0, "total_rows": 0, "error": str(e)}


@app.get("/delta/snapshot/{project_id}/{dataset_id}/{version}")
def delta_snapshot_data(project_id: int, dataset_id: int, version: int, 
                        limit: int = 50, offset: int = 0):
    """Get data from a Delta table at a specific version (time-travel).
    
    This endpoint enables viewing historical snapshots of data without modifying the table.
    Uses delta-rs native version parameter to load the table state at that point in time.
    
    Args:
        project_id: Project ID containing the dataset
        dataset_id: Dataset ID
        version: The version number to read (0-based, from Delta history)
        limit: Maximum rows to return (default 50, max 500)
        offset: Pagination offset (default 0)
    
    Returns:
        columns: List of column names
        data: List of row dictionaries
        total: Total row count at this version
        version: The version being read
    """
    if _delta_adapter is None:
        raise HTTPException(status_code=500, detail="Delta adapter not available")
    
    # Clamp limit
    limit = max(1, min(limit, 500))
    offset = max(0, offset)
    
    try:
        result = _delta_adapter.read_at_version(project_id, dataset_id, version, limit, offset)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read version {version}: {str(e)}")


class DeltaMergePayload(BaseModel):
    model_config = ConfigDict(extra="ignore")
    table: Optional[str] = None
    target_path: Optional[str] = None
    staging_path: Optional[str] = None
    keys: List[str]
    rows: Optional[List[Dict[str, Any]]] = None


@app.post("/delta/merge")
def delta_merge(payload: DeltaMergePayload):
    if _delta_adapter is None:
        raise HTTPException(status_code=500, detail="Delta adapter not available")
    tbl = payload.table
    if not tbl and payload.target_path:
        try:
            from delta_adapter import DeltaConfig
            root = DeltaConfig.from_env().root
        except Exception:
            root = "/data/delta"
        p = payload.target_path.replace("\\", "/")
        r = root.rstrip("/\\")
        if p.startswith(r):
            tbl = p[len(r):].lstrip("/\\")
        else:
            tbl = p.strip("/\\").split("/")[-1]
    if not tbl:
        raise HTTPException(status_code=400, detail="table or target_path is required")
    if not payload.keys:
        raise HTTPException(status_code=400, detail="keys are required")
    result = _delta_adapter.merge(tbl, rows=payload.rows, keys=payload.keys, staging_path=payload.staging_path)
    return result


# Enhanced merge endpoint for Change Requests (per merge_execution_spec.md)
class MergeChangeRequestPayload(BaseModel):
    """
    Payload for Change Request merge operations
    
    Spec: /docs/merge_execution_spec.md section 4.1
    """
    model_config = ConfigDict(extra="ignore")
    
    project_id: int
    dataset_id: int
    cr_id: str
    primary_keys: List[str]
    delta_version_before: Optional[int] = None
    current_delta_version: Optional[int] = None
    merge_schema: bool = True
    requested_by: str = "system"
    skip_conflict_check: bool = False
    force_merge: bool = False


@app.post("/delta/merge-cr")
def delta_merge_change_request(payload: MergeChangeRequestPayload):
    """
    Execute Change Request merge with full validation and conflict detection
    
    Implements merge_execution_spec.md section 3: High-Level Merge Flow
    
    Returns:
        - 200: Merge successful
        - 409: Conflicts detected
        - 422: Validation failed
        - 500: Merge failed
    """
    if _merge_executor is None:
        raise HTTPException(
            status_code=500,
            detail="Merge executor not available. Check merge_executor.py dependencies."
        )
    
    try:
        # Execute full merge workflow
        result = _merge_executor.full_merge(
            project_id=payload.project_id,
            dataset_id=payload.dataset_id,
            cr_id=payload.cr_id,
            primary_keys=payload.primary_keys,
            delta_version_before=payload.delta_version_before,
            current_delta_version=payload.current_delta_version,
            merge_schema=payload.merge_schema,
            requested_by=payload.requested_by,
            skip_conflict_check=payload.skip_conflict_check or payload.force_merge,
            cleanup_after=True
        )
        
        # Check result and return appropriate response
        if result.get("error") == "merge_conflict":
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "merge_conflict",
                    "message": f"Merge conflicts detected: {len(result.get('conflicts', []))} rows",
                    "conflicts": result.get("conflicts", [])
                }
            )
        
        if not result.get("ok"):
            raise HTTPException(
                status_code=500,
                detail={
                    "code": "merge_failed",
                    "message": result.get("error", "Unknown error"),
                    "details": result
                }
            )
        
        # Success - return structured response per spec
        return {
            "status": "ok",
            "merged_version": result.get("merge", {}).get("merged_version"),
            "commit_id": result.get("merge", {}).get("commit_id"),
            "rows_affected": result.get("merge", {}).get("rows_affected"),
            "diff": result.get("diff"),
            "cleanup": result.get("cleanup", False)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "code": "merge_error",
                "message": str(e)
            }
        )


class ExportRequest(BaseModel):
    data: List[Dict[str, Any]]
    format: str  # "csv" | "json"


@app.post("/export")
def export_data(req: ExportRequest):
    fmt = (req.format or "json").lower()
    data = req.data or []
    if fmt == "json":
        # passthrough
        return {"data": data}
    if fmt == "csv":
        if pd is None:
            # naive CSV build
            import csv
            from io import StringIO

            output = StringIO()
            fieldnames = list(data[0].keys()) if data else []
            writer = csv.DictWriter(output, fieldnames=fieldnames)
            writer.writeheader()
            for row in data:
                writer.writerow(row)
            return {"content_type": "text/csv", "body": output.getvalue()}
        try:
            df = pd.DataFrame(data)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Unable to build DataFrame: {e}")
        csv_text = df.to_csv(index=False)
        return {"content_type": "text/csv", "body": csv_text}
    raise HTTPException(status_code=400, detail="Unsupported format; use 'csv' or 'json'")


@app.post("/sample")
def sample(file: UploadFile = File(...), n: int = 50, offset: int = 0):
    if pd is None:
        raise HTTPException(status_code=500, detail="pandas not available for sampling")
    content = file.file.read()
    # Try CSV then Excel
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception:
        try:
            df = pd.read_excel(io.BytesIO(content))
        except Exception:
            raise HTTPException(status_code=400, detail="Unsupported file format")
    total_rows = len(df)
    if offset and isinstance(offset, int):
        try:
            df = df.iloc[offset:]
        except Exception:
            pass
    if n and isinstance(n, int):
        df = df.head(n)
    return {"data": df.to_dict(orient="records"), "columns": list(df.columns), "rows": len(df), "total_rows": int(total_rows)}


# --------- Business Rules Validation ---------
class RuleRequired(BaseModel):
    type: str
    columns: List[str]

class RuleUnique(BaseModel):
    type: str
    column: str

class RuleRange(BaseModel):
    type: str
    column: str
    min: Optional[float] = None
    max: Optional[float] = None

class RulesPayload(BaseModel):
    rules: List[Dict[str, Any]]
    data: List[Dict[str, Any]]


@app.post("/rules/validate")
def validate_rules(payload: RulesPayload):
    rows = payload.data or []
    errors: List[Dict[str, Any]] = []
    # If pandas is present, leverage it for efficiency
    df = None
    if pd is not None:
        try:
            df = pd.DataFrame(rows)
        except Exception:
            df = None

    for r in payload.rules or []:
        rtype = r.get("type")
        if rtype == "required":
            cols = r.get("columns") or []
            for col in cols:
                if df is not None:
                    missing_idx = df[df[col].isna() | (df[col] == "")].index.tolist() if col in df.columns else list(range(len(rows)))
                else:
                    missing_idx = [i for i, row in enumerate(rows) if (col not in row) or (row[col] in (None, ""))]
                if missing_idx:
                    errors.append({"rule": "required", "column": col, "rows": missing_idx, "message": f"Column '{col}' has missing values"})
        elif rtype == "not_null":
            cols = r.get("columns") or []
            for col in cols:
                if df is not None:
                    missing_idx = df[df[col].isna()].index.tolist() if col in df.columns else list(range(len(rows)))
                else:
                    missing_idx = [i for i, row in enumerate(rows) if (col not in row) or (row[col] is None)]
                if missing_idx:
                    errors.append({"rule": "not_null", "column": col, "rows": missing_idx, "message": f"Column '{col}' has nulls"})
        elif rtype == "unique":
            col = r.get("column")
            if df is not None and col in df.columns:
                dup_idx = df[df.duplicated(subset=[col], keep=False)].index.tolist()
            else:
                seen = {}
                dup_idx = []
                for i, row in enumerate(rows):
                    v = row.get(col)
                    if v in seen:
                        dup_idx.append(i)
                        dup_idx.append(seen[v])
                    else:
                        seen[v] = i
            if dup_idx:
                errors.append({"rule": "unique", "column": col, "rows": sorted(set(dup_idx)), "message": f"Column '{col}' contains duplicates"})
        elif rtype == "range":
            col = r.get("column")
            minv = r.get("min")
            maxv = r.get("max")
            bad = []
            for i, row in enumerate(rows):
                val = row.get(col)
                if val is None:
                    continue
                try:
                    f = float(val)
                except Exception:
                    bad.append(i); continue
                if minv is not None and f < float(minv): bad.append(i)
                if maxv is not None and f > float(maxv): bad.append(i)
            if bad:
                errors.append({"rule": "range", "column": col, "rows": bad, "message": f"Column '{col}' out of range"})
        elif rtype == "regex":
            import re
            col = r.get("column")
            pattern = r.get("pattern")
            if not col or not pattern:
                continue
            prog = re.compile(pattern)
            bad = []
            for i, row in enumerate(rows):
                val = row.get(col)
                if val is None:
                    continue
                if not prog.fullmatch(str(val)):
                    bad.append(i)
            if bad:
                errors.append({"rule": "regex", "column": col, "rows": bad, "message": f"Column '{col}' fails regex"})
        elif rtype in ("allowed_values", "ref_in"):
            col = r.get("column")
            values = r.get("values") or []
            bad = []
            allowed = set(values)
            for i, row in enumerate(rows):
                val = row.get(col)
                if val is None:
                    continue
                if val not in allowed:
                    bad.append(i)
            if bad:
                errors.append({"rule": rtype, "column": col, "rows": bad, "message": f"Column '{col}' has values outside allowed set"})
        # Support additional numeric validation types from UI
        elif rtype == "greater_than":
            col = r.get("column")
            threshold = r.get("value")
            if col and threshold is not None:
                bad = []
                for i, row in enumerate(rows):
                    val = row.get(col)
                    if val is None:
                        continue
                    try:
                        if float(val) <= float(threshold):
                            bad.append(i)
                    except (ValueError, TypeError):
                        bad.append(i)
                if bad:
                    errors.append({"rule": "greater_than", "column": col, "rows": bad, "message": f"Column '{col}' must be greater than {threshold}"})
        elif rtype == "less_than":
            col = r.get("column")
            threshold = r.get("value")
            if col and threshold is not None:
                bad = []
                for i, row in enumerate(rows):
                    val = row.get(col)
                    if val is None:
                        continue
                    try:
                        if float(val) >= float(threshold):
                            bad.append(i)
                    except (ValueError, TypeError):
                        bad.append(i)
                if bad:
                    errors.append({"rule": "less_than", "column": col, "rows": bad, "message": f"Column '{col}' must be less than {threshold}"})
        elif rtype == "between":
            col = r.get("column")
            minv = r.get("min") or r.get("value")
            maxv = r.get("max") or r.get("value2")
            bad = []
            for i, row in enumerate(rows):
                val = row.get(col)
                if val is None:
                    continue
                try:
                    f = float(val)
                except Exception:
                    bad.append(i)
                    continue
                if minv is not None and f < float(minv):
                    bad.append(i)
                elif maxv is not None and f > float(maxv):
                    bad.append(i)
            if bad:
                errors.append({"rule": "between", "column": col, "rows": bad, "message": f"Column '{col}' must be between {minv} and {maxv}"})
        elif rtype == "equals":
            col = r.get("column")
            expected = r.get("value")
            if col and expected is not None:
                bad = []
                for i, row in enumerate(rows):
                    val = row.get(col)
                    if val is None:
                        continue
                    try:
                        if isinstance(expected, (int, float)):
                            if float(val) != float(expected):
                                bad.append(i)
                        elif str(val) != str(expected):
                            bad.append(i)
                    except (ValueError, TypeError):
                        if str(val) != str(expected):
                            bad.append(i)
                if bad:
                    errors.append({"rule": "equals", "column": col, "rows": bad, "message": f"Column '{col}' must equal {expected}"})
        elif rtype == "not_contains":
            col = r.get("column")
            # Support both single value and array of values
            forbidden_values = r.get("values", [])
            single_value = r.get("value")
            if single_value and not forbidden_values:
                forbidden_values = [single_value]
            
            if col and forbidden_values:
                bad = []
                for i, row in enumerate(rows):
                    val = row.get(col)
                    if val is None:
                        continue
                    str_val = str(val).lower()
                    for forbidden in forbidden_values:
                        if forbidden and str(forbidden).lower() in str_val:
                            bad.append(i)
                            break  # Only add row once even if multiple matches
                if bad:
                    forbidden_list = ', '.join(f"'{f}'" for f in forbidden_values[:3])
                    if len(forbidden_values) > 3:
                        forbidden_list += f" and {len(forbidden_values) - 3} more"
                    errors.append({"rule": "not_contains", "column": col, "rows": bad, "message": f"Column '{col}' must not contain {forbidden_list}"})
        else:
            # Unknown rule -> ignore for forward compat
            continue

    return {"valid": len(errors) == 0, "errors": errors}


# --------- Business Rules Cell Validation ---------
try:
    from business_rules_service import get_business_rules_service, CellValidationResult, BatchValidationResult
    _business_rules_service = get_business_rules_service()
except Exception as e:
    import sys, traceback
    print(f"[BusinessRulesServiceInitError] {type(e).__name__}: {e}", file=sys.stderr)
    traceback.print_exc()
    _business_rules_service = None


class CellValidateRequest(BaseModel):
    """Request for cell-level validation during live edit"""
    column: str
    value: Any
    rules: List[Dict[str, Any]]
    row_id: Optional[Any] = None
    row_data: Optional[Dict[str, Any]] = None


class BatchValidateRequest(BaseModel):
    """Request for batch validation of multiple rows"""
    rows: List[Dict[str, Any]]
    rules: List[Dict[str, Any]]
    use_ge: bool = True  # Whether to use Great Expectations


@app.post("/rules/validate/cell")
def validate_cell_rule(req: CellValidateRequest):
    """
    Validate a single cell value against business rules.
    
    Used for real-time validation feedback during live editing.
    Returns validation result with any errors found.
    """
    if _business_rules_service is None:
        # Fallback to simple validation
        return _validate_cell_fallback(req.column, req.value, req.rules, req.row_id)
    
    try:
        result = _business_rules_service.validate_cell(
            column=req.column,
            value=req.value,
            rules=req.rules,
            row_id=req.row_id,
            row_data=req.row_data
        )
        return {
            "valid": result.valid,
            "errors": [e.model_dump() for e in result.errors],
            "column": result.column,
            "value": result.value
        }
    except Exception as e:
        return {"valid": False, "errors": [{"message": str(e), "severity": "error"}], "column": req.column, "value": req.value}


@app.post("/rules/validate/batch")
def validate_batch_rules(req: BatchValidateRequest):
    """
    Validate multiple rows against business rules.
    
    Uses Great Expectations for batch validation when available.
    Returns detailed validation results with all errors found.
    """
    if _business_rules_service is None:
        # Fallback to existing /rules/validate endpoint logic
        payload = RulesPayload(rules=req.rules, data=req.rows)
        return validate_rules(payload)
    
    try:
        result = _business_rules_service.validate_rows(
            rows=req.rows,
            rules=req.rules,
            use_ge=req.use_ge
        )
        return {
            "valid": result.valid,
            "error_count": result.error_count,
            "warning_count": result.warning_count,
            "errors": [e.model_dump() for e in result.errors],
            "summary": result.summary
        }
    except Exception as e:
        return {"valid": False, "error_count": 1, "warning_count": 0, "errors": [{"message": str(e), "severity": "error"}], "summary": {}}


def _validate_cell_fallback(column: str, value: Any, rules: List[Dict[str, Any]], row_id: Any = None) -> Dict[str, Any]:
    """Fallback cell validation when BusinessRulesService is not available"""
    errors = []
    
    for rule in rules:
        rule_type = rule.get("type")
        
        # Check if rule applies to this column
        if rule.get("column") != column and column not in rule.get("columns", []):
            continue
        
        # Required check
        if rule_type == "required":
            if value is None or (isinstance(value, str) and value.strip() == ""):
                errors.append({
                    "column": column,
                    "severity": "error",
                    "rule_type": "required",
                    "message": f"'{column}' is required"
                })
        
        # Skip other validations for null values
        if value is None or (isinstance(value, str) and value.strip() == ""):
            continue
        
        # Numeric validations
        if rule_type == "greater_than":
            threshold = rule.get("value")
            if threshold is not None:
                try:
                    if float(value) <= float(threshold):
                        errors.append({
                            "column": column,
                            "severity": "error",
                            "rule_type": "greater_than",
                            "message": f"'{column}' must be greater than {threshold}"
                        })
                except (ValueError, TypeError):
                    errors.append({
                        "column": column,
                        "severity": "error",
                        "rule_type": "greater_than",
                        "message": f"'{column}' must be a valid number"
                    })
        
        elif rule_type == "less_than":
            threshold = rule.get("value")
            if threshold is not None:
                try:
                    if float(value) >= float(threshold):
                        errors.append({
                            "column": column,
                            "severity": "error",
                            "rule_type": "less_than",
                            "message": f"'{column}' must be less than {threshold}"
                        })
                except (ValueError, TypeError):
                    errors.append({
                        "column": column,
                        "severity": "error",
                        "rule_type": "less_than",
                        "message": f"'{column}' must be a valid number"
                    })
        
        elif rule_type in ("between", "range"):
            min_val = rule.get("min") or rule.get("value")
            max_val = rule.get("max") or rule.get("value2")
            try:
                num_value = float(value)
                if min_val is not None and num_value < float(min_val):
                    errors.append({
                        "column": column,
                        "severity": "error",
                        "rule_type": "between",
                        "message": f"'{column}' must be at least {min_val}"
                    })
                elif max_val is not None and num_value > float(max_val):
                    errors.append({
                        "column": column,
                        "severity": "error",
                        "rule_type": "between",
                        "message": f"'{column}' must be at most {max_val}"
                    })
            except (ValueError, TypeError):
                errors.append({
                    "column": column,
                    "severity": "error",
                    "rule_type": "between",
                    "message": f"'{column}' must be a valid number"
                })
        
        elif rule_type == "equals":
            expected = rule.get("value")
            if expected is not None:
                try:
                    if isinstance(expected, (int, float)):
                        if float(value) != float(expected):
                            errors.append({
                                "column": column,
                                "severity": "error",
                                "rule_type": "equals",
                                "message": f"'{column}' must equal {expected}"
                            })
                    elif str(value) != str(expected):
                        errors.append({
                            "column": column,
                            "severity": "error",
                            "rule_type": "equals",
                            "message": f"'{column}' must equal {expected}"
                        })
                except (ValueError, TypeError):
                    if str(value) != str(expected):
                        errors.append({
                            "column": column,
                            "severity": "error",
                            "rule_type": "equals",
                            "message": f"'{column}' must equal {expected}"
                        })
    
    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "column": column,
        "value": value
    }


# --------- Validation Service (State Machine) ---------
try:
    from validation_service import ValidationService
    _validation_service = ValidationService()
except Exception as e:
    import sys, traceback
    print(f"[ValidationServiceInitError] {type(e).__name__}: {e}", file=sys.stderr)
    traceback.print_exc()
    _validation_service = None


class CellValidationRequest(BaseModel):
    """Request for cell-level validation"""
    project_id: int
    dataset_id: int
    row_id: str
    column: str
    new_value: Any


class SessionValidationRequest(BaseModel):
    """Request for session-level validation"""
    project_id: int
    dataset_id: int
    session_id: str


class ChangeRequestValidationRequest(BaseModel):
    """Request for change request validation"""
    project_id: int
    dataset_id: int
    change_request_id: int


class MergeValidationRequest(BaseModel):
    """Request for merge validation"""
    project_id: int
    dataset_id: int
    change_request_id: int


@app.post("/validation/cell")
def validate_cell_endpoint(req: CellValidationRequest):
    """
    Validate a single cell edit.
    
    Implements cell-level validation from the state machine.
    Returns: CellValidationResult with valid/invalid and severity.
    """
    if _validation_service is None:
        raise HTTPException(status_code=500, detail="Validation service not available")
    
    try:
        result = _validation_service.validate_cell(
            req.project_id,
            req.dataset_id,
            req.row_id,
            req.column,
            req.new_value
        )
        return result.dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cell validation failed: {str(e)}")


@app.post("/validation/session")
def validate_session_endpoint(req: SessionValidationRequest):
    """
    Validate an entire live edit session.
    
    Implements session-level validation from the state machine.
    Returns: SessionValidationResult with state and validation details.
    """
    if _validation_service is None:
        raise HTTPException(status_code=500, detail="Validation service not available")
    
    try:
        result = _validation_service.validate_session(
            req.project_id,
            req.dataset_id,
            req.session_id
        )
        
        # Save validation result
        if result.validation_result:
            _validation_service.save_validation_result(
                req.project_id,
                req.dataset_id,
                result.validation_result
            )
        
        return result.dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Session validation failed: {str(e)}")


@app.post("/validation/change_request")
def validate_change_request_endpoint(req: ChangeRequestValidationRequest):
    """
    Validate a change request before approval.
    
    Implements CR validation from the state machine.
    Returns: ChangeRequestValidationResult with can_approve flag.
    """
    if _validation_service is None:
        raise HTTPException(status_code=500, detail="Validation service not available")
    
    try:
        result = _validation_service.validate_change_request(
            req.project_id,
            req.dataset_id,
            req.change_request_id
        )
        
        # Save validation result
        if result.validation_result:
            _validation_service.save_validation_result(
                req.project_id,
                req.dataset_id,
                result.validation_result
            )
        
        return result.dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CR validation failed: {str(e)}")


@app.post("/validation/merge")
def validate_merge_endpoint(req: MergeValidationRequest):
    """
    Final validation before merge execution.
    
    Implements approval-stage validation from the state machine.
    Returns: MergeValidationResult with merge_state.
    """
    if _validation_service is None:
        raise HTTPException(status_code=500, detail="Validation service not available")
    
    try:
        result = _validation_service.validate_before_merge(
            req.project_id,
            req.dataset_id,
            req.change_request_id
        )
        
        # Save validation result
        if result.validation_result:
            _validation_service.save_validation_result(
                req.project_id,
                req.dataset_id,
                result.validation_result
            )
        
        return result.dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Merge validation failed: {str(e)}")


# ==================== Delta Table Stats ====================

class DeltaStatsRequest(BaseModel):
    table: str  # dataset ID as string for legacy compatibility


@app.post("/delta/stats")
def delta_stats(req: DeltaStatsRequest):
    """Get statistics about a Delta table (row count, column count)."""
    if _delta_adapter is None:
        raise HTTPException(status_code=500, detail="Delta adapter not available")
    
    try:
        # Parse table as dataset_id (legacy format uses dataset_id as the table identifier)
        dataset_id = int(req.table)
        # For now, we'll use project_id = 0 for legacy tables, or parse from extended format later
        # The delta adapter's _table_path method will use the legacy /data/delta/<id> path
        # We need to use the new format with project and dataset IDs
        
        # Since we're transitioning, try to call get_stats with reasonable defaults
        # Check if table contains "/" which would indicate new format
        if "/" in req.table:
            # New format might be "project_id/dataset_id" but for now we'll use legacy
            parts = req.table.split("/")
            if len(parts) >= 2:
                project_id = int(parts[0])
                dataset_id = int(parts[1])
                stats = _delta_adapter.get_stats(project_id, dataset_id)
            else:
                raise ValueError("Invalid table format")
        else:
            # Legacy format: table is just the dataset_id, assume project_id from structure
            # For the legacy _table_path, we can call get_stats with dummy project_id
            # But actually, let's check the actual path structure
            # The Go service sends just the dataset ID, so we need to handle that
            # Let's use 0 as project_id for now or check actual file structure
            # Actually, we should use the new path structure: projects/<project_id>/datasets/<dataset_id>/main
            # But without project_id, we need to scan or default
            
            # Simplest approach: since Go service only sends dataset_id, 
            # we should update the call to use the legacy _table_path directly
            # But get_stats uses _main_path which requires project_id
            
            # Work-around: read from legacy path /data/delta/<dataset_id>
            from delta_adapter import DeltaTable
            import os
            from deltalake import DeltaTable
            
            legacy_path = f"/data/delta/{dataset_id}"
            if not os.path.exists(os.path.join(legacy_path, "_delta_log")):
                return {"num_rows": 0, "num_cols": 0}
            
            dt = DeltaTable(legacy_path)
            at = dt.to_pyarrow_table()
            stats = {
                "num_rows": len(at),
                "num_cols": len(at.schema)
            }
        
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")


@app.get("/delta/table-info")
def delta_table_info(
    project_id: Optional[int] = None,
    dataset_id: Optional[int] = None,
    table: Optional[str] = None
):
    """Get statistics about a Delta table using query parameters.
    
    Accepts either:
    - project_id + dataset_id (hierarchical path)
    - table (legacy format)
    """
    if _delta_adapter is None:
        raise HTTPException(status_code=500, detail="Delta adapter not available")
    
    try:
        import os
        from deltalake import DeltaTable
        
        # Determine which path to use
        if project_id is not None and dataset_id is not None:
            # Use hierarchical path
            delta_path = _delta_adapter._main_path(project_id, dataset_id)
        elif table:
            # Legacy path - table can be dataset_id or other legacy format
            if "/" in table:
                # Format: project_id/dataset_id
                parts = table.split("/")
                if len(parts) >= 2:
                    delta_path = _delta_adapter._main_path(int(parts[0]), int(parts[1]))
                else:
                    raise ValueError("Invalid table format")
            else:
                # Legacy flat path
                delta_path = f"/data/delta/{table}"
        else:
            raise HTTPException(
                status_code=400, 
                detail="Either (project_id + dataset_id) or table is required"
            )
        
        # Check if Delta table exists
        if not os.path.exists(os.path.join(delta_path, "_delta_log")):
            return {"num_rows": 0, "num_cols": 0}
        
        # Read Delta table and get stats
        dt = DeltaTable(delta_path)
        at = dt.to_pyarrow_table()
        
        return {
            "num_rows": len(at),
            "num_cols": len(at.schema)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get table info: {str(e)}")


# ==================== Delta SQL Query ====================

class DeltaQueryRequest(BaseModel):
    sql: str
    table_mappings: Dict[str, str]  # {"schema.table": "project_id/dataset_id"}
    limit: int = 250
    offset: int = 0


@app.post("/delta/query")
def delta_query(req: DeltaQueryRequest):
    """Execute SQL queries against Delta tables using DuckDB.
    
    This endpoint allows SQL queries to run against Delta Lake tables.
    The table_mappings parameter maps SQL table references (schema.table) to Delta paths.
    """
    print(f"DEBUG: delta_query called with sql={req.sql} mappings={req.table_mappings}")
    
    if _delta_adapter is None:
        raise HTTPException(status_code=500, detail="Delta adapter not available")
    
    try:
        from deltalake import DeltaTable
        import os
        
        # Use global DuckDB connection (pre-loaded with Delta extension)
        con = get_duckdb_read_connection()
        
        # Register each Delta table as a view in DuckDB
        for table_ref, path_info in req.table_mappings.items():
            # path_info can be "project_id/dataset_id" or just "dataset_id"
            delta_path = None
            
            if "/" in path_info:
                parts = path_info.split("/")
                project_id = int(parts[0])
                dataset_id = int(parts[1])
                
                # Try new hierarchical path first
                new_path = _delta_adapter._main_path(project_id, dataset_id)
                if os.path.exists(os.path.join(new_path, "_delta_log")):
                    delta_path = new_path
                else:
                    # Fall back to legacy path
                    legacy_path = f"/data/delta/{dataset_id}"
                    if os.path.exists(os.path.join(legacy_path, "_delta_log")):
                        delta_path = legacy_path
            else:
                # Legacy format - just dataset_id
                dataset_id = int(path_info)
                legacy_path = f"/data/delta/{dataset_id}"
                if os.path.exists(os.path.join(legacy_path, "_delta_log")):
                    delta_path = legacy_path
            
            # Check if we found a valid Delta table
            if delta_path is None or not os.path.exists(os.path.join(delta_path, "_delta_log")):
                raise HTTPException(
                    status_code=404, 
                    detail=f"Delta table not found for {table_ref}. Tried paths: new={_delta_adapter._main_path(int(parts[0]), int(parts[1])) if '/' in path_info else 'N/A'}, legacy=/data/delta/{dataset_id}"
                )
            
            # Normalize path for DuckDB (replace backslashes with forward slashes to avoid escape sequence issues)
            duckdb_path = delta_path.replace("\\", "/")
            print(f"DEBUG: delta_query table_ref={table_ref} original_path={delta_path} duckdb_path={duckdb_path}")
            
            # Create view with the table reference name
            # Replace dots with underscores for DuckDB view names, but keep original in SELECT
            view_name = table_ref.replace(".", "_")
            try:
                con.execute(f"CREATE OR REPLACE VIEW {view_name} AS SELECT * FROM delta_scan('{duckdb_path}')")
                print(f"DEBUG: Created view {view_name}")
            except Exception as e:
                print(f"DEBUG: Failed to create view {view_name}: {e}")
                raise
            
            # Also create a version with schema.table format if it contains a dot
            if "." in table_ref:
                # DuckDB supports schema.table format
                schema_name, table_name = table_ref.split(".", 1)
                try:
                    con.execute(f"CREATE SCHEMA IF NOT EXISTS {schema_name}")
                    con.execute(f"CREATE OR REPLACE VIEW {schema_name}.{table_name} AS SELECT * FROM delta_scan('{duckdb_path}')")
                    print(f"DEBUG: Created schema view {schema_name}.{table_name}")
                except Exception as e:
                    print(f"DEBUG: Failed to create schema view {schema_name}.{table_name}: {e}")
                    raise
        
        # Execute the query with pagination
        # Wrap user query to apply limit/offset
        full_query = f"SELECT * FROM ({req.sql}) AS subquery LIMIT {req.limit} OFFSET {req.offset}"
        
        result = con.execute(full_query).fetch_arrow_table()
        
        # Convert to Python native types for JSON serialization
        columns = result.column_names
        rows = []
        for i in range(len(result)):
            row = []
            for col_name in columns:
                val = result[col_name][i].as_py()
                row.append(val)
            rows.append(row)
        
        return {
            "columns": columns,
            "rows": rows,
            "total": len(rows)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query execution failed: {str(e)}")


# ==================== Live Edit Endpoints ====================

try:
    from live_edit_service import LiveEditService
    from live_edit_models import (
        StartSessionRequest,
        CellEditRequest,
        BulkEditRequest,
        SessionMode,
    )
    _live_edit_service = LiveEditService()
except Exception as e:
    import traceback
    print(f"[LiveEditServiceInitError] {type(e).__name__}: {e}")
    traceback.print_exc()
    _live_edit_service = None


class LiveEditStartRequest(BaseModel):
    """Request to start a live edit session"""
    project_id: int
    mode: str = "full_table"  # "full_table" or "row_selection"
    rows: Optional[List[int]] = None


class LiveEditCellRequest(BaseModel):
    """Request to save a single cell edit"""
    row_id: str
    column: str
    new_value: Any
    old_value: Optional[Any] = None
    client_ts: Optional[str] = None


class LiveEditBulkRequest(BaseModel):
    """Request to save bulk cell edits"""
    edits: List[Dict[str, Any]]


class LiveEditSubmitRequest(BaseModel):
    """Request to submit live edit changes as a change request"""
    project_id: int
    title: str
    comment: Optional[str] = ""
    reviewer_ids: List[int]
    edits: Dict[str, Any]  # { edited_cells: [...], deleted_rows: [...] }


@app.post("/datasets/{dataset_id}/live-sessions")
def start_live_session(dataset_id: int, request: LiveEditStartRequest):
    """
    Start a new live edit session
    
    POST /datasets/{dataset_id}/live-sessions
    
    Returns: session_id, staging_path, editable_columns, rules_map, created_at, expires_at
    """
    if _live_edit_service is None:
        raise HTTPException(status_code=500, detail="Live Edit service not available")
    
    try:
        # Convert to internal request format
        mode = SessionMode.FULL_TABLE if request.mode == "full_table" else SessionMode.ROW_SELECTION
        internal_request = StartSessionRequest(
            user_id="user_001",  # TODO: Get from auth context
            mode=mode,
            rows=request.rows or []
        )
        
        response = _live_edit_service.start_session(
            internal_request, 
            str(request.project_id), 
            str(dataset_id)
        )
        return response.dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start session: {str(e)}")


@app.get("/datasets/{dataset_id}/live-sessions/{session_id}")
def get_live_session(dataset_id: int, session_id: str):
    """
    Get live edit session details
    
    GET /datasets/{dataset_id}/live-sessions/{session_id}
    
    Returns: LiveEditSession
    """
    if _live_edit_service is None:
        raise HTTPException(status_code=500, detail="Live Edit service not available")
    
    session = _live_edit_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return session.dict()


@app.delete("/datasets/{dataset_id}/live-sessions/{session_id}")
def delete_live_session(dataset_id: int, session_id: str):
    """
    Delete/abort a live edit session
    
    DELETE /datasets/{dataset_id}/live-sessions/{session_id}
    
    Returns: {ok: true}
    """
    if _live_edit_service is None:
        raise HTTPException(status_code=500, detail="Live Edit service not available")
    
    try:
        success = _live_edit_service.delete_session(session_id)
        if not success:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return {"ok": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete session: {str(e)}")


@app.post("/datasets/{dataset_id}/live-sessions/{session_id}/edits")
def save_live_edit_cell(
    dataset_id: int,
    session_id: str,
    request: LiveEditCellRequest
):
    """
    Save a single cell edit
    
    POST /datasets/{dataset_id}/live-sessions/{session_id}/edits
    
    Returns: {status, validation, edit_id}
    """
    if _live_edit_service is None:
        raise HTTPException(status_code=500, detail="Live Edit service not available")
    
    try:
        internal_request = CellEditRequest(
            row_id=request.row_id,
            column=request.column,
            new_value=request.new_value,
            client_ts=request.client_ts
        )
        
        response = _live_edit_service.save_cell_edit(session_id, internal_request, "user_001")
        
        if response.status == "error":
            raise HTTPException(status_code=422, detail=response.dict())
        
        return response.dict()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save edit: {str(e)}")


@app.post("/datasets/{dataset_id}/live-sessions/{session_id}/edits/batch")
def save_live_edit_bulk(
    dataset_id: int,
    session_id: str,
    request: LiveEditBulkRequest
):
    """
    Save multiple edits in batch
    
    POST /datasets/{dataset_id}/live-sessions/{session_id}/edits/batch
    
    Returns: {results: [{edit_id, valid, messages}, ...]}
    """
    if _live_edit_service is None:
        raise HTTPException(status_code=500, detail="Live Edit service not available")
    
    try:
        internal_request = BulkEditRequest(edits=[
            CellEditRequest(
                row_id=e.get("row_id", ""),
                column=e.get("column", ""),
                new_value=e.get("new_value")
            ) for e in request.edits
        ])
        
        response = _live_edit_service.save_bulk_edits(session_id, internal_request, "user_001")
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save bulk edits: {str(e)}")


@app.post("/datasets/{dataset_id}/live-sessions/{session_id}/preview")
def get_live_edit_preview(dataset_id: int, session_id: str):
    """
    Generate preview summary for a session
    
    POST /datasets/{dataset_id}/live-sessions/{session_id}/preview
    
    Returns: {summary, diffs, deleted_rows, validation_summary}
    """
    if _live_edit_service is None:
        raise HTTPException(status_code=500, detail="Live Edit service not available")
    
    try:
        preview = _live_edit_service.generate_preview(session_id)
        return preview.dict()
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate preview: {str(e)}")


@app.get("/datasets/{dataset_id}/live-sessions/{session_id}/edits")
def get_live_session_edits(dataset_id: int, session_id: str):
    """
    Get all edits for a session
    
    GET /datasets/{dataset_id}/live-sessions/{session_id}/edits
    
    Returns: List[CellEdit]
    """
    if _live_edit_service is None:
        raise HTTPException(status_code=500, detail="Live Edit service not available")
    
    edits = _live_edit_service.get_session_edits(session_id)
    return [edit.dict() for edit in edits]


# ==================== Live Edit Apply Endpoint (Called by Go service on CR approval) ====================

class LiveEditApplyRequest(BaseModel):
    """Request to apply live edit changes to a dataset"""
    session_id: str
    project_id: int
    dataset_id: int
    edited_cells: List[Dict[str, Any]] = []
    deleted_rows: List[str] = []


@app.post("/live-edit/apply")
def apply_live_edit_changes(request: LiveEditApplyRequest):
    """
    Apply live edit changes to the dataset (called when CR is approved)
    
    POST /live-edit/apply
    
    This endpoint is called by the Go service when a live_edit change request is approved.
    It applies all the staged edits and deletions to the main Delta table.
    
    Request body:
    {
        "session_id": "sess_abc123",
        "project_id": 1,
        "dataset_id": 1,
        "edited_cells": [
            {"row_id": "0", "column": "amount", "old_value": "100", "new_value": "200"},
            ...
        ],
        "deleted_rows": ["5", "10"]
    }
    
    Returns: {ok: true, rows_updated: N, rows_deleted: M}
    """
    if _live_edit_service is None:
        raise HTTPException(status_code=500, detail="Live Edit service not available")
    
    try:
        result = _live_edit_service.apply_changes(
            session_id=request.session_id,
            project_id=str(request.project_id),
            dataset_id=str(request.dataset_id),
            edited_cells=request.edited_cells,
            deleted_rows=request.deleted_rows
        )
        
        if not result.get("ok"):
            raise HTTPException(status_code=500, detail=result.get("error", "Unknown error"))
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to apply changes: {str(e)}")


class LiveEditRowsRequest(BaseModel):
    """Request to fetch specific rows from a dataset"""
    project_id: int
    dataset_id: int
    row_ids: List[str]


@app.post("/live-edit/rows")
def get_live_edit_rows(request: LiveEditRowsRequest):
    """
    Fetch specific rows from a dataset by row IDs
    
    POST /live-edit/rows
    
    This endpoint is called by the Go service to fetch actual row data for preview
    in the Change Request details page.
    
    Request body:
    {
        "project_id": 1,
        "dataset_id": 1,
        "row_ids": ["0", "5", "10"]
    }
    
    Returns: {ok: true, rows: [...], columns: [...]}
    """
    if _live_edit_service is None:
        raise HTTPException(status_code=500, detail="Live Edit service not available")
    
    try:
        result = _live_edit_service.get_rows_by_ids(
            project_id=str(request.project_id),
            dataset_id=str(request.dataset_id),
            row_ids=request.row_ids
        )
        
        if not result.get("ok"):
            raise HTTPException(status_code=500, detail=result.get("error", "Unknown error"))
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch rows: {str(e)}")

