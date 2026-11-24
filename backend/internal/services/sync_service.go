package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"math/rand"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"price-tracker-backend/internal/models"
)

// User-Agent descriptivo obligatorio requerido por CheapShark API para evitar HTTP 400
const CheapSharkUserAgent = "DealHunter/1.0 (contact@dealhunter.app; +https://dealhunter.netlify.app)"

type SyncService struct {
	db *sql.DB
}

func NewSyncService(db *sql.DB) *SyncService {
	return &SyncService{db: db}
}

var nonAlphaNumRegex = regexp.MustCompile(`[^a-z0-9]+`)
var onlyAlphaNumRegex = regexp.MustCompile(`[^a-z0-9]+`)

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

// NormalizeTitleForMatch convierte títulos a su forma canónica alfanumérica sin apóstrofes ni puntuación
// permitiendo que "DEATH STRANDING Director's Cut" y "DEATH STRANDING Directors Cut" coincidan al 100%
func NormalizeTitleForMatch(t string) string {
	t = strings.ReplaceAll(t, "'", "")
	t = strings.ReplaceAll(t, "’", "")
	t = strings.ReplaceAll(t, "`", "")
	t = strings.ReplaceAll(t, "´", "")
	return onlyAlphaNumRegex.ReplaceAllString(strings.ToLower(t), "")
}

// TitlesMatch compara si dos títulos corresponden al mismo videojuego resolviendo variaciones de puntuación
func TitlesMatch(titleA, titleB string) bool {
	normA := NormalizeTitleForMatch(titleA)
	normB := NormalizeTitleForMatch(titleB)
	if normA == "" || normB == "" {
		return false
	}
	if normA == normB {
		return true
	}
	if len(normA) >= 6 && len(normB) >= 6 {
		if strings.HasPrefix(normA, normB) || strings.HasPrefix(normB, normA) {
			diff := strings.TrimPrefix(normA, normB)
			if diff == "" {
				diff = strings.TrimPrefix(normB, normA)
			}
			// Evitar emparejar secuelas numéricas o DLCs/Upgrades con el juego base
			unwantedSuffixes := []string{
				"2", "3", "4", "5", "6", "7", "8", "9",
				"ii", "iii", "iv", "v", "vi", "vii", "viii",
				"upgrade", "soundtrack", "ost", "dlc", "seasonpass",
				"expansion", "pack", "bundle", "vr", "demo", "prologue",
			}
			for _, unw := range unwantedSuffixes {
				if diff == unw || strings.HasPrefix(diff, unw) {
					return false
				}
			}
			return true
		}
	}
	return false
}

// IngestDeals procesa un conjunto de ofertas y tiendas garantizando integridad referencial.
// Si autoEnrich es true, consulta inmediatamente CheapShark para registrar las demás tiendas oficiales de cada juego añadido.
func (s *SyncService) IngestDeals(ctx context.Context, source string, payload models.SyncIngestPayload, autoEnrich bool) (int, int, error) {
	if s.db == nil {
		return 0, 0, fmt.Errorf("base de datos no conectada")
	}

	processedCount := 0
	var syncErr error
	var touchedGameIDs []int
	seenGameIDs := make(map[int]bool)

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
				product_url = EXCLUDED.product_url,
				external_game_id = COALESCE(NULLIF(EXCLUDED.external_game_id, ''), store_products.external_game_id)
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
			if !seenGameIDs[gameID] {
				seenGameIDs[gameID] = true
				touchedGameIDs = append(touchedGameIDs, gameID)
			}
		}
	}

	// 4. Auto-enriquecimiento integrado: si se solicita, consultar y agregar tiendas oficiales
	// para TODOS los videojuegos que se acaban de insertar o actualizar que carezcan de tiendas prioritarias
	enrichedCount := 0
	storesAddedTotal := 0
	if autoEnrich && len(touchedGameIDs) > 0 {
		for _, gid := range touchedGameIDs {
			var extGameID, steamAppID, title string
			var storeCount int
			var hasSteam, hasEpic, hasGOG, hasHumble bool
			err := s.db.QueryRowContext(ctx, `
				SELECT 
					COALESCE((SELECT sp.external_game_id FROM store_products sp WHERE sp.game_id = g.id AND sp.external_game_id IS NOT NULL AND sp.external_game_id != '' LIMIT 1), ''),
					COALESCE(g.steam_app_id, ''),
					g.title,
					(SELECT COUNT(DISTINCT spc.store_id) FROM store_products spc WHERE spc.game_id = g.id),
					EXISTS (SELECT 1 FROM store_products sp JOIN stores st ON st.id = sp.store_id WHERE sp.game_id = g.id AND st.external_store_id = '1'),
					EXISTS (SELECT 1 FROM store_products sp JOIN stores st ON st.id = sp.store_id WHERE sp.game_id = g.id AND st.external_store_id = '25'),
					EXISTS (SELECT 1 FROM store_products sp JOIN stores st ON st.id = sp.store_id WHERE sp.game_id = g.id AND st.external_store_id = '7'),
					EXISTS (SELECT 1 FROM store_products sp JOIN stores st ON st.id = sp.store_id WHERE sp.game_id = g.id AND st.external_store_id = '11')
				FROM games g
				WHERE g.id = $1;
			`, gid).Scan(&extGameID, &steamAppID, &title, &storeCount, &hasSteam, &hasEpic, &hasGOG, &hasHumble)

			needsEnrich := (!hasSteam || !hasEpic || !hasGOG || !hasHumble || storeCount < 4)
			if err == nil && needsEnrich {
				added, enrichErr := s.EnrichGameMultiStore(ctx, gid, extGameID, steamAppID, title)
				if enrichErr == nil && added > 0 {
					enrichedCount++
					storesAddedTotal += added
				}
				time.Sleep(50 * time.Millisecond) // Pausa de cortesía para respetar rate-limits de CheapShark
			}
		}
	}

	// Registrar en sync_logs
	status := "success"
	var errMsg *string
	if syncErr != nil {
		status = "error"
		s := syncErr.Error()
		errMsg = &s
	} else if autoEnrich && enrichedCount > 0 {
		msg := fmt.Sprintf("Auto-enriquecidos %d juegos (+%d tiendas oficiales)", enrichedCount, storesAddedTotal)
		errMsg = &msg
	}

	_, _ = s.db.ExecContext(ctx, `
		INSERT INTO sync_logs (source, deals_processed, status, error_message, executed_at)
		VALUES ($1, $2, $3, $4, NOW());
	`, source, processedCount, status, errMsg)

	return processedCount, enrichedCount, syncErr
}

