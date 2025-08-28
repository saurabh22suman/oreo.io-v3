from fastapi import FastAPI, HTTPException, UploadFile, File
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
