import Head from "next/head";
import { useQuery } from "@tanstack/react-query";
import { useT } from "@/i18n";
import { PortfolioOverview } from "@/components/dashboard/PortfolioOverview";
import { getIndexerStatus } from "@/services/dashboard";

function IndexerCard({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "emerald" | "amber" | "red" | "sky";
  value: string | number;
}) {
  const accents = {
    amber: "border-l-amber-400",
    emerald: "border-l-emerald-500",
    red: "border-l-red-500",
    sky: "border-l-sky-500",
  };

  return (
    <article
      className={`rounded-lg border border-zinc-200 border-l-4 bg-white p-5 shadow-sm ${accents[tone]}`}
    >
      <p className="text-sm font-medium text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-zinc-950">{value}</p>
    </article>
  );
}

export default function DashboardPage() {
  const { t } = useT();

  const status = useQuery({
    queryKey: ["indexer-status"],
    queryFn: getIndexerStatus,
    retry: false,
    refetchInterval: 5_000,
  });

  const lag = status.data?.lagBlocks ?? 0;

  return (
    <>
      <Head>
        <title>{t("nav.dashboard")} — Sunways Asset</title>
      </Head>

      <PortfolioOverview />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <IndexerCard
          label={t("operations.latestBlock")}
          tone="sky"
          value={status.data?.latestKnownBlock ?? 0}
        />
        <IndexerCard
          label={t("operations.indexedBlock")}
          tone="emerald"
          value={status.data?.lastIndexedBlock ?? 0}
        />
        <IndexerCard
          label={t("operations.lag")}
          tone={lag > 0 ? "amber" : "emerald"}
          value={t("operations.blocks", { count: lag })}
        />
        <IndexerCard
          label={t("operations.failures")}
          tone={(status.data?.failureCount ?? 0) > 0 ? "red" : "emerald"}
          value={status.data?.failureCount ?? 0}
        />
      </section>
    </>
  );
}
