# Security Documentation

**Version:** 3.0  
**Last Updated:** November 2025

---

## Table of Contents

1. [Security Overview](#security-overview)
2. [Configuration Security](#configuration-security)
3. [Authentication & Authorization](#authentication--authorization)
4. [Input Validation](#input-validation)
5. [Data Protection](#data-protection)
6. [Deployment Security](#deployment-security)
7. [Security Checklist](#security-checklist)
8. [Incident Response](#incident-response)

---

## Security Overview

Oreo.io implements defense-in-depth security with multiple layers:

```
┌────────────────────────────────────┐
│  1. Configuration Validation       │  ← Fail-fast on weak secrets
├────────────────────────────────────┤
│  2. Input Sanitization             │  ← SQL injection prevention
├────────────────────────────────────┤
│  3. Authentication (JWT)           │  ← Verify identity
├────────────────────────────────────┤
│  4. Authorization (RBAC)           │  ← Check permissions
├────────────────────────────────────┤
│  5. Audit Logging                  │  ← Track all actions
├────────────────────────────────────┤
│  6. Data Encryption                │  ← Protect at rest & transit
└────────────────────────────────────┘
```

### Security Principles

1. **Fail-Fast:** Application refuses to start with insecure configuration
2. **Least Privilege:** Users have minimum permissions required
3. **Defense in Depth:** Multiple security layers
4. **Audit Trail:** Complete logging of security events
5. **Secure by Default:** No insecure fallbacks

---

## Configuration Security

### Environment Variables

All security-sensitive configuration is managed via environment variables with enforced validation.

#### Required Variables

```bash
# JWT Secret (REQUIRED, min 32 characters)
JWT_SECRET="<generate-with-openssl-rand-base64-32>"

# Admin Password (REQUIRED, min 12 chars, complexity required)
ADMIN_PASSWORD="<strong-password-12plus-chars>"

# Database Connection (REQUIRED)
DATABASE_URL="postgres://user:pass@host:5432/oreo?sslmode=require"
# OR for development
METADATA_DB="/data/meta/oreo.db"

# Python Service URL (REQUIRED)
PYTHON_SERVICE_URL="http://python-service:8000"
```

#### Optional Variables

```bash
# Server Configuration
PORT="8080"
ENV="production"  # "development" or "production"

# Session Configuration
SESSION_TIMEOUT="3600"  # seconds (default: 1 hour)
COOKIE_SECURE="true"    # true in production
COOKIE_DOMAIN="example.com"

# Storage Configuration
DEFAULT_STORAGE_BACKEND="delta"  # "delta" or "postgres"
DELTA_DATA_ROOT="/data/delta"

# Worker Configuration
DISABLE_WORKER="false"

# Google OAuth (Optional)
GOOGLE_CLIENT_ID="<your-google-client-id>"
```

### Configuration Validation

The application validates all configuration at startup:

```go
// Enforced Minimums
- JWT_SECRET: >= 32 characters
- ADMIN_PASSWORD: >= 12 characters with:
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one digit
  - At least one special character
```

**Startup Behavior:**
```bash
$ ./server
2025/11/18 15:00:00 [ERROR] Configuration validation failed: JWT_SECRET must be at least 32 characters
exit status 1
```

### Generating Secure Secrets

```bash
# Generate JWT Secret (32+ characters)
openssl rand -base64 32

# Generate Admin Password
openssl rand -base64 16 | tr -d "=+/" | cut -c1-16
# Then add special characters manually: Admin$SecurePass123!
```

### Environment File Security

**`.env` File (NEVER COMMIT):**
```bash
# Production secrets - NEVER commit this file
JWT_SECRET=your_generated_32plus_character_secret_here
ADMIN_PASSWORD=YourSecure12PlusAdmin!Pass
DATABASE_URL=postgres://prod_user:prod_pass@db.example.com:5432/oreo?sslmode=require
```

**`.env.example` (Template, SAFE TO COMMIT):**
```bash
# See SECURITY.md for generating secure values
JWT_SECRET=CHANGE_ME_minimum_32_characters_required
ADMIN_PASSWORD=CHANGE_ME_Admin123!@#Strong
DATABASE_URL=postgres://oreo:CHANGE_ME@db:5432/oreo?sslmode=disable
```

**`.gitignore` (Required):**
```gitignore
# Environment & Secrets (NEVER COMMIT)
.env
.env.*
!.env.example

# Docker Compose with real secrets
docker-compose.dev.yml
docker-compose.override.yml

# SSL Certificates
*.pem
*.key
*.crt

# Secrets Directory
secrets/
config/secrets.yaml
```

---

## Authentication & Authorization

### Authentication Flow

```
1. User submits credentials
      │
      ▼
2. Validate email format (RFC-compliant)
      │
      ▼
3. Check password strength (8+ chars, complexity)
      │
      ▼
4. Hash password with bcrypt (cost 10)
      │
      ▼
5. Store user record
      │
      ▼
6. Generate JWT token
      │
      ▼
7. Set HttpOnly cookie (Secure in production)
      │
      ▼
8. Return token to client
```

### JWT Token Structure

```json
{
  "user_id": 1,
  "email": "user@example.com",
  "role": "user",
  "exp": 1705000000,
  "iat": 1704996400
}
```

**Token Properties:**
- **Algorithm:** HS256 (HMAC with SHA-256)
- **Secret:** Environment variable `JWT_SECRET` (min 32 chars)
- **Expiration:** Configurable via `SESSION_TIMEOUT` (default: 3600s)
- **Storage:** HttpOnly cookie (cannot be accessed by JavaScript)
- **Transmission:** HTTPS only in production

### Password Security

**Storage:**
```go
// Never store plain text passwords
hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(password), 10)
```

**Validation:**
```go
func ValidatePassword(password string) error {
    if len(password) < 8 {
        return errors.New("min 8 characters")
    }
    
    // Require complexity
    checks := map[string]string{
        `[A-Z]`: "uppercase letter",
        `[a-z]`: "lowercase letter",
        `[0-9]`: "digit",
        `[!@#$%^&*(),.?":{}|<>]`: "special character",
    }
    
    for pattern, name := range checks {
        if !regexp.MustCompile(pattern).MatchString(password) {
            return fmt.Errorf("must contain %s", name)
        }
    }
    
    return nil
}
```

**Best Practices:**
- Minimum 8 characters (enforce 12+ for admin)
- Require uppercase, lowercase, digit, special character
- Hash with bcrypt (cost factor 10)
- Never log passwords
- Rotate admin passwords regularly

### Role-Based Access Control (RBAC)

**Project Roles:**

| Role   | Permissions |
|--------|-------------|
| Owner  | Full control, delete project |
| Admin  | Manage members, datasets, approve changes |
| Editor | Create datasets, submit changes |
| Viewer | Read-only access |

**Authorization Middleware:**
```go
func RequireRole(minRole string) gin.HandlerFunc {
    return func(c *gin.Context) {
        userRole, _ := c.Get("user_role")
        
        if !hasPermission(userRole, minRole) {
            c.JSON(403, gin.H{"error": "insufficient permissions"})
            c.Abort()
            return
        }
        
        c.Next()
    }
}
```

**Usage:**
```go
// Only admins and owners can delete datasets
r.DELETE("/datasets/:id", AuthMiddleware(), RequireRole("admin"), DeleteDataset)
```

### Admin Authentication

Admin endpoints require a separate authentication mechanism:

```go
// Header-based authentication
X-Admin-Password: <ADMIN_PASSWORD from env>
```

**Security Considerations:**
- Admin password must be 12+ characters
- Separate from user authentication
- Should be rotated regularly
- Use HTTPS to protect in transit
- Consider IP whitelisting for admin endpoints

---

## Input Validation

### SQL Injection Prevention

**Problem:** User-provided table/column names in dynamic SQL.

**Solution:** Whitelist validation with strict patterns.

```go
func ValidateTableName(name string) error {
    // 1. Allow only alphanumeric and underscore
    pattern := `^[a-zA-Z][a-zA-Z0-9_]*$`
    if !regexp.MustCompile(pattern).MatchString(name) {
        return errors.New("invalid characters")
    }
    
    // 2. Block SQL reserved keywords
    reserved := []string{
        "SELECT", "INSERT", "UPDATE", "DELETE", "DROP",
        "CREATE", "ALTER", "TRUNCATE", "GRANT", "REVOKE",
        "UNION", "JOIN", "WHERE", "OR", "AND",
    }
    
    upper := strings.ToUpper(name)
    for _, keyword := range reserved {
        if upper == keyword {
            return errors.New("cannot use SQL keyword")
        }
    }
    
    // 3. Length limit
    if len(name) > 64 {
        return errors.New("name too long (max 64 chars)")
    }
    
    return nil
}
```

**Safe Usage:**
```go
// BEFORE: Vulnerable to SQL injection
query := fmt.Sprintf("CREATE TABLE %s (id INT)", userInput)

// AFTER: Validated input
if err := ValidateTableName(userInput); err != nil {
    return err
}
tableName := SanitizeTableName(userInput)
query := fmt.Sprintf("CREATE TABLE %s (id INT)", tableName)
```

### Email Validation

```go
func ValidateEmail(email string) error {
    // RFC 5322 compliant pattern
    pattern := `^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`
    
    if !regexp.MustCompile(pattern).MatchString(email) {
        return errors.New("invalid email format")
    }
    
    // Additional checks
    if len(email) > 254 {
        return errors.New("email too long")
    }
    
    return nil
}
```

### File Upload Security

**Size Limits:**
```go
const maxUploadBytes = 100 * 1024 * 1024 // 100 MB
r.MaxMultipartMemory = 110 << 20
```

**Type Validation:**
```go
func ValidateFileType(filename string) error {
    ext := strings.ToLower(filepath.Ext(filename))
    
    allowed := map[string]bool{
        ".csv":     true,
        ".parquet": true,
    }
    
    if !allowed[ext] {
        return errors.New("unsupported file type")
    }
    
    return nil
}
```

**Content Scanning:**
```go
// Scan first bytes to verify actual file type
func VerifyFileContent(file *multipart.FileHeader) error {
    f, _ := file.Open()
    defer f.Close()
    
    buf := make([]byte, 512)
    n, _ := f.Read(buf)
    
    contentType := http.DetectContentType(buf[:n])
    
    // Check if content type matches extension
    if !isAllowedContentType(contentType) {
        return errors.New("file content does not match extension")
    }
    
    return nil
}
```

### Query Security

**SQL Query Sanitization:**
```go
func SanitizeQuery(sql string) error {
    // 1. Only allow SELECT statements
    if !strings.HasPrefix(strings.ToUpper(strings.TrimSpace(sql)), "SELECT") {
        return errors.New("only SELECT queries allowed")
    }
    
    // 2. Block dangerous keywords
    dangerous := []string{"DROP", "DELETE", "UPDATE", "INSERT", "EXEC", "EXECUTE"}
    upper := strings.ToUpper(sql)
    
    for _, keyword := range dangerous {
        if strings.Contains(upper, keyword) {
            return fmt.Errorf("query contains forbidden keyword: %s", keyword)
        }
    }
    
    // 3. Enforce row limit
    if !strings.Contains(upper, "LIMIT") {
        return errors.New("query must include LIMIT clause")
    }
    
    return nil
}
```

---

## Data Protection

### Encryption at Rest

**Database:**
```bash
# PostgreSQL with encryption
DATABASE_URL=postgres://user:pass@host:5432/oreo?sslmode=require

# Enable transparent data encryption in PostgreSQL
# ALTER SYSTEM SET ssl = on;
```

**Files:**
```bash
# Delta Lake files are stored on encrypted volumes
# /data/delta mounted from encrypted EBS/disk
```

### Encryption in Transit

**HTTPS Configuration:**
```go
// Production deployment (behind reverse proxy)
server := &http.Server{
    Addr:    ":8080",
    Handler: router,
    TLSConfig: &tls.Config{
        MinVersion: tls.VersionTLS12,
        CipherSuites: []uint16{
            tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
            tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
        },
    },
}
```

**Nginx Reverse Proxy (Recommended):**
```nginx
server {
    listen 443 ssl http2;
    server_name api.example.com;
    
    ssl_certificate     /etc/ssl/certs/api.example.com.crt;
    ssl_certificate_key /etc/ssl/private/api.example.com.key;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
    ssl_prefer_server_ciphers on;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    location / {
        proxy_pass http://go-service:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Sensitive Data Handling

**Passwords:**
```go
// ✓ CORRECT: Never log passwords
log.Printf("User %s logged in", user.Email)

// ✗ WRONG: Don't log sensitive data
log.Printf("Login attempt: %s/%s", email, password)
```

**API Responses:**
```go
// ✓ CORRECT: Exclude sensitive fields
type UserResponse struct {
    ID    uint   `json:"id"`
    Email string `json:"email"`
    // Password field not included
}

// ✗ WRONG: Don't expose password hashes
type UserResponse struct {
    ID       uint   `json:"id"`
    Email    string `json:"email"`
    Password string `json:"password"` // BAD!
}
```

**Database Queries:**
```go
// ✓ CORRECT: Select specific fields
gdb.Select("id", "email", "role").Find(&users)

// ✗ WRONG: Select * may include sensitive fields
gdb.Find(&users)
```

---

## Deployment Security

### Production Checklist

- [ ] **Environment Variables**
  - [ ] JWT_SECRET is 32+ random characters
  - [ ] ADMIN_PASSWORD is 12+ characters with complexity
  - [ ] No hardcoded secrets in code
  - [ ] .env file not committed to git

- [ ] **Database**
  - [ ] SSL/TLS enabled (sslmode=require)
  - [ ] Strong database password
  - [ ] Database user has minimum required privileges
  - [ ] Regular backups configured

- [ ] **Network**
  - [ ] HTTPS enabled (TLS 1.2+)
  - [ ] Certificate from trusted CA
  - [ ] COOKIE_SECURE=true
  - [ ] CORS configured correctly
  - [ ] Firewall rules in place

- [ ] **Application**
  - [ ] ENV=production
  - [ ] Debug mode disabled
  - [ ] Error messages don't expose internals
  - [ ] File upload limits enforced
  - [ ] Rate limiting configured

- [ ] **Monitoring**
  - [ ] Audit logs enabled
  - [ ] Error tracking (Sentry/etc)
  - [ ] Security event alerts
  - [ ] Failed login monitoring

### Docker Security

**Dockerfile Best Practices:**
```dockerfile
# Use specific versions, not latest
FROM golang:1.23-alpine AS build

# Run as non-root user
FROM alpine:3.20
RUN addgroup -g 1000 appgroup && \
    adduser -D -u 1000 -G appgroup appuser

# Copy files with correct permissions
COPY --from=build --chown=appuser:appgroup /app/server /app/server

# Switch to non-root user
USER appuser

# Read-only root filesystem
# Add to docker-compose.yml: read_only: true
```

**docker-compose.yml Security:**
```yaml
services:
  go-service:
    # ... other config
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
    read_only: true
    tmpfs:
      - /tmp
```

### Secrets Management

**Development:**
```bash
# Use .env file (not committed)
cp .env.example .env
# Edit .env with real values
```

**Production Options:**

**1. Environment Variables (Simple):**
```bash
export JWT_SECRET="$(openssl rand -base64 32)"
export ADMIN_PASSWORD="SecureAdmin123!@#"
./server
```

**2. Docker Secrets:**
```yaml
secrets:
  jwt_secret:
    external: true
  admin_password:
    external: true

services:
  go-service:
    secrets:
      - jwt_secret
      - admin_password
    environment:
      JWT_SECRET_FILE: /run/secrets/jwt_secret
      ADMIN_PASSWORD_FILE: /run/secrets/admin_password
```

**3. Vault/AWS Secrets Manager:**
```go
// Fetch secrets at startup
jwtSecret := fetchFromVault("oreo/jwt_secret")
config.Set("JWT_SECRET", jwtSecret)
```

---

## Security Checklist

### Pre-Deployment

```
Configuration:
□ Strong JWT_SECRET (32+ chars) generated
□ Strong ADMIN_PASSWORD (12+ chars) set
□ Database password is strong
□ .env file is in .gitignore
□ .env.example has CHANGE_ME placeholders
□ No hardcoded secrets in code

Code:
□ Input validation on all user inputs
□ SQL injection prevention on table names
□ HTTPS enforced in production
□ COOKIE_SECURE=true in production
□ Error messages don't leak sensitive info
□ Audit logging enabled

Infrastructure:
□ Database SSL/TLS enabled
□ Firewall rules configured
□ SSL certificate installed
□ Reverse proxy configured (Nginx)
□ Rate limiting enabled
□ CORS properly configured

Monitoring:
□ Failed login attempts logged
□ Security events alerting
□ Error tracking enabled
□ Backup strategy in place
```

### Post-Deployment

```
□ Verify HTTPS is working
□ Test authentication flow
□ Verify RBAC permissions
□ Check audit logs are being created
□ Test file upload limits
□ Verify SQL injection protection
□ Check error responses don't leak info
□ Test rate limiting
□ Verify database backups
□ Run security scan (if available)
```

---

## Incident Response

### Security Incident Types

1. **Unauthorized Access**
   - Failed login attempts spike
   - Successful login from unusual location
   - Admin endpoints accessed without authorization

2. **Data Breach**
   - Unauthorized data export
   - SQL injection attempt
   - File upload containing malware

3. **Denial of Service**
   - Request rate spike
   - Large file uploads
   - Resource exhaustion

### Response Procedure

**1. Detection**
```bash
# Monitor logs for suspicious activity
grep "unauthorized" /var/log/oreo/api.log
grep "SQL injection" /var/log/oreo/security.log
grep "rate limit exceeded" /var/log/oreo/api.log
```

**2. Containment**
```bash
# Block offending IP at firewall
iptables -A INPUT -s <malicious_ip> -j DROP

# Disable compromised user account
# Use admin API or database:
UPDATE users SET active = false WHERE id = <user_id>;

# Rotate compromised secrets
export JWT_SECRET="$(openssl rand -base64 32)"
systemctl restart oreo-api
```

**3. Investigation**
```bash
# Audit logs
SELECT * FROM audit_logs
WHERE user_id = <compromised_user>
  AND created_at > '<incident_time>'
ORDER BY created_at DESC;

# Check affected datasets
SELECT * FROM dataset_versions
WHERE modified_by = <compromised_user>
  AND created_at > '<incident_time>';
```

**4. Recovery**
```bash
# Restore from backup if needed
pg_restore -d oreo backup_20250118.sql

# Force password reset for all users
UPDATE users SET password_reset_required = true;

# Invalidate all sessions
DELETE FROM user_sessions;
```

**5. Post-Incident**
- Document incident details
- Update security procedures
- Notify affected users (if required)
- Implement preventive measures
- Schedule security audit

### Contact Information

**Security Team:**
- Email: security@example.com
- Slack: #security-incidents
- On-call: +1-XXX-XXX-XXXX

**Escalation:**
1. Security Engineer
2. Lead Engineer
3. CTO

---

## Security Hardening Recommendations

### Application Level

1. **Rate Limiting**
   ```go
   // Implement rate limiting middleware
   limiter := tollbooth.NewLimiter(5, nil) // 5 req/min
   r.Use(tollbooth.LimitHandler(limiter))
   ```

2. **Request ID Tracking**
   ```go
   // Add request ID to all logs
   r.Use(func(c *gin.Context) {
       requestID := uuid.New().String()
       c.Set("request_id", requestID)
       c.Header("X-Request-ID", requestID)
       c.Next()
   })
   ```

3. **CORS Hardening**
   ```go
   // Strict CORS in production
   config := cors.Config{
       AllowOrigins:     []string{"https://app.example.com"},
       AllowMethods:     []string{"GET", "POST", "PUT", "DELETE"},
       AllowHeaders:     []string{"Authorization", "Content-Type"},
       AllowCredentials: true,
       MaxAge:           12 * time.Hour,
   }
   r.Use(cors.New(config))
   ```

### Infrastructure Level

1. **Web Application Firewall**
   - Use Cloudflare, AWS WAF, or similar
   - Block common attack patterns
   - Rate limiting at edge

2. **DDoS Protection**
   - Use CDN with DDoS protection
   - Configure rate limits
   - Auto-scaling for burst traffic

3. **Network Segmentation**
   ```
   Internet
      │
      ▼
   [Public Subnet] ← API Gateway
      │
      ▼
   [Private Subnet] ← Go Service, Python Service
      │
      ▼
   [Data Subnet] ← PostgreSQL, Delta Lake
   ```

4. **Monitoring & Alerting**
   ```yaml
   alerts:
     - name: Failed Login Spike
       condition: failed_logins > 10 in 5m
       
     - name: Unauthorized Access
       condition: http_403 > 50 in 1m
       
     - name: SQL Injection Attempt
       condition: log_contains("SQL injection")
   ```

---

## Compliance

### GDPR Considerations

- **Data Subject Rights:** Implement user data export/deletion
- **Consent:** Explicit consent for data processing
- **Data Minimization:** Only collect necessary data
- **Audit Logs:** Track all data access

### SOC 2 Controls

- **Access Control:** RBAC implementation
- **Change Management:** Approval workflows
- **Monitoring:** Comprehensive audit logging
- **Encryption:** Data encrypted at rest and in transit

---

## Security References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE/SANS Top 25](https://cwe.mitre.org/top25/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [Go Security Best Practices](https://github.com/OWASP/Go-SCP)

---

## Changelog

### Version 3.0 (November 2025)
- Implemented centralized configuration with validation
- Added SQL injection prevention
- Enforced strong password requirements
- Enhanced audit logging
- Documented security procedures

---

For questions or to report security vulnerabilities, contact: security@example.com
