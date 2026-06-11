package repository

import "time"

type IndexedBlock struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	ChainID     int64     `gorm:"uniqueIndex:idx_indexed_blocks_chain_contract" json:"chainId"`
	Contract    string    `gorm:"size:64;uniqueIndex:idx_indexed_blocks_chain_contract" json:"contract"`
	BlockNumber uint64    `json:"blockNumber"`
	BlockHash   string    `gorm:"size:66" json:"blockHash"`
	IndexedAt   time.Time `json:"indexedAt"`
}

type IndexerState struct {
	ID               uint       `gorm:"primaryKey" json:"id"`
	ChainID          int64      `gorm:"uniqueIndex:idx_indexer_state_chain_name" json:"chainId"`
	Name             string     `gorm:"size:64;uniqueIndex:idx_indexer_state_chain_name" json:"name"`
	LastIndexedBlock uint64     `json:"lastIndexedBlock"`
	LastIndexedHash  string     `gorm:"size:66" json:"lastIndexedHash"`
	LatestKnownBlock uint64     `json:"latestKnownBlock"`
	Confirmations    uint64     `json:"confirmations"`
	FailureCount     uint64     `json:"failureCount"`
	LastError        string     `gorm:"size:2048" json:"lastError"`
	LastStartedAt    *time.Time `json:"lastStartedAt"`
	LastIndexedAt    *time.Time `json:"lastIndexedAt"`
	UpdatedAt        time.Time  `json:"updatedAt"`
}

type ChainEvent struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	ChainID         int64     `gorm:"index" json:"chainId"`
	ContractName    string    `gorm:"size:64;index" json:"contractName"`
	ContractAddress string    `gorm:"size:42;index" json:"contractAddress"`
	EventName       string    `gorm:"size:64;index" json:"eventName"`
	TxHash          string    `gorm:"size:66;uniqueIndex:idx_chain_event_log" json:"txHash"`
	BlockNumber     uint64    `gorm:"index" json:"blockNumber"`
	LogIndex        uint      `gorm:"uniqueIndex:idx_chain_event_log" json:"logIndex"`
	Payload         string    `gorm:"type:jsonb" json:"payload"`
	ObservedAt      time.Time `json:"observedAt"`
}

type Organization struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	Name           string    `gorm:"size:255;not null;uniqueIndex" json:"name"`
	Type           string    `gorm:"size:64;index" json:"type"`
	RegistrationNo string    `gorm:"size:128;index" json:"registrationNo"`
	ContactName    string    `gorm:"size:128" json:"contactName"`
	ContactEmail   string    `gorm:"size:255" json:"contactEmail"`
	ContactPhone   string    `gorm:"size:64" json:"contactPhone"`
	WalletAddress  string    `gorm:"size:42;index" json:"walletAddress"`
	Verification   string    `gorm:"size:32;index;default:pending" json:"verification"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

type OrganizationMember struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	OrganizationID uint      `gorm:"index;uniqueIndex:idx_org_member_wallet" json:"organizationId"`
	WalletAddress  string    `gorm:"size:42;index;uniqueIndex:idx_org_member_wallet" json:"walletAddress"`
	Role           string    `gorm:"size:64;index" json:"role"`
	Status         string    `gorm:"size:32;index;default:active" json:"status"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

