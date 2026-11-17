# DealHunter — Plataforma de Rastreo de Precios (Clon IsThereAnyDeal)

Plataforma web de nivel producción para el monitoreo, comparación histórica y alertas de precios de videojuegos en tiendas digitales oficiales (Steam, Epic Games Store, GOG, Fanatical, Humble Store, etc.), consumiendo datos reales de la **CheapShark API**.

El proyecto está diseñado bajo una **arquitectura desacoplada en 3 capas independientes**, cada una escrita en un lenguaje de programación distinto y lista para desplegarse en su propia plataforma en la nube:

| Capa | Carpeta | Lenguaje | Plataforma de Despliegue |
| :--- | :--- | :--- | :--- |
| **Base de Datos** | `/database` | **SQL** (PostgreSQL 16+) | [Neon.tech](https://neon.tech) (Serverless PostgreSQL) |
| **Backend REST API** | `/backend` | **Go (Golang 1.22+)** | [Render.com](https://render.com) (Web Service) |
| **Frontend Web** | `/frontend` | **TypeScript** (React 18 + Vite) | [Netlify](https://netlify.com) (Static Site / SPA) |

---

## 🌟 Características Principales

1. **Catálogo con Filtros y Búsqueda en Tiempo Real:**
   - Búsqueda instantánea con *debounce*.
   - Filtros por tienda digital oficial, descuento mínimo (`>25%`, `>50%`, `>75%`), precio máximo (`<$5`, `<$10`, `<$20`) y ordenamiento por porcentaje, precio o novedad.
2. **Comparador Multi-Tienda y Mínimo Histórico:**
   - Tabla comparativa que lista los precios de todas las tiendas oficiales ordenadas de menor a mayor.
   - Enlace directo seguro a la tienda oficial (`product_url`).
   - Insignia de **Mínimo Histórico** (`historical_low_price`).
3. **Gráfica de Evolución Histórica de Precios:**
   - Gráfica interactiva desarrollada con **Recharts** que visualiza las series temporales de fluctuaciones de precios por juego.
4. **Lista de Deseos (Wishlist) y Alertas Automáticas:**
   - Permite al usuario fijar un **precio objetivo** (`target_price`).
   - Cuando el precio baja o alcanza el objetivo, se genera una alerta automática en la bandeja de notificaciones.
5. **Autenticación con Google (Obligatoria):**
   - Integración nativa de **Google Identity Services (OAuth2)** que verifica el token en el backend con los servidores de Google y genera una sesión JWT. También cuenta con registro tradicional con email y contraseña (encriptada con `bcrypt`).
6. **Sincronización Híbrida Anti-Bloqueos (CheapShark API):**
   - Centro de sincronización en vivo (`/sync`) que permite traer 60 a 120 ofertas reales con un solo clic directamente desde el navegador (evadiendo restricciones anti-bot de Cloudflare en servidores cloud).
7. **Banner de Despertar de Servidor (`ServerWakeBanner`):**
   - Notifica amigablemente al usuario cuando el servidor en Render está saliendo de su suspensión en frío (*cold start* del tier gratuito) y reintenta de forma automática.

---

## 📁 Estructura del Repositorio

```text
.
├── PROJECT_SPEC.md              # Especificación técnica maestra del proyecto
├── README.md                    # Esta guía completa de ejecución y despliegue
├── /database                    # CAPA 1: Base de Datos Relacional (SQL)
│   ├── 01_schema.sql            # DDL de 12 tablas en 3NF con índices y constraints
│   └── 02_seed.sql              # Semilla con tiendas oficiales y géneros
├── /backend                     # CAPA 2: Backend RESTful (Go / Golang)
│   ├── go.mod
│   ├── go.sum
│   ├── render.yaml              # Configuración de despliegue para Render.com
│   ├── .env.example             # Variables de entorno de ejemplo para el backend
│   ├── /cmd/api
│   │   └── main.go              # Servidor HTTP, inyección de dependencias y rutas
│   └── /internal
│       ├── /config              # Carga de variables de entorno
│       ├── /database            # Pool de conexiones a PostgreSQL
│       ├── /models              # Modelos y DTOs en Go
│       ├── /middleware          # CORS dinámico y validación de tokens JWT
│       ├── /handlers            # Controladores HTTP (Auth, Games, Stores, Wishlist, Alerts, Sync)
│       └── /services            # Lógica transaccional de precios, histórico y alertas
└── /frontend                    # CAPA 3: Interfaz Web (TypeScript / React)
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts           # Configuración de Vite y proxy local
    ├── tailwind.config.js       # Estilos con Tailwind CSS
    ├── netlify.toml             # Configuración de build y redirecciones SPA para Netlify
    ├── .env.example             # Variables de entorno de ejemplo para el frontend
    ├── index.html               # Carga de Google Identity Services SDK
    └── /src
        ├── /types               # Interfaces TypeScript alineadas 1:1 con Go
        ├── /api                 # Cliente fetch con manejo de JWT y cold starts
        ├── /context             # AuthContext y ServerStatusContext
        ├── /components          # GameCard, StoreTable, PriceHistoryChart, Navbar, etc.
        └── /pages               # HomePage, GameDetailPage, WishlistPage, SyncAdminPage, AuthPage
```

---

## 🚀 Guía de Ejecución Local (Paso a Paso)

### Prerrequisitos
- **Go 1.22+** instalado en tu computadora (`go version`).
- **Node.js 18+** y **npm** instalados (`node -v`, `npm -v`).
- Una base de datos PostgreSQL (puedes usar una gratuita en [Neon.tech](https://neon.tech) o un PostgreSQL local).

---

### Paso 1: Configurar la Base de Datos

1. Ingresa a [Neon.tech](https://neon.tech), crea una cuenta gratuita y genera un nuevo proyecto (ej. `dealhunter-db`).
2. En la consola de Neon, ve a la pestaña **SQL Editor**.
3. Copia y ejecuta todo el contenido de [`database/01_schema.sql`](database/01_schema.sql).
4. Luego, copia y ejecuta todo el contenido de [`database/02_seed.sql`](database/02_seed.sql).
5. Copia la cadena de conexión de Neon (Connection String), que se ve similar a:
   ```text
   postgres://usuario:contraseña@ep-cool-cloud-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

---

### Paso 2: Ejecutar el Backend en Go

1. Abre una terminal y navega a la carpeta `/backend`:
   ```bash
   cd backend
   ```
2. Crea tu archivo de variables locales `.env` a partir de `.env.example`:
   ```bash
   cp .env.example .env
   ```
3. Edita `.env` con tus valores:
   ```env
   PORT=8080
   DATABASE_URL=postgres://usuario:contraseña@ep-cool-cloud-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
   JWT_SECRET=tu_clave_secreta_super_segura_123456
   GOOGLE_CLIENT_ID=tu-google-client-id.apps.googleusercontent.com
   ```
4. Compila y ejecuta el servidor:
   ```bash
   go run cmd/api/main.go
   ```
   *El servidor quedará escuchando en `http://localhost:8080`.*
   Puedes verificar su funcionamiento visitando `http://localhost:8080/health`.

---

### Paso 3: Ejecutar el Frontend en React + TypeScript

1. En otra terminal, navega a la carpeta `/frontend`:
   ```bash
   cd frontend
   ```
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Crea tu archivo `.env` a partir de `.env.example`:
   ```bash
   cp .env.example .env
   ```
   *Para desarrollo local, puedes dejar `VITE_API_BASE_URL=` vacío o apuntando a `http://localhost:8080` (el proxy de Vite redirige `/api` automáticamente).*
4. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```
5. Abre en tu navegador `http://localhost:3000`.

---

### Paso 4: Poblar Ofertas Iniciales

1. Abre la aplicación en tu navegador (`http://localhost:3000`).
2. En la barra superior, haz clic en **"Sincronizador API"** (`/sync`).
3. Haz clic en el botón verde **"Sincronizar 60 Ofertas"** o **"Descargar 120 Ofertas"**.
4. ¡Listo! Vuelve a **"Explorar Ofertas"** y verás el catálogo poblado con precios reales, mínimos históricos y comparativas de tiendas.

---

## ☁️ Guía de Despliegue en la Nube (3 Partes Separadas)

### 1. Despliegue de la Base de Datos en Neon.tech
1. Inicia sesión en [Neon.tech](https://neon.tech).
2. Crea un proyecto llamado `dealhunter-prod`.
3. Ve a **SQL Editor**, pega el script `database/01_schema.sql` y ejecútalo.
4. Pega el script `database/02_seed.sql` y ejecútalo.
5. Copia la URL de conexión (marcando la opción *Pooled connection* recomendada para serverless).

---

### 2. Despliegue del Backend en Render.com
1. Sube tu código a un repositorio en **GitHub** o **GitLab**.
2. Inicia sesión en [Render.com](https://render.com).
3. Haz clic en **New +** y selecciona **Web Service**.
4. Conecta tu repositorio de GitHub.
5. Configura los siguientes campos:
   - **Name:** `dealhunter-api`
   - **Root Directory:** `backend`
   - **Environment:** `Go`
   - **Build Command:** `go mod tidy && go build -o bin/api ./cmd/api`
   - **Start Command:** `./bin/api`
   - **Plan:** `Free`
6. En la sección **Environment Variables**, añade:
   - `PORT` = `8080`
   - `DATABASE_URL` = *(Tu URL de conexión de Neon.tech obtenida en el paso 1)*
   - `JWT_SECRET` = *(Genera una cadena aleatoria y segura de al menos 32 caracteres)*
   - `GOOGLE_CLIENT_ID` = *(Tu Client ID de Google Cloud)*
7. Haz clic en **Create Web Service**.
8. Una vez desplegado, copia la URL pública de tu API (ejemplo: `https://dealhunter-api.onrender.com`).
   *Verifica en tu navegador que `https://dealhunter-api.onrender.com/health` responda `{"status":"ok","database":"connected"}`.*

---

### 3. Despliegue del Frontend en Netlify
1. Inicia sesión en [Netlify](https://netlify.com).
2. Haz clic en **Add new site** > **Import an existing project**.
3. Selecciona tu repositorio de GitHub.
4. Configura los parámetros de construcción:
   - **Base directory:** `frontend`
   - **Build command:** `npm run build`
   - **Publish directory:** `frontend/dist`
5. En la sección **Environment variables**, añade:
   - `VITE_API_BASE_URL` = `https://dealhunter-api.onrender.com` *(La URL pública de tu backend en Render)*
   - `VITE_GOOGLE_CLIENT_ID` = *(Tu Client ID de Google Cloud)*
6. Haz clic en **Deploy DealHunter**.
7. Netlify generará tu dominio público (ej. `https://dealhunter.netlify.app`). Gracias al archivo `frontend/netlify.toml`, las rutas SPA (`/game/:slug`, `/wishlist`, etc.) funcionarán sin errores 404 al recargar la página.

---

## 🔑 Configuración del Login con Google (Google Identity Services)

Para habilitar el inicio de sesión con Google:
1. Accede a [Google Cloud Console](https://console.cloud.google.com/).
2. Crea un proyecto (ej. `DealHunter App`).
3. Ve a **APIs & Services** > **OAuth consent screen**:
   - Selecciona **External** y llena el nombre de la app y correo de soporte.
4. Ve a **APIs & Services** > **Credentials**:
   - Haz clic en **Create Credentials** > **OAuth client ID**.
   - Tipo de aplicación: **Web application**.
   - **Authorized JavaScript origins:**
     - `http://localhost:3000` (para desarrollo local)
     - `https://dealhunter.netlify.app` (tu URL final de Netlify)
5. Copia el **Client ID** generado (termina en `.apps.googleusercontent.com`).
6. Coloca ese Client ID en:
   - `frontend/.env` como `VITE_GOOGLE_CLIENT_ID`
   - `backend/.env` como `GOOGLE_CLIENT_ID`

---

## 🛠️ Verificación y Pruebas de Calidad

- **Compilación Backend (Go):**
  ```bash
  cd backend
  go build -v ./...
  go test -v ./...
  ```
  *Compilación limpia con 0 errores y tests unitarios aprobados.*

- **Compilación Frontend (TypeScript + Vite):**
  ```bash
  cd frontend
  npm run build
  ```
  *Compilación estricta con TypeScript y generación de bundle de producción en `frontend/dist`.*

---

## 📄 Licencia

Este proyecto fue desarrollado con fines educativos y de demostración académica para la materia de Estructura de Datos y Sistemas Distribuidos.
