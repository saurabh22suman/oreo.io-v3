# Oreo.io v3

**Enterprise-grade data management platform with ACID-compliant versioning, collaborative workflows, and robust security.**

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/your-org/oreo.io)
[![Go Version](https://img.shields.io/badge/go-1.23+-blue)](https://go.dev)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## Overview

Oreo.io is a modern data management platform that combines the power of Delta Lake for ACID-compliant data versioning with a collaborative approval workflow system. Built with clean architecture principles, it provides a scalable, secure, and maintainable solution for managing datasets across teams.

**Key Features:**

- 🔐 **Enterprise Security**: JWT authentication, RBAC authorization, SQL injection prevention
- 📊 **Delta Lake Integration**: ACID transactions, versioning, time-travel queries
- 🔄 **Approval Workflows**: Submit, review, and approve data changes collaboratively
- 🏗️ **Clean Architecture**: Modular design with cmd/internal structure
- 🚀 **Production-Ready**: Comprehensive validation, audit logging, error handling
- 📱 **Modern UI**: React frontend with real-time updates
- 🐳 **Docker Support**: Complete containerized deployment

---

## Quick Start

### Prerequisites

- **Docker & Docker Compose** (recommended for quickest setup)
- **Go 1.23+** (for local development)
- **Node.js 18+** (for frontend development)
- **PostgreSQL 16+** or SQLite (for metadata storage)

### 1. Clone Repository

```bash
git clone https://github.com/your-org/oreo.io.git
cd oreo.io
```

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Generate secure secrets
JWT_SECRET=$(openssl rand -base64 32)
ADMIN_PASSWORD="AdminSecure123!@#"

# Edit .env with your values
vi .env
```

**Minimum required configuration:**
```bash
JWT_SECRET=your_generated_32plus_character_secret_here
ADMIN_PASSWORD=YourSecure12PlusAdmin!Pass
DATABASE_URL=postgres://oreo:password@db:5432/oreo?sslmode=disable
PYTHON_SERVICE_URL=http://python-service:8000
```

### 3. Start Services

**Option A: Docker Compose (Recommended)**

```bash
# Create docker-compose configuration
cp docker-compose.dev.yml.example docker-compose.dev.yml
# Edit with your secrets

# Start all services
docker compose -f docker-compose.dev.yml up -d

# View logs
docker compose -f docker-compose.dev.yml logs -f
```

**Option B: Local Development**

```bash
# Terminal 1: Start PostgreSQL
docker run -d --name oreo-postgres \
  -e POSTGRES_USER=oreo \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 postgres:16-alpine

# Terminal 2: Start Python service
cd python-service
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Terminal 3: Start Go service
cd go-service
go run ./cmd/server

# Terminal 4: Start Frontend
cd frontend
npm install
npm run dev
```

### 4. Access Services

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://localhost:5173 | React application |
| **Go API** | http://localhost:8080 | Backend API |
| **Python API** | http://localhost:8000 | Data processing service |
| **API Docs** | http://localhost:8000/docs | FastAPI interactive docs |

### 5. First Login

```bash
# Default admin credentials (CHANGE IMMEDIATELY)
Email: admin@oreo.io
Password: <ADMIN_PASSWORD from .env>
```

---

## Architecture

Oreo.io follows **Clean Architecture** principles with clear separation of concerns:

```
┌─────────────────────────────────────┐
│  Frontend (React + Vite)            │
│  - User interface                   │
│  - Real-time updates                │
└──────────────┬──────────────────────┘
               │ HTTP/JSON
┌──────────────▼──────────────────────┐
│  Go Service (Gin Framework)         │
│  - Authentication & Authorization   │
│  - Project & Dataset Management     │
│  - Change Approval Workflows        │
│  - Audit Logging                    │
└──────────────┬──────────────────────┘
               │ HTTP
┌──────────────▼──────────────────────┐
│  Python Service (FastAPI)           │
│  - Delta Lake Operations            │
│  - Data Validation                  │
│  - PySpark Processing               │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  Storage Layer                      │
│  - Delta Lake (data versioning)     │
│  - PostgreSQL (metadata)            │
└─────────────────────────────────────┘
```

**For detailed architecture documentation, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**

---

## Project Structure

```
oreo.io_v3/
├── cmd/
│   └── server/              # Application entry point
│       └── main.go
├── internal/                # Private application code
│   ├── config/              # Configuration management
│   ├── errors/              # Error handling
│   ├── utils/               # Utility functions
│   ├── handlers/            # HTTP request handlers
│   ├── models/              # Domain models (GORM)
│   ├── storage/             # Storage adapters (Delta/Postgres)
│   ├── service/             # Business logic
│   └── database/            # Database layer & migrations
├── frontend/                # React application
├── python-service/          # FastAPI microservice
├── docs/                    # Documentation
│   ├── ARCHITECTURE.md      # System architecture
│   ├── API_REFERENCE.md     # API documentation
│   ├── SECURITY.md          # Security practices
│   └── DEVELOPER_GUIDE.md   # Development guide
├── .env.example             # Environment template
└── docker-compose.dev.yml.example
```

---

## Documentation

| Document | Description |
|----------|-------------|
| **[Architecture Guide](docs/ARCHITECTURE.md)** | System design, components, data flows |
| **[API Reference](docs/API_REFERENCE.md)** | Complete API endpoint documentation |
| **[Security Documentation](docs/SECURITY.md)** | Security practices, configuration, compliance |
| **[Developer Guide](docs/DEVELOPER_GUIDE.md)** | Setup, development workflow, testing |

---

## Key Features

### 1. Authentication & Authorization

- **JWT-based authentication** with secure token management
- **Role-Based Access Control (RBAC)** with Owner/Admin/Editor/Viewer roles
- **Google OAuth integration** for SSO
- **Session management** with configurable timeouts
- **Audit logging** for all authentication events

### 2. Project Management

- **Multi-tenant projects** with team collaboration
- **Member management** with granular permissions
- **Project-level configuration** and settings
- **Activity tracking** and notifications

### 3. Dataset Operations

- **Delta Lake backend** with ACID guarantees
- **CSV and Parquet support** for data imports
- **Schema inference** and validation
- **Time-travel queries** for historical data
- **Dataset versioning** with rollback capability

### 4. Change Approval Workflows

- **Structured approval process** for data modifications
- **Multi-step validation** (validation → approval → merge)
- **Change comments** and discussion threads
- **Automated notifications** for change events
- **Audit trail** for compliance

### 5. Query Interface

- **SQL query support** with security restrictions
- **Result pagination** and export
- **Query history** tracking
- **Performance optimization** with caching

---

## Security

Oreo.io implements defense-in-depth security:

✅ **Configuration Validation**: Application refuses to start with weak secrets  
✅ **Input Sanitization**: SQL injection prevention on all inputs  
✅ **Authentication**: JWT with secure token generation (32+ char secrets)  
✅ **Authorization**: RBAC with role-based permissions  
✅ **Audit Logging**: Complete audit trail of all actions  
✅ **Encryption**: Data encrypted at rest and in transit  
✅ **Password Security**: Bcrypt hashing with complexity requirements

**See [docs/SECURITY.md](docs/SECURITY.md) for comprehensive security documentation.**

---

## Development

### Running Tests

```bash
# Go tests
cd go-service
go test ./...

# Go tests with coverage
go test -cover ./...

# Frontend tests
cd frontend
npm test

# E2E tests (Playwright)
npm run test:e2e

# Python tests
cd python-service
pytest
```

### Building

```bash
# Build Go service
cd go-service
go build -o server ./cmd/server

# Build frontend
cd frontend
npm run build

# Build Docker images
docker compose -f docker-compose.dev.yml build
```

### Code Quality

```bash
# Format Go code
go fmt ./...

# Run Go linter
golangci-lint run

# Format TypeScript/React
cd frontend
npm run format

# Run ESLint
npm run lint
```

**See [docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md) for detailed development instructions.**

---

## Deployment

### Production Checklist

- [ ] Generate strong `JWT_SECRET` (32+ random characters)
- [ ] Set secure `ADMIN_PASSWORD` (12+ characters with complexity)
- [ ] Configure PostgreSQL with SSL (`sslmode=require`)
- [ ] Enable HTTPS with valid SSL certificate
- [ ] Set `COOKIE_SECURE=true`
- [ ] Configure CORS for production domains
- [ ] Set `ENV=production`
- [ ] Enable audit logging
- [ ] Configure backups
- [ ] Set up monitoring and alerts

**See [docs/SECURITY.md#deployment-security](docs/SECURITY.md#deployment-security) for complete deployment guide.**

---

## Contributing

We welcome contributions! Please see our contributing guidelines:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** following our code style
4. **Add tests** for new functionality
5. **Update documentation** if needed
6. **Run tests**: `go test ./... && npm test`
7. **Commit**: `git commit -m 'feat: add amazing feature'`
8. **Push**: `git push origin feature/amazing-feature`
9. **Create Pull Request**

**Code Style:**
- Go: [Effective Go](https://go.dev/doc/effective_go)
- TypeScript: [Airbnb Style Guide](https://github.com/airbnb/javascript)

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Backend** | Go 1.23 + Gin | REST API, authentication, orchestration |
| **Data Service** | Python 3.11 + FastAPI | Delta Lake operations, data processing |
| **Frontend** | React 18 + Vite + TypeScript | User interface |
| **Data Storage** | Delta Lake + PySpark | ACID-compliant data versioning |
| **Metadata** | PostgreSQL 16 / SQLite | Users, projects, metadata |
| **ORM** | GORM v2 | Database abstraction |
| **Auth** | JWT + bcrypt | Authentication & authorization |
| **Containerization** | Docker + Docker Compose | Local development & deployment |

---

## Performance

- **Delta Lake** provides ACID guarantees with high performance
- **Connection pooling** for database efficiency
- **Pagination** for large result sets
- **Async processing** for heavy operations
- **Caching** for frequently accessed data

---

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

## Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/your-org/oreo.io/issues)
- **Email**: support@oreo.io
- **Slack**: [Join our community](#)

---

## Roadmap

### Current Version (v3.0)

✅ Clean architecture implementation  
✅ Security hardening (config validation, SQL injection prevention)  
✅ Delta Lake integration  
✅ Approval workflows  
✅ Comprehensive documentation

### Upcoming

- [ ] Advanced query builder UI
- [ ] Data quality rules engine
- [ ] Real-time collaboration features
- [ ] Advanced analytics dashboard
- [ ] API rate limiting
- [ ] WebSocket support for real-time updates
- [ ] Multi-region deployment support

---

## Acknowledgments

Built with ❤️ using:
- [Go](https://go.dev/)
- [Gin Framework](https://gin-gonic.com/)
- [FastAPI](https://fastapi.tiangolo.com/)
- [React](https://react.dev/)
- [Delta Lake](https://delta.io/)
- [PostgreSQL](https://www.postgresql.org/)

---

**Ready to get started? See [docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md) for setup instructions!**
- Go service can be pointed to a file-based metadata DB with `METADATA_DB=/data/meta/oreo.db` (see compose) while Postgres remains for legacy paths.

Export existing Postgres tables to Delta (one-off):
```
pip install -r scripts/requirements-migrate.txt
python scripts/export_postgres_to_delta.py \
  --dsn postgresql://USER:PASS@HOST:5432/DB \
  --tables projects,datasets,users \
  --delta-root ./delta-data
```

Quick query of a Delta table via Python service:
```
curl -X POST http://localhost:8000/delta/query -H "Content-Type: application/json" \
  -d '{"table":"projects","limit":5}'
```

See `docs/delta_migration.md` for the overall plan and next steps.

## Admin

Admin base UI: `/admin_base` (password `ADMIN_PASSWORD`, default `admin123`).

### Admin Command Line (Delta Utilities)
Inside the Admin page, use the command box to inspect Delta storage:

Supported command:

`delta ls [path]` – Lists folders and Delta tables under `DELTA_DATA_ROOT` (default `/data/delta`). A directory is classified as `delta_table` if it contains a `_delta_log` subfolder.

Examples:
```
delta ls
delta ls project_42
```

Output columns: TYPE, NAME, PATH.