# Oreo.io Architecture Documentation

**Version:** 3.0  
**Last Updated:** November 2025

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Principles](#architecture-principles)
3. [Project Structure](#project-structure)
4. [Component Architecture](#component-architecture)
5. [Data Flow](#data-flow)
6. [Storage Architecture](#storage-architecture)
7. [Security Architecture](#security-architecture)
8. [Technology Stack](#technology-stack)
9. [Design Decisions](#design-decisions)

---

## System Overview

Oreo.io is a collaborative data management platform that enables teams to manage datasets with version control, approval workflows, and role-based access control. The system follows a microservices architecture with three main components:

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Frontend  │────▶│  Go Service  │────▶│ Python Service  │
│  (React)    │     │   (API)      │     │  (Delta Lake)   │
└─────────────┘     └──────────────┘     └─────────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │  PostgreSQL  │
                    │  (Metadata)  │
                    └──────────────┘
```

### Key Features

- **Dataset Management:** Create, update, and version datasets
- **Approval Workflows:** Submit data changes for review before applying
- **Role-Based Access Control:** Fine-grained permissions at project level
- **Delta Lake Integration:** Versioned, ACID-compliant data storage
- **Query Interface:** SQL queries on datasets with sandboxing
- **Audit Logging:** Complete audit trail of all changes

---

## Architecture Principles

### 1. Clean Architecture

The codebase follows clean architecture principles with clear separation of concerns:

- **Presentation Layer** (`internal/handlers/`) - HTTP handlers and routing
- **Business Logic** (`internal/service/`) - Core business rules
- **Data Access** (`internal/models/`, `internal/database/`) - Database operations
- **External Services** (`internal/storage/`) - Storage adapter abstractions

### 2. Dependency Inversion

All dependencies point inward. External services (storage, databases) are abstracted behind interfaces, allowing easy testing and replacement.

### 3. Security by Default

- All environment variables validated at startup
- Fail-fast on misconfiguration
- Input sanitization on all user inputs
- SQL injection prevention
- No hardcoded secrets

### 4. Scalability

- Stateless API design
- Adapter pattern for storage backends
- Background job processing
- Horizontal scaling support

---

## Project Structure

```
go-service/
├── cmd/
│   └── server/
│       └── main.go                 # Application entry point
│
├── internal/                       # Private application code
│   ├── config/                     # Configuration management
│   │   └── config.go              # Centralized config with validation
│   │
│   ├── errors/                     # Error handling
│   │   └── errors.go              # Structured error types
│   │
│   ├── utils/                      # Shared utilities
│   │   └── validation.go          # Input validation & sanitization
│   │
│   ├── handlers/                   # HTTP request handlers
│   │   ├── router.go              # Main router setup
│   │   ├── auth.go                # Authentication endpoints
│   │   ├── admin.go               # Admin endpoints
│   │   ├── datasets.go            # Dataset CRUD operations
│   │   ├── changes.go             # Change request workflows
│   │   ├── projects.go            # Project management
│   │   ├── members.go             # Project membership
│   │   ├── query.go               # Query execution
│   │   ├── security.go            # Security & governance
│   │   ├── user_settings.go       # User preferences
│   │   └── ...
│   │
│   ├── models/                     # Domain models (database entities)
│   │   ├── user.go
│   │   ├── project.go
│   │   ├── dataset.go
│   │   ├── changerequest.go
│   │   └── ...
│   │
│   ├── service/                    # Business logic & background services
│   │   └── worker.go              # Background job processor
│   │
│   ├── storage/                    # Storage adapters
│   │   ├── adapter.go             # Storage interface
│   │   ├── delta_adapter.go       # Delta Lake implementation
│   │   └── postgres_adapter.go    # PostgreSQL implementation
│   │
│   └── database/                   # Database access layer
│       ├── db.go                  # Database connection management
│       └── migrations/            # SQL migration scripts
│           ├── 001_create_user_sessions.sql
│           ├── 002_create_audit_logs.sql
│           └── ...
│
├── tests/                          # Integration & E2E tests
│   ├── e2e_delta_integration_test.go
│   └── storage_backend_selection_test.go
│
├── static/                         # Static web assets
│   └── ...
│
├── Dockerfile                      # Container build definition
├── go.mod                          # Go module dependencies
└── go.sum                          # Dependency checksums
```

### Directory Conventions

- **`cmd/`** - Application entry points (binaries)
- **`internal/`** - Private application code (cannot be imported by external projects)
- **`tests/`** - Integration and end-to-end tests
- **`static/`** - Static files served by the application

---

## Component Architecture

### 1. API Layer (`internal/handlers/`)

The API layer handles HTTP requests and responses. All handlers follow this pattern:

```go
func HandlerName(c *gin.Context) {
    // 1. Extract and validate input
    var payload RequestType
    if err := c.ShouldBindJSON(&payload); err != nil {
        c.JSON(400, gin.H{"error": "invalid_input"})
        return
    }
    
    // 2. Authenticate and authorize
    userID, _ := c.Get("user_id")
    if !hasPermission(userID, resource) {
        c.JSON(403, gin.H{"error": "forbidden"})
        return
    }
    
    // 3. Execute business logic
    result, err := service.DoSomething(payload)
    if err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    // 4. Return response
    c.JSON(200, result)
}
```

**Key Patterns:**
- Input validation at the boundary
- Consistent error responses
- Context propagation
- Middleware for cross-cutting concerns

### 2. Configuration Layer (`internal/config/`)

Centralized configuration management with validation:

```go
type Config struct {
    Port              string
    JWTSecret         string  // Min 32 characters (enforced)
    AdminPassword     string  // Min 12 characters (enforced)
    DatabaseURL       string
    PythonServiceURL  string
    DeltaDataRoot     string
    // ... more fields
}

func (c *Config) Validate() error {
    if len(c.JWTSecret) < 32 {
        return errors.New("JWT_SECRET must be at least 32 characters")
    }
    // ... more validations
}
```

**Benefits:**
- Type-safe configuration access
- Fail-fast on invalid config
- Single source of truth
- Easy testing with mock configs

### 3. Storage Layer (`internal/storage/`)

Abstract storage operations behind interfaces for flexibility:

```go
type StorageAdapter interface {
    Query(ctx context.Context, req QueryRequest) (QueryResult, error)
    Insert(ctx context.Context, req InsertRequest) error
    Update(ctx context.Context, req UpdateRequest) error
    Delete(ctx context.Context, req DeleteRequest) error
}

// Implementations:
// - DeltaAdapter: Uses Python FastAPI service for Delta Lake
// - PostgresAdapter: Direct PostgreSQL operations
```

**Adapter Pattern Benefits:**
- Easy to switch storage backends
- Testable with mock adapters
- Backend-specific optimizations
- Gradual migration support

### 4. Database Layer (`internal/database/`)

Database connection management and migrations:

```go
// db.go
func Init() (*gorm.DB, error) {
    cfg := config.Get()
    
    // Support both PostgreSQL and SQLite
    if strings.Contains(cfg.MetadataDB, ".db") {
        return gorm.Open(sqlite.Open(cfg.MetadataDB), &gorm.Config{})
    }
    return gorm.Open(postgres.Open(cfg.DatabaseURL), &gorm.Config{})
}
```

**Features:**
- Automatic migrations on startup
- Connection pooling
- Retry logic for startup races
- Support for multiple databases (Postgres/SQLite)

### 5. Models Layer (`internal/models/`)

Domain models represent database entities:

```go
type Dataset struct {
    ID              uint   `gorm:"primaryKey"`
    ProjectID       uint   `gorm:"not null"`
    Name            string `gorm:"not null"`
    Schema          string
    StorageBackend  string `gorm:"default:delta"`
    CreatedAt       time.Time
    UpdatedAt       time.Time
}
```

**Conventions:**
- GORM tags for database mapping
- JSON tags for API serialization
- Validation tags for input validation
- Relationships defined via foreign keys

---

## Data Flow

### 1. Dataset Creation Flow

```
User Request
    │
    ▼
┌───────────────────┐
│  POST /datasets   │  Handler validates input
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│   Create Dataset  │  Insert into metadata DB
│   Record          │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│   Initialize      │  Call Python service or
│   Storage Table   │  execute CREATE TABLE
└─────────┬─────────┘
          │
          ▼
      Response
```

### 2. Approval Workflow

```
Editor                          Reviewer
  │                                │
  │ 1. Upload File                 │
  ├──────────────────────────────▶│
  │                                │
  │ 2. Submit for Review           │
  │    (Create ChangeRequest)      │
  ├──────────────────────────────▶│
  │                                │
  │                           3. Review
  │                           ┌────┴────┐
  │                           │         │
  │                        Approve   Reject
  │                           │         │
  │ 4. Apply Changes          │         │
  │◀──────────────────────────┤         │
  │                           │         │
  │ 5. Notify Rejection       │         │
  │◀──────────────────────────┘         │
  │                                      │
```

**States:**
- `pending` - Awaiting review
- `approved` - Approved and applied
- `rejected` - Rejected with reason
- `withdrawn` - Withdrawn by requester

### 3. Query Execution Flow

```
User Query
    │
    ▼
┌───────────────────┐
│  Validate SQL     │  Check for dangerous patterns
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Authorize        │  Verify project access
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Route to         │  Delta → Python Service
│  Storage Adapter  │  Postgres → Direct SQL
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Execute Query    │  With timeout & limits
└─────────┬─────────┘
          │
          ▼
      Results
```

---

## Storage Architecture

### Dual Storage Support

Oreo.io supports two storage backends:

#### 1. Delta Lake (Recommended)

- **Format:** Apache Parquet with Delta Lake transaction log
- **Location:** `/data/delta/<dataset_id>/`
- **Access:** Via Python FastAPI service
- **Features:**
  - ACID transactions
  - Time travel (versioning)
  - Schema evolution
  - Efficient parquet columnar storage

#### 2. PostgreSQL

- **Tables:** Dynamic tables `ds_<dataset_id>`
- **Format:** JSONB columns for flexibility
- **Access:** Direct GORM queries
- **Features:**
  - SQL queries
  - Relational integrity
  - Full-text search

### Storage Adapter Selection

```go
// Configured via environment variable
DEFAULT_STORAGE_BACKEND=delta  // or "postgres"

// Runtime adapter selection
adapter := storage.NewAdapter(cfg.DefaultStorageBackend)
```

### Data Storage Locations

```
delta-data/
├── 1/                      # Dataset ID 1
│   ├── _delta_log/        # Transaction log
│   ├── part-00000.parquet
│   └── part-00001.parquet
├── 2/                      # Dataset ID 2
│   └── ...
└── ...

metadata/                   # SQLite for development
└── oreo.db                # or PostgreSQL in production
```

---

## Security Architecture

### 1. Authentication

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ POST /auth/login
       │ {email, password}
       ▼
┌─────────────┐
│  Validate   │──▶ Bcrypt password check
│ Credentials │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Generate   │──▶ JWT with user_id, email, role
│  JWT Token  │    Signed with JWT_SECRET (32+ chars)
└──────┬──────┘
       │
       ▼
   Set Cookie
   (HttpOnly, Secure)
```

**Token Contents:**
```json
{
  "user_id": 1,
  "email": "user@example.com",
  "role": "user",
  "exp": 1705000000
}
```

### 2. Authorization (RBAC)

```
Project Level Roles:

┌─────────┐  Full Control
│  Owner  │─────────────────────────┐
└─────────┘                         │
                                    ▼
┌─────────┐  Manage Members    ┌─────────┐
│  Admin  │──────────────────▶ │ Project │
└─────────┘                    └─────────┘
                                    ▲
┌─────────┐  Create/Modify          │
│ Editor  │─────────────────────────┤
└─────────┘                         │
                                    │
┌─────────┐  Read Only              │
│ Viewer  │─────────────────────────┘
└─────────┘
```

**Permission Matrix:**

| Action              | Owner | Admin | Editor | Viewer |
|---------------------|-------|-------|--------|--------|
| Delete Project      | ✓     | ✗     | ✗      | ✗      |
| Manage Members      | ✓     | ✓     | ✗      | ✗      |
| Delete Datasets     | ✓     | ✓     | ✗      | ✗      |
| Approve Changes     | ✓     | ✓     | ✗      | ✗      |
| Create Datasets     | ✓     | ✓     | ✓      | ✗      |
| Submit Changes      | ✓     | ✓     | ✓      | ✗      |
| Query Data          | ✓     | ✓     | ✓      | ✓      |
| View Projects       | ✓     | ✓     | ✓      | ✓      |

### 3. Input Validation

All user inputs are validated to prevent attacks:

```go
// SQL Injection Prevention
func ValidateTableName(name string) error {
    // Only allow alphanumeric and underscore
    if !regexp.MustCompile(`^[a-zA-Z][a-zA-Z0-9_]*$`).MatchString(name) {
        return errors.New("invalid table name")
    }
    
    // Block SQL reserved keywords
    reserved := []string{"SELECT", "INSERT", "UPDATE", "DELETE", "DROP", ...}
    if contains(reserved, strings.ToUpper(name)) {
        return errors.New("table name cannot be SQL keyword")
    }
    
    return nil
}

// Email Validation
func ValidateEmail(email string) error {
    // RFC-compliant regex pattern
    pattern := `^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`
    if !regexp.MustCompile(pattern).MatchString(email) {
        return errors.New("invalid email format")
    }
    return nil
}

// Password Strength
func ValidatePassword(password string) error {
    if len(password) < 8 {
        return errors.New("password must be at least 8 characters")
    }
    
    checks := []struct {
        pattern string
        message string
    }{
        {`[A-Z]`, "uppercase letter"},
        {`[a-z]`, "lowercase letter"},
        {`[0-9]`, "digit"},
        {`[!@#$%^&*(),.?":{}|<>]`, "special character"},
    }
    
    for _, check := range checks {
        if !regexp.MustCompile(check.pattern).MatchString(password) {
            return fmt.Errorf("password must contain at least one %s", check.message)
        }
    }
    
    return nil
}
```

### 4. Configuration Security

```go
// Validated at startup - application fails fast
func (c *Config) Validate() error {
    if len(c.JWTSecret) < 32 {
        return errors.New("JWT_SECRET must be at least 32 characters")
    }
    
    if len(c.AdminPassword) < 12 {
        return errors.New("ADMIN_PASSWORD must be at least 12 characters")
    }
    
    if err := ValidatePassword(c.AdminPassword); err != nil {
        return fmt.Errorf("ADMIN_PASSWORD: %w", err)
    }
    
    return nil
}
```

**Security Requirements:**
- JWT_SECRET: Minimum 32 characters
- ADMIN_PASSWORD: Minimum 12 characters with complexity
- No hardcoded secrets in code
- .env files in .gitignore
- .env.example as template only

---

## Technology Stack

### Backend (Go Service)

| Technology | Purpose | Version |
|-----------|---------|---------|
| Go | Primary language | 1.23+ |
| Gin | HTTP framework | Latest |
| GORM | ORM & migrations | v2 |
| JWT-Go | JWT handling | v4 |
| Bcrypt | Password hashing | Latest |
| PostgreSQL | Metadata storage | 16+ |
| SQLite | Dev/test metadata | 3.x |

### Data Layer (Python Service)

| Technology | Purpose | Version |
|-----------|---------|---------|
| Python | Data processing | 3.11+ |
| FastAPI | HTTP framework | Latest |
| Delta-Spark | Delta Lake access | Latest |
| PySpark | Data processing | 3.5+ |
| Pandas | Data manipulation | Latest |

### Frontend

| Technology | Purpose | Version |
|-----------|---------|---------|
| React | UI framework | 18+ |
| TypeScript | Type safety | 5+ |
| Vite | Build tool | Latest |
| TailwindCSS | Styling | 3+ |
| React Query | Data fetching | 4+ |

### Infrastructure

| Technology | Purpose |
|-----------|---------|
| Docker | Containerization |
| Docker Compose | Local orchestration |
| Nginx | Frontend serving |
| PostgreSQL | Metadata database |

---

## Design Decisions

### 1. Why Clean Architecture?

**Problem:** Original codebase had mixed concerns with business logic in controllers.

**Solution:** Separated into layers:
- `cmd/` - Entry points
- `internal/handlers/` - HTTP layer
- `internal/service/` - Business logic
- `internal/models/` - Domain entities
- `internal/storage/` - External services

**Benefits:**
- Easier testing (mock interfaces)
- Better maintainability
- Clear boundaries
- Reusable components

### 2. Why Centralized Configuration?

**Problem:** Scattered `os.Getenv()` calls, no validation, hardcoded defaults.

**Solution:** Single `config` package with validation:
```go
cfg := config.MustLoad()  // Fails if invalid
jwtSecret := cfg.JWTSecret  // Type-safe access
```

**Benefits:**
- Fail-fast on misconfiguration
- Type-safe access
- Easy testing with mock configs
- Single source of truth

### 3. Why Dual Storage (Delta + Postgres)?

**Problem:** Need both flexibility (Delta) and SQL (Postgres).

**Solution:** Adapter pattern with runtime selection:
```go
adapter := storage.NewAdapter(cfg.DefaultStorageBackend)
```

**Benefits:**
- Gradual migration support
- Different backends for different use cases
- Easy to add new backends
- Backend-specific optimizations

### 4. Why Approval Workflows?

**Problem:** Direct data changes can introduce errors in production datasets.

**Solution:** Two-step process:
1. Editor submits change (creates ChangeRequest)
2. Reviewer approves/rejects

**Benefits:**
- Data quality control
- Audit trail
- Collaborative review
- Prevent accidental changes

### 5. Why JWT over Sessions?

**Problem:** Sessions require server-side storage and don't scale horizontally.

**Solution:** Stateless JWT tokens:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Benefits:**
- Stateless (horizontal scaling)
- No session storage needed
- Can be validated by any instance
- Contains user context

**Trade-offs:**
- Cannot revoke before expiration (use short expiry + refresh)
- Slightly larger than session IDs

### 6. Why Gin over net/http?

**Problem:** Standard library is verbose for REST APIs.

**Solution:** Gin framework with middleware support:
```go
r.Use(AuthMiddleware())
r.GET("/api/projects", ProjectsList)
```

**Benefits:**
- Router with parameter extraction
- Middleware support
- JSON binding/validation
- Better performance
- Active community

### 7. Why GORM over SQL?

**Problem:** Raw SQL is verbose and error-prone.

**Solution:** GORM ORM with auto-migrations:
```go
gdb.AutoMigrate(&models.User{})
gdb.Where("email = ?", email).First(&user)
```

**Benefits:**
- Type-safe queries
- Automatic migrations
- Relationship handling
- Reduced boilerplate

**Trade-offs:**
- Less control over SQL
- Performance overhead (acceptable for metadata)

---

## Performance Considerations

### 1. Database Connection Pooling

```go
// Automatic connection pooling via GORM
sqlDB, _ := gdb.DB()
sqlDB.SetMaxIdleConns(10)
sqlDB.SetMaxOpenConns(100)
sqlDB.SetConnMaxLifetime(time.Hour)
```

### 2. Query Limits

All queries have default limits to prevent resource exhaustion:
```go
const DefaultLimit = 100
const MaxLimit = 1000
```

### 3. File Upload Limits

```go
const maxUploadBytes = 100 * 1024 * 1024 // 100 MB
r.MaxMultipartMemory = 110 << 20
```

### 4. Background Processing

Long-running operations (schema inference) are handled asynchronously:
```go
// Create job record
job := &models.Job{Type: "infer-schema", Status: "pending"}
gdb.Create(&job)

// Worker picks it up in background
services.StartWorker(2 * time.Second)
```

---

## Testing Strategy

### 1. Unit Tests

Test individual functions in isolation:
```go
func TestValidateEmail(t *testing.T) {
    tests := []struct{
        input string
        valid bool
    }{
        {"user@example.com", true},
        {"invalid", false},
    }
    
    for _, tt := range tests {
        err := ValidateEmail(tt.input)
        if (err == nil) != tt.valid {
            t.Errorf("ValidateEmail(%q) = %v, want %v", tt.input, err == nil, tt.valid)
        }
    }
}
```

### 2. Integration Tests

Test component interactions:
```go
func TestAuthFlow(t *testing.T) {
    setupTestDB(t)
    r := handlers.SetupRouter()
    
    // Register
    w := httptest.NewRecorder()
    req := httptest.NewRequest("POST", "/api/auth/register", body)
    r.ServeHTTP(w, req)
    
    assert.Equal(t, 200, w.Code)
}
```

### 3. E2E Tests

Test complete user workflows:
```go
func TestDatasetCreationAndQuery(t *testing.T) {
    // 1. Create project
    // 2. Create dataset
    // 3. Upload data
    // 4. Query data
    // 5. Verify results
}
```

---

## Deployment Architecture

### Development

```
docker-compose.dev.yml:
- go-service (port 8081)
- python-service (port 8000)
- frontend (port 5173)
- db (port 5432)
```

### Production (Recommended)

```
┌─────────────┐
│   CDN/WAF   │
└──────┬──────┘
       │
┌──────▼──────┐
│ Load        │
│ Balancer    │
└──────┬──────┘
       │
       ├──────────────┬──────────────┐
       │              │              │
┌──────▼──────┐ ┌────▼─────┐ ┌──────▼──────┐
│ Go Service  │ │ Go Svc   │ │ Go Service  │
│ Instance 1  │ │ Inst 2   │ │ Instance 3  │
└──────┬──────┘ └────┬─────┘ └──────┬──────┘
       │              │              │
       └──────────────┴──────────────┘
                      │
       ┌──────────────┼──────────────┐
       │              │              │
┌──────▼──────┐ ┌────▼─────┐ ┌──────▼──────┐
│ PostgreSQL  │ │ Python   │ │ Delta Lake  │
│ Primary     │ │ Service  │ │ Storage     │
└─────────────┘ └──────────┘ └─────────────┘
```

---

## Future Enhancements

### Planned Features

1. **GraphQL API** - Alternative to REST for flexible queries
2. **WebSocket Support** - Real-time notifications
3. **Advanced RBAC** - Custom roles and permissions
4. **Data Lineage** - Track data transformations
5. **Scheduled Jobs** - Automated data refresh
6. **Data Quality Dashboards** - Visualization of quality metrics
7. **Multi-tenancy** - Isolated environments per organization

### Scalability Improvements

1. **Caching Layer** - Redis for frequently accessed data
2. **Message Queue** - RabbitMQ/Kafka for async processing
3. **Distributed Tracing** - OpenTelemetry integration
4. **Metrics** - Prometheus/Grafana monitoring
5. **Auto-scaling** - Kubernetes deployment

---

## References

- [API Reference](./API_REFERENCE.md)
- [Security Documentation](./SECURITY.md)
- [Developer Guide](./DEVELOPER_GUIDE.md)
- [Go Project Layout](https://github.com/golang-standards/project-layout)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
