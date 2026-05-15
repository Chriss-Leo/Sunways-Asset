import { sunwaysContracts } from "@/contracts/sunways";

export const mockStation = {
  id: "1",
  name: "Sunways Jiangsu Solar Station 001",
  region: "Jiangsu, CN",
  owner: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  capacityKw: 5000,
  commissionedAt: "2026-04-01",
  status: "Active",
  monthlyRevenueEth: "12.48",
  carbonCredits: "18,420",
  greenCertificates: "1,280",
  utilization: "86.4%",
};

export const portfolioMetrics = [
  {
    label: "Power Stations",
    value: "1",
    detail: "5.0 MW tracked capacity",
    tone: "emerald",
  },
  {
    label: "Revenue Pool",
    value: "12.48 ETH",
    detail: "Mock monthly settlement",
    tone: "sky",
  },
  {
    label: "Carbon Credits",
    value: "18,420 SWC",
    detail: "Pending oracle attestation",
    tone: "lime",
  },
  {
    label: "Green Certificates",
    value: "1,280",
    detail: "2026-Q2 issuance batch",
    tone: "amber",
  },
] as const;

export const contractRows = [
  {
    name: "PowerStationNFT",
    purpose: "Station identity",
    standard: "ERC-721",
    address: sunwaysContracts.PowerStationNFT.address,
  },
  {
    name: "RevenueVault",
    purpose: "Revenue claim",
    standard: "Native vault",
    address: sunwaysContracts.RevenueVault.address,
  },
  {
    name: "CarbonCreditToken",
    purpose: "Carbon credit balance",
    standard: "ERC-20",
    address: sunwaysContracts.CarbonCreditToken.address,
  },
  {
    name: "GreenCertificate",
    purpose: "Green certificate batches",
    standard: "ERC-1155",
    address: sunwaysContracts.GreenCertificate.address,
  },
] as const;
