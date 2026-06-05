import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatEther } from "viem";
import { useT } from "@/i18n";
import {
  getAccountSummaries,
  getCarbonIssuances,
  getCarbonRetirements,
  getCertificateIssuances,
  getCertificateRetirements,
  getFundraisingDeposits,
  getFundraisingDividendClaims,
  getFundraisingDividendDistributions,
  getFundraisingWithdrawals,
  getIndexerStatus,
  getRevenueClaims,
  getRevenueDeposits,
  getStationOperationStatuses,
  getStations,
  type CarbonCreditIssuance,
  type CarbonCreditRetirement,
  type FundraisingDeposit,
  type FundraisingDividendClaim,
  type FundraisingDividendDistribution,
  type FundraisingWithdrawal,
  type GreenCertificateIssuance,
  type GreenCertificateRetirement,
  type RevenueClaim,
  type RevenueDeposit,
  type Station,
  type StationOperationStatus,
  type UserAssetSummary,
} from "@/services/dashboard";

function shortAddress(address: string | undefined) {
  if (!address) {
    return "N/A";
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function shortHash(hash: string | undefined) {
  if (!hash) {
    return "Pending";
  }
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

function formatWei(value: string | undefined) {
  if (!value || value === "0") {
    return "0 ETH";
  }
  return `${Number(formatEther(BigInt(value))).toLocaleString(undefined, {
    maximumFractionDigits: 4,
  })} ETH`;
}

function formatToken(value: string | undefined, suffix: string) {
  if (!value || value === "0") {
    return `0 ${suffix}`;
  }
  return `${Number(formatEther(BigInt(value))).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })} ${suffix}`;
}

function SectionShell({
  action,
  children,
  eyebrow,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-zinc-200 bg-zinc-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-zinc-950">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatusPill({
  children,
  tone = "zinc",
}: {
  children: ReactNode;
  tone?: "emerald" | "amber" | "red" | "sky" | "zinc";
}) {
  const tones = {
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    red: "border-red-200 bg-red-50 text-red-700",
    sky: "border-sky-200 bg-sky-50 text-sky-700",
    zinc: "border-zinc-200 bg-zinc-50 text-zinc-700",
  };

  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500">
      {label}
    </div>
  );
}

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

function StationBoard({
  operations,
  stations,
}: {
  operations: StationOperationStatus[];
  stations: Station[];
}) {
  const { t } = useT();
  const operationMap = new Map(
    operations.map((operation) => [operation.stationId, operation]),
  );

  return (
    <SectionShell
      action={<StatusPill tone="emerald">{t("operations.indexedPill", { count: stations.length })}</StatusPill>}
      eyebrow={t("operations.assets")}
      title={t("operations.powerStationPortfolio")}
    >
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,28rem),1fr))] gap-4 p-5">
        {stations.length === 0 ? (
          <div className="lg:col-span-2">
            <EmptyState label={t("station.waitingForStations")} />
          </div>
        ) : null}
        {stations.map((station) => {
          const operation = operationMap.get(station.stationId);
          return (
            <article
              className="rounded-lg border border-zinc-200 bg-white p-5 transition hover:border-zinc-300 hover:shadow-md"
              key={station.stationId}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-mono text-xs font-semibold text-zinc-500">
                    {t("station.stationNumber", { id: station.stationId })}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-zinc-950">
                    {station.name}
                  </h3>
                  <p className="mt-1 text-sm text-zinc-600">{station.region}</p>
                </div>
                <StatusPill
                  tone={operation?.status === "normal" ? "emerald" : "sky"}
                >
                  {operation?.status ?? station.status}
                </StatusPill>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-md bg-zinc-50 p-3">
                  <p className="text-xs font-medium text-zinc-500">{t("station.capacity")}</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-950">
                    {Number(station.capacityKw).toLocaleString()} {t("station.kW")}
                  </p>
                </div>
                <div className="rounded-md bg-zinc-50 p-3">
                  <p className="text-xs font-medium text-zinc-500">
                    {t("station.utilization")}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-zinc-950">
                    {operation?.utilization || t("station.nA")}
                  </p>
                </div>
                <div className="rounded-md bg-zinc-50 p-3">
                  <p className="text-xs font-medium text-zinc-500">{t("station.review")}</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-950">
                    {station.reviewStatus ?? "approved"}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2 border-t border-zinc-100 pt-4 text-sm text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-mono">{shortAddress(station.owner)}</span>
                <span className="font-mono">{shortHash(station.txHash)}</span>
              </div>
            </article>
          );
        })}
      </div>
    </SectionShell>
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

function RecordPanel({
  children,
  emptyLabel,
  eyebrow,
  title,
}: {
  children: ReactNode;
  emptyLabel: string;
  eyebrow: string;
  title: string;
}) {
  const isEmpty = Array.isArray(children) && children.length === 0;

  return (
    <SectionShell eyebrow={eyebrow} title={title}>
      <div className="space-y-3 p-5">
        {isEmpty ? <EmptyState label={emptyLabel} /> : children}
      </div>
    </SectionShell>
  );
}

