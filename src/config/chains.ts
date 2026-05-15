import { defineChain } from "viem";

/**
 * Local Anvil chain used by the development wallet, frontend, and backend examples.
 */
export const anvil = defineChain({
  id: 31337,
  name: "Anvil Local",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["http://127.0.0.1:8545"],
    },
  },
});

/**
 * Single network the current console expects before contract interactions are enabled.
 */
export const requiredChain = anvil;
