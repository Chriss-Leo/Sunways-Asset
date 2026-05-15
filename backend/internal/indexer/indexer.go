package indexer

import (
	"context"
	"encoding/json"
	"fmt"
	"math/big"
	"strings"
	"time"

	"sunways-asset/backend/internal/blockchain"
	"sunways-asset/backend/internal/repository"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
)

const powerStationABI = `[
  {"type":"event","name":"StationRegistered","inputs":[
    {"name":"stationId","type":"uint256","indexed":true},
    {"name":"owner","type":"address","indexed":true},
    {"name":"operator","type":"address","indexed":true},
    {"name":"metadataURI","type":"string","indexed":false},
    {"name":"capacityKw","type":"uint256","indexed":false}
  ]},
  {"type":"function","name":"station","stateMutability":"view","inputs":[{"name":"stationId","type":"uint256"}],"outputs":[{"type":"tuple","components":[{"name":"name","type":"string"},{"name":"region","type":"string"},{"name":"capacityKw","type":"uint256"},{"name":"commissionedAt","type":"uint64"},{"name":"status","type":"uint8"}]}]}
]`

const revenueVaultABI = `[
  {"type":"event","name":"RevenueDeposited","inputs":[
    {"name":"stationId","type":"uint256","indexed":true},
    {"name":"payer","type":"address","indexed":true},
    {"name":"beneficiary","type":"address","indexed":true},
    {"name":"amount","type":"uint256","indexed":false}
  ]}
]`

const carbonCreditABI = `[
  {"type":"event","name":"CarbonCreditsMinted","inputs":[
    {"name":"account","type":"address","indexed":true},
    {"name":"amount","type":"uint256","indexed":false},
    {"name":"stationId","type":"uint256","indexed":true},
    {"name":"evidenceURI","type":"string","indexed":false}
  ]}
]`

const greenCertificateABI = `[
  {"type":"event","name":"CertificateIssued","inputs":[
    {"name":"certificateId","type":"uint256","indexed":true},
    {"name":"stationId","type":"uint256","indexed":true},
    {"name":"account","type":"address","indexed":true},
    {"name":"amount","type":"uint256","indexed":false},
    {"name":"certificateType","type":"string","indexed":false},
    {"name":"period","type":"string","indexed":false},
    {"name":"evidenceURI","type":"string","indexed":false}
  ]}
]`

type Indexer struct {
	chain   blockchain.Config
	client  *ethclient.Client
	store   *repository.Store
	abis    map[string]abi.ABI
	address map[common.Address]string
}

func New(chain blockchain.Config, client *ethclient.Client, store *repository.Store) (*Indexer, error) {
	abis := make(map[string]abi.ABI)
	for name, raw := range map[string]string{
		"PowerStationNFT":   powerStationABI,
		"RevenueVault":      revenueVaultABI,
		"CarbonCreditToken": carbonCreditABI,
		"GreenCertificate":  greenCertificateABI,
	} {
		parsed, err := abi.JSON(strings.NewReader(raw))
		if err != nil {
			return nil, err
		}
		abis[name] = parsed
	}

	return &Indexer{
		chain:  chain,
		client: client,
		store:  store,
		abis:   abis,
		address: map[common.Address]string{
			chain.Contracts.PowerStationNFT:   "PowerStationNFT",
			chain.Contracts.RevenueVault:      "RevenueVault",
			chain.Contracts.CarbonCreditToken: "CarbonCreditToken",
			chain.Contracts.GreenCertificate:  "GreenCertificate",
		},
	}, nil
}

func (i *Indexer) Scan(ctx context.Context, fromBlock uint64, toBlock *big.Int) error {
	addresses := make([]common.Address, 0, len(i.address))
	for address := range i.address {
		addresses = append(addresses, address)
	}

	logs, err := i.client.FilterLogs(ctx, ethereum.FilterQuery{
		FromBlock: new(big.Int).SetUint64(fromBlock),
		ToBlock:   toBlock,
		Addresses: addresses,
	})
	if err != nil {
		return err
	}

	for _, log := range logs {
		if err := i.handleLog(ctx, log); err != nil {
			return err
		}
	}
	return nil
}

