import { useState, type ReactNode } from "react";
import { formatEther, parseEther } from "viem";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useBalance, useChainId, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "@wagmi/core";
import { wagmiConfig } from "@/config/wagmi";
import { requiredChain } from "@/config/chains";
import { useT } from "@/i18n";
import {
  Award,
  Coins,
  HandCoins,
  Landmark,
  Leaf,
  Lock,
  PieChart,
  TrendingUp,
  Zap,
} from "lucide-react";
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

const cardAccent = {
  slate: {
    border: "border-l-slate-300",
    bg: "from-slate-50/30 to-white",
    icon: "bg-slate-100 text-slate-600",
    ring: "ring-slate-200",
  },
  emerald: {
    border: "border-l-emerald-500",
    bg: "from-emerald-50/30 to-white",
    icon: "bg-emerald-100 text-emerald-700",
    ring: "ring-emerald-200",
  },
  amber: {
    border: "border-l-amber-400",
    bg: "from-amber-50/30 to-white",
    icon: "bg-amber-100 text-amber-700",
    ring: "ring-amber-200",
  },
} as const;

type Scope = "personal" | "global";

export function PortfolioOverview() {
  const { t } = useT();
  const { address: account } = useAccount();
  const chainId = useChainId();
  const isLocalChain = chainId === requiredChain.id;
  const query = { enabled: isLocalChain, retry: false, refetchInterval: 8_000 };
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
    functionName: "withdrawableDividendOf",
    args: account ? [account] : undefined,
    query: { ...query, enabled: query.enabled && scope === "personal" && !!account },
  });

  const globalFundSupplyQ = useReadContract({
    address: fundAddr,
    abi: fundraisingPoolAbi,
    functionName: "totalSupply",
    query,
  });

  const globalFundDividendsQ = useReadContract({
    address: fundAddr,
    abi: fundraisingPoolAbi,
    functionName: "totalDividendsDistributed",
    query: { ...query, enabled: scope === "global" },
  });

  const { data: fundEthBalance } = useBalance({
    address: fundAddr,
    query: { ...query, enabled: scope === "global" },
  });

  const { refetch: refetchWalletBalance } = useBalance({
    address: account,
    query: { enabled: isLocalChain && !!account },
  });

  const globalDividendPerShareQ = useReadContract({
    address: fundAddr,
    abi: fundraisingPoolAbi,
    functionName: "magnifiedDividendPerShare",
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
        functionName: "claimDividend",
      },
      {
        onSuccess: async (txHash) => {
          const receipt = await waitForTransactionReceipt(wagmiConfig, { hash: txHash });
          if (receipt.status === "success") {
            myFundClaimableQ.refetch();
            myFundBalanceQ.refetch();
            refetchWalletBalance();
          }
        },
      },
    );
  };

  // ── Deposit / Withdraw SFS ──
  const [poolTab, setPoolTab] = useState<"deposit" | "withdraw">("deposit");
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const { writeContract: doDeposit, isPending: depositing } = useWriteContract();
  const { writeContract: doWithdraw, isPending: withdrawing } = useWriteContract();

  const handleDeposit = async () => {
    if (!depositAmount) return;
    doDeposit(
      {
        address: fundAddr,
        abi: fundraisingPoolAbi,
        functionName: "deposit",
        value: parseEther(depositAmount),
      },
      {
        onSuccess: async (txHash) => {
          const receipt = await waitForTransactionReceipt(wagmiConfig, { hash: txHash });
          if (receipt.status === "success") {
            setDepositAmount("");
            myFundBalanceQ.refetch();
            globalFundSupplyQ.refetch();
            refetchWalletBalance();
          }
        },
      },
    );
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount) return;
    doWithdraw(
      {
        address: fundAddr,
        abi: fundraisingPoolAbi,
        functionName: "withdraw",
        args: [parseEther(withdrawAmount)],
      },
      {
        onSuccess: async (txHash) => {
          const receipt = await waitForTransactionReceipt(wagmiConfig, { hash: txHash });
          if (receipt.status === "success") {
            setWithdrawAmount("");
            myFundBalanceQ.refetch();
            globalFundSupplyQ.refetch();
            refetchWalletBalance();
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

  const contractEthValue: string =
    scope === "global" && fundEthBalance
      ? `${Number(fundEthBalance.formatted).toLocaleString(undefined, { maximumFractionDigits: 4 })} ETH`
      : "—";

  const sharePercent: string | null =
    isPersonal &&
    typeof myFundBalanceQ.data === "bigint" &&
    typeof globalFundSupplyQ.data === "bigint" &&
    globalFundSupplyQ.data > BigInt(0)
      ? `${((Number(myFundBalanceQ.data) / Number(globalFundSupplyQ.data)) * 100).toFixed(2)}%`
      : null;

  const dividendsPerShare: string | null = (() => {
    if (scope !== "global") return null;
    const mps = globalDividendPerShareQ.data;
    const supply = globalFundSupplyQ.data;
    if (typeof mps !== "bigint" || typeof supply !== "bigint" || supply === BigInt(0)) return null;
    // magnifiedDividendPerShare is scaled by MULTIPLIER (2^128)
    // dividendPerShare = magnifiedDividendPerShare / MULTIPLIER, but we need per-1-SFS
    // Since 1 SFS = 1e18 wei and the accumulator is per-wei, the actual ETH per SFS is:
    // (magnifiedDividendPerShare * 1e18) / MULTIPLIER
    const scaled = (mps * BigInt(1e18)) / (BigInt(1) << BigInt(128));
    return `${Number(formatEther(scaled)).toLocaleString(undefined, { maximumFractionDigits: 6 })} ETH`;
  })();

  const source: string | null = backendOk ? t("portfolio.backend") : t("portfolio.onChain");

  const sfsBalance = myFundBalanceQ.data as bigint | undefined;
  const sfsBalanceStr =
    sfsBalance != null && sfsBalance > BigInt(0)
      ? Number(formatEther(sfsBalance)).toLocaleString(undefined, { maximumFractionDigits: 4 })
      : "0";
  const poolTvl = globalFundSupplyQ.data as bigint | undefined;
  const poolTvlStr =
    poolTvl != null && poolTvl > BigInt(0)
      ? Number(formatEther(poolTvl)).toLocaleString(undefined, { maximumFractionDigits: 4 })
      : "0";

  type Metric = {
    label: string;
    value: string;
    detail: string;
    tone: "slate" | "emerald" | "amber";
    icon: ReactNode;
  };

  const iconCls = "h-4 w-4";

  const metrics: Metric[] = [
    {
      label: t("portfolio.powerStations"),
      value: stationsValue,
      detail: t("portfolio.mwTracked", { capacity: summaryQuery.data?.totalCapacityKw ?? "0" }),
      tone: "emerald",
      icon: <Zap className={iconCls} />,
    },
    {
      label: t("portfolio.revenuePool"),
      value: revenueValue,
      detail: t("portfolio.mockMonthlySettlement"),
      tone: "amber",
      icon: <Landmark className={iconCls} />,
    },
    {
      label: t("portfolio.carbonCredits"),
      value: carbonValue,
      detail: t("portfolio.pendingOracle"),
      tone: "emerald",
      icon: <Leaf className={iconCls} />,
    },
    {
      label: t("portfolio.greenCertificates"),
      value: certsValue,
      detail: t("portfolio.issuanceBatch"),
      tone: "amber",
      icon: <Award className={iconCls} />,
    },
    {
      label: t("portfolio.fundraisingPool"),
      value: fundBalanceValue,
      detail: isPersonal
        ? t("portfolio.fundYourBalanceDetail")
        : t("portfolio.fundTotalDepositedDetail"),
      tone: "amber",
      icon: <Coins className={iconCls} />,
    },
    ...(sharePercent
      ? [
          {
            label: t("portfolio.fundYourShare"),
            value: sharePercent,
            detail: t("portfolio.fundYourShareDetail"),
            tone: "slate" as const,
            icon: <PieChart className={iconCls} />,
          },
        ]
      : []),
    ...(scope === "global"
      ? [
          {
            label: t("portfolio.fundContractBalance"),
            value: contractEthValue,
            detail: t("portfolio.fundContractBalanceDetail"),
            tone: "slate" as const,
            icon: <Lock className={iconCls} />,
          },
        ]
      : []),
    ...(dividendsPerShare
      ? [
          {
            label: t("portfolio.fundDividendRate"),
            value: dividendsPerShare,
            detail: t("portfolio.fundDividendRateDetail"),
            tone: "amber" as const,
            icon: <TrendingUp className={iconCls} />,
          },
        ]
      : []),
    {
      label: t("portfolio.fundraisingDividends"),
      value: fundDividendsValue,
      detail: isPersonal
        ? t("portfolio.fundYourClaimableDetail")
        : t("portfolio.fundTotalDistributedDetail"),
      tone: "amber",
      icon: <HandCoins className={iconCls} />,
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
              scope === "personal"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-sky-200 bg-sky-50 text-sky-700"
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
        {metrics.map((metric) => {
          const accent = cardAccent[metric.tone];
          return (
            <article
              className={`rounded-xl border border-zinc-200/60 bg-linear-to-br ${accent.bg} p-5 shadow-sm transition hover:shadow-md hover:-translate-y-0.5 border-l-4 ${accent.border}`}
              key={metric.label}
            >
              <div className="flex items-start justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  {metric.label}
                </p>
                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm ${accent.icon}`}>
                  {metric.icon}
                </span>
              </div>
              <p className="mt-3 text-2xl font-bold tracking-tight text-zinc-900">
                {metric.value}
              </p>
              <p className="mt-1.5 text-xs leading-5 text-zinc-500">
                {metric.detail}
              </p>
            </article>
          );
        })}
      </div>

      {/* ── SFS Pool ── */}
      {isPersonal && (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          {/* Header */}
          <div className="border-b border-zinc-100 bg-zinc-50/50 px-6 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-lime-100 text-lime-700">
                  <Coins className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900">SFS Pool</h3>
                  <p className="text-xs text-zinc-500">1 ETH = 1 SFS · {t("portfolio.depositSfsHint")}</p>
                </div>
              </div>
              <div className="flex items-center gap-5 text-sm">
                <div className="text-right">
                  <p className="text-xs text-zinc-400">{t("portfolio.fundraisingPool")}</p>
                  <p className="font-semibold text-zinc-900">{sfsBalanceStr} SFS</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-zinc-400">TVL</p>
                  <p className="font-semibold text-zinc-900">{poolTvlStr} ETH</p>
                </div>
                {sharePercent && (
                  <div className="text-right">
                    <p className="text-xs text-zinc-400">{t("portfolio.fundYourShare")}</p>
                    <p className="font-semibold text-zinc-900">{sharePercent}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-6">
            {/* Tabs */}
            <div className="mb-4 inline-flex rounded-xl bg-zinc-100 p-1">
              <button
                type="button"
                onClick={() => setPoolTab("deposit")}
                className={`rounded-lg px-5 py-2 text-sm font-semibold transition-all ${
                  poolTab === "deposit"
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {t("portfolio.depositSfs")}
              </button>
              <button
                type="button"
                onClick={() => setPoolTab("withdraw")}
                className={`rounded-lg px-5 py-2 text-sm font-semibold transition-all ${
                  poolTab === "withdraw"
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {t("portfolio.withdrawSfs")}
              </button>
            </div>

            {poolTab === "deposit" ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-zinc-500">{t("portfolio.amountEth")}</label>
                  <span className="text-xs text-zinc-400">↓ {t("portfolio.depositSfsHint")}</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.0"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="flex-1 rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-lg font-medium text-zinc-950 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent transition"
                  />
                  <button
                    type="button"
                    disabled={depositing || !depositAmount || Number(depositAmount) <= 0}
                    onClick={handleDeposit}
                    className="rounded-xl bg-lime-600 px-6 py-3 text-sm font-bold text-white hover:bg-lime-700 disabled:opacity-40 transition-all active:scale-95"
                  >
                    {depositing ? t("portfolio.depositing") : t("portfolio.depositSfs")}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-zinc-500">{t("portfolio.amountEth")}</label>
                  <button
                    type="button"
                    onClick={() => {
                      if (sfsBalance) setWithdrawAmount(formatEther(sfsBalance));
                    }}
                    className="text-xs font-semibold text-lime-600 hover:text-lime-700"
                  >
                    MAX {sfsBalanceStr} SFS
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.0"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="flex-1 rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-lg font-medium text-zinc-950 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
                  />
                  <button
                    type="button"
                    disabled={withdrawing || !withdrawAmount || Number(withdrawAmount) <= 0}
                    onClick={handleWithdraw}
                    className="rounded-xl bg-amber-600 px-6 py-3 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-40 transition-all active:scale-95"
                  >
                    {withdrawing ? t("portfolio.withdrawing") : t("portfolio.withdrawSfs")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
