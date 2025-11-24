package migrations

import (
	"fmt"
	
	"github.com/oreo-io/oreo.io-v2/go-service/internal/models"
	"github.com/oreo-io/oreo.io-v2/go-service/internal/utils"
	"gorm.io/gorm"
)

// MigratePublicIDs adds PublicID to existing projects and datasets
// This should be run once after deploying the PublicID feature
func MigratePublicIDs(db *gorm.DB) error {
	fmt.Println("[Migration] Starting PublicID migration...")
	
	// Migrate Projects
	var projects []models.Project
	if err := db.Where("public_id IS NULL OR public_id = ''").Find(&projects).Error; err != nil {
		return fmt.Errorf("failed to fetch projects: %w", err)
	}
	
	fmt.Printf("[Migration] Found %d projects without PublicID\n", len(projects))
	
	for i := range projects {
		// Generate unique public ID
		for attempts := 0; attempts < 10; attempts++ {
			publicID := utils.GeneratePublicID()
			
			// Check if this ID already exists
			var count int64
			db.Model(&models.Project{}).Where("public_id = ?", publicID).Count(&count)
			
			if count == 0 {
				projects[i].PublicID = publicID
				if err := db.Save(&projects[i]).Error; err != nil {
					return fmt.Errorf("failed to update project %d: %w", projects[i].ID, err)
				}
				fmt.Printf("[Migration] Project %d -> %s\n", projects[i].ID, publicID)
				break
			}
			
			if attempts == 9 {
				return fmt.Errorf("failed to generate unique public_id for project %d after 10 attempts", projects[i].ID)
			}
		}
	}
	
	// Migrate Datasets
	var datasets []models.Dataset
	if err := db.Where("public_id IS NULL OR public_id = ''").Find(&datasets).Error; err != nil {
		return fmt.Errorf("failed to fetch datasets: %w", err)
	}
	
	fmt.Printf("[Migration] Found %d datasets without PublicID\n", len(datasets))
	
	for i := range datasets {
		// Generate unique public ID
		for attempts := 0; attempts < 10; attempts++ {
			publicID := utils.GeneratePublicID()
			
			// Check if this ID already exists
			var count int64
			db.Model(&models.Dataset{}).Where("public_id = ?", publicID).Count(&count)
			
			if count == 0 {
				datasets[i].PublicID = publicID
				if err := db.Save(&datasets[i]).Error; err != nil {
					return fmt.Errorf("failed to update dataset %d: %w", datasets[i].ID, err)
				}
				fmt.Printf("[Migration] Dataset %d -> %s\n", datasets[i].ID, publicID)
				break
			}
			
			if attempts == 9 {
				return fmt.Errorf("failed to generate unique public_id for dataset %d after 10 attempts", datasets[i].ID)
			}
		}
	}
	
	fmt.Println("[Migration] PublicID migration completed successfully")
	return nil
}
