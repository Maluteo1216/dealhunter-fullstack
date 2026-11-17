-- ============================================================================
-- 01_schema.sql
-- Base de Datos Relacional en 3NF para Plataforma de Rastreo de Precios
-- Motor: PostgreSQL 16+ (compatible con Neon.tech)
-- ============================================================================

-- 1. Usuarios registrados (soporta autenticación tradicional con bcrypt y Google OAuth)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash TEXT DEFAULT '',
    google_id VARCHAR(100) UNIQUE,
    avatar_url TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tiendas digitales oficiales (mapeadas con IDs externos de CheapShark)
CREATE TABLE IF NOT EXISTS stores (
    id SERIAL PRIMARY KEY,
    external_store_id VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    base_url TEXT NOT NULL,
    logo_url TEXT,
    is_active BOOLEAN DEFAULT TRUE
);

-- 3. Géneros de videojuegos
CREATE TABLE IF NOT EXISTS genres (
    id SERIAL PRIMARY KEY,
    name VARCHAR(60) NOT NULL UNIQUE,
    slug VARCHAR(60) NOT NULL UNIQUE
);

-- 4. Publishers / Desarrolladores
CREATE TABLE IF NOT EXISTS publishers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE,
    slug VARCHAR(120) NOT NULL UNIQUE
);

-- 5. Catálogo maestro de videojuegos (Entidad central)
CREATE TABLE IF NOT EXISTS games (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    cover_image_url TEXT,
    steam_app_id VARCHAR(30),
    publisher_id INT REFERENCES publishers(id) ON DELETE SET NULL,
    historical_low_price DECIMAL(12,2),
    historical_low_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Tabla puente N:M entre Juegos y Géneros
CREATE TABLE IF NOT EXISTS game_genres (
    game_id INT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    genre_id INT NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
    PRIMARY KEY (game_id, genre_id)
);

-- 7. Relación entre un Juego y una Tienda específica
CREATE TABLE IF NOT EXISTS store_products (
    id SERIAL PRIMARY KEY,
    game_id INT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    external_game_id VARCHAR(50),
    external_deal_id VARCHAR(100) NOT NULL,
    product_url TEXT NOT NULL,
    UNIQUE (game_id, store_id)
);

-- 8. Precios vigentes actuales por producto en cada tienda
CREATE TABLE IF NOT EXISTS current_prices (
    id SERIAL PRIMARY KEY,
    store_product_id INT NOT NULL UNIQUE REFERENCES store_products(id) ON DELETE CASCADE,
    regular_price DECIMAL(12,2) NOT NULL,
    current_price DECIMAL(12,2) NOT NULL,
    discount_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    is_on_sale BOOLEAN NOT NULL DEFAULT FALSE,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Histórico temporal de precios (Series de tiempo para gráficas)
CREATE TABLE IF NOT EXISTS price_history (
    id SERIAL PRIMARY KEY,
    store_product_id INT NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
    regular_price DECIMAL(12,2) NOT NULL,
    sale_price DECIMAL(12,2) NOT NULL,
    discount_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Lista de deseos y configuración de alerta por usuario
CREATE TABLE IF NOT EXISTS wishlists (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_id INT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    target_price DECIMAL(12,2) NOT NULL,
    notify_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, game_id)
);

-- 11. Notificaciones/Alertas disparadas cuando un juego alcanza el precio objetivo
CREATE TABLE IF NOT EXISTS price_alerts (
    id SERIAL PRIMARY KEY,
    wishlist_id INT NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
    store_name VARCHAR(100) NOT NULL,
    triggered_price DECIMAL(12,2) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. Auditoría de sincronizaciones con APIs externas
CREATE TABLE IF NOT EXISTS sync_logs (
    id SERIAL PRIMARY KEY,
    source VARCHAR(50) NOT NULL,
    deals_processed INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL,
    error_message TEXT,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para acelerar búsquedas, filtros y gráficas históricas
CREATE INDEX IF NOT EXISTS idx_games_slug ON games(slug);
CREATE INDEX IF NOT EXISTS idx_games_title ON games(title);
CREATE INDEX IF NOT EXISTS idx_current_prices_sale ON current_prices(is_on_sale, discount_percentage DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_product_date ON price_history(store_product_id, recorded_at ASC);
CREATE INDEX IF NOT EXISTS idx_wishlists_user ON wishlists(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
