import Head from "next/head";
import { WalletStatus } from "@/components/wallet/WalletStatus";

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
      <main className="flex min-h-screen flex-1 bg-[#f6f7f2] px-4 py-6 font-sans text-zinc-950 sm:px-6 lg:px-8">
        <section className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          <WalletStatus />

          <section className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-zinc-500">Step</p>
              <h2 className="mt-2 text-xl font-semibold text-zinc-950">
                P1 Wallet Connection
              </h2>
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                This screen validates wallet connection and local Anvil network
                readiness before signature login and contract calls are added.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-zinc-500">Local RPC</p>
              <p className="mt-2 font-mono text-sm font-semibold text-zinc-950">
                http://127.0.0.1:8545
              </p>
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                Start Anvil with chain ID 31337 before switching your wallet to
                the local development network.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-zinc-500">Next</p>
              <h2 className="mt-2 text-xl font-semibold text-zinc-950">
                P3 Contract Config
              </h2>
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                After wallet login is stable, the next step is sharing local
                deployment addresses and ABI between frontend and backend.
              </p>
            </div>
          </section>
        </section>
      </main>
    </>
  );
}
