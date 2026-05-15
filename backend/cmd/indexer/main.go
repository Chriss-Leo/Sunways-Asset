package main

import (
	"context"
	"log"
	"math/big"
	"os"
	"strconv"

	"sunways-asset/backend/internal/blockchain"
	"sunways-asset/backend/internal/config"
	"sunways-asset/backend/internal/indexer"
	"sunways-asset/backend/internal/repository"

	"github.com/ethereum/go-ethereum/ethclient"
)

func main() {
	ctx := context.Background()
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

	client, err := ethclient.DialContext(ctx, chain.RPCURL)
	if err != nil {
		log.Fatalf("dial rpc: %v", err)
	}
	defer client.Close()

	idx, err := indexer.New(chain, client, repository.NewStore(db))
	if err != nil {
		log.Fatalf("create indexer: %v", err)
	}

	fromBlock := uint64Env("INDEXER_FROM_BLOCK", 0)
	latest, err := client.BlockNumber(ctx)
	if err != nil {
		log.Fatalf("get latest block: %v", err)
	}
	toBlock := new(big.Int).SetUint64(latest)

	log.Printf("indexing chain=%d from=%d to=%d", chain.ChainID, fromBlock, latest)
	if err := idx.Scan(ctx, fromBlock, toBlock); err != nil {
		log.Fatalf("scan logs: %v", err)
	}
	log.Print("indexing complete")
}

func uint64Env(key string, fallback uint64) uint64 {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseUint(value, 10, 64)
	if err != nil {
		return fallback
	}
	return parsed
}
