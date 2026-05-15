// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Sunways Revenue Vault
/// @notice Holds native-token operating revenue and lets power-station NFT owners claim their share.
/// @dev Revenue is attributed to the current owner of the station NFT at deposit time.
contract RevenueVault is AccessControl, ReentrancyGuard {
    /// @notice Role allowed to deposit station revenue on behalf of the settlement system.
    bytes32 public constant REVENUE_MANAGER_ROLE = keccak256("REVENUE_MANAGER_ROLE");

    /// @notice ERC721 registry that identifies power-station ownership.
    IERC721 public immutable stationNFT;

    /// @notice Total native-token revenue ever deposited for each station.
    mapping(uint256 stationId => uint256 amount) public totalDeposited;
    /// @notice Reserved for station-level accounting of claimed revenue.
    mapping(uint256 stationId => uint256 amount) public totalClaimed;
    /// @notice Native-token balance each account can currently withdraw.
    mapping(address account => uint256 amount) public claimable;

    /// @notice Emitted when revenue is assigned to the current owner of a station NFT.
    event RevenueDeposited(
        uint256 indexed stationId, address indexed payer, address indexed beneficiary, uint256 amount
    );
    /// @notice Emitted after an account successfully withdraws its claimable revenue.
    event RevenueClaimed(address indexed account, uint256 amount);

    /// @notice Raised when a deposit or claim has no value to process.
    error InvalidAmount();
    /// @notice Raised when forwarding native tokens to the claimant fails.
    error TransferFailed();

    /// @param admin Account that receives admin and revenue-manager roles.
    /// @param stationNFT_ Power-station NFT contract used to resolve revenue beneficiaries.
    constructor(address admin, IERC721 stationNFT_) {
        stationNFT = stationNFT_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REVENUE_MANAGER_ROLE, admin);
    }

    /// @notice Deposits native-token revenue for a station and credits its current NFT owner.
    /// @param stationId Station NFT token ID that receives the revenue attribution.
    function depositNative(uint256 stationId) external payable onlyRole(REVENUE_MANAGER_ROLE) {
        if (msg.value == 0) revert InvalidAmount();

        address beneficiary = stationNFT.ownerOf(stationId);
        claimable[beneficiary] += msg.value;
        totalDeposited[stationId] += msg.value;

        emit RevenueDeposited(stationId, msg.sender, beneficiary, msg.value);
    }

    /// @notice Withdraws all revenue currently claimable by the caller.
    /// @dev Uses checks-effects-interactions and ReentrancyGuard because it forwards native tokens.
    function claim() external nonReentrant {
        uint256 amount = claimable[msg.sender];
        if (amount == 0) revert InvalidAmount();

        claimable[msg.sender] = 0;
        (bool ok,) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit RevenueClaimed(msg.sender, amount);
    }
}
