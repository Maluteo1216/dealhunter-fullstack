package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"price-tracker-backend/internal/models"
)

type SyncService struct {
	db *sql.DB
}

func NewSyncService(db *sql.DB) *SyncService {
	return &SyncService{db: db}
}

var nonAlphaNumRegex = regexp.MustCompile(`[^a-z0-9]+`)

// CleanSlug convierte títulos como "The Witcher 3: Wild Hunt" en "the-witcher-3-wild-hunt"
func CleanSlug(title string) string {
	lower := strings.ToLower(strings.TrimSpace(title))
	slug := nonAlphaNumRegex.ReplaceAllString(lower, "-")
	slug = strings.Trim(slug, "-")
	if slug == "" {
		slug = fmt.Sprintf("game-%d", time.Now().UnixNano()%100000)
	}
	return slug
}

// IngestDeals procesa un conjunto de ofertas y tiendas garantizando integridad referencial
func (s *SyncService) IngestDeals(ctx context.Context, source string, payload models.SyncIngestPayload) (int, error) {
	if s.db == nil {
		return 0, fmt.Errorf("base de datos no conectada")
	}

	processedCount := 0
	var syncErr error

	// 1. Sincronizar Tiendas si vienen en el payload
	for _, store := range payload.Stores {
		slug := CleanSlug(store.StoreName)
		logoURL := fmt.Sprintf("https://www.cheapshark.com%s", store.Images.Logo)
		if !strings.HasPrefix(store.Images.Logo, "/") {
			logoURL = fmt.Sprintf("https://www.cheapshark.com/img/stores/logos/%s.png", store.StoreID)
		}

		_, err := s.db.ExecContext(ctx, `
			INSERT INTO stores (external_store_id, name, slug, base_url, logo_url, is_active)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (external_store_id) DO UPDATE SET
				name = EXCLUDED.name,
				logo_url = COALESCE(EXCLUDED.logo_url, stores.logo_url),
				is_active = EXCLUDED.is_active;
		`, store.StoreID, store.StoreName, slug, "https://www.cheapshark.com", logoURL, store.IsActive == 1)
		if err != nil {
			log.Printf("Aviso al guardar tienda %s: %v", store.StoreName, err)
		}
	}

	// 2. Mapear todas las tiendas en memoria para consultas ultrarrápidas
	storeMap := make(map[string]models.Store)
	rows, err := s.db.QueryContext(ctx, `SELECT id, external_store_id, name, slug, logo_url FROM stores`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var st models.Store
			if err := rows.Scan(&st.ID, &st.ExternalStoreID, &st.Name, &st.Slug, &st.LogoURL); err == nil {
				storeMap[st.ExternalStoreID] = st
			}
		}
	}

	// 3. Procesar cada oferta
	for _, deal := range payload.Deals {
		salePrice, err := strconv.ParseFloat(deal.SalePrice, 64)
		if err != nil {
			continue
		}
		normalPrice, err := strconv.ParseFloat(deal.NormalPrice, 64)
		if err != nil || normalPrice <= 0 {
			normalPrice = salePrice
		}

		savings, err := strconv.ParseFloat(deal.Savings, 64)
		if err != nil {
			if normalPrice > 0 && salePrice < normalPrice {
				savings = math.Round((1.0-salePrice/normalPrice)*10000) / 100
			} else {
				savings = 0.0
			}
		}

		isOnSale := salePrice < normalPrice

		// Identificar o crear tienda si no existe (Prohibido asignar Steam por defecto)
		store, exists := storeMap[deal.StoreID]
		if !exists {
			storeName := fmt.Sprintf("Store %s", deal.StoreID)
			storeSlug := fmt.Sprintf("store-%s", deal.StoreID)
			logoURL := fmt.Sprintf("https://www.cheapshark.com/img/stores/logos/%s.png", deal.StoreID)
			var newStoreID int
			err := s.db.QueryRowContext(ctx, `
				INSERT INTO stores (external_store_id, name, slug, base_url, logo_url, is_active)
				VALUES ($1, $2, $3, $4, $5, true)
				ON CONFLICT (external_store_id) DO UPDATE SET name = EXCLUDED.name
				RETURNING id;
			`, deal.StoreID, storeName, storeSlug, "https://www.cheapshark.com", logoURL).Scan(&newStoreID)
			if err != nil {
				log.Printf("Error al registrar tienda externa %s: %v", deal.StoreID, err)
				continue
			}
			store = models.Store{
				ID:              newStoreID,
				ExternalStoreID: deal.StoreID,
				Name:            storeName,
				Slug:            storeSlug,
				LogoURL:         logoURL,
			}
			storeMap[deal.StoreID] = store
		}

		// Ejecución transaccional por juego/oferta
		tx, err := s.db.BeginTx(ctx, nil)
		if err != nil {
			log.Printf("Error iniciando transacción: %v", err)
			continue
		}

		slug := CleanSlug(deal.Title)
		productURL := fmt.Sprintf("https://www.cheapshark.com/redirect?dealID=%s", deal.DealID)

		// A. UPSERT en games
		var gameID int
		var currentHistLow sql.NullFloat64

		err = tx.QueryRowContext(ctx, `
			SELECT id, historical_low_price FROM games WHERE slug = $1;
		`, slug).Scan(&gameID, &currentHistLow)

		if err == sql.ErrNoRows {
			// Crear nuevo juego
			err = tx.QueryRowContext(ctx, `
				INSERT INTO games (title, slug, cover_image_url, steam_app_id, historical_low_price, historical_low_date)
				VALUES ($1, $2, $3, $4, $5, NOW())
				RETURNING id;
			`, deal.Title, slug, deal.Thumb, deal.SteamAppID, salePrice).Scan(&gameID)
			if err != nil {
				tx.Rollback()
				continue
			}
		} else if err == nil {
			// Actualizar juego existente si este precio es un nuevo mínimo histórico
			newHistLow := currentHistLow.Float64
			shouldUpdateDate := false
			if !currentHistLow.Valid || salePrice < currentHistLow.Float64 {
				newHistLow = salePrice
				shouldUpdateDate = true
			}

			if shouldUpdateDate {
				_, _ = tx.ExecContext(ctx, `
					UPDATE games 
					SET cover_image_url = COALESCE(NULLIF($1, ''), cover_image_url),
					    steam_app_id = COALESCE(NULLIF($2, ''), steam_app_id),
					    historical_low_price = $3,
					    historical_low_date = NOW()
					WHERE id = $4;
				`, deal.Thumb, deal.SteamAppID, newHistLow, gameID)
			} else {
				_, _ = tx.ExecContext(ctx, `
					UPDATE games 
					SET cover_image_url = COALESCE(NULLIF($1, ''), cover_image_url),
					    steam_app_id = COALESCE(NULLIF($2, ''), steam_app_id)
					WHERE id = $3;
				`, deal.Thumb, deal.SteamAppID, gameID)
			}
		} else {
			tx.Rollback()
			continue
		}

		// B. UPSERT en store_products
		var storeProductID int
		err = tx.QueryRowContext(ctx, `
			INSERT INTO store_products (game_id, store_id, external_game_id, external_deal_id, product_url)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (game_id, store_id) DO UPDATE SET
				external_deal_id = EXCLUDED.external_deal_id,
				product_url = EXCLUDED.product_url
			RETURNING id;
		`, gameID, store.ID, deal.GameID, deal.DealID, productURL).Scan(&storeProductID)
		if err != nil {
			tx.Rollback()
			continue
		}

		// C. Consultar precio anterior en current_prices
		var prevPrice sql.NullFloat64
		_ = tx.QueryRowContext(ctx, `
			SELECT current_price FROM current_prices WHERE store_product_id = $1;
		`, storeProductID).Scan(&prevPrice)

		// D. UPSERT en current_prices
		_, err = tx.ExecContext(ctx, `
			INSERT INTO current_prices (store_product_id, regular_price, current_price, discount_percentage, is_on_sale, currency, last_updated)
			VALUES ($1, $2, $3, $4, $5, 'USD', NOW())
			ON CONFLICT (store_product_id) DO UPDATE SET
				regular_price = EXCLUDED.regular_price,
				current_price = EXCLUDED.current_price,
				discount_percentage = EXCLUDED.discount_percentage,
				is_on_sale = EXCLUDED.is_on_sale,
				currency = 'USD',
				last_updated = NOW();
		`, storeProductID, normalPrice, salePrice, savings, isOnSale)
		if err != nil {
			tx.Rollback()
			continue
		}

		// E. Insertar en price_history si es nuevo o cambió el precio
		if !prevPrice.Valid || math.Abs(prevPrice.Float64-salePrice) > 0.009 {
			_, _ = tx.ExecContext(ctx, `
				INSERT INTO price_history (store_product_id, regular_price, sale_price, discount_percentage, recorded_at)
				VALUES ($1, $2, $3, $4, NOW());
			`, storeProductID, normalPrice, salePrice, savings)
		}

		// F. Revisión de Wishlists y Disparo de Alertas
		rowsW, err := tx.QueryContext(ctx, `
			SELECT w.id, w.user_id, w.target_price
			FROM wishlists w
			WHERE w.game_id = $1 AND w.notify_active = true AND w.target_price >= $2;
		`, gameID, salePrice)
		if err == nil {
			type wishMatch struct {
				id          int
				userID      int
				targetPrice float64
			}
			var matches []wishMatch
			for rowsW.Next() {
				var m wishMatch
				if err := rowsW.Scan(&m.id, &m.userID, &m.targetPrice); err == nil {
					matches = append(matches, m)
				}
			}
			rowsW.Close()

			for _, m := range matches {
				// Evitar duplicar alertas recientes idénticas (en las últimas 24 horas)
				var countAlerts int
				_ = tx.QueryRowContext(ctx, `
					SELECT COUNT(*) FROM price_alerts 
					WHERE wishlist_id = $1 AND store_name = $2 
					  AND triggered_price = $3 AND triggered_at > NOW() - INTERVAL '24 hours';
				`, m.id, store.Name, salePrice).Scan(&countAlerts)

				if countAlerts == 0 {
					alertMsg := fmt.Sprintf("¡%s está en oferta en %s por solo $%.2f (tu precio objetivo era $%.2f, -%.0f%%)!",
						deal.Title, store.Name, salePrice, m.targetPrice, savings)

					_, _ = tx.ExecContext(ctx, `
						INSERT INTO price_alerts (wishlist_id, store_name, triggered_price, message, is_read, triggered_at)
						VALUES ($1, $2, $3, $4, false, NOW());
					`, m.id, store.Name, salePrice, alertMsg)
				}
			}
		}

		if err := tx.Commit(); err == nil {
			processedCount++
		}
	}

	// Registrar en sync_logs
	status := "success"
	var errMsg *string
	if syncErr != nil {
		status = "error"
		s := syncErr.Error()
		errMsg = &s
	}

	_, _ = s.db.ExecContext(ctx, `
		INSERT INTO sync_logs (source, deals_processed, status, error_message, executed_at)
		VALUES ($1, $2, $3, $4, NOW());
	`, source, processedCount, status, errMsg)

	return processedCount, syncErr
}

