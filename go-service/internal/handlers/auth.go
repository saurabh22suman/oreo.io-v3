package handlers

import (
	"encoding/json"
	"net/http"
	"net/url"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"github.com/oreo-io/oreo.io-v2/go-service/internal/config"
	appErrors "github.com/oreo-io/oreo.io-v2/go-service/internal/errors"
	"github.com/oreo-io/oreo.io-v2/go-service/internal/utils"
	dbpkg "github.com/oreo-io/oreo.io-v2/go-service/internal/database"
	"github.com/oreo-io/oreo.io-v2/go-service/internal/models"
)

type Credentials struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

func hashPassword(pw string) (string, error) {
	b, e := bcrypt.GenerateFromPassword([]byte(pw), bcrypt.DefaultCost)
	return string(b), e
}
func checkPassword(hash, pw string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(pw)) == nil
}

func getDB() *gorm.DB { return dbpkg.Get() }

func Register(c *gin.Context) {
	var req Credentials
	if err := c.ShouldBindJSON(&req); err != nil {
		appErrors.BadRequest("Invalid request payload").Response(c)
		return
	}

	// Validate email format
	if err := utils.ValidateEmail(req.Email); err != nil {
		appErrors.BadRequest(err.Error()).Response(c)
		return
	}

	// Validate password strength
	if err := utils.ValidatePassword(req.Password); err != nil {
		appErrors.BadRequest(err.Error()).Response(c)
		return
	}

	if getDB() == nil {
		if _, err := dbpkg.Init(); err != nil {
			appErrors.Internal("Database initialization failed", err).Response(c)
			return
		}
	}

	hashed, err := hashPassword(req.Password)
	if err != nil {
		appErrors.Internal("Password hashing failed", err).Response(c)
		return
	}

	u := models.User{Email: req.Email, Password: hashed, Role: "user"}
	if err := getDB().Create(&u).Error; err != nil {
		appErrors.Conflict("Email already exists").Response(c)
		return
	}

	c.JSON(http.StatusCreated, gin.H{"id": u.ID, "email": u.Email})
}

func Login(c *gin.Context) {
	var req Credentials
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "invalid payload"})
		return
	}
	if getDB() == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
	}
	var u models.User
	if err := getDB().Where("email = ?", req.Email).First(&u).Error; err != nil {
		c.JSON(401, gin.H{"error": "invalid_creds"})
		return
	}
	if !checkPassword(u.Password, req.Password) {
		appErrors.Unauthorized("Invalid credentials").Response(c)
		return
	}

	cfg := config.Get()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":   u.ID,
		"email": u.Email,
		"role":  u.Role,
		"exp":   time.Now().Add(time.Duration(cfg.SessionTimeout) * time.Hour).Unix(),
	})
	s, err := token.SignedString([]byte(cfg.JWTSecret))
	if err != nil {
		appErrors.Internal("Token generation failed", err).Response(c)
		return
	}

	// Set httpOnly cookie named "session" with the JWT
	c.SetCookie("session", s, cfg.SessionTimeout*3600, "/", "", cfg.CookieSecure, true)

	// Also return token in body for backward compatibility
	c.JSON(200, gin.H{"token": s})
}

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		var tokenStr string
		// Prefer cookie 'session' if present
		if cookie, err := c.Cookie("session"); err == nil && cookie != "" {
			tokenStr = cookie
		} else {
			auth := c.GetHeader("Authorization")
			if len(auth) < 8 || auth[:7] != "Bearer " {
				c.AbortWithStatusJSON(401, gin.H{"error": "missing_token"})
				return
			}
			tokenStr = auth[7:]
		}

		cfg := config.Get()
		token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
			return []byte(cfg.JWTSecret), nil
		})
		if err != nil || !token.Valid {
			appErrors.Unauthorized("Invalid or expired token").Response(c)
			c.Abort()
			return
		}

		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			c.Set("user_id", claims["sub"])
			c.Set("user_email", claims["email"])
			c.Set("user_role", claims["role"])
		}
		c.Next()
	}
}

