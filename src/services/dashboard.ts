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
  metadataUri: string;
  txHash: string;
  blockNumber: number;
};

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
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
