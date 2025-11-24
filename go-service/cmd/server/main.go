package main

import (
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/oreo-io/oreo.io-v2/go-service/internal/config"
	"github.com/oreo-io/oreo.io-v2/go-service/internal/handlers"
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