// Estructuras de respuesta para consulta completa de videojuego multi-tienda en CheapShark
type CheapSharkGameLookupDeal struct {
	StoreID     string `json:"storeID"`
	DealID      string `json:"dealID"`
	Price       string `json:"price"`
	RetailPrice string `json:"retailPrice"`
	Savings     string `json:"savings"`
}

type CheapSharkGameLookupInfo struct {
	Title      string  `json:"title"`
	SteamAppID *string `json:"steamAppID"`
	Thumb      string  `json:"thumb"`
}

type CheapSharkCheapestPriceEver struct {
	Price string `json:"price"`
	Date  int64  `json:"date"`
}

type CheapSharkGameLookupResponse struct {
	Info              CheapSharkGameLookupInfo    `json:"info"`
	CheapestPriceEver CheapSharkCheapestPriceEver `json:"cheapestPriceEver"`
	Deals             []CheapSharkGameLookupDeal  `json:"deals"`
}

func hasStore(deals []CheapSharkGameLookupDeal, storeID string) bool {
	for _, d := range deals {
		if d.StoreID == storeID {
			return true
		}
	}
	return false
}

// EnrichGameMultiStore consulta la API de CheapShark para un videojuego y garantiza
// la recolección activa de Steam (1), Epic Games (25), GOG (7) y Humble Bundle (11) si están disponibles.
func (s *SyncService) EnrichGameMultiStore(ctx context.Context, gameID int, externalGameID, steamAppID, title string) (int, error) {
	if s.db == nil {
		return 0, fmt.Errorf("base de datos no conectada")
	}

	client := &http.Client{Timeout: 12 * time.Second}
	var gameLookup CheapSharkGameLookupResponse

	// Helper para agregar ofertas evitando tiendas duplicadas
	addDealIfMissing := func(deal CheapSharkGameLookupDeal) {
		for _, existing := range gameLookup.Deals {
			if existing.StoreID == deal.StoreID {
				return
			}
		}
		gameLookup.Deals = append(gameLookup.Deals, deal)
	}

	// 1. Si tenemos steamAppID, consultar el juego oficial en CheapShark
	if steamAppID != "" {
		reqSteam, _ := http.NewRequestWithContext(ctx, "GET", fmt.Sprintf("https://www.cheapshark.com/api/1.0/games?steamAppID=%s", steamAppID), nil)
		if reqSteam != nil {
			reqSteam.Header.Set("User-Agent", CheapSharkUserAgent)
			if respSteam, errS := client.Do(reqSteam); errS == nil {
				defer respSteam.Body.Close()
				if respSteam.StatusCode == http.StatusOK {
					body, _ := io.ReadAll(respSteam.Body)
					var steamResult struct {
						GameID string `json:"gameID"`
					}
					var steamGameID string
					if err := json.Unmarshal(body, &steamResult); err == nil && steamResult.GameID != "" {
						steamGameID = steamResult.GameID
					} else {
						var list []struct {
							GameID string `json:"gameID"`
						}
						if err := json.Unmarshal(body, &list); err == nil && len(list) > 0 {
							steamGameID = list[0].GameID
						}
					}

					if steamGameID != "" {
						reqG, _ := http.NewRequestWithContext(ctx, "GET", fmt.Sprintf("https://www.cheapshark.com/api/1.0/games?id=%s", steamGameID), nil)
						if reqG != nil {
							reqG.Header.Set("User-Agent", CheapSharkUserAgent)
							if respG, errG := client.Do(reqG); errG == nil {
								defer respG.Body.Close()
								if respG.StatusCode == http.StatusOK {
									var lookup CheapSharkGameLookupResponse
									if errG := json.NewDecoder(respG.Body).Decode(&lookup); errG == nil {
										for _, d := range lookup.Deals {
											addDealIfMissing(d)
										}
										if gameLookup.Info.Title == "" {
											gameLookup.Info = lookup.Info
											gameLookup.CheapestPriceEver = lookup.CheapestPriceEver
										}
									}
								}
							}
						}
					}
				}
			}
		}
	}

	// 2. Si tenemos externalGameID, consultar ofertas por ese ID
	if externalGameID != "" {
		req, err := http.NewRequestWithContext(ctx, "GET", fmt.Sprintf("https://www.cheapshark.com/api/1.0/games?id=%s", externalGameID), nil)
		if err == nil {
			req.Header.Set("User-Agent", CheapSharkUserAgent)
			if resp, err := client.Do(req); err == nil {
				defer resp.Body.Close()
				if resp.StatusCode == http.StatusOK {
					var extLookup CheapSharkGameLookupResponse
					if err := json.NewDecoder(resp.Body).Decode(&extLookup); err == nil {
						for _, d := range extLookup.Deals {
							addDealIfMissing(d)
						}
						if gameLookup.Info.Title == "" {
							gameLookup.Info = extLookup.Info
							gameLookup.CheapestPriceEver = extLookup.CheapestPriceEver
						}
					}
				}
			}
		}
	}

	if gameLookup.Info.SteamAppID != nil && *gameLookup.Info.SteamAppID != "" && steamAppID == "" {
		steamAppID = *gameLookup.Info.SteamAppID
	}

	// 3. Buscar candidatos en CheapShark por título (/games?title=)
	if title != "" {
		reqGames, _ := http.NewRequestWithContext(ctx, "GET", fmt.Sprintf("https://www.cheapshark.com/api/1.0/games?title=%s", url.QueryEscape(title)), nil)
		if reqGames != nil {
			reqGames.Header.Set("User-Agent", CheapSharkUserAgent)
			if respGames, errG := client.Do(reqGames); errG == nil {
				defer respGames.Body.Close()
				if respGames.StatusCode == http.StatusOK {
					var candidates []struct {
						GameID     string  `json:"gameID"`
						SteamAppID *string `json:"steamAppID"`
						External   string  `json:"external"`
					}
					if errG := json.NewDecoder(respGames.Body).Decode(&candidates); errG == nil {
						for _, cand := range candidates {
							if TitlesMatch(cand.External, title) {
								if cand.SteamAppID != nil && *cand.SteamAppID != "" && steamAppID == "" {
									steamAppID = *cand.SteamAppID
								}
								reqSub, _ := http.NewRequestWithContext(ctx, "GET", fmt.Sprintf("https://www.cheapshark.com/api/1.0/games?id=%s", cand.GameID), nil)
								if reqSub != nil {
									reqSub.Header.Set("User-Agent", CheapSharkUserAgent)
									if respSub, errSub := client.Do(reqSub); errSub == nil {
										defer respSub.Body.Close()
										if respSub.StatusCode == http.StatusOK {
											var candLookup CheapSharkGameLookupResponse
											if errSub := json.NewDecoder(respSub.Body).Decode(&candLookup); errSub == nil {
												for _, cd := range candLookup.Deals {
													addDealIfMissing(cd)
												}
												if gameLookup.Info.Title == "" {
													gameLookup.Info = candLookup.Info
													gameLookup.CheapestPriceEver = candLookup.CheapestPriceEver
												}
											}
										}
									}
								}
							}
						}
					}
				}
			}
		}
	}

	// 4. Consulta cruzada en /deals?title=
	if title != "" {
		reqDeals, errD := http.NewRequestWithContext(ctx, "GET", fmt.Sprintf("https://www.cheapshark.com/api/1.0/deals?title=%s", url.QueryEscape(title)), nil)
		if errD == nil {
			reqDeals.Header.Set("User-Agent", CheapSharkUserAgent)
			if respDeals, errD := client.Do(reqDeals); errD == nil {
				defer respDeals.Body.Close()
				if respDeals.StatusCode == http.StatusOK {
					var dealsFound []models.CheapSharkDeal
					if errD := json.NewDecoder(respDeals.Body).Decode(&dealsFound); errD == nil {
						for _, df := range dealsFound {
							if TitlesMatch(df.Title, title) {
								addDealIfMissing(CheapSharkGameLookupDeal{
									StoreID:     df.StoreID,
									DealID:      df.DealID,
									Price:       df.SalePrice,
									RetailPrice: df.NormalPrice,
									Savings:     df.Savings,
								})
								if df.SteamAppID != "" && steamAppID == "" {
									steamAppID = df.SteamAppID
								}
							}
						}
					}
				}
			}
		}
	}

	// 5. Búsqueda prioritaria obligatoria de las 4 tiendas oficiales:
	// Steam (1), Epic Games Store (25), GOG (7), Humble Store (11)
	keyStoresToFind := []string{"1", "25", "7", "11"}
	for _, storeID := range keyStoresToFind {
		if !hasStore(gameLookup.Deals, storeID) && title != "" {
			reqStoreDeal, _ := http.NewRequestWithContext(ctx, "GET", fmt.Sprintf("https://www.cheapshark.com/api/1.0/deals?storeID=%s&title=%s", storeID, url.QueryEscape(title)), nil)
			if reqStoreDeal != nil {
				reqStoreDeal.Header.Set("User-Agent", CheapSharkUserAgent)
				if respStoreDeal, errSD := client.Do(reqStoreDeal); errSD == nil {
					defer respStoreDeal.Body.Close()
					if respStoreDeal.StatusCode == http.StatusOK {
						var deals []models.CheapSharkDeal
						if errSD := json.NewDecoder(respStoreDeal.Body).Decode(&deals); errSD == nil {
							for _, d := range deals {
								if TitlesMatch(d.Title, title) && !hasStore(gameLookup.Deals, storeID) {
									addDealIfMissing(CheapSharkGameLookupDeal{
										StoreID:     storeID,
										DealID:      d.DealID,
										Price:       d.SalePrice,
										RetailPrice: d.NormalPrice,
										Savings:     d.Savings,
									})
									if d.SteamAppID != "" && steamAppID == "" {
										steamAppID = d.SteamAppID
									}
									break
								}
							}
						}
					}
				}
			}
		}
	}

	if len(gameLookup.Deals) == 0 {
		return 0, nil
	}

	// 3. Mapear tiendas existentes
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

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	// Actualizar mínimo histórico global si CheapShark lo tiene registrado
	if histPrice, err := strconv.ParseFloat(gameLookup.CheapestPriceEver.Price, 64); err == nil && histPrice > 0 {
		histTime := time.Now()
		if gameLookup.CheapestPriceEver.Date > 0 {
			histTime = time.Unix(gameLookup.CheapestPriceEver.Date, 0)
		}
		_, _ = tx.ExecContext(ctx, `
			UPDATE games 
			SET historical_low_price = LEAST(COALESCE(historical_low_price, $1), $1),
			    historical_low_date = COALESCE(historical_low_date, $2),
			    cover_image_url = COALESCE(NULLIF(cover_image_url, ''), $3),
			    steam_app_id = COALESCE(NULLIF($4, ''), steam_app_id)
			WHERE id = $5;
		`, histPrice, histTime, gameLookup.Info.Thumb, steamAppID, gameID)
	} else if steamAppID != "" {
		_, _ = tx.ExecContext(ctx, `
			UPDATE games SET steam_app_id = COALESCE(NULLIF($1, ''), steam_app_id) WHERE id = $2;
		`, steamAppID, gameID)
	}

	dealsSaved := 0
	for _, deal := range gameLookup.Deals {
		salePrice, err := strconv.ParseFloat(deal.Price, 64)
		if err != nil {
			continue
		}
		retailPrice, err := strconv.ParseFloat(deal.RetailPrice, 64)
		if err != nil || retailPrice <= 0 {
			retailPrice = salePrice
		}
		savings, err := strconv.ParseFloat(deal.Savings, 64)
		if err != nil {
			if retailPrice > 0 && salePrice < retailPrice {
				savings = math.Round((1.0-salePrice/retailPrice)*10000) / 100
			} else {
				savings = 0.0
			}
		}
		isOnSale := salePrice < retailPrice

		store, exists := storeMap[deal.StoreID]
		if !exists {
			storeName := fmt.Sprintf("Store %s", deal.StoreID)
			storeSlug := fmt.Sprintf("store-%s", deal.StoreID)
			logoURL := fmt.Sprintf("https://www.cheapshark.com/img/stores/logos/%s.png", deal.StoreID)
			var newStoreID int
			err := tx.QueryRowContext(ctx, `
				INSERT INTO stores (external_store_id, name, slug, base_url, logo_url, is_active)
				VALUES ($1, $2, $3, $4, $5, true)
				ON CONFLICT (external_store_id) DO UPDATE SET name = EXCLUDED.name
				RETURNING id;
			`, deal.StoreID, storeName, storeSlug, "https://www.cheapshark.com", logoURL).Scan(&newStoreID)
			if err != nil {
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

		productURL := fmt.Sprintf("https://www.cheapshark.com/redirect?dealID=%s", deal.DealID)

		var storeProductID int
		err = tx.QueryRowContext(ctx, `
			INSERT INTO store_products (game_id, store_id, external_game_id, external_deal_id, product_url)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (game_id, store_id) DO UPDATE SET
				external_deal_id = EXCLUDED.external_deal_id,
				product_url = EXCLUDED.product_url,
				external_game_id = COALESCE(NULLIF(EXCLUDED.external_game_id, ''), store_products.external_game_id)
			RETURNING id;
		`, gameID, store.ID, externalGameID, deal.DealID, productURL).Scan(&storeProductID)
		if err != nil {
			continue
		}

		var prevPrice sql.NullFloat64
		_ = tx.QueryRowContext(ctx, `
			SELECT current_price FROM current_prices WHERE store_product_id = $1;
		`, storeProductID).Scan(&prevPrice)

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
		`, storeProductID, retailPrice, salePrice, savings, isOnSale)
		if err != nil {
			continue
		}

		if !prevPrice.Valid || math.Abs(prevPrice.Float64-salePrice) > 0.009 {
			_, _ = tx.ExecContext(ctx, `
				INSERT INTO price_history (store_product_id, regular_price, sale_price, discount_percentage, recorded_at)
				VALUES ($1, $2, $3, $4, NOW());
			`, storeProductID, retailPrice, salePrice, savings)
		}

		// Revisar Wishlists y disparar alertas de precio si coincide el precio objetivo
		rowsW, errW := tx.QueryContext(ctx, `
			SELECT w.id, w.target_price
			FROM wishlists w
			WHERE w.game_id = $1 AND w.notify_active = true AND w.target_price >= $2;
		`, gameID, salePrice)
		if errW == nil {
			type wishMatch struct {
				wid int
				tp  float64
			}
			var matches []wishMatch
			for rowsW.Next() {
				var m wishMatch
				if errS := rowsW.Scan(&m.wid, &m.tp); errS == nil {
					matches = append(matches, m)
				}
			}
			rowsW.Close()

			for _, m := range matches {
				var countAlerts int
				_ = tx.QueryRowContext(ctx, `
					SELECT COUNT(*) FROM price_alerts 
					WHERE wishlist_id = $1 AND store_name = $2 
					  AND triggered_price = $3 AND triggered_at > NOW() - INTERVAL '24 hours';
				`, m.wid, store.Name, salePrice).Scan(&countAlerts)

				if countAlerts == 0 {
					alertMsg := fmt.Sprintf("¡%s está disponible en %s por solo $%.2f (tu precio objetivo era $%.2f, -%.0f%%)!",
						title, store.Name, salePrice, m.tp, savings)

					_, _ = tx.ExecContext(ctx, `
						INSERT INTO price_alerts (wishlist_id, store_name, triggered_price, message, is_read, triggered_at)
						VALUES ($1, $2, $3, $4, false, NOW());
					`, m.wid, store.Name, salePrice, alertMsg)
				}
			}
		}

		dealsSaved++
	}

	if err := tx.Commit(); err != nil {
		return 0, err
	}

	return dealsSaved, nil
}

// EnrichCatalogMultiStore enriquece en lote videojuegos del catálogo que carecen de las tiendas prioritarias
// (Steam, Epic Games Store, GOG, Humble Bundle) o que tienen pocas tiendas vinculadas
func (s *SyncService) EnrichCatalogMultiStore(ctx context.Context, maxGames int) (int, int, error) {
	if s.db == nil {
		return 0, 0, fmt.Errorf("base de datos no conectada")
	}

	if maxGames <= 0 {
		maxGames = 50
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT g.id, 
		       COALESCE((SELECT sp.external_game_id FROM store_products sp WHERE sp.game_id = g.id AND sp.external_game_id IS NOT NULL AND sp.external_game_id != '' LIMIT 1), ''),
		       COALESCE(g.steam_app_id, ''), 
		       g.title
		FROM games g
		WHERE (
			-- Juegos con pocas tiendas registradas
			(SELECT COUNT(DISTINCT sp.store_id) FROM store_products sp WHERE sp.game_id = g.id) < 4
			-- O juegos sin Steam (store 1)
			OR NOT EXISTS (
				SELECT 1 FROM store_products sp 
				INNER JOIN stores st ON st.id = sp.store_id 
				WHERE sp.game_id = g.id AND st.external_store_id = '1'
			)
			-- O juegos sin Epic Games Store (store 25)
			OR NOT EXISTS (
				SELECT 1 FROM store_products sp 
				INNER JOIN stores st ON st.id = sp.store_id 
				WHERE sp.game_id = g.id AND st.external_store_id = '25'
			)
			-- O juegos sin GOG (store 7)
			OR NOT EXISTS (
				SELECT 1 FROM store_products sp 
				INNER JOIN stores st ON st.id = sp.store_id 
				WHERE sp.game_id = g.id AND st.external_store_id = '7'
			)
			-- O juegos sin Humble Bundle (store 11)
			OR NOT EXISTS (
				SELECT 1 FROM store_products sp 
				INNER JOIN stores st ON st.id = sp.store_id 
				WHERE sp.game_id = g.id AND st.external_store_id = '11'
			)
		)
		ORDER BY g.id DESC
		LIMIT $1;
	`, maxGames)
	if err != nil {
		return 0, 0, err
	}
	defer rows.Close()

	type gameItem struct {
		id         int
		extGameID  string
		steamAppID string
		title      string
	}

	var gamesToEnrich []gameItem
	for rows.Next() {
		var it gameItem
		if err := rows.Scan(&it.id, &it.extGameID, &it.steamAppID, &it.title); err == nil {
			gamesToEnrich = append(gamesToEnrich, it)
		}
	}

	enrichedGamesCount := 0
	totalStoresAdded := 0

	for _, g := range gamesToEnrich {
		// Pausa breve para respetar los límites de tasa de CheapShark API
		time.Sleep(120 * time.Millisecond)

		storesAdded, err := s.EnrichGameMultiStore(ctx, g.id, g.extGameID, g.steamAppID, g.title)
		if err == nil && storesAdded > 0 {
			enrichedGamesCount++
			totalStoresAdded += storesAdded
		}
	}

	return enrichedGamesCount, totalStoresAdded, nil
}

// FetchFromServer sincroniza directamente desde Go con CheapShark API usando User-Agent descriptivo
// y recolecta ofertas de múltiples tiendas oficiales clave para garantizar comparación multi-tienda
func (s *SyncService) FetchFromServer(ctx context.Context) (int, error) {
	client := &http.Client{Timeout: 15 * time.Second}

	// 1. Obtener lista oficial de tiendas
	reqStores, err := http.NewRequestWithContext(ctx, "GET", "https://www.cheapshark.com/api/1.0/stores", nil)
	if err != nil {
		return 0, err
	}
	reqStores.Header.Set("User-Agent", CheapSharkUserAgent)
	reqStores.Header.Set("Accept", "application/json")

	var stores []models.CheapSharkStore
	if respStores, err := client.Do(reqStores); err == nil {
		defer respStores.Body.Close()
		if respStores.StatusCode == http.StatusOK {
			bodyStores, _ := io.ReadAll(respStores.Body)
			_ = json.Unmarshal(bodyStores, &stores)
		}
	}

	// 2. Recolectar ofertas de las tiendas oficiales más importantes para garantizar coincidencias multi-tienda:
	// - onSale=1 (Ofertas generales destacadas)
	// - storeID=1 (Steam)
	// - storeID=25 (Epic Games Store)
	// - storeID=7 (GOG)
	// - storeID=15 (Fanatical)
	// - storeID=3 (GreenManGaming)
	// - storeID=11 (Humble Store)
	endpoints := []string{
		"https://www.cheapshark.com/api/1.0/deals?onSale=1&pageSize=60",
		"https://www.cheapshark.com/api/1.0/deals?storeID=1&pageSize=60",
		"https://www.cheapshark.com/api/1.0/deals?storeID=25&pageSize=60",
		"https://www.cheapshark.com/api/1.0/deals?storeID=7&pageSize=60",
		"https://www.cheapshark.com/api/1.0/deals?storeID=15&pageSize=60",
		"https://www.cheapshark.com/api/1.0/deals?storeID=3&pageSize=60",
		"https://www.cheapshark.com/api/1.0/deals?storeID=11&pageSize=60",
	}

	var allDeals []models.CheapSharkDeal
	seenDealIDs := make(map[string]bool)

	for _, ep := range endpoints {
		req, err := http.NewRequestWithContext(ctx, "GET", ep, nil)
		if err != nil {
			continue
		}
		req.Header.Set("User-Agent", CheapSharkUserAgent)
		req.Header.Set("Accept", "application/json")

		resp, err := client.Do(req)
		if err != nil {
			log.Printf("Aviso al consultar %s: %v", ep, err)
			continue
		}

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			return 0, fmt.Errorf("CheapShark retornó código %d: %s", resp.StatusCode, string(body))
		}

		bodyDeals, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			continue
		}

		var deals []models.CheapSharkDeal
		if err := json.Unmarshal(bodyDeals, &deals); err == nil {
			for _, d := range deals {
				if !seenDealIDs[d.DealID] {
					seenDealIDs[d.DealID] = true
					allDeals = append(allDeals, d)
				}
			}
		}

		// Pequeña pausa entre peticiones
		time.Sleep(100 * time.Millisecond)
	}

	if len(allDeals) == 0 {
		return 0, fmt.Errorf("no se pudieron descargar ofertas de CheapShark")
	}

	payload := models.SyncIngestPayload{
		Deals:  allDeals,
		Stores: stores,
	}

	// 3. Persistir todas las ofertas recolectadas con auto-enriquecimiento activado
	totalIngested, _, err := s.IngestDeals(ctx, "server_sync", payload, true)
	if err != nil {
		return totalIngested, err
	}

	return totalIngested, nil
}

