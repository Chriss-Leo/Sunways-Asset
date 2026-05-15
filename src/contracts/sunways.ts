import type { Abi, Address } from "viem";
import localChain from "../../config/chains.local.json";
import carbonCreditTokenAbiJson from "./CarbonCreditToken.abi.json";
import greenCertificateAbiJson from "./GreenCertificate.abi.json";
import powerStationNFTAbiJson from "./PowerStationNFT.abi.json";
import revenueVaultAbiJson from "./RevenueVault.abi.json";

export type SunwaysContractName =
  | "PowerStationNFT"
  | "RevenueVault"
  | "CarbonCreditToken"
  | "GreenCertificate";

export type SunwaysDeployment = {
  chainId: number;
  name: string;
  rpcUrl: string;
  deployer: Address;
  contracts: Record<SunwaysContractName, Address>;
};

export const sunwaysLocalDeployment = localChain as SunwaysDeployment;

export const powerStationNFTAbi = powerStationNFTAbiJson as Abi;
export const revenueVaultAbi = revenueVaultAbiJson as Abi;
export const carbonCreditTokenAbi = carbonCreditTokenAbiJson as Abi;
export const greenCertificateAbi = greenCertificateAbiJson as Abi;

export const sunwaysContracts = {
  PowerStationNFT: {
    address: sunwaysLocalDeployment.contracts.PowerStationNFT,
    abi: powerStationNFTAbi,
  },
  RevenueVault: {
    address: sunwaysLocalDeployment.contracts.RevenueVault,
    abi: revenueVaultAbi,
  },
  CarbonCreditToken: {
    address: sunwaysLocalDeployment.contracts.CarbonCreditToken,
    abi: carbonCreditTokenAbi,
  },
  GreenCertificate: {
    address: sunwaysLocalDeployment.contracts.GreenCertificate,
    abi: greenCertificateAbi,
  },
} as const;
