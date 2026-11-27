package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"price-tracker-backend/internal/middleware"
	"price-tracker-backend/internal/models"
)

type WishlistHandler struct {
	db *sql.DB
}

func NewWishlistHandler(db *sql.DB) *WishlistHandler {
	return &WishlistHandler{db: db}
}

// GetWishlist lista los juegos en la lista de deseos del usuario con su mejor precio actual
func (h *WishlistHandler) GetWishlist(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	userID, err := middleware.GetUserIDFromContext(r.Context())
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "No autorizado"})
		return
	}

	rows, err := h.db.QueryContext(r.Context(), `
		WITH ranked_deals AS (
			SELECT 
				sp.game_id,
				sp.product_url,
				st.name AS store_name,
				st.logo_url AS store_logo,
				cp.current_price,
				cp.discount_percentage,
				ROW_NUMBER() OVER(PARTITION BY sp.game_id ORDER BY cp.current_price ASC) as rank
			FROM store_products sp
			INNER JOIN current_prices cp ON cp.store_product_id = sp.id
			INNER JOIN stores st ON st.id = sp.store_id
			WHERE st.is_active = true AND st.external_store_id IN ('1', '25', '7', '11')
		)
		SELECT 
			w.id, w.user_id, w.game_id, g.title, g.slug, COALESCE(g.cover_image_url, ''),
			w.target_price, rd.current_price, rd.discount_percentage,
			COALESCE(rd.store_name, ''), COALESCE(rd.store_logo, ''), 
			COALESCE(rd.product_url, ''), w.notify_active, w.created_at
		FROM wishlists w
		INNER JOIN games g ON g.id = w.game_id
		LEFT JOIN ranked_deals rd ON rd.game_id = g.id AND rd.rank = 1
		WHERE w.user_id = $1
		ORDER BY w.created_at DESC;
	`, userID)

	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error al consultar lista de deseos: " + err.Error()})
		return
	}
	defer rows.Close()

	items := make([]models.WishlistItem, 0)
	for rows.Next() {
		var item models.WishlistItem
		var curPrice, discPerc sql.NullFloat64

		if err := rows.Scan(
			&item.ID, &item.UserID, &item.GameID, &item.GameTitle, &item.GameSlug,
			&item.GameCover, &item.TargetPrice, &curPrice, &discPerc,
			&item.StoreName, &item.StoreLogo, &item.ProductURL,
			&item.NotifyActive, &item.CreatedAt,
		); err == nil {
			if curPrice.Valid {
				cp := curPrice.Float64
				item.CurrentBestPrice = &cp
			}
			if discPerc.Valid {
				dp := discPerc.Float64
				item.CurrentDiscount = &dp
			}
			items = append(items, item)
		}
	}

	json.NewEncoder(w).Encode(items)
}

// AddToWishlist agrega o actualiza un juego en la lista de deseos con su precio objetivo
func (h *WishlistHandler) AddToWishlist(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	userID, err := middleware.GetUserIDFromContext(r.Context())
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "No autorizado"})
		return
	}

	var req models.WishlistRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.GameID <= 0 || req.TargetPrice < 0 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "game_id válido y target_price mayor o igual a 0.00 son obligatorios"})
		return
	}

	var wishlistID int
	err = h.db.QueryRowContext(r.Context(), `
		INSERT INTO wishlists (user_id, game_id, target_price, notify_active, created_at)
		VALUES ($1, $2, $3, true, NOW())
		ON CONFLICT (user_id, game_id) DO UPDATE SET
			target_price = EXCLUDED.target_price,
			notify_active = true
		RETURNING id;
	`, userID, req.GameID, req.TargetPrice).Scan(&wishlistID)

	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error al guardar en lista de deseos: " + err.Error()})
		return
	}

	// Verificar si el precio objetivo es igual o mayor al precio actual para disparar una alerta en la página
	var bestPrice float64
	var storeName, gameTitle string
	err = h.db.QueryRowContext(r.Context(), `
		SELECT cp.current_price, st.name, g.title
		FROM store_products sp
		JOIN current_prices cp ON cp.store_product_id = sp.id
		JOIN stores st ON st.id = sp.store_id
		JOIN games g ON g.id = sp.game_id
		WHERE sp.game_id = $1 AND st.is_active = true AND st.external_store_id IN ('1', '25', '7', '11')
		ORDER BY cp.current_price ASC
		LIMIT 1;
	`, req.GameID).Scan(&bestPrice, &storeName, &gameTitle)

	if err == nil && bestPrice <= req.TargetPrice {
		var countExisting int
		_ = h.db.QueryRowContext(r.Context(), `
			SELECT COUNT(*) FROM price_alerts 
			WHERE wishlist_id = $1 AND store_name = $2 
			  AND triggered_price = $3 AND triggered_at > NOW() - INTERVAL '24 hours';
		`, wishlistID, storeName, bestPrice).Scan(&countExisting)

		if countExisting == 0 {
			msg := fmt.Sprintf("¡%s ya está a solo $%.2f en %s (cumple tu objetivo de $%.2f)!", gameTitle, bestPrice, storeName, req.TargetPrice)
			_, _ = h.db.ExecContext(r.Context(), `
				INSERT INTO price_alerts (wishlist_id, store_name, triggered_price, message, is_read, triggered_at)
				VALUES ($1, $2, $3, $4, false, NOW());
			`, wishlistID, storeName, bestPrice, msg)
		}
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":           wishlistID,
		"game_id":      req.GameID,
		"target_price": req.TargetPrice,
		"message":      "Juego guardado en tu lista de deseos",
	})
}

// DeleteFromWishlist elimina un juego de la lista de deseos
func (h *WishlistHandler) DeleteFromWishlist(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	userID, err := middleware.GetUserIDFromContext(r.Context())
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "No autorizado"})
		return
	}

	gameID, err := strconv.Atoi(chi.URLParam(r, "gameId"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "ID de juego inválido"})
		return
	}

	result, err := h.db.ExecContext(r.Context(), `
		DELETE FROM wishlists WHERE user_id = $1 AND game_id = $2;
	`, userID, gameID)

	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error al eliminar de lista de deseos: " + err.Error()})
		return
	}

	rowsAff, _ := result.RowsAffected()
	if rowsAff == 0 {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "El juego no estaba en tu lista de deseos"})
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"message": "Juego removido de la lista de deseos"})
}
