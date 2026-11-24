# DealHunter — Contexto Maestro del Proyecto para Inteligencia Artificial y Desarrolladores

> **Propósito de este documento:** Este archivo contiene el contexto integral, arquitectura, modelo de datos, endpoints, dependencias, flujos de autenticación, integración con APIs externas y manual de despliegue de **DealHunter**. Está diseñado para que cualquier modelo de lenguaje (IA) o desarrollador que abra este repositorio pueda comprender el sistema al 100% y continuar construyendo sin requerir contexto adicional.

---

## 1. Visión General del Proyecto

**DealHunter** es una plataforma web completa inspirada en *IsThereAnyDeal* para el monitoreo, comparación histórica y alertas de precios de videojuegos en tiendas digitales oficiales (Steam, Epic Games Store, GOG, Fanatical, GreenManGaming, Humble Store, etc.), consumiendo en tiempo real los datos públicos de la **CheapShark API**.

### Restricciones Arquitectónicas Obligatorias (3 Capas Desacopladas)
El proyecto **DEBE** permanecer dividido en **3 carpetas independientes**, cada una escrita en un **lenguaje de programación diferente** y preparada para desplegarse de manera aislada en su respectiva plataforma cloud:

1. **Capa 1: Base de Datos (`/database`)**
   - **Lenguaje:** **SQL** (PostgreSQL 16+)
   - **Plataforma de Despliegue:** **Neon.tech** (PostgreSQL Serverless)
   - **Modelo:** 12 tablas relacionales en Tercera Forma Normal (3NF).
2. **Capa 2: Backend REST API (`/backend`)**
   - **Lenguaje:** **Go (Golang 1.22+)** — *REGLA ESTRICTA: Cero uso de Python en todo el backend y repositorio*.
   - **Plataforma de Despliegue:** **Render.com** (Web Service en Go)
   - **Router:** `github.com/go-chi/chi/v5`
   - **Driver DB:** `github.com/lib/pq` (`database/sql` nativo)
   - **Auth:** JWT (`golang-jwt/jwt/v5`) + `bcrypt` (`golang.org/x/crypto/bcrypt`) + Google OAuth2.
3. **Capa 3: Frontend Web SPA (`/frontend`)**
   - **Lenguaje:** **TypeScript**
   - **Plataforma de Despliegue:** **Netlify** (Static Site / SPA)
   - **Framework:** React 18 + Vite + Tailwind CSS + Lucide React + Recharts (para series de tiempo de precios).

---

## 2. Árbol de Archivos del Proyecto