func (i *Indexer) handleLog(ctx context.Context, log types.Log) error {
	name := i.address[log.Address]
	contractABI := i.abis[name]
	if len(log.Topics) == 0 {
		return nil
	}

	switch log.Topics[0] {
	case contractABI.Events["StationRegistered"].ID:
		return i.handleStationRegistered(ctx, contractABI, log)
	case i.abis["RevenueVault"].Events["RevenueDeposited"].ID:
		return i.handleRevenueDeposited(i.abis["RevenueVault"], log)
	case i.abis["CarbonCreditToken"].Events["CarbonCreditsMinted"].ID:
		return i.handleCarbonCreditsMinted(i.abis["CarbonCreditToken"], log)
	case i.abis["GreenCertificate"].Events["CertificateIssued"].ID:
		return i.handleCertificateIssued(i.abis["GreenCertificate"], log)
	default:
		return nil
	}
}

func (i *Indexer) handleStationRegistered(ctx context.Context, contractABI abi.ABI, log types.Log) error {
	event := contractABI.Events["StationRegistered"]
	values := map[string]any{}
	if err := contractABI.UnpackIntoMap(values, event.Name, log.Data); err != nil {
		return err
	}

	stationID := topicBig(log.Topics[1])
	owner := topicAddress(log.Topics[2])
	operator := topicAddress(log.Topics[3])
	metadataURI := values["metadataURI"].(string)
	capacityKw := values["capacityKw"].(*big.Int)

	detail, err := i.readStation(ctx, stationID)
	if err != nil {
		detail = stationDetail{CapacityKW: capacityKw, Status: 1}
	}
	commissionedAt := time.Unix(int64(detail.CommissionedAt), 0)

	payload := mustJSON(map[string]any{
		"stationId":   stationID.String(),
		"owner":       owner.Hex(),
		"operator":    operator.Hex(),
		"metadataURI": metadataURI,
		"capacityKw":  capacityKw.String(),
	})
	if err := i.store.UpsertChainEvent(i.chainEvent(log, "PowerStationNFT", "StationRegistered", payload)); err != nil {
		return err
	}
	return i.store.UpsertStation(repository.Station{
		ChainID:        i.chain.ChainID,
		StationID:      stationID.Uint64(),
		Owner:          owner.Hex(),
		Operator:       operator.Hex(),
		Name:           detail.Name,
		Region:         detail.Region,
		CapacityKW:     detail.CapacityKW.String(),
		CommissionedAt: &commissionedAt,
		Status:         statusLabel(detail.Status),
		MetadataURI:    metadataURI,
		TxHash:         log.TxHash.Hex(),
		BlockNumber:    log.BlockNumber,
	})
}

func (i *Indexer) handleRevenueDeposited(contractABI abi.ABI, log types.Log) error {
	values := map[string]any{}
	if err := contractABI.UnpackIntoMap(values, "RevenueDeposited", log.Data); err != nil {
		return err
	}
	stationID := topicBig(log.Topics[1])
	deposit := repository.RevenueDeposit{
		ChainID:     i.chain.ChainID,
		StationID:   stationID.Uint64(),
		Payer:       topicAddress(log.Topics[2]).Hex(),
		Beneficiary: topicAddress(log.Topics[3]).Hex(),
		AmountWei:   values["amount"].(*big.Int).String(),
		TxHash:      log.TxHash.Hex(),
		LogIndex:    uint(log.Index),
		BlockNumber: log.BlockNumber,
	}
	if err := i.store.UpsertChainEvent(i.chainEvent(log, "RevenueVault", "RevenueDeposited", mustJSON(deposit))); err != nil {
		return err
	}
	return i.store.CreateRevenueDeposit(deposit)
}

