import Head from "next/head";
import { PowerStationPanel } from "@/components/contracts/PowerStationPanel";
import { AdminConsole } from "@/components/dashboard/AdminConsole";
import { OperationsTables } from "@/components/dashboard/OperationsTables";
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
          <OperationsTables />
          <AdminConsole />
        </section>
      </main>
    </>
  );
}
