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
		WHERE s.is_active = true
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