// Logout clears the session cookie
func Logout(c *gin.Context) {
	cfg := config.Get()
	// MaxAge -1 instructs browser to delete cookie
	c.SetCookie("session", "", -1, "/", "", cfg.CookieSecure, true)
	c.JSON(200, gin.H{"ok": true})
}

func Refresh(c *gin.Context) {
	// Requires Authorization header; issue a new token with fresh exp
	auth := c.GetHeader("Authorization")
	if len(auth) < 8 || auth[:7] != "Bearer " {
		appErrors.Unauthorized("Missing authorization token").Response(c)
		return
	}
	tokenStr := auth[7:]

	cfg := config.Get()
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		return []byte(cfg.JWTSecret), nil
	})
	if err != nil || !token.Valid {
		appErrors.Unauthorized("Invalid or expired token").Response(c)
		return
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		appErrors.Unauthorized("Invalid token claims").Response(c)
		return
	}

	// Build a fresh token
	newTok := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":   claims["sub"],
		"email": claims["email"],
		"role":  claims["role"],
		"exp":   time.Now().Add(time.Duration(cfg.SessionTimeout) * time.Hour).Unix(),
	})
	s, err := newTok.SignedString([]byte(cfg.JWTSecret))
	if err != nil {
		appErrors.Internal("Token generation failed", err).Response(c)
		return
	}
	c.JSON(200, gin.H{"token": s})
}

// GoogleLoginRequest represents the payload from Google Identity Services callback
type GoogleLoginRequest struct {
	IDToken string `json:"id_token" binding:"required"`
}

// GoogleLogin verifies the Google ID token and issues a JWT for our app.
func GoogleLogin(c *gin.Context) {
	var req GoogleLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		appErrors.BadRequest("Invalid request payload").Response(c)
		return
	}

	cfg := config.Get()
	if cfg.GoogleClientID == "" {
		appErrors.Internal("Google OAuth not configured", nil).Response(c)
		return
	}

	// Validate the ID token using Google's tokeninfo endpoint
	resp, err := http.Get("https://oauth2.googleapis.com/tokeninfo?id_token=" + url.QueryEscape(req.IDToken))
	if err != nil {
		appErrors.BadGateway("Google", err).Response(c)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		appErrors.Unauthorized("Invalid Google token").Response(c)
		return
	}
	var ti struct {
		Aud           string `json:"aud"`
		Email         string `json:"email"`
		EmailVerified string `json:"email_verified"`
		Iss           string `json:"iss"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&ti); err != nil {
		appErrors.Unauthorized("Invalid Google token").Response(c)
		return
	}
	if ti.Aud != cfg.GoogleClientID {
		appErrors.Unauthorized("Token audience mismatch").Response(c)
		return
	}
	if ti.Email == "" {
		appErrors.Unauthorized("Email not present in token").Response(c)
		return
	}
	if ti.EmailVerified != "true" {
		appErrors.Unauthorized("Email not verified").Response(c)
		return
	}

	// Ensure DB
	if getDB() == nil {
		if _, err := dbpkg.Init(); err != nil {
			appErrors.Internal("Database initialization failed", err).Response(c)
			return
		}
	}

	var u models.User
	err = getDB().Where("email = ?", ti.Email).First(&u).Error
	if err != nil {
		// If not found, create a user record
		if err == gorm.ErrRecordNotFound {
			u = models.User{Email: ti.Email, Role: "user"}
			if err := getDB().Create(&u).Error; err != nil {
				appErrors.Internal("User creation failed", err).Response(c)
				return
			}
		} else {
			appErrors.Internal("Database error", err).Response(c)
			return
		}
	}

	// Issue our JWT
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":   u.ID,
		"email": u.Email,
		"role":  u.Role,
		"exp":   time.Now().Add(time.Duration(cfg.SessionTimeout) * time.Hour).Unix(),
	})
	s, err := token.SignedString([]byte(cfg.JWTSecret))
	if err != nil {
		appErrors.Internal("Token generation failed", err).Response(c)
		return
	}

	// Set cookie like Login
	c.SetCookie("session", s, cfg.SessionTimeout*3600, "/", "", cfg.CookieSecure, true)
	c.JSON(200, gin.H{"token": s})
}
