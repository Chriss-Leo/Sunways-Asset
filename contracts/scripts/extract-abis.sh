#!/usr/bin/env bash
# Extract ABIs from forge build output into contracts/abis/.
# Run after `forge build`:  cd contracts && ./scripts/extract-abis.sh
set -euo pipefail
cd "$(dirname "$0")/.."

CONTRACTS=(PowerStationNFT RevenueVault CarbonCreditToken GreenCertificate)
mkdir -p abis

for name in "${CONTRACTS[@]}"; do
  src="out/${name}.sol/${name}.json"
  dst="abis/${name}.json"
  if [ ! -f "$src" ]; then
    echo "ERROR: $src not found — run 'forge build' first" >&2
    exit 1
  fi
  python3 -c "
import json
with open('$src') as f:
    data = json.load(f)
with open('$dst', 'w') as f:
    json.dump(data['abi'], f, indent=2)
  "
  echo "  → $dst"
done
