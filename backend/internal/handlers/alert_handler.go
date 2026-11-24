package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"price-tracker-backend/internal/middleware"
	"price-tracker-backend/internal/models"
)

type AlertHandler struct {
	db *sql.DB
}

func NewAlertHandler(db *sql.DB) *AlertHandler {
	return &AlertHandler{db: db}
}

// GetAlerts lista las notificaciones de precios disparadas para el usuario autenticado
func (h *AlertHandler) GetAlerts(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	userID, err := middleware.GetUserIDFromContext(r.Context())
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "No autorizado"})
		return
	}

	rows, err := h.db.QueryContext(r.Context(), `
		SELECT 
			pa.id, pa.wishlist_id, g.title, g.slug, COALESCE(g.cover_image_url, ''),
			pa.store_name, pa.triggered_price, w.target_price, pa.message,
			pa.is_read, COALESCE(pa.email_sent, false), pa.triggered_at
		FROM price_alerts pa
		INNER JOIN wishlists w ON w.id = pa.wishlist_id
		INNER JOIN games g ON g.id = w.game_id
		WHERE w.user_id = $1
		ORDER BY pa.is_read ASC, pa.triggered_at DESC
		LIMIT 50;
	`, userID)

	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error al consultar alertas: " + err.Error()})
		return
	}
	defer rows.Close()

	alerts := make([]models.PriceAlert, 0)
	for rows.Next() {
		var a models.PriceAlert
		if err := rows.Scan(
			&a.ID, &a.WishlistID, &a.GameTitle, &a.GameSlug, &a.GameCover,
			&a.StoreName, &a.TriggeredPrice, &a.TargetPrice, &a.Message,
			&a.IsRead, &a.EmailSent, &a.TriggeredAt,
		); err == nil {
			alerts = append(alerts, a)
		}
	}

	json.NewEncoder(w).Encode(alerts)
}

// MarkAlertRead marca una notificación de alerta como leída
func (h *AlertHandler) MarkAlertRead(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	userID, err := middleware.GetUserIDFromContext(r.Context())
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "No autorizado"})
		return
	}

	alertID, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "ID de alerta inválido"})
		return
	}

	result, err := h.db.ExecContext(r.Context(), `
		UPDATE price_alerts pa
		SET is_read = true
		FROM wishlists w
		WHERE pa.wishlist_id = w.id AND pa.id = $1 AND w.user_id = $2;
	`, alertID, userID)

	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error al actualizar alerta"})
		return
	}

	rowsAff, _ := result.RowsAffected()
	if rowsAff == 0 {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "Alerta no encontrada o no pertenece al usuario"})
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"message": "Alerta marcada como leída"})
}
