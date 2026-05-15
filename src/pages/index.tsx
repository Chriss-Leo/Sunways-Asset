import Head from "next/head";
import { PowerStationPanel } from "@/components/contracts/PowerStationPanel";
import { PortfolioOverview } from "@/components/dashboard/PortfolioOverview";
import { WalletStatus } from "@/components/wallet/WalletStatus";

/**
 * Development console landing page for validating wallet and local-chain readiness.
 */
export default function Home() {
  return (
    <>
      <Head>
        <title>Sunways Asset Console</title>
        <meta
          name="description"
          content="Wallet connection console for Sunways Web3 energy assets"
        />
      </Head>
      <main className="flex min-h-screen flex-1 bg-zinc-100 px-4 py-6 font-sans text-zinc-950 sm:px-6 lg:px-8">
        <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
          <WalletStatus />
          <PortfolioOverview />
          <PowerStationPanel />

          <section className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-zinc-500">Step</p>
              <h2 className="mt-2 text-xl font-semibold text-zinc-950">
                P4 Mock Console
              </h2>
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                Missing chain and indexed values now fall back to dashboard mock
                data so the product surface stays complete during integration.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-zinc-500">Live Reads</p>
              <p className="mt-2 font-mono text-sm font-semibold text-zinc-950">
                PowerStationNFT.name()
              </p>
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                The page reads deployed contract identity from Anvil and blends
                it with mock operational values until indexing is ready.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-zinc-500">Next</p>
              <h2 className="mt-2 text-xl font-semibold text-zinc-950">
                Event Indexer
              </h2>
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                Build the backend listener for station registration, revenue
                deposits, carbon credit minting, and certificate issuance.
              </p>
            </div>
          </section>
        </section>
      </main>
    </>
  );
}
