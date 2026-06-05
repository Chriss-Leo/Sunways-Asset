package repository

import (
	"math/big"
	"time"

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

func (s *Store) CreateOrganization(org Organization) (Organization, error) {
	if org.Verification == "" {
		org.Verification = "pending"
	}
	err := s.db.Create(&org).Error
	return org, err
}

func (s *Store) ListOrganizations(limit int) ([]Organization, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	var items []Organization
	err := s.db.Order("created_at desc").Limit(limit).Find(&items).Error
	return items, err
}

func (s *Store) CreateOrganizationMember(member OrganizationMember) (OrganizationMember, error) {
	if member.Status == "" {
		member.Status = "active"
	}
	if member.Role == "" {
		member.Role = "member"
	}
	err := s.db.Create(&member).Error
	return member, err
}

func (s *Store) ListOrganizationMembers(orgID uint, limit int) ([]OrganizationMember, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	var items []OrganizationMember
	query := s.db.Order("created_at desc").Limit(limit)
	if orgID != 0 {
		query = query.Where("organization_id = ?", orgID)
	}
	err := query.Find(&items).Error
	return items, err
}

func (s *Store) CreateAssetDraft(asset AssetDraft) (AssetDraft, error) {
	if asset.Status == "" {
		asset.Status = "draft"
	}
	err := s.db.Create(&asset).Error
	return asset, err
}

func (s *Store) ListAssetDrafts(status string, limit int) ([]AssetDraft, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	var items []AssetDraft
	query := s.db.Order("updated_at desc").Limit(limit)
	if status != "" {
		query = query.Where("status = ?", status)
	}
	err := query.Find(&items).Error
	return items, err
}

func (s *Store) GetAssetDraft(id uint) (AssetDraft, error) {
	var asset AssetDraft
	err := s.db.First(&asset, id).Error
	return asset, err
}

func (s *Store) UpdateAssetDraft(id uint, updates map[string]any) (AssetDraft, error) {
	var asset AssetDraft
	err := s.db.First(&asset, id).Error
	if err != nil {
		return asset, err
	}
	if err := s.db.Model(&asset).Updates(updates).Error; err != nil {
		return asset, err
	}
	return asset, nil
}

func (s *Store) DeleteAssetDraft(id uint) error {
	result := s.db.Where("id = ? AND status IN ?", id, []string{"draft", "rejected"}).Delete(&AssetDraft{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

var validStatusTransitions = map[string][]string{
	"draft":          {"submitted"},
	"submitted":      {"approved", "rejected", "draft"},
	"approved":       {"rejected", "metadata_ready"},
	"metadata_ready": {"rejected", "approved"},
	"rejected":       {"draft"},
}

func (s *Store) UpdateAssetDraftStatus(id uint, status string, note string) (AssetDraft, error) {
	current, err := s.GetAssetDraft(id)
	if err != nil {
		return AssetDraft{}, err
	}
	if current.Status == "onchain" {
		return AssetDraft{}, gorm.ErrInvalidData
	}
	allowed := validStatusTransitions[current.Status]
	valid := false
	for _, next := range allowed {
		if next == status {
			valid = true
			break
		}
	}
	if !valid {
		return AssetDraft{}, gorm.ErrInvalidData
	}

	now := time.Now()
	updates := map[string]any{
		"status":      status,
		"review_note": note,
	}
	switch status {
	case "submitted":
		updates["submitted_at"] = &now
	case "approved":
		updates["approved_at"] = &now
	case "draft":
		updates["submitted_at"] = nil
		updates["approved_at"] = nil
	}
	if err := s.db.Model(&AssetDraft{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return AssetDraft{}, err
	}
	return s.GetAssetDraft(id)
}

func (s *Store) UpdateAssetDraftMetadata(id uint, metadataURI string) (AssetDraft, error) {
	if err := s.db.Model(&AssetDraft{}).Where("id = ?", id).Update("metadata_uri", metadataURI).Error; err != nil {
		return AssetDraft{}, err
	}
	return s.GetAssetDraft(id)
}

func (s *Store) MarkAssetDraftIssued(id uint, stationID uint64, txHash string) (AssetDraft, error) {
	if err := s.db.Model(&AssetDraft{}).Where("id = ?", id).Updates(map[string]any{
		"status":     "onchain",
		"station_id": stationID,
		"tx_hash":    txHash,
	}).Error; err != nil {
		return AssetDraft{}, err
	}
	return s.GetAssetDraft(id)
}

func (s *Store) CreateAssetFile(file AssetFile) (AssetFile, error) {
	if file.IPFSURI == "" && file.CID != "" {
		file.IPFSURI = "ipfs://" + file.CID
	}
	err := s.db.Create(&file).Error
	return file, err
}

func (s *Store) ListAssetFiles(assetDraftID uint, limit int) ([]AssetFile, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	var items []AssetFile
	query := s.db.Order("created_at desc").Limit(limit)
	if assetDraftID != 0 {
		query = query.Where("asset_draft_id = ?", assetDraftID)
	}
	err := query.Find(&items).Error
	return items, err
}

func (s *Store) CreatePlatformAuditLog(log PlatformAuditLog) error {
	if log.Result == "" {
		log.Result = "success"
	}
	return s.db.Create(&log).Error
}

func (s *Store) ListPlatformAuditLogs(limit int) ([]PlatformAuditLog, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	var items []PlatformAuditLog
	err := s.db.Order("created_at desc").Limit(limit).Find(&items).Error
	return items, err
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

func (s *Store) UpdateStationChainStatus(chainID int64, stationID uint64, status string) error {
	return s.db.Model(&Station{}).Where("chain_id = ? AND station_id = ?", chainID, stationID).Update("status", status).Error
}

func (s *Store) CreateRevenueDeposit(deposit RevenueDeposit) error {
	return s.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "tx_hash"}, {Name: "log_index"}},
		DoNothing: true,
	}).Create(&deposit).Error
}

func (s *Store) UpsertStationOperationStatus(status StationOperationStatus) error {
	return s.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "chain_id"}, {Name: "station_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"status",
			"utilization",
			"note",
			"updated_by",
			"updated_at",
		}),
	}).Create(&status).Error
}

