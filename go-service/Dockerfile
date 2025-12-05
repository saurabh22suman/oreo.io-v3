# syntax=docker/dockerfile:1

# Build stage with CGO support for go-duckdb
FROM golang:1.24-bookworm AS build
WORKDIR /app

# Install build dependencies for DuckDB
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Cache go modules separately for faster rebuilds
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
	go mod download

COPY . .

# Build with CGO enabled for DuckDB support
RUN --mount=type=cache,target=/go/pkg/mod \
	--mount=type=cache,target=/root/.cache/go-build \
	CGO_ENABLED=1 go build -o server ./cmd/server

# Runtime stage - use debian for glibc compatibility with DuckDB
FROM debian:bookworm-slim
WORKDIR /app

# Add curl for tooling (e.g., diagnostics, CI linters) and ca-certificates
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/server /app/server
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD curl -sf http://localhost:8080/healthz || exit 1
ENTRYPOINT ["/app/server"]
