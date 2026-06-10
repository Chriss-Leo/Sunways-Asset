import { useState } from "react";
import { formatEther } from "viem";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useChainId, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "@wagmi/core";
import { wagmiConfig } from "@/config/wagmi";
import { requiredChain } from "@/config/chains";
import { useT } from "@/i18n";
import {
  carbonCreditTokenAbi,
  fundraisingPoolAbi,
  greenCertificateAbi,
  powerStationNFTAbi,
  revenueVaultAbi,
  sunwaysContracts,
} from "@/contracts/sunways";
import { contractRows } from "@/data/mockDashboard";
import { getDashboardSummary } from "@/services/dashboard";

const certificateId = BigInt(1);
const nftAddr = sunwaysContracts.PowerStationNFT.address;
const vaultAddr = sunwaysContracts.RevenueVault.address;
const carbonAddr = sunwaysContracts.CarbonCreditToken.address;
const certAddr = sunwaysContracts.GreenCertificate.address;
const fundAddr = sunwaysContracts.FundraisingPool.address;

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatWeiBigint(value: bigint | undefined) {
  if (value == null || value === BigInt(0)) return null;
  return `${Number(formatEther(value)).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })} ETH`;
}

function formatTokenBigint(value: bigint | undefined, suffix: string) {
  if (value == null || value === BigInt(0)) return null;
  return `${Number(formatEther(value)).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })} ${suffix}`;
}

const toneClass = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  sky: "border-sky-200 bg-sky-50 text-sky-700",
  lime: "border-lime-200 bg-lime-50 text-lime-700",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
} as const;

type Scope = "personal" | "global";