func (s *Store) CreateRevenueClaim(claim RevenueClaim) error {
	return s.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "tx_hash"}, {Name: "log_index"}},
		DoNothing: true,
	}).Create(&claim).Error
}

func (s *Store) CreateCarbonCreditIssuance(issuance CarbonCreditIssuance) error {
	return s.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "tx_hash"}, {Name: "log_index"}},
		DoNothing: true,
	}).Create(&issuance).Error
}

func (s *Store) CreateCarbonCreditRetirement(retirement CarbonCreditRetirement) error {
	return s.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "tx_hash"}, {Name: "log_index"}},
		DoNothing: true,
	}).Create(&retirement).Error
}

func (s *Store) CreateGreenCertificateIssuance(issuance GreenCertificateIssuance) error {
	return s.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "tx_hash"}, {Name: "log_index"}},
		DoNothing: true,
	}).Create(&issuance).Error
}

func (s *Store) CreateGreenCertificateRetirement(retirement GreenCertificateRetirement) error {
	return s.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "tx_hash"}, {Name: "log_index"}},
		DoNothing: true,
	}).Create(&retirement).Error
}

func (s *Store) CreateFundraisingDeposit(deposit FundraisingDeposit) error {
	return s.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "tx_hash"}, {Name: "log_index"}},
		DoNothing: true,
	}).Create(&deposit).Error
}

func (s *Store) CreateFundraisingWithdrawal(withdrawal FundraisingWithdrawal) error {
	return s.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "tx_hash"}, {Name: "log_index"}},
		DoNothing: true,
	}).Create(&withdrawal).Error
}

func (s *Store) CreateFundraisingDividendDistribution(distribution FundraisingDividendDistribution) error {
	return s.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "tx_hash"}, {Name: "log_index"}},
		DoNothing: true,
	}).Create(&distribution).Error
}

