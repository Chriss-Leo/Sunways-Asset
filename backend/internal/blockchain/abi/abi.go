package abi

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	gethabi "github.com/ethereum/go-ethereum/accounts/abi"
)

// Load reads the extracted ABI for contractName from contractsAbisDir and
// returns a parsed ABI. contractsAbisDir is typically "../contracts/abis" from
// the backend working directory.
func Load(contractsAbisDir, contractName string) (gethabi.ABI, error) {
	path := filepath.Join(contractsAbisDir, contractName+".json")
	data, err := os.ReadFile(path)
	if err != nil {
		return gethabi.ABI{}, fmt.Errorf("read ABI %s: %w", path, err)
	}
	parsed, err := gethabi.JSON(strings.NewReader(string(data)))
	if err != nil {
		return gethabi.ABI{}, fmt.Errorf("parse ABI from %s: %w", path, err)
	}
	return parsed, nil
}
