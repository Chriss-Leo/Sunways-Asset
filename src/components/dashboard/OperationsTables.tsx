import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatEther } from "viem";
import {
  getAccountSummaries,
  getCarbonIssuances,
  getCarbonRetirements,
  getCertificateIssuances,
  getIndexerStatus,
  getRevenueDeposits,
  getRevenueClaims,
  getStationOperationStatuses,
  getStations,
  type CarbonCreditIssuance,
  type CarbonCreditRetirement,
  type GreenCertificateIssuance,
  type RevenueClaim,
  type RevenueDeposit,
  type Station,
  type StationOperationStatus,
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

function EmptyRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td className="px-5 py-8 text-center text-sm text-zinc-500" colSpan={colSpan}>
        Waiting for indexed chain data
      </td>
    </tr>
  );
}

function TableShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 px-5 py-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {subtitle}
        </p>
        <h2 className="mt-1 text-xl font-semibold text-zinc-950">{title}</h2>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

function StationTable({
  operations,
  stations,
}: {
  operations: StationOperationStatus[];
  stations: Station[];
}) {
  const operationMap = new Map(
    operations.map((operation) => [operation.stationId, operation]),
  );
  return (
    <TableShell title="Power Station List" subtitle="Assets">
      <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
        <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-5 py-3 font-semibold">ID</th>
            <th className="px-5 py-3 font-semibold">Name</th>
            <th className="px-5 py-3 font-semibold">Region</th>
            <th className="px-5 py-3 font-semibold">Capacity</th>
            <th className="px-5 py-3 font-semibold">Status</th>
            <th className="px-5 py-3 font-semibold">Utilization</th>
            <th className="px-5 py-3 font-semibold">Review</th>
            <th className="px-5 py-3 font-semibold">Owner</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {stations.length === 0 ? <EmptyRow colSpan={8} /> : null}
          {stations.map((station) => {
            const operation = operationMap.get(station.stationId);
            return (
              <tr className="text-zinc-700" key={station.stationId}>
                <td className="px-5 py-4 font-mono font-semibold text-zinc-950">
                  #{station.stationId}
                </td>
                <td className="px-5 py-4 font-semibold text-zinc-950">
                  {station.name}
                </td>
                <td className="px-5 py-4">{station.region}</td>
                <td className="px-5 py-4">
                  {Number(station.capacityKw).toLocaleString()} kW
                </td>
                <td className="px-5 py-4">
                  {operation?.status ?? station.status}
                </td>
                <td className="px-5 py-4">{operation?.utilization || "N/A"}</td>
                <td className="px-5 py-4">
                  {station.reviewStatus ?? "approved"}
                </td>
                <td className="px-5 py-4 font-mono">
                  {shortAddress(station.owner)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableShell>
  );
}

function RevenueTable({ deposits }: { deposits: RevenueDeposit[] }) {
  return (
    <TableShell title="Revenue Deposits" subtitle="Revenue">
      <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
        <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-5 py-3 font-semibold">Station</th>
            <th className="px-5 py-3 font-semibold">Amount</th>
            <th className="px-5 py-3 font-semibold">Beneficiary</th>
            <th className="px-5 py-3 font-semibold">Block</th>
            <th className="px-5 py-3 font-semibold">Tx</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {deposits.length === 0 ? <EmptyRow colSpan={5} /> : null}
          {deposits.map((deposit) => (
            <tr className="text-zinc-700" key={`${deposit.txHash}-${deposit.blockNumber}`}>
              <td className="px-5 py-4 font-mono font-semibold text-zinc-950">
                #{deposit.stationId}
              </td>
              <td className="px-5 py-4 font-semibold text-zinc-950">
                {formatWei(deposit.amountWei)}
              </td>
              <td className="px-5 py-4 font-mono">
                {shortAddress(deposit.beneficiary)}
              </td>
              <td className="px-5 py-4">{deposit.blockNumber}</td>
              <td className="px-5 py-4 font-mono">{shortHash(deposit.txHash)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  );
}

function RevenueClaimTable({ claims }: { claims: RevenueClaim[] }) {
  return (
    <TableShell title="Revenue Claims" subtitle="Claims">
      <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
        <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-5 py-3 font-semibold">Account</th>
            <th className="px-5 py-3 font-semibold">Amount</th>
            <th className="px-5 py-3 font-semibold">Block</th>
            <th className="px-5 py-3 font-semibold">Tx</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {claims.length === 0 ? <EmptyRow colSpan={4} /> : null}
          {claims.map((claim) => (
            <tr className="text-zinc-700" key={`${claim.txHash}-${claim.blockNumber}`}>
              <td className="px-5 py-4 font-mono">{shortAddress(claim.account)}</td>
              <td className="px-5 py-4 font-semibold text-zinc-950">
                {formatWei(claim.amountWei)}
              </td>
              <td className="px-5 py-4">{claim.blockNumber}</td>
              <td className="px-5 py-4 font-mono">{shortHash(claim.txHash)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  );
}

function CarbonTable({ issuances }: { issuances: CarbonCreditIssuance[] }) {
  return (
    <TableShell title="Carbon Credit Records" subtitle="Carbon">
      <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
        <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-5 py-3 font-semibold">Station</th>
            <th className="px-5 py-3 font-semibold">Amount</th>
            <th className="px-5 py-3 font-semibold">Account</th>
            <th className="px-5 py-3 font-semibold">Evidence</th>
            <th className="px-5 py-3 font-semibold">Tx</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {issuances.length === 0 ? <EmptyRow colSpan={5} /> : null}
          {issuances.map((item) => (
            <tr className="text-zinc-700" key={`${item.txHash}-${item.blockNumber}`}>
              <td className="px-5 py-4 font-mono font-semibold text-zinc-950">
                #{item.stationId}
              </td>
              <td className="px-5 py-4 font-semibold text-zinc-950">
                {formatToken(item.amount, "SWC")}
              </td>
              <td className="px-5 py-4 font-mono">{shortAddress(item.account)}</td>
              <td className="max-w-52 truncate px-5 py-4">{item.evidenceUri}</td>
              <td className="px-5 py-4 font-mono">{shortHash(item.txHash)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  );
}

function CarbonRetirementTable({
  retirements,
}: {
  retirements: CarbonCreditRetirement[];
}) {
  return (
    <TableShell title="Carbon Retirement Records" subtitle="Retirement">
      <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
        <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-5 py-3 font-semibold">Account</th>
            <th className="px-5 py-3 font-semibold">Amount</th>
            <th className="px-5 py-3 font-semibold">Reason</th>
            <th className="px-5 py-3 font-semibold">Tx</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {retirements.length === 0 ? <EmptyRow colSpan={4} /> : null}
          {retirements.map((item) => (
            <tr className="text-zinc-700" key={`${item.txHash}-${item.blockNumber}`}>
              <td className="px-5 py-4 font-mono">{shortAddress(item.account)}</td>
              <td className="px-5 py-4 font-semibold text-zinc-950">
                {formatToken(item.amount, "SWC")}
              </td>
              <td className="px-5 py-4">{item.reason}</td>
              <td className="px-5 py-4 font-mono">{shortHash(item.txHash)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  );
}

function CertificateTable({
  issuances,
}: {
  issuances: GreenCertificateIssuance[];
}) {
  return (
    <TableShell title="Green Certificate Batches" subtitle="Certificates">
      <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
        <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-5 py-3 font-semibold">Certificate</th>
            <th className="px-5 py-3 font-semibold">Station</th>
            <th className="px-5 py-3 font-semibold">Amount</th>
            <th className="px-5 py-3 font-semibold">Period</th>
            <th className="px-5 py-3 font-semibold">Tx</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {issuances.length === 0 ? <EmptyRow colSpan={5} /> : null}
          {issuances.map((item) => (
            <tr className="text-zinc-700" key={`${item.txHash}-${item.certificateId}`}>
              <td className="px-5 py-4 font-mono font-semibold text-zinc-950">
                #{item.certificateId}
              </td>
              <td className="px-5 py-4 font-mono">#{item.stationId}</td>
              <td className="px-5 py-4 font-semibold text-zinc-950">
                {Number(item.amount).toLocaleString()}
              </td>
              <td className="px-5 py-4">{item.period}</td>
              <td className="px-5 py-4 font-mono">{shortHash(item.txHash)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  );
}

export function OperationsTables() {
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

  return (
    <section className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-zinc-500">Latest Block</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-950">
            {status.data?.latestKnownBlock ?? 0}
          </p>
        </article>
        <article className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-zinc-500">Indexed Block</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-950">
            {status.data?.lastIndexedBlock ?? 0}
          </p>
        </article>
        <article className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-zinc-500">Lag</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-950">
            {status.data?.lagBlocks ?? 0} blocks
          </p>
        </article>
        <article className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-zinc-500">Failures</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-950">
            {status.data?.failureCount ?? 0}
          </p>
          {status.data?.lastError ? (
            <p className="mt-2 truncate text-sm text-red-600">
              {status.data.lastError}
            </p>
          ) : null}
        </article>
      </section>

      <StationTable
        operations={operations.data?.items ?? []}
        stations={stations.data?.items ?? []}
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <RevenueTable deposits={deposits.data?.items ?? []} />
        <RevenueClaimTable claims={claims.data?.items ?? []} />
        <CarbonTable issuances={carbon.data?.items ?? []} />
        <CarbonRetirementTable retirements={retirements.data?.items ?? []} />
        <CertificateTable issuances={certificates.data?.items ?? []} />
        <TableShell title="User Asset Summary" subtitle="Accounts">
          <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Account</th>
                <th className="px-5 py-3 font-semibold">Stations</th>
                <th className="px-5 py-3 font-semibold">Revenue</th>
                <th className="px-5 py-3 font-semibold">Carbon</th>
                <th className="px-5 py-3 font-semibold">Certificates</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {(accounts.data?.items ?? []).length === 0 ? (
                <EmptyRow colSpan={5} />
              ) : null}
              {(accounts.data?.items ?? []).map((item) => (
                <tr className="text-zinc-700" key={item.account}>
                  <td className="px-5 py-4 font-mono">
                    {shortAddress(item.account)}
                  </td>
                  <td className="px-5 py-4">{item.stationCount}</td>
                  <td className="px-5 py-4">{formatWei(item.totalRevenueWei)}</td>
                  <td className="px-5 py-4">
                    {formatToken(item.carbonCreditBalance, "SWC")}
                  </td>
                  <td className="px-5 py-4">
                    {Number(item.greenCertificateCount).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      </div>
    </section>
  );
}