func (s *Store) CreateFundraisingDividendClaim(claim FundraisingDividendClaim) error {
	return s.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "tx_hash"}, {Name: "log_index"}},
		DoNothing: true,
	}).Create(&claim).Error
}

func (s *Store) UpsertIndexerState(state IndexerState) error {
	return s.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "chain_id"}, {Name: "name"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"last_indexed_block",
			"last_indexed_hash",
			"latest_known_block",
			"confirmations",
			"failure_count",
			"last_error",
			"last_started_at",
			"last_indexed_at",
			"updated_at",
		}),
	}).Create(&state).Error
}

func (s *Store) GetIndexerState(chainID int64, name string) (IndexerState, error) {
	var state IndexerState
	err := s.db.Where("chain_id = ? AND name = ?", chainID, name).First(&state).Error
	return state, err
}

func (s *Store) MarkIndexerStart(chainID int64, name string, latest uint64, confirmations uint64) error {
	now := time.Now()
	state, err := s.GetIndexerState(chainID, name)
	if err != nil && err != gorm.ErrRecordNotFound {
		return err
	}
	state.ChainID = chainID
	state.Name = name
	state.LatestKnownBlock = latest
	state.Confirmations = confirmations
	state.LastStartedAt = &now
	state.UpdatedAt = now
	return s.UpsertIndexerState(state)
}

func (s *Store) MarkIndexerSuccess(chainID int64, name string, blockNumber uint64, blockHash string, latest uint64, confirmations uint64) error {
	now := time.Now()
	state, err := s.GetIndexerState(chainID, name)
	if err != nil && err != gorm.ErrRecordNotFound {
		return err
	}
	state.ChainID = chainID
	state.Name = name
	state.LastIndexedBlock = blockNumber
	state.LastIndexedHash = blockHash
	state.LatestKnownBlock = latest
	state.Confirmations = confirmations
	state.LastError = ""
	state.LastIndexedAt = &now
	state.UpdatedAt = now
	return s.UpsertIndexerState(state)
}

func (s *Store) MarkIndexerFailure(chainID int64, name string, latest uint64, confirmations uint64, message string) error {
	now := time.Now()
	state, err := s.GetIndexerState(chainID, name)
	if err != nil && err != gorm.ErrRecordNotFound {
		return err
	}
	state.ChainID = chainID
	state.Name = name
	state.LatestKnownBlock = latest
	state.Confirmations = confirmations
	state.FailureCount++
	state.LastError = message
	state.UpdatedAt = now
	return s.UpsertIndexerState(state)
}

func (s *Store) ListStations(limit int) ([]Station, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	var stations []Station
	err := s.db.Order("station_id asc").Limit(limit).Find(&stations).Error
	return stations, err
}

func (s *Store) ListRevenueDeposits(limit int) ([]RevenueDeposit, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	var deposits []RevenueDeposit
	err := s.db.Order("block_number desc, log_index desc").Limit(limit).Find(&deposits).Error
	return deposits, err
}

func (s *Store) ListStationOperationStatuses(limit int) ([]StationOperationStatus, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	var items []StationOperationStatus
	err := s.db.Order("station_id asc").Limit(limit).Find(&items).Error
	return items, err
}

func (s *Store) ListRevenueClaims(limit int) ([]RevenueClaim, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	var claims []RevenueClaim
	err := s.db.Order("block_number desc, log_index desc").Limit(limit).Find(&claims).Error
	return claims, err
}

func (s *Store) ListCarbonCreditIssuances(limit int) ([]CarbonCreditIssuance, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	var items []CarbonCreditIssuance
	err := s.db.Order("block_number desc, log_index desc").Limit(limit).Find(&items).Error
	return items, err
}

func (s *Store) ListCarbonCreditRetirements(limit int) ([]CarbonCreditRetirement, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	var items []CarbonCreditRetirement
	err := s.db.Order("block_number desc, log_index desc").Limit(limit).Find(&items).Error
	return items, err
}

