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
    <section className="w-full rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Wallet
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
            Sunways Asset Console
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-600">
            Connect a wallet and switch to the local Anvil network before
            starting asset registration, indexing, and settlement flows.
          </p>
        </div>
        <div className="shrink-0">
          <ConnectButton />
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 p-4">
          <p className="text-sm text-zinc-500">Account</p>
          <p className="mt-2 break-all font-mono text-sm font-semibold text-zinc-950">
            {address ? shortAddress(address) : "Not connected"}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-4">
          <p className="text-sm text-zinc-500">Connector</p>
          <p className="mt-2 text-sm font-semibold text-zinc-950">
            {connector?.name ?? "None"}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-4">
          <p className="text-sm text-zinc-500">Current Chain</p>
          <p className="mt-2 font-mono text-sm font-semibold text-zinc-950">
            {chainId}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-4">
          <p className="text-sm text-zinc-500">Required Chain</p>
          <p className="mt-2 text-sm font-semibold text-zinc-950">
            {requiredChain.name} ({requiredChain.id})
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        {isConnected ? (
          isRequiredChain ? (
            <StatusPill tone="success">Connected to local Anvil</StatusPill>
          ) : (
            <StatusPill tone="warning">Wrong network selected</StatusPill>
          )
        ) : (
          <StatusPill>Wallet not connected</StatusPill>
        )}

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

      {error ? (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error.message}
        </p>
      ) : null}

      <SignatureLogin canLogin={isConnected && isRequiredChain} />
    </section>
  );
}
