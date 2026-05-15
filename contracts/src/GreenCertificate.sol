// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC1155Pausable} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Pausable.sol";
import {ERC1155Supply} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import {ERC1155URIStorage} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155URIStorage.sol";

/// @title Sunways Green Certificate
/// @notice ERC1155 certificates for renewable-energy production, claims, or compliance periods.
/// @dev Each certificate ID represents a unique station, certificate type, and period tuple.
contract GreenCertificate is ERC1155URIStorage, ERC1155Supply, ERC1155Pausable, AccessControl {
    /// @notice On-chain descriptor for a certificate class.
    struct CertificateInfo {
        uint256 stationId;
        string certificateType;
        string period;
    }

    /// @notice Role allowed to issue new certificate classes.
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    /// @notice Role allowed to pause or resume certificate transfers.
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint256 private _nextCertificateId = 1;
    mapping(uint256 certificateId => CertificateInfo info) private _certificates;

    /// @notice Emitted when a certificate class is created and minted to a recipient.
    event CertificateIssued(
        uint256 indexed certificateId,
        uint256 indexed stationId,
        address indexed account,
        uint256 amount,
        string certificateType,
        string period,
        string evidenceURI
    );

    /// @param admin Account that receives admin, issuer, and pauser roles.
    constructor(address admin) ERC1155("") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    /// @notice Issues a new ERC1155 certificate class and mints its initial supply.
    /// @param account Recipient of the issued certificates.
    /// @param stationId Source station NFT token ID.
    /// @param amount Number of certificate units to mint.
    /// @param certificateType Business category for the certificate.
    /// @param period Reporting or compliance period covered by the certificate.
    /// @param evidenceURI Metadata/evidence URI used as this certificate class URI.
    /// @return certificateId Newly assigned ERC1155 token ID.
    function issueCertificate(
        address account,
        uint256 stationId,
        uint256 amount,
        string calldata certificateType,
        string calldata period,
        string calldata evidenceURI
    ) external onlyRole(ISSUER_ROLE) returns (uint256 certificateId) {
        certificateId = _nextCertificateId++;
        _certificates[certificateId] =
            CertificateInfo({stationId: stationId, certificateType: certificateType, period: period});

        _setURI(certificateId, evidenceURI);
        _mint(account, certificateId, amount, "");

        emit CertificateIssued(certificateId, stationId, account, amount, certificateType, period, evidenceURI);
    }

    /// @notice Returns the descriptor stored for a certificate class.
    /// @param certificateId ERC1155 token ID.
    function certificate(uint256 certificateId) external view returns (CertificateInfo memory) {
        return _certificates[certificateId];
    }

    /// @notice Pauses certificate transfers.
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @notice Resumes certificate transfers after a pause.
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /// @dev Resolves URI storage support for per-ID certificate metadata.
    function uri(uint256 tokenId) public view override(ERC1155, ERC1155URIStorage) returns (string memory) {
        return super.uri(tokenId);
    }

    /// @dev Resolves supply tracking and pausable transfer hooks required by OpenZeppelin v5.
    function _update(address from, address to, uint256[] memory ids, uint256[] memory values)
        internal
        override(ERC1155, ERC1155Supply, ERC1155Pausable)
    {
        super._update(from, to, ids, values);
    }

    /// @dev Reports support for ERC1155, supply, URI storage, and access-control interfaces.
    function supportsInterface(bytes4 interfaceId) public view override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