type AssetDraft struct {
	ID                uint       `gorm:"primaryKey" json:"id"`
	OrganizationID    uint       `gorm:"index" json:"organizationId"`
	Name              string     `gorm:"size:255;not null;index" json:"name"`
	AssetType         string     `gorm:"size:64;index" json:"assetType"`
	Country           string     `gorm:"size:64" json:"country"`
	Region            string     `gorm:"size:255;index" json:"region"`
	Address           string     `gorm:"size:512" json:"address"`
	Latitude          string     `gorm:"size:64" json:"latitude"`
	Longitude         string     `gorm:"size:64" json:"longitude"`
	CapacityKW        string     `gorm:"size:80" json:"capacityKw"`
	ExpectedAnnualKWh string     `gorm:"size:80" json:"expectedAnnualKwh"`
	ExpectedRevenue   string     `gorm:"size:80" json:"expectedRevenue"`
	OwnerWallet       string     `gorm:"size:42;index" json:"ownerWallet"`
	Description       string     `gorm:"size:2048" json:"description"`
	Status            string     `gorm:"size:32;index;default:draft" json:"status"`
	ReviewNote        string     `gorm:"size:1024" json:"reviewNote"`
	MetadataURI       string     `gorm:"size:1024" json:"metadataUri"`
	StationID         *uint64    `gorm:"index" json:"stationId"`
	TxHash            string     `gorm:"size:66" json:"txHash"`
	SubmittedAt       *time.Time `json:"submittedAt"`
	ApprovedAt        *time.Time `json:"approvedAt"`
	CreatedAt         time.Time  `json:"createdAt"`
	UpdatedAt         time.Time  `json:"updatedAt"`
}

type AssetFile struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	AssetDraftID   uint      `gorm:"index" json:"assetDraftId"`
	OrganizationID uint      `gorm:"index" json:"organizationId"`
	Category       string    `gorm:"size:64;index" json:"category"`
	OriginalName   string    `gorm:"size:255" json:"originalName"`
	MimeType       string    `gorm:"size:128" json:"mimeType"`
	SizeBytes      int64     `json:"sizeBytes"`
	CID            string    `gorm:"size:128;index" json:"cid"`
	IPFSURI        string    `gorm:"size:1024" json:"ipfsUri"`
	GatewayURL     string    `gorm:"size:1024" json:"gatewayUrl"`
	Uploader       string    `gorm:"size:42;index" json:"uploader"`
	Purpose        string    `gorm:"size:255" json:"purpose"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

type PlatformAuditLog struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	OrganizationID uint      `gorm:"index" json:"organizationId"`
	Actor          string    `gorm:"size:42;index" json:"actor"`
	Action         string    `gorm:"size:128;index" json:"action"`
	ResourceType   string    `gorm:"size:64;index" json:"resourceType"`
	ResourceID     string    `gorm:"size:64;index" json:"resourceId"`
	Result         string    `gorm:"size:32;index" json:"result"`
	Summary        string    `gorm:"size:2048" json:"summary"`
	CreatedAt      time.Time `json:"createdAt"`
}

type Station struct {
	ID             uint       `gorm:"primaryKey" json:"id"`
	ChainID        int64      `gorm:"uniqueIndex:idx_station_chain_station" json:"chainId"`
	StationID      uint64     `gorm:"uniqueIndex:idx_station_chain_station" json:"stationId"`
	Owner          string     `gorm:"size:42;index" json:"owner"`
	Operator       string     `gorm:"size:42;index" json:"operator"`
	Name           string     `gorm:"size:255" json:"name"`
	Region         string     `gorm:"size:255" json:"region"`
	CapacityKW     string     `gorm:"size:80" json:"capacityKw"`
	CommissionedAt *time.Time `json:"commissionedAt"`
	Status         string     `gorm:"size:32;index" json:"status"`
	ReviewStatus   string     `gorm:"size:32;index;default:approved" json:"reviewStatus"`
	ReviewNote     string     `gorm:"size:1024" json:"reviewNote"`
	MetadataURI    string     `gorm:"size:1024" json:"metadataUri"`
	TxHash         string     `gorm:"size:66" json:"txHash"`
	BlockNumber    uint64     `gorm:"index" json:"blockNumber"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"updatedAt"`
}

type StationOperationStatus struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	ChainID     int64     `gorm:"uniqueIndex:idx_station_operation_chain_station" json:"chainId"`
	StationID   uint64    `gorm:"uniqueIndex:idx_station_operation_chain_station" json:"stationId"`
	Status      string    `gorm:"size:32;index" json:"status"`
	Utilization string    `gorm:"size:32" json:"utilization"`
	Note        string    `gorm:"size:1024" json:"note"`
	UpdatedBy   string    `gorm:"size:42" json:"updatedBy"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type RevenueDeposit struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	ChainID     int64     `gorm:"index" json:"chainId"`
	StationID   uint64    `gorm:"index" json:"stationId"`
	Payer       string    `gorm:"size:42;index" json:"payer"`
	Beneficiary string    `gorm:"size:42;index" json:"beneficiary"`
	AmountWei   string    `gorm:"size:80" json:"amountWei"`
	TxHash      string    `gorm:"size:66;uniqueIndex:idx_revenue_deposit_log" json:"txHash"`
	LogIndex    uint      `gorm:"uniqueIndex:idx_revenue_deposit_log" json:"logIndex"`
	BlockNumber uint64    `gorm:"index" json:"blockNumber"`
	CreatedAt   time.Time `json:"createdAt"`
}

