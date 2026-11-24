package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/lib/pq"

	"price-tracker-backend/internal/models"
	"price-tracker-backend/internal/services"
)

type GameHandler struct {
	db          *sql.DB
	syncService *services.SyncService
}

func NewGameHandler(db *sql.DB, syncService *services.SyncService) *GameHandler {
	return &GameHandler{
		db:          db,
		syncService: syncService,
	}
}

// GetGames obtiene la lista paginada de videojuegos con filtros y su mejor oferta actual
func (h *GameHandler) GetGames(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if h.db == nil {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"games":       []models.Game{},
			"total":       0,
			"page":        1,
			"limit":       20,
			"total_pages": 0,
		})
		return
	}

	query := r.URL.Query()
	search := strings.TrimSpace(query.Get("search"))
	storeParam := strings.TrimSpace(query.Get("store"))
	genreParam := strings.TrimSpace(query.Get("genre"))
	publisherParam := strings.TrimSpace(query.Get("publisher"))
	minDiscountStr := strings.TrimSpace(query.Get("min_discount"))
	maxPriceStr := strings.TrimSpace(query.Get("max_price"))
	sortParam := strings.TrimSpace(query.Get("sort"))

	page, _ := strconv.Atoi(query.Get("page"))
	if page < 1 {
		page = 1
	}

	limit, _ := strconv.Atoi(query.Get("limit"))
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	var dealWhereClauses []string
	var gameWhereClauses []string
	var args []interface{}
	argIdx := 1
	hasDealFilter := false

	// Filtro de tienda: filtra dentro del pool de ofertas para mostrar la oferta real de dicha tienda
	if storeParam != "" {
		dealWhereClauses = append(dealWhereClauses, fmt.Sprintf("(st.external_store_id = $%d OR st.slug = $%d)", argIdx, argIdx))
		args = append(args, storeParam)
		argIdx++
		hasDealFilter = true
	}

	// Filtro de descuento mínimo: filtra ofertas que cumplan con el porcentaje de ahorro solicitado
	if minDiscountStr != "" {
		if minDisc, err := strconv.ParseFloat(minDiscountStr, 64); err == nil && minDisc > 0 {
			dealWhereClauses = append(dealWhereClauses, fmt.Sprintf("cp.discount_percentage >= $%d", argIdx))
			args = append(args, minDisc)
			argIdx++
			hasDealFilter = true
		}
	}

	// Filtro de precio máximo: filtra ofertas con precio menor o igual al fijado
	if maxPriceStr != "" {
		if maxP, err := strconv.ParseFloat(maxPriceStr, 64); err == nil && maxP >= 0 {
			dealWhereClauses = append(dealWhereClauses, fmt.Sprintf("cp.current_price <= $%d", argIdx))
			args = append(args, maxP)
			argIdx++
			hasDealFilter = true
		}
	}

	// Búsqueda textual por título o slug
	if search != "" {
		gameWhereClauses = append(gameWhereClauses, fmt.Sprintf("(g.title ILIKE $%d OR g.slug ILIKE $%d)", argIdx, argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}

	// Filtro por género (slug o ID)
	if genreParam != "" {
		gameWhereClauses = append(gameWhereClauses, fmt.Sprintf(`EXISTS (
			SELECT 1 FROM game_genres gg
			INNER JOIN genres ge ON ge.id = gg.genre_id
			WHERE gg.game_id = g.id AND (ge.slug = $%d OR CAST(ge.id AS TEXT) = $%d)
		)`, argIdx, argIdx))
		args = append(args, genreParam)
		argIdx++
	}

	// Filtro por publisher / distribuidor (slug o ID)
	if publisherParam != "" {
		gameWhereClauses = append(gameWhereClauses, fmt.Sprintf("(p.slug = $%d OR CAST(p.id AS TEXT) = $%d)", argIdx, argIdx))
		args = append(args, publisherParam)
		argIdx++
	}

	dealWhereSQL := ""
	if len(dealWhereClauses) > 0 {
		dealWhereSQL = " AND " + strings.Join(dealWhereClauses, " AND ")
	}

	joinType := "LEFT JOIN"
	if hasDealFilter {
		joinType = "INNER JOIN"
	}

	gameWhereSQL := "WHERE 1=1"
	if len(gameWhereClauses) > 0 {
		gameWhereSQL += " AND " + strings.Join(gameWhereClauses, " AND ")
	}

	// Construcción dinámica de consulta SQL con CTE seleccionando la mejor oferta según los filtros aplicados
	baseQuery := fmt.Sprintf(`
		WITH ranked_deals AS (
			SELECT 
				sp.game_id,
				sp.store_id,
				sp.product_url,
				sp.external_deal_id,
				st.name AS store_name,
				st.slug AS store_slug,
				st.logo_url AS store_logo,
				st.external_store_id,
				cp.regular_price,
				cp.current_price,
				cp.discount_percentage,
				cp.is_on_sale,
				ROW_NUMBER() OVER(PARTITION BY sp.game_id ORDER BY cp.current_price ASC, cp.discount_percentage DESC) as rank
			FROM store_products sp
			INNER JOIN current_prices cp ON cp.store_product_id = sp.id
			INNER JOIN stores st ON st.id = sp.store_id
			WHERE st.is_active = true %s
		)
		SELECT 
			g.id, g.title, g.slug, COALESCE(g.description, ''), COALESCE(g.cover_image_url, ''),
			COALESCE(g.steam_app_id, ''), g.publisher_id, COALESCE(p.name, ''), COALESCE(p.slug, ''),
			g.historical_low_price, g.historical_low_date, g.created_at,
			rd.store_id, rd.store_name, rd.store_slug, rd.store_logo, rd.regular_price, 
			rd.current_price, rd.discount_percentage, rd.product_url, rd.external_deal_id,
			COALESCE((SELECT COUNT(DISTINCT spc.store_id) FROM store_products spc WHERE spc.game_id = g.id), 0) AS stores_count
		FROM games g
		LEFT JOIN publishers p ON p.id = g.publisher_id
		%s ranked_deals rd ON rd.game_id = g.id AND rd.rank = 1
		%s
	`, dealWhereSQL, joinType, gameWhereSQL)

	// Consulta de conteo total
	countQuery := fmt.Sprintf(`
		SELECT COUNT(*) FROM (%s) as filtered_games
	`, baseQuery)

	var total int
	err := h.db.QueryRowContext(r.Context(), countQuery, args...).Scan(&total)
	if err != nil {
		total = 0
	}

	// Ordenamiento
	var orderBy string
	switch sortParam {
	case "discount":
		orderBy = " ORDER BY COALESCE(rd.discount_percentage, 0) DESC, g.title ASC"
	case "price":
		orderBy = " ORDER BY COALESCE(rd.current_price, 999999) ASC, g.title ASC"
	case "price_desc":
		orderBy = " ORDER BY COALESCE(rd.current_price, 0) DESC, g.title ASC"
	case "newest":
		orderBy = " ORDER BY g.created_at DESC"
	case "title":
		orderBy = " ORDER BY g.title ASC"
	default:
		orderBy = " ORDER BY COALESCE(rd.discount_percentage, 0) DESC, g.id DESC"
	}

	finalQuery := fmt.Sprintf("%s %s LIMIT $%d OFFSET $%d", baseQuery, orderBy, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.db.QueryContext(r.Context(), finalQuery, args...)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error al consultar videojuegos: " + err.Error()})
		return
	}
	defer rows.Close()

	games := make([]models.Game, 0)
	gameIDs := make([]int, 0)
	for rows.Next() {
		var g models.Game
		var pubID sql.NullInt64
		var histLow sql.NullFloat64
		var histDate sql.NullTime
		var stID sql.NullInt64
		var stName, stSlug, stLogo, prodURL, extDealID sql.NullString
		var regPrice, curPrice, discPerc sql.NullFloat64

		err := rows.Scan(
			&g.ID, &g.Title, &g.Slug, &g.Description, &g.CoverImageURL,
			&g.SteamAppID, &pubID, &g.PublisherName, &g.PublisherSlug,
			&histLow, &histDate, &g.CreatedAt,
			&stID, &stName, &stSlug, &stLogo, &regPrice,
			&curPrice, &discPerc, &prodURL, &extDealID,
			&g.StoresCount,
		)
		if err != nil {
			continue
		}

		if pubID.Valid {
			pid := int(pubID.Int64)
			g.PublisherID = &pid
		}
		if histLow.Valid {
			hl := histLow.Float64
			g.HistoricalLowPrice = &hl
		}
		if histDate.Valid {
			hd := histDate.Time
			g.HistoricalLowDate = &hd
		}

		if stID.Valid && curPrice.Valid {
			isHistLow := false
			if g.HistoricalLowPrice != nil && curPrice.Float64 <= *g.HistoricalLowPrice {
				isHistLow = true
			}

			g.BestDeal = &models.BestDeal{
				StoreID:            int(stID.Int64),
				StoreName:          stName.String,
				StoreSlug:          stSlug.String,
				StoreLogo:          stLogo.String,
				RegularPrice:       regPrice.Float64,
				CurrentPrice:       curPrice.Float64,
				DiscountPercentage: discPerc.Float64,
				ProductURL:         prodURL.String,
				IsHistoricalLow:    isHistLow,
				ExternalDealID:     extDealID.String,
			}
		}

		games = append(games, g)
		gameIDs = append(gameIDs, g.ID)
	}

	// Cargar géneros en lote para los videojuegos de esta página
	if len(gameIDs) > 0 {
		genreRows, gErr := h.db.QueryContext(r.Context(), `
			SELECT gg.game_id, ge.id, ge.name, ge.slug
			FROM game_genres gg
			INNER JOIN genres ge ON ge.id = gg.genre_id
			WHERE gg.game_id = ANY($1)
			ORDER BY ge.name ASC;
		`, pq.Array(gameIDs))
		if gErr == nil {
			genresByGame := make(map[int][]models.Genre)
			for genreRows.Next() {
				var gid int
				var ge models.Genre
				if err := genreRows.Scan(&gid, &ge.ID, &ge.Name, &ge.Slug); err == nil {
					genresByGame[gid] = append(genresByGame[gid], ge)
				}
			}
			genreRows.Close()
			for i := range games {
				if list, ok := genresByGame[games[i].ID]; ok {
					games[i].Genres = list
				}
			}
		}
	}

	totalPages := 0
	if limit > 0 {
		totalPages = int(math.Ceil(float64(total) / float64(limit)))
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"games":       games,
		"total":       total,
		"page":        page,
		"limit":       limit,
		"total_pages": totalPages,
	})
}

