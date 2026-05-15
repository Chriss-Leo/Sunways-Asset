package main

import (
	"context"
	"log"

	"sunways-asset/backend/internal/admin"
	"sunways-asset/backend/internal/auth"
	"sunways-asset/backend/internal/blockchain"
	"sunways-asset/backend/internal/config"
	"sunways-asset/backend/internal/httpapi"
	"sunways-asset/backend/internal/repository"
	"sunways-asset/backend/internal/wallet"

	"github.com/ethereum/go-ethereum/ethclient"
)

func main() {
	cfg := config.Load()

	chain, err := blockchain.LoadConfig(cfg.ChainConfig)
	if err != nil {
		log.Fatalf("load chain config: %v", err)
	}

	db, err := repository.Open(cfg.Postgres)
	if err != nil {
		log.Fatalf("open database: %v", err)
	}
	if err := repository.AutoMigrate(db); err != nil {
		log.Fatalf("migrate database: %v", err)
	}

	store := repository.NewStore(db)
	client, err := ethclient.DialContext(context.Background(), chain.RPCURL)
	if err != nil {
		log.Fatalf("dial rpc: %v", err)
	}
	defer client.Close()

	adminSvc, err := admin.New(chain, client, cfg.Admin.PrivateKey)
	if err != nil {
		log.Fatalf("create admin service: %v", err)
	}
	walletSvc := wallet.NewService(cfg.NonceTTL)
	authSvc := auth.NewService(cfg.SessionTTL)
	server := httpapi.NewServer(walletSvc, authSvc, store, adminSvc, chain.ChainID, cfg.FrontendOrigin)

	log.Printf("api listening on %s", cfg.APIAddr)
	if err := server.Router().Run(cfg.APIAddr); err != nil {
		log.Fatal(err)
	}
}
