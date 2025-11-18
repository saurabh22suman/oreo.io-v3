# Developer Guide

**Version:** 3.0  
**Last Updated:** November 2025

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Project Structure](#project-structure)
3. [Development Workflow](#development-workflow)
4. [Building & Running](#building--running)
5. [Testing](#testing)
6. [Code Style & Standards](#code-style--standards)
7. [Database Management](#database-management)
8. [Common Development Tasks](#common-development-tasks)
9. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Prerequisites

**Required:**
- **Go 1.23+**: [Download](https://go.dev/dl/)
- **Node.js 18+**: [Download](https://nodejs.org/)
- **Docker & Docker Compose**: [Download](https://docs.docker.com/get-docker/)
- **Python 3.11+**: [Download](https://www.python.org/downloads/)

**Optional:**
- **Make**: For build automation
- **Git**: For version control
- **VS Code**: Recommended IDE

**System Requirements:**
- 8GB RAM minimum (16GB recommended)
- 10GB free disk space
- macOS, Linux, or Windows with WSL2

### Initial Setup

**1. Clone Repository:**
```bash
git clone https://github.com/your-org/oreo.io.git
cd oreo.io
```

**2. Configure Environment:**
```bash
# Copy example environment file
cp .env.example .env

# Generate secure secrets
JWT_SECRET=$(openssl rand -base64 32)
ADMIN_PASSWORD="AdminSecure123!@#"

# Edit .env file with real values
vi .env
```

**Required `.env` Configuration:**
```bash
# Security
JWT_SECRET=your_generated_32plus_character_secret_here
ADMIN_PASSWORD=YourSecure12PlusAdmin!Pass

# Database
DATABASE_URL=postgres://oreo:password@localhost:5432/oreo?sslmode=disable
# OR for SQLite development
METADATA_DB=./data/oreo.db

# Services
PYTHON_SERVICE_URL=http://localhost:8000

# Storage
DEFAULT_STORAGE_BACKEND=delta
DELTA_DATA_ROOT=./data/delta

# Server
PORT=8080
ENV=development
```

**3. Install Dependencies:**

**Backend (Go):**
```bash
cd go-service
go mod download
go mod tidy
```

**Frontend:**
```bash
cd frontend
npm install
```

**Python Service:**
```bash
cd python-service
pip install -r requirements.txt
# OR with virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

**4. Create Data Directories:**
```bash
mkdir -p data/delta data/meta
```

**5. Initialize Database:**
```bash
cd go-service
go run ./cmd/server  # Auto-runs migrations on first start
# OR manually
# psql -U oreo -d oreo -f internal/database/migrations/*.sql
```

---

## Project Structure

```
oreo.io_v3/
├── cmd/
│   └── server/
│       └── main.go              # Application entry point
├── internal/                     # Private application code
│   ├── config/                   # Configuration management
│   │   └── config.go
│   ├── errors/                   # Error handling
│   │   └── errors.go
│   ├── utils/                    # Utility functions
│   │   └── validation.go
│   ├── handlers/                 # HTTP request handlers
│   │   ├── router.go
│   │   ├── auth.go
│   │   ├── projects.go
│   │   ├── datasets.go
│   │   ├── changes.go
│   │   └── ...
│   ├── models/                   # Domain models (GORM)
│   │   ├── user.go
│   │   ├── project.go
│   │   ├── dataset.go
│   │   └── ...
│   ├── storage/                  # Storage adapters
│   │   ├── adapter.go            # Interface
│   │   ├── delta_adapter.go      # Delta Lake impl
│   │   └── postgres_adapter.go   # PostgreSQL impl
│   ├── service/                  # Business logic
│   │   └── worker.go             # Background jobs
│   └── database/                 # Database layer
│       ├── db.go
│       └── migrations/           # SQL migrations
├── frontend/                     # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── context/
│   │   └── App.tsx
│   └── package.json
├── python-service/               # Python microservice
│   ├── main.py
│   └── requirements.txt
├── docs/                         # Documentation
│   ├── ARCHITECTURE.md
│   ├── API_REFERENCE.md
│   ├── SECURITY.md
│   └── DEVELOPER_GUIDE.md
├── .env.example                  # Environment template
├── docker-compose.dev.yml.example
└── README.md
```

### Clean Architecture Layers

```
┌─────────────────────────────────────┐
│  cmd/server/main.go                 │  ← Entry Point
│  - Configuration loading             │
│  - Router setup                      │
│  - Graceful shutdown                 │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  internal/handlers/                 │  ← HTTP Layer
│  - HTTP request/response             │
│  - Input validation                  │
│  - Authentication/Authorization      │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  internal/service/                  │  ← Business Logic
│  - Domain operations                 │
│  - Business rules                    │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  internal/storage/                  │  ← Storage Layer
│  - Adapter pattern                   │
│  - Delta Lake / PostgreSQL           │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  internal/models/                   │  ← Data Models
│  - GORM models                       │
│  - Database entities                 │
└─────────────────────────────────────┘
```

---

## Development Workflow

### Local Development Setup

**Option 1: Docker Compose (Recommended)**

```bash
# Create docker-compose.dev.yml from template
cp docker-compose.dev.yml.example docker-compose.dev.yml
# Edit with real secrets

# Start all services
docker compose -f docker-compose.dev.yml up -d

# View logs
docker compose -f docker-compose.dev.yml logs -f

# Stop services
docker compose -f docker-compose.dev.yml down
```

**Option 2: Run Services Individually**

**Terminal 1 - PostgreSQL:**
```bash
docker run -d \
  --name oreo-postgres \
  -e POSTGRES_USER=oreo \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=oreo \
  -p 5432:5432 \
  postgres:16-alpine
```

**Terminal 2 - Python Service:**
```bash
cd python-service
source venv/bin/activate  # if using venv
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 3 - Go Service:**
```bash
cd go-service
go run ./cmd/server
# OR with live reload using air:
# air
```

**Terminal 4 - Frontend:**
```bash
cd frontend
npm run dev
```

### Development URLs

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:5173 | React dev server |
| Go API | http://localhost:8080 | Go backend API |
| Python API | http://localhost:8000 | Python FastAPI service |
| PostgreSQL | localhost:5432 | Database |

### Hot Reload Setup

**Go Service (using Air):**

```bash
# Install air
go install github.com/cosmtrek/air@latest

# Create .air.toml
cat > .air.toml <<EOF
root = "."
tmp_dir = "tmp"

[build]
  cmd = "go build -o ./tmp/server ./cmd/server"
  bin = "tmp/server"
  include_ext = ["go"]
  exclude_dir = ["tmp", "vendor"]
  delay = 1000

[log]
  time = true
EOF

# Run with hot reload
air
```

**Frontend (Vite built-in):**
```bash
npm run dev  # Auto-reloads on changes
```

---

## Building & Running

### Build Go Service

**Development Build:**
```bash
cd go-service
go build -o server ./cmd/server
./server
```

**Production Build:**
```bash
cd go-service
CGO_ENABLED=0 GOOS=linux go build \
  -ldflags="-s -w" \
  -o server \
  ./cmd/server
```

**With Docker:**
```bash
docker build -t oreo-go-service ./go-service
docker run -p 8080:8080 \
  --env-file .env \
  oreo-go-service
```

### Build Frontend

**Development:**
```bash
cd frontend
npm run dev
```

**Production Build:**
```bash
cd frontend
npm run build
# Output in frontend/dist/
```

**Preview Production Build:**
```bash
npm run preview
```

### Running Tests

**Go Tests:**
```bash
cd go-service

# Run all tests
go test ./...

# Run specific package
go test ./internal/handlers

# Run with coverage
go test -cover ./...

# Generate coverage report
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

**Frontend Tests:**
```bash
cd frontend

# Run unit tests
npm test

# Run E2E tests (Playwright)
npm run test:e2e

# Run specific test file
npm test -- auth.spec.ts
```

**Python Tests:**
```bash
cd python-service
pytest
# OR with coverage
pytest --cov=. --cov-report=html
```

---

## Testing

### Unit Tests

**Go Example:**
```go
// internal/handlers/auth_test.go
package handlers

import (
    "testing"
    "github.com/stretchr/testify/assert"
)

func TestValidatePassword(t *testing.T) {
    tests := []struct {
        name     string
        password string
        wantErr  bool
    }{
        {"valid password", "SecurePass123!", false},
        {"too short", "Short1!", true},
        {"no uppercase", "securepass123!", true},
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            err := ValidatePassword(tt.password)
            if tt.wantErr {
                assert.Error(t, err)
            } else {
                assert.NoError(t, err)
            }
        })
    }
}
```

### Integration Tests

**Go Example:**
```go
// internal/handlers/projects_test.go
func TestCreateProject(t *testing.T) {
    // Setup test database
    db := setupTestDB(t)
    defer db.Close()
    
    // Create test router
    router := setupTestRouter(db)
    
    // Make request
    body := `{"name": "Test Project"}`
    req := httptest.NewRequest("POST", "/projects", strings.NewReader(body))
    req.Header.Set("Content-Type", "application/json")
    w := httptest.NewRecorder()
    
    router.ServeHTTP(w, req)
    
    // Assert response
    assert.Equal(t, 201, w.Code)
    
    var response map[string]interface{}
    json.Unmarshal(w.Body.Bytes(), &response)
    assert.Equal(t, "Test Project", response["name"])
}
```

### E2E Tests (Playwright)

**Frontend Example:**
```typescript
// frontend/tests/auth.spec.ts
import { test, expect } from '@playwright/test';

test('user can register and login', async ({ page }) => {
  // Navigate to register page
  await page.goto('/register');
  
  // Fill registration form
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'SecurePass123!');
  await page.click('button[type="submit"]');
  
  // Should redirect to dashboard
  await expect(page).toHaveURL('/dashboard');
  
  // Verify user is logged in
  await expect(page.locator('text=test@example.com')).toBeVisible();
});
```

**Run E2E Tests:**
```bash
cd frontend
npm run test:e2e
# OR with UI
npm run test:e2e -- --ui
```

### Test Coverage Goals

| Component | Target Coverage |
|-----------|----------------|
| Handlers | 80%+ |
| Models | 70%+ |
| Storage | 75%+ |
| Utils | 90%+ |
| Overall | 75%+ |

---

## Code Style & Standards

### Go Style Guide

**Follow:**
- [Effective Go](https://go.dev/doc/effective_go)
- [Go Code Review Comments](https://github.com/golang/go/wiki/CodeReviewComments)
- [Uber Go Style Guide](https://github.com/uber-go/guide/blob/master/style.md)

**Key Conventions:**

**1. Naming:**
```go
// Package names: lowercase, no underscores
package handlers

// Exported: PascalCase
type UserService struct {}

// Unexported: camelCase
func validateInput() error {}

// Constants: PascalCase
const MaxUploadSize = 100 * 1024 * 1024
```

**2. Error Handling:**
```go
// ✓ CORRECT: Check errors immediately
result, err := doSomething()
if err != nil {
    return fmt.Errorf("failed to do something: %w", err)
}

// ✗ WRONG: Ignore errors
result, _ := doSomething()
```

**3. Context:**
```go
// ✓ CORRECT: Pass context as first parameter
func ProcessData(ctx context.Context, data []byte) error {
    // ...
}

// ✗ WRONG: Context as field
type Service struct {
    ctx context.Context  // BAD!
}
```

**4. Comments:**
```go
// ✓ CORRECT: Full sentence, package-level doc
// Package handlers implements HTTP request handlers for the Oreo API.
package handlers

// CreateProject handles POST /projects to create a new project.
// It validates user permissions and initializes default settings.
func CreateProject(c *gin.Context) {
    // ...
}
```

### TypeScript/React Style

**Follow:**
- [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)

**Key Conventions:**

**1. Component Structure:**
```typescript
// src/components/ProjectCard.tsx
import React from 'react';

interface ProjectCardProps {
  project: Project;
  onDelete?: (id: number) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, onDelete }) => {
  return (
    <div className="project-card">
      <h3>{project.name}</h3>
      {onDelete && (
        <button onClick={() => onDelete(project.id)}>Delete</button>
      )}
    </div>
  );
};
```

**2. Hooks:**
```typescript
// ✓ CORRECT: Custom hooks start with "use"
const useProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  
  useEffect(() => {
    fetchProjects().then(setProjects);
  }, []);
  
  return projects;
};
```

### Linting & Formatting

**Go:**
```bash
# Format code
go fmt ./...

# Run linter
golangci-lint run

# OR use gofmt + goimports
gofmt -s -w .
goimports -w .
```

**TypeScript/React:**
```bash
# Format with Prettier
npm run format

# Lint with ESLint
npm run lint

# Fix lint issues
npm run lint:fix
```

### Git Workflow

**Branch Naming:**
```
feature/<ticket-id>-<short-description>
bugfix/<ticket-id>-<short-description>
hotfix/<critical-issue>
```

**Example:**
```bash
git checkout -b feature/OREO-123-add-dataset-versioning
```

**Commit Messages:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting (no code change)
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Build tasks, configs

**Example:**
```
feat(datasets): add versioning support

Implemented dataset versioning with Delta Lake.
Users can now rollback to previous versions.

Closes OREO-123
```

---

## Database Management

### Migrations

**Location:**
```
go-service/internal/database/migrations/
├── 001_create_user_sessions.sql
├── 002_create_audit_logs.sql
└── ...
```

**Creating a Migration:**

**1. Create SQL file:**
```bash
cd go-service/internal/database/migrations
touch 010_add_dataset_tags.sql
```

**2. Write migration:**
```sql
-- 010_add_dataset_tags.sql

-- Up migration
CREATE TABLE IF NOT EXISTS dataset_tags (
    id SERIAL PRIMARY KEY,
    dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    tag VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(dataset_id, tag)
);

CREATE INDEX idx_dataset_tags_dataset_id ON dataset_tags(dataset_id);
CREATE INDEX idx_dataset_tags_tag ON dataset_tags(tag);

-- Down migration (optional, in separate file)
-- DROP TABLE IF EXISTS dataset_tags;
```

**3. Run migration:**
```bash
# Migrations run automatically on server start
go run ./cmd/server

# OR manually
psql -U oreo -d oreo -f internal/database/migrations/010_add_dataset_tags.sql
```

### Database Backup

**PostgreSQL:**
```bash
# Backup
pg_dump -U oreo -d oreo > backup_$(date +%Y%m%d).sql

# Restore
psql -U oreo -d oreo < backup_20250118.sql
```

**SQLite:**
```bash
# Backup
sqlite3 data/oreo.db .dump > backup_$(date +%Y%m%d).sql

# Restore
sqlite3 data/oreo.db < backup_20250118.sql
```

### Database Seeding

**Create seed data:**
```go
// internal/database/seed.go
package database

func SeedDevelopmentData() error {
    db := Get()
    
    // Create admin user
    admin := models.User{
        Email:    "admin@example.com",
        Password: hashPassword("Admin123!"),
        Role:     "admin",
    }
    db.Create(&admin)
    
    // Create test project
    project := models.Project{
        Name:        "Test Project",
        Description: "Development testing project",
        OwnerID:     admin.ID,
    }
    db.Create(&project)
    
    return nil
}
```

**Run seeder:**
```bash
# Add flag to main.go
go run ./cmd/server --seed
```

---

## Common Development Tasks

### Adding a New API Endpoint

**1. Define route in `internal/handlers/router.go`:**
```go
func SetupRouter() *gin.Engine {
    // ... existing code
    
    // Add new route
    r.POST("/api/datasets/:id/tags", AuthMiddleware(), AddDatasetTag)
}
```

**2. Create handler in appropriate file:**
```go
// internal/handlers/datasets.go

// AddDatasetTag handles POST /datasets/:id/tags
// @Summary Add tag to dataset
// @Tags datasets
// @Accept json
// @Produce json
// @Param id path int true "Dataset ID"
// @Param tag body string true "Tag name"
// @Success 201 {object} DatasetTag
// @Router /datasets/{id}/tags [post]
func AddDatasetTag(c *gin.Context) {
    // 1. Parse parameters
    datasetID, _ := strconv.Atoi(c.Param("id"))
    
    var req struct {
        Tag string `json:"tag" binding:"required"`
    }
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    
    // 2. Validate authorization
    userID := c.GetUint("user_id")
    if !hasDatasetPermission(userID, datasetID) {
        c.JSON(403, gin.H{"error": "insufficient permissions"})
        return
    }
    
    // 3. Business logic
    tag := models.DatasetTag{
        DatasetID: datasetID,
        Tag:       req.Tag,
    }
    
    db := database.Get()
    if err := db.Create(&tag).Error; err != nil {
        c.JSON(500, gin.H{"error": "failed to create tag"})
        return
    }
    
    // 4. Return response
    c.JSON(201, tag)
}
```

**3. Add test:**
```go
// internal/handlers/datasets_test.go
func TestAddDatasetTag(t *testing.T) {
    // ... test implementation
}
```

**4. Update documentation:**
- Add endpoint to `docs/API_REFERENCE.md`

### Adding a New Model

**1. Create model file:**
```go
// internal/models/dataset_tag.go
package models

import "time"

type DatasetTag struct {
    ID        uint      `gorm:"primaryKey" json:"id"`
    DatasetID uint      `gorm:"not null;index" json:"dataset_id"`
    Tag       string    `gorm:"size:50;not null" json:"tag"`
    CreatedAt time.Time `json:"created_at"`
    
    // Relationships
    Dataset Dataset `gorm:"foreignKey:DatasetID" json:"-"`
}

func (DatasetTag) TableName() string {
    return "dataset_tags"
}
```

**2. Register for auto-migration:**
```go
// internal/database/db.go
func Init() error {
    // ... existing code
    
    // Auto-migrate tables
    err = gdb.AutoMigrate(
        &models.User{},
        &models.Project{},
        // ... existing models
        &models.DatasetTag{},  // ADD HERE
    )
}
```

**3. Create migration (optional, for production):**
```sql
-- internal/database/migrations/010_add_dataset_tags.sql
CREATE TABLE dataset_tags (
    id SERIAL PRIMARY KEY,
    dataset_id INTEGER NOT NULL REFERENCES datasets(id),
    tag VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Adding Configuration Option

**1. Add to config struct:**
```go
// internal/config/config.go
type Config struct {
    // ... existing fields
    
    // New option
    EnableAnalytics bool `env:"ENABLE_ANALYTICS" default:"false"`
}
```

**2. Update `.env.example`:**
```bash
# Analytics
ENABLE_ANALYTICS=false
```

**3. Use in code:**
```go
cfg := config.Get()
if cfg.EnableAnalytics {
    trackEvent("user_login")
}
```

### Debugging

**Enable Debug Logging:**
```bash
# .env
ENV=development
LOG_LEVEL=debug
```

**Use Delve Debugger:**
```bash
# Install delve
go install github.com/go-delve/delve/cmd/dlv@latest

# Start debugger
dlv debug ./cmd/server

# Set breakpoint
(dlv) break internal/handlers/auth.go:42
(dlv) continue
```

**VS Code Debug Configuration:**
```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Launch Go Service",
      "type": "go",
      "request": "launch",
      "mode": "debug",
      "program": "${workspaceFolder}/go-service/cmd/server",
      "env": {
        "JWT_SECRET": "your-secret-here"
      }
    }
  ]
}
```

---

## Troubleshooting

### Common Issues

**Issue: `config validation failed: JWT_SECRET must be at least 32 characters`**
```bash
# Solution: Generate proper secret
export JWT_SECRET=$(openssl rand -base64 32)
```

**Issue: `dial tcp :5432: connect: connection refused`**
```bash
# Solution: Start PostgreSQL
docker start oreo-postgres
# OR
docker compose -f docker-compose.dev.yml up -d postgres
```

**Issue: `port 8080 already in use`**
```bash
# Solution: Find and kill process
lsof -i :8080
kill -9 <PID>
# OR change port in .env
PORT=8081
```

**Issue: `node_modules not found`**
```bash
# Solution: Install dependencies
cd frontend
npm install
```

**Issue: Build fails with import errors**
```bash
# Solution: Update module cache
go mod tidy
go clean -modcache
go mod download
```

### Getting Help

**Documentation:**
- [Architecture](./ARCHITECTURE.md)
- [API Reference](./API_REFERENCE.md)
- [Security](./SECURITY.md)

**Community:**
- Slack: #oreo-dev
- GitHub Issues: https://github.com/your-org/oreo.io/issues

**Maintainers:**
- Lead: lead@example.com
- Backend: backend@example.com
- Frontend: frontend@example.com

---

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution guidelines.

**Quick Checklist:**
- [ ] Code follows style guide
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Commit messages follow convention
- [ ] Branch created from `main`
- [ ] PR description includes context

---

## Next Steps

1. **Complete Setup:** Ensure all prerequisites installed and services running
2. **Explore Codebase:** Start with `cmd/server/main.go` and follow imports
3. **Read Architecture:** Understand system design in [ARCHITECTURE.md](./ARCHITECTURE.md)
4. **Run Tests:** Verify everything works: `go test ./... && npm test`
5. **Make Changes:** Pick an issue and start coding!

---

Happy coding! 🚀
