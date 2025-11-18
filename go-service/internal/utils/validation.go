package utils

import (
	"fmt"
	"regexp"
	"strings"
	"unicode"
)

var (
	// Safe identifier pattern: alphanumeric and underscores only
	safeIdentifierRegex = regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_]*$`)
	
	// Email validation (basic)
	emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
)

// ValidateTableName ensures a table name is safe for SQL queries
// Prevents SQL injection by only allowing alphanumeric characters and underscores
func ValidateTableName(name string) error {
	if name == "" {
		return fmt.Errorf("table name cannot be empty")
	}

	if len(name) > 63 {
		return fmt.Errorf("table name too long (max 63 characters)")
	}

	if !safeIdentifierRegex.MatchString(name) {
		return fmt.Errorf("table name must contain only letters, numbers, and underscores, and start with a letter or underscore")
	}

	// Prevent SQL reserved keywords
	reservedWords := map[string]bool{
		"select": true, "insert": true, "update": true, "delete": true,
		"drop": true, "create": true, "alter": true, "table": true,
		"from": true, "where": true, "join": true, "union": true,
		"order": true, "group": true, "having": true, "limit": true,
	}

	if reservedWords[strings.ToLower(name)] {
		return fmt.Errorf("table name cannot be a SQL reserved keyword: %s", name)
	}

	return nil
}

// ValidateDatasetName ensures a dataset name is valid
func ValidateDatasetName(name string) error {
	if name == "" {
		return fmt.Errorf("dataset name cannot be empty")
	}

	if len(name) > 100 {
		return fmt.Errorf("dataset name too long (max 100 characters)")
	}

	// Allow more characters for dataset names (spaces, hyphens)
	for _, r := range name {
		if !unicode.IsLetter(r) && !unicode.IsDigit(r) && r != '_' && r != '-' && r != ' ' {
			return fmt.Errorf("dataset name contains invalid character: %c", r)
		}
	}

	return nil
}

// ValidateProjectName ensures a project name is valid
func ValidateProjectName(name string) error {
	if name == "" {
		return fmt.Errorf("project name cannot be empty")
	}

	if len(name) > 100 {
		return fmt.Errorf("project name too long (max 100 characters)")
	}

	// Same rules as dataset name
	for _, r := range name {
		if !unicode.IsLetter(r) && !unicode.IsDigit(r) && r != '_' && r != '-' && r != ' ' {
			return fmt.Errorf("project name contains invalid character: %c", r)
		}
	}

	return nil
}

// ValidateEmail performs basic email validation
func ValidateEmail(email string) error {
	if email == "" {
		return fmt.Errorf("email cannot be empty")
	}

	if len(email) > 254 {
		return fmt.Errorf("email too long")
	}

	if !emailRegex.MatchString(email) {
		return fmt.Errorf("invalid email format")
	}

	return nil
}

// ValidatePassword checks password strength
func ValidatePassword(password string) error {
	if len(password) < 8 {
		return fmt.Errorf("password must be at least 8 characters")
	}

	if len(password) > 128 {
		return fmt.Errorf("password too long (max 128 characters)")
	}

	var (
		hasUpper   bool
		hasLower   bool
		hasDigit   bool
		hasSpecial bool
	)

	for _, r := range password {
		switch {
		case unicode.IsUpper(r):
			hasUpper = true
		case unicode.IsLower(r):
			hasLower = true
		case unicode.IsDigit(r):
			hasDigit = true
		case unicode.IsPunct(r) || unicode.IsSymbol(r):
			hasSpecial = true
		}
	}

	if !hasUpper {
		return fmt.Errorf("password must contain at least one uppercase letter")
	}
	if !hasLower {
		return fmt.Errorf("password must contain at least one lowercase letter")
	}
	if !hasDigit {
		return fmt.Errorf("password must contain at least one digit")
	}
	if !hasSpecial {
		return fmt.Errorf("password must contain at least one special character")
	}

	return nil
}

// SanitizeTableName converts a name to a safe SQL identifier
// Use this when creating tables from user input
func SanitizeTableName(name string) string {
	// Convert to lowercase
	name = strings.ToLower(name)
	
	// Replace spaces and hyphens with underscores
	name = strings.ReplaceAll(name, " ", "_")
	name = strings.ReplaceAll(name, "-", "_")
	
	// Remove any non-alphanumeric characters except underscores
	var builder strings.Builder
	for _, r := range name {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || r == '_' {
			builder.WriteRune(r)
		}
	}
	
	result := builder.String()
	
	// Ensure it starts with a letter or underscore
	if len(result) > 0 && unicode.IsDigit(rune(result[0])) {
		result = "_" + result
	}
	
	// Limit length
	if len(result) > 63 {
		result = result[:63]
	}
	
	return result
}

// TruncateString safely truncates a string to maxLen
func TruncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen]
}