type RevenueClaim struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	ChainID     int64     `gorm:"index" json:"chainId"`
	Account     string    `gorm:"size:42;index" json:"account"`
	AmountWei   string    `gorm:"size:80" json:"amountWei"`
	TxHash      string    `gorm:"size:66;uniqueIndex:idx_revenue_claim_log" json:"txHash"`
	LogIndex    uint      `gorm:"uniqueIndex:idx_revenue_claim_log" json:"logIndex"`
	BlockNumber uint64    `gorm:"index" json:"blockNumber"`
	CreatedAt   time.Time `json:"createdAt"`
}

type CarbonCreditIssuance struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	ChainID     int64     `gorm:"index" json:"chainId"`
	StationID   uint64    `gorm:"index" json:"stationId"`
	Account     string    `gorm:"size:42;index" json:"account"`
	Amount      string    `gorm:"size:80" json:"amount"`
	EvidenceURI string    `gorm:"size:1024" json:"evidenceUri"`
	TxHash      string    `gorm:"size:66;uniqueIndex:idx_carbon_issuance_log" json:"txHash"`
	LogIndex    uint      `gorm:"uniqueIndex:idx_carbon_issuance_log" json:"logIndex"`
	BlockNumber uint64    `gorm:"index" json:"blockNumber"`
	CreatedAt   time.Time `json:"createdAt"`
}

type CarbonCreditRetirement struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	ChainID     int64     `gorm:"index" json:"chainId"`
	Account     string    `gorm:"size:42;index" json:"account"`
	Amount      string    `gorm:"size:80" json:"amount"`
	Reason      string    `gorm:"size:512" json:"reason"`
	TxHash      string    `gorm:"size:66;uniqueIndex:idx_carbon_retirement_log" json:"txHash"`
	LogIndex    uint      `gorm:"uniqueIndex:idx_carbon_retirement_log" json:"logIndex"`
	BlockNumber uint64    `gorm:"index" json:"blockNumber"`
	CreatedAt   time.Time `json:"createdAt"`
}

type GreenCertificateIssuance struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	ChainID         int64     `gorm:"index" json:"chainId"`
	CertificateID   uint64    `gorm:"index" json:"certificateId"`
	StationID       uint64    `gorm:"index" json:"stationId"`
	Account         string    `gorm:"size:42;index" json:"account"`
	Amount          string    `gorm:"size:80" json:"amount"`
	CertificateType string    `gorm:"size:128" json:"certificateType"`
	Period          string    `gorm:"size:64;index" json:"period"`
	EvidenceURI     string    `gorm:"size:1024" json:"evidenceUri"`
	TxHash          string    `gorm:"size:66;uniqueIndex:idx_certificate_issuance_log" json:"txHash"`
	LogIndex        uint      `gorm:"uniqueIndex:idx_certificate_issuance_log" json:"logIndex"`
	BlockNumber     uint64    `gorm:"index" json:"blockNumber"`
	CreatedAt       time.Time `json:"createdAt"`
}

