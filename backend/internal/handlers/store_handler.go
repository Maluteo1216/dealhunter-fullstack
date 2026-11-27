package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"price-tracker-backend/internal/models"
)

type StoreHandler struct {
	db *sql.DB
}

func NewStoreHandler(db *sql.DB) *StoreHandler {
	return &StoreHandler{db: db}
}

// GetStores obtiene la lista de tiendas con conteo de ofertas disponibles
func (h *StoreHandler) GetStores(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if h.db == nil {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode([]models.Store{})
		return
	}

	rows, err := h.db.QueryContext(r.Context(), `
		SELECT 
			s.id, s.external_store_id, s.name, s.slug, s.base_url, 
			COALESCE(s.logo_url, ''), s.is_active,
			COUNT(sp.id) as deals_count
		FROM stores s
		LEFT JOIN store_products sp ON sp.store_id = s.id
		WHERE s.is_active = true AND s.external_store_id IN ('1', '25', '7', '11')
		GROUP BY s.id, s.external_store_id, s.name, s.slug, s.base_url, s.logo_url, s.is_active
		ORDER BY deals_count DESC, s.name ASC;
	`)

	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error al obtener tiendas: " + err.Error()})
		return
	}
	defer rows.Close()

	stores := make([]models.Store, 0)
	for rows.Next() {
		var s models.Store
		if err := rows.Scan(
			&s.ID, &s.ExternalStoreID, &s.Name, &s.Slug, &s.BaseURL,
			&s.LogoURL, &s.IsActive, &s.DealsCount,
		); err == nil {
			stores = append(stores, s)
		}
	}

	json.NewEncoder(w).Encode(stores)
}

// GetGenres obtiene la lista de géneros con conteo de videojuegos asociados
func (h *StoreHandler) GetGenres(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if h.db == nil {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode([]models.Genre{})
		return
	}

	rows, err := h.db.QueryContext(r.Context(), `
		SELECT ge.id, ge.name, ge.slug, COUNT(DISTINCT gg.game_id) AS games_count
		FROM genres ge
		INNER JOIN game_genres gg ON gg.genre_id = ge.id
		GROUP BY ge.id, ge.name, ge.slug
		HAVING COUNT(DISTINCT gg.game_id) > 0
		ORDER BY games_count DESC, ge.name ASC;
	`)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error al obtener géneros: " + err.Error()})
		return
	}
	defer rows.Close()

	genres := make([]models.Genre, 0)
	for rows.Next() {
		var g models.Genre
		if err := rows.Scan(&g.ID, &g.Name, &g.Slug, &g.GamesCount); err == nil {
			genres = append(genres, g)
		}
	}

	json.NewEncoder(w).Encode(genres)
}

// GetPublishers obtiene la lista de distribuidores/publishers con conteo de videojuegos asociados
func (h *StoreHandler) GetPublishers(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if h.db == nil {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode([]models.Publisher{})
		return
	}

	rows, err := h.db.QueryContext(r.Context(), `
		SELECT p.id, p.name, p.slug, COUNT(DISTINCT g.id) AS games_count
		FROM publishers p
		INNER JOIN games g ON g.publisher_id = p.id
		GROUP BY p.id, p.name, p.slug
		HAVING COUNT(DISTINCT g.id) > 0
		ORDER BY games_count DESC, p.name ASC;
	`)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error al obtener publishers: " + err.Error()})
		return
	}
	defer rows.Close()

	publishers := make([]models.Publisher, 0)
	for rows.Next() {
		var p models.Publisher
		if err := rows.Scan(&p.ID, &p.Name, &p.Slug, &p.GamesCount); err == nil {
			publishers = append(publishers, p)
		}
	}

	json.NewEncoder(w).Encode(publishers)
}