// GetGameBySlug obtiene el detalle completo de un videojuego (precios en todas las tiendas y gráfica de historial)
func (h *GameHandler) GetGameBySlug(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if h.db == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]string{"error": "Base de datos no conectada"})
		return
	}

	slug := chi.URLParam(r, "slug")
	if slug == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Slug no proporcionado"})
		return
	}

	var g models.Game
	var pubID sql.NullInt64
	var pubName, pubSlug sql.NullString
	var histLow sql.NullFloat64
	var histDate sql.NullTime

	err := h.db.QueryRowContext(r.Context(), `
		SELECT g.id, g.title, g.slug, COALESCE(g.description, ''), COALESCE(g.cover_image_url, ''),
		       COALESCE(g.steam_app_id, ''), g.publisher_id, p.name, p.slug, g.historical_low_price,
		       g.historical_low_date, g.created_at
		FROM games g
		LEFT JOIN publishers p ON p.id = g.publisher_id
		WHERE g.slug = $1;
	`, slug).Scan(
		&g.ID, &g.Title, &g.Slug, &g.Description, &g.CoverImageURL,
		&g.SteamAppID, &pubID, &pubName, &pubSlug, &histLow, &histDate, &g.CreatedAt,
	)

	if err == sql.ErrNoRows {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "Videojuego no encontrado"})
		return
	} else if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error al consultar videojuego: " + err.Error()})
		return
	}

	if pubID.Valid {
		pid := int(pubID.Int64)
		g.PublisherID = &pid
		g.PublisherName = pubName.String
		g.PublisherSlug = pubSlug.String
	}
	if histLow.Valid {
		hl := histLow.Float64
		g.HistoricalLowPrice = &hl
	}
	if histDate.Valid {
		hd := histDate.Time
		g.HistoricalLowDate = &hd
	}

	// 1. Obtener precios actuales en todas las tiendas oficiales
	rowsPrices, err := h.db.QueryContext(r.Context(), `
		SELECT 
			sp.id, st.id, st.name, st.slug, st.logo_url,
			cp.regular_price, cp.current_price, cp.discount_percentage,
			cp.is_on_sale, sp.product_url, cp.last_updated, sp.external_deal_id
		FROM store_products sp
		INNER JOIN stores st ON st.id = sp.store_id
		INNER JOIN current_prices cp ON cp.store_product_id = sp.id
		WHERE sp.game_id = $1 AND st.is_active = true
		ORDER BY cp.current_price ASC, cp.discount_percentage DESC;
	`, g.ID)

	currentPrices := make([]models.StorePriceInfo, 0)
	if err == nil {
		defer rowsPrices.Close()
		for rowsPrices.Next() {
			var p models.StorePriceInfo
			if err := rowsPrices.Scan(
				&p.StoreProductID, &p.StoreID, &p.StoreName, &p.StoreSlug, &p.StoreLogo,
				&p.RegularPrice, &p.CurrentPrice, &p.DiscountPercentage,
				&p.IsOnSale, &p.ProductURL, &p.LastUpdated, &p.ExternalDealID,
			); err == nil {
				currentPrices = append(currentPrices, p)
			}
		}
	}

	// Verificar si el juego tiene las tiendas oficiales clave (Steam, Epic Games Store, GOG, Humble Bundle)
	keyStoreNames := map[string]bool{"Steam": false, "Epic Games Store": false, "GOG": false, "Humble Store": false}
	for _, p := range currentPrices {
		if _, ok := keyStoreNames[p.StoreName]; ok {
			keyStoreNames[p.StoreName] = true
		}
	}
	missingKeyStore := !keyStoreNames["Steam"] || !keyStoreNames["Epic Games Store"] || !keyStoreNames["GOG"] || !keyStoreNames["Humble Store"]

	// Si el juego tiene pocas tiendas o le falta alguna de las 4 tiendas prioritarias, enriquecer en tiempo real con CheapShark
	if (len(currentPrices) < 4 || missingKeyStore) && h.syncService != nil {
		var extGameID string
		_ = h.db.QueryRowContext(r.Context(), `
			SELECT COALESCE(external_game_id, '') FROM store_products 
			WHERE game_id = $1 AND external_game_id IS NOT NULL AND external_game_id != '' 
			LIMIT 1;
		`, g.ID).Scan(&extGameID)

		added, enrichErr := h.syncService.EnrichGameMultiStore(r.Context(), g.ID, extGameID, g.SteamAppID, g.Title)
		if enrichErr == nil && added > 0 {
			_ = h.db.QueryRowContext(r.Context(), `
				SELECT historical_low_price, historical_low_date, cover_image_url 
				FROM games WHERE id = $1;
			`, g.ID).Scan(&histLow, &histDate, &g.CoverImageURL)
			if histLow.Valid {
				hl := histLow.Float64
				g.HistoricalLowPrice = &hl
			}
			if histDate.Valid {
				hd := histDate.Time
				g.HistoricalLowDate = &hd
			}

			rowsPrices2, err2 := h.db.QueryContext(r.Context(), `
				SELECT 
					sp.id, st.id, st.name, st.slug, st.logo_url,
					cp.regular_price, cp.current_price, cp.discount_percentage,
					cp.is_on_sale, sp.product_url, cp.last_updated, sp.external_deal_id
				FROM store_products sp
				INNER JOIN stores st ON st.id = sp.store_id
				INNER JOIN current_prices cp ON cp.store_product_id = sp.id
				WHERE sp.game_id = $1 AND st.is_active = true
				ORDER BY cp.current_price ASC, cp.discount_percentage DESC;
			`, g.ID)
			if err2 == nil {
				currentPrices = make([]models.StorePriceInfo, 0)
				for rowsPrices2.Next() {
					var p models.StorePriceInfo
					if err := rowsPrices2.Scan(
						&p.StoreProductID, &p.StoreID, &p.StoreName, &p.StoreSlug, &p.StoreLogo,
						&p.RegularPrice, &p.CurrentPrice, &p.DiscountPercentage,
						&p.IsOnSale, &p.ProductURL, &p.LastUpdated, &p.ExternalDealID,
					); err == nil {
						currentPrices = append(currentPrices, p)
					}
				}
				rowsPrices2.Close()
			}
		}
	}

	// 2. Cargar géneros y verificar si falta enriquecer metadatos (géneros o publisher) en vivo
	loadGenres := func(gameID int) []models.Genre {
		list := make([]models.Genre, 0)
		gRows, gErr := h.db.QueryContext(r.Context(), `
			SELECT ge.id, ge.name, ge.slug
			FROM game_genres gg
			INNER JOIN genres ge ON ge.id = gg.genre_id
			WHERE gg.game_id = $1
			ORDER BY ge.name ASC;
		`, gameID)
		if gErr == nil {
			defer gRows.Close()
			for gRows.Next() {
				var ge models.Genre
				if err := gRows.Scan(&ge.ID, &ge.Name, &ge.Slug); err == nil {
					list = append(list, ge)
				}
			}
		}
		return list
	}

	g.Genres = loadGenres(g.ID)

	if (g.PublisherID == nil || len(g.Genres) == 0) && h.syncService != nil {
		var firstDealID string
		if len(currentPrices) > 0 {
			firstDealID = currentPrices[0].ExternalDealID
		}
		_ = h.syncService.EnrichGameMetadata(r.Context(), g.ID, g.SteamAppID, firstDealID)

		// Recargar publisher y géneros tras el enriquecimiento
		var newPubID sql.NullInt64
		var newPubName, newPubSlug sql.NullString
		_ = h.db.QueryRowContext(r.Context(), `
			SELECT g.publisher_id, p.name, p.slug
			FROM games g
			LEFT JOIN publishers p ON p.id = g.publisher_id
			WHERE g.id = $1;
		`, g.ID).Scan(&newPubID, &newPubName, &newPubSlug)
		if newPubID.Valid {
			pid := int(newPubID.Int64)
			g.PublisherID = &pid
			g.PublisherName = newPubName.String
			g.PublisherSlug = newPubSlug.String
		}
		g.Genres = loadGenres(g.ID)
	}

	// 3. Obtener historial cronológico de precios para la gráfica interactiva (Keepa / Recharts)
	rowsHistory, err := h.db.QueryContext(r.Context(), `
		SELECT 
			st.name, st.slug, st.logo_url, ph.regular_price, ph.sale_price,
			ph.discount_percentage, ph.recorded_at
		FROM price_history ph
		INNER JOIN store_products sp ON sp.id = ph.store_product_id
		INNER JOIN stores st ON st.id = sp.store_id
		WHERE sp.game_id = $1
		ORDER BY ph.recorded_at ASC;
	`, g.ID)

	priceHistory := make([]models.PriceHistoryPoint, 0)
	if err == nil {
		defer rowsHistory.Close()
		for rowsHistory.Next() {
			var pt models.PriceHistoryPoint
			if err := rowsHistory.Scan(
				&pt.StoreName, &pt.StoreSlug, &pt.StoreLogo, &pt.RegularPrice, &pt.SalePrice,
				&pt.DiscountPercentage, &pt.RecordedAt,
			); err == nil {
				priceHistory = append(priceHistory, pt)
			}
		}
	}

	// Si no hay historial pero hay precios actuales, agregar los precios actuales como punto inicial
	if len(priceHistory) == 0 && len(currentPrices) > 0 {
		for _, cp := range currentPrices {
			priceHistory = append(priceHistory, models.PriceHistoryPoint{
				StoreName:          cp.StoreName,
				StoreSlug:          cp.StoreSlug,
				StoreLogo:          cp.StoreLogo,
				RegularPrice:       cp.RegularPrice,
				SalePrice:          cp.CurrentPrice,
				DiscountPercentage: cp.DiscountPercentage,
				RecordedAt:         cp.LastUpdated,
			})
		}
	}

	json.NewEncoder(w).Encode(models.GameDetail{
		Game:          g,
		CurrentPrices: currentPrices,
		PriceHistory:  priceHistory,
	})
}

