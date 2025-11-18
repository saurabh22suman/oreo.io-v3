package config

import (
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
)

// Config holds all application configuration
type Config struct {
	// Server
	Port string

	// Database
	DatabaseURL string
	MetadataDB  string

	// Storage
	DeltaDataRoot         string
	DefaultStorageBackend string

	// Python Service
	PythonServiceURL string

	// Authentication & Security
	JWTSecret      string
	AdminPassword  string
	CookieSecure   bool
	SessionTimeout int // hours

	// Google OAuth
	GoogleClientID     string
	GoogleClientSecret string

	// Features
	DisableWorker bool
}

var globalConfig *Config

// Load reads and validates all configuration from environment variables
// This should be called once at application startup
func Load() (*Config, error) {
	cfg := &Config{
		Port:                  getEnv("PORT", "8080"),
		DatabaseURL:           os.Getenv("DATABASE_URL"),
		MetadataDB:            os.Getenv("METADATA_DB"),
		DeltaDataRoot:         getEnv("DELTA_DATA_ROOT", "/data/delta"),
		DefaultStorageBackend: strings.ToLower(getEnv("DEFAULT_STORAGE_BACKEND", "delta")),
		PythonServiceURL:      getEnv("PYTHON_SERVICE_URL", "http://localhost:8000"),
		JWTSecret:             os.Getenv("JWT_SECRET"),
		AdminPassword:         os.Getenv("ADMIN_PASSWORD"),
		CookieSecure:          getBoolEnv("COOKIE_SECURE", false),
		SessionTimeout:        getIntEnv("SESSION_TIMEOUT_HOURS", 24),
		GoogleClientID:        os.Getenv("GOOGLE_CLIENT_ID"),
		GoogleClientSecret:    os.Getenv("GOOGLE_CLIENT_SECRET"),
		DisableWorker:         getBoolEnv("DISABLE_WORKER", false),
	}

	// Validate critical configuration
	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("configuration validation failed: %w", err)
	}

	globalConfig = cfg
	log.Println("[config] Configuration loaded successfully")
	return cfg, nil
}

// Validate checks that all required configuration is present and valid
func (c *Config) Validate() error {
	var errors []string

	// JWT Secret is critical for security
	if c.JWTSecret == "" {
		errors = append(errors, "JWT_SECRET is required and must not be empty")
	} else if len(c.JWTSecret) < 32 {
		errors = append(errors, "JWT_SECRET must be at least 32 characters for security")
	}

	// Admin password must be set for production
	if c.AdminPassword == "" {
		errors = append(errors, "ADMIN_PASSWORD is required and must not be empty")
	} else if len(c.AdminPassword) < 12 {
		errors = append(errors, "ADMIN_PASSWORD must be at least 12 characters")
	}

	// Database validation
	if c.DatabaseURL == "" && c.MetadataDB == "" {
		log.Println("[config] WARNING: Neither DATABASE_URL nor METADATA_DB set, will use in-memory SQLite")
	}

	// Storage backend validation
	validBackends := map[string]bool{"delta": true, "postgres": true, "sqlite": true}
	if !validBackends[c.DefaultStorageBackend] {
		errors = append(errors, fmt.Sprintf("DEFAULT_STORAGE_BACKEND must be one of: delta, postgres, sqlite (got: %s)", c.DefaultStorageBackend))
	}

	// Python service URL validation
	if !strings.HasPrefix(c.PythonServiceURL, "http://") && !strings.HasPrefix(c.PythonServiceURL, "https://") {
		errors = append(errors, "PYTHON_SERVICE_URL must start with http:// or https://")
	}

	if len(errors) > 0 {
		return fmt.Errorf("configuration errors:\n  - %s", strings.Join(errors, "\n  - "))
	}

	return nil
}

// Get returns the global configuration instance
// Must call Load() first
func Get() *Config {
	if globalConfig == nil {
		log.Fatal("[config] Config.Get() called before Load()")
	}
	return globalConfig
}

// MustLoad loads configuration and panics if validation fails
// Use this in main() for fail-fast behavior
func MustLoad() *Config {
	cfg, err := Load()
	if err != nil {
		log.Fatalf("[config] Failed to load configuration: %v", err)
	}
	return cfg
}

// Helper functions

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getBoolEnv(key string, defaultValue bool) bool {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	b, err := strconv.ParseBool(value)
	if err != nil {
		log.Printf("[config] WARNING: Invalid boolean value for %s: %s, using default: %v", key, value, defaultValue)
		return defaultValue
	}
	return b
}

func getIntEnv(key string, defaultValue int) int {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	i, err := strconv.Atoi(value)
	if err != nil {
		log.Printf("[config] WARNING: Invalid integer value for %s: %s, using default: %d", key, value, defaultValue)
		return defaultValue
	}
	return i
}

// IsDevelopment returns true if running in development mode
func (c *Config) IsDevelopment() bool {
	env := strings.ToLower(os.Getenv("ENVIRONMENT"))
	return env == "" || env == "dev" || env == "development"
}

// IsProduction returns true if running in production mode
func (c *Config) IsProduction() bool {
	env := strings.ToLower(os.Getenv("ENVIRONMENT"))
	return env == "prod" || env == "production"
}
