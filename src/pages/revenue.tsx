import type { ReactNode } from "react";
import Head from "next/head";
import { useQuery } from "@tanstack/react-query";
import { formatEther } from "viem";
import { useT } from "@/i18n";
import {
  getRevenueClaims,
  getRevenueDeposits,
  type RevenueClaim,
  type RevenueDeposit,
} from "@/services/dashboard";

function shortAddress(address: string | undefined) {
  if (!address) return "N/A";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function shortHash(hash: string) {
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

function formatWei(value: string | undefined) {
  if (!value || value === "0") return "0 ETH";
  return `${Number(formatEther(BigInt(value))).toLocaleString(undefined, {
    maximumFractionDigits: 4,
  })} ETH`;
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500">
      {label}
    </div>
  );
}

function SectionShell({
  children,
  eyebrow,
  title,
}: {
  children: ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 bg-zinc-50/70 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-xl font-semibold text-zinc-950">{title}</h2>
      </div>
      <div className="space-y-3 p-5">{children}</div>
    </section>
  );
}

function RecordItem({
  meta,
  title,
  txHash,
  value,
}: {
  meta: string;
  title: string;
  txHash: string;
  value: string;
}) {
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-zinc-950">{title}</p>
        <p className="mt-1 text-xs text-zinc-500">{meta}</p>
      </div>
      <div className="flex flex-col gap-1 sm:items-end">
        <p className="text-sm font-semibold text-zinc-950">{value}</p>
        <p className="font-mono text-xs text-zinc-500">{shortHash(txHash)}</p>
      </div>
    </article>
  );
}

export default function RevenuePage() {
  const { t } = useT();

  const deposits = useQuery({
    queryKey: ["revenue-deposits"],
    queryFn: getRevenueDeposits,
    retry: false,
    refetchInterval: 10_000,
  });

  const claims = useQuery({
    queryKey: ["revenue-claims"],
    queryFn: getRevenueClaims,
    retry: false,
    refetchInterval: 10_000,
  });

  const depositItems = deposits.data?.items ?? [];
  const claimItems = claims.data?.items ?? [];

  return (
    <>
      <Head>
        <title>{`${t("nav.revenue")} — Sunways Asset`}</title>
      </Head>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionShell
          eyebrow={t("operations.revenue")}
          title={t("operations.revenueActivity")}
        >
          {depositItems.length === 0 ? (
            <EmptyState label={t("operations.waitingForRevenue")} />
          ) : (
            depositItems.map((item: RevenueDeposit) => (
              <RecordItem
                key={`deposit-${item.txHash}-${item.blockNumber}`}
                meta={`Station #${item.stationId} · ${shortAddress(item.beneficiary)}`}
                title={t("operations.revenueDeposited")}
                txHash={item.txHash}
                value={formatWei(item.amountWei)}
              />
            ))
          )}
        </SectionShell>

        <SectionShell
          eyebrow={t("operations.revenue")}
          title={t("operations.revenueClaimed")}
        >
          {claimItems.length === 0 ? (
            <EmptyState label={t("operations.waitingForRevenue")} />
          ) : (
            claimItems.map((item: RevenueClaim) => (
              <RecordItem
                key={`claim-${item.txHash}-${item.blockNumber}`}
                meta={shortAddress(item.account)}
                title={t("operations.revenueClaimed")}
                txHash={item.txHash}
                value={formatWei(item.amountWei)}
              />
            ))
          )}
        </SectionShell>
      </div>
    </>
  );
}