func (s *Store) ListGreenCertificateIssuances(limit int) ([]GreenCertificateIssuance, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	var items []GreenCertificateIssuance
	err := s.db.Order("block_number desc, log_index desc").Limit(limit).Find(&items).Error
	return items, err
}

func (s *Store) ListGreenCertificateRetirements(limit int) ([]GreenCertificateRetirement, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	var items []GreenCertificateRetirement
	err := s.db.Order("block_number desc, log_index desc").Limit(limit).Find(&items).Error
	return items, err
}

func (s *Store) ListFundraisingDeposits(limit int) ([]FundraisingDeposit, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	var items []FundraisingDeposit
	err := s.db.Order("block_number desc, log_index desc").Limit(limit).Find(&items).Error
	return items, err
}

func (s *Store) ListFundraisingWithdrawals(limit int) ([]FundraisingWithdrawal, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	var items []FundraisingWithdrawal
	err := s.db.Order("block_number desc, log_index desc").Limit(limit).Find(&items).Error
	return items, err
}

func (s *Store) ListFundraisingDividendDistributions(limit int) ([]FundraisingDividendDistribution, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	var items []FundraisingDividendDistribution
	err := s.db.Order("block_number desc, log_index desc").Limit(limit).Find(&items).Error
	return items, err
}

func (s *Store) ListFundraisingDividendClaims(limit int) ([]FundraisingDividendClaim, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	var items []FundraisingDividendClaim
	err := s.db.Order("block_number desc, log_index desc").Limit(limit).Find(&items).Error
	return items, err
}

func (s *Store) ListUserAssetSummaries(limit int) ([]UserAssetSummary, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	var items []UserAssetSummary
	err := s.db.Order("updated_at desc").Limit(limit).Find(&items).Error
	return items, err
}

func (s *Store) UpdateStationReview(stationID uint64, status string, note string) error {
	return s.db.Model(&Station{}).Where("station_id = ?", stationID).Updates(map[string]any{
		"review_status": status,
		"review_note":   note,
	}).Error
}

func (s *Store) GetStation(stationID uint64) (Station, error) {
	var station Station
	err := s.db.Where("station_id = ?", stationID).First(&station).Error
	return station, err
}

