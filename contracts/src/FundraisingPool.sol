// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Sunways Fundraising Pool
/// @notice ERC-20 token backed 1:1 by ETH with proportional dividend distribution.
/// @dev Deposited ETH mints tokens; burning tokens returns ETH. Dividends are
/// distributed by iterating through the full holder list — intentionally simple
/// for gas-comparison baselines.
contract FundraisingPool is ERC20, AccessControl, ReentrancyGuard {
    /// @notice Role allowed to trigger dividend distributions.
    bytes32 public constant DIVIDEND_MANAGER_ROLE = keccak256("DIVIDEND_MANAGER_ROLE");

    /// @notice Snapshot of the number of unique token holders (for off-chain monitoring).
    uint256 public holderCount;

    /// @notice Cumulative ETH ever received via distributeDividends.
    uint256 public totalDividendsDistributed;

    /// @notice ETH dividends accrued but not yet claimed by each account.
    mapping(address account => uint256 amount) public claimableDividends;

    // --- Holder registry for iteration ---
    address[] private _holders;
    mapping(address => uint256) private _holderIndex; // 1-based, 0 = not in list

    /// @notice Emitted on deposit → mint.
    event Deposited(address indexed account, uint256 amount);
    /// @notice Emitted on burn → ETH withdrawal.
    event Withdrawn(address indexed account, uint256 amount);
    /// @notice Emitted after distributeDividends iterates through holders.
    event DividendsDistributed(
        address indexed distributor, uint256 totalAmount, uint256 holderCount
    );
    /// @notice Emitted when an account claims its accrued dividends.
    event DividendClaimed(address indexed account, uint256 amount);

    /// @notice Raised when deposit / withdraw / distribute amount is zero.
    error InvalidAmount();
    /// @notice Raised when native transfer back to the caller fails.
    error TransferFailed();
    /// @notice Raised when claimDividends is called with nothing accrued.
    error NoDividendsToClaim();

    /// @param admin Account that receives admin and dividend-manager roles.
    constructor(address admin) ERC20("Sunways Fundraising Share", "SFS") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(DIVIDEND_MANAGER_ROLE, admin);
    }

    // ---------------------------------------------------------------
    // Deposit & Mint
    // ---------------------------------------------------------------

    /// @notice Deposits ETH and receives SFS tokens 1:1.
    /// @dev ETH value is the token amount minted.
    function deposit() external payable {
        if (msg.value == 0) revert InvalidAmount();
        _mint(msg.sender, msg.value);
        emit Deposited(msg.sender, msg.value);
    }

    // ---------------------------------------------------------------
    // Burn & Withdraw
    // ---------------------------------------------------------------

    /// @notice Burns SFS tokens and returns ETH 1:1.
    /// @param amount Token amount to burn (also the wei amount returned).
    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        _burn(msg.sender, amount);
        (bool ok,) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Withdrawn(msg.sender, amount);
    }

    // ---------------------------------------------------------------
    // Dividend Distribution (iterates all holders)
    // ---------------------------------------------------------------

    /// @notice Distributes ETH dividends to all current token holders proportionally.
    /// @dev Iterates through every holder address — O(n). Intentionally naive so
    /// you can compare gas costs against an accumulator-based approach later.
    function distributeDividends() external payable onlyRole(DIVIDEND_MANAGER_ROLE) {
        if (msg.value == 0) revert InvalidAmount();
        uint256 supply = totalSupply();
        if (supply == 0) revert InvalidAmount();

        uint256 remaining = msg.value;
        uint256 count = _holders.length;

        for (uint256 i = 0; i < count; i++) {
            address holder = _holders[i];
            uint256 balance = balanceOf(holder);
            if (balance == 0) continue;

            uint256 share = (msg.value * balance) / supply;
            if (share == 0) continue;

            claimableDividends[holder] += share;
            remaining -= share;
        }

        // Allocate dust to the first holder with a non-zero balance.
        if (remaining > 0) {
            for (uint256 i = 0; i < count; i++) {
                address holder = _holders[i];
                if (balanceOf(holder) > 0) {
                    claimableDividends[holder] += remaining;
                    break;
                }
            }
        }

        totalDividendsDistributed += msg.value;
        emit DividendsDistributed(msg.sender, msg.value, count);
    }

    /// @notice Claims all accrued dividends for the caller.
    function claimDividends() external nonReentrant {
        uint256 amount = claimableDividends[msg.sender];
        if (amount == 0) revert NoDividendsToClaim();

        claimableDividends[msg.sender] = 0;
        (bool ok,) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit DividendClaimed(msg.sender, amount);
    }

    // ---------------------------------------------------------------
    // Holder Registry
    // ---------------------------------------------------------------

    /// @notice Returns the full holder list (for off-chain iteration / debugging).
    function allHolders() external view returns (address[] memory) {
        return _holders;
    }

    // ---------------------------------------------------------------
    // ERC20 hook — maintain holder registry
    // ---------------------------------------------------------------

    /// @dev After every mint / burn / transfer, add or remove from _holders.
    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);

        // Register the receiver if this is their first balance.
        if (to != address(0) && _holderIndex[to] == 0 && balanceOf(to) > 0) {
            _holderIndex[to] = _holders.length + 1; // 1-based
            _holders.push(to);
            holderCount = _holders.length;
        }

        // Unregister the sender if their balance dropped to zero.
        if (from != address(0) && balanceOf(from) == 0 && _holderIndex[from] != 0) {
            uint256 idx = _holderIndex[from] - 1;
            address last = _holders[_holders.length - 1];
            _holders[idx] = last;
            _holderIndex[last] = idx + 1;
            _holders.pop();
            delete _holderIndex[from];
            holderCount = _holders.length;
        }
    }
}
