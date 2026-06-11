import type { ReactNode } from "react";
import Head from "next/head";
import { useQuery } from "@tanstack/react-query";
import { useChainId, useReadContract } from "wagmi";
import { requiredChain } from "@/config/chains";
import { useT } from "@/i18n";
import { sunwaysContracts, sunwaysLocalDeployment } from "@/contracts/sunways";
import {
  getStations,
  getStationOperationStatuses,
  type Station,
  type StationOperationStatus,
} from "@/services/dashboard";

function shortAddress(address: string | undefined) {
  if (!address) return "N/A";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function shortHash(hash: string | undefined) {
  if (!hash) return "Pending";
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
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

function ContractInfo() {
  const { t } = useT();
  const chainId = useChainId();
  const isLocalChain = chainId === requiredChain.id;
  const powerStation = sunwaysContracts.PowerStationNFT;

  const common = { enabled: isLocalChain, retry: false };

  const nameQuery = useReadContract({
    ...powerStation,
    functionName: "name",
    query: common,
  });
  const symbolQuery = useReadContract({
    ...powerStation,
    functionName: "symbol",
    query: common,
  });

  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 bg-zinc-50/70 px-5 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {t("portfolio.localContractMap")}
        </p>
      </div>
      <div className="flex flex-wrap gap-x-8 gap-y-3 px-5 py-4 text-sm">
        <div>
          <span className="text-zinc-500">{t("station.nftContract")}</span>
          <span className="ml-2 font-mono font-semibold text-zinc-950">
            {shortAddress(powerStation.address)}
          </span>
        </div>
        <div>
          <span className="text-zinc-500">{t("station.contractName")}</span>
          <span className="ml-2 font-semibold text-zinc-950">
            {typeof nameQuery.data === "string" ? nameQuery.data : "—"}
          </span>
        </div>
        <div>
          <span className="text-zinc-500">{t("station.symbol")}</span>
          <span className="ml-2 font-mono font-semibold text-zinc-950">
            {typeof symbolQuery.data === "string" ? symbolQuery.data : "—"}
          </span>
        </div>
        <div>
          <span className="text-zinc-500">{t("station.network")}</span>
          <span className="ml-2 font-semibold text-zinc-950">
            {sunwaysLocalDeployment.name}
          </span>
        </div>
      </div>
    </section>
  );
}

export default function AssetsPage() {
  const { t } = useT();

  const stations = useQuery({
    queryKey: ["stations"],
    queryFn: getStations,
    retry: false,
    refetchInterval: 10_000,
  });

  const operations = useQuery({
    queryKey: ["station-operation-statuses"],
    queryFn: getStationOperationStatuses,
    retry: false,
    refetchInterval: 10_000,
  });

  const operationMap = new Map(
    (operations.data?.items ?? []).map((op: StationOperationStatus) => [
      op.stationId,
      op,
    ]),
  );

  const stationItems = stations.data?.items ?? [];

  return (
    <>
      <Head>
        <title>{`${t("nav.assets")} — Sunways Asset`}</title>
      </Head>

      <div className="space-y-5">
        <ContractInfo />

        <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-zinc-200 bg-zinc-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {t("operations.assets")}
              </p>
              <h2 className="mt-1 text-xl font-semibold text-zinc-950">
                {t("operations.powerStationPortfolio")}
              </h2>
            </div>
            <StatusPill tone="emerald">
              {t("operations.indexedPill", { count: stationItems.length })}
            </StatusPill>
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,28rem),1fr))] gap-4 p-5">
            {stationItems.length === 0 ? (
              <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500">
                {t("station.waitingForStations")}
              </div>
            ) : (
              stationItems.map((station: Station) => {
                const op = operationMap.get(station.stationId);
                return (
                  <article
                    key={station.stationId}
                    className="rounded-lg border border-zinc-200 bg-white p-5 transition hover:border-zinc-300 hover:shadow-md"
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
                        tone={op?.status === "normal" ? "emerald" : "sky"}
                      >
                        {op?.status ?? station.status}
                      </StatusPill>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-4">
                      <div className="rounded-md bg-zinc-50 p-3">
                        <p className="text-xs font-medium text-zinc-500">
                          {t("station.capacity")}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-zinc-950">
                          {Number(station.capacityKw).toLocaleString()} {t("station.kW")}
                        </p>
                      </div>
                      <div className="rounded-md bg-zinc-50 p-3">
                        <p className="text-xs font-medium text-zinc-500">
                          {t("station.utilization")}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-zinc-950">
                          {op?.utilization || "—"}
                        </p>
                      </div>
                      <div className="rounded-md bg-zinc-50 p-3">
                        <p className="text-xs font-medium text-zinc-500">
                          {t("station.commissioned")}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-zinc-950">
                          {station.commissionedAt?.slice(0, 10) ?? "—"}
                        </p>
                      </div>
                      <div className="rounded-md bg-zinc-50 p-3">
                        <p className="text-xs font-medium text-zinc-500">
                          {t("station.review")}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-zinc-950">
                          {station.reviewStatus ?? "approved"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-2 border-t border-zinc-100 pt-4 text-sm text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
                      <span className="font-mono">{shortAddress(station.owner)}</span>
                      <span className="font-mono text-xs">{shortHash(station.txHash)}</span>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </>
  );
}
