package controllers

import (
	"encoding/json"
	"net/http"
	"net/url"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	dbpkg "github.com/oreo-io/oreo.io-v2/go-service/db"
	"github.com/oreo-io/oreo.io-v2/go-service/models"
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	if getDB() == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
	}
	hashed, err := hashPassword(req.Password)
	if err != nil {
		c.JSON(500, gin.H{"error": "hash"})
		return
	}
	u := models.User{Email: req.Email, Password: hashed, Role: "user"}
	if err := getDB().Create(&u).Error; err != nil {
		c.JSON(409, gin.H{"error": "email_exists"})
		return
	}
	c.JSON(201, gin.H{"id": u.ID, "email": u.Email})
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
		c.JSON(401, gin.H{"error": "invalid_creds"})
		return
	}

	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "dev-secret"
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":   u.ID,
		"email": u.Email,
		"role":  u.Role,
		"exp":   time.Now().Add(24 * time.Hour).Unix(),
	})
	s, err := token.SignedString([]byte(secret))
	if err != nil {
		c.JSON(500, gin.H{"error": "token"})
		return
	}

	// Cookie flags: allow optional COOKIE_SECURE env to control Secure flag
	secure := false
	if os.Getenv("COOKIE_SECURE") == "true" {
		secure = true
	}
	// Set httpOnly cookie named "session" with the JWT
	// MaxAge in seconds (24h)
	c.SetCookie("session", s, 24*3600, "/", "", secure, true)

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
		secret := os.Getenv("JWT_SECRET")
		if secret == "" {
			secret = "dev-secret"
		}
		token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) { return []byte(secret), nil })
		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(401, gin.H{"error": "invalid_token"})
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
	// Clear cookie. For dev, Secure=false; in prod set COOKIE_SECURE=true
	secure := false
	if os.Getenv("COOKIE_SECURE") == "true" {
		secure = true
	}
	// MaxAge -1 instructs browser to delete cookie
	c.SetCookie("session", "", -1, "/", "", secure, true)
	c.JSON(200, gin.H{"ok": true})
}

func Refresh(c *gin.Context) {
	// Requires Authorization header; issue a new token with fresh exp
	auth := c.GetHeader("Authorization")
	if len(auth) < 8 || auth[:7] != "Bearer " {
		c.JSON(401, gin.H{"error": "missing_token"})
		return
	}
	tokenStr := auth[7:]
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "dev-secret"
	}
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) { return []byte(secret), nil })
	if err != nil || !token.Valid {
		c.JSON(401, gin.H{"error": "invalid_token"})
		return
	}

	claims, _ := token.Claims.(jwt.MapClaims)
	// Build a fresh token; in future use separate refresh tokens (TODO)
	newTok := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":   claims["sub"],
		"email": claims["email"],
		"role":  claims["role"],
		"exp":   time.Now().Add(24 * time.Hour).Unix(),
	})
	s, err := newTok.SignedString([]byte(secret))
	if err != nil {
		c.JSON(500, gin.H{"error": "token"})
		return
	}
	c.JSON(200, gin.H{"token": s})
}

// GoogleLoginRequest represents the payload from Google Identity Services callback
type GoogleLoginRequest struct {
	IDToken string `json:"id_token" binding:"required"`
}

// GoogleLogin verifies the Google ID token and issues a JWT for our app.
// Requires env GOOGLE_CLIENT_ID to match the audience of the token.
func GoogleLogin(c *gin.Context) {
	var req GoogleLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_payload"})
		return
	}

	clientID := os.Getenv("GOOGLE_CLIENT_ID")
	if clientID == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server_not_configured"})
		return
	}

	// Validate the ID token using Google's tokeninfo endpoint
	resp, err := http.Get("https://oauth2.googleapis.com/tokeninfo?id_token=" + url.QueryEscape(req.IDToken))
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "google_unreachable"})
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid_google_token"})
		return
	}
	var ti struct {
		Aud           string `json:"aud"`
		Email         string `json:"email"`
		EmailVerified string `json:"email_verified"`
		Iss           string `json:"iss"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&ti); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid_google_token"})
		return
	}
	if ti.Aud != clientID {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "aud_mismatch"})
		return
	}
	if ti.Email == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "email_not_present"})
		return
	}
	if ti.EmailVerified != "true" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "email_not_verified"})
		return
	}
	claims := struct{ Email string }{Email: ti.Email}

	// Ensure DB
	if getDB() == nil {
		if _, err := dbpkg.Init(); err != nil {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
	}

	var u models.User
	err = getDB().Where("email = ?", claims.Email).First(&u).Error
	if err != nil {
		// If not found, create a user record
		if err == gorm.ErrRecordNotFound {
			u = models.User{Email: claims.Email, Role: "user"}
			if err := getDB().Create(&u).Error; err != nil {
				c.JSON(500, gin.H{"error": "user_create_failed"})
				return
			}
		} else {
			c.JSON(500, gin.H{"error": "db"})
			return
		}
	}

	// Issue our JWT
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "dev-secret"
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":   u.ID,
		"email": u.Email,
		"role":  u.Role,
		"exp":   time.Now().Add(24 * time.Hour).Unix(),
	})
	s, err := token.SignedString([]byte(secret))
	if err != nil {
		c.JSON(500, gin.H{"error": "token"})
		return
	}
	// Set cookie like Login
	secure := false
	if os.Getenv("COOKIE_SECURE") == "true" {
		secure = true
	}
	c.SetCookie("session", s, 24*3600, "/", "", secure, true)
	c.JSON(200, gin.H{"token": s})
}
