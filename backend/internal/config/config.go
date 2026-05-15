package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

type Postgres struct {
	Host         string
	Port         int
	User         string
	Password     string
	DBName       string
	Schema       string
	SSLMode      string
	TimeZone     string
	MaxIdleConns int
	MaxOpenConns int
}

type App struct {
	APIAddr        string
	FrontendOrigin string
	NonceTTL       time.Duration
	SessionTTL     time.Duration
	ChainConfig    string
	Postgres       Postgres
}

func Load() App {
	_ = godotenv.Load(".env")
	_ = godotenv.Load("../.env")

	return App{
		APIAddr:        env("API_ADDR", ":8080"),
		FrontendOrigin: env("FRONTEND_ORIGIN", "http://localhost:3000"),
		NonceTTL:       durationEnv("WALLET_NONCE_TTL", 5*time.Minute),
		SessionTTL:     durationEnv("AUTH_SESSION_TTL", 24*time.Hour),
		ChainConfig:    env("CHAIN_CONFIG_PATH", "../config/chains.local.json"),
		Postgres: Postgres{
			Host:         env("POSTGRES_HOST", "127.0.0.1"),
			Port:         intEnv("POSTGRES_PORT", 5432),
			User:         env("POSTGRES_USER", "postgres"),
			Password:     env("POSTGRES_PASSWORD", ""),
			DBName:       env("POSTGRES_DB_NAME", "sunways"),
			Schema:       env("POSTGRES_SCHEMA", "asset"),
			SSLMode:      env("POSTGRES_SSL_MODE", "disable"),
			TimeZone:     env("POSTGRES_TIME_ZONE", "Asia/Shanghai"),
			MaxIdleConns: intEnv("POSTGRES_MAX_IDLE_CONNS", 10),
			MaxOpenConns: intEnv("POSTGRES_MAX_OPEN_CONNS", 100),
		},
	}
}

func (p Postgres) DSN() string {
	return fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s TimeZone=%s search_path=%s",
		p.Host,
		p.Port,
		p.User,
		p.Password,
		p.DBName,
		p.SSLMode,
		p.TimeZone,
		p.Schema,
	)
}

func env(key string, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func intEnv(key string, fallback int) int {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func durationEnv(key string, fallback time.Duration) time.Duration {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := time.ParseDuration(value)
	if err != nil {
		return fallback
	}
	return parsed
}
