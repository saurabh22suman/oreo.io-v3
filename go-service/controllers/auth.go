package controllers

import (
    "net/http"
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

func hashPassword(pw string) (string, error) { b, e := bcrypt.GenerateFromPassword([]byte(pw), bcrypt.DefaultCost); return string(b), e }
func checkPassword(hash, pw string) bool { return bcrypt.CompareHashAndPassword([]byte(hash), []byte(pw)) == nil }

func getDB() *gorm.DB { return dbpkg.Get() }

func Register(c *gin.Context) {
    var req Credentials
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"}); return
    }
    if getDB() == nil { if _, err := dbpkg.Init(); err != nil { c.JSON(500, gin.H{"error":"db"}); return } }
    hashed, err := hashPassword(req.Password)
    if err != nil { c.JSON(500, gin.H{"error":"hash"}); return }
    u := models.User{Email: req.Email, Password: hashed, Role: "user"}
    if err := getDB().Create(&u).Error; err != nil { c.JSON(409, gin.H{"error":"email_exists"}); return }
    c.JSON(201, gin.H{"id": u.ID, "email": u.Email})
}

func Login(c *gin.Context) {
    var req Credentials
    if err := c.ShouldBindJSON(&req); err != nil { c.JSON(400, gin.H{"error":"invalid payload"}); return }
    if getDB() == nil { if _, err := dbpkg.Init(); err != nil { c.JSON(500, gin.H{"error":"db"}); return } }
    var u models.User
    if err := getDB().Where("email = ?", req.Email).First(&u).Error; err != nil { c.JSON(401, gin.H{"error":"invalid_creds"}); return }
    if !checkPassword(u.Password, req.Password) { c.JSON(401, gin.H{"error":"invalid_creds"}); return }

    secret := os.Getenv("JWT_SECRET")
    if secret == "" { secret = "dev-secret" }
    token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
        "sub": u.ID,
        "email": u.Email,
        "role": u.Role,
        "exp": time.Now().Add(24*time.Hour).Unix(),
    })
    s, err := token.SignedString([]byte(secret))
    if err != nil { c.JSON(500, gin.H{"error":"token"}); return }
    c.JSON(200, gin.H{"token": s})
}

func AuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        auth := c.GetHeader("Authorization")
        if len(auth) < 8 || auth[:7] != "Bearer " { c.AbortWithStatusJSON(401, gin.H{"error":"missing_token"}); return }
        tokenStr := auth[7:]
        secret := os.Getenv("JWT_SECRET")
        if secret == "" { secret = "dev-secret" }
        token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) { return []byte(secret), nil })
        if err != nil || !token.Valid { c.AbortWithStatusJSON(401, gin.H{"error":"invalid_token"}); return }
        c.Next()
    }
}

func Refresh(c *gin.Context) {
    // Requires Authorization header; issue a new token with fresh exp
    auth := c.GetHeader("Authorization")
    if len(auth) < 8 || auth[:7] != "Bearer " { c.JSON(401, gin.H{"error":"missing_token"}); return }
    tokenStr := auth[7:]
    secret := os.Getenv("JWT_SECRET")
    if secret == "" { secret = "dev-secret" }
    token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) { return []byte(secret), nil })
    if err != nil || !token.Valid { c.JSON(401, gin.H{"error":"invalid_token"}); return }

    claims, _ := token.Claims.(jwt.MapClaims)
    // Build a fresh token; in future use separate refresh tokens (TODO)
    newTok := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
        "sub": claims["sub"],
        "email": claims["email"],
        "role": claims["role"],
        "exp": time.Now().Add(24*time.Hour).Unix(),
    })
    s, err := newTok.SignedString([]byte(secret))
    if err != nil { c.JSON(500, gin.H{"error":"token"}); return }
    c.JSON(200, gin.H{"token": s})
}
