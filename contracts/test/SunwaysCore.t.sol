// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CarbonCreditToken} from "../src/CarbonCreditToken.sol";
import {GreenCertificate} from "../src/GreenCertificate.sol";
import {PowerStationNFT} from "../src/PowerStationNFT.sol";
import {RevenueVault} from "../src/RevenueVault.sol";

/// @notice Integration coverage for the core Sunways asset contracts.
contract SunwaysCoreTest is Test {
    PowerStationNFT private stationNFT;
    RevenueVault private revenueVault;
    CarbonCreditToken private carbonCredit;
    GreenCertificate private greenCertificate;

    address private admin = address(0xA11CE);
    address private operator = address(0x0A);
    address private investor = address(0xB0B);
    address private buyer = address(0xCAFE);

    /// @notice Deploys fresh contracts and grants the operator role before each test.
    function setUp() public {
        vm.deal(admin, 100 ether);
        vm.startPrank(admin);
        stationNFT = new PowerStationNFT(admin);
        revenueVault = new RevenueVault(admin, stationNFT);
        carbonCredit = new CarbonCreditToken(admin);
        greenCertificate = new GreenCertificate(admin);

        stationNFT.grantRole(stationNFT.OPERATOR_ROLE(), operator);
        vm.stopPrank();
    }

    /// @notice A station registration mints an NFT and stores the expected station metadata.
    function testRegistersPowerStationNFT() public {
        vm.prank(admin);
        uint256 stationId = stationNFT.registerStation(
            investor, "Sunways Solar Station 001", "Jiangsu", 5_000, uint64(block.timestamp), "ipfs://station-001"
        );

        assertEq(stationId, 1);
        assertEq(stationNFT.ownerOf(stationId), investor);
        assertEq(stationNFT.tokenURI(stationId), "ipfs://station-001");

        PowerStationNFT.Station memory station = stationNFT.station(stationId);
        assertEq(station.name, "Sunways Solar Station 001");
        assertEq(station.region, "Jiangsu");
        assertEq(station.capacityKw, 5_000);
        assertEq(uint256(station.status), uint256(PowerStationNFT.StationStatus.Active));
    }

    /// @notice Registration is restricted to the issuer role.
    function testOnlyIssuerCanRegisterStation() public {
        vm.expectRevert();
        vm.prank(operator);
        stationNFT.registerStation(
            investor, "Unauthorized Station", "Zhejiang", 1_000, uint64(block.timestamp), "ipfs://bad"
        );
    }

    /// @notice Native revenue deposits accrue to the station NFT owner and can be claimed.
    function testDepositsAndClaimsNativeRevenue() public {
        uint256 stationId = _registerStation();

        vm.prank(admin);
        revenueVault.depositNative{value: 2 ether}(stationId);

        assertEq(revenueVault.totalDeposited(stationId), 2 ether);
        assertEq(revenueVault.claimable(investor), 2 ether);

        uint256 beforeBalance = investor.balance;
        vm.prank(investor);
        revenueVault.claim();

        assertEq(investor.balance, beforeBalance + 2 ether);
        assertEq(revenueVault.claimable(investor), 0);
    }

    /// @notice Carbon-credit issuance mints ERC20 balance tied to station evidence.
    function testMintsCarbonCreditsForStationEvidence() public {
        uint256 stationId = _registerStation();

        vm.prank(admin);
        carbonCredit.mintCarbonCredits(investor, 1_000 ether, stationId, "ipfs://carbon-audit-001");

        assertEq(carbonCredit.balanceOf(investor), 1_000 ether);
    }

    /// @notice Green-certificate issuance stores ERC1155 supply, URI, and descriptor fields.
    function testIssuesGreenCertificate() public {
        uint256 stationId = _registerStation();

        vm.prank(admin);
        uint256 certificateId = greenCertificate.issueCertificate(
            buyer, stationId, 10, "GREEN_POWER_CERTIFICATE", "2026-Q2", "ipfs://green-cert-001"
        );

        assertEq(certificateId, 1);
        assertEq(greenCertificate.balanceOf(buyer, certificateId), 10);
        assertEq(greenCertificate.totalSupply(certificateId), 10);
        assertEq(greenCertificate.uri(certificateId), "ipfs://green-cert-001");

        GreenCertificate.CertificateInfo memory certificate = greenCertificate.certificate(certificateId);
        assertEq(certificate.stationId, stationId);
        assertEq(certificate.certificateType, "GREEN_POWER_CERTIFICATE");
        assertEq(certificate.period, "2026-Q2");
    }

    /// @dev Shared fixture helper for tests that require an existing station.
    function _registerStation() private returns (uint256 stationId) {
        vm.prank(admin);
        stationId = stationNFT.registerStation(
            investor, "Sunways Solar Station 001", "Jiangsu", 5_000, uint64(block.timestamp), "ipfs://station-001"
        );
    }
}