type RandomSyncResult struct {
	DealsProcessed int    `json:"deals_processed"`
	EnrichedGames  int    `json:"enriched_games"`
	PageNumber     int    `json:"page_number"`
	SortBy         string `json:"sort_by"`
}

// FetchRandomFromServer sincroniza ofertas aleatorias de CheapShark (página y criterio al azar)
// e inmediatamente las auto-enriquece con los precios de todas las tiendas oficiales disponibles
func (s *SyncService) FetchRandomFromServer(ctx context.Context) (*RandomSyncResult, error) {
	client := &http.Client{Timeout: 30 * time.Second}

	// 1. Obtener lista oficial de tiendas
	reqStores, err := http.NewRequestWithContext(ctx, "GET", "https://www.cheapshark.com/api/1.0/stores", nil)
	if err != nil {
		return nil, err
	}
	reqStores.Header.Set("User-Agent", CheapSharkUserAgent)
	reqStores.Header.Set("Accept", "application/json")

	var stores []models.CheapSharkStore
	if respStores, err := client.Do(reqStores); err == nil {
		defer respStores.Body.Close()
		if respStores.StatusCode == http.StatusOK {
			bodyStores, _ := io.ReadAll(respStores.Body)
			_ = json.Unmarshal(bodyStores, &stores)
		}
	}

	// 2. Parámetros aleatorios para descubrir juegos variados
	sortOptions := []string{"Deal Rating", "Savings", "Reviews", "Metacritic", "Release", "recent"}
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	randomPage := r.Intn(20) + 1 // Páginas 1 a 20 para traer juegos nunca antes vistos
	selectedSort := sortOptions[r.Intn(len(sortOptions))]

	dealURL := fmt.Sprintf("https://www.cheapshark.com/api/1.0/deals?onSale=1&pageSize=60&pageNumber=%d&sortBy=%s",
		randomPage, url.QueryEscape(selectedSort))

	req, err := http.NewRequestWithContext(ctx, "GET", dealURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", CheapSharkUserAgent)
	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("error al conectar con CheapShark: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("CheapShark retornó código %d: %s", resp.StatusCode, string(body))
	}

	var deals []models.CheapSharkDeal
	if err := json.NewDecoder(resp.Body).Decode(&deals); err != nil {
		return nil, fmt.Errorf("error al decodificar ofertas de CheapShark: %w", err)
	}

	if len(deals) == 0 {
		return nil, fmt.Errorf("CheapShark no retornó ofertas para la página %d", randomPage)
	}

	payload := models.SyncIngestPayload{
		Deals:  deals,
		Stores: stores,
	}

	// 3. Persistir y auto-enriquecer en el mismo paso
	sourceName := fmt.Sprintf("server_random_p%d_%s", randomPage, CleanSlug(selectedSort))
	processedCount, enrichedCount, err := s.IngestDeals(ctx, sourceName, payload, true)
	if err != nil {
		return nil, err
	}

	return &RandomSyncResult{
		DealsProcessed: processedCount,
		EnrichedGames:  enrichedCount,
		PageNumber:     randomPage,
		SortBy:         selectedSort,
	}, nil
}

// FetchRandomBatchFromServer ejecuta múltiples páginas de descubrimiento aleatorio (ej. 300 ofertas)
func (s *SyncService) FetchRandomBatchFromServer(ctx context.Context, totalDeals int) (*RandomSyncResult, error) {
	if totalDeals <= 0 {
		totalDeals = 60
	}
	pagesToFetch := (totalDeals + 59) / 60
	if pagesToFetch > 10 {
		pagesToFetch = 10
	}

	totalProcessed := 0
	totalEnriched := 0
	var lastPage int
	var lastSort string

	for i := 0; i < pagesToFetch; i++ {
		res, err := s.FetchRandomFromServer(ctx)
		if err != nil {
			if totalProcessed > 0 {
				break
			}
			return nil, err
		}
		totalProcessed += res.DealsProcessed
		totalEnriched += res.EnrichedGames
		lastPage = res.PageNumber
		lastSort = res.SortBy
	}

	return &RandomSyncResult{
		DealsProcessed: totalProcessed,
		EnrichedGames:  totalEnriched,
		PageNumber:     lastPage,
		SortBy:         lastSort,
	}, nil
}

// RefreshAndCleanupDeals consulta CheapShark para actualizar precios vigentes y marcar ofertas expiradas
func (s *SyncService) RefreshAndCleanupDeals(ctx context.Context, limit int) (int, int, error) {
	if s.db == nil {
		return 0, 0, fmt.Errorf("base de datos no disponible")
	}
	if limit <= 0 {
		limit = 50
	}

	// 1. Obtener store_products con ofertas marcadas como activas o con descuentos para revalidar
	rows, err := s.db.QueryContext(ctx, `
		SELECT sp.id, sp.external_deal_id, cp.regular_price, cp.current_price, cp.is_on_sale
		FROM store_products sp
		JOIN current_prices cp ON cp.store_product_id = sp.id
		WHERE cp.is_on_sale = true OR cp.last_updated < NOW() - INTERVAL '24 hours'
		ORDER BY cp.last_updated ASC
		LIMIT $1;
	`, limit)
	if err != nil {
		return 0, 0, fmt.Errorf("error al consultar ofertas a revalidar: %w", err)
	}
	defer rows.Close()

	type dealItem struct {
		spID         int
		dealID       string
		regularPrice float64
		currentPrice float64
		isOnSale     bool
	}

	var items []dealItem
	for rows.Next() {
		var it dealItem
		if err := rows.Scan(&it.spID, &it.dealID, &it.regularPrice, &it.currentPrice, &it.isOnSale); err == nil {
			items = append(items, it)
		}
	}

	client := &http.Client{Timeout: 10 * time.Second}
	updatedCount := 0
	deactivatedCount := 0

	for _, it := range items {
		select {
		case <-ctx.Done():
			return updatedCount, deactivatedCount, ctx.Err()
		default:
		}

		dealReqURL := fmt.Sprintf("https://www.cheapshark.com/api/1.0/deals?id=%s", url.QueryEscape(it.dealID))
		req, err := http.NewRequestWithContext(ctx, "GET", dealReqURL, nil)
		if err != nil {
			continue
		}
		req.Header.Set("User-Agent", CheapSharkUserAgent)

		resp, err := client.Do(req)
		if err != nil {
			continue
		}

		if resp.StatusCode == http.StatusNotFound {
			// Oferta ya no existe en CheapShark -> Marcar oferta como finalizada
			resp.Body.Close()
			_, _ = s.db.ExecContext(ctx, `
				UPDATE current_prices
				SET is_on_sale = false, current_price = regular_price, discount_percentage = 0.00, last_updated = NOW()
				WHERE store_product_id = $1;
			`, it.spID)
			deactivatedCount++
			continue
		}

		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			continue
		}

		var dealLookup struct {
			GameInfo struct {
				SalePrice   string `json:"salePrice"`
				RetailPrice string `json:"retailPrice"`
				Name        string `json:"name"`
			} `json:"gameInfo"`
		}

		if err := json.NewDecoder(resp.Body).Decode(&dealLookup); err != nil {
			resp.Body.Close()
			continue
		}
		resp.Body.Close()

		salePrice, _ := strconv.ParseFloat(dealLookup.GameInfo.SalePrice, 64)
		retailPrice, _ := strconv.ParseFloat(dealLookup.GameInfo.RetailPrice, 64)

		if salePrice <= 0 && retailPrice > 0 {
			salePrice = retailPrice
		}
		if retailPrice <= 0 && salePrice > 0 {
			retailPrice = salePrice
		}

		isOnSale := salePrice < retailPrice
		var discount float64
		if retailPrice > 0 && isOnSale {
			discount = ((retailPrice - salePrice) / retailPrice) * 100
		}

		_, err = s.db.ExecContext(ctx, `
			UPDATE current_prices
			SET current_price = $1, regular_price = $2, discount_percentage = $3, is_on_sale = $4, last_updated = NOW()
			WHERE store_product_id = $5;
		`, salePrice, retailPrice, discount, isOnSale, it.spID)

		if err == nil {
			if it.isOnSale && !isOnSale {
				deactivatedCount++
			} else {
				updatedCount++
			}
		}
	}

	// Registrar en sync_logs
	cleanupMsg := fmt.Sprintf("Mantenimiento completado: %d ofertas actualizadas, %d ofertas caducadas retiradas", updatedCount, deactivatedCount)
	_, _ = s.db.ExecContext(ctx, `
		INSERT INTO sync_logs (source, deals_processed, status, error_message, executed_at)
		VALUES ($1, $2, $3, $4, NOW());
	`, "deals_cleanup_maintenance", updatedCount+deactivatedCount, "success", cleanupMsg)

	return updatedCount, deactivatedCount, nil
}
