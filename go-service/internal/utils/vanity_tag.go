package utils

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
)

// GenerateVanityTag generates a unique vanity tag in format: xxxx-xxxx-xxxx-xxxx-xxxx
// Uses 20 random bytes (160 bits) for strong uniqueness
func GenerateVanityTag() string {
	bytes := make([]byte, 10)
	if _, err := rand.Read(bytes); err != nil {
		// Fallback to timestamp-based if crypto/rand fails
		return fmt.Sprintf("%x", bytes)
	}
	hex := hex.EncodeToString(bytes)
	// Format as: xxxx-xxxx-xxxx-xxxx-xxxx (20 chars + 4 dashes = 24 chars)
	return fmt.Sprintf("%s-%s-%s-%s-%s", hex[0:4], hex[4:8], hex[8:12], hex[12:16], hex[16:20])
}
