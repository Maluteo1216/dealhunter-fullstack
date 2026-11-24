package config

import (
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port           string
	DatabaseURL    string
	JWTSecret      string
	GoogleClientID string
	AdminEmail     string
}

func LoadConfig() *Config {
	// Intenta cargar archivo .env en entorno local (no falla si no existe)
	if err := godotenv.Load(); err != nil {
		log.Println("Aviso: No se encontró archivo .env, usando variables de entorno del sistema")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "dev-secret-key-change-in-production-123456789"
	}

	dbURL := os.Getenv("DATABASE_URL")
	googleClientID := os.Getenv("GOOGLE_CLIENT_ID")
	adminEmail := strings.ToLower(strings.TrimSpace(os.Getenv("ADMIN_EMAIL")))

	return &Config{
		Port:           port,
		DatabaseURL:    dbURL,
		JWTSecret:      jwtSecret,
		GoogleClientID: googleClientID,
		AdminEmail:     adminEmail,
	}
}
