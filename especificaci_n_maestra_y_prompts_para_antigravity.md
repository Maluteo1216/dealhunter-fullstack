# Guía de Ejecución y Especificación Técnica — Plataforma de Rastreo de Precios (Clon IsThereAnyDeal)

> **Nota de uso:** Guarda este archivo como `PROJECT_SPEC.md` en la carpeta raíz de tu proyecto en Antigravity. En la **Sección 0** tienes los mensajes exactos que debes copiar y pegar en el chat de Antigravity (modelo 3.8) para que construya todo paso a paso sin errores. A partir de la **Sección 1** comienza la especificación técnica que el agente leerá para programar.

---

## 0. Prompts Exactos para Enviar a Antigravity (Copiar y Pegar en Orden)

Para evitar que el modelo 3.8 se sature o deje archivos incompletos, envíale estos **4 mensajes uno por uno**, esperando a que termine y verifique cada fase antes de mandar el siguiente:

### Mensaje 1 — Base de Datos (SQL) y Backend (Go)
> Lee el archivo `PROJECT_SPEC.md` completo, poniendo especial atención en las secciones 1, 2, 3, 4 y 6. Ejecuta la **Fase 1** y la **Fase 2**: crea los scripts SQL en `/database` (`01_schema.sql` y `02_seed.sql`) y desarrolla todo el backend completo en Go dentro de `/backend` (sin dejar funciones vacías ni comentarios `TODO`). Al terminar, ejecuta `go mod tidy` y `go build ./...` dentro de `/backend` para confirmar que compila sin errores.

### Mensaje 2 — Frontend Completo (TypeScript + React + Tailwind)
> Ahora lee la **Sección 5** y **Sección 6** de `PROJECT_SPEC.md` y ejecuta la **Fase 3**: crea la aplicación frontend completa en TypeScript, React, Vite y Tailwind CSS dentro de `/frontend`, conectada a todos los endpoints del backend en Go. Asegúrate de implementar el banner de despertar servidor (`ServerWakeBanner`), el explorador con filtros, la ficha de detalle con tabla multi-tienda y gráfica de precios en `Recharts`, la wishlist con alertas, autenticación JWT y el centro de sincronización en vivo con CheapShark API. Al terminar, ejecuta `npm install` y `npm run build` dentro de `/frontend` para verificar que TypeScript y Vite compilan sin errores.

### Mensaje 3 — Archivos de Despliegue Independiente y Documentación
> Ejecuta la **Fase 4** de `PROJECT_SPEC.md`: verifica y crea los archivos de configuración para despliegues separados (`/backend/render.yaml`, `/frontend/netlify.toml`, los archivos `.env.example` en ambas carpetas) y genera un `README.md` completo en la raíz explicando paso a paso cómo desplegar la base de datos en Neon.tech, el backend en Render.com y el frontend en Netlify.

### Mensaje 4 — Auditoría Final de Calidad (Opcional pero recomendado)
> Realiza una revisión completa de todo el repositorio contra `PROJECT_SPEC.md`: verifica que ningún endpoint del frontend tenga rutas distintas a las del backend en Go, que los tipos JSON coincidan exactamente entre Go y TypeScript, que no existan tiendas forzadas por defecto a Steam, y vuelve a ejecutar `go build ./...` y `npm run build` para confirmar que todo el proyecto está listo para producción.

---
---

# ESPECIFICACIÓN TÉCNICA DEL PROYECTO (`PROJECT_SPEC.md`)

## 1. Visión General y Restricciones Arquitectónicas

Construir una aplicación web completa de nivel producción para el monitoreo, comparación histórica y alertas de precios de videojuegos en tiendas digitales oficiales (inspirada en *IsThereAnyDeal*), consumiendo datos reales de la **CheapShark API**.

### Reglas Obligatorias de Arquitectura (3 Capas Desacopladas)
El sistema **DEBE** estar dividido en **3 componentes independientes**, cada uno escrito en un **lenguaje de programación distinto** y preparado para **desplegarse en plataformas separadas**:

1. **Capa de Base de Datos (Lenguaje: SQL):**
   - **Motor:** PostgreSQL 16+ alojado en **Neon.tech**.
   - **Modelo:** Esquema relacional estricto en **Tercera Forma Normal (3NF)** compuesto por **12 tablas**.
   - **Carpeta:** `/database`
2. **Capa de Backend / API REST (Lenguaje: Go / Golang 1.22+):**
   - **Arquitectura:** Microservicio RESTful puro en Go (usar `net/http` estándar o `chi`, y `database/sql` con `github.com/lib/pq`).
   - **Despliegue:** **Render.com** (Web Service).
   - **Carpeta:** `/backend`