```text
/ProjectoEstructuraDatos
├── PROJECT_CONTEXT.md           # [ESTE ARCHIVO] Contexto maestro para IA / Desarrollador
├── PROJECT_SPEC.md              # Especificación técnica original de requerimientos
├── README.md                    # Manual de usuario, despliegue y puesta en marcha
├── .gitignore                   # Exclusiones de Git (node_modules, bin, .env, dist)
├── /database
│   ├── 01_schema.sql            # DDL de las 12 tablas en 3NF con índices y llaves foráneas
│   └── 02_seed.sql              # Semilla inicial: tiendas oficiales CheapShark y géneros
├── /backend
│   ├── go.mod, go.sum           # Módulos y dependencias de Go 1.22
│   ├── render.yaml              # Configuración Infrastructure-as-Code para Render.com
│   ├── .env.example             # Variables de entorno requeridas en el backend
│   ├── /cmd/api
│   │   └── main.go              # Punto de entrada, inyección de dependencias y rutas HTTP
│   └── /internal
│       ├── /config/config.go    # Lectura de variables de entorno (PORT, DATABASE_URL, etc.)
│       ├── /database/db.go      # Pool de conexiones a PostgreSQL con timeout y ping
│       ├── /models/models.go    # Structs de dominio, DTOs de CheapShark y JSON
│       ├── /middleware/middleware.go # CORS permisivo y autenticación JWT en contexto
│       ├── /handlers
│       │   ├── auth_handler.go  # Registro, Login tradicional y Google OAuth
│       │   ├── game_handler.go  # Catálogo con filtros, detalle y auto-enriquecimiento
│       │   ├── store_handler.go # Listado de tiendas y conteo de ofertas
│       │   ├── wishlist_handler.go # Wishlist personal y precio objetivo
│       │   ├── alert_handler.go # Notificaciones disparadas y marcar leída
│       │   └── sync_handler.go  # Ingesta desde cliente, server sync y enrich
│       └── /services
│           ├── sync_service.go  # Motor transaccional, CleanSlug, histórico y CheapShark
│           └── sync_service_test.go # Pruebas unitarias de Go
└── /frontend
    ├── package.json, package-lock.json
    ├── tsconfig.json, tsconfig.node.json
    ├── vite.config.ts           # Configuración de Vite con proxy local en :8080
    ├── tailwind.config.js       # Colores brand y configuración de estilos
    ├── postcss.config.js
    ├── netlify.toml             # Redirección SPA (/* -> /index.html) para Netlify
    ├── .env.example             # Variables de entorno para el frontend
    ├── index.html               # Carga del SDK oficial Google Identity Services
    └── /src
        ├── vite-env.d.ts        # Tipado de Vite y variables de entorno
        ├── index.css            # Directivas Tailwind y estilos de scrollbar
        ├── main.tsx             # Montaje de React DOM
        ├── App.tsx              # Proveedores de contexto y enrutador React Router v6
        ├── /types/index.ts      # Interfaces TypeScript alineadas 1:1 con Go
        ├── /api/client.ts       # Cliente HTTP fetch con inyección de JWT y cold starts
        ├── /context
        │   ├── AuthContext.tsx  # Estado global de sesión de usuario y logout
        │   ├── ServerStatusContext.tsx # Detección y sondeo del cold start de Render
        │   └── SidebarContext.tsx # Control de estado colapsado/expandido y drawer móvil
        ├── /components
        │   ├── Sidebar.tsx      # Barra lateral colapsable (toggle con llama) con modo icono w-20 y admin check
        │   ├── Navbar.tsx       # Re-export retrocompatible hacia Sidebar
        │   ├── ServerWakeBanner.tsx # Banner discreto cuando Render despierta del reposo
        │   ├── GameCard.tsx     # Tarjeta de juego con ofertas, insignias pastel y wishlist interactiva
        │   ├── StoreTable.tsx   # Tabla comparativa multi-tienda ordenada por precio
        │   └── GoogleLoginButton.tsx # Botón oficial de Google Identity Services
        └── /pages
            ├── HomePage.tsx     # Explorador con búsqueda debounced y filtros avanzados
            ├── GameDetailPage.tsx # Ficha con comparador multi-tienda y botón de búsqueda
            ├── WishlistPage.tsx # Bandeja de wishlist y centro de notificaciones
            ├── SyncAdminPage.tsx # Centro de sincronización y enriquecimiento de tiendas
            └── AuthPage.tsx     # Login/Registro tradicional y acceso con Google
```

---

## 3. Capa de Base de Datos (`/database`)

### Esquema Relacional de 12 Tablas (`01_schema.sql`)
Todas las tablas cumplen con 3NF y utilizan `DECIMAL(12,2)` para evitar imprecisiones de coma flotante:

1. **`users`**: `id`, `username` (UNIQUE), `email` (UNIQUE), `password_hash`, `google_id` (UNIQUE), `avatar_url`, `is_admin`, `created_at`.
2. **`stores`**: `id`, `external_store_id` (VARCHAR UNIQUE), `name`, `slug` (UNIQUE), `base_url`, `logo_url`, `is_active`.
3. **`genres`**: `id`, `name`, `slug` (UNIQUE).
4. **`publishers`**: `id`, `name`, `slug` (UNIQUE).
5. **`games`**: `id`, `title`, `slug` (UNIQUE), `description`, `cover_image_url`, `steam_app_id`, `publisher_id`, `historical_low_price`, `historical_low_date`, `created_at`.
6. **`game_genres`**: `(game_id, genre_id)` (PK Compuesta, N:M).
7. **`store_products`**: `id`, `game_id`, `store_id`, `external_game_id`, `external_deal_id`, `product_url`, `UNIQUE (game_id, store_id)`.
8. **`current_prices`**: `id`, `store_product_id` (UNIQUE FK), `regular_price`, `current_price`, `discount_percentage`, `is_on_sale`, `currency`, `last_updated`.
9. **`price_history`**: `id`, `store_product_id` (FK), `regular_price`, `sale_price`, `discount_percentage`, `recorded_at`.
10. **`wishlists`**: `id`, `user_id` (FK), `game_id` (FK), `target_price`, `notify_active`, `created_at`, `UNIQUE (user_id, game_id)`.
11. **`price_alerts`**: `id`, `wishlist_id` (FK), `store_name`, `triggered_price`, `message`, `is_read`, `triggered_at`.
12. **`sync_logs`**: `id`, `source`, `deals_processed`, `status`, `error_message`, `executed_at`.

