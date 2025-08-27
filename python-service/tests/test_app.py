import os
import sys
import pytest
from httpx import AsyncClient

# Ensure project root is on sys.path for `import main`
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from main import app


@pytest.mark.asyncio
async def test_health():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        resp = await ac.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_validate_valid():
    schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "age": {"type": "integer", "minimum": 0}
        },
        "required": ["name", "age"],
        "additionalProperties": False
    }
    data = [{"name": "Alice", "age": 30}]
    payload = {"json_schema": schema, "data": data}
    async with AsyncClient(app=app, base_url="http://test") as ac:
        resp = await ac.post("/validate", json=payload)
        assert resp.status_code == 200
        body = resp.json()
        assert body["valid"] is True
        assert body["errors"] == []


@pytest.mark.asyncio
async def test_validate_invalid():
    schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {"age": {"type": "integer", "minimum": 0}},
        "required": ["age"],
    }
    data = [{"age": -5}]
    payload = {"json_schema": schema, "data": data}
    async with AsyncClient(app=app, base_url="http://test") as ac:
        resp = await ac.post("/validate", json=payload)
        assert resp.status_code == 200
        body = resp.json()
        assert body["valid"] is False
        assert len(body["errors"]) == 1
        err = body["errors"][0]
        assert err["row"] == 0
        assert err["keyword"] in ("minimum", "type")
