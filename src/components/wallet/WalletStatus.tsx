import { ConnectButton } from "@rainbow-me/rainbowkit";
import type { ReactNode } from "react";
import { useAccount, useChainId } from "wagmi";
import { useRequiredChain } from "@/hooks/useRequiredChain";
import { SignatureLogin } from "./SignatureLogin";

/**
 * Keeps wallet addresses readable while preserving enough prefix/suffix for recognition.
 */
function shortAddress(address: `0x${string}`) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Compact status badge used for connection and network readiness states.
 */
function StatusPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-zinc-200 bg-zinc-50 text-zinc-700";

  return (
    <span
      className={`inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-medium ${toneClass}`}
    >
      {children}
    </span>
  );
}

/**
 * Wallet readiness panel for the local Anvil development flow.
 */
export function WalletStatus() {
  const { address, connector, isConnected } = useAccount();
  const chainId = useChainId();
  const {
    error,
    isRequiredChain,
    isSwitching,
    requiredChain,
    switchToRequiredChain,
  } = useRequiredChain();

  return (
    <section className="w-full rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 px-5 py-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Sunways Asset
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
            Energy Asset Operations
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-600">
            Power station NFTs, revenue settlement, carbon credits, and green
            certificates on the local development chain.
          </p>
        </div>
      </div>

      <div className="grid gap-0 md:grid-cols-2 xl:grid-cols-4">
        <div className="border-b border-zinc-200 p-5 md:border-r xl:border-b-0">
          <p className="text-sm text-zinc-500">Account</p>
          <p className="mt-2 break-all font-mono text-sm font-semibold text-zinc-950">
            {address ? shortAddress(address) : "Not connected"}
          </p>
        </div>
        <div className="border-b border-zinc-200 p-5 xl:border-b-0 xl:border-r">
          <p className="text-sm text-zinc-500">Connector</p>
          <p className="mt-2 text-sm font-semibold text-zinc-950">
            {connector?.name ?? "None"}
          </p>
        </div>
        <div className="border-b border-zinc-200 p-5 md:border-r md:border-b-0">
          <p className="text-sm text-zinc-500">Current Chain</p>
          <p className="mt-2 font-mono text-sm font-semibold text-zinc-950">
            {chainId}
          </p>
        </div>
        <div className="p-5">
          <p className="text-sm text-zinc-500">Required Chain</p>
          <p className="mt-2 text-sm font-semibold text-zinc-950">
            {requiredChain.name} ({requiredChain.id})
          </p>
        </div>
      </div>

      <div className="border-t border-zinc-200 bg-zinc-50 px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-zinc-950">
                Step 1 · Connect Wallet
              </p>
              {isConnected ? (
                isRequiredChain ? (
                  <StatusPill tone="success">Ready on Anvil</StatusPill>
                ) : (
                  <StatusPill tone="warning">Wrong network</StatusPill>
                )
              ) : (
                <StatusPill>Wallet not connected</StatusPill>
              )}
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Use RainbowKit to select MetaMask, WalletConnect, or another
              available wallet provider.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <ConnectButton />
            {isConnected && !isRequiredChain ? (
              <button
                className="inline-flex min-h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                disabled={isSwitching}
                type="button"
                onClick={switchToRequiredChain}
              >
                {isSwitching ? "Switching..." : "Switch to Anvil"}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <p className="mx-5 mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error.message}
        </p>
      ) : null}

      <div className="px-5 pb-5">
        <SignatureLogin canLogin={isConnected && isRequiredChain} />
      </div>
    </section>
  );
}