3. **Capa de Frontend / Interfaz Web (Lenguaje: TypeScript):**
   - **Stack:** React 18 + TypeScript + Vite + Tailwind CSS + Recharts (para gráficas históricas) + Lucide React (iconos).
   - **Despliegue:** **Netlify** (Static Site / SPA).
   - **Carpeta:** `/frontend`

---

## 2. Estructura Exacta del Proyecto

Crea exactamente esta estructura de carpetas para mantener cada despliegue 100% aislado:

```text
/price-tracker-platform
├── PROJECT_SPEC.md
├── README.md
├── /database
│   ├── 01_schema.sql          # DDL completo de las 12 tablas en 3NF, índices y constraints
│   └── 02_seed.sql            # Datos semilla iniciales (tiendas oficiales y géneros)
├── /backend
│   ├── go.mod
│   ├── go.sum
│   ├── render.yaml            # Configuración de despliegue para Render.com
│   ├── .env.example
│   ├── /cmd/api
│   │   └── main.go            # Punto de entrada, inyección de dependencias y servidor HTTP
│   └── /internal
│       ├── /config            # Lectura de variables de entorno (DATABASE_URL, JWT_SECRET, PORT)
│       ├── /database          # Conexión a PostgreSQL y pool de conexiones
│       ├── /models            # Structs de Go y DTOs JSON
│       ├── /middleware        # CORS dinámico, Logger y Autenticación JWT
│       ├── /handlers          # Controladores HTTP (Auth, Games, Stores, Wishlist, Alerts, Sync)
│       └── /services          # Lógica de negocio (UPSERT de precios, historial, disparo de alertas)
└── /frontend
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── netlify.toml           # Redirecciones SPA (/* -> /index.html) para Netlify
    ├── .env.example
    └── /src
        ├── /types             # Interfaces TypeScript estrictas alineadas con el Backend
        ├── /api               # Cliente HTTP (fetch wrapper con manejo de JWT y Cold Starts)
        ├── /context           # AuthContext (sesión de usuario) y ServerStatusContext
        ├── /components        # Navbar, ServerWakeBanner, GameCard, PriceHistoryChart, StoreTable
        └── /pages             # HomePage, GameDetailPage, WishlistPage, SyncAdminPage, AuthPage
```

---

## 3. Capa 1: Base de Datos (`/database`) — SQL (PostgreSQL / Neon.tech)

### Reglas de Diseño SQL
- **Precisión Financiera:** Todos los campos monetarios y porcentajes deben usar `DECIMAL(12,2)` o `DECIMAL(5,2)` (nunca `FLOAT` ni `REAL`).
- **Integridad Referencial:** Uso estricto de `FOREIGN KEY` con `ON DELETE CASCADE` donde corresponda.
- **Identificadores Únicos:** Uso de `slug` con restricción `UNIQUE` para evitar duplicación de videojuegos entre múltiples tiendas.

### Esquema Exacto de 12 Tablas (`01_schema.sql`)

```sql
-- 1. Usuarios registrados
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
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
```

### Datos Semilla (`02_seed.sql`)
Incluir `INSERT INTO stores ... ON CONFLICT DO NOTHING` con las tiendas principales de CheapShark (`external_store_id`: `'1'` Steam, `'2'` GamersGate, `'3'` GreenManGaming, `'7'` GOG, `'8'` EA App, `'11'` Humble Store, `'13'` Ubisoft Connect, `'15'` Fanatical, `'25'` Epic Games Store) y géneros base (`Action`, `RPG`, `Indie`, `Strategy`, `Adventure`, `Shooter`, `Simulation`).

---

## 4. Capa 2: Backend REST API (`/backend`) — Go (Golang)

### Variables de Entorno Requeridas
- `DATABASE_URL`: Cadena de conexión PostgreSQL de Neon.tech.
- `JWT_SECRET`: Clave secreta para firmar tokens de autenticación.
- `PORT`: Puerto HTTP (por defecto `8080`, Render inyecta el suyo automáticamente).

### Problemas Críticos Resueltos por Diseño en el Backend
1. **Evasión de Bloqueos Cloudflare en CheapShark API:**
   - Las peticiones HTTP desde servidores cloud (como Render) hacia `cheapshark.com` suelen recibir `403 Forbidden` por Cloudflare.
   - **Solución Híbrida Obligatoria:**
     - Implementar `POST /api/v1/sync/ingest`: Recibe un arreglo JSON de ofertas y tiendas enviado directamente desde el navegador del cliente (donde CheapShark permite CORS libremente), valida los datos, los normaliza y los persiste en PostgreSQL.
     - Implementar `POST /api/v1/sync/server`: Intenta sincronizar directamente desde Go usando cabeceras completas de navegador (`User-Agent`, `Accept`), registrando el resultado en `sync_logs`.
