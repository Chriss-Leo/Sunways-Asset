import Head from "next/head";
import { PowerStationPanel } from "@/components/contracts/PowerStationPanel";
import { AdminConsole } from "@/components/dashboard/AdminConsole";
import { OperationsTables } from "@/components/dashboard/OperationsTables";
import { PortfolioOverview } from "@/components/dashboard/PortfolioOverview";
import { FileCenter } from "@/components/platform/FileCenter";
import { PlatformWorkspace } from "@/components/platform/PlatformWorkspace";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
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
      <main className="flex min-h-screen flex-1 bg-[#f4f7f3] px-4 py-6 font-sans text-zinc-950 sm:px-6 lg:px-8">
        <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
          <div className="flex justify-end">
            <LanguageSwitcher />
          </div>
          <WalletStatus />
          <PortfolioOverview />
          <PlatformWorkspace />
          <FileCenter />
          <PowerStationPanel />
          <OperationsTables />
          <AdminConsole />
        </section>
      </main>
    </>
  );
}