export function PortfolioOverview() {
  const { t } = useT();
  const { address: account } = useAccount();
  const chainId = useChainId();
  const isLocalChain = chainId === requiredChain.id;
  const query = { enabled: isLocalChain, retry: false };
  const [scope, setScope] = useState<Scope>(account ? "personal" : "global");

  // ── Backend ──
  const backendAccount = scope === "personal" ? account : undefined;
  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary", backendAccount ?? "global"],
    queryFn: () => getDashboardSummary(backendAccount),
    retry: false,
    refetchInterval: 10_000,
  });
  const backendOk =
    summaryQuery.data != null && summaryQuery.data.stations > 0;

  // ── Chain: personal ──
  const myCountQ = useReadContract({
    address: nftAddr,
    abi: powerStationNFTAbi,
    functionName: "balanceOf",
    args: account ? [account] : undefined,
    query: { ...query, enabled: query.enabled && scope === "personal" && !!account },
  });
  const myCount =
    typeof myCountQ.data === "bigint" ? Number(myCountQ.data) : 0;

  const tokenIdsQ = useReadContracts({
    contracts: Array.from({ length: myCount }, (_, i) => ({
      address: nftAddr,
      abi: powerStationNFTAbi,
      functionName: "tokenOfOwnerByIndex" as const,
      args: account ? [account, BigInt(i)] : undefined,
    })),
    query: { ...query, enabled: query.enabled && scope === "personal" && !!account && myCount > 0 },
  });
  const myStationIds = (tokenIdsQ.data || [])
    .map((r) => r.result)
    .filter((v): v is bigint => typeof v === "bigint");

  const myRevenueQ = useReadContracts({
    contracts: myStationIds.map((id) => ({
      address: vaultAddr,
      abi: revenueVaultAbi,
      functionName: "totalDeposited" as const,
      args: [id],
    })),
    query: { ...query, enabled: scope === "personal" && myStationIds.length > 0 },
  });
  const myChainRevenue = (myRevenueQ.data || []).reduce(
    (sum, r) => (typeof r.result === "bigint" ? sum + r.result : sum),
    BigInt(0),
  );

  const myCarbonQ = useReadContract({
    address: carbonAddr,
    abi: carbonCreditTokenAbi,
    functionName: "balanceOf",
    args: account ? [account] : undefined,
    query: { ...query, enabled: query.enabled && scope === "personal" && !!account },
  });

  const myCertsQ = useReadContract({
    address: certAddr,
    abi: greenCertificateAbi,
    functionName: "balanceOf",
    args: account ? [account, certificateId] : undefined,
    query: { ...query, enabled: query.enabled && scope === "personal" && !!account },
  });

  // ── Chain: global ──
  const globalStationsQ = useReadContract({
    address: nftAddr,
    abi: powerStationNFTAbi,
    functionName: "totalStations",
    query: { ...query, enabled: scope === "global" },
  });

  const globalRevenueQ = useReadContract({
    address: vaultAddr,
    abi: revenueVaultAbi,
    functionName: "totalGlobalDeposited",
    query: { ...query, enabled: scope === "global" },
  });

  const globalCarbonQ = useReadContract({
    address: carbonAddr,
    abi: carbonCreditTokenAbi,
    functionName: "totalSupply",
    query: { ...query, enabled: scope === "global" },
  });

  const globalCertsQ = useReadContract({
    address: certAddr,
    abi: greenCertificateAbi,
    functionName: "totalSupply",
    args: [certificateId],
    query: { ...query, enabled: scope === "global" },
  });

  // ── FundraisingPool ──
  const myFundBalanceQ = useReadContract({
    address: fundAddr,
    abi: fundraisingPoolAbi,
    functionName: "balanceOf",
    args: account ? [account] : undefined,
    query: { ...query, enabled: query.enabled && scope === "personal" && !!account },
  });

  const myFundClaimableQ = useReadContract({
    address: fundAddr,
    abi: fundraisingPoolAbi,
    functionName: "claimableDividends",
    args: account ? [account] : undefined,
    query: { ...query, enabled: query.enabled && scope === "personal" && !!account },
  });

  const globalFundSupplyQ = useReadContract({
    address: fundAddr,
    abi: fundraisingPoolAbi,
    functionName: "totalSupply",
    query: { ...query, enabled: scope === "global" },
  });

  const globalFundDividendsQ = useReadContract({
    address: fundAddr,
    abi: fundraisingPoolAbi,
    functionName: "totalDividendsDistributed",
    query: { ...query, enabled: scope === "global" },
  });

  // ── Resolve values ──
  const isPersonal = scope === "personal" && !!account;

  // ── Claim dividends ──
  const { writeContract: claimDividends, isPending: claimingDividends } =
    useWriteContract();
  const claimableWei =
    isPersonal &&
    typeof myFundClaimableQ.data === "bigint" &&
    myFundClaimableQ.data > BigInt(0)
      ? myFundClaimableQ.data
      : null;

  const handleClaimDividends = async () => {
    if (!claimableWei) return;
    claimDividends(
      {
        address: fundAddr,
        abi: fundraisingPoolAbi,
        functionName: "claimDividends",
      },
      {
        onSuccess: async (txHash) => {
          const receipt = await waitForTransactionReceipt(wagmiConfig, { hash: txHash });
          if (receipt.status === "success") {
            myFundClaimableQ.refetch();
            myFundBalanceQ.refetch();
          }
        },
      },
    );
  };

  const stationsValue: string = backendOk
    ? summaryQuery.data!.stations.toLocaleString()
    : isPersonal
      ? myCount.toLocaleString()
      : scope === "global" && typeof globalStationsQ.data === "bigint"
        ? globalStationsQ.data.toLocaleString()
        : "—";

  const revenueValue: string = backendOk
    ? (formatWeiBigint(BigInt(summaryQuery.data!.totalRevenueWei)) ?? "0 ETH")
    : isPersonal
      ? formatWeiBigint(myChainRevenue) ?? "0 ETH"
      : scope === "global"
        ? formatWeiBigint(globalRevenueQ.data as bigint | undefined) ?? "0 ETH"
        : "—";

  const carbonValue: string = backendOk
    ? (formatTokenBigint(BigInt(summaryQuery.data!.totalCarbonAmount), "SWC") ?? "0 SWC")
    : isPersonal
      ? formatTokenBigint(myCarbonQ.data as bigint | undefined, "SWC") ?? "0 SWC"
      : scope === "global"
        ? formatTokenBigint(globalCarbonQ.data as bigint | undefined, "SWC") ?? "0 SWC"
        : "—";

  const certsValue: string = backendOk
    ? Number(summaryQuery.data!.totalCertificates).toLocaleString()
    : isPersonal
      ? ((myCertsQ.data as bigint | undefined)?.toLocaleString() ?? "0")
      : scope === "global"
        ? ((globalCertsQ.data as bigint | undefined)?.toLocaleString() ?? "0")
        : "—";

  const fundBalanceValue: string = isPersonal
    ? (formatWeiBigint(myFundBalanceQ.data as bigint | undefined) ?? "0 ETH")
    : scope === "global"
      ? (formatWeiBigint(globalFundSupplyQ.data as bigint | undefined) ?? "0 ETH")
      : "—";

  const fundDividendsValue: string = isPersonal
    ? (formatWeiBigint(myFundClaimableQ.data as bigint | undefined) ?? "0 ETH")
    : scope === "global"
      ? (formatWeiBigint(globalFundDividendsQ.data as bigint | undefined) ?? "0 ETH")
      : "—";

  const source: string | null = backendOk ? t("portfolio.backend") : t("portfolio.onChain");

  type Metric = {
    label: string;
    value: string;
    detail: string;
    tone: "emerald" | "sky" | "lime" | "amber";
  };

  const metrics: Metric[] = [
    {
      label: t("portfolio.powerStations"),
      value: stationsValue,
      detail: t("portfolio.mwTracked", { capacity: summaryQuery.data?.totalCapacityKw ?? "0" }),
      tone: "emerald",
    },
    {
      label: t("portfolio.revenuePool"),
      value: revenueValue,
      detail: t("portfolio.mockMonthlySettlement"),
      tone: "sky",
    },
    {
      label: t("portfolio.carbonCredits"),
      value: carbonValue,
      detail: t("portfolio.pendingOracle"),
      tone: "lime",
    },
    {
      label: t("portfolio.greenCertificates"),
      value: certsValue,
      detail: t("portfolio.issuanceBatch"),
      tone: "amber",
    },
    {
      label: t("portfolio.fundraisingPool"),
      value: fundBalanceValue,
      detail: isPersonal
        ? t("portfolio.fundYourBalance")
        : t("portfolio.fundTotalDeposited"),
      tone: "lime",
    },
    {
      label: t("portfolio.fundraisingDividends"),
      value: fundDividendsValue,
      detail: isPersonal
        ? t("portfolio.fundYourClaimable")
        : t("portfolio.fundTotalDistributed"),
      tone: "sky",
    },
  ];

  return (
    <section className="space-y-6">
      {/* ── Scope toggle + source badge ── */}
      <div className="flex items-center gap-3">
        <div className="inline-flex rounded-lg border border-zinc-300 bg-zinc-100 p-0.5 text-sm">
          <button
            type="button"
            disabled={!account}
            onClick={() => setScope("personal")}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              scope === "personal"
                ? "bg-white text-zinc-950 shadow-sm"
                : account
                  ? "text-zinc-500 hover:text-zinc-700"
                  : "cursor-not-allowed text-zinc-400"
            }`}
          >
            {t("portfolio.myAssets")}
          </button>
          <button
            type="button"
            onClick={() => setScope("global")}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              scope === "global"
                ? "bg-white text-zinc-950 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {t("portfolio.allAssets")}
          </button>
        </div>

        {source && (
          <span
            className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-semibold ${
              toneClass[
                scope === "personal" ? "emerald" : "sky"
              ]
            }`}
          >
            {source}
          </span>
        )}

        {scope === "personal" && !account && (
          <span className="text-xs text-zinc-400">{t("wallet.notConnected")}</span>
        )}
      </div>

      {/* ── Metric cards ── */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <article
            className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
            key={metric.label}
          >
            <p className="text-sm font-medium text-zinc-500">
              {metric.label}
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
              {metric.value}
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-600 min-h-[2.5rem]">
              {metric.detail}
            </p>
          </article>
        ))}
      </div>

      {/* ── Claim dividends ── */}
      {claimableWei && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-sky-700">
              {t("portfolio.fundraisingDividends")}
            </p>
            <p className="mt-1 text-xl font-semibold text-sky-800">
              {formatWeiBigint(claimableWei) ?? "0 ETH"}
            </p>
          </div>
          <button
            type="button"
            disabled={claimingDividends}
            onClick={handleClaimDividends}
            className="rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50 transition-colors"
          >
            {claimingDividends ? t("portfolio.claiming") : t("portfolio.claim")}
          </button>
        </div>
      )}

      {/* ── Contract table ── */}
      <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-zinc-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              {t("portfolio.deployment")}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-zinc-950">
              {t("portfolio.localContractMap")}
            </h2>
          </div>
          <span className="inline-flex min-h-8 items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 text-sm font-medium text-emerald-700">
            {t("portfolio.anvilChain")}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-5 py-3 font-semibold">{t("portfolio.contract")}</th>
                <th className="px-5 py-3 font-semibold">{t("portfolio.purpose")}</th>
                <th className="px-5 py-3 font-semibold">{t("portfolio.standard")}</th>
                <th className="px-5 py-3 font-semibold">{t("portfolio.address")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {contractRows.map((contract) => (
                <tr className="text-zinc-700" key={contract.name}>
                  <td className="px-5 py-4 font-semibold text-zinc-950">
                    {contract.name}
                  </td>
                  <td className="px-5 py-4">{contract.purpose}</td>
                  <td className="px-5 py-4">{contract.standard}</td>
                  <td className="px-5 py-4 font-mono">
                    {shortAddress(contract.address)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