### Índices de Rendimiento
- `idx_games_slug`, `idx_games_title`, `idx_current_prices_sale`, `idx_price_history_product_date`, `idx_wishlists_user`, `idx_users_email`, `idx_users_google_id`.

---

## 4. Capa de Backend en Go (`/backend`)

### Endpoints RESTful Implementados

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Público | Retorna `{"status":"ok", "database":"connected"}` para despertar Render. |
| `POST` | `/api/v1/auth/register` | Público | Registra usuario con email/password (hash bcrypt). Retorna JWT. |
| `POST` | `/api/v1/auth/login` | Público | Autenticación tradicional. Retorna JWT. |
| `POST` | `/api/v1/auth/google` | Público | Valida `id_token` con Google, genera o recupera usuario y retorna JWT. |
| `GET` | `/api/v1/auth/me` | Privado (JWT) | Perfil del usuario autenticado. |
| `GET` | `/api/v1/games` | Público | Catálogo con filtros: `search`, `store`, `min_discount`, `max_price`, `sort`, `page`, `limit`. |
| `GET` | `/api/v1/games/{slug}` | Público | Ficha completa: metadatos, mínimo histórico, tabla multi-tienda y serie temporal. Si el juego tiene <= 1 tienda, auto-enriquece en tiempo real con CheapShark. |
| `POST` | `/api/v1/games/{slug}/enrich` | Público | Fuerza el enriquecimiento multi-tienda para ese juego específico. |
| `GET` | `/api/v1/stores` | Público | Listado de tiendas con conteo de ofertas vigentes. |
| `POST` | `/api/v1/games` | Privado (JWT) | Creación manual de un juego. |
| `PUT` | `/api/v1/prices/{storeProductId}` | Privado (JWT) | Actualización manual de precio y recálculo de alertas. |
| `DELETE` | `/api/v1/games/{id}` | Privado (JWT) | Eliminación en cascada de un juego. |
| `GET` | `/api/v1/wishlist` | Privado (JWT) | Wishlist del usuario con mejor precio actual vs `target_price`. |
| `POST` | `/api/v1/wishlist` | Privado (JWT) | Añade o actualiza el precio objetivo de un juego. |
| `DELETE` | `/api/v1/wishlist/{gameId}` | Privado (JWT) | Elimina un juego de la wishlist. |
| `GET` | `/api/v1/alerts` | Privado (JWT) | Lista notificaciones de precios disparadas. |
| `PUT` | `/api/v1/alerts/{id}/read` | Privado (JWT) | Marca una alerta como leída. |
| `POST` | `/api/v1/sync/ingest` | Público | Ingesta masiva transaccional de ofertas con soporte `?auto_enrich=true` para enriquecer tiendas en el mismo proceso. |
| `POST` | `/api/v1/sync/server` | Público | Sincronización nativa directa ejecutada por Go en el servidor. |
| `POST` | `/api/v1/sync/random` | Público | Descubrimiento aleatorio (página y criterio al azar) con auto-enriquecimiento integrado de tiendas. |
| `POST` | `/api/v1/sync/enrich` | Público | Enriquecimiento en lote de juegos que solo tienen 1 tienda registrada. |
| `GET` | `/api/v1/sync/logs` | Público | Historial de las últimas 15 ejecuciones de sincronización. |

---

## 5. Integración con la API de CheapShark y Lógica Multi-Tienda

### Requisito Crítico: Cabecera User-Agent
CheapShark **bloquea con HTTP 400** las peticiones que no tengan un User-Agent descriptivo o que usen `Mozilla/5.0...` desde servidores. En Go está definido:
```go
const CheapSharkUserAgent = "DealHunter/1.0 (contact@dealhunter.app; +https://dealhunter.netlify.app)"
```

### Cómo Funciona CheapShark y la Comparación Multi-Tienda
1. **Descubrimiento Aleatorio Auto-Enriquecido (`/sync/random`):**
   - Selecciona páginas aleatorias (1 a 25) y criterios al azar (Reviews, Metacritic, Savings, Release) para traer juegos nuevos continuamente.
   - En el mismo proceso de ingesta, auto-enriquece cada título agregando todas las tiendas oficiales disponibles, garantizando las 4 tiendas clave: **Steam (`1`)**, **Epic Games Store (`25`)**, **GOG (`7`)** y **Humble Store (`11`)**.
2. **`/games?id={gameID}` (Ficha Integral del Juego en CheapShark):**
   - Devuelve todas las tiendas oficiales donde existe ese juego en ese instante.
