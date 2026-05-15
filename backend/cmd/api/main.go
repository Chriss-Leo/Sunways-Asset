package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"sunways-asset/backend/internal/auth"
	"sunways-asset/backend/internal/httpapi"
	"sunways-asset/backend/internal/wallet"
)

func main() {
	// Keep local development zero-config while still allowing deployment-time overrides.
	addr := env("API_ADDR", ":8080")
	frontendOrigin := env("FRONTEND_ORIGIN", "http://localhost:3000")
	nonceTTL := durationEnv("WALLET_NONCE_TTL", 5*time.Minute)
	sessionTTL := durationEnv("AUTH_SESSION_TTL", 24*time.Hour)

	walletSvc := wallet.NewService(nonceTTL)
	authSvc := auth.NewService(sessionTTL)
	server := httpapi.NewServer(walletSvc, authSvc, frontendOrigin)

	log.Printf("api listening on %s", addr)
	if err := http.ListenAndServe(addr, server.Handler()); err != nil {
		log.Fatal(err)
	}
}

// env reads a string environment variable and falls back when it is unset.
func env(key string, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

// durationEnv reads a Go duration environment variable such as "5m" or "24h".
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
