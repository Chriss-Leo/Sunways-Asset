package admin

import (
	"context"
	"crypto/ecdsa"
	"errors"
	"math/big"
	"strings"
	"time"

	"sunways-asset/backend/internal/blockchain"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
)

var ErrDisabled = errors.New("admin transaction service is not configured")

const powerStationABI = `[
  {"type":"function","name":"registerStation","stateMutability":"nonpayable","inputs":[{"name":"owner","type":"address"},{"name":"name","type":"string"},{"name":"region","type":"string"},{"name":"capacityKw","type":"uint256"},{"name":"commissionedAt","type":"uint64"},{"name":"metadataURI","type":"string"}],"outputs":[{"name":"stationId","type":"uint256"}]}
]`

const revenueABI = `[
  {"type":"function","name":"depositNative","stateMutability":"payable","inputs":[{"name":"stationId","type":"uint256"}],"outputs":[]}
]`

const carbonABI = `[
  {"type":"function","name":"mintCarbonCredits","stateMutability":"nonpayable","inputs":[{"name":"account","type":"address"},{"name":"amount","type":"uint256"},{"name":"stationId","type":"uint256"},{"name":"evidenceURI","type":"string"}],"outputs":[]}
]`

const certificateABI = `[
  {"type":"function","name":"issueCertificate","stateMutability":"nonpayable","inputs":[{"name":"account","type":"address"},{"name":"stationId","type":"uint256"},{"name":"amount","type":"uint256"},{"name":"certificateType","type":"string"},{"name":"period","type":"string"},{"name":"evidenceURI","type":"string"}],"outputs":[{"name":"certificateId","type":"uint256"}]}
]`

type Service struct {
	chain      blockchain.Config
	client     *ethclient.Client
	privateKey *ecdsa.PrivateKey
	from       common.Address
	abis       map[string]abi.ABI
}

func New(chain blockchain.Config, client *ethclient.Client, privateKeyHex string) (*Service, error) {
	if privateKeyHex == "" {
		return &Service{}, nil
	}
	key, err := crypto.HexToECDSA(strings.TrimPrefix(privateKeyHex, "0x"))
	if err != nil {
		return nil, err
	}
	publicKey := key.Public().(*ecdsa.PublicKey)
	service := &Service{
		chain:      chain,
		client:     client,
		privateKey: key,
		from:       crypto.PubkeyToAddress(*publicKey),
		abis:       map[string]abi.ABI{},
	}
	for name, raw := range map[string]string{
		"PowerStationNFT":   powerStationABI,
		"RevenueVault":      revenueABI,
		"CarbonCreditToken": carbonABI,
		"GreenCertificate":  certificateABI,
	} {
		parsed, err := abi.JSON(strings.NewReader(raw))
		if err != nil {
			return nil, err
		}
		service.abis[name] = parsed
	}
	return service, nil
}

func (s *Service) Enabled() bool {
	return s != nil && s.privateKey != nil
}

type RegisterStationRequest struct {
	Owner          string `json:"owner"`
	Name           string `json:"name"`
	Region         string `json:"region"`
	CapacityKW     string `json:"capacityKw"`
	CommissionedAt uint64 `json:"commissionedAt"`
	MetadataURI    string `json:"metadataUri"`
}

type DepositRevenueRequest struct {
	StationID uint64 `json:"stationId"`
	AmountWei string `json:"amountWei"`
}

type MintCarbonRequest struct {
	Account     string `json:"account"`
	StationID   uint64 `json:"stationId"`
	Amount      string `json:"amount"`
	EvidenceURI string `json:"evidenceUri"`
}

type IssueCertificateRequest struct {
	Account         string `json:"account"`
	StationID       uint64 `json:"stationId"`
	Amount          string `json:"amount"`
	CertificateType string `json:"certificateType"`
	Period          string `json:"period"`
	EvidenceURI     string `json:"evidenceUri"`
}

func (s *Service) RegisterStation(ctx context.Context, req RegisterStationRequest) (common.Hash, error) {
	amount, ok := new(big.Int).SetString(req.CapacityKW, 10)
	if !ok {
		return common.Hash{}, errors.New("invalid capacity")
	}
	data, err := s.abis["PowerStationNFT"].Pack(
		"registerStation",
		common.HexToAddress(req.Owner),
		req.Name,
		req.Region,
		amount,
		req.CommissionedAt,
		req.MetadataURI,
	)
	if err != nil {
		return common.Hash{}, err
	}
	return s.send(ctx, s.chain.Contracts.PowerStationNFT, big.NewInt(0), data)
}

func (s *Service) DepositRevenue(ctx context.Context, req DepositRevenueRequest) (common.Hash, error) {
	value, ok := new(big.Int).SetString(req.AmountWei, 10)
	if !ok {
		return common.Hash{}, errors.New("invalid amount")
	}
	data, err := s.abis["RevenueVault"].Pack("depositNative", new(big.Int).SetUint64(req.StationID))
	if err != nil {
		return common.Hash{}, err
	}
	return s.send(ctx, s.chain.Contracts.RevenueVault, value, data)
}

func (s *Service) MintCarbon(ctx context.Context, req MintCarbonRequest) (common.Hash, error) {
	amount, ok := new(big.Int).SetString(req.Amount, 10)
	if !ok {
		return common.Hash{}, errors.New("invalid amount")
	}
	data, err := s.abis["CarbonCreditToken"].Pack(
		"mintCarbonCredits",
		common.HexToAddress(req.Account),
		amount,
		new(big.Int).SetUint64(req.StationID),
		req.EvidenceURI,
	)
	if err != nil {
		return common.Hash{}, err
	}
	return s.send(ctx, s.chain.Contracts.CarbonCreditToken, big.NewInt(0), data)
}

func (s *Service) IssueCertificate(ctx context.Context, req IssueCertificateRequest) (common.Hash, error) {
	amount, ok := new(big.Int).SetString(req.Amount, 10)
	if !ok {
		return common.Hash{}, errors.New("invalid amount")
	}
	data, err := s.abis["GreenCertificate"].Pack(
		"issueCertificate",
		common.HexToAddress(req.Account),
		new(big.Int).SetUint64(req.StationID),
		amount,
		req.CertificateType,
		req.Period,
		req.EvidenceURI,
	)
	if err != nil {
		return common.Hash{}, err
	}
	return s.send(ctx, s.chain.Contracts.GreenCertificate, big.NewInt(0), data)
}

func (s *Service) send(ctx context.Context, to common.Address, value *big.Int, data []byte) (common.Hash, error) {
	if !s.Enabled() {
		return common.Hash{}, ErrDisabled
	}
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	nonce, err := s.client.PendingNonceAt(ctx, s.from)
	if err != nil {
		return common.Hash{}, err
	}
	gasPrice, err := s.client.SuggestGasPrice(ctx)
	if err != nil {
		return common.Hash{}, err
	}
	gasLimit, err := s.client.EstimateGas(ctx, ethereum.CallMsg{
		From:  s.from,
		To:    &to,
		Value: value,
		Data:  data,
	})
	if err != nil {
		gasLimit = 500_000
	}
	tx := types.NewTransaction(nonce, to, value, gasLimit+50_000, gasPrice, data)
	signed, err := types.SignTx(tx, types.LatestSignerForChainID(big.NewInt(s.chain.ChainID)), s.privateKey)
	if err != nil {
		return common.Hash{}, err
	}
	if err := s.client.SendTransaction(ctx, signed); err != nil {
		return common.Hash{}, err
	}
	return signed.Hash(), nil
}