func (s *Store) DashboardSummaryByAccount(account string) (DashboardSummary, error) {
	var stationCount int64
	if err := s.db.Model(&Station{}).Where("owner = ?", account).Count(&stationCount).Error; err != nil {
		return DashboardSummary{}, err
	}

	var stations []Station
	if err := s.db.Where("owner = ?", account).Find(&stations).Error; err != nil {
		return DashboardSummary{}, err
	}
	var deposits []RevenueDeposit
	if err := s.db.Where("beneficiary = ?", account).Find(&deposits).Error; err != nil {
		return DashboardSummary{}, err
	}
	var carbon []CarbonCreditIssuance
	if err := s.db.Where("account = ?", account).Find(&carbon).Error; err != nil {
		return DashboardSummary{}, err
	}
	var certificates []GreenCertificateIssuance
	if err := s.db.Where("account = ?", account).Find(&certificates).Error; err != nil {
		return DashboardSummary{}, err
	}
	var certRetirements []GreenCertificateRetirement
	if err := s.db.Where("account = ?", account).Find(&certRetirements).Error; err != nil {
		return DashboardSummary{}, err
	}
	var carbonRetirements []CarbonCreditRetirement
	if err := s.db.Where("account = ?", account).Find(&carbonRetirements).Error; err != nil {
		return DashboardSummary{}, err
	}

	totalCertIssued, _ := new(big.Int).SetString(sumStrings(mapSlice(certificates, func(v GreenCertificateIssuance) string { return v.Amount })), 10)
	totalCertRetired, _ := new(big.Int).SetString(sumStrings(mapSlice(certRetirements, func(v GreenCertificateRetirement) string { return v.Amount })), 10)
	totalCerts := new(big.Int).Sub(totalCertIssued, totalCertRetired).String()

	totalCarbonIssued, _ := new(big.Int).SetString(sumStrings(mapSlice(carbon, func(v CarbonCreditIssuance) string { return v.Amount })), 10)
	totalCarbonRetired, _ := new(big.Int).SetString(sumStrings(mapSlice(carbonRetirements, func(v CarbonCreditRetirement) string { return v.Amount })), 10)
	totalCarbon := new(big.Int).Sub(totalCarbonIssued, totalCarbonRetired).String()

	return DashboardSummary{
		Stations:          stationCount,
		TotalCapacityKW:   sumStrings(mapSlice(stations, func(v Station) string { return v.CapacityKW })),
		TotalRevenueWei:   sumStrings(mapSlice(deposits, func(v RevenueDeposit) string { return v.AmountWei })),
		TotalCarbonAmount: totalCarbon,
		TotalCertificates: totalCerts,
	}, nil
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
	var certRetirements []GreenCertificateRetirement
	if err := s.db.Find(&certRetirements).Error; err != nil {
		return DashboardSummary{}, err
	}
	var carbonRetirements []CarbonCreditRetirement
	if err := s.db.Find(&carbonRetirements).Error; err != nil {
		return DashboardSummary{}, err
	}

	totalCertIssued, _ := new(big.Int).SetString(sumStrings(mapSlice(certificates, func(v GreenCertificateIssuance) string { return v.Amount })), 10)
	totalCertRetired, _ := new(big.Int).SetString(sumStrings(mapSlice(certRetirements, func(v GreenCertificateRetirement) string { return v.Amount })), 10)
	totalCerts := new(big.Int).Sub(totalCertIssued, totalCertRetired).String()

	totalCarbonIssued, _ := new(big.Int).SetString(sumStrings(mapSlice(carbon, func(v CarbonCreditIssuance) string { return v.Amount })), 10)
	totalCarbonRetired, _ := new(big.Int).SetString(sumStrings(mapSlice(carbonRetirements, func(v CarbonCreditRetirement) string { return v.Amount })), 10)
	totalCarbon := new(big.Int).Sub(totalCarbonIssued, totalCarbonRetired).String()

	return DashboardSummary{
		Stations:          stationCount,
		TotalCapacityKW:   sumStrings(mapSlice(stations, func(v Station) string { return v.CapacityKW })),
		TotalRevenueWei:   sumStrings(mapSlice(deposits, func(v RevenueDeposit) string { return v.AmountWei })),
		TotalCarbonAmount: totalCarbon,
		TotalCertificates: totalCerts,
	}, nil
}