function AccountSummaryPanel({ items }: { items: UserAssetSummary[] }) {
  const { t } = useT();
  return (
    <SectionShell eyebrow={t("operations.accounts")} title={t("operations.userAssetSummary")}>
      <div className="grid gap-4 p-5">
        {items.length === 0 ? (
          <EmptyState label={t("operations.waitingForBalances")} />
        ) : null}
        {items.map((item) => (
          <article
            className="rounded-lg border border-zinc-200 bg-white p-5"
            key={item.account}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-mono text-sm font-semibold text-zinc-950">
                {shortAddress(item.account)}
              </p>
              <StatusPill tone="sky">{t("operations.stations", { count: item.stationCount })}</StatusPill>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-md bg-zinc-50 p-3">
                <p className="text-xs text-zinc-500">{t("operations.revenue")}</p>
                <p className="mt-1 text-sm font-semibold text-zinc-950">
                  {formatWei(item.totalRevenueWei)}
                </p>
              </div>
              <div className="rounded-md bg-zinc-50 p-3">
                <p className="text-xs text-zinc-500">{t("operations.carbon")}</p>
                <p className="mt-1 text-sm font-semibold text-zinc-950">
                  {formatToken(item.carbonCreditBalance, "SWC")}
                </p>
              </div>
              <div className="rounded-md bg-zinc-50 p-3">
                <p className="text-xs text-zinc-500">{t("operations.certificates")}</p>
                <p className="mt-1 text-sm font-semibold text-zinc-950">
                  {Number(item.greenCertificateCount).toLocaleString()}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </SectionShell>
  );
}

export function OperationsTables() {
  const { t } = useT();
  const stations = useQuery({
    queryKey: ["stations"],
    queryFn: getStations,
    retry: false,
    refetchInterval: 10_000,
  });
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
  const operations = useQuery({
    queryKey: ["station-operation-statuses"],
    queryFn: getStationOperationStatuses,
    retry: false,
    refetchInterval: 10_000,
  });
  const carbon = useQuery({
    queryKey: ["carbon-issuances"],
    queryFn: getCarbonIssuances,
    retry: false,
    refetchInterval: 10_000,
  });
  const retirements = useQuery({
    queryKey: ["carbon-retirements"],
    queryFn: getCarbonRetirements,
    retry: false,
    refetchInterval: 10_000,
  });
  const certificates = useQuery({
    queryKey: ["certificate-issuances"],
    queryFn: getCertificateIssuances,
    retry: false,
    refetchInterval: 10_000,
  });
  const certRetirements = useQuery({
    queryKey: ["certificate-retirements"],
    queryFn: getCertificateRetirements,
    retry: false,
    refetchInterval: 10_000,
  });
  const status = useQuery({
    queryKey: ["indexer-status"],
    queryFn: getIndexerStatus,
    retry: false,
    refetchInterval: 5_000,
  });
  const accounts = useQuery({
    queryKey: ["account-summaries"],
    queryFn: getAccountSummaries,
    retry: false,
    refetchInterval: 10_000,
  });
  const fundDeposits = useQuery({
    queryKey: ["fundraising-deposits"],
    queryFn: getFundraisingDeposits,
    retry: false,
    refetchInterval: 10_000,
  });
  const fundWithdrawals = useQuery({
    queryKey: ["fundraising-withdrawals"],
    queryFn: getFundraisingWithdrawals,
    retry: false,
    refetchInterval: 10_000,
  });
  const fundDistributions = useQuery({
    queryKey: ["fundraising-dividend-distributions"],
    queryFn: getFundraisingDividendDistributions,
    retry: false,
    refetchInterval: 10_000,
  });
  const fundClaims = useQuery({
    queryKey: ["fundraising-dividend-claims"],
    queryFn: getFundraisingDividendClaims,
    retry: false,
    refetchInterval: 10_000,
  });

  const revenueRecords = [
    ...(deposits.data?.items ?? []).map((item: RevenueDeposit) => (
      <RecordItem
        key={`deposit-${item.txHash}-${item.blockNumber}`}
        meta={`Station #${item.stationId} · ${shortAddress(item.beneficiary)}`}
        title={t("operations.revenueDeposited")}
        txHash={item.txHash}
        value={formatWei(item.amountWei)}
      />
    )),
    ...(claims.data?.items ?? []).map((item: RevenueClaim) => (
      <RecordItem
        key={`claim-${item.txHash}-${item.blockNumber}`}
        meta={shortAddress(item.account)}
        title={t("operations.revenueClaimed")}
        txHash={item.txHash}
        value={formatWei(item.amountWei)}
      />
    )),
  ];

  const carbonRecords = [
    ...(carbon.data?.items ?? []).map((item: CarbonCreditIssuance) => (
      <RecordItem
        key={`carbon-${item.txHash}-${item.blockNumber}`}
        meta={`Station #${item.stationId} · ${shortAddress(item.account)}`}
        title={t("operations.carbonCreditsMinted")}
        txHash={item.txHash}
        value={formatToken(item.amount, "SWC")}
      />
    )),
    ...(retirements.data?.items ?? []).map((item: CarbonCreditRetirement) => (
      <RecordItem
        key={`retire-${item.txHash}-${item.blockNumber}`}
        meta={`${item.reason} · ${shortAddress(item.account)}`}
        title={t("operations.carbonCreditsRetired")}
        txHash={item.txHash}
        value={formatToken(item.amount, "SWC")}
      />
    )),
  ];

  const fundraisingDepositRecords = (fundDeposits.data?.items ?? []).map(
    (item: FundraisingDeposit) => (
      <RecordItem
        key={`fund-dep-${item.txHash}-${item.blockNumber}`}
        meta={shortAddress(item.account)}
        title={t("operations.fundraisingDeposited")}
        txHash={item.txHash}
        value={formatWei(item.amountWei)}
      />
    ),
  );
  const fundraisingWithdrawRecords = (fundWithdrawals.data?.items ?? []).map(
    (item: FundraisingWithdrawal) => (
      <RecordItem
        key={`fund-wd-${item.txHash}-${item.blockNumber}`}
        meta={shortAddress(item.account)}
        title={t("operations.fundraisingWithdrawn")}
        txHash={item.txHash}
        value={formatWei(item.amountWei)}
      />
    ),
  );
  const fundraisingRecords = [
    ...fundraisingDepositRecords,
    ...fundraisingWithdrawRecords,
  ];
  const dividendRecords = [
    ...(fundDistributions.data?.items ?? []).map(
      (item: FundraisingDividendDistribution) => (
        <RecordItem
          key={`fund-div-${item.txHash}-${item.blockNumber}`}
          meta={`${t("operations.holders")}: ${item.holderCount}`}
          title={t("operations.dividendsDistributed")}
          txHash={item.txHash}
          value={formatWei(item.amountWei)}
        />
      ),
    ),
    ...(fundClaims.data?.items ?? []).map(
      (item: FundraisingDividendClaim) => (
        <RecordItem
          key={`fund-claim-${item.txHash}-${item.blockNumber}`}
          meta={shortAddress(item.account)}
          title={t("operations.dividendClaimed")}
          txHash={item.txHash}
          value={formatWei(item.amountWei)}
        />
      ),
    ),
  ];

  const certificateRecords = [
    ...(certificates.data?.items ?? []).map(
      (item: GreenCertificateIssuance) => (
        <RecordItem
          key={`certificate-${item.txHash}-${item.certificateId}`}
          meta={`${item.certificateType} · ${item.period}`}
          title={t("operations.certificateNumber", { id: item.certificateId })}
          txHash={item.txHash}
          value={t("operations.issued", { count: Number(item.amount).toLocaleString() })}
        />
      ),
    ),
    ...(certRetirements.data?.items ?? []).map(
      (item: GreenCertificateRetirement) => (
        <RecordItem
          key={`cert-retire-${item.txHash}-${item.certificateId}`}
          meta={shortAddress(item.account)}
          title={t("operations.certificateRetired", { id: item.certificateId })}
          txHash={item.txHash}
          value={t("operations.retired", { count: Number(item.amount).toLocaleString() })}
        />
      ),
    ),
  ];

  const lag = status.data?.lagBlocks ?? 0;

  return (
    <section className="space-y-6">
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
        <IndexerCard label={t("operations.lag")} tone={lag > 0 ? "amber" : "emerald"} value={t("operations.blocks", { count: lag })} />
        <IndexerCard
          label={t("operations.failures")}
          tone={(status.data?.failureCount ?? 0) > 0 ? "red" : "emerald"}
          value={status.data?.failureCount ?? 0}
        />
      </section>

      <StationBoard
        operations={operations.data?.items ?? []}
        stations={stations.data?.items ?? []}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <RecordPanel
          emptyLabel={t("operations.waitingForRevenue")}
          eyebrow={t("operations.revenue")}
          title={t("operations.revenueActivity")}
        >
          {revenueRecords}
        </RecordPanel>
        <RecordPanel
          emptyLabel={t("operations.waitingForCarbon")}
          eyebrow={t("operations.carbon")}
          title={t("operations.carbonActivity")}
        >
          {carbonRecords}
        </RecordPanel>
        <RecordPanel
          emptyLabel={t("operations.waitingForCertificates")}
          eyebrow={t("operations.certificates")}
          title={t("operations.greenCertificateBatches")}
        >
          {certificateRecords}
        </RecordPanel>
        <RecordPanel
          emptyLabel={t("operations.waitingForFundraising")}
          eyebrow={t("operations.fundraising")}
          title={t("operations.fundraisingActivity")}
        >
          {fundraisingRecords}
        </RecordPanel>
        <RecordPanel
          emptyLabel={t("operations.waitingForDividends")}
          eyebrow={t("operations.fundraising")}
          title={t("operations.dividendActivity")}
        >
          {dividendRecords}
        </RecordPanel>
        <AccountSummaryPanel items={accounts.data?.items ?? []} />
      </div>
    </section>
  );
}
