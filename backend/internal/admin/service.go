package admin

import (
	"context"
	"crypto/ecdsa"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"sunways-asset/backend/internal/blockchain"
	contractabi "sunways-asset/backend/internal/blockchain/abi"

	"github.com/ethereum/go-ethereum"
	gethabi "github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
)

var ErrDisabled = errors.New("admin transaction service is not configured")

// contractsAbisDir is the path to extracted ABIs relative to the backend
// working directory (backend/).
const contractsAbisDir = "../contracts/abis"

// contractNames lists the contracts whose ABIs are loaded for admin transactions.
var contractNames = []string{
	"PowerStationNFT",
	"RevenueVault",
	"CarbonCreditToken",
	"GreenCertificate",
}

type Service struct {
	chain      blockchain.Config
	client     *ethclient.Client
	privateKey *ecdsa.PrivateKey
	from       common.Address
	abis       map[string]gethabi.ABI
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
		abis:       map[string]gethabi.ABI{},
	}
	for _, name := range contractNames {
		parsed, err := contractabi.Load(contractsAbisDir, name)
		if err != nil {
			return nil, fmt.Errorf("load %s ABI: %w", name, err)
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

type RegisterStationResult struct {
	TxHash    common.Hash `json:"txHash"`
	StationID uint64      `json:"stationId"`
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

type BurnCarbonRequest struct {
	Amount string `json:"amount"`
}

type BurnCertificateRequest struct {
	CertificateID uint64 `json:"certificateId"`
	Amount        string `json:"amount"`
}

type UpdateStationChainStatusRequest struct {
	StationID uint64 `json:"stationId"`
	Status    uint8  `json:"status"`
}

func (s *Service) RegisterStation(ctx context.Context, req RegisterStationRequest) (common.Hash, error) {
	data, err := s.packRegisterStation(req)
	if err != nil {
		return common.Hash{}, err
	}
	return s.send(ctx, s.chain.Contracts.PowerStationNFT, big.NewInt(0), data)
}

func (s *Service) RegisterStationAndWait(ctx context.Context, req RegisterStationRequest) (RegisterStationResult, error) {
	data, err := s.packRegisterStation(req)
	if err != nil {
		return RegisterStationResult{}, err
	}
	receipt, err := s.sendAndWait(ctx, s.chain.Contracts.PowerStationNFT, big.NewInt(0), data)
	if err != nil {
		return RegisterStationResult{}, err
	}
	stationID, err := s.stationIDFromReceipt(receipt)
	if err != nil {
		return RegisterStationResult{}, err
	}
	return RegisterStationResult{TxHash: receipt.TxHash, StationID: stationID}, nil
}

func (s *Service) packRegisterStation(req RegisterStationRequest) ([]byte, error) {
	amount, ok := new(big.Int).SetString(req.CapacityKW, 10)
	if !ok {
		return nil, errors.New("invalid capacity")
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
		return nil, err
	}
	return data, nil
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

func (s *Service) BurnCarbon(ctx context.Context, req BurnCarbonRequest) (common.Hash, error) {
	amount, ok := new(big.Int).SetString(req.Amount, 10)
	if !ok {
		return common.Hash{}, errors.New("invalid amount")
	}
	data, err := s.abis["CarbonCreditToken"].Pack("burn", amount)
	if err != nil {
		return common.Hash{}, err
	}
	return s.send(ctx, s.chain.Contracts.CarbonCreditToken, big.NewInt(0), data)
}

func (s *Service) BurnCertificate(ctx context.Context, req BurnCertificateRequest) (common.Hash, error) {
	amount, ok := new(big.Int).SetString(req.Amount, 10)
	if !ok {
		return common.Hash{}, errors.New("invalid amount")
	}
	data, err := s.abis["GreenCertificate"].Pack(
		"burn",
		s.from,
		new(big.Int).SetUint64(req.CertificateID),
		amount,
	)
	if err != nil {
		return common.Hash{}, err
	}
	return s.send(ctx, s.chain.Contracts.GreenCertificate, big.NewInt(0), data)
}

func (s *Service) UpdateStationChainStatus(ctx context.Context, req UpdateStationChainStatusRequest) (common.Hash, error) {
	data, err := s.abis["PowerStationNFT"].Pack(
		"updateStationStatus",
		new(big.Int).SetUint64(req.StationID),
		req.Status,
	)
	if err != nil {
		return common.Hash{}, err
	}
	return s.send(ctx, s.chain.Contracts.PowerStationNFT, big.NewInt(0), data)
}

func (s *Service) send(ctx context.Context, to common.Address, value *big.Int, data []byte) (common.Hash, error) {
	tx, err := s.submit(ctx, to, value, data, 15*time.Second)
	if err != nil {
		return common.Hash{}, err
	}
	return tx.Hash(), nil
}

func (s *Service) sendAndWait(ctx context.Context, to common.Address, value *big.Int, data []byte) (*types.Receipt, error) {
	tx, err := s.submit(ctx, to, value, data, 45*time.Second)
	if err != nil {
		return nil, err
	}
	receipt, err := s.waitReceipt(ctx, tx.Hash())
	if err != nil {
		return nil, err
	}
	if receipt.Status != types.ReceiptStatusSuccessful {
		return nil, errors.New("transaction reverted")
	}
	return receipt, nil
}

func (s *Service) waitReceipt(ctx context.Context, hash common.Hash) (*types.Receipt, error) {
	ctx, cancel := context.WithTimeout(ctx, 45*time.Second)
	defer cancel()
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for {
		receipt, err := s.client.TransactionReceipt(ctx, hash)
		if err == nil {
			return receipt, nil
		}
		if !errors.Is(err, ethereum.NotFound) {
			return nil, err
		}
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-ticker.C:
		}
	}
}

func (s *Service) submit(ctx context.Context, to common.Address, value *big.Int, data []byte, timeout time.Duration) (*types.Transaction, error) {
	if !s.Enabled() {
		return nil, ErrDisabled
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	nonce, err := s.client.PendingNonceAt(ctx, s.from)
	if err != nil {
		return nil, err
	}
	gasPrice, err := s.client.SuggestGasPrice(ctx)
	if err != nil {
		return nil, err
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
		return nil, err
	}
	if err := s.client.SendTransaction(ctx, signed); err != nil {
		return nil, err
	}
	return signed, nil
}

func (s *Service) stationIDFromReceipt(receipt *types.Receipt) (uint64, error) {
	event := s.abis["PowerStationNFT"].Events["StationRegistered"]
	for _, log := range receipt.Logs {
		if log.Address != s.chain.Contracts.PowerStationNFT || len(log.Topics) < 2 {
			continue
		}
		if log.Topics[0] == event.ID {
			return new(big.Int).SetBytes(log.Topics[1].Bytes()).Uint64(), nil
		}
	}
	return 0, errors.New("StationRegistered event not found in receipt")
}
