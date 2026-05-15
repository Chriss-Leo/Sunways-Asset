package main

import (
	"log"
	"net/http"

	"sunways-asset/backend/internal/auth"
	"sunways-asset/backend/internal/config"
	"sunways-asset/backend/internal/httpapi"
	"sunways-asset/backend/internal/repository"
	"sunways-asset/backend/internal/wallet"
)

func main() {
	cfg := config.Load()

	db, err := repository.Open(cfg.Postgres)
	if err != nil {
		log.Fatalf("open database: %v", err)
	}
	if err := repository.AutoMigrate(db); err != nil {
		log.Fatalf("migrate database: %v", err)
	}

	store := repository.NewStore(db)
	walletSvc := wallet.NewService(cfg.NonceTTL)
	authSvc := auth.NewService(cfg.SessionTTL)
	server := httpapi.NewServer(walletSvc, authSvc, store, cfg.FrontendOrigin)

	log.Printf("api listening on %s", cfg.APIAddr)
	if err := http.ListenAndServe(cfg.APIAddr, server.Handler()); err != nil {
		log.Fatal(err)
	}
}
