// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Pausable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Pausable.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

/// @title Sunways Power Station NFT
/// @notice ERC721 registry for renewable-energy assets that back revenue and certificate flows.
/// @dev Token IDs start at 1 so a zero value can safely represent "not registered" off-chain.
contract PowerStationNFT is ERC721URIStorage, ERC721Pausable, AccessControl {
    /// @notice Lifecycle state used by operators to reflect station availability.
    enum StationStatus {
        Pending,
        Active,
        Suspended,
        Retired
    }

    /// @notice Core station metadata stored on-chain for settlement and reporting.
    struct Station {
        string name;
        string region;
        uint256 capacityKw;
        uint64 commissionedAt;
        StationStatus status;
    }

    /// @notice Role allowed to register new station NFTs.
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    /// @notice Role allowed to update operational status and metadata URIs.
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    /// @notice Role allowed to pause or resume token transfers.
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint256 private _nextStationId = 1;
    mapping(uint256 stationId => Station station) private _stations;

    /// @notice Emitted when a station NFT is minted and linked to its metadata.
    event StationRegistered(
        uint256 indexed stationId,
        address indexed owner,
        address indexed operator,
        string metadataURI,
        uint256 capacityKw
    );
    /// @notice Emitted whenever an operator changes a station lifecycle state.
    event StationStatusChanged(uint256 indexed stationId, StationStatus status);
    /// @notice Emitted whenever an operator points a station to updated off-chain metadata.
    event StationMetadataUpdated(uint256 indexed stationId, string metadataURI);

    /// @notice Raised when a station is registered to the zero address.
    error InvalidStationOwner();
    /// @notice Raised when a station has no declared generating capacity.
    error InvalidCapacity();
    /// @notice Reserved for callers that need a domain-specific unknown-station error.
    error UnknownStation();

    /// @param admin Account that receives admin, issuer, operator, and pauser roles.
    constructor(address admin) ERC721("Sunways Power Station", "SWPWR") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    /// @notice Registers a power station and mints its ownership NFT.
    /// @param owner Account that receives the newly minted station NFT.
    /// @param name Human-readable station name.
    /// @param region Operating region used by off-chain reporting.
    /// @param capacityKw Installed capacity in kilowatts.
    /// @param commissionedAt Unix timestamp for station commissioning.
    /// @param metadataURI ERC721 metadata URI, usually IPFS or HTTPS.
    /// @return stationId Newly assigned station NFT token ID.
    function registerStation(
        address owner,
        string calldata name,
        string calldata region,
        uint256 capacityKw,
        uint64 commissionedAt,
        string calldata metadataURI
    ) external onlyRole(ISSUER_ROLE) returns (uint256 stationId) {
        if (owner == address(0)) revert InvalidStationOwner();
        if (capacityKw == 0) revert InvalidCapacity();

        stationId = _nextStationId++;
        _stations[stationId] = Station({
            name: name,
            region: region,
            capacityKw: capacityKw,
            commissionedAt: commissionedAt,
            status: StationStatus.Active
        });

        _safeMint(owner, stationId);
        _setTokenURI(stationId, metadataURI);

        emit StationRegistered(stationId, owner, msg.sender, metadataURI, capacityKw);
        emit StationStatusChanged(stationId, StationStatus.Active);
    }

    /// @notice Updates the lifecycle state for an existing station.
    /// @param stationId Station NFT token ID.
    /// @param status New lifecycle state.
    function updateStationStatus(uint256 stationId, StationStatus status) external onlyRole(OPERATOR_ROLE) {
        _requireOwned(stationId);
        _stations[stationId].status = status;
        emit StationStatusChanged(stationId, status);
    }

    /// @notice Updates the token metadata URI for an existing station.
    /// @param stationId Station NFT token ID.
    /// @param metadataURI New ERC721 metadata URI.
    function updateStationURI(uint256 stationId, string calldata metadataURI) external onlyRole(OPERATOR_ROLE) {
        _requireOwned(stationId);
        _setTokenURI(stationId, metadataURI);
        emit StationMetadataUpdated(stationId, metadataURI);
    }

    /// @notice Returns the stored station metadata for a token ID.
    /// @param stationId Station NFT token ID.
    function station(uint256 stationId) external view returns (Station memory) {
        _requireOwned(stationId);
        return _stations[stationId];
    }

    /// @notice Pauses station NFT transfers while keeping administrative reads available.
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @notice Resumes station NFT transfers after a pause.
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /// @dev Resolves the ERC721 and pausable transfer hooks required by OpenZeppelin v5.
    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Pausable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    /// @dev Resolves URI storage support for ERC721 metadata.
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    /// @dev Reports support for ERC721, metadata, and access-control interfaces.
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
