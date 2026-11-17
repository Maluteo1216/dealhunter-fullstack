package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"price-tracker-backend/internal/middleware"
	"price-tracker-backend/internal/models"
)

type AuthHandler struct {
	db             *sql.DB
	jwtSecret      string
	googleClientID string
}

func NewAuthHandler(db *sql.DB, jwtSecret string, googleClientID string) *AuthHandler {
	return &AuthHandler{
		db:             db,
		jwtSecret:      jwtSecret,
		googleClientID: googleClientID,
	}
}

func (h *AuthHandler) generateToken(user models.User) (string, error) {
	claims := jwt.MapClaims{
		"user_id":  user.ID,
		"username": user.Username,
		"email":    user.Email,
		"exp":      time.Now().Add(7 * 24 * time.Hour).Unix(),
		"iat":      time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(h.jwtSecret))
}

// Register maneja el registro tradicional con email y contraseña
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req models.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Cuerpo de solicitud inválido"})
		return
	}

	req.Username = strings.TrimSpace(req.Username)
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	if req.Username == "" || req.Email == "" || len(req.Password) < 6 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Usuario, email válido y contraseña mínima de 6 caracteres requeridos"})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error al encriptar contraseña"})
		return
	}

	var user models.User
	user.Username = req.Username
	user.Email = req.Email

	err = h.db.QueryRowContext(r.Context(), `
		INSERT INTO users (username, email, password_hash, created_at)
		VALUES ($1, $2, $3, NOW())
		RETURNING id, username, email, avatar_url, created_at;
	`, req.Username, req.Email, string(hashedPassword)).Scan(
		&user.ID, &user.Username, &user.Email, &user.AvatarURL, &user.CreatedAt,
	)

	if err != nil {
		w.WriteHeader(http.StatusConflict)
		json.NewEncoder(w).Encode(map[string]string{"error": "El nombre de usuario o correo ya se encuentra registrado"})
		return
	}

	token, err := h.generateToken(user)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error al generar token"})
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(models.AuthResponse{
		Token: token,
		User: models.UserDTO{
			ID:        user.ID,
			Username:  user.Username,
			Email:     user.Email,
			AvatarURL: user.AvatarURL,
			CreatedAt: user.CreatedAt,
		},
	})
}

// Login maneja el inicio de sesión con email y contraseña
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Cuerpo de solicitud inválido"})
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	var user models.User
	var passwordHash string
	err := h.db.QueryRowContext(r.Context(), `
		SELECT id, username, email, password_hash, avatar_url, created_at
		FROM users
		WHERE email = $1;
	`, req.Email).Scan(&user.ID, &user.Username, &user.Email, &passwordHash, &user.AvatarURL, &user.CreatedAt)

	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "Credenciales inválidas"})
		return
	}

	if passwordHash == "" {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "Esta cuenta fue creada con Google. Por favor, inicia sesión con Google."})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "Credenciales inválidas"})
		return
	}

	token, err := h.generateToken(user)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error al generar token"})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(models.AuthResponse{
		Token: token,
		User: models.UserDTO{
			ID:        user.ID,
			Username:  user.Username,
			Email:     user.Email,
			AvatarURL: user.AvatarURL,
			CreatedAt: user.CreatedAt,
		},
	})
}

// GoogleLogin maneja la autenticación obligatoria con Google OAuth (Google Identity Services)
func (h *AuthHandler) GoogleLogin(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req models.GoogleAuthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Credential == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Token o credencial de Google es obligatoria"})
		return
	}

	// 1. Validar el token con el endpoint oficial de verificación de Google
	resp, err := http.Get("https://oauth2.googleapis.com/tokeninfo?id_token=" + req.Credential)
	if err != nil {
		w.WriteHeader(http.StatusBadGateway)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error al contactar a los servidores de autenticación de Google"})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "Token de Google inválido o expirado"})
		return
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error al leer respuesta de Google"})
		return
	}

	var googleProfile struct {
		Sub           string `json:"sub"`
		Email         string `json:"email"`
		EmailVerified string `json:"email_verified"`
		Name          string `json:"name"`
		Picture       string `json:"picture"`
	}

	if err := json.Unmarshal(body, &googleProfile); err != nil || googleProfile.Email == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "No se pudo extraer la información del perfil de Google"})
		return
	}

	email := strings.ToLower(strings.TrimSpace(googleProfile.Email))
	googleID := googleProfile.Sub
	avatarURL := googleProfile.Picture

	var user models.User

	// 2. Buscar si el usuario ya existe por google_id o por email
	err = h.db.QueryRowContext(r.Context(), `
		SELECT id, username, email, avatar_url, created_at
		FROM users
		WHERE google_id = $1 OR email = $2;
	`, googleID, email).Scan(&user.ID, &user.Username, &user.Email, &user.AvatarURL, &user.CreatedAt)

	if err == sql.ErrNoRows {
		// Crear nuevo usuario vinculado a Google
		baseUsername := strings.Split(email, "@")[0]
		if googleProfile.Name != "" {
			cleanName := strings.ToLower(strings.ReplaceAll(googleProfile.Name, " ", "_"))
			if len(cleanName) > 20 {
				cleanName = cleanName[:20]
			}
			baseUsername = cleanName
		}

		uniqueUsername := baseUsername
		// Manejar colisiones de username
		for i := 1; i <= 5; i++ {
			var exists int
			_ = h.db.QueryRowContext(r.Context(), `SELECT 1 FROM users WHERE username = $1`, uniqueUsername).Scan(&exists)
			if exists == 0 {
				break
			}
			uniqueUsername = fmt.Sprintf("%s_%d", baseUsername, time.Now().UnixNano()%1000)
		}

		err = h.db.QueryRowContext(r.Context(), `
			INSERT INTO users (username, email, password_hash, google_id, avatar_url, created_at)
			VALUES ($1, $2, '', $3, $4, NOW())
			RETURNING id, username, email, avatar_url, created_at;
		`, uniqueUsername, email, googleID, avatarURL).Scan(
			&user.ID, &user.Username, &user.Email, &user.AvatarURL, &user.CreatedAt,
		)

		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": "Error al registrar usuario de Google en la base de datos"})
			return
		}
	} else if err == nil {
		// Actualizar google_id y avatar si estaban vacíos
		_, _ = h.db.ExecContext(r.Context(), `
			UPDATE users 
			SET google_id = COALESCE(NULLIF(google_id, ''), $1),
			    avatar_url = COALESCE(NULLIF($2, ''), avatar_url)
			WHERE id = $3;
		`, googleID, avatarURL, user.ID)
		if avatarURL != "" {
			user.AvatarURL = avatarURL
		}
	} else {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error consultando base de datos"})
		return
	}

	token, err := h.generateToken(user)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error al generar token JWT"})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(models.AuthResponse{
		Token: token,
		User: models.UserDTO{
			ID:        user.ID,
			Username:  user.Username,
			Email:     user.Email,
			AvatarURL: user.AvatarURL,
			CreatedAt: user.CreatedAt,
		},
	})
}

// Me obtiene el perfil del usuario autenticado
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	userID, err := middleware.GetUserIDFromContext(r.Context())
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "No autorizado"})
		return
	}

	var user models.UserDTO
	err = h.db.QueryRowContext(r.Context(), `
		SELECT id, username, email, avatar_url, created_at
		FROM users
		WHERE id = $1;
	`, userID).Scan(&user.ID, &user.Username, &user.Email, &user.AvatarURL, &user.CreatedAt)

	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "Usuario no encontrado"})
		return
	}

	json.NewEncoder(w).Encode(user)
}
