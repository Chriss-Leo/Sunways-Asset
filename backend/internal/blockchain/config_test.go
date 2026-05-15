package blockchain

import (
	"errors"
	"path/filepath"
	"testing"
)

func TestLoadConfig(t *testing.T) {
	config, err := LoadConfig(filepath.Join("..", "..", "..", "config", "chains.local.json"))
	if err != nil {
		t.Fatalf("LoadConfig returned error: %v", err)
	}

	if config.ChainID != 31337 {
		t.Fatalf("ChainID = %d, want 31337", config.ChainID)
	}
	if config.Contracts.PowerStationNFT.Hex() == "0x0000000000000000000000000000000000000000" {
		t.Fatal("PowerStationNFT address was not loaded")
	}
}

func TestParseAddressRequiresKnownContracts(t *testing.T) {
	_, err := parseContracts(map[string]string{})
	if !errors.Is(err, ErrMissingContractAddress) {
		t.Fatalf("parseContracts error = %v, want ErrMissingContractAddress", err)
	}
}
