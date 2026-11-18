package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"price-tracker-backend/internal/models"
	"price-tracker-backend/internal/services"
)

type SyncHandler struct {
	db          *sql.DB
	syncService *services.SyncService
}

func NewSyncHandler(db *sql.DB, syncService *services.SyncService) *SyncHandler {
	return &SyncHandler{
		db:          db,
		syncService: syncService,
	}
}

// IngestDeals recibe las ofertas reales consumidas por el navegador del cliente y las persiste en PostgreSQL
func (h *SyncHandler) IngestDeals(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var payload models.SyncIngestPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Payload inválido: " + err.Error()})
		return
	}

	if len(payload.Deals) == 0 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "No se enviaron ofertas en el payload"})
		return
	}

	autoEnrich := r.URL.Query().Get("auto_enrich") == "true" || r.URL.Query().Get("auto_enrich") == "1"

	count, enriched, err := h.syncService.IngestDeals(r.Context(), "browser_ingest", payload, autoEnrich)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error":     "Error parcial durante la sincronización: " + err.Error(),
			"processed": count,
			"enriched":  enriched,
		})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message":   "Sincronización completada exitosamente",
		"processed": count,
		"enriched":  enriched,
	})
}

// RandomSync ejecuta el descubrimiento de ofertas aleatorias en CheapShark y auto-enriquece cada juego con múltiples tiendas
func (h *SyncHandler) RandomSync(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	result, err := h.syncService.FetchRandomFromServer(r.Context())
	if err != nil {
		w.WriteHeader(http.StatusBadGateway)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "Error en sincronización aleatoria del servidor: " + err.Error(),
		})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Sincronización aleatoria y auto-enriquecimiento completados exitosamente",
		"result":  result,
	})
}

// ServerSync intenta sincronizar directamente desde Go con CheapShark API
func (h *SyncHandler) ServerSync(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	count, err := h.syncService.FetchFromServer(r.Context())
	if err != nil {
		w.WriteHeader(http.StatusBadGateway)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error":     "Error en sincronización desde el servidor: " + err.Error(),
			"processed": count,
		})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message":   "Sincronización multi-tienda desde servidor completada exitosamente",
		"processed": count,
	})
}

// EnrichCatalog enriquece en lote videojuegos que solo tienen una tienda registrada
func (h *SyncHandler) EnrichCatalog(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	enrichedGames, totalStores, err := h.syncService.EnrichCatalogMultiStore(r.Context(), 25)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "Error al enriquecer catálogo: " + err.Error(),
		})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message":        "Enriquecimiento multi-tienda completado exitosamente",
		"enriched_games": enrichedGames,
		"stores_added":   totalStores,
	})
}

// GetSyncLogs obtiene las últimas 15 ejecuciones de sincronización
func (h *SyncHandler) GetSyncLogs(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if h.db == nil {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode([]models.SyncLog{})
		return
	}

	rows, err := h.db.QueryContext(r.Context(), `
		SELECT id, source, deals_processed, status, error_message, executed_at
		FROM sync_logs
		ORDER BY executed_at DESC
		LIMIT 15;
	`)

	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error al obtener historial de sincronización: " + err.Error()})
		return
	}
	defer rows.Close()

	logs := make([]models.SyncLog, 0)
	for rows.Next() {
		var l models.SyncLog
		var errMsg sql.NullString
		if err := rows.Scan(&l.ID, &l.Source, &l.DealsProcessed, &l.Status, &errMsg, &l.ExecutedAt); err == nil {
			if errMsg.Valid {
				l.ErrorMessage = &errMsg.String
			}
			logs = append(logs, l)
		}
	}

	json.NewEncoder(w).Encode(logs)
}
