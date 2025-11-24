package main

import (
	"fmt"
	"log"
	"os"

	"github.com/oreo-io/oreo.io-v2/go-service/internal/config"
	dbpkg "github.com/oreo-io/oreo.io-v2/go-service/internal/database"
	"github.com/oreo-io/oreo.io-v2/go-service/internal/migrations"
	"github.com/oreo-io/oreo.io-v2/go-service/internal/models"
)

func main() {
	fmt.Println("=== Oreo.io Public ID Migration ===")
	fmt.Println()

	// Load configuration first
	fmt.Println("Loading configuration...")
	_, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}
	fmt.Println("✓ Configuration loaded")
	fmt.Println()

	// Initialize database
	fmt.Println("Connecting to database...")
	db, err := dbpkg.Init()
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	fmt.Println("✓ Database connected")
	fmt.Println()

	// Auto-migrate schema to add PublicID columns
	fmt.Println("Step 1: Updating database schema...")
	if err := db.AutoMigrate(&models.Project{}, &models.Dataset{}); err != nil {
		log.Fatalf("Failed to auto-migrate: %v", err)
	}
	fmt.Println("✓ Schema updated (PublicID columns added)")
	fmt.Println()

	// Run PublicID migration
	fmt.Println("Step 2: Generating PublicIDs for existing records...")
	if err := migrations.MigratePublicIDs(db); err != nil {
		log.Fatalf("Failed to migrate PublicIDs: %v", err)
	}
	fmt.Println("✓ PublicID migration completed")
	fmt.Println()

	// Verify migration
	fmt.Println("Step 3: Verifying migration...")
	
	var projectCount int64
	var projectsWithPublicID int64
	db.Model(&models.Project{}).Count(&projectCount)
	db.Model(&models.Project{}).Where("public_id IS NOT NULL AND public_id != ''").Count(&projectsWithPublicID)
	
	var datasetCount int64
	var datasetsWithPublicID int64
	db.Model(&models.Dataset{}).Count(&datasetCount)
	db.Model(&models.Dataset{}).Where("public_id IS NOT NULL AND public_id != ''").Count(&datasetsWithPublicID)
	
	fmt.Printf("  Projects: %d total, %d with PublicID\n", projectCount, projectsWithPublicID)
	fmt.Printf("  Datasets: %d total, %d with PublicID\n", datasetCount, datasetsWithPublicID)
	fmt.Println()

	if projectCount != projectsWithPublicID || datasetCount != datasetsWithPublicID {
		fmt.Println("⚠️  WARNING: Some records are missing PublicID!")
		os.Exit(1)
	}

	fmt.Println("✅ Migration successful!")
	fmt.Println()
	fmt.Println("Next steps:")
	fmt.Println("  1. Restart the Go service")
	fmt.Println("  2. Test with both numeric and hash-based URLs")
	fmt.Println("  3. Deploy frontend updates to use public_id in navigation")
}
