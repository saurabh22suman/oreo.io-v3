from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, field_validator, ConfigDict
from typing import List, Dict, Any
from jsonschema import Draft202012Validator, exceptions as js_exceptions

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
