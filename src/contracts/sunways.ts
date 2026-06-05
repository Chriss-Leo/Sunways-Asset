import type { Abi, Address } from "viem";
import localChain from "../../config/chains.local.json";

// ABI imported from contracts/abis/ — single source of truth, extracted from forge build output.
import powerStationNFTAbiJson from "../../contracts/abis/PowerStationNFT.json";
import revenueVaultAbiJson from "../../contracts/abis/RevenueVault.json";
import carbonCreditTokenAbiJson from "../../contracts/abis/CarbonCreditToken.json";
import greenCertificateAbiJson from "../../contracts/abis/GreenCertificate.json";
import fundraisingPoolAbiJson from "../../contracts/abis/FundraisingPool.json";

export type SunwaysContractName =
  | "PowerStationNFT"
  | "RevenueVault"
  | "CarbonCreditToken"
  | "GreenCertificate"
  | "FundraisingPool";

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
export const fundraisingPoolAbi = fundraisingPoolAbiJson as Abi;

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
  FundraisingPool: {
    address: sunwaysLocalDeployment.contracts.FundraisingPool,
    abi: fundraisingPoolAbi,
  },
} as const;