type GreenCertificateRetirement struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	ChainID       int64     `gorm:"index" json:"chainId"`
	CertificateID uint64    `gorm:"index" json:"certificateId"`
	Account       string    `gorm:"size:42;index" json:"account"`
	Amount        string    `gorm:"size:80" json:"amount"`
	TxHash        string    `gorm:"size:66;uniqueIndex:idx_certificate_retirement_log" json:"txHash"`
	LogIndex      uint      `gorm:"uniqueIndex:idx_certificate_retirement_log" json:"logIndex"`
	BlockNumber   uint64    `gorm:"index" json:"blockNumber"`
	CreatedAt     time.Time `json:"createdAt"`
}

type FundraisingDeposit struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	ChainID     int64     `gorm:"index" json:"chainId"`
	Account     string    `gorm:"size:42;index" json:"account"`
	AmountWei   string    `gorm:"size:80" json:"amountWei"`
	TxHash      string    `gorm:"size:66;uniqueIndex:idx_fundraising_deposit_log" json:"txHash"`
	LogIndex    uint      `gorm:"uniqueIndex:idx_fundraising_deposit_log" json:"logIndex"`
	BlockNumber uint64    `gorm:"index" json:"blockNumber"`
	CreatedAt   time.Time `json:"createdAt"`
}

type FundraisingWithdrawal struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	ChainID     int64     `gorm:"index" json:"chainId"`
	Account     string    `gorm:"size:42;index" json:"account"`
	AmountWei   string    `gorm:"size:80" json:"amountWei"`
	TxHash      string    `gorm:"size:66;uniqueIndex:idx_fundraising_withdrawal_log" json:"txHash"`
	LogIndex    uint      `gorm:"uniqueIndex:idx_fundraising_withdrawal_log" json:"logIndex"`
	BlockNumber uint64    `gorm:"index" json:"blockNumber"`
	CreatedAt   time.Time `json:"createdAt"`
}

type FundraisingDividendDistribution struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	ChainID     int64     `gorm:"index" json:"chainId"`
	Distributor string    `gorm:"size:42;index" json:"distributor"`
	AmountWei   string    `gorm:"size:80" json:"amountWei"`
	TotalSupply string    `json:"totalSupply"`
	TxHash      string    `gorm:"size:66;uniqueIndex:idx_fundraising_dividend_log" json:"txHash"`
	LogIndex    uint      `gorm:"uniqueIndex:idx_fundraising_dividend_log" json:"logIndex"`
	BlockNumber uint64    `gorm:"index" json:"blockNumber"`
	CreatedAt   time.Time `json:"createdAt"`
}

type FundraisingDividendClaim struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	ChainID     int64     `gorm:"index" json:"chainId"`
	Account     string    `gorm:"size:42;index" json:"account"`
	AmountWei   string    `gorm:"size:80" json:"amountWei"`
	TxHash      string    `gorm:"size:66;uniqueIndex:idx_fundraising_claim_log" json:"txHash"`
	LogIndex    uint      `gorm:"uniqueIndex:idx_fundraising_claim_log" json:"logIndex"`
	BlockNumber uint64    `gorm:"index" json:"blockNumber"`
	CreatedAt   time.Time `json:"createdAt"`
}

type UserAssetSummary struct {
	ID                    uint      `gorm:"primaryKey" json:"id"`
	ChainID               int64     `gorm:"uniqueIndex:idx_user_asset_chain_account" json:"chainId"`
	Account               string    `gorm:"size:42;uniqueIndex:idx_user_asset_chain_account" json:"account"`
	StationCount          int64     `json:"stationCount"`
	ClaimableRevenueWei   string    `gorm:"size:80" json:"claimableRevenueWei"`
	TotalRevenueWei       string    `gorm:"size:80" json:"totalRevenueWei"`
	CarbonCreditBalance   string    `gorm:"size:80" json:"carbonCreditBalance"`
	GreenCertificateCount string    `gorm:"size:80" json:"greenCertificateCount"`
	UpdatedAt             time.Time `json:"updatedAt"`
}
