package middleware

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/cors"
	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const (
	UserIDKey      contextKey = "user_id"
	UserEmailKey   contextKey = "user_email"
	UserIsAdminKey contextKey = "user_is_admin"
)

// CorsMiddleware configura los encabezados CORS para permitir comunicación desde el frontend
func CorsMiddleware() func(http.Handler) http.Handler {
	return cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"}, // Permite localhost, Netlify y cualquier origen en producción/demo
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: false, // Debe ser false si AllowedOrigins tiene "*"
		MaxAge:           300,
	})
}

// AuthMiddleware valida el token JWT en rutas privadas
func AuthMiddleware(jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, `{"error": "Encabezado de autorización faltante"}`, http.StatusUnauthorized)
				return
			}

			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
				http.Error(w, `{"error": "Formato de token inválido. Use 'Bearer <token>'"}`, http.StatusUnauthorized)
				return
			}

			tokenString := parts[1]

			token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
				if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, errors.New("método de firma no válido")
				}
				return []byte(jwtSecret), nil
			})

			if err != nil || !token.Valid {
				http.Error(w, `{"error": "Token expirado o inválido"}`, http.StatusUnauthorized)
				return
			}

			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				http.Error(w, `{"error": "No se pudieron procesar los claims del token"}`, http.StatusUnauthorized)
				return
			}

			var userID int
			switch v := claims["user_id"].(type) {
			case float64:
				userID = int(v)
			case int:
				userID = v
			default:
				http.Error(w, `{"error": "ID de usuario inválido en token"}`, http.StatusUnauthorized)
				return
			}

			userEmail, _ := claims["email"].(string)
			isAdmin, _ := claims["is_admin"].(bool)

			ctx := context.WithValue(r.Context(), UserIDKey, userID)
			ctx = context.WithValue(ctx, UserEmailKey, userEmail)
			ctx = context.WithValue(ctx, UserIsAdminKey, isAdmin)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireAdminMiddleware verifica que el usuario autenticado tenga rol de administrador o correo autorizado
func RequireAdminMiddleware(adminEmail string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			isAdmin, _ := r.Context().Value(UserIsAdminKey).(bool)
			userEmail, _ := r.Context().Value(UserEmailKey).(string)

			// Si tiene el flag is_admin o coincide con el ADMIN_EMAIL configurado
			isAuthorized := isAdmin || (adminEmail != "" && userEmail != "" && strings.EqualFold(userEmail, adminEmail))
			if !isAuthorized {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusForbidden)
				w.Write([]byte(`{"error": "Acceso restringido: Se requieren privilegios de Administrador para acceder a esta sección"}`))
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// GetUserIDFromContext extrae de manera segura el user_id del contexto de la petición
func GetUserIDFromContext(ctx context.Context) (int, error) {
	val := ctx.Value(UserIDKey)
	if val == nil {
		return 0, errors.New("usuario no autenticado en contexto")
	}
	userID, ok := val.(int)
	if !ok {
		return 0, errors.New("tipo de usuario inválido en contexto")
	}
	return userID, nil
}
