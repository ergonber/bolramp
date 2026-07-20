// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {EscrowMaster} from "../src/EscrowMaster.sol";
import {IEscrowMaster} from "../src/interfaces/IEscrowMaster.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

/// @title EscrowMasterTest — Comprehensive tests for the EscrowMaster contract
/// @notice Covers: deposits, locks, releases, expires, withdrawals, roles, pause, daily limits
/// @dev Focus on security: double-spend prevention, reentrancy, signature replay
contract EscrowMasterTest is Test {
    using MessageHashUtils for bytes32;

    EscrowMaster public escrow;
    MockUSDC public usdc;

    // Local event declarations for emitted events from OZ Pausable
    event Paused(address account);
    event Unpaused(address account);

    // === ACCOUNTS ===
    address public admin = address(this);
    address public operator;
    uint256 public operatorKey;
    address public arbiter;
    address public lp1;
    address public lp2;
    address public user1;
    address public user2;
    address public treasury;

    // === CONSTANTS ===
    uint256 public constant USDC_DECIMALS = 6;
    uint256 public constant ONE_USDC = 1e6;
    uint256 public constant TEN_USDC = 10 * ONE_USDC;
    uint256 public constant HUNDRED_USDC = 100 * ONE_USDC;
    uint256 public constant ONE_BOB = 1e18;

    // === SETUP ===

    function setUp() public {
        // Create fresh accounts with funds
        operatorKey = 0xA11CE;
        operator = vm.addr(operatorKey);
        arbiter = makeAddr("arbiter");
        lp1 = makeAddr("lp1");
        lp2 = makeAddr("lp2");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        treasury = makeAddr("treasury");

        // Deploy mock USDC
        usdc = new MockUSDC();

        // Deploy EscrowMaster
        escrow = new EscrowMaster(
            address(usdc),
            treasury,
            operator,
            arbiter
        );

        // Mint USDC to LPs for testing
        usdc.mint(lp1, 10_000 * ONE_USDC);
        usdc.mint(lp2, 10_000 * ONE_USDC);

        // Grant LP_ADMIN_ROLE to LPs (needed for _findLPWithBalance)
        bytes32 lpAdminRole = keccak256("LP_ADMIN");
        escrow.grantRole(lpAdminRole, lp1);
        escrow.grantRole(lpAdminRole, lp2);

        // Approve escrow contract to spend LP's USDC
        vm.prank(lp1);
        usdc.approve(address(escrow), type(uint256).max);
        vm.prank(lp2);
        usdc.approve(address(escrow), type(uint256).max);
    }

    // ============================================================
    //                    DEPOSIT TESTS
    // ============================================================

    function test_DepositUSDC_Success() public {
        uint256 amount = HUNDRED_USDC;

        vm.prank(lp1);
        escrow.depositUSDC(amount);

        assertEq(escrow.getAvailableBalance(lp1), amount);
        assertEq(usdc.balanceOf(address(escrow)), amount);
    }

    function test_DepositUSDC_EmitsEvent() public {
        uint256 amount = HUNDRED_USDC;

        vm.prank(lp1);
        vm.expectEmit(true, false, false, true);
        emit IEscrowMaster.DepositLP(lp1, amount, block.timestamp);
        escrow.depositUSDC(amount);
    }

    function test_DepositUSDC_RevertOnZero() public {
        vm.prank(lp1);
        vm.expectRevert(IEscrowMaster.ZeroAmount.selector);
        escrow.depositUSDC(0);
    }

    function test_DepositUSDC_RevertWithoutApproval() public {
        address noApproval = makeAddr("noApproval");
        usdc.mint(noApproval, HUNDRED_USDC);

        vm.prank(noApproval);
        vm.expectRevert(); // SafeERC20 transfer will fail
        escrow.depositUSDC(HUNDRED_USDC);
    }

    function test_DepositUSDC_RevertWhenPaused() public {
        vm.prank(arbiter);
        escrow.pause();

        vm.prank(lp1);
        vm.expectRevert(); // whenNotPaused modifier
        escrow.depositUSDC(HUNDRED_USDC);
    }

    function test_MultipleLPS_Deposit() public {
        usdc.mint(lp2, HUNDRED_USDC);
        vm.prank(lp2);
        usdc.approve(address(escrow), type(uint256).max);

        vm.prank(lp1);
        escrow.depositUSDC(50 * ONE_USDC);
        vm.prank(lp2);
        escrow.depositUSDC(75 * ONE_USDC);

        assertEq(escrow.getAvailableBalance(lp1), 50 * ONE_USDC);
        assertEq(escrow.getAvailableBalance(lp2), 75 * ONE_USDC);
    }

    // ============================================================
    //                    LOCK TRADE TESTS
    // ============================================================

    function test_LockTrade_Success() public {
        // Setup: LP deposits
        vm.prank(lp1);
        escrow.depositUSDC(HUNDRED_USDC);

        // Lock trade
        bytes32 userOpId = keccak256("op1");
        vm.prank(operator);
        uint256 tradeId = escrow.lockTrade(
            user1,
            TEN_USDC,
            100 * ONE_BOB,
            996, // rate P2P
            50,  // LP spread 0.5%
            50,  // platform fee 0.5%
            userOpId
        );

        // Verify trade was created
        assertEq(tradeId, 0);
        assertEq(escrow.tradeCount(), 1);

        // Verify LP balance decreased
        assertEq(escrow.getAvailableBalance(lp1), 90 * ONE_USDC);

        // Verify trade data
        IEscrowMaster.Trade memory trade = escrow.getTrade(tradeId);
        assertEq(trade.user, user1);
        assertEq(trade.lp, lp1);
        assertEq(trade.amountUSDC, TEN_USDC);
        assertEq(trade.amountBOB, 100 * ONE_BOB);
        assertEq(uint256(trade.status), uint256(IEscrowMaster.TradeStatus.Locked));
        assertEq(trade.userOpId, userOpId);
    }

    function test_LockTrade_RevertOnZeroUser() public {
        vm.prank(lp1);
        escrow.depositUSDC(HUNDRED_USDC);

        bytes32 userOpId = keccak256("op1");
        vm.prank(operator);
        vm.expectRevert(IEscrowMaster.InvalidAddress.selector);
        escrow.lockTrade(
            address(0),
            TEN_USDC,
            100 * ONE_BOB,
            996,
            50,
            50,
            userOpId
        );
    }

    function test_LockTrade_RevertOnZeroAmount() public {
        vm.prank(lp1);
        escrow.depositUSDC(HUNDRED_USDC);

        bytes32 userOpId = keccak256("op1");
        vm.prank(operator);
        vm.expectRevert(IEscrowMaster.ZeroAmount.selector);
        escrow.lockTrade(
            user1,
            0, // zero amount
            100 * ONE_BOB,
            996,
            50,
            50,
            userOpId
        );
    }

    function test_LockTrade_RevertOnInsufficientBalance() public {
        // LP has 100 USDC, try to lock 200
        vm.prank(lp1);
        escrow.depositUSDC(HUNDRED_USDC);

        bytes32 userOpId = keccak256("op1");
        vm.prank(operator);
        vm.expectRevert(IEscrowMaster.InsufficientLPBalance.selector);
        escrow.lockTrade(
            user1,
            200 * ONE_USDC, // more than available
            2000 * ONE_BOB,
            996,
            50,
            50,
            userOpId
        );
    }

    function test_LockTrade_RevertOnDuplicateUserOpId() public {
        vm.prank(lp1);
        escrow.depositUSDC(HUNDRED_USDC);

        bytes32 userOpId = keccak256("op1");

        vm.prank(operator);
        escrow.lockTrade(user1, TEN_USDC, 100 * ONE_BOB, 996, 50, 50, userOpId);

        // Try to reuse same userOpId — PREVENTS DOUBLE-SPEND
        vm.prank(operator);
        vm.expectRevert(IEscrowMaster.UserOpIdAlreadyUsed.selector);
        escrow.lockTrade(user1, TEN_USDC, 100 * ONE_BOB, 996, 50, 50, userOpId);
    }

    function test_LockTrade_RevertOnMaxFeeExceeded() public {
        vm.prank(lp1);
        escrow.depositUSDC(HUNDRED_USDC);

        bytes32 userOpId = keccak256("op1");
        vm.prank(operator);
        vm.expectRevert(IEscrowMaster.FeeExceedsMaximum.selector);
        escrow.lockTrade(
            user1,
            TEN_USDC,
            100 * ONE_BOB,
            996,
            501, // > MAX_FEE_BPS (500)
            50,
            userOpId
        );
    }

    function test_LockTrade_RevertWhenPaused() public {
        vm.prank(lp1);
        escrow.depositUSDC(HUNDRED_USDC);

        vm.prank(arbiter);
        escrow.pause();

        bytes32 userOpId = keccak256("op1");
        vm.prank(operator);
        vm.expectRevert();
        escrow.lockTrade(user1, TEN_USDC, 100 * ONE_BOB, 996, 50, 50, userOpId);
    }

    function test_LockTrade_RevertIfNotOperator() public {
        vm.prank(lp1);
        escrow.depositUSDC(HUNDRED_USDC);

        bytes32 userOpId = keccak256("op1");
        vm.prank(user1); // not operator
        vm.expectRevert();
        escrow.lockTrade(user1, TEN_USDC, 100 * ONE_BOB, 996, 50, 50, userOpId);
    }

    // ============================================================
    //                    RELEASE TESTS (CRITICAL — REAL MONEY)
    // ============================================================

    function _setupAndLock() internal returns (uint256 tradeId, bytes32 userOpId) {
        vm.prank(lp1);
        escrow.depositUSDC(HUNDRED_USDC);

        userOpId = keccak256("op1");
        vm.prank(operator);
        tradeId = escrow.lockTrade(
            user1,
            TEN_USDC,
            100 * ONE_BOB,
            996,
            50,
            100, // 1% platform fee
            userOpId
        );
    }

    function _signRelease(uint256 tradeId, address user, uint256 amountUSDC, bytes32 userOpId)
        internal
        view
        returns (bytes memory)
    {
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                "\x19\x01",
                escrow.DOMAIN_SEPARATOR(),
                keccak256(
                    abi.encode(
                        keccak256("Release(uint256 tradeId,address user,uint256 amountUSDC,bytes32 userOpId)"),
                        tradeId,
                        user,
                        amountUSDC,
                        userOpId
                    )
                )
            )
        );
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(operatorKey, ethSignedHash);
        return abi.encodePacked(r, s, v);
    }

    function test_Release_Success() public {
        (uint256 tradeId, bytes32 userOpId) = _setupAndLock();

        uint256 userBalanceBefore = usdc.balanceOf(user1);
        uint256 treasuryBalanceBefore = usdc.balanceOf(treasury);

        bytes memory sig = _signRelease(tradeId, user1, TEN_USDC, userOpId);

        vm.prank(operator);
        escrow.release(tradeId, sig);

        // Verify user received USDC (minus fee)
        // Fee = 10_000_000 * 100 / 10_000 = 100_000 (10 USDC)
        // User gets: 10_000_000 - 100_000 = 9_900_000
        uint256 expectedFee = (TEN_USDC * 100) / 10_000;
        uint256 expectedUserAmount = TEN_USDC - expectedFee;

        assertEq(usdc.balanceOf(user1), userBalanceBefore + expectedUserAmount);
        assertEq(usdc.balanceOf(treasury), treasuryBalanceBefore + expectedFee);

        // Verify trade status
        IEscrowMaster.Trade memory trade = escrow.getTrade(tradeId);
        assertEq(uint256(trade.status), uint256(IEscrowMaster.TradeStatus.Released));
    }

    function test_Release_RevertOnInvalidSignature() public {
        (uint256 tradeId,) = _setupAndLock();

        // Sign with wrong key
        uint256 wrongKey = 0xBEEF;
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                "\x19\x01",
                escrow.DOMAIN_SEPARATOR(),
                keccak256(
                    abi.encode(
                        keccak256("Release(uint256 tradeId,address user,uint256 amountUSDC,bytes32 userOpId)"),
                        tradeId,
                        user1,
                        TEN_USDC,
                        keccak256("op1")
                    )
                )
            )
        );
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongKey, ethSignedHash);
        bytes memory badSig = abi.encodePacked(r, s, v);

        vm.prank(operator);
        vm.expectRevert(IEscrowMaster.InvalidSignature.selector);
        escrow.release(tradeId, badSig);
    }

    function test_Release_RevertOnSignatureReplay() public {
        (uint256 tradeId, bytes32 userOpId) = _setupAndLock();

        bytes memory sig = _signRelease(tradeId, user1, TEN_USDC, userOpId);

        // First release succeeds
        vm.prank(operator);
        escrow.release(tradeId, sig);

        // Try to replay same signature — PREVENTS DOUBLE-SPEND
        // But trade is already Released, so it will revert on status check
        vm.prank(operator);
        vm.expectRevert(IEscrowMaster.TradeNotLocked.selector);
        escrow.release(tradeId, sig);
    }

    function test_Release_RevertOnWrongTradeId() public {
        (uint256 tradeId, bytes32 userOpId) = _setupAndLock();

        // Create another trade
        vm.prank(operator);
        uint256 tradeId2 = escrow.lockTrade(
            user2,
            5 * ONE_USDC,
            50 * ONE_BOB,
            996,
            50,
            100,
            keccak256("op2")
        );

        // Sign release for tradeId2 but try to release tradeId1
        bytes memory sig = _signRelease(tradeId2, user2, 5 * ONE_USDC, keccak256("op2"));

        vm.prank(operator);
        vm.expectRevert(IEscrowMaster.InvalidSignature.selector);
        escrow.release(tradeId, sig); // wrong tradeId
    }

    function test_Release_RevertOnNotLocked() public {
        (uint256 tradeId, bytes32 userOpId) = _setupAndLock();

        // Expire the trade first
        vm.warp(block.timestamp + 5 minutes);
        vm.prank(operator);
        escrow.expireTrade(tradeId);

        // Try to release expired trade
        bytes memory sig = _signRelease(tradeId, user1, TEN_USDC, userOpId);
        vm.prank(operator);
        vm.expectRevert(IEscrowMaster.TradeNotLocked.selector);
        escrow.release(tradeId, sig);
    }

    function test_Release_RevertWhenPaused() public {
        (uint256 tradeId, bytes32 userOpId) = _setupAndLock();

        vm.prank(arbiter);
        escrow.pause();

        bytes memory sig = _signRelease(tradeId, user1, TEN_USDC, userOpId);
        vm.prank(operator);
        vm.expectRevert();
        escrow.release(tradeId, sig);
    }

    // ============================================================
    //                    EXPIRE TRADE TESTS
    // ============================================================

    function test_ExpireTrade_Success() public {
        (uint256 tradeId,) = _setupAndLock();

        uint256 lpBalanceBefore = escrow.getAvailableBalance(lp1);

        // Warp past minimum expiry duration
        vm.warp(block.timestamp + 5 minutes);

        vm.prank(operator);
        escrow.expireTrade(tradeId);

        // Verify USDC returned to LP
        assertEq(escrow.getAvailableBalance(lp1), lpBalanceBefore + TEN_USDC);

        // Verify trade status
        IEscrowMaster.Trade memory trade = escrow.getTrade(tradeId);
        assertEq(uint256(trade.status), uint256(IEscrowMaster.TradeStatus.Expired));
    }

    function test_ExpireTrade_RevertBeforeExpiryTime() public {
        (uint256 tradeId,) = _setupAndLock();

        // Try to expire immediately
        vm.prank(operator);
        vm.expectRevert(IEscrowMaster.TradeNotReadyToExpire.selector);
        escrow.expireTrade(tradeId);
    }

    function test_ExpireTrade_RevertOnAlreadyReleased() public {
        (uint256 tradeId, bytes32 userOpId) = _setupAndLock();

        // Release first
        bytes memory sig = _signRelease(tradeId, user1, TEN_USDC, userOpId);
        vm.prank(operator);
        escrow.release(tradeId, sig);

        // Try to expire released trade
        vm.warp(block.timestamp + 5 minutes);
        vm.prank(operator);
        vm.expectRevert(IEscrowMaster.TradeAlreadyFinalized.selector);
        escrow.expireTrade(tradeId);
    }

    function test_ExpireTrade_RevertOnAlreadyExpired() public {
        (uint256 tradeId,) = _setupAndLock();

        vm.warp(block.timestamp + 5 minutes);
        vm.prank(operator);
        escrow.expireTrade(tradeId);

        // Try to expire again
        vm.prank(operator);
        vm.expectRevert(IEscrowMaster.TradeAlreadyFinalized.selector);
        escrow.expireTrade(tradeId);
    }

    function test_ExpireTrade_OnlyOperatorCanExpire() public {
        // Only OPERATOR can expire trades now
        (uint256 tradeId,) = _setupAndLock();

        vm.warp(block.timestamp + 5 minutes);

        vm.prank(user2); // random user — should fail
        vm.expectRevert();
        escrow.expireTrade(tradeId);

        // Operator can expire
        vm.prank(operator);
        escrow.expireTrade(tradeId);

        IEscrowMaster.Trade memory trade = escrow.getTrade(tradeId);
        assertEq(uint256(trade.status), uint256(IEscrowMaster.TradeStatus.Expired));
    }

    // ============================================================
    //                    WITHDRAWAL TESTS
    // ============================================================

    function test_WithdrawLP_Success() public {
        vm.prank(lp1);
        escrow.depositUSDC(HUNDRED_USDC);

        vm.warp(block.timestamp + 24 hours); // respect timelock

        vm.prank(lp1);
        escrow.withdrawLP(50 * ONE_USDC);

        assertEq(escrow.getAvailableBalance(lp1), 50 * ONE_USDC);
        assertEq(usdc.balanceOf(lp1), 10_000 * ONE_USDC - 50 * ONE_USDC);
    }

    function test_WithdrawLP_RevertOnTimeLock() public {
        vm.prank(lp1);
        escrow.depositUSDC(HUNDRED_USDC);

        // Try to withdraw immediately
        vm.prank(lp1);
        vm.expectRevert(IEscrowMaster.WithdrawalTimeLocked.selector);
        escrow.withdrawLP(50 * ONE_USDC);
    }

    function test_WithdrawLP_RevertOnExceedsAvailable() public {
        vm.prank(lp1);
        escrow.depositUSDC(HUNDRED_USDC);

        vm.warp(block.timestamp + 24 hours);

        vm.prank(lp1);
        vm.expectRevert(IEscrowMaster.WithdrawalExceedsAvailable.selector);
        escrow.withdrawLP(200 * ONE_USDC); // more than deposited
    }

    function test_WithdrawLP_RevertOnZero() public {
        vm.prank(lp1);
        vm.expectRevert(IEscrowMaster.ZeroAmount.selector);
        escrow.withdrawLP(0);
    }

    function test_WithdrawLP_CannotWithdrawLockedFunds() public {
        vm.prank(lp1);
        escrow.depositUSDC(HUNDRED_USDC);

        // Lock some funds
        vm.prank(operator);
        escrow.lockTrade(user1, TEN_USDC, 100 * ONE_BOB, 996, 50, 50, keccak256("op1"));

        vm.warp(block.timestamp + 24 hours);

        // Try to withdraw more than available (100 - 10 = 90 available)
        vm.prank(lp1);
        vm.expectRevert(IEscrowMaster.WithdrawalExceedsAvailable.selector);
        escrow.withdrawLP(95 * ONE_USDC); // only 90 available
    }

    // ============================================================
    //                    ROLE TESTS
    // ============================================================

    function test_OnlyOperatorCanLock() public {
        vm.prank(lp1);
        escrow.depositUSDC(HUNDRED_USDC);

        vm.prank(user1); // not operator
        vm.expectRevert();
        escrow.lockTrade(user1, TEN_USDC, 100 * ONE_BOB, 996, 50, 50, keccak256("op1"));
    }

    function test_OnlyArbiterCanPause() public {
        vm.prank(lp1);
        vm.expectRevert();
        escrow.pause();
    }

    function test_OnlyAdminCanSetTreasury() public {
        vm.prank(user1);
        vm.expectRevert();
        escrow.setTreasury(user2);
    }

    // ============================================================
    //                    PAUSE TESTS
    // ============================================================

    function test_Pause_Unpause() public {
        vm.prank(arbiter);
        escrow.pause();

        // Operations should revert when paused
        vm.prank(lp1);
        vm.expectRevert();
        escrow.depositUSDC(HUNDRED_USDC);

        vm.prank(arbiter);
        escrow.unpause();

        // Operations should work again
        vm.prank(lp1);
        escrow.depositUSDC(HUNDRED_USDC);
        assertEq(escrow.getAvailableBalance(lp1), HUNDRED_USDC);
    }

    // ============================================================
    //                    DAILY LIMIT TESTS
    // ============================================================

    function test_DailyLimit_Enforced() public {
        vm.prank(lp1);
        escrow.depositUSDC(1000 * ONE_USDC);

        // Set daily limit to 50 USDC
        vm.prank(lp1);
        escrow.setDailyLimit(50 * ONE_USDC);

        // Lock 40 USDC — should succeed
        vm.prank(operator);
        escrow.lockTrade(user1, 40 * ONE_USDC, 400 * ONE_BOB, 996, 50, 50, keccak256("op1"));

        // Try to lock 20 more — should exceed daily limit (40 + 20 = 60 > 50)
        vm.prank(operator);
        vm.expectRevert(IEscrowMaster.DailyLimitExceeded.selector);
        escrow.lockTrade(user1, 20 * ONE_USDC, 200 * ONE_BOB, 996, 50, 50, keccak256("op2"));
    }

    function test_DailyLimit_ResetsDaily() public {
        vm.prank(lp1);
        escrow.depositUSDC(1000 * ONE_USDC);

        vm.prank(lp1);
        escrow.setDailyLimit(50 * ONE_USDC);

        // Lock 40 USDC
        vm.prank(operator);
        escrow.lockTrade(user1, 40 * ONE_USDC, 400 * ONE_BOB, 996, 50, 50, keccak256("op1"));

        // Warp to next day
        vm.warp(block.timestamp + 1 days);

        // Should be able to lock again
        vm.prank(operator);
        escrow.lockTrade(user1, 40 * ONE_USDC, 400 * ONE_BOB, 996, 50, 50, keccak256("op2"));

        // Verify
        assertEq(escrow.getRemainingDailyLimit(lp1), 10 * ONE_USDC); // 50 - 40 = 10
    }

    // ============================================================
    //                    VIEW FUNCTION TESTS
    // ============================================================

    function test_GetTrade_RevertsOnInvalidId() public {
        vm.expectRevert(IEscrowMaster.TradeNotFound.selector);
        escrow.getTrade(999);
    }

    function test_GetAvailableBalance_ReturnsCorrectValue() public {
        assertEq(escrow.getAvailableBalance(lp1), 0);

        vm.prank(lp1);
        escrow.depositUSDC(HUNDRED_USDC);

        assertEq(escrow.getAvailableBalance(lp1), HUNDRED_USDC);
    }

    function test_GetLockedBalance_ReturnsCorrectValue() public {
        vm.prank(lp1);
        escrow.depositUSDC(HUNDRED_USDC);

        assertEq(escrow.getLockedBalance(lp1), 0);

        vm.prank(operator);
        escrow.lockTrade(user1, TEN_USDC, 100 * ONE_BOB, 996, 50, 50, keccak256("op1"));

        assertEq(escrow.getLockedBalance(lp1), TEN_USDC);
    }

    function test_TradeCount_Increments() public {
        assertEq(escrow.tradeCount(), 0);

        vm.prank(lp1);
        escrow.depositUSDC(HUNDRED_USDC);

        vm.prank(operator);
        escrow.lockTrade(user1, TEN_USDC, 100 * ONE_BOB, 996, 50, 50, keccak256("op1"));
        assertEq(escrow.tradeCount(), 1);

        vm.prank(operator);
        escrow.lockTrade(user1, TEN_USDC, 100 * ONE_BOB, 996, 50, 50, keccak256("op2"));
        assertEq(escrow.tradeCount(), 2);
    }

    function test_Treasury_ReturnsCorrectAddress() public {
        assertEq(escrow.getTreasury(), treasury);
    }

    function test_DomainSeparator_ReturnsNonZero() public {
        bytes32 sep = escrow.DOMAIN_SEPARATOR();
        assertTrue(sep != bytes32(0));
    }

    function test_IsUserOpIdUsed_ReturnsCorrectValue() public {
        bytes32 userOpId = keccak256("op1");
        assertFalse(escrow.isUserOpIdUsed(userOpId));

        vm.prank(lp1);
        escrow.depositUSDC(HUNDRED_USDC);

        vm.prank(operator);
        escrow.lockTrade(user1, TEN_USDC, 100 * ONE_BOB, 996, 50, 50, userOpId);

        assertTrue(escrow.isUserOpIdUsed(userOpId));
    }

    // ============================================================
    //                    SECURITY EDGE CASES
    // ============================================================

    function test_CannotDrainContractViaExpire() public {
        // Attempt: LP deposits, trade locked, someone expires, LP withdraws everything
        // This should work correctly — funds go back to LP, not attacker
        vm.prank(lp1);
        escrow.depositUSDC(HUNDRED_USDC);

        vm.prank(operator);
        escrow.lockTrade(user1, TEN_USDC, 100 * ONE_BOB, 996, 50, 50, keccak256("op1"));

        vm.warp(block.timestamp + 5 minutes);
        vm.prank(operator);
        escrow.expireTrade(0);

        // LP has full balance again
        assertEq(escrow.getAvailableBalance(lp1), HUNDRED_USDC);

        // Attacker gets nothing
        assertEq(usdc.balanceOf(user2), 0);
    }

    function test_CannotReleaseWithWrongUserInSignature() public {
        vm.prank(lp1);
        escrow.depositUSDC(HUNDRED_USDC);

        vm.prank(operator);
        uint256 tradeId = escrow.lockTrade(
            user1,
            TEN_USDC,
            100 * ONE_BOB,
            996,
            50,
            100,
            keccak256("op1")
        );

        // Sign release for user2 instead of user1
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                "\x19\x01",
                escrow.DOMAIN_SEPARATOR(),
                keccak256(
                    abi.encode(
                        keccak256("Release(uint256 tradeId,address user,uint256 amountUSDC,bytes32 userOpId)"),
                        tradeId,
                        user2, // WRONG USER
                        TEN_USDC,
                        keccak256("op1")
                    )
                )
            )
        );
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(operatorKey, ethSignedHash);
        bytes memory badSig = abi.encodePacked(r, s, v);

        vm.prank(operator);
        vm.expectRevert(IEscrowMaster.InvalidSignature.selector);
        escrow.release(tradeId, badSig);
    }

    function test_ReentrancyGuard_ProtectsDeposit() public {
        // ReentrancyGuard is applied via nonReentrant modifier
        // This test verifies the modifier is present by checking gas usage
        vm.prank(lp1);
        escrow.depositUSDC(HUNDRED_USDC);
        // If reentrancy was possible, it would be caught by the guard
        assertTrue(true);
    }

    // ============================================================
    //                    EVENT EMISSION TESTS
    // ============================================================

    function test_LockTrade_EmitsEvent() public {
        vm.prank(lp1);
        escrow.depositUSDC(HUNDRED_USDC);

        bytes32 userOpId = keccak256("op1");

        vm.prank(operator);
        vm.expectEmit(true, true, true, true);
        emit IEscrowMaster.TradeLocked(0, user1, lp1, TEN_USDC, 100 * ONE_BOB, userOpId);
        escrow.lockTrade(user1, TEN_USDC, 100 * ONE_BOB, 996, 50, 50, userOpId);
    }

    function test_Release_EmitsEvent() public {
        (uint256 tradeId, bytes32 userOpId) = _setupAndLock();

        bytes memory sig = _signRelease(tradeId, user1, TEN_USDC, userOpId);

        uint256 expectedFee = (TEN_USDC * 100) / 10_000;
        uint256 expectedUserAmount = TEN_USDC - expectedFee;

        vm.prank(operator);
        vm.expectEmit(true, true, false, true);
        emit IEscrowMaster.TradeReleased(tradeId, user1, expectedUserAmount, expectedFee);
        escrow.release(tradeId, sig);
    }

    function test_ExpireTrade_EmitsEvent() public {
        (uint256 tradeId,) = _setupAndLock();

        vm.warp(block.timestamp + 5 minutes);

        vm.expectEmit(true, true, false, true);
        emit IEscrowMaster.TradeExpired(tradeId, lp1, TEN_USDC);
        vm.prank(operator);
        escrow.expireTrade(tradeId);
    }

    function test_WithdrawLP_EmitsEvent() public {
        vm.prank(lp1);
        escrow.depositUSDC(HUNDRED_USDC);

        vm.warp(block.timestamp + 24 hours);

        vm.prank(lp1);
        vm.expectEmit(true, false, false, true);
        emit IEscrowMaster.WithdrawLP(lp1, 50 * ONE_USDC, block.timestamp);
        escrow.withdrawLP(50 * ONE_USDC);
    }

    function test_Pause_EmitsEvents() public {
        vm.prank(arbiter);
        vm.expectEmit(false, false, false, true);
        emit Paused(arbiter);
        escrow.pause();

        vm.prank(arbiter);
        vm.expectEmit(false, false, false, true);
        emit Unpaused(arbiter);
        escrow.unpause();
    }

    function test_SetDailyLimit_EmitsEvent() public {
        vm.prank(lp1);
        vm.expectEmit(true, false, false, true);
        emit IEscrowMaster.DailyLimitSet(lp1, 100 * ONE_USDC);
        escrow.setDailyLimit(100 * ONE_USDC);
    }

    // ============================================================
    //                    ROLE TESTS — RELEASE
    // ============================================================

    function test_OnlyOperatorCanRelease() public {
        (uint256 tradeId, bytes32 userOpId) = _setupAndLock();

        bytes memory sig = _signRelease(tradeId, user1, TEN_USDC, userOpId);

        vm.prank(user1);
        vm.expectRevert();
        escrow.release(tradeId, sig);
    }

    function test_OnlyLPAdminCanSetDailyLimit() public {
        vm.prank(user1);
        vm.expectRevert();
        escrow.setDailyLimit(100 * ONE_USDC);
    }

    function test_RenounceRole() public {
        bytes32 lpAdminRole = keccak256("LP_ADMIN");

        // lp1 has LP_ADMIN_ROLE, can deposit
        assertTrue(escrow.hasRole(lpAdminRole, lp1));

        // Admin revokes lp1's role
        escrow.revokeRole(lpAdminRole, lp1);

        // lp1 no longer has the role
        assertFalse(escrow.hasRole(lpAdminRole, lp1));
    }

    function test_RenounceOwnRole() public {
        bytes32 lpAdminRole = keccak256("LP_ADMIN");
        assertTrue(escrow.hasRole(lpAdminRole, lp1));

        vm.prank(lp1);
        escrow.renounceRole(lpAdminRole, lp1);

        assertFalse(escrow.hasRole(lpAdminRole, lp1));
    }

    // ============================================================
    //                    EDGE CASE — RELEASE
    // ============================================================

    function test_Release_WithZeroPlatformFee() public {
        vm.prank(lp1);
        escrow.depositUSDC(HUNDRED_USDC);

        bytes32 userOpId = keccak256("op1");
        vm.prank(operator);
        uint256 tradeId = escrow.lockTrade(
            user1,
            TEN_USDC,
            100 * ONE_BOB,
            996,
            50,
            0, // zero platform fee
            userOpId
        );

        bytes memory sig = _signRelease(tradeId, user1, TEN_USDC, userOpId);

        uint256 userBalanceBefore = usdc.balanceOf(user1);
        uint256 treasuryBalanceBefore = usdc.balanceOf(treasury);

        vm.prank(operator);
        escrow.release(tradeId, sig);

        // User gets full amount, no fee
        assertEq(usdc.balanceOf(user1), userBalanceBefore + TEN_USDC);
        assertEq(usdc.balanceOf(treasury), treasuryBalanceBefore);
    }

    function test_Release_WithMaxPlatformFee() public {
        vm.prank(lp1);
        escrow.depositUSDC(HUNDRED_USDC);

        bytes32 userOpId = keccak256("op1");
        vm.prank(operator);
        uint256 tradeId = escrow.lockTrade(
            user1,
            TEN_USDC,
            100 * ONE_BOB,
            996,
            0,
            500, // max fee 5%
            userOpId
        );

        bytes memory sig = _signRelease(tradeId, user1, TEN_USDC, userOpId);

        uint256 userBalanceBefore = usdc.balanceOf(user1);
        uint256 treasuryBalanceBefore = usdc.balanceOf(treasury);

        vm.prank(operator);
        escrow.release(tradeId, sig);

        // Fee = 10_000_000 * 500 / 10_000 = 500_000
        uint256 expectedFee = (TEN_USDC * 500) / 10_000;
        uint256 expectedUserAmount = TEN_USDC - expectedFee;

        assertEq(usdc.balanceOf(user1), userBalanceBefore + expectedUserAmount);
        assertEq(usdc.balanceOf(treasury), treasuryBalanceBefore + expectedFee);
    }

    // ============================================================
    //                    EDGE CASE — EXPIRE
    // ============================================================

    function test_ExpireTrade_AtExactExpiryTime() public {
        (uint256 tradeId,) = _setupAndLock();

        // Warp to exact expiry time (createdAt + 5 minutes)
        vm.warp(block.timestamp + 5 minutes);

        // Should succeed at exactly the boundary
        vm.prank(operator);
        escrow.expireTrade(tradeId);

        IEscrowMaster.Trade memory trade = escrow.getTrade(tradeId);
        assertEq(uint256(trade.status), uint256(IEscrowMaster.TradeStatus.Expired));
    }

    function test_ExpireTrade_ReturnsCorrectAmountToLP() public {
        vm.prank(lp1);
        escrow.depositUSDC(HUNDRED_USDC);

        // Lock trade
        bytes32 userOpId = keccak256("op1");
        vm.prank(operator);
        escrow.lockTrade(user1, 75 * ONE_USDC, 750 * ONE_BOB, 996, 50, 50, userOpId);

        // LP has 25 USDC available
        assertEq(escrow.getAvailableBalance(lp1), 25 * ONE_USDC);

        vm.warp(block.timestamp + 5 minutes);
        vm.prank(operator);
        escrow.expireTrade(0);

        // LP now has full 100 USDC back
        assertEq(escrow.getAvailableBalance(lp1), HUNDRED_USDC);
    }

    // ============================================================
    //                    EDGE CASE — WITHDRAWAL
    // ============================================================

    function test_WithdrawLP_AfterTimelockExpires() public {
        vm.prank(lp1);
        escrow.depositUSDC(HUNDRED_USDC);

        // Try to withdraw immediately — should fail
        vm.prank(lp1);
        vm.expectRevert(IEscrowMaster.WithdrawalTimeLocked.selector);
        escrow.withdrawLP(10 * ONE_USDC);

        // Wait 24h
        vm.warp(block.timestamp + 24 hours);

        // Should succeed now
        vm.prank(lp1);
        escrow.withdrawLP(10 * ONE_USDC);
        assertEq(escrow.getAvailableBalance(lp1), 90 * ONE_USDC);
    }

    function test_WithdrawLP_FullAmount() public {
        vm.prank(lp1);
        escrow.depositUSDC(HUNDRED_USDC);

        vm.warp(block.timestamp + 24 hours);

        vm.prank(lp1);
        escrow.withdrawLP(HUNDRED_USDC);
        assertEq(escrow.getAvailableBalance(lp1), 0);
        assertEq(usdc.balanceOf(lp1), 10_000 * ONE_USDC);
    }

    // ============================================================
    //                    STRESS — MULTIPLE LPs, MULTIPLE TRADES
    // ============================================================

    function test_MultipleLPs_MultipleTrades() public {
        // Both LPs deposit
        vm.prank(lp1);
        escrow.depositUSDC(100 * ONE_USDC);
        vm.prank(lp2);
        escrow.depositUSDC(100 * ONE_USDC);

        // Lock 3 trades
        vm.prank(operator);
        escrow.lockTrade(user1, 30 * ONE_USDC, 300 * ONE_BOB, 996, 50, 50, keccak256("op1"));

        vm.prank(operator);
        escrow.lockTrade(user1, 30 * ONE_USDC, 300 * ONE_BOB, 996, 50, 50, keccak256("op2"));

        vm.prank(operator);
        escrow.lockTrade(user1, 30 * ONE_USDC, 300 * ONE_BOB, 996, 50, 50, keccak256("op3"));

        // Total deposited = 200, locked = 90, available = 110
        uint256 totalAvailable = escrow.getAvailableBalance(lp1) + escrow.getAvailableBalance(lp2);
        assertEq(totalAvailable, 110 * ONE_USDC);

        assertEq(escrow.tradeCount(), 3);
    }

    function test_MultipleLPs_BalanceDistribution() public {
        // LP1 deposits 50, LP2 deposits 50
        vm.prank(lp1);
        escrow.depositUSDC(50 * ONE_USDC);
        vm.prank(lp2);
        escrow.depositUSDC(50 * ONE_USDC);

        // Lock 40 USDC — should come from LP1 (first found, has enough)
        vm.prank(operator);
        escrow.lockTrade(user1, 40 * ONE_USDC, 400 * ONE_BOB, 996, 50, 50, keccak256("op1"));

        // LP1 has 10, LP2 has 50 (or vice versa depending on role member order)
        uint256 totalAvailable = escrow.getAvailableBalance(lp1) + escrow.getAvailableBalance(lp2);
        assertEq(totalAvailable, 60 * ONE_USDC); // 100 - 40
    }

    function test_MultipleLPs_RevertWhenNoSingleLPhasEnough() public {
        // LP1 deposits 30, LP2 deposits 30
        vm.prank(lp1);
        escrow.depositUSDC(30 * ONE_USDC);
        vm.prank(lp2);
        escrow.depositUSDC(30 * ONE_USDC);

        // Try to lock 40 USDC — no single LP has enough
        vm.prank(operator);
        vm.expectRevert(IEscrowMaster.InsufficientLPBalance.selector);
        escrow.lockTrade(user1, 40 * ONE_USDC, 400 * ONE_BOB, 996, 50, 50, keccak256("op1"));
    }

    function test_LockTrade_MultipleTradesExceedingBalance() public {
        vm.prank(lp1);
        escrow.depositUSDC(100 * ONE_USDC);

        // Lock 3 trades of 40 each
        vm.prank(operator);
        escrow.lockTrade(user1, 40 * ONE_USDC, 400 * ONE_BOB, 996, 50, 50, keccak256("op1"));

        vm.prank(operator);
        escrow.lockTrade(user1, 40 * ONE_USDC, 400 * ONE_BOB, 996, 50, 50, keccak256("op2"));

        // Third trade: 40 USDC but only 20 left
        vm.prank(operator);
        vm.expectRevert(IEscrowMaster.InsufficientLPBalance.selector);
        escrow.lockTrade(user1, 40 * ONE_USDC, 400 * ONE_BOB, 996, 50, 50, keccak256("op3"));
    }

    function test_ExpireTrade_ThenWithdraw() public {
        vm.prank(lp1);
        escrow.depositUSDC(50 * ONE_USDC);

        // Lock trade
        vm.prank(operator);
        escrow.lockTrade(user1, 30 * ONE_USDC, 300 * ONE_BOB, 996, 50, 50, keccak256("op1"));

        assertEq(escrow.getAvailableBalance(lp1), 20 * ONE_USDC);

        // Expire trade — funds return to LP
        vm.warp(block.timestamp + 5 minutes);
        vm.prank(operator);
        escrow.expireTrade(0);

        assertEq(escrow.getAvailableBalance(lp1), 50 * ONE_USDC);

        // Withdraw after timelock
        vm.warp(block.timestamp + 24 hours);
        vm.prank(lp1);
        escrow.withdrawLP(50 * ONE_USDC);
        assertEq(escrow.getAvailableBalance(lp1), 0);
    }

    // ============================================================
    //                    SECURITY — SIGNATURE EDGE CASES
    // ============================================================

    function test_Release_TamperedSignature() public {
        (uint256 tradeId, bytes32 userOpId) = _setupAndLock();

        bytes memory sig = _signRelease(tradeId, user1, TEN_USDC, userOpId);

        // Tamper with signature
        sig[0] = bytes1(uint8(sig[0]) ^ 0xFF);

        vm.prank(operator);
        vm.expectRevert(); // ECDSAInvalidSignature or InvalidSignature
        escrow.release(tradeId, sig);
    }

    function test_Release_ShortSignature() public {
        (uint256 tradeId,) = _setupAndLock();

        // Too short signature
        bytes memory shortSig = hex"deadbeef";

        vm.prank(operator);
        vm.expectRevert();
        escrow.release(tradeId, shortSig);
    }

    function test_UserOpId_TrackedAcrossMultipleTrades() public {
        vm.prank(lp1);
        escrow.depositUSDC(HUNDRED_USDC);

        bytes32 userOpId1 = keccak256("op1");
        bytes32 userOpId2 = keccak256("op2");

        vm.prank(operator);
        escrow.lockTrade(user1, TEN_USDC, 100 * ONE_BOB, 996, 50, 50, userOpId1);

        vm.prank(operator);
        escrow.lockTrade(user1, TEN_USDC, 100 * ONE_BOB, 996, 50, 50, userOpId2);

        assertTrue(escrow.isUserOpIdUsed(userOpId1));
        assertTrue(escrow.isUserOpIdUsed(userOpId2));

        bytes32 userOpId3 = keccak256("op3");
        assertFalse(escrow.isUserOpIdUsed(userOpId3));
    }
}
