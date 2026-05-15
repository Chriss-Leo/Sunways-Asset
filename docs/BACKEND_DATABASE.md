# Backend Database and Indexer

The backend uses PostgreSQL with GORM. Local configuration is loaded from
`backend/.env`, which is intentionally ignored by Git.

## Tables

GORM creates these tables under the configured PostgreSQL schema, currently
`asset`:

- `indexed_blocks`
- `chain_events`
- `stations`
- `revenue_deposits`
- `carbon_credit_issuances`
- `green_certificate_issuances`

## Run API

```bash
cd backend
go run ./cmd/api
```

The API auto-creates the schema and tables on startup.

## Run Indexer

```bash
cd backend
go run ./cmd/indexer
```

The indexer reads contract addresses from `config/chains.local.json`, scans the
local Anvil chain, decodes contract events, and writes business projections into
PostgreSQL.

Currently indexed events:

- `PowerStationNFT.StationRegistered`
- `RevenueVault.RevenueDeposited`
- `CarbonCreditToken.CarbonCreditsMinted`
- `GreenCertificate.CertificateIssued`

## API Endpoints

```text
GET /dashboard/summary
GET /stations
GET /stations/{id}
```

The frontend queries these endpoints first and falls back to direct chain reads
or demo values if the backend is not available.