3. **Búsqueda Prioritaria de las 4 Tiendas Principales (Steam, Epic, GOG, Humble):**
   - El motor ejecuta búsqueda cruzada obligatoria en `/games?steamAppID={appID}` (con soporte de respuesta en objeto/array), `/games?title={title}`, `/deals?title={title}` y consultas dirigidas por tienda (`/deals?storeID={id}&title={title}`).
   - Utiliza normalización canónica alfanumérica (`NormalizeTitleForMatch` / `TitlesMatch`) que ignora puntuaciones y diferencias ortográficas, previniendo falsos positivos con DLCs o secuelas.
4. **Auto-Enriquecimiento (`EnrichGameMultiStore`):**
   - Cuando un usuario abre la ficha de un juego (`GET /api/v1/games/{slug}`) o presiona *"Buscar en Más Tiendas"*, si carece de tiendas clave o tiene pocas tiendas, Go consulta CheapShark en tiempo real, descubre todas las demás tiendas, guarda los precios y dispara alertas a los usuarios cuya wishlist coincida con los precios descubiertos.
5. **Motor de Filtros a Nivel de Oferta (`GetGames`):**
   - La consulta SQL utiliza una CTE dinámica con `INNER JOIN` o `LEFT JOIN` que filtra directamente sobre el pool de ofertas (`store`, `min_discount`, `max_price`), garantizando que la tarjeta del juego muestre exactamente la oferta de la tienda y descuento seleccionados.

---

## 6. Autenticación Obligatoria con Google (Google Identity Services)

### Flujo de Funcionamiento:
1. El frontend carga el SDK oficial en [index.html](frontend/index.html):
   ```html
   <script src="https://accounts.google.com/gsi/client" async defer></script>
   ```
2. El componente [GoogleLoginButton.tsx](frontend/src/components/GoogleLoginButton.tsx) inicializa `window.google.accounts.id` con `VITE_GOOGLE_CLIENT_ID` y renderiza el botón oficial *"Continuar con Google"*.
3. Tras la selección de cuenta en el popup seguro de Google, el frontend recibe un `credential` (ID Token JWT firmado criptográficamente por Google).
4. El frontend envía este token a `POST /api/v1/auth/google`.
5. El backend en Go valida el token contra el endpoint oficial de verificación de Google:
   `https://oauth2.googleapis.com/tokeninfo?id_token={credential}`
6. Si Google confirma validez (`email_verified = "true"`), Go busca el usuario por `google_id` o `email`:
   - Si no existe: lo crea automáticamente asignándole un username limpio y su foto de perfil (`avatar_url`).
   - Si existe: actualiza sus datos si correspondiera.
7. Go firma un token JWT propio de DealHunter (validez 7 días) y responde con los datos del usuario.

---

## 7. Despliegue en Producción

### 1. Base de Datos en Neon.tech
- Crear proyecto PostgreSQL 16.
- Ejecutar en Neon SQL Editor: [01_schema.sql](database/01_schema.sql) y luego [02_seed.sql](database/02_seed.sql).
- Copiar la URL de conexión con pooler activado (`?sslmode=require`).

### 2. Backend en Render.com
- Conectar repositorio en Render como **Web Service**.
- **Root Directory:** `backend`
- **Environment:** `Go`
- **Build Command:** `go mod tidy && go build -o bin/api ./cmd/api`
- **Start Command:** `./bin/api`
- **Variables de Entorno:**
  - `PORT` = `8080`
  - `DATABASE_URL` = *(URL de Neon.tech)*
  - `JWT_SECRET` = *(Cadena secreta segura)*
  - `GOOGLE_CLIENT_ID` = *(Client ID de Google Cloud Console)*

### 3. Frontend en Netlify
- Conectar repositorio en Netlify.
- **Base directory:** `frontend`
- **Build command:** `npm run build`
- **Publish directory:** `frontend/dist`
- **Variables de Entorno:**
  - `VITE_API_BASE_URL` = `https://tu-backend-en-render.onrender.com`
  - `VITE_GOOGLE_CLIENT_ID` = *(Client ID de Google Cloud Console)*
- El archivo [netlify.toml](frontend/netlify.toml) gestiona la redirección SPA `/* -> /index.html` con status 200.

---

## 8. Comandos de Verificación de Integridad

- **Verificar Backend Go:**
  ```bash
  cd backend
  go build -v ./...
  go test -v ./...
  ```
- **Verificar Frontend React / TypeScript:**
  ```bash
  cd frontend
  npm run build
  ```
Ambos comandos deben completar con **código de salida 0** y cero advertencias o errores de tipado.
