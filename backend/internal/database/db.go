package database

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	_ "github.com/lib/pq"
)

type DB struct {
	Pool *sql.DB
}

func Connect(dbURL string) (*DB, error) {
	if dbURL == "" {
		return &DB{Pool: nil}, fmt.Errorf("DATABASE_URL no está configurada")
	}

	pool, err := sql.Open("postgres", dbURL)
	if err != nil {
		return nil, fmt.Errorf("error al abrir conexión a PostgreSQL: %w", err)
	}

	// Configuración de pool de conexiones optimizada para servicios serverless / Neon.tech
	pool.SetMaxOpenConns(20)
	pool.SetMaxIdleConns(5)
	pool.SetConnMaxLifetime(15 * time.Minute)

	// Verificar conexión con timeout
	if err := pool.Ping(); err != nil {
		log.Printf("Advertencia: No se pudo hacer Ping inmediato a la base de datos: %v", err)
		// Devolvemos el pool para reintentos posteriores o inicio en frío
		return &DB{Pool: pool}, err
	}

	// Auto-migración segura: asegurar columna is_admin en tabla users si no existe
	_, _ = pool.Exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;`)

	log.Println("Conexión exitosa a la base de datos PostgreSQL")
	return &DB{Pool: pool}, nil
}
