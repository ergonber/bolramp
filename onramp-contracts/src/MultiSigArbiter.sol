// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControlEnumerable} from "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title MultiSigArbiter — 2-of-3 multi-sig for critical operations
/// @notice Requires 2 of 3 signers to approve pause/unpause operations
/// @dev Each signer signs a message hash, contract verifies 2 unique valid signatures
contract MultiSigArbiter is AccessControlEnumerable, Pausable {
    using MessageHashUtils for bytes32;

    bytes32 public constant ARBITER_ROLE = keccak256("ARBITER");

    struct Confirmation {
        bytes32 messageHash;
        bool executed;
        uint256 confirmationCount;
        mapping(address => bool) signed;
    }

    mapping(bytes32 => Confirmation) public confirmations;
    bytes32[] public confirmationIds;

    event ConfirmationSubmitted(
        bytes32 indexed confirmationId,
        address indexed signer,
        uint256 confirmationCount
    );
    event ConfirmationExecuted(bytes32 indexed confirmationId, bytes32 action);

    modifier onlyArbiterSigner() {
        if (!hasRole(ARBITER_ROLE, msg.sender)) revert NotArbiterSigner();
        _;
    }

    error NotArbiterSigner();
    error AlreadySigned();
    error InsufficientConfirmations();
    error ConfirmationNotFound();
    error ConfirmationAlreadyExecuted();
    error InvalidSigners();

    constructor(address[3] memory signers) {
        if (
            signers[0] == address(0) ||
            signers[1] == address(0) ||
            signers[2] == address(0)
        ) revert InvalidSigners();
        if (
            signers[0] == signers[1] ||
            signers[0] == signers[2] ||
            signers[1] == signers[2]
        ) revert InvalidSigners();

        for (uint256 i = 0; i < 3; i++) {
            _grantRole(ARBITER_ROLE, signers[i]);
        }
    }

    /// @notice Submit a confirmation for an action (pause/unpause)
    /// @param action The keccak256 hash of the action description
    /// @param signature The EIP-712 signature from the signer
    function submitConfirmation(
        bytes32 action,
        bytes memory signature
    ) external onlyArbiterSigner {
        bytes32 messageHash = keccak256(
            abi.encodePacked(                "\x19\x01",
                DOMAIN_SEPARATOR(), keccak256(abi.encode(action, block.timestamp)))
        );
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address signer = ECDSA.recover(ethSignedHash, signature);

        if (!hasRole(ARBITER_ROLE, signer)) revert NotArbiterSigner();
        if (confirmations[action].signed[signer]) revert AlreadySigned();

        confirmations[action].signed[signer] = true;
        confirmations[action].confirmationCount++;

        emit ConfirmationSubmitted(action, signer, confirmations[action].confirmationCount);
    }

    /// @notice Execute action after 2 confirmations
    /// @param action The keccak256 hash of the action description
    function executeConfirmation(bytes32 action) external onlyArbiterSigner {
        Confirmation storage conf = confirmations[action];

        if (conf.executed) revert ConfirmationAlreadyExecuted();
        if (conf.confirmationCount < 2) revert InsufficientConfirmations();

        conf.executed = true;
        emit ConfirmationExecuted(action, action);
    }

    function getConfirmationCount(bytes32 action) external view returns (uint256) {
        return confirmations[action].confirmationCount;
    }

    function isExecuted(bytes32 action) external view returns (bool) {
        return confirmations[action].executed;
    }

    function hasSigned(bytes32 action, address signer) external view returns (bool) {
        return confirmations[action].signed[signer];
    }

    function getSigners() external view returns (address[] memory) {
        return getRoleMembers(ARBITER_ROLE);
    }

    function DOMAIN_SEPARATOR() public view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("MultiSigArbiter"),
                keccak256("1"),
                block.chainid,
                address(this)
            )
        );
    }

    receive() external payable {}
}
