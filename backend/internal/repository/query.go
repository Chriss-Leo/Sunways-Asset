package repository

import (
	"math/big"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Store struct {
	db *gorm.DB
}

type DashboardSummary struct {
	Stations          int64  `json:"stations"`
	TotalCapacityKW   string `json:"totalCapacityKw"`
	TotalRevenueWei   string `json:"totalRevenueWei"`
	TotalCarbonAmount string `json:"totalCarbonAmount"`
	TotalCertificates string `json:"totalCertificates"`
}

func NewStore(db *gorm.DB) *Store {
	return &Store{db: db}
}

func (s *Store) UpsertChainEvent(event ChainEvent) error {
	return s.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "tx_hash"}, {Name: "log_index"}},
		DoNothing: true,
	}).Create(&event).Error
}

func (s *Store) UpsertStation(station Station) error {
	return s.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "chain_id"}, {Name: "station_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"owner",
			"operator",
			"name",
			"region",
			"capacity_kw",
			"commissioned_at",
			"status",
			"metadata_uri",
			"tx_hash",
			"block_number",
			"updated_at",
		}),
	}).Create(&station).Error
}

func (s *Store) CreateRevenueDeposit(deposit RevenueDeposit) error {
	return s.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "tx_hash"}, {Name: "log_index"}},
		DoNothing: true,
	}).Create(&deposit).Error
}

func (s *Store) CreateCarbonCreditIssuance(issuance CarbonCreditIssuance) error {
	return s.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "tx_hash"}, {Name: "log_index"}},
		DoNothing: true,
	}).Create(&issuance).Error
}

func (s *Store) CreateGreenCertificateIssuance(issuance GreenCertificateIssuance) error {
	return s.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "tx_hash"}, {Name: "log_index"}},
		DoNothing: true,
	}).Create(&issuance).Error
}

func (s *Store) ListStations(limit int) ([]Station, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	var stations []Station
	err := s.db.Order("station_id asc").Limit(limit).Find(&stations).Error
	return stations, err
}

func (s *Store) GetStation(stationID uint64) (Station, error) {
	var station Station
	err := s.db.Where("station_id = ?", stationID).First(&station).Error
	return station, err
}

func (s *Store) DashboardSummary() (DashboardSummary, error) {
	var stationCount int64
	if err := s.db.Model(&Station{}).Count(&stationCount).Error; err != nil {
		return DashboardSummary{}, err
	}

	var stations []Station
	if err := s.db.Find(&stations).Error; err != nil {
		return DashboardSummary{}, err
	}
	var deposits []RevenueDeposit
	if err := s.db.Find(&deposits).Error; err != nil {
		return DashboardSummary{}, err
	}
	var carbon []CarbonCreditIssuance
	if err := s.db.Find(&carbon).Error; err != nil {
		return DashboardSummary{}, err
	}
	var certificates []GreenCertificateIssuance
	if err := s.db.Find(&certificates).Error; err != nil {
		return DashboardSummary{}, err
	}

	return DashboardSummary{
		Stations:          stationCount,
		TotalCapacityKW:   sumStrings(mapSlice(stations, func(v Station) string { return v.CapacityKW })),
		TotalRevenueWei:   sumStrings(mapSlice(deposits, func(v RevenueDeposit) string { return v.AmountWei })),
		TotalCarbonAmount: sumStrings(mapSlice(carbon, func(v CarbonCreditIssuance) string { return v.Amount })),
		TotalCertificates: sumStrings(mapSlice(certificates, func(v GreenCertificateIssuance) string { return v.Amount })),
	}, nil
}

func mapSlice[T any](values []T, fn func(T) string) []string {
	result := make([]string, 0, len(values))
	for _, value := range values {
		result = append(result, fn(value))
	}
	return result
}

func sumStrings(values []string) string {
	sum := new(big.Int)
	for _, value := range values {
		next, ok := new(big.Int).SetString(value, 10)
		if !ok {
			continue
		}
		sum.Add(sum, next)
	}
	return sum.String()
}
