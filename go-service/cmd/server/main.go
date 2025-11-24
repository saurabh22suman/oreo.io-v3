package main

import (
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/oreo-io/oreo.io-v2/go-service/internal/config"
	dbpkg "github.com/oreo-io/oreo.io-v2/go-service/internal/database"
	"github.com/oreo-io/oreo.io-v2/go-service/internal/handlers"
	"github.com/oreo-io/oreo.io-v2/go-service/internal/migrations"
	"github.com/oreo-io/oreo.io-v2/go-service/internal/models"
)

func main() {
	// Load and validate configuration first
	cfg := config.MustLoad()
	log.Printf("[main] Starting Oreo.io API server on port %s", cfg.Port)
	log.Printf("[main] Environment: %s", func() string {
		if cfg.IsProduction() {
			return "PRODUCTION"
		}
		return "DEVELOPMENT"
	}())

	// Initialize database
	db, err := dbpkg.Init()
	if err != nil {
		log.Fatalf("[main] Failed to initialize database: %v", err)
	}

	// Auto-migrate schema
	log.Println("[main] Running database migrations...")
	if err := db.AutoMigrate(&models.Project{}, &models.Dataset{}); err != nil {
		log.Printf("[main] WARNING: Auto-migration failed: %v", err)
	}

	// Run PublicID migration (idempotent - safe to run multiple times)
	log.Println("[main] Ensuring PublicIDs exist for all records...")
	if err := migrations.MigratePublicIDs(db); err != nil {
		log.Printf("[main] WARNING: PublicID migration failed: %v", err)
	} else {
		log.Println("[main] ✓ PublicID migration completed")
	}

	// Setup router with config
	r := handlers.SetupRouter()

	// Graceful shutdown handling
	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
		<-sigChan
		log.Println("[main] Shutdown signal received, cleaning up...")
		// TODO: Add cleanup logic (close DB connections, etc.)
		os.Exit(0)
	}()

	// Start server
	addr := fmt.Sprintf(":%s", cfg.Port)
	if err := r.Run(addr); err != nil {
		log.Fatalf("[main] Failed to start server: %v", err)
	}
}
