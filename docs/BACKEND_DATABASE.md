# Backend Database and Indexer

The backend uses PostgreSQL with GORM. Local configuration is loaded from
`backend/.env`, which is intentionally ignored by Git.

## Tables

GORM creates these tables under the configured PostgreSQL schema (default
`asset`):

| Table | Purpose |
|---|---|
| `indexed_blocks` | Deprecated — kept for backward compatibility |
| `indexer_states` | Indexer progress: last indexed block, hash, lag, failure count |
| `chain_events` | Raw chain event log: tx hash, log index, event name, JSON payload |
| `organizations` | Platform organizations: name, type, registration, contact, wallet |
| `organization_members` | Org membership: wallet address, role (admin/member), status |
| `asset_drafts` | Pre-mint asset drafts: name, type, region, capacity, status, metadata URI |
| `asset_files` | Files attached to asset drafts: CID, IPFS URI, gateway URL, category |
| `platform_audit_logs` | Immutable audit trail for all platform operations |
| `stations` | Indexed PowerStationNFT ERC-721 tokens: owner, operator, name, region, capacity |
| `station_operation_statuses` | Runtime operation state: status, utilization %, operator note |
| `revenue_deposits` | RevenueVault deposit events: station ID, payer, beneficiary, amount |
| `revenue_claims` | RevenueVault claim events: account, amount |
| `carbon_credit_issuances` | CarbonCreditToken mint events: station ID, account, amount, evidence URI |
| `carbon_credit_retirements` | Carbon credit burns (Transfer to zero address): account, amount, reason |
| `green_certificate_issuances` | GreenCertificate issue events: certificate ID, station ID, type, period, amount |
| `user_asset_summaries` | Per-account aggregated view: station count, revenue, carbon balance, certificate count |

Event deduplication uses `(tx_hash, log_index)` as a unique key across all
event tables and `chain_events`.

## Run API

```bash
cd backend
go run ./cmd/api
```

The API auto-creates the schema and tables on startup via GORM AutoMigrate.

## Run Indexer

```bash
cd backend
go run ./cmd/indexer
```

The indexer reads contract addresses from `config/chains.local.json`, scans the
local Anvil chain, decodes contract events, and writes business projections into
PostgreSQL.

Currently indexed events:

- `PowerStationNFT.StationRegistered` → `stations` + `chain_events`
- `RevenueVault.RevenueDeposited` → `revenue_deposits` + `chain_events`
- `RevenueVault.RevenueClaimed` → `revenue_claims` + `chain_events`
- `CarbonCreditToken.CarbonCreditsMinted` → `carbon_credit_issuances` + `chain_events`
- `CarbonCreditToken.Transfer` (burn to zero address) → `carbon_credit_retirements` + `chain_events`
- `GreenCertificate.CertificateIssued` → `green_certificate_issuances` + `chain_events`

The indexer also re-reads on-chain station details via `PowerStationNFT.station()`
for name/region/status enrichment, and rebuilds `user_asset_summaries` after each
scan batch.

## API Endpoints

```text
GET  /health
POST /auth/nonce
POST /auth/verify
GET  /auth/me
POST /auth/logout
GET  /stations
GET  /stations/:id
GET  /stations/operation-statuses
GET  /dashboard/summary
GET  /revenue/deposits
GET  /revenue/claims
GET  /carbon/issuances
GET  /carbon/retirements
GET  /certificates/issuances
GET  /accounts/summaries
GET  /indexer/status
GET  /platform/organizations
POST /platform/organizations
GET  /platform/organization-members
POST /platform/organization-members
GET  /platform/assets
POST /platform/assets
GET  /platform/assets/:id
PATCH /platform/assets/:id/status
GET  /platform/files
POST /platform/files
POST /platform/files/upload
POST /platform/assets/:id/metadata
GET  /platform/assets/:id/issuance-check
GET  /platform/audit-logs
POST /admin/stations
POST /admin/revenue-deposits
POST /admin/carbon-credits
POST /admin/green-certificates
PATCH /admin/stations/:id/review
PATCH /admin/stations/:id/operation-status
```

The frontend queries backend endpoints first and falls back to direct chain reads
or demo values if the backend is not available (three-tier data strategy).
