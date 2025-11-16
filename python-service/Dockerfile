# syntax=docker/dockerfile:1
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /app
# System dependencies for PyArrow/Delta Lake/DuckDB runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ca-certificates curl \
       build-essential pkg-config \
       libssl-dev libffi-dev \
       libgomp1 libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps first to maximize caching
COPY requirements.txt ./
RUN --mount=type=cache,target=/root/.cache/pip \
    python -m pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
