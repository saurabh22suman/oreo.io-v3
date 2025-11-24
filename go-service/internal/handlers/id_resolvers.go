package handlers

import (
	"strconv"
	
	dbpkg "github.com/oreo-io/oreo.io-v2/go-service/internal/database"
	"github.com/oreo-io/oreo.io-v2/go-service/internal/models"
	"github.com/oreo-io/oreo.io-v2/go-service/internal/utils"
)

// ResolveProjectID resolves either numeric ID or PublicID to internal ID
// Supports backward compatibility with numeric IDs
func ResolveProjectID(idParam string) (uint, bool) {
	gdb := dbpkg.Get()
	if gdb == nil {
		return 0, false
	}
	
	// Check if numeric (backward compatibility)
	if utils.IsNumericID(idParam) {
		id, err := strconv.Atoi(idParam)
		if err != nil {
			return 0, false
		}
		return uint(id), true
	}
	
	// Resolve via PublicID
	var project models.Project
	if err := gdb.Where("public_id = ?", idParam).First(&project).Error; err != nil {
		return 0, false
	}
	
	return project.ID, true
}

// ResolveDatasetID resolves either numeric ID or PublicID to internal ID
// Supports backward compatibility with numeric IDs
func ResolveDatasetID(idParam string) (uint, bool) {
	gdb := dbpkg.Get()
	if gdb == nil {
		return 0, false
	}
	
	// Check if numeric (backward compatibility)
	if utils.IsNumericID(idParam) {
		id, err := strconv.Atoi(idParam)
		if err != nil {
			return 0, false
		}
		return uint(id), true
	}
	
	// Resolve via PublicID
	var dataset models.Dataset
	if err := gdb.Where("public_id = ?", idParam).First(&dataset).Error; err != nil {
		return 0, false
	}
	
	return dataset.ID, true
}
