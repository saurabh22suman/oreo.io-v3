# Public ID Implementation Guide

## Overview

This document outlines the implementation of hash-based public IDs for projects and datasets to replace numerical IDs in URLs.

## Changes Made

### 1. Database Schema Updates ✅

**Models Updated:**
- `go-service/internal/models/project.go` - Added `PublicID` field
- `go-service/internal/models/dataset.go` - Added `PublicID` field

Both fields are:
- Type: `string` (16 characters)
- Unique index
- Not null
- Format: 8-character lowercase alphanumeric hash (e.g., "a3x7k9m2")

### 2. Utility Functions Created ✅

**File:** `go-service/internal/utils/publicid.go`

Functions:
- `GeneratePublicID()` - Generates 8-char hash-like ID using crypto/rand
- `IsNumericID(id string)` - Checks if ID is numeric (for backward compatibility)

### 3. Migration Created ✅

**File:** `go-service/internal/migrations/publicid.go`

- `MigratePublicIDs(db *gorm.DB)` - Generates public IDs for existing records
- Run this once after deployment to populate PublicID for all existing projects/datasets

## Implementation Steps (TODO)

### Step 1: Run Database Migration

```bash
# Add to go-service/cmd/migrate/main.go or run manually:
db := dbpkg.Get()
migrations.MigratePublicIDs(db)
```

### Step 2: Update Project Creation Handler

**File:** `go-service/internal/handlers/projects.go`

In `ProjectsCreate` function, add after line 121:

```go
p := models.Project{
    Name: in.Name, 
    Description: in.Description, 
    OwnerID: ownerID,
    PublicID: utils.GeneratePublicID(), // ADD THIS
}
```

### Step 3: Add Project ID Resolver Helper

