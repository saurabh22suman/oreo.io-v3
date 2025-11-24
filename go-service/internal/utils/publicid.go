package utils

import (
	"crypto/rand"
	"encoding/base32"
	"fmt"
	"strings"
)

// GeneratePublicID generates a short, URL-safe hash-like ID
// Format: 8 characters, lowercase alphanumeric (e.g., "a3x7k9m2")
func GeneratePublicID() string {
	// Generate 5 random bytes (40 bits) -> 8 base32 characters
	bytes := make([]byte, 5)
	if _, err := rand.Read(bytes); err != nil {
		// Fallback to timestamp-based ID on error
		return fmt.Sprintf("%08x", uint32(0))
	}
	
	// Encode to base32 and take first 8 chars
	encoded := base32.StdEncoding.EncodeToString(bytes)
	// Remove padding and convert to lowercase
	id := strings.ToLower(strings.TrimRight(encoded, "="))
	
	// Ensure exactly 8 characters
	if len(id) > 8 {
		id = id[:8]
	}
	
	return id
}

// IsNumericID checks if a string is a numeric ID (for backward compatibility)
func IsNumericID(id string) bool {
	if id == "" {
		return false
	}
	
	for _, c := range id {
		if c < '0' || c > '9' {
			return false
		}
	}
	
	return true
}
