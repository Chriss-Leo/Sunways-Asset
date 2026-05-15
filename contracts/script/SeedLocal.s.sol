// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {CarbonCreditToken} from "../src/CarbonCreditToken.sol";
import {GreenCertificate} from "../src/GreenCertificate.sol";
import {PowerStationNFT} from "../src/PowerStationNFT.sol";
import {RevenueVault} from "../src/RevenueVault.sol";

contract SeedLocal is Script {
    address private constant DEFAULT_POWER_STATION_NFT = 0x8464135c8F25Da09e49BC8782676a84730C318bC;
    address private constant DEFAULT_REVENUE_VAULT = 0x71C95911E9a5D330f4D621842EC243EE1343292e;
    address private constant DEFAULT_CARBON_CREDIT_TOKEN = 0x948B3c65b89DF0B4894ABE91E6D02FE579834F8F;
    address private constant DEFAULT_GREEN_CERTIFICATE = 0x712516e61C8B383dF4A63CFe83d7701Bce54B03e;

    function run() external {
        PowerStationNFT stationNFT = PowerStationNFT(vm.envOr("POWER_STATION_NFT", DEFAULT_POWER_STATION_NFT));
        RevenueVault revenueVault = RevenueVault(vm.envOr("REVENUE_VAULT", DEFAULT_REVENUE_VAULT));
        CarbonCreditToken carbonCredit = CarbonCreditToken(vm.envOr("CARBON_CREDIT_TOKEN", DEFAULT_CARBON_CREDIT_TOKEN));
        GreenCertificate greenCertificate = GreenCertificate(vm.envOr("GREEN_CERTIFICATE", DEFAULT_GREEN_CERTIFICATE));

        uint256 stationId = vm.envOr("SEED_STATION_ID", uint256(1));
        address stationOwner = vm.envOr("SEED_STATION_OWNER", msg.sender);
        string memory stationName = vm.envOr("SEED_STATION_NAME", string("Sunways Jiangsu Solar Station 001"));
        string memory stationRegion = vm.envOr("SEED_STATION_REGION", string("Jiangsu, CN"));
        uint256 capacityKw = vm.envOr("SEED_CAPACITY_KW", uint256(5_000));
        uint64 commissionedAt = uint64(vm.envOr("SEED_COMMISSIONED_AT", uint256(1_775_171_200)));
        string memory stationURI = vm.envOr("SEED_STATION_URI", string("ipfs://sunways/stations/jiangsu-001.json"));
        uint256 revenueAmount = vm.envOr("SEED_REVENUE_WEI", uint256(12.48 ether));
        uint256 carbonAmount = vm.envOr("SEED_CARBON_AMOUNT", uint256(18_420 ether));
        uint256 certificateAmount = vm.envOr("SEED_CERTIFICATE_AMOUNT", uint256(1_280));
        string memory certificatePeriod = vm.envOr("SEED_CERTIFICATE_PERIOD", string("2026-Q2"));

        vm.startBroadcast();

        if (!_stationExists(stationNFT, stationId)) {
            uint256 createdId = stationNFT.registerStation(
                stationOwner, stationName, stationRegion, capacityKw, commissionedAt, stationURI
            );
            stationId = createdId;
            console2.log("Registered station", createdId);
        } else {
            console2.log("Station already exists", stationId);
        }

        revenueVault.depositNative{value: revenueAmount}(stationId);
        carbonCredit.mintCarbonCredits(
            stationOwner, carbonAmount, stationId, "ipfs://sunways/carbon/jiangsu-001-q2.json"
        );
        uint256 certificateId = greenCertificate.issueCertificate(
            stationOwner,
            stationId,
            certificateAmount,
            "GREEN_POWER_CERTIFICATE",
            certificatePeriod,
            "ipfs://sunways/certificates/green-power-jiangsu-001-q2.json"
        );

        vm.stopBroadcast();

        console2.log("Seed station owner", stationOwner);
        console2.log("Revenue deposited wei", revenueAmount);
        console2.log("Carbon credits minted", carbonAmount);
        console2.log("Green certificate id", certificateId);
        console2.log("Green certificates minted", certificateAmount);
    }

    function _stationExists(PowerStationNFT stationNFT, uint256 stationId) private view returns (bool) {
        try stationNFT.ownerOf(stationId) returns (address owner) {
            return owner != address(0);
        } catch {
            return false;
        }
    }
}
