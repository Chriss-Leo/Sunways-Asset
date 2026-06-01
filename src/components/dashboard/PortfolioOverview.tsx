import { formatEther } from "viem";
import { useQuery } from "@tanstack/react-query";
import { useChainId, useReadContract } from "wagmi";
import { requiredChain } from "@/config/chains";
import { useT } from "@/i18n";
import {
  carbonCreditTokenAbi,
  greenCertificateAbi,
  revenueVaultAbi,
  sunwaysContracts,
} from "@/contracts/sunways";
import { contractRows, mockStation, portfolioMetrics } from "@/data/mockDashboard";
import { getDashboardSummary } from "@/services/dashboard";

const stationId = BigInt(1);
const certificateId = BigInt(1);

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatTokenAmount(value: unknown, suffix: string) {
  if (typeof value !== "bigint") {
    return null;
  }
  const formatted = Number(formatEther(value)).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
  return `${formatted} ${suffix}`;
}

function formatWeiString(value: string | undefined) {
  if (!value) {
    return null;
  }
  return `${Number(formatEther(BigInt(value))).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })} ETH`;
}

function formatTokenString(value: string | undefined, suffix: string) {
  if (!value) {
    return null;
  }
  return `${Number(formatEther(BigInt(value))).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })} ${suffix}`;
}

function hasNonZero(value: string | undefined) {
  return Boolean(value && value !== "0");
}

function formatCount(value: unknown) {
  if (typeof value !== "bigint") {
    return null;
  }
  return value.toLocaleString();
}

const toneClass = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  sky: "border-sky-200 bg-sky-50 text-sky-700",
  lime: "border-lime-200 bg-lime-50 text-lime-700",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
} as const;

export function PortfolioOverview() {
  const { t } = useT();
  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: getDashboardSummary,
    retry: false,
    refetchInterval: 10_000,
  });
  const chainId = useChainId();
  const isLocalChain = chainId === requiredChain.id;
  const query = {
    enabled: isLocalChain,
    retry: false,
  };

  const ownerQuery = useReadContract({
    ...sunwaysContracts.PowerStationNFT,
    functionName: "ownerOf",
    args: [stationId],
    query,
  });
  const stationOwner =
    typeof ownerQuery.data === "string" ? ownerQuery.data : mockStation.owner;

  const revenueQuery = useReadContract({
    address: sunwaysContracts.RevenueVault.address,
    abi: revenueVaultAbi,
    functionName: "totalDeposited",
    args: [stationId],
    query,
  });
  const carbonQuery = useReadContract({
    address: sunwaysContracts.CarbonCreditToken.address,
    abi: carbonCreditTokenAbi,
    functionName: "balanceOf",
    args: [stationOwner],
    query,
  });
  const certificateQuery = useReadContract({
    address: sunwaysContracts.GreenCertificate.address,
    abi: greenCertificateAbi,
    functionName: "balanceOf",
    args: [stationOwner, certificateId],
    query,
  });

  const metrics = [
    {
      ...portfolioMetrics[0],
      value:
        summaryQuery.data && summaryQuery.data.stations > 0
          ? summaryQuery.data.stations.toLocaleString()
          : portfolioMetrics[0].value,
      source:
        summaryQuery.data && summaryQuery.data.stations > 0
          ? t("portfolio.backend")
          : typeof ownerQuery.data === "string"
            ? t("portfolio.onChain")
            : t("portfolio.mock"),
    },
    {
      ...portfolioMetrics[1],
      value:
        formatWeiString(summaryQuery.data?.totalRevenueWei) ??
        formatTokenAmount(revenueQuery.data, "ETH") ??
        portfolioMetrics[1].value,
      source:
        hasNonZero(summaryQuery.data?.totalRevenueWei)
          ? t("portfolio.backend")
          : typeof revenueQuery.data === "bigint"
            ? t("portfolio.onChain")
            : t("portfolio.mock"),
    },
    {
      ...portfolioMetrics[2],
      value:
        formatTokenString(summaryQuery.data?.totalCarbonAmount, "SWC") ??
        formatTokenAmount(carbonQuery.data, "SWC") ??
        portfolioMetrics[2].value,
      source:
        hasNonZero(summaryQuery.data?.totalCarbonAmount)
          ? t("portfolio.backend")
          : typeof carbonQuery.data === "bigint"
            ? t("portfolio.onChain")
            : t("portfolio.mock"),
    },
    {
      ...portfolioMetrics[3],
      value:
        hasNonZero(summaryQuery.data?.totalCertificates)
          ? Number(summaryQuery.data?.totalCertificates).toLocaleString()
          : formatCount(certificateQuery.data) ?? portfolioMetrics[3].value,
      source:
        hasNonZero(summaryQuery.data?.totalCertificates)
          ? t("portfolio.backend")
          : typeof certificateQuery.data === "bigint"
            ? t("portfolio.onChain")
            : t("portfolio.mock"),
    },
  ];

  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article
            className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
            key={metric.label}
          >
            <div
              className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-semibold ${toneClass[metric.tone]}`}
            >
              {metric.source}
            </div>
            <p className="mt-4 text-sm font-medium text-zinc-500">
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
