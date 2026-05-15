const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export type DashboardSummary = {
  stations: number;
  totalCapacityKw: string;
  totalRevenueWei: string;
  totalCarbonAmount: string;
  totalCertificates: string;
};

export type Station = {
  stationId: number;
  owner: string;
  operator: string;
  name: string;
  region: string;
  capacityKw: string;
  commissionedAt: string | null;
  status: string;
  reviewStatus?: string;
  reviewNote?: string;
  metadataUri: string;
  txHash: string;
  blockNumber: number;
};

export type RevenueDeposit = {
  stationId: number;
  payer: string;
  beneficiary: string;
  amountWei: string;
  txHash: string;
  blockNumber: number;
  createdAt: string;
};

export type StationOperationStatus = {
  stationId: number;
  status: string;
  utilization: string;
  note: string;
  updatedBy: string;
  updatedAt: string;
};

export type RevenueClaim = {
  account: string;
  amountWei: string;
  txHash: string;
  blockNumber: number;
  createdAt: string;
};

export type CarbonCreditIssuance = {
  stationId: number;
  account: string;
  amount: string;
  evidenceUri: string;
  txHash: string;
  blockNumber: number;
  createdAt: string;
};

export type CarbonCreditRetirement = {
  account: string;
  amount: string;
  reason: string;
  txHash: string;
  blockNumber: number;
  createdAt: string;
};

export type GreenCertificateIssuance = {
  certificateId: number;
  stationId: number;
  account: string;
  amount: string;
  certificateType: string;
  period: string;
  evidenceUri: string;
  txHash: string;
  blockNumber: number;
  createdAt: string;
};

export type UserAssetSummary = {
  account: string;
  stationCount: number;
  claimableRevenueWei: string;
  totalRevenueWei: string;
  carbonCreditBalance: string;
  greenCertificateCount: string;
  updatedAt: string;
};

export type IndexerStatus = {
  chainId: number;
  name: string;
  lastIndexedBlock: number;
  lastIndexedHash?: string;
  latestKnownBlock: number;
  lagBlocks: number;
  confirmations?: number;
  failureCount: number;
  lastError?: string;
  lastStartedAt?: string | null;
  lastIndexedAt?: string | null;
  updatedAt?: string;
};

export type AdminTxResponse = {
  txHash: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      data && typeof data.error === "string"
        ? data.error
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return data as T;
}

export async function getDashboardSummary() {
  return request<DashboardSummary>("/dashboard/summary");
}

export async function getStations() {
  return request<{ items: Station[] }>("/stations");
}

export async function getStation(stationId: number) {
  return request<Station>(`/stations/${stationId}`);
}

export async function getRevenueDeposits() {
  return request<{ items: RevenueDeposit[] }>("/revenue/deposits");
}

export async function getStationOperationStatuses() {
  return request<{ items: StationOperationStatus[] }>(
    "/stations/operation-statuses",
  );
}

export async function getRevenueClaims() {
  return request<{ items: RevenueClaim[] }>("/revenue/claims");
}

export async function getCarbonIssuances() {
  return request<{ items: CarbonCreditIssuance[] }>("/carbon/issuances");
}

export async function getCarbonRetirements() {
  return request<{ items: CarbonCreditRetirement[] }>("/carbon/retirements");
}

export async function getCertificateIssuances() {
  return request<{ items: GreenCertificateIssuance[] }>(
    "/certificates/issuances",
  );
}

export async function getAccountSummaries() {
  return request<{ items: UserAssetSummary[] }>("/accounts/summaries");
}

export async function getIndexerStatus() {
  return request<IndexerStatus>("/indexer/status");
}

export async function registerStation(payload: {
  owner: string;
  name: string;
  region: string;
  capacityKw: string;
  commissionedAt: number;
  metadataUri: string;
}) {
  return request<AdminTxResponse>("/admin/stations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function depositRevenue(payload: {
  stationId: number;
  amountWei: string;
}) {
  return request<AdminTxResponse>("/admin/revenue-deposits", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function mintCarbonCredits(payload: {
  account: string;
  stationId: number;
  amount: string;
  evidenceUri: string;
}) {
  return request<AdminTxResponse>("/admin/carbon-credits", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function issueGreenCertificate(payload: {
  account: string;
  stationId: number;
  amount: string;
  certificateType: string;
  period: string;
  evidenceUri: string;
}) {
  return request<AdminTxResponse>("/admin/green-certificates", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateStationReview(
  stationId: number,
  payload: { status: string; note: string },
) {
  return request<{ status: string }>(`/admin/stations/${stationId}/review`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function updateStationOperationStatus(
  stationId: number,
  payload: {
    status: string;
    utilization: string;
    note: string;
    updatedBy: string;
  },
) {
  return request<{ status: string }>(
    `/admin/stations/${stationId}/operation-status`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}
