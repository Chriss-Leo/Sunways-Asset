import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { anvil } from "./chains";

/**
 * WalletConnect still requires a project ID even for local-only development.
 */
const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "sunways-local-dev";

/**
 * Shared wagmi/RainbowKit client configuration for the Pages Router app shell.
 */
export const wagmiConfig = getDefaultConfig({
  appName: "Sunways Asset",
  appDescription: "Web3 energy asset management",
  appUrl: "http://localhost:3000",
  projectId: walletConnectProjectId,
  chains: [anvil],
  ssr: true,
  transports: {
    [anvil.id]: http(anvil.rpcUrls.default.http[0]),
  },
});
