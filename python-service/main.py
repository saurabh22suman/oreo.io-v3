from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, field_validator, ConfigDict
from typing import List, Dict, Any, Optional
from jsonschema import Draft202012Validator, exceptions as js_exceptions
import io
try:
    import pandas as pd
except Exception:  # optional dependency guard
    pd = None

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


@app.get("/health")
def health():
    return {"status": "ok"}


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
    table: str
    schema: Dict[str, Any]


@app.post("/delta/ensure")
def delta_ensure(payload: DeltaEnsurePayload):
    if _delta_adapter is None:
        raise HTTPException(status_code=500, detail="Delta adapter not available")
    if not payload.table:
        raise HTTPException(status_code=400, detail="table is required")
    try:
        _delta_adapter.ensure_empty_table(payload.table, payload.schema or {})
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@app.post("/delta/append")
def delta_append(payload: DeltaAppendPayload):
    if _delta_adapter is None:
        raise HTTPException(status_code=500, detail="Delta adapter not available")
    if not payload.table:
        raise HTTPException(status_code=400, detail="table is required")
    _delta_adapter.append_rows(payload.table, payload.rows or [])
    return {"ok": True}


@app.post("/delta/append-file")
def delta_append_file(table: str = Form(...), file: UploadFile = File(...)):
    if _delta_adapter is None:
        raise HTTPException(status_code=500, detail="Delta adapter not available")
    if not table:
        raise HTTPException(status_code=400, detail="table is required")
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
    _delta_adapter.append_rows(table, rows or [])
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


@app.post("/delta/query")
def delta_query(payload: DeltaQueryPayload):
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
    if _delta_adapter is None:
        raise HTTPException(status_code=500, detail="Delta adapter not available")
    return {"history": _delta_adapter.history(table)}


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
    """
    if _delta_adapter is None:
        raise HTTPException(status_code=500, detail="Delta adapter not available")
    
    try:
        result = _delta_adapter.restore(payload.project_id, payload.dataset_id, payload.version)
        return {
            "status": "ok",
            "restored_to_version": result["restored_to"],
            "method": result.get("method", "delta-rs")
        }
    except ValueError as e:
        # Version doesn't exist or files were vacuumed
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Restore failed: {str(e)}")


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
        else:
            # Unknown rule -> ignore for forward compat
            continue

    return {"valid": len(errors) == 0, "errors": errors}



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