// CreateGame permite agregar manualmente un juego (Ruta privada con JWT)
func (h *GameHandler) CreateGame(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req models.GameCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Cuerpo inválido"})
		return
	}

	if strings.TrimSpace(req.Title) == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "El título es obligatorio"})
		return
	}

	slug := req.Slug
	if slug == "" {
		slug = services.CleanSlug(req.Title)
	}

	var publisherID *int
	if strings.TrimSpace(req.PublisherName) != "" {
		pubName := strings.TrimSpace(req.PublisherName)
		pubSlug := services.CleanSlug(pubName)
		var pid int
		if errPub := h.db.QueryRowContext(r.Context(), `
			INSERT INTO publishers (name, slug)
			VALUES ($1, $2)
			ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
			RETURNING id;
		`, pubName, pubSlug).Scan(&pid); errPub == nil && pid > 0 {
			publisherID = &pid
		}
	}

	var gameID int
	err := h.db.QueryRowContext(r.Context(), `
		INSERT INTO games (title, slug, description, cover_image_url, steam_app_id, publisher_id, historical_low_price, historical_low_date, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
		RETURNING id;
	`, req.Title, slug, req.Description, req.CoverImageURL, req.SteamAppID, publisherID, req.CurrentPrice).Scan(&gameID)

	if err != nil {
		w.WriteHeader(http.StatusConflict)
		json.NewEncoder(w).Encode(map[string]string{"error": "No se pudo crear el juego (slug ya existente o error DB)"})
		return
	}

	// Si se envió tienda y precio, crear la relación de precio
	if req.StoreID > 0 && req.CurrentPrice > 0 {
		var spID int
		productURL := req.ProductURL
		if productURL == "" {
			productURL = "https://store.steampowered.com"
		}

		disc := 0.0
		if req.RegularPrice > req.CurrentPrice && req.RegularPrice > 0 {
			disc = math.Round((1.0-req.CurrentPrice/req.RegularPrice)*10000) / 100
		}

		_ = h.db.QueryRowContext(r.Context(), `
			INSERT INTO store_products (game_id, store_id, external_deal_id, product_url)
			VALUES ($1, $2, $3, $4)
			RETURNING id;
		`, gameID, req.StoreID, fmt.Sprintf("manual-%d", time.Now().Unix()), productURL).Scan(&spID)

		if spID > 0 {
			_, _ = h.db.ExecContext(r.Context(), `
				INSERT INTO current_prices (store_product_id, regular_price, current_price, discount_percentage, is_on_sale, currency)
				VALUES ($1, $2, $3, $4, $5, 'USD');
			`, spID, req.RegularPrice, req.CurrentPrice, disc, req.CurrentPrice < req.RegularPrice)

			_, _ = h.db.ExecContext(r.Context(), `
				INSERT INTO price_history (store_product_id, regular_price, sale_price, discount_percentage)
				VALUES ($1, $2, $3, $4);
			`, spID, req.RegularPrice, req.CurrentPrice, disc)
		}
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":      gameID,
		"title":   req.Title,
		"slug":    slug,
		"message": "Juego creado exitosamente",
	})
}

