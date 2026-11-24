package models

import (
	"time"
)

// User representa a un usuario del sistema (soporta auth con contraseña y Google OAuth)
type User struct {
	ID           int       `json:"id"`
	Username     string    `json:"username"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	GoogleID     *string   `json:"google_id,omitempty"`
	AvatarURL    string    `json:"avatar_url"`
	IsAdmin      bool      `json:"is_admin"`
	CreatedAt    time.Time `json:"created_at"`
}

// UserDTO para respuestas de autenticación
type UserDTO struct {
	ID        int       `json:"id"`
	Username  string    `json:"username"`
	Email     string    `json:"email"`
	AvatarURL string    `json:"avatar_url"`
	IsAdmin   bool      `json:"is_admin"`
	CreatedAt time.Time `json:"created_at"`
}

// Store representa una tienda digital de videojuegos
type Store struct {
	ID              int    `json:"id"`
	ExternalStoreID string `json:"external_store_id"`
	Name            string `json:"name"`
	Slug            string `json:"slug"`
	BaseURL         string `json:"base_url"`
	LogoURL         string `json:"logo_url"`
	IsActive        bool   `json:"is_active"`
	DealsCount      int    `json:"deals_count"`
}

// Genre representa un género de videojuegos
type Genre struct {
	ID         int    `json:"id"`
	Name       string `json:"name"`
	Slug       string `json:"slug"`
	GamesCount int    `json:"games_count"`
}

// Publisher representa una distribuidora o desarrollador
type Publisher struct {
	ID         int    `json:"id"`
	Name       string `json:"name"`
	Slug       string `json:"slug"`
	GamesCount int    `json:"games_count"`
}

// BestDeal resumen de la oferta más conveniente para una tarjeta de juego
type BestDeal struct {
	StoreID            int     `json:"store_id"`
	StoreName          string  `json:"store_name"`
	StoreSlug          string  `json:"store_slug"`
	StoreLogo          string  `json:"store_logo"`
	RegularPrice       float64 `json:"regular_price"`
	CurrentPrice       float64 `json:"current_price"`
	DiscountPercentage float64 `json:"discount_percentage"`
	ProductURL         string  `json:"product_url"`
	IsHistoricalLow    bool    `json:"is_historical_low"`
	ExternalDealID     string  `json:"external_deal_id"`
}

// Game representa la entidad principal de videojuego en el catálogo
type Game struct {
	ID                 int        `json:"id"`
	Title              string     `json:"title"`
	Slug               string     `json:"slug"`
	Description        string     `json:"description"`
	CoverImageURL      string     `json:"cover_image_url"`
	SteamAppID         string     `json:"steam_app_id,omitempty"`
	PublisherID        *int       `json:"publisher_id,omitempty"`
	PublisherName      string     `json:"publisher_name,omitempty"`
	PublisherSlug      string     `json:"publisher_slug,omitempty"`
	HistoricalLowPrice *float64   `json:"historical_low_price,omitempty"`
	HistoricalLowDate  *time.Time `json:"historical_low_date,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
	StoresCount        int        `json:"stores_count"`
	BestDeal           *BestDeal  `json:"best_deal,omitempty"`
	Genres             []Genre    `json:"genres,omitempty"`
}

// StorePriceInfo precio actual de un juego en una tienda específica
type StorePriceInfo struct {
	StoreProductID     int       `json:"store_product_id"`
	StoreID            int       `json:"store_id"`
	StoreName          string    `json:"store_name"`
	StoreSlug          string    `json:"store_slug"`
	StoreLogo          string    `json:"store_logo"`
	RegularPrice       float64   `json:"regular_price"`
	CurrentPrice       float64   `json:"current_price"`
	DiscountPercentage float64   `json:"discount_percentage"`
	IsOnSale           bool      `json:"is_on_sale"`
	ProductURL         string    `json:"product_url"`
	LastUpdated        time.Time `json:"last_updated"`
	ExternalDealID     string    `json:"external_deal_id"`
}

// PriceHistoryPoint punto temporal de precio para gráficas de series de tiempo
type PriceHistoryPoint struct {
	StoreName          string    `json:"store_name"`
	StoreSlug          string    `json:"store_slug"`
	StoreLogo          string    `json:"store_logo"`
	RegularPrice       float64   `json:"regular_price"`
	SalePrice          float64   `json:"sale_price"`
	DiscountPercentage float64   `json:"discount_percentage"`
	RecordedAt         time.Time `json:"recorded_at"`
}

// GameDetail estructura completa retornada para la página de detalle
type GameDetail struct {
	Game          Game                `json:"game"`
	CurrentPrices []StorePriceInfo    `json:"current_prices"`
	PriceHistory  []PriceHistoryPoint `json:"price_history"`
}