2. **Integridad de Tiendas (Prohibido forzar tiendas a Steam):**
   - Nunca asignar un `store_id` por defecto si no coincide. Buscar la tienda en `stores` usando `external_store_id = deal.StoreID`. Si la tienda no existe en `stores`, crearla dinámicamente o omitir el registro, garantizando que los precios de GOG, Epic o Fanatical jamás se etiqueten erróneamente como Steam.
3. **Motor Transaccional de Precios, Historial y Alertas (`SyncService`):**
   - Por cada oferta procesada dentro de una transacción SQL:
     1. Hacer `UPSERT` en `games` usando `slug` limpio. Si el `current_price` es menor que `games.historical_low_price` (o si es `NULL`), actualizar `historical_low_price` y `historical_low_date = NOW()`.
     2. Hacer `UPSERT` en `store_products` por `(game_id, store_id)`.
     3. Consultar el precio anterior en `current_prices`. Hacer `UPSERT` en `current_prices`.
     4. Insertar un nuevo registro en `price_history` si es la primera vez que se registra el producto o si `current_price` cambió respecto al último precio guardado.
     5. Consultar la tabla `wishlists` buscando usuarios que tengan ese `game_id` con `notify_active = TRUE` y `target_price >= current_price`. Si existe coincidencia y no hay una alerta reciente idéntica, insertar un registro en `price_alerts`.

### Endpoints Obligatorios de la API REST

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Público | Devuelve `{"status": "ok", "database": "connected"}` para despertar Render. |
| `POST` | `/api/v1/auth/register` | Público | Registro de usuario (`username`, `email`, `password` con `bcrypt`). Devuelve JWT. |
| `POST` | `/api/v1/auth/login` | Público | Inicio de sesión. Verifica hash y devuelve JWT + datos de usuario. |
| `GET` | `/api/v1/games` | Público | Lista paginada de juegos con su mejor oferta actual. Soporta query params: `?search=`, `?store=`, `?min_discount=`, `?max_price=`, `?sort=discount|price|newest`, `?page=1&limit=20`. |
| `GET` | `/api/v1/games/{slug}` | Público | Detalle completo de un juego: metadatos, `historical_low_price`, lista de precios actuales en todas las tiendas disponibles (`store_products` + `current_prices`), e historial cronológico (`price_history`) para gráficas. |
| `GET` | `/api/v1/stores` | Público | Lista todas las tiendas activas y conteo de ofertas disponibles por tienda. |
| `POST` | `/api/v1/games` | Privado (JWT) | Creación manual de un juego en el catálogo. |
| `PUT` | `/api/v1/prices/{storeProductId}` | Privado (JWT) | Actualización manual de precios, recalculando descuento, historial y alertas. |
| `DELETE` | `/api/v1/games/{id}` | Privado (JWT) | Elimina un juego (cascada en DB). |
| `GET` | `/api/v1/wishlist` | Privado (JWT) | Lista los juegos en la wishlist del usuario autenticado con su precio actual vs `target_price`. |
| `POST` | `/api/v1/wishlist` | Privado (JWT) | Agrega o actualiza un juego en la wishlist (`game_id`, `target_price`). |
| `DELETE` | `/api/v1/wishlist/{gameId}` | Privado (JWT) | Elimina un juego de la wishlist del usuario. |
| `GET` | `/api/v1/alerts` | Privado (JWT) | Obtiene las alertas de precio disparadas para el usuario autenticado. |
| `PUT` | `/api/v1/alerts/{id}/read` | Privado (JWT) | Marca una alerta como leída. |
| `POST` | `/api/v1/sync/ingest` | Público/Admin | Recibe ofertas reales de CheapShark desde el navegador y ejecuta el `SyncService`. |
| `GET` | `/api/v1/sync/logs` | Público | Devuelve las últimas 15 ejecuciones de `sync_logs`. |

---

## 5. Capa 3: Frontend Web App (`/frontend`) — TypeScript + React + Tailwind

### Experiencia de Usuario y Componentes Clave
1. **Banner de Estado del Servidor (`ServerWakeBanner.tsx`):**
   - Al montar la app, consulta `GET /health`. Si Render tarda en responder (inicio en frío del plan gratuito), muestra un indicador discreto: *"Despertando servidor backend en Render (puede tomar ~30s en el primer acceso)..."* y reintenta automáticamente hasta conectar.
2. **Explorador de Ofertas (`HomePage.tsx`):**
   - Barra de búsqueda en tiempo real (con *debounce*).
   - Filtros laterales/superiores: Tienda (Steam, GOG, Epic, Humble, Fanatical, etc.), Descuento mínimo (`>25%`, `>50%`, `>75%`), Precio máximo (`<$5`, `<$10`, `<$20`), y Ordenamiento.
   - **Tarjetas de Juego (`GameCard.tsx`):** Imagen de portada (`cover_image_url` con fallback elegante), título, insignia de la tienda con mejor precio, precio regular tachado, precio oferta destacado, porcentaje de descuento y etiqueta **"Mínimo Histórico"** si `current_price <= historical_low_price`.