**File:** `go-service/internal/handlers/helpers.go` (create if doesn't exist)

```go
package handlers

import (
    "strconv"
    
    dbpkg "github.com/oreo-io/oreo.io-v2/go-service/internal/database"
    "github.com/oreo-io/oreo.io-v2/go-service/internal/models"
    "github.com/oreo-io/oreo.io-v2/go-service/internal/utils"
)

// ResolveProjectID resolves either numeric ID or PublicID to internal ID
func ResolveProjectID(idParam string) (uint, error) {
    gdb := dbpkg.Get()
    
    // Check if numeric (backward compatibility)
    if utils.IsNumericID(idParam) {
        id, err := strconv.Atoi(idParam)
        if err != nil {
            return 0, err
        }
        return uint(id), nil
    }
    
    // Resolve via PublicID
    var project models.Project
    if err := gdb.Where("public_id = ?", idParam).First(&project).Error; err != nil {
        return 0, err
    }
    
    return project.ID, nil
}

// ResolveDatasetID resolves either numeric ID or PublicID to internal ID
func ResolveDatasetID(idParam string) (uint, error) {
    gdb := dbpkg.Get()
    
    // Check if numeric (backward compatibility)
    if utils.IsNumericID(idParam) {
        id, err := strconv.Atoi(idParam)
        if err != nil {
            return 0, err
        }
        return uint(id), nil
    }
    
    // Resolve via PublicID
    var dataset models.Dataset
    if err := gdb.Where("public_id = ?", idParam).First(&dataset).Error; err != nil {
        return 0, err
    }
    
    return dataset.ID, nil
}
```

### Step 4: Update All Handlers to Use Resolver

Example for `ProjectsGet`:

```go
// OLD:
idStr := c.Param("id")
id, _ := strconv.Atoi(idStr)

// NEW:
idStr := c.Param("id")
id, err := ResolveProjectID(idStr)
if err != nil {
    c.JSON(404, gin.H{"error": "not_found"})
    return
}
```

Apply to:
- `ProjectsGet`
- `ProjectsUpdate`
- `ProjectsDelete`
- All dataset handlers
- All change request handlers
- All route handlers that use project/dataset IDs

### Step 5: Update Frontend Routes

**File:** `frontend/src/App.tsx`

Routes to update:
- `/projects/:id` → Keep as is (will accept hash)
- `/projects/:id/datasets/:datasetId` → Keep as is (will accept hash)
- All nested routes

### Step 6: Update Frontend API Calls

Ensure API client uses `public_id` from responses:

**File:** `frontend/src/api.ts`

No changes needed - API will return both `id` and `public_id`

### Step 7: Update Frontend Links/Navigation

**Example:** `frontend/src/pages/ProjectsPage.tsx`

```tsx
// OLD:
onClick={() => navigate(`/projects/${p.id}`)}

// NEW:
onClick={() => navigate(`/projects/${p.public_id}`)}
```

Apply to all:
- Project links
- Dataset links
- Breadcrumbs
- Navigation menus

### Step 8: Update Frontend to Use Public IDs

**Files to update:**
- `ProjectsPage.tsx` - Use `project.public_id` in navigation
- `DatasetsPage.tsx` - Use `project.public_id` and `dataset.public_id`
- `DatasetDetailsPage.tsx` - Use public IDs in links
- `DatasetViewerPage.tsx` - Use public IDs
- All other dataset-related pages

### Step 9: Update JSON Responses to Include Public ID

**File:** `go-service/internal/handlers/projects.go`

In `ProjectsList`, add to response map:

```go
m := map[string]interface{}{
    "id":           p.ID,
    "public_id":    p.PublicID, // ADD THIS
    "name":         p.Name,
    // ... rest
}
```

## Testing Checklist

- [ ] Run database migration
- [ ] Verify existing projects/datasets have PublicID
- [ ] Create new project → verify PublicID is generated
- [ ] Create new dataset → verify PublicID is generated
- [ ] Navigate to `/projects/{public_id}` → works
- [ ] Navigate to `/projects/{public_id}/datasets/{public_id}` → works
- [ ] Backward compatibility: `/projects/1` still works
- [ ] All API endpoints work with both ID types
- [ ] Links in UI use public IDs
- [ ] Browser URL shows public IDs

## Rollout Strategy

### Phase 1: Backend (Safe)
1. Deploy schema changes (PublicID columns)
2. Run migration to populate PublicIDs
3. Update creation handlers to generate PublicID
4. Test via API (both numeric and hash IDs work)

### Phase 2: Backend Routes (Safe)
1. Add resolver functions
2. Update all handlers to use resolvers
3. Deploy
4. Test both ID types work

### Phase 3: Frontend (User-facing)
1. Update all navigation to use `public_id`
2. Deploy
3. Users see hash-based URLs

## Backward Compatibility

The implementation supports both:
- Numeric IDs: `/projects/6/datasets/18`
- Hash IDs: `/projects/a3x7k9m2/datasets/b4y8n1p5`

This allows gradual transition without breaking existing bookmarks or API clients.

## Example URLs

**Before:**
```
http://localhost:5173/projects/6/datasets/18
http://localhost:5173/projects/6/datasets/18/view
```

**After:**
```
http://localhost:5173/projects/a3x7k9m2/datasets/b4y8n1p5
http://localhost:5173/projects/a3x7k9m2/datasets/b4y8n1p5/view
```

## Security Benefits

1. **Non-sequential**: Harder to enumerate projects/datasets
2. **Unpredictable**: Cannot guess valid IDs
3. **Collision-resistant**: 8 chars base32 = 40 bits = 1 trillion combinations
4. **URL-safe**: Lowercase alphanumeric only

## Performance Considerations

- PublicID has unique index → O(1) lookup
- Minimal overhead vs numeric ID
- Cache resolvers if needed for high traffic

## Next Steps

1. **Run migration** to populate PublicID for existing records
2. **Update handlers** to generate PublicID on creation  
3. **Add resolvers** to support both ID types
4. **Update frontend** to use public_id in navigation
5. **Test thoroughly** before production deployment

## Files Modified

✅ `go-service/internal/models/project.go`
✅ `go-service/internal/models/dataset.go`
✅ `go-service/internal/utils/publicid.go` (new)
✅ `go-service/internal/migrations/publicid.go` (new)

## Files To Modify (TODO)

- `go-service/internal/handlers/helpers.go` (create with resolvers)
- `go-service/internal/handlers/projects.go` (add PublicID generation + use resolvers)
- `go-service/internal/handlers/datasets.go` (add PublicID generation + use resolvers)
- `go-service/internal/handlers/changes.go` (use resolvers)
- `go-service/cmd/migrate/main.go` (run migration)
- `frontend/src/pages/*.tsx` (all pages with project/dataset links)

Would you like me to proceed with implementing the handler updates and frontend changes?