// UpdatePrice permite actualizar el precio de un producto de tienda existente (Ruta privada con JWT)
func (h *GameHandler) UpdatePrice(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	storeProductID, err := strconv.Atoi(chi.URLParam(r, "storeProductId"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "ID de producto inválido"})
		return
	}

	var req models.PriceUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Cuerpo inválido"})
		return
	}

	disc := 0.0
	if req.RegularPrice > req.CurrentPrice && req.RegularPrice > 0 {
		disc = math.Round((1.0-req.CurrentPrice/req.RegularPrice)*10000) / 100
	}

	_, err = h.db.ExecContext(r.Context(), `
		INSERT INTO current_prices (store_product_id, regular_price, current_price, discount_percentage, is_on_sale, currency, last_updated)
		VALUES ($1, $2, $3, $4, $5, 'USD', NOW())
		ON CONFLICT (store_product_id) DO UPDATE SET
			regular_price = EXCLUDED.regular_price,
			current_price = EXCLUDED.current_price,
			discount_percentage = EXCLUDED.discount_percentage,
			is_on_sale = EXCLUDED.is_on_sale,
			last_updated = NOW();
	`, storeProductID, req.RegularPrice, req.CurrentPrice, disc, req.IsOnSale)

	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error al actualizar precio"})
		return
	}

	// Registrar en historial
	_, _ = h.db.ExecContext(r.Context(), `
		INSERT INTO price_history (store_product_id, regular_price, sale_price, discount_percentage, recorded_at)
		VALUES ($1, $2, $3, $4, NOW());
	`, storeProductID, req.RegularPrice, req.CurrentPrice, disc)

	// Evaluar Wishlists y disparar alertas + correos electrónicos si alcanza algún precio objetivo
	var gameID int
	var gameTitle, gameSlug, storeName, productURL string
	errMeta := h.db.QueryRowContext(r.Context(), `
		SELECT g.id, g.title, g.slug, st.name, sp.product_url
		FROM store_products sp
		INNER JOIN games g ON g.id = sp.game_id
		INNER JOIN stores st ON st.id = sp.store_id
		WHERE sp.id = $1;
	`, storeProductID).Scan(&gameID, &gameTitle, &gameSlug, &storeName, &productURL)

	if errMeta == nil {
		rowsW, errW := h.db.QueryContext(r.Context(), `
			SELECT w.id, w.target_price, u.email, u.username
			FROM wishlists w
			INNER JOIN users u ON u.id = w.user_id
			WHERE w.game_id = $1 AND w.notify_active = true AND w.target_price >= $2;
		`, gameID, req.CurrentPrice)
		if errW == nil {
			defer rowsW.Close()
			for rowsW.Next() {
				var wid int
				var tp float64
				var uEmail, uName string
				if errS := rowsW.Scan(&wid, &tp, &uEmail, &uName); errS == nil {
					var cnt int
					_ = h.db.QueryRowContext(r.Context(), `
						SELECT COUNT(*) FROM price_alerts 
						WHERE wishlist_id = $1 AND store_name = $2 AND triggered_price = $3 AND triggered_at > NOW() - INTERVAL '24 hours';
					`, wid, storeName, req.CurrentPrice).Scan(&cnt)
					if cnt == 0 {
						msg := fmt.Sprintf("¡%s está en oferta en %s por solo $%.2f (tu precio objetivo era $%.2f, -%.0f%%)!",
							gameTitle, storeName, req.CurrentPrice, tp, disc)
						var alertID int
						errA := h.db.QueryRowContext(r.Context(), `
							INSERT INTO price_alerts (wishlist_id, store_name, triggered_price, message, is_read, email_sent, triggered_at)
							VALUES ($1, $2, $3, $4, false, false, NOW())
							RETURNING id;
						`, wid, storeName, req.CurrentPrice, msg).Scan(&alertID)
						if errA == nil && alertID > 0 && h.syncService != nil {
							h.syncService.SendSingleAlertEmailAsync(alertID, uEmail, uName, gameTitle, gameSlug, storeName, req.CurrentPrice, tp, disc, productURL)
						}
					}
				}
			}
		}
	}

	json.NewEncoder(w).Encode(map[string]string{"message": "Precio actualizado correctamente"})
}

