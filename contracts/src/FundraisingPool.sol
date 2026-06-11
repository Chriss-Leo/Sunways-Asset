// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Sunways Fundraising Pool
/// @notice ERC-20 token backed 1:1 by ETH with proportional dividend distribution.
contract FundraisingPool is ERC20, AccessControl, ReentrancyGuard {
    bytes32 public constant DIVIDEND_MANAGER_ROLE = keccak256("DIVIDEND_MANAGER_ROLE");

    /// @dev Scaling factor to avoid integer division precision loss when computing per-share dividends.
    uint256 private constant MULTIPLIER = 1 << 128;

    /// @notice Cumulative dividends per share, scaled by MULTIPLIER.
    uint256 public magnifiedDividendPerShare;

    /// @notice Cumulative ETH ever received via distributeDividends.
    uint256 public totalDividendsDistributed;

    /// @notice ETH already claimed by each account.
    mapping(address => uint256) public withdrawnDividends;

    /// @notice Correction factor per account (signed) so that transfers / mints / burns
    /// keep accumulated-dividend tracking consistent.
    mapping(address => int256) public magnifiedDividendCorrections;

    /// @notice Emitted on deposit → mint.
    event Deposited(address indexed account, uint256 amount);
    /// @notice Emitted on burn → ETH withdrawal.
    event Withdrawn(address indexed account, uint256 amount);
    /// @notice Emitted when dividends are distributed.
    event DividendsDistributed(address indexed from, uint256 amount, uint256 totalSupply);
    /// @notice Emitted when an account claims its accrued dividends.
    event DividendClaimed(address indexed account, uint256 amount);

    error InvalidAmount();
    error TransferFailed();
    error NoDividendsToClaim();
    error NoHolders();

    constructor(address admin) ERC20("Sunways Fundraising Share", "SFS") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(DIVIDEND_MANAGER_ROLE, admin);
    }

    // ---------------------------------------------------------------
    // Deposit & Mint
    // ---------------------------------------------------------------

    /// @notice Deposits ETH and receives SFS tokens 1:1.
    function deposit() external payable {
        if (msg.value == 0) revert InvalidAmount();
        _mint(msg.sender, msg.value);
        emit Deposited(msg.sender, msg.value);
    }

    // ---------------------------------------------------------------
    // Burn & Withdraw
    // ---------------------------------------------------------------

    /// @notice Burns SFS tokens and returns ETH 1:1.
    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        _burn(msg.sender, amount);
        (bool ok,) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Withdrawn(msg.sender, amount);
    }

    // ---------------------------------------------------------------
    // Dividend Distribution — O(1) pull-based
    // ---------------------------------------------------------------

    /// @notice Distributes ETH dividends. Updates the per-share accumulator so
    /// every holder's claimable amount grows proportionally to their balance.
    /// @dev O(1) — no iteration. Holders pull their share individually via claimDividend().
    function distributeDividends() external payable onlyRole(DIVIDEND_MANAGER_ROLE) {
        uint256 totalAmount = msg.value;
        if (totalAmount == 0) revert InvalidAmount();
        uint256 supply = totalSupply();
        if (supply == 0) revert NoHolders();

        magnifiedDividendPerShare += (totalAmount * MULTIPLIER) / supply;
        totalDividendsDistributed += totalAmount;

        emit DividendsDistributed(msg.sender, totalAmount, supply);
    }

    /// @notice Claims all accrued dividends for the caller.
    function claimDividend() external nonReentrant {
        uint256 withdrawable = withdrawableDividendOf(msg.sender);
        if (withdrawable == 0) revert NoDividendsToClaim();

        withdrawnDividends[msg.sender] += withdrawable;

        (bool success,) = msg.sender.call{value: withdrawable}("");
        if (!success) revert TransferFailed();

        emit DividendClaimed(msg.sender, withdrawable);
    }

    /// @notice Withdrawable dividends for an account (not yet claimed).
    function withdrawableDividendOf(address _owner) public view returns (uint256) {
        return accumulativeDividendOf(_owner) - withdrawnDividends[_owner];
    }

    /// @notice Total dividends ever accrued by an account (claimed + unclaimed).
    /// @dev Formula: (magnifiedDividendPerShare × balance + correction) / MULTIPLIER
    function accumulativeDividendOf(address _owner) public view returns (uint256) {
        int256 accumulated =
            int256(magnifiedDividendPerShare * balanceOf(_owner)) + magnifiedDividendCorrections[_owner];
        if (accumulated < 0) return 0;
        return uint256(accumulated) / MULTIPLIER;
    }

    // ---------------------------------------------------------------
    // Fallback
    // ---------------------------------------------------------------

    receive() external payable {
        if (msg.value == 0) revert InvalidAmount();
        _mint(msg.sender, msg.value);
        emit Deposited(msg.sender, msg.value);
    }

    // ---------------------------------------------------------------
    // ERC20 hook — maintain dividend corrections
    // ---------------------------------------------------------------

    /// @dev When a balance changes, adjust the correction factors so that
    /// accumulated-dividend tracking remains correct for both sides.
    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);

        // Sender locks in their accrued dividends proportional to the amount leaving.
        if (from != address(0)) {
            magnifiedDividendCorrections[from] += int256(magnifiedDividendPerShare * value);
        }

        // Receiver is credited with a negative correction so they don't claim
        // dividends that accrued before they held the tokens.
        if (to != address(0)) {
            magnifiedDividendCorrections[to] -= int256(magnifiedDividendPerShare * value);
        }
    }
}