// WishlistItem elemento en la lista de deseos con su precio objetivo
type WishlistItem struct {
	ID               int       `json:"id"`
	UserID           int       `json:"user_id"`
	GameID           int       `json:"game_id"`
	GameTitle        string    `json:"game_title"`
	GameSlug         string    `json:"game_slug"`
	GameCover        string    `json:"game_cover"`
	TargetPrice      float64   `json:"target_price"`
	CurrentBestPrice *float64  `json:"current_best_price"`
	CurrentDiscount  *float64  `json:"current_discount"`
	StoreName        string    `json:"store_name"`
	StoreLogo        string    `json:"store_logo"`
	ProductURL       string    `json:"product_url"`
	NotifyActive     bool      `json:"notify_active"`
	CreatedAt        time.Time `json:"created_at"`
}

// PriceAlert notificación disparada por cumplimiento de precio objetivo
type PriceAlert struct {
	ID             int       `json:"id"`
	WishlistID     int       `json:"wishlist_id"`
	GameTitle      string    `json:"game_title"`
	GameSlug       string    `json:"game_slug"`
	GameCover      string    `json:"game_cover"`
	StoreName      string    `json:"store_name"`
	TriggeredPrice float64   `json:"triggered_price"`
	TargetPrice    float64   `json:"target_price"`
	Message        string    `json:"message"`
	IsRead         bool      `json:"is_read"`
	EmailSent      bool      `json:"email_sent"`
	TriggeredAt    time.Time `json:"triggered_at"`
}

// SyncLog registro de auditoría de sincronizaciones
type SyncLog struct {
	ID             int       `json:"id"`
	Source         string    `json:"source"`
	DealsProcessed int       `json:"deals_processed"`
	Status         string    `json:"status"`
	ErrorMessage   *string   `json:"error_message,omitempty"`
	ExecutedAt     time.Time `json:"executed_at"`
}

// DTOs para CheapShark API
type CheapSharkDeal struct {
	InternalName       string `json:"internalName"`
	Title              string `json:"title"`
	MetacriticLink     string `json:"metacriticLink"`
	DealID             string `json:"dealID"`
	StoreID            string `json:"storeID"`
	GameID             string `json:"gameID"`
	SalePrice          string `json:"salePrice"`
	NormalPrice        string `json:"normalPrice"`
	IsOnSale           string `json:"isOnSale"`
	Savings            string `json:"savings"`
	MetacriticScore    string `json:"metacriticScore"`
	SteamRatingText    string `json:"steamRatingText"`
	SteamRatingPercent string `json:"steamRatingPercent"`
	SteamRatingCount   string `json:"steamRatingCount"`
	SteamAppID         string `json:"steamAppID"`
	ReleaseDate        int64  `json:"releaseDate"`
	LastChange         int64  `json:"lastChange"`
	DealRating         string `json:"dealRating"`
	Thumb              string `json:"thumb"`
}

type CheapSharkStoreImages struct {
	Banner string `json:"banner"`
	Logo   string `json:"logo"`
	Icon   string `json:"icon"`
}

type CheapSharkStore struct {
	StoreID  string                `json:"storeID"`
	StoreName string               `json:"storeName"`
	IsActive int                   `json:"isActive"`
	Images   CheapSharkStoreImages `json:"images"`
}

type SyncIngestPayload struct {
	Deals  []CheapSharkDeal  `json:"deals"`
	Stores []CheapSharkStore `json:"stores"`
}

// Requests y Responses para Handlers
type RegisterRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type GoogleAuthRequest struct {
	Credential string `json:"credential"` // ID Token retornado por Google Identity Services
	ClientID   string `json:"client_id,omitempty"`
}

type AuthResponse struct {
	Token string  `json:"token"`
	User  UserDTO `json:"user"`
}

type WishlistRequest struct {
	GameID      int     `json:"game_id"`
	TargetPrice float64 `json:"target_price"`
}

type GameCreateRequest struct {
	Title         string  `json:"title"`
	Slug          string  `json:"slug"`
	Description   string  `json:"description"`
	CoverImageURL string  `json:"cover_image_url"`
	SteamAppID    string  `json:"steam_app_id"`
	PublisherName string  `json:"publisher_name"`
	RegularPrice  float64 `json:"regular_price"`
	CurrentPrice  float64 `json:"current_price"`
	StoreID       int     `json:"store_id"`
	ProductURL    string  `json:"product_url"`
}

type PriceUpdateRequest struct {
	RegularPrice float64 `json:"regular_price"`
	CurrentPrice float64 `json:"current_price"`
	IsOnSale     bool    `json:"is_on_sale"`
	ProductURL   string  `json:"product_url"`
}