func (i *Indexer) handleCarbonCreditsMinted(contractABI abi.ABI, log types.Log) error {
	values := map[string]any{}
	if err := contractABI.UnpackIntoMap(values, "CarbonCreditsMinted", log.Data); err != nil {
		return err
	}
	issuance := repository.CarbonCreditIssuance{
		ChainID:     i.chain.ChainID,
		StationID:   topicBig(log.Topics[2]).Uint64(),
		Account:     topicAddress(log.Topics[1]).Hex(),
		Amount:      values["amount"].(*big.Int).String(),
		EvidenceURI: values["evidenceURI"].(string),
		TxHash:      log.TxHash.Hex(),
		LogIndex:    uint(log.Index),
		BlockNumber: log.BlockNumber,
	}
	if err := i.store.UpsertChainEvent(i.chainEvent(log, "CarbonCreditToken", "CarbonCreditsMinted", mustJSON(issuance))); err != nil {
		return err
	}
	return i.store.CreateCarbonCreditIssuance(issuance)
}

func (i *Indexer) handleCertificateIssued(contractABI abi.ABI, log types.Log) error {
	values := map[string]any{}
	if err := contractABI.UnpackIntoMap(values, "CertificateIssued", log.Data); err != nil {
		return err
	}
	issuance := repository.GreenCertificateIssuance{
		ChainID:         i.chain.ChainID,
		CertificateID:   topicBig(log.Topics[1]).Uint64(),
		StationID:       topicBig(log.Topics[2]).Uint64(),
		Account:         topicAddress(log.Topics[3]).Hex(),
		Amount:          values["amount"].(*big.Int).String(),
		CertificateType: values["certificateType"].(string),
		Period:          values["period"].(string),
		EvidenceURI:     values["evidenceURI"].(string),
		TxHash:          log.TxHash.Hex(),
		LogIndex:        uint(log.Index),
		BlockNumber:     log.BlockNumber,
	}
	if err := i.store.UpsertChainEvent(i.chainEvent(log, "GreenCertificate", "CertificateIssued", mustJSON(issuance))); err != nil {
		return err
	}
	return i.store.CreateGreenCertificateIssuance(issuance)
}

type stationDetail struct {
	Name           string
	Region         string
	CapacityKW     *big.Int
	CommissionedAt uint64
	Status         uint8
}

func (i *Indexer) readStation(ctx context.Context, stationID *big.Int) (stationDetail, error) {
	contractABI := i.abis["PowerStationNFT"]
	input, err := contractABI.Pack("station", stationID)
	if err != nil {
		return stationDetail{}, err
	}
	output, err := i.client.CallContract(ctx, ethereum.CallMsg{
		To:   &i.chain.Contracts.PowerStationNFT,
		Data: input,
	}, nil)
	if err != nil {
		return stationDetail{}, err
	}
	values, err := contractABI.Unpack("station", output)
	if err != nil {
		return stationDetail{}, err
	}
	if len(values) != 1 {
		return stationDetail{}, fmt.Errorf("unexpected station output")
	}
	raw := values[0].(struct {
		Name           string   `json:"name"`
		Region         string   `json:"region"`
		CapacityKw     *big.Int `json:"capacityKw"`
		CommissionedAt uint64   `json:"commissionedAt"`
		Status         uint8    `json:"status"`
	})
	return stationDetail{
		Name:           raw.Name,
		Region:         raw.Region,
		CapacityKW:     raw.CapacityKw,
		CommissionedAt: raw.CommissionedAt,
		Status:         raw.Status,
	}, nil
}

func (i *Indexer) chainEvent(log types.Log, contractName string, eventName string, payload string) repository.ChainEvent {
	return repository.ChainEvent{
		ChainID:         i.chain.ChainID,
		ContractName:    contractName,
		ContractAddress: log.Address.Hex(),
		EventName:       eventName,
		TxHash:          log.TxHash.Hex(),
		BlockNumber:     log.BlockNumber,
		LogIndex:        uint(log.Index),
		Payload:         payload,
		ObservedAt:      time.Now(),
	}
}

func topicBig(topic common.Hash) *big.Int {
	return new(big.Int).SetBytes(topic.Bytes())
}

func topicAddress(topic common.Hash) common.Address {
	return common.BytesToAddress(topic.Bytes()[12:])
}

func statusLabel(status uint8) string {
	switch status {
	case 0:
		return "Pending"
	case 1:
		return "Active"
	case 2:
		return "Suspended"
	case 3:
		return "Retired"
	default:
		return "Unknown"
	}
}

func mustJSON(value any) string {
	bytes, err := json.Marshal(value)
	if err != nil {
		return "{}"
	}
	return string(bytes)
}
