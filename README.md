# Sunways Asset

Sunways Asset is a Web3 energy asset platform for representing renewable energy infrastructure, operational data, revenue flows, and peer-to-peer energy market activity through verifiable on-chain records and an application-oriented backend.

The project combines a Next.js frontend, a Go backend, and Ethereum-compatible smart contracts developed with Foundry. It is currently focused on local development with Anvil, wallet connection, wallet-based authentication, and the foundation for energy asset registration.

## Project Overview

Sunways Asset aims to turn real or simulated energy assets into traceable digital assets. The system is designed around a few core ideas:

- Energy assets should have a clear on-chain identity.
- Wallets should be used as the primary user identity layer.
- Backend services should index blockchain events into queryable business data.
- Device and oracle data should be auditable and linked to specific assets.
- Revenue settlement and P2P trading should be built on top of verified asset, identity, and event data.

This repository is organized as a product-oriented monorepo, with the frontend and backend already present and room for Foundry contracts to be added under `contracts/`.

## Development Goals

The long-term goal is to build a full Web3 energy asset system with:

- Wallet connection and signature-based authentication.
- Energy NFT or asset registry contracts.
- Blockchain event indexing through a Go backend.
- Asset metadata, ownership, status, and operational views.
- Device data ingestion and oracle-style data anchoring.
- Revenue settlement for energy assets.
- P2P trading for energy rights, asset shares, or related certificates.
- A frontend console for users, operators, and future administrative workflows.

The current implementation includes the frontend wallet flow and a minimal Go authentication API for nonce-based wallet signature login.

## Technology Stack

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS.
- **Wallet and Web3 UI:** RainbowKit, wagmi, viem.
- **Backend:** Go HTTP API.
- **Blockchain tooling:** Foundry and Anvil.
- **Authentication model:** wallet nonce, personal signature verification, and backend session token.

## Project Structure

```text
sunways-asset/
  backend/
    cmd/
      api/                 # Go API entrypoint
    internal/
      auth/                # Session management
      httpapi/             # HTTP handlers and routing
      wallet/              # Wallet nonce and signature verification
    go.mod

  src/
    components/
      wallet/              # Wallet connection and signature login UI
    config/                # Chain and wagmi configuration
    hooks/                 # Frontend Web3 hooks
    pages/                 # Next.js Pages Router
    services/              # Frontend API clients

  config/                  # Shared project configuration
  docs/                    # Internal development documentation
  public/                  # Static assets
```

Planned contract and backend domains:

```text
contracts/                 # Foundry smart contracts

backend/internal/
  nft/                     # Energy NFT and asset registry business logic
  oracle/                  # Device data ingestion and on-chain anchoring
  settlement/              # Revenue accounting and claim workflows
  trading/                 # P2P energy asset trading
  blockchain/              # Ethereum client, ABI, contracts, tx, listeners, events
```

## Current Status

The project currently supports:

- Connecting a browser wallet through RainbowKit.
- Detecting and switching to the local Anvil chain.
- Requesting a backend nonce for a connected wallet.
- Signing the nonce message with the wallet.
- Verifying the signature in the Go backend.
- Creating a temporary backend session.

The next major area is the smart contract foundation for energy asset registration and frontend/backend integration around deployed contract addresses and ABI files.

## Disclaimer

This project explores Web3 infrastructure for energy assets. Energy asset tokenization, revenue rights, carbon credits, and related trading systems may involve legal, financial, and regulatory requirements. Nothing in this repository should be treated as legal, financial, or investment advice.
