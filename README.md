# Sunways Asset

Sunways Asset is an open-source Web3 energy asset project. It explores how power stations, revenue sharing, carbon credits, and green energy certificates can be represented with verifiable on-chain records and an application-oriented backend.

The current project is a local-first monorepo with:

- Next.js frontend console
- Go backend API
- Foundry smart contracts
- Anvil local chain workflow
- Wallet connection and wallet-signature authentication

The long-term goal is to build a practical foundation for renewable energy RWA workflows: power station NFTs, auditable operating data, revenue distribution, carbon credit issuance, green certificate issuance, and eventually marketplace-style energy asset trading.

## What This Project Is About

Sunways Asset treats each power station as a digital asset with a clear on-chain identity. Around that asset, the system can attach operational evidence, revenue events, carbon credit records, and green certificate batches.

The project is designed around a few principles:

- Energy assets should have traceable on-chain identities.
- Wallets can act as the primary user and operator identity layer.
- Smart contracts should emit stable events for backend indexing.
- Backend services should turn chain events into high-performance, queryable business data.
- Frontend users should see asset, revenue, carbon, and certificate state in one console.

This is currently an engineering prototype, not a production financial product.

## Current Features

- Wallet connection with RainbowKit, wagmi, and viem.
- Local Anvil chain support with chain ID `31337`.
- Wallet signature login through a Go backend nonce/session flow.
- Power station NFT contract using ERC-721.
- Revenue vault contract for native-token revenue deposit and claim flows.
- Carbon credit token using ERC-20.
- Green certificate contract using ERC-1155.
- Local deployment config under `config/chains.local.json`.
- Frontend ABI wiring under `src/contracts/`.
- Seed script that writes demo station, revenue, carbon credit, and certificate data to the local chain.
- Frontend dashboard that reads live local-chain data and falls back to demo data where needed.

## Roadmap

Planned development areas:

- High-performance Go blockchain client and event indexer.
- Concurrent block scanning, event decoding, and idempotent persistence.
- PostgreSQL-backed projections for stations, revenue, carbon credits, and certificates.
- Redis-backed caching, distributed locks, and background job coordination.
- Reorg-aware indexing with checkpoint recovery.
- Low-latency read APIs for dashboard and operator workflows.
- Energy asset metadata management.
- Device and oracle data ingestion.
- Revenue settlement and claim history.
- Carbon credit retirement flows.
- Green certificate lifecycle and verification views.
- Admin/operator workflows for asset issuance and review.
- Testnet deployment workflow.
- Security hardening, monitoring, and audit preparation.
- Future P2P trading or marketplace experiments for energy-related rights and certificates.

## Tech Stack

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS
- **Wallet:** RainbowKit, wagmi, viem
- **Backend:** Go HTTP API, concurrent workers, event indexing, cache-friendly read models
- **Data layer:** PostgreSQL for durable projections, Redis for cache and coordination
- **Blockchain integration:** go-ethereum, RPC clients, ABI event decoding, reorg-aware block scanning
- **Observability plan:** structured logging, metrics, tracing, health checks, and operational dashboards
- **Smart contracts:** Solidity, Foundry, OpenZeppelin Contracts
- **Local chain:** Anvil
- **Auth:** wallet nonce, personal signature verification, backend session token

## Backend Direction

The backend is planned as a performance-oriented Go service layer rather than a simple proxy to the blockchain. The goal is to index on-chain facts once, normalize them into business projections, and serve frontend queries from optimized read models.

Planned backend capabilities:

- Event indexer for station registration, revenue deposits, revenue claims, carbon credit issuance, and certificate issuance.
- Concurrent scanner pipeline with block range batching, worker pools, retry policies, and idempotent writes.
- Reorg handling through confirmation windows, checkpoint tables, and rollback-safe projections.
- PostgreSQL schema for indexed events, station state, revenue ledger, carbon credit records, certificate batches, and account summaries.
- Redis cache for hot dashboard data, nonce/session coordination, rate limiting, and background task locks.
- Clean domain modules for `nft`, `settlement`, `oracle`, `trading`, and `blockchain` infrastructure.
- Observability-first runtime with structured logs, metrics, tracing, health endpoints, and indexer lag monitoring.
- API design focused on low-latency reads for dashboards while preserving chain-derived auditability.

## Project Structure

```text
sunways-asset/
  backend/
    cmd/api/                 # Go API entrypoint
    internal/
      auth/                  # Session management
      blockchain/            # Chain config foundation
      indexer/               # Planned chain event scanner
      repository/            # Planned database access layer
      worker/                # Planned background jobs
      httpapi/               # HTTP handlers and routing
      wallet/                # Nonce and signature verification

  contracts/
    src/
      PowerStationNFT.sol    # ERC-721 power station identity
      RevenueVault.sol       # Native revenue deposit and claim flow
      CarbonCreditToken.sol  # ERC-20 carbon credits
      GreenCertificate.sol   # ERC-1155 green certificates
    script/
      DeploySunways.s.sol
      SeedLocal.s.sol
    test/
      SunwaysCore.t.sol

  src/
    components/              # Frontend UI
    contracts/               # Generated ABI files and contract config
    data/                    # Demo dashboard data
    hooks/                   # Frontend hooks
    pages/                   # Next.js Pages Router
    services/                # Frontend API clients

  config/                    # Shared local deployment config
  docs/                      # Development notes
```

## Local Development

Install frontend dependencies:

```bash
npm install
```

Run the frontend:

```bash
npm run dev
```

Run backend API:

```bash
cd backend
go run ./cmd/api
```

Run contract tests:

```bash
cd contracts
forge test -vvv
```

Start Anvil:

```bash
anvil --chain-id 31337
```

Deploy contracts:

```bash
cd contracts

forge script script/DeploySunways.s.sol:DeploySunways \
  --rpc-url http://127.0.0.1:8545 \
  --private-key <local-anvil-private-key> \
  --broadcast
```

Seed local chain demo data:

```bash
cd contracts

forge script script/SeedLocal.s.sol:SeedLocal \
  --rpc-url http://127.0.0.1:8545 \
  --private-key <local-anvil-private-key> \
  --broadcast
```

See [docs/LOCAL_SEED.md](docs/LOCAL_SEED.md) for configurable seed values.

## Contributing

This project is still early. If you are interested in Web3, renewable energy, RWA infrastructure, carbon markets, green certificates, Solidity, Go, or frontend product design, collaboration is welcome.

Possible ways to help:

- Improve smart contract design and tests.
- Build the high-performance Go event indexer.
- Design PostgreSQL projections and Redis caching strategy.
- Improve API performance, observability, and indexing reliability.
- Improve the frontend dashboard and operator workflows.
- Research carbon credit and green certificate data models.
- Help prepare testnet deployment and monitoring.
- Review security, permissions, and compliance assumptions.

If you are interested in building this together, feel free to open an issue, start a discussion, or email:

**chrisleo.yu.cn@gmail.com**

## Disclaimer

This project explores Web3 infrastructure for energy assets. Energy asset tokenization, revenue rights, carbon credits, certificates, and related trading systems may involve legal, financial, and regulatory requirements. Nothing in this repository should be treated as legal, financial, or investment advice.
