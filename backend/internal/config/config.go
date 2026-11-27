package config

import (
	"fmt"
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
	BrevoAPIKey    string
	ResendAPIKey   string
	SMTPHost       string
	SMTPPort       string
	SMTPUser       string
	SMTPPass       string
	SMTPFrom       string
	FrontendURL    string
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

	brevoAPIKey := strings.TrimSpace(os.Getenv("BREVO_API_KEY"))
	resendAPIKey := strings.TrimSpace(os.Getenv("RESEND_API_KEY"))
	smtpUser := strings.TrimSpace(os.Getenv("SMTP_USER"))
	smtpPass := strings.ReplaceAll(strings.TrimSpace(os.Getenv("SMTP_PASS")), " ", "")
	smtpHost := strings.TrimSpace(os.Getenv("SMTP_HOST"))
	if smtpHost == "" && smtpUser != "" {
		smtpHost = "smtp.gmail.com"
	}
	smtpPort := strings.TrimSpace(os.Getenv("SMTP_PORT"))
	if smtpPort == "" {
		smtpPort = "587"
	}
	smtpFrom := strings.TrimSpace(os.Getenv("SMTP_FROM"))
	if smtpFrom == "" && smtpUser != "" {
		smtpFrom = fmt.Sprintf("DealHunter <%s>", smtpUser)
	}
	frontendURL := strings.TrimRight(strings.TrimSpace(os.Getenv("FRONTEND_URL")), "/")
	if frontendURL == "" {
		frontendURL = "https://dealhunter.netlify.app"
	}

	return &Config{
		Port:           port,
		DatabaseURL:    dbURL,
		JWTSecret:      jwtSecret,
		GoogleClientID: googleClientID,
		AdminEmail:     adminEmail,
		BrevoAPIKey:    brevoAPIKey,
		ResendAPIKey:   resendAPIKey,
		SMTPHost:       smtpHost,
		SMTPPort:       smtpPort,
		SMTPUser:       smtpUser,
		SMTPPass:       smtpPass,
		SMTPFrom:       smtpFrom,
		FrontendURL:    frontendURL,
	}
}
