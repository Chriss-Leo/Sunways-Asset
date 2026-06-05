package blockchain

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"

	"github.com/ethereum/go-ethereum/common"
)

var (
	ErrMissingContractAddress = errors.New("missing contract address")
	ErrInvalidContractAddress = errors.New("invalid contract address")
)

type ContractAddresses struct {
	PowerStationNFT   common.Address
	RevenueVault      common.Address
	CarbonCreditToken common.Address
	GreenCertificate  common.Address
	FundraisingPool   common.Address
}

type Config struct {
	ChainID   int64
	Name      string
	RPCURL    string
	Deployer  common.Address
	Contracts ContractAddresses
}

type rawConfig struct {
	ChainID   int64             `json:"chainId"`
	Name      string            `json:"name"`
	RPCURL    string            `json:"rpcUrl"`
	Deployer  string            `json:"deployer"`
	Contracts map[string]string `json:"contracts"`
}

func LoadConfig(path string) (Config, error) {
	bytes, err := os.ReadFile(path)
	if err != nil {
		return Config{}, err
	}

	var raw rawConfig
	if err := json.Unmarshal(bytes, &raw); err != nil {
		return Config{}, err
	}

	contracts, err := parseContracts(raw.Contracts)
	if err != nil {
		return Config{}, err
	}
	if !common.IsHexAddress(raw.Deployer) {
		return Config{}, fmt.Errorf("%w: deployer", ErrInvalidContractAddress)
	}

	return Config{
		ChainID:   raw.ChainID,
		Name:      raw.Name,
		RPCURL:    raw.RPCURL,
		Deployer:  common.HexToAddress(raw.Deployer),
		Contracts: contracts,
	}, nil
}

func parseContracts(values map[string]string) (ContractAddresses, error) {
	powerStationNFT, err := parseAddress(values, "PowerStationNFT")
	if err != nil {
		return ContractAddresses{}, err
	}
	revenueVault, err := parseAddress(values, "RevenueVault")
	if err != nil {
		return ContractAddresses{}, err
	}
	carbonCreditToken, err := parseAddress(values, "CarbonCreditToken")
	if err != nil {
		return ContractAddresses{}, err
	}
	greenCertificate, err := parseAddress(values, "GreenCertificate")
	if err != nil {
		return ContractAddresses{}, err
	}
	fundraisingPool, err := parseAddress(values, "FundraisingPool")
	if err != nil {
		return ContractAddresses{}, err
	}

	return ContractAddresses{
		PowerStationNFT:   powerStationNFT,
		RevenueVault:      revenueVault,
		CarbonCreditToken: carbonCreditToken,
		GreenCertificate:  greenCertificate,
		FundraisingPool:   fundraisingPool,
	}, nil
}

func parseAddress(values map[string]string, name string) (common.Address, error) {
	value := values[name]
	if value == "" {
		return common.Address{}, fmt.Errorf("%w: %s", ErrMissingContractAddress, name)
	}
	if !common.IsHexAddress(value) {
		return common.Address{}, fmt.Errorf("%w: %s", ErrInvalidContractAddress, name)
	}
	return common.HexToAddress(value), nil
}