// FetchFromServer intenta sincronizar directamente desde Go con cabeceras de navegador
func (s *SyncService) FetchFromServer(ctx context.Context) (int, error) {
	client := &http.Client{Timeout: 15 * time.Second}

	req, err := http.NewRequestWithContext(ctx, "GET", "https://www.cheapshark.com/api/1.0/deals?onSale=1&pageSize=60", nil)
	if err != nil {
		return 0, err
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return 0, fmt.Errorf("error de conexión con CheapShark: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return 0, fmt.Errorf("CheapShark retornó código %d: %s", resp.StatusCode, string(body))
	}

	// También obtener tiendas
	reqStores, _ := http.NewRequestWithContext(ctx, "GET", "https://www.cheapshark.com/api/1.0/stores", nil)
	reqStores.Header.Set("User-Agent", req.Header.Get("User-Agent"))
	reqStores.Header.Set("Accept", "application/json")

	var stores []models.CheapSharkStore
	if respStores, err := client.Do(reqStores); err == nil {
		defer respStores.Body.Close()
		if respStores.StatusCode == http.StatusOK {
			bodyStores, _ := io.ReadAll(respStores.Body)
			_ = json.Unmarshal(bodyStores, &stores)
		}
	}

	bodyDeals, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, err
	}

	var deals []models.CheapSharkDeal
	if err := json.Unmarshal(bodyDeals, &deals); err != nil {
		return 0, fmt.Errorf("error parseando JSON de CheapShark: %w", err)
	}

	payload := models.SyncIngestPayload{
		Deals:  deals,
		Stores: stores,
	}

	return s.IngestDeals(ctx, "server_sync", payload)
}
