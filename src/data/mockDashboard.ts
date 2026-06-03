import { sunwaysContracts } from "@/contracts/sunways";

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