// DeleteGame elimina un videojuego y sus dependencias (Ruta privada con JWT)
func (h *GameHandler) DeleteGame(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	gameID, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "ID inválido"})
		return
	}

	result, err := h.db.ExecContext(r.Context(), `DELETE FROM games WHERE id = $1;`, gameID)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error al eliminar juego: " + err.Error()})
		return
	}

	rowsAff, _ := result.RowsAffected()
	if rowsAff == 0 {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "Juego no encontrado"})
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"message": "Juego eliminado exitosamente"})
}

// EnrichSingleGame permite forzar la búsqueda y enriquecimiento multi-tienda para un videojuego específico
func (h *GameHandler) EnrichSingleGame(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if h.db == nil || h.syncService == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]string{"error": "Servicio de base de datos o sincronización no disponible"})
		return
	}

	slug := chi.URLParam(r, "slug")
	if slug == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Slug no proporcionado"})
		return
	}

	var gameID int
	var title, steamAppID string
	err := h.db.QueryRowContext(r.Context(), `
		SELECT id, title, COALESCE(steam_app_id, '') 
		FROM games WHERE slug = $1;
	`, slug).Scan(&gameID, &title, &steamAppID)

	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "Videojuego no encontrado"})
		return
	}

	var extGameID string
	_ = h.db.QueryRowContext(r.Context(), `
		SELECT COALESCE(external_game_id, '') FROM store_products 
		WHERE game_id = $1 AND external_game_id IS NOT NULL AND external_game_id != '' 
		LIMIT 1;
	`, gameID).Scan(&extGameID)

	storesAdded, err := h.syncService.EnrichGameMultiStore(r.Context(), gameID, extGameID, steamAppID, title)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "Error al enriquecer juego: " + err.Error(),
		})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message":      fmt.Sprintf("Juego enriquecido exitosamente. Se sincronizaron %d tiendas oficiales.", storesAdded),
		"stores_added": storesAdded,
	})
}
