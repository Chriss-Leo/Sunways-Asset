package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"sunways-asset/backend/internal/blockchain"
	"sunways-asset/backend/internal/config"
	"sunways-asset/backend/internal/indexer"
	"sunways-asset/backend/internal/repository"

	"github.com/ethereum/go-ethereum/ethclient"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
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

	options := indexer.RunOptions{
		PollInterval:  cfg.Indexer.PollInterval,
		Confirmations: cfg.Indexer.Confirmations,
		BatchSize:     cfg.Indexer.BatchSize,
		RetryDelay:    durationEnv("INDEXER_RETRY_DELAY", 2*time.Second),
		Once:          boolEnv("INDEXER_ONCE", false),
	}
	log.Printf(
		"indexer running chain=%d poll=%s confirmations=%d batch=%d once=%v",
		chain.ChainID,
		options.PollInterval,
		options.Confirmations,
		options.BatchSize,
		options.Once,
	)
	if err := idx.Run(ctx, options); err != nil && err != context.Canceled {
		log.Fatalf("run indexer: %v", err)
	}
	log.Print("indexer stopped")
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

func boolEnv(key string, fallback bool) bool {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(value)
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
