import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useChainId, useReadContract } from "wagmi";
import { requiredChain } from "@/config/chains";
import { useT } from "@/i18n";
import { sunwaysContracts, sunwaysLocalDeployment } from "@/contracts/sunways";
import { mockStation } from "@/data/mockDashboard";
import { getStation } from "@/services/dashboard";

const firstStationId = BigInt(1);

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatCapacity(value: bigint | number | undefined, fallback: string) {
  if (value === undefined) {
    return fallback;
  }
  return `${value.toLocaleString()} kW`;
}

function formatTimestamp(value: bigint | string | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }
  if (typeof value === "string") {
    return value;
  }
  return new Date(Number(value) * 1000).toLocaleDateString();
}

function statusLabel(value: number | undefined, t: (key: string) => string) {
  switch (value) {
    case 0:
      return t("station.pending");
    case 1:
      return t("station.active");
    case 2:
      return t("station.suspended");
    case 3:
      return t("station.retired");
    default:
      return t("station.nA");
  }
}

function stationFields(data: unknown) {
  const namedData =
    data && typeof data === "object"
      ? (data as {
          name?: unknown;
          region?: unknown;
          capacityKw?: unknown;
          commissionedAt?: unknown;
          status?: unknown;
        })
      : null;
  const positionalData = Array.isArray(data) ? data : null;
  const name = namedData?.name ?? positionalData?.[0];
  const region = namedData?.region ?? positionalData?.[1];
  const capacityKw = namedData?.capacityKw ?? positionalData?.[2];
  const commissionedAt = namedData?.commissionedAt ?? positionalData?.[3];
  const status = namedData?.status ?? positionalData?.[4];

  if (!namedData && !positionalData) {
    return null;
  }

  return {
    name: typeof name === "string" ? name : "N/A",
    region: typeof region === "string" ? region : "N/A",
    capacityKw: typeof capacityKw === "bigint" ? capacityKw : undefined,
    commissionedAt:
      typeof commissionedAt === "bigint" ? commissionedAt : undefined,
    status: typeof status === "number" ? status : undefined,
  };
}

export function PowerStationPanel() {
  const { t } = useT();
  const backendStation = useQuery({
    queryKey: ["station", 1],
    queryFn: () => getStation(1),
    retry: false,
    refetchInterval: 10_000,
  });
  const chainId = useChainId();
  const isLocalChain = chainId === requiredChain.id;
  const powerStation = sunwaysContracts.PowerStationNFT;

  const commonQuery = {
    enabled: isLocalChain,
    retry: false,
  };

  const nameQuery = useReadContract({
    ...powerStation,
    functionName: "name",
    query: commonQuery,
  });
  const symbolQuery = useReadContract({
    ...powerStation,
    functionName: "symbol",
    query: commonQuery,
  });
  const ownerQuery = useReadContract({
    ...powerStation,
    functionName: "ownerOf",
    args: [firstStationId],
    query: commonQuery,
  });
  const stationQuery = useReadContract({
    ...powerStation,
    functionName: "station",
    args: [firstStationId],
    query: commonQuery,
  });

  const station = useMemo(() => stationFields(stationQuery.data), [
    stationQuery.data,
  ]);
  const hasFirstStation = Boolean(station && ownerQuery.data);
  const hasBackendStation = Boolean(backendStation.data);
  const displayStation = hasBackendStation
    ? {
        name: backendStation.data?.name ?? t("station.nA"),
        region: backendStation.data?.region ?? t("station.nA"),
        owner: backendStation.data?.owner ?? mockStation.owner,
        capacityKw: Number(backendStation.data?.capacityKw ?? 0),
        commissionedAt:
          backendStation.data?.commissionedAt?.slice(0, 10) ??
          mockStation.commissionedAt,
        status: backendStation.data?.status ?? t("station.nA"),
        source: t("portfolio.backend"),
      }
    : hasFirstStation
      ? {
          name: station?.name ?? t("station.nA"),
          region: station?.region ?? t("station.nA"),
        owner:
          typeof ownerQuery.data === "string" ? ownerQuery.data : mockStation.owner,
        capacityKw: station?.capacityKw,
        commissionedAt: station?.commissionedAt,
          status: statusLabel(station?.status, t),
          source: t("portfolio.onChain"),
        }
      : {
          name: mockStation.name,
          region: mockStation.region,
          owner: mockStation.owner,
          capacityKw: mockStation.capacityKw,
          commissionedAt: mockStation.commissionedAt,
          status: mockStation.status,
          source: t("portfolio.mock"),
        };
  const isLiveData = hasBackendStation || hasFirstStation;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-zinc-200 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            {t("station.asset")}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
            {displayStation.name}
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            {displayStation.region} · {formatCapacity(displayStation.capacityKw, t("station.nA"))}
          </p>
        </div>
        <span
          className={`inline-flex min-h-8 items-center rounded-full border px-3 text-sm font-medium ${
            isLiveData
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {displayStation.source}
        </span>
      </div>

      <div className="grid gap-0 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="border-b border-zinc-200 p-5 lg:border-b-0 lg:border-r">
          <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
            <div>
              <p className="text-sm text-zinc-500">{t("station.stationId")}</p>
              <p className="mt-1 font-mono text-sm font-semibold text-zinc-950">
                #{firstStationId.toString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">{t("station.owner")}</p>
              <p className="mt-1 font-mono text-sm font-semibold text-zinc-950">
                {shortAddress(displayStation.owner)}
              </p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">{t("station.status")}</p>
              <p className="mt-1 text-sm font-semibold text-zinc-950">
                {displayStation.status}
              </p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">{t("station.commissioned")}</p>
              <p className="mt-1 text-sm font-semibold text-zinc-950">
                {formatTimestamp(displayStation.commissionedAt, t("station.nA"))}
              </p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">{t("station.monthlyRevenue")}</p>
              <p className="mt-1 text-sm font-semibold text-zinc-950">
                {mockStation.monthlyRevenueEth} ETH
              </p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">{t("station.utilization")}</p>
              <p className="mt-1 text-sm font-semibold text-zinc-950">
                {mockStation.utilization}
              </p>
            </div>
          </div>
        </div>

        <div className="p-5">
          <dl className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-zinc-500">{t("station.nftContract")}</dt>
              <dd className="font-mono text-sm font-semibold text-zinc-950">
                {shortAddress(powerStation.address)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-zinc-500">{t("station.contractName")}</dt>
              <dd className="text-sm font-semibold text-zinc-950">
                {typeof nameQuery.data === "string" ? nameQuery.data : t("station.nA")}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-zinc-500">{t("station.symbol")}</dt>
              <dd className="font-mono text-sm font-semibold text-zinc-950">
                {typeof symbolQuery.data === "string" ? symbolQuery.data : t("station.nA")}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-zinc-500">{t("station.network")}</dt>
              <dd className="text-sm font-semibold text-zinc-950">
                {sunwaysLocalDeployment.name}
              </dd>
            </div>
          </dl>
          {!isLocalChain ? (
            <p className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {t("station.switchToAnvil")}
            </p>
          ) : null}
          {isLocalChain && !isLiveData ? (
            <p className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {t("station.demoData")}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
