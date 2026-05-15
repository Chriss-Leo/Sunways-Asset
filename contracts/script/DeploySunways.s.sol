// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {CarbonCreditToken} from "../src/CarbonCreditToken.sol";
import {GreenCertificate} from "../src/GreenCertificate.sol";
import {PowerStationNFT} from "../src/PowerStationNFT.sol";
import {RevenueVault} from "../src/RevenueVault.sol";

/// @title Sunways Local Deployment Script
/// @notice Deploys the core station, revenue, carbon-credit, and certificate contracts.
contract DeploySunways is Script {
    /// @notice Broadcasts deployment transactions using Foundry's configured signer.
    /// @return stationNFT Power-station ownership registry.
    /// @return revenueVault Native-token revenue vault linked to the station registry.
    /// @return carbonCredit ERC20 carbon-credit token.
    /// @return greenCertificate ERC1155 green-certificate registry.
    function run()
        external
        returns (
            PowerStationNFT stationNFT,
            RevenueVault revenueVault,
            CarbonCreditToken carbonCredit,
            GreenCertificate greenCertificate
        )
    {
        vm.startBroadcast();

        // The broadcast sender owns all initial roles so local deployments are immediately operable.
        address admin = msg.sender;
        stationNFT = new PowerStationNFT(admin);
        revenueVault = new RevenueVault(admin, stationNFT);
        carbonCredit = new CarbonCreditToken(admin);
        greenCertificate = new GreenCertificate(admin);

        vm.stopBroadcast();
    }
}
