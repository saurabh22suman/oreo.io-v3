package main

import (
	"github.com/oreo-io/oreo.io-v2/go-service/internal/config"
)

func init() {
	// Load config once for all tests
	_, _ = config.Load()
}