func (s *Store) RebuildUserAssetSummary(chainID int64) error {
	var accounts []string
	for _, model := range []any{&Station{}, &RevenueDeposit{}, &CarbonCreditIssuance{}, &CarbonCreditRetirement{}, &GreenCertificateIssuance{}, &GreenCertificateRetirement{}, &FundraisingDeposit{}, &FundraisingWithdrawal{}, &FundraisingDividendDistribution{}, &FundraisingDividendClaim{}} {
		switch model.(type) {
		case *Station:
			var rows []Station
			if err := s.db.Find(&rows).Error; err != nil {
				return err
			}
			for _, row := range rows {
				accounts = append(accounts, row.Owner)
			}
		case *RevenueDeposit:
			var rows []RevenueDeposit
			if err := s.db.Find(&rows).Error; err != nil {
				return err
			}
			for _, row := range rows {
				accounts = append(accounts, row.Beneficiary)
			}
		case *CarbonCreditIssuance:
			var rows []CarbonCreditIssuance
			if err := s.db.Find(&rows).Error; err != nil {
				return err
			}
			for _, row := range rows {
				accounts = append(accounts, row.Account)
			}
		case *CarbonCreditRetirement:
			var rows []CarbonCreditRetirement
			if err := s.db.Find(&rows).Error; err != nil {
				return err
			}
			for _, row := range rows {
				accounts = append(accounts, row.Account)
			}
		case *GreenCertificateIssuance:
			var rows []GreenCertificateIssuance
			if err := s.db.Find(&rows).Error; err != nil {
				return err
			}
			for _, row := range rows {
				accounts = append(accounts, row.Account)
			}
		case *GreenCertificateRetirement:
			var rows []GreenCertificateRetirement
			if err := s.db.Find(&rows).Error; err != nil {
				return err
			}
			for _, row := range rows {
				accounts = append(accounts, row.Account)
			}
		case *FundraisingDeposit:
			var rows []FundraisingDeposit
			if err := s.db.Find(&rows).Error; err != nil {
				return err
			}
			for _, row := range rows {
				accounts = append(accounts, row.Account)
			}
		case *FundraisingWithdrawal:
			var rows []FundraisingWithdrawal
			if err := s.db.Find(&rows).Error; err != nil {
				return err
			}
			for _, row := range rows {
				accounts = append(accounts, row.Account)
			}
		case *FundraisingDividendDistribution:
			continue
		case *FundraisingDividendClaim:
			var rows []FundraisingDividendClaim
			if err := s.db.Find(&rows).Error; err != nil {
				return err
			}
			for _, row := range rows {
				accounts = append(accounts, row.Account)
			}
		}
	}

	seen := map[string]bool{}
	for _, account := range accounts {
		if account == "" || seen[account] {
			continue
		}
		seen[account] = true
		if err := s.rebuildAccountSummary(chainID, account); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) rebuildAccountSummary(chainID int64, account string) error {
	var stationCount int64
	if err := s.db.Model(&Station{}).Where("owner = ?", account).Count(&stationCount).Error; err != nil {
		return err
	}
	var deposits []RevenueDeposit
	if err := s.db.Where("beneficiary = ?", account).Find(&deposits).Error; err != nil {
		return err
	}
	var carbon []CarbonCreditIssuance
	if err := s.db.Where("account = ?", account).Find(&carbon).Error; err != nil {
		return err
	}
	var certificates []GreenCertificateIssuance
	if err := s.db.Where("account = ?", account).Find(&certificates).Error; err != nil {
		return err
	}
	var certRetirements []GreenCertificateRetirement
	if err := s.db.Where("account = ?", account).Find(&certRetirements).Error; err != nil {
		return err
	}
	var carbonRetirements []CarbonCreditRetirement
	if err := s.db.Where("account = ?", account).Find(&carbonRetirements).Error; err != nil {
		return err
	}

	certIssued, _ := new(big.Int).SetString(sumStrings(mapSlice(certificates, func(v GreenCertificateIssuance) string { return v.Amount })), 10)
	certRetired, _ := new(big.Int).SetString(sumStrings(mapSlice(certRetirements, func(v GreenCertificateRetirement) string { return v.Amount })), 10)
	certBalance := new(big.Int).Sub(certIssued, certRetired).String()

	carbonIssued, _ := new(big.Int).SetString(sumStrings(mapSlice(carbon, func(v CarbonCreditIssuance) string { return v.Amount })), 10)
	carbonRetired, _ := new(big.Int).SetString(sumStrings(mapSlice(carbonRetirements, func(v CarbonCreditRetirement) string { return v.Amount })), 10)
	carbonBalance := new(big.Int).Sub(carbonIssued, carbonRetired).String()

	summary := UserAssetSummary{
		ChainID:               chainID,
		Account:               account,
		StationCount:          stationCount,
		ClaimableRevenueWei:   sumStrings(mapSlice(deposits, func(v RevenueDeposit) string { return v.AmountWei })),
		TotalRevenueWei:       sumStrings(mapSlice(deposits, func(v RevenueDeposit) string { return v.AmountWei })),
		CarbonCreditBalance:   carbonBalance,
		GreenCertificateCount: certBalance,
	}
	return s.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "chain_id"}, {Name: "account"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"station_count",
			"claimable_revenue_wei",
			"total_revenue_wei",
			"carbon_credit_balance",
			"green_certificate_count",
			"updated_at",
		}),
	}).Create(&summary).Error
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
