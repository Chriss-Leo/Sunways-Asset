// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Pausable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";

/// @title Sunways Carbon Credit Token
/// @notice ERC20 token representing carbon credits issued from verified station evidence.
/// @dev Credits are mintable by authorized issuers and burnable by holders for retirement flows.
contract CarbonCreditToken is ERC20, ERC20Burnable, ERC20Pausable, AccessControl {
    /// @notice Role allowed to mint new carbon credits.
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    /// @notice Role allowed to pause or resume token transfers.
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @notice Emitted when audited evidence results in new carbon-credit issuance.
    event CarbonCreditsMinted(address indexed account, uint256 amount, uint256 indexed stationId, string evidenceURI);

    /// @param admin Account that receives admin, minter, and pauser roles.
    constructor(address admin) ERC20("Sunways Carbon Credit", "SWC") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    /// @notice Mints carbon credits for a station-backed evidence record.
    /// @param account Recipient account.
    /// @param amount Amount of ERC20 units to mint.
    /// @param stationId Source station NFT token ID.
    /// @param evidenceURI URI for the audit or registry evidence that supports issuance.
    function mintCarbonCredits(address account, uint256 amount, uint256 stationId, string calldata evidenceURI)
        external
        onlyRole(MINTER_ROLE)
    {
        _mint(account, amount);
        emit CarbonCreditsMinted(account, amount, stationId, evidenceURI);
    }

    /// @notice Pauses all token transfers, mints, and burns guarded by ERC20Pausable.
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @notice Resumes token transfers, mints, and burns after a pause.
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /// @dev Resolves ERC20 and pausable update hooks required by OpenZeppelin v5.
    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Pausable) {
        super._update(from, to, value);
    }
}
