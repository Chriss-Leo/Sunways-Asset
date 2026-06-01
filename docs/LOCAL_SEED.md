# Local Chain Seed Data

`contracts/script/SeedLocal.s.sol` writes demo business data to the local Anvil chain.

It seeds:

- Power station NFT: `Sunways Jiangsu Solar Station 001` (Jiangsu, CN, 5,000 kW)
- Native revenue deposit: default `12.48 ETH`
- Carbon credits: default `18,420 SWC`
- Green certificates: default `1,280` certificates for `2026-Q2`

Run it against the current local deployment:

```bash
cd contracts

forge script script/SeedLocal.s.sol:SeedLocal \
  --rpc-url http://127.0.0.1:8545 \
  --private-key 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d \
  --broadcast
```

The private key above is Anvil's default account for
`0x70997970C51812dc3A010C7d01b50e0d17dc79C8`, which is the deployer recorded in
`config/chains.local.json`. Use only on the local Anvil chain.

Override seed values without editing Solidity:

```bash
SEED_STATION_NAME="Sunways Zhejiang Wind Station 002" \
SEED_STATION_REGION="Zhejiang, CN" \
SEED_CAPACITY_KW=8200 \
SEED_REVENUE_WEI=7400000000000000000 \
SEED_CARBON_AMOUNT=9500000000000000000000 \
SEED_CERTIFICATE_AMOUNT=640 \
SEED_CERTIFICATE_PERIOD="2026-Q3" \
forge script script/SeedLocal.s.sol:SeedLocal \
  --rpc-url http://127.0.0.1:8545 \
  --private-key 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d \
  --broadcast
```

If `Station #1` already exists, the script skips station registration and only
adds more revenue, carbon credits, and a new green certificate issuance.