3. **Ficha de Juego y Comparador Multi-Tienda (`GameDetailPage.tsx`):**
   - Muestra el juego completo y una **Tabla Comparativa de Tiendas** ordenada del precio más bajo al más alto, con botón externo `"Ir a la oferta"` hacia `product_url`.
   - **Gráfica de Evolución de Precios (`PriceHistoryChart.tsx`):** Gráfica interactiva (usando `Recharts`) que muestra el historial de precios registrados a lo largo del tiempo por tienda.
   - **Widget de Alerta de Precio:** Permite al usuario autenticado fijar su precio objetivo (ej. `$9.99`) y guardar el juego en su Wishlist.
   - **Nota Informativa de Precios Regionales:** Mostrar un aviso claro indicando que los precios están expresados en **US MSRP (Dólares Estadounidenses)** provistos por CheapShark API, por lo que al abrir la tienda oficial desde Latinoamérica pueden aplicarse ajustes automáticos de precio regional manteniendo el porcentaje de descuento.
4. **Panel de Wishlist y Alertas (`WishlistPage.tsx`):**
   - Muestra todos los juegos seguidos por el usuario, indicador visual si el precio actual ya alcanzó o bajó del `target_price`, edición rápida del precio objetivo y bandeja de notificaciones (`price_alerts`).
5. **Centro de Sincronización en Vivo (`SyncAdminPage.tsx`):**
   - Permite sincronizar ofertas reales con un clic:
     1. El navegador consulta `https://www.cheapshark.com/api/1.0/stores` y `https://www.cheapshark.com/api/1.0/deals?onSale=1&pageSize=60` (incluyendo paginación opcional de 2-3 páginas para poblar un catálogo robusto de 60 a 120 juegos reales).
     2. Envía el payload limpio a `POST /api/v1/sync/ingest` en el backend de Go.
     3. Muestra el historial de auditoría (`sync_logs`) y permite ejecutar operaciones CRUD administrativas.

---

## 6. Reglas Estrictas de Implementación para el Agente

1. **Cero Código Incompleto:** Prohibido dejar comentarios tipo `// TODO: implementar lógica aquí` o funciones vacías. Todos los archivos deben estar 100% implementados y funcionales.
2. **Verificación de Compilación Obligatoria:**
   - Tras escribir el backend, ejecutar `go mod tidy` y `go build ./...` en `/backend` para garantizar que compila sin errores ni advertencias de tipos.
   - Tras escribir el frontend, ejecutar `npm install` y `npm run build` en `/frontend` para garantizar que TypeScript (`tsc`) y Vite compilan sin ningún error de tipado.
3. **Manejo Estricto de CORS y Headers:** El middleware CORS en Go debe permitir orígenes configurables (`*` por defecto en desarrollo/demo), métodos `GET, POST, PUT, DELETE, OPTIONS` y cabeceras `Content-Type, Authorization`.
4. **Preparación para Despliegue Independiente:**
   - `/backend/render.yaml` debe definir `buildCommand: "go mod tidy && go build -o bin/api ./cmd/api"` y `startCommand: "./bin/api"`.
   - `/frontend/netlify.toml` debe definir `build: { command: "npm run build", publish: "dist" }` y la regla de redirección SPA `from = "/*" to = "/index.html" status = 200`.

---

## 7. Plan de Ejecución por Fases

Ejecuta el proyecto siguiendo estrictamente este orden secuencial, verificando cada fase antes de avanzar a la siguiente:

- **Fase 1 (Base de Datos):** Crear `/database/01_schema.sql` y `/database/02_seed.sql` con las 12 tablas en 3NF y datos semilla completos.
- **Fase 2 (Backend en Go):** Crear `/backend` completo (`go.mod`, modelos, conexión PostgreSQL, middleware CORS/JWT, servicios de sincronización/historial/alertas y todos los handlers REST). Verificar compilación con `go build ./...`.
- **Fase 3 (Frontend en TypeScript):** Crear `/frontend` completo (tipos TS, cliente API, contextos, páginas de catálogo, detalle con gráfica Recharts, wishlist/alertas, autenticación y panel de sincronización). Verificar compilación con `npm run build`.
- **Fase 4 (Configuración de Despliegue y Documentación):** Generar `render.yaml`, `netlify.toml`, archivos `.env.example` y un `README.md` detallado con instrucciones paso a paso para desplegar Neon.tech, Render.com y Netlify.