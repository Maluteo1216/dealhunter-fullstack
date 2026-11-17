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

	count, err := h.syncService.IngestDeals(r.Context(), "browser_ingest", payload)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error":     "Error parcial durante la sincronización: " + err.Error(),
			"processed": count,
		})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message":   "Sincronización completada exitosamente",
		"processed": count,
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
		"message":   "Sincronización directa desde servidor completada",
		"processed": count,
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
