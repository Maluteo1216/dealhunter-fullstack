package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"

	"price-tracker-backend/internal/config"
	"price-tracker-backend/internal/database"
	"price-tracker-backend/internal/handlers"
	"price-tracker-backend/internal/middleware"
	"price-tracker-backend/internal/services"
)

func main() {
	cfg := config.LoadConfig()

	log.Printf("Iniciando servicio API de Rastreo de Precios en el puerto %s...", cfg.Port)

	// Inicializar conexión con base de datos
	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Printf("Advertencia durante conexión inicial a la base de datos: %v", err)
	}
	if db != nil && db.Pool != nil {
		defer db.Pool.Close()
	}

	// Inicializar servicios y handlers
	var syncService *services.SyncService
	if db != nil && db.Pool != nil {
		syncService = services.NewSyncService(db.Pool)
	}

	var dbPool = db.Pool
	authHandler := handlers.NewAuthHandler(dbPool, cfg.JWTSecret, cfg.GoogleClientID)
	gameHandler := handlers.NewGameHandler(dbPool, syncService)
	storeHandler := handlers.NewStoreHandler(dbPool)
	wishlistHandler := handlers.NewWishlistHandler(dbPool)
	alertHandler := handlers.NewAlertHandler(dbPool)
	syncHandler := handlers.NewSyncHandler(dbPool, syncService)

	// Router principal
	r := chi.NewRouter()

	// Middlewares globales
	r.Use(chiMiddleware.RequestID)
	r.Use(chiMiddleware.RealIP)
	r.Use(chiMiddleware.Logger)
	r.Use(chiMiddleware.Recoverer)
	r.Use(middleware.CorsMiddleware())

	// Endpoint de salud para Render y ServerWakeBanner
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		dbStatus := "disconnected"
		if db != nil && db.Pool != nil {
			if err := db.Pool.Ping(); err == nil {
				dbStatus = "connected"
			}
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{
			"status":   "ok",
			"database": dbStatus,
			"service":  "price-tracker-api",
		})
	})

	// Agrupación de rutas API v1
	r.Route("/api/v1", func(api chi.Router) {
		// Autenticación pública
		api.Post("/auth/register", authHandler.Register)
		api.Post("/auth/login", authHandler.Login)
		api.Post("/auth/google", authHandler.GoogleLogin) // Login obligatorio con Google OAuth

		// Catálogo y tiendas públicas
		api.Get("/games", gameHandler.GetGames)
		api.Get("/games/{slug}", gameHandler.GetGameBySlug)
		api.Post("/games/{slug}/enrich", gameHandler.EnrichSingleGame)
		api.Get("/stores", storeHandler.GetStores)

		// Sincronización pública / administrativa
		api.Post("/sync/ingest", syncHandler.IngestDeals)
		api.Post("/sync/server", syncHandler.ServerSync)
		api.Post("/sync/random", syncHandler.RandomSync)
		api.Post("/sync/enrich", syncHandler.EnrichCatalog)
		api.Get("/sync/logs", syncHandler.GetSyncLogs)

		// Rutas protegidas por JWT
		api.Group(func(protected chi.Router) {
			protected.Use(middleware.AuthMiddleware(cfg.JWTSecret))

			// Perfil
			protected.Get("/auth/me", authHandler.Me)

			// Operaciones CRUD de juegos y precios
			protected.Post("/games", gameHandler.CreateGame)
			protected.Put("/prices/{storeProductId}", gameHandler.UpdatePrice)
			protected.Delete("/games/{id}", gameHandler.DeleteGame)

			// Wishlist del usuario
			protected.Get("/wishlist", wishlistHandler.GetWishlist)
			protected.Post("/wishlist", wishlistHandler.AddToWishlist)
			protected.Delete("/wishlist/{gameId}", wishlistHandler.DeleteFromWishlist)

			// Alertas de precio del usuario
			protected.Get("/alerts", alertHandler.GetAlerts)
			protected.Put("/alerts/{id}/read", alertHandler.MarkAlertRead)
		})
	})

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("Servidor escuchando en http://localhost%s", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("Error al iniciar servidor HTTP: %v", err)
	}
}
