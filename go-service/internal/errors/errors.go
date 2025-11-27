package errors

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

// AppError represents a structured application error
type AppError struct {
	Code       string `json:"code"`
	Message    string `json:"message"`
	StatusCode int    `json:"-"`
	Internal   error  `json:"-"` // Internal error for logging, not exposed to client
}

// Error implements the error interface
func (e *AppError) Error() string {
	if e.Internal != nil {
		return fmt.Sprintf("[%s] %s: %v", e.Code, e.Message, e.Internal)
	}
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

// Common error constructors

func BadRequest(message string) *AppError {
	return &AppError{
		Code:       "bad_request",
		Message:    message,
		StatusCode: http.StatusBadRequest,
	}
}

func Unauthorized(message string) *AppError {
	return &AppError{
		Code:       "unauthorized",
		Message:    message,
		StatusCode: http.StatusUnauthorized,
	}
}

func Forbidden(message string) *AppError {
	return &AppError{
		Code:       "forbidden",
		Message:    message,
		StatusCode: http.StatusForbidden,
	}
}

func NotFound(resource string) *AppError {
	return &AppError{
		Code:       "not_found",
		Message:    fmt.Sprintf("%s not found", resource),
		StatusCode: http.StatusNotFound,
	}
}

func Conflict(message string) *AppError {
	return &AppError{
		Code:       "conflict",
		Message:    message,
		StatusCode: http.StatusConflict,
	}
}

func Internal(message string, err error) *AppError {
	return &AppError{
		Code:       "internal_error",
		Message:    message,
		StatusCode: http.StatusInternalServerError,
		Internal:   err,
	}
}

func BadGateway(service string, err error) *AppError {
	return &AppError{
		Code:       "bad_gateway",
		Message:    fmt.Sprintf("%s service unavailable", service),
		StatusCode: http.StatusBadGateway,
		Internal:   err,
	}
}

// WithInternal adds an internal error for logging
func (e *AppError) WithInternal(err error) *AppError {
	e.Internal = err
	return e
}

// Response sends the error as a JSON response
func (e *AppError) Response(c *gin.Context) {
	// Log internal errors for debugging
	if e.Internal != nil {
		c.Error(e.Internal) // Gin will log this
	}

	c.JSON(e.StatusCode, gin.H{
		"error":   e.Code,
		"message": e.Message,
	})
}

// ErrorHandler is a middleware that handles panics and converts them to proper error responses
func ErrorHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				// Convert panic to internal error
				appErr := Internal("An unexpected error occurred", fmt.Errorf("%v", err))
				appErr.Response(c)
				c.Abort()
			}
		}()
		c.Next()
	}
}

// Helper to respond with AppError or fallback to generic error
func HandleError(c *gin.Context, err error) {
	if appErr, ok := err.(*AppError); ok {
		appErr.Response(c)
	} else {
		Internal("An error occurred", err).Response(c)
	}
}
