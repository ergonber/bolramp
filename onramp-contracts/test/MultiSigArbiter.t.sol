// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {MultiSigArbiter} from "../src/MultiSigArbiter.sol";

contract MultiSigArbiterTest is Test {
    using MessageHashUtils for bytes32;

    MultiSigArbiter public multisig;

    address public signer1;
    uint256 public signer1Key;
    address public signer2;
    uint256 public signer2Key;
    address public signer3;
    uint256 public signer3Key;
    address public nonSigner;

    bytes32 public constant ACTION_PAUSE = keccak256("PAUSE");
    bytes32 public constant ACTION_UNPAUSE = keccak256("UNPAUSE");

    function setUp() public {
        signer1Key = 0xA11CE;
        signer1 = vm.addr(signer1Key);
        signer2Key = 0xB22CE;
        signer2 = vm.addr(signer2Key);
        signer3Key = 0xC33CE;
        signer3 = vm.addr(signer3Key);
        nonSigner = makeAddr("nonSigner");

        multisig = new MultiSigArbiter([signer1, signer2, signer3]);
    }

    function _signAction(uint256 privateKey, bytes32 action) internal view returns (bytes memory) {
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                "\x19\x01",
                multisig.DOMAIN_SEPARATOR(),
                keccak256(abi.encode(action, block.timestamp))
            )
        );
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, ethSignedHash);
        return abi.encodePacked(r, s, v);
    }

    function test_Constructor_SetsSigners() public {
        assertEq(multisig.getSigners().length, 3);
        assertTrue(multisig.hasRole(multisig.ARBITER_ROLE(), signer1));
        assertTrue(multisig.hasRole(multisig.ARBITER_ROLE(), signer2));
        assertTrue(multisig.hasRole(multisig.ARBITER_ROLE(), signer3));
    }

    function test_SubmitConfirmation_Success() public {
        bytes memory sig = _signAction(signer1Key, ACTION_PAUSE);
        vm.prank(signer1);
        multisig.submitConfirmation(ACTION_PAUSE, sig);

        assertEq(multisig.getConfirmationCount(ACTION_PAUSE), 1);
        assertTrue(multisig.hasSigned(ACTION_PAUSE, signer1));
    }

    function test_SubmitConfirmation_RevertNotArbiter() public {
        bytes memory sig = _signAction(signer1Key, ACTION_PAUSE);

        vm.prank(nonSigner);
        vm.expectRevert(MultiSigArbiter.NotArbiterSigner.selector);
        multisig.submitConfirmation(ACTION_PAUSE, sig);
    }

    function test_SubmitConfirmation_RevertAlreadySigned() public {
        bytes memory sig1 = _signAction(signer1Key, ACTION_PAUSE);
        vm.prank(signer1);
        multisig.submitConfirmation(ACTION_PAUSE, sig1);

        bytes memory sig1Again = _signAction(signer1Key, ACTION_PAUSE);
        vm.prank(signer1);
        vm.expectRevert(MultiSigArbiter.AlreadySigned.selector);
        multisig.submitConfirmation(ACTION_PAUSE, sig1Again);
    }

    function test_ExecuteConfirmation_Success() public {
        bytes memory sig1 = _signAction(signer1Key, ACTION_PAUSE);
        vm.prank(signer1);
        multisig.submitConfirmation(ACTION_PAUSE, sig1);

        bytes memory sig2 = _signAction(signer2Key, ACTION_PAUSE);
        vm.prank(signer2);
        multisig.submitConfirmation(ACTION_PAUSE, sig2);

        vm.prank(signer1);
        multisig.executeConfirmation(ACTION_PAUSE);

        assertTrue(multisig.isExecuted(ACTION_PAUSE));
    }

    function test_ExecuteConfirmation_RevertInsufficient() public {
        bytes memory sig1 = _signAction(signer1Key, ACTION_PAUSE);
        vm.prank(signer1);
        multisig.submitConfirmation(ACTION_PAUSE, sig1);

        vm.prank(signer1);
        vm.expectRevert(MultiSigArbiter.InsufficientConfirmations.selector);
        multisig.executeConfirmation(ACTION_PAUSE);
    }

    function test_ExecuteConfirmation_RevertAlreadyExecuted() public {
        bytes memory sig1 = _signAction(signer1Key, ACTION_PAUSE);
        vm.prank(signer1);
        multisig.submitConfirmation(ACTION_PAUSE, sig1);

        bytes memory sig2 = _signAction(signer2Key, ACTION_PAUSE);
        vm.prank(signer2);
        multisig.submitConfirmation(ACTION_PAUSE, sig2);

        vm.prank(signer1);
        multisig.executeConfirmation(ACTION_PAUSE);

        vm.prank(signer1);
        vm.expectRevert(MultiSigArbiter.ConfirmationAlreadyExecuted.selector);
        multisig.executeConfirmation(ACTION_PAUSE);
    }

    function test_AllThreeSignersCanConfirm() public {
        bytes memory sig1 = _signAction(signer1Key, ACTION_PAUSE);
        vm.prank(signer1);
        multisig.submitConfirmation(ACTION_PAUSE, sig1);

        bytes memory sig2 = _signAction(signer2Key, ACTION_PAUSE);
        vm.prank(signer2);
        multisig.submitConfirmation(ACTION_PAUSE, sig2);

        bytes memory sig3 = _signAction(signer3Key, ACTION_PAUSE);
        vm.prank(signer3);
        multisig.submitConfirmation(ACTION_PAUSE, sig3);

        assertEq(multisig.getConfirmationCount(ACTION_PAUSE), 3);
    }

    function test_DifferentActionsAreIndependent() public {
        bytes memory sig1 = _signAction(signer1Key, ACTION_PAUSE);
        vm.prank(signer1);
        multisig.submitConfirmation(ACTION_PAUSE, sig1);

        bytes memory sig2 = _signAction(signer2Key, ACTION_UNPAUSE);
        vm.prank(signer2);
        multisig.submitConfirmation(ACTION_UNPAUSE, sig2);

        assertEq(multisig.getConfirmationCount(ACTION_PAUSE), 1);
        assertEq(multisig.getConfirmationCount(ACTION_UNPAUSE), 1);
    }

    function test_RevertOnInvalidSigners() public {
        address[3] memory badSigners = [signer1, signer1, signer3]; // duplicate
        vm.expectRevert(MultiSigArbiter.InvalidSigners.selector);
        new MultiSigArbiter(badSigners);
    }
}
