// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControlEnumerable} from "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {IEscrowMaster} from "./interfaces/IEscrowMaster.sol";

/// @title EscrowMaster — Non-custodial onramp escrow for BOB→USDC on Polygon
/// @author Onramp Team
/// @notice Locks LP's USDC when a QR is generated, releases to user on payment confirmation.
///         Uses EIP-712 signatures from the OPERATOR to authorize releases.
/// @dev Security features:
///   - ReentrancyGuard on all state-changing external functions
///   - Per-trade allocation (USDC locked per trade, never pooled)
///   - EIP-712 typed structured data for operator signatures
///   - Idempotency via userOpId (prevents double-spend)
///   - Time-lock 24h for LP withdrawals
///   - Daily exposure limit per LP
///   - Pausable emergency stop
///   - SafeERC20 for all USDC transfers
///   - AccessControlEnumerable for role-based permissions with enumeration
contract EscrowMaster is
    IEscrowMaster,
    AccessControlEnumerable,
    ReentrancyGuard,
    Pausable,
    EIP712
{
    using SafeERC20 for IERC20;
    using MessageHashUtils for bytes32;

    // ============================================================
    //                       ROLE CONSTANTS
    // ============================================================

    bytes32 public constant LP_ADMIN_ROLE = keccak256("LP_ADMIN");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR");
    bytes32 public constant ARBITER_ROLE = keccak256("ARBITER");

    // ============================================================
    //                       STATE VARIABLES
    // ============================================================

    /// @notice The USDC token address
    IERC20 public immutable usdc;

    /// @notice Treasury address that receives platform fees
    address public treasury;

    /// @notice Maximum platform fee allowed (500 = 5%)
    uint256 public constant MAX_FEE_BPS = 500;

    /// @notice Time-lock period for LP withdrawals (24 hours)
    uint256 public constant TIMELOCK_DURATION = 24 hours;

    /// @notice Minimum trade expiration time (5 minutes)
    uint256 public constant MIN_EXPIRY_DURATION = 5 minutes;

    /// @notice Total number of trades created
    uint256 private _tradeCount;

    /// @notice Mapping from trade ID to trade data
    mapping(uint256 => Trade) private _trades;

    /// @notice Mapping from LP address to available balance
    mapping(address => uint256) private _lpBalances;

    /// @notice Mapping from LP address to total deposited
    mapping(address => uint256) private _lpTotalDeposited;

    /// @notice Mapping from LP address to daily limit
    mapping(address => uint256) private _lpDailyLimits;

    /// @notice Mapping from LP address to locked balance
    mapping(address => uint256) private _lpLockedBalances;

    /// @notice Mapping from LP address to daily volume used
    mapping(address => uint256) private _lpDailyVolume;

    /// @notice Mapping from LP address to daily volume reset timestamp
    mapping(address => uint256) private _lpDailyReset;

    /// @notice Mapping from userOpId to whether it has been used
    mapping(bytes32 => bool) private _userOpIdUsed;

    /// @notice Mapping from signature hash to whether it has been used
    mapping(bytes32 => bool) private _signatureUsed;

    /// @notice Mapping from LP address to last deposit timestamp (for timelock)
    mapping(address => uint256) private _lastDepositTime;

    /// @notice Mapping from LP address to withdrawal request timestamp
    mapping(address => uint256) private _withdrawalRequestTime;

    // ============================================================
    //                       CONSTRUCTOR
    // ============================================================

    /// @param _usdc Address of the USDC token on Polygon
    /// @param _treasury Address that receives platform fees
    /// @param _operator Address of the backend operator
    /// @param _arbiter Address for dispute resolution
    constructor(
        address _usdc,
        address _treasury,
        address _operator,
        address _arbiter
    ) EIP712("EscrowMaster", "1") {
        if (_usdc == address(0)) revert InvalidAddress();
        if (_treasury == address(0)) revert InvalidAddress();
        if (_operator == address(0)) revert InvalidAddress();
        if (_arbiter == address(0)) revert InvalidAddress();

        usdc = IERC20(_usdc);
        treasury = _treasury;

        // Grant roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(LP_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, _operator);
        _grantRole(ARBITER_ROLE, _arbiter);
    }

    // ============================================================
    //                     LP FUNCTIONS
    // ============================================================

    /// @inheritdoc IEscrowMaster
    function depositUSDC(uint256 amount) external onlyRole(LP_ADMIN_ROLE) nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();

        _lpBalances[msg.sender] += amount;
        _lpTotalDeposited[msg.sender] += amount;
        _lastDepositTime[msg.sender] = block.timestamp;

        // Reset daily volume on first deposit of the day
        uint256 today = _getStartOfDay(block.timestamp);
        if (today > _lpDailyReset[msg.sender]) {
            _lpDailyVolume[msg.sender] = 0;
            _lpDailyReset[msg.sender] = today;
        }

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        emit DepositLP(msg.sender, amount, block.timestamp);
    }

    /// @inheritdoc IEscrowMaster
    function withdrawLP(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();

        uint256 available = _lpBalances[msg.sender];
        if (amount > available) revert WithdrawalExceedsAvailable();

        // Enforce time-lock: must wait 24h after last deposit or last withdrawal
        uint256 lastActivity = _lastDepositTime[msg.sender] > _withdrawalRequestTime[msg.sender]
            ? _lastDepositTime[msg.sender]
            : _withdrawalRequestTime[msg.sender];
        if (lastActivity != 0 && block.timestamp < lastActivity + TIMELOCK_DURATION) {
            revert WithdrawalTimeLocked();
        }

        _lpBalances[msg.sender] -= amount;
        _lpTotalDeposited[msg.sender] -= amount;
        _withdrawalRequestTime[msg.sender] = block.timestamp;

        usdc.safeTransfer(msg.sender, amount);

        emit WithdrawLP(msg.sender, amount, block.timestamp);
    }

    /// @inheritdoc IEscrowMaster
    function setDailyLimit(uint256 limit) external onlyRole(LP_ADMIN_ROLE) {
        _lpDailyLimits[msg.sender] = limit;
        emit DailyLimitSet(msg.sender, limit);
    }

    // ============================================================
    //                    OPERATOR FUNCTIONS
    // ============================================================

    /// @inheritdoc IEscrowMaster
    function lockTrade(
        address user,
        uint256 amountUSDC,
        uint256 amountBOB,
        uint256 rateP2P,
        uint256 lpSpread,
        uint256 platformFee,
        bytes32 userOpId
    ) external onlyRole(OPERATOR_ROLE) nonReentrant whenNotPaused returns (uint256 tradeId) {
        // === INPUT VALIDATION ===
        if (user == address(0)) revert InvalidAddress();
        if (amountUSDC == 0) revert ZeroAmount();
        if (amountBOB == 0) revert ZeroAmount();
        if (rateP2P == 0) revert ZeroAmount();
        if (lpSpread > MAX_FEE_BPS) revert FeeExceedsMaximum();
        if (platformFee > MAX_FEE_BPS) revert FeeExceedsMaximum();
        if (userOpId == bytes32(0)) revert InvalidUserOpId();
        if (_userOpIdUsed[userOpId]) revert UserOpIdAlreadyUsed();

        // === FIND LP WITH SUFFICIENT BALANCE ===
        address lp = _findLPWithBalance(amountUSDC);
        if (lp == address(0)) revert InsufficientLPBalance();

        // === CHECK DAILY LIMIT ===
        uint256 dailyLimit = _lpDailyLimits[lp];
        if (dailyLimit > 0) {
            uint256 today = _getStartOfDay(block.timestamp);
            if (today > _lpDailyReset[lp]) {
                _lpDailyVolume[lp] = 0;
                _lpDailyReset[lp] = today;
            }
            if (_lpDailyVolume[lp] + amountUSDC > dailyLimit) {
                revert DailyLimitExceeded();
            }
        }

        // === LOCK USDC ===
        _lpBalances[lp] -= amountUSDC;
        _lpLockedBalances[lp] += amountUSDC;
        _lpDailyVolume[lp] += amountUSDC;

        // === CREATE TRADE ===
        tradeId = _tradeCount++;
        _trades[tradeId] = Trade({
            user: user,
            lp: lp,
            amountUSDC: amountUSDC,
            amountBOB: amountBOB,
            rateP2P: rateP2P,
            lpSpread: lpSpread,
            platformFee: platformFee,
            createdAt: block.timestamp,
            status: TradeStatus.Locked,
            userOpId: userOpId
        });

        _userOpIdUsed[userOpId] = true;

        emit TradeLocked(tradeId, user, lp, amountUSDC, amountBOB, userOpId);
    }

    /// @inheritdoc IEscrowMaster
    function release(uint256 tradeId, bytes calldata signature)
        external
        onlyRole(OPERATOR_ROLE)
        nonReentrant
        whenNotPaused
    {
        Trade storage trade = _getTrade(tradeId);

        // === STATE VALIDATION ===
        if (trade.status != TradeStatus.Locked) revert TradeNotLocked();

        // === SIGNATURE VERIFICATION ===
        bytes32 messageHash = _getReleaseMessageHash(
            tradeId,
            trade.user,
            trade.amountUSDC,
            trade.userOpId
        );
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address signer = ECDSA.recover(ethSignedHash, signature);

        // Verify signer is the OPERATOR
        if (!hasRole(OPERATOR_ROLE, signer)) revert InvalidSignature();

        // === PREVENT SIGNATURE REPLAY ===
        bytes32 sigHash = keccak256(signature);
        if (_signatureUsed[sigHash]) revert SignatureAlreadyUsed();
        _signatureUsed[sigHash] = true;

        // === TRANSFER USDC TO USER ===
        trade.status = TradeStatus.Released;
        _lpLockedBalances[trade.lp] -= trade.amountUSDC;
        uint256 fee = (trade.amountUSDC * trade.platformFee) / 10_000;
        uint256 userAmount = trade.amountUSDC - fee;

        usdc.safeTransfer(trade.user, userAmount);

        if (fee > 0) {
            usdc.safeTransfer(treasury, fee);
        }

        emit TradeReleased(tradeId, trade.user, userAmount, fee);
    }

    /// @inheritdoc IEscrowMaster
    function expireTrade(uint256 tradeId) external onlyRole(OPERATOR_ROLE) nonReentrant {
        Trade storage trade = _getTrade(tradeId);

        if (trade.status != TradeStatus.Locked) revert TradeAlreadyFinalized();
        if (block.timestamp < trade.createdAt + MIN_EXPIRY_DURATION) revert TradeNotReadyToExpire();

        trade.status = TradeStatus.Expired;
        _lpLockedBalances[trade.lp] -= trade.amountUSDC;

        // Return USDC to LP
        _lpBalances[trade.lp] += trade.amountUSDC;

        emit TradeExpired(tradeId, trade.lp, trade.amountUSDC);
    }

    // ============================================================
    //                     VIEW FUNCTIONS
    // ============================================================

    /// @inheritdoc IEscrowMaster
    function getTrade(uint256 tradeId) external view returns (Trade memory) {
        return _getTrade(tradeId);
    }

    /// @inheritdoc IEscrowMaster
    function getAvailableBalance(address lp) external view returns (uint256) {
        return _lpBalances[lp];
    }

    /// @inheritdoc IEscrowMaster
    function getLockedBalance(address lp) external view returns (uint256) {
        return _lpLockedBalances[lp];
    }

    /// @inheritdoc IEscrowMaster
    function getTotalBalance(address lp) external view returns (uint256) {
        return _lpBalances[lp];
    }

    /// @inheritdoc IEscrowMaster
    function getRemainingDailyLimit(address lp) external view returns (uint256) {
        uint256 dailyLimit = _lpDailyLimits[lp];
        if (dailyLimit == 0) return type(uint256).max;

        uint256 used = _lpDailyVolume[lp];
        uint256 today = _getStartOfDay(block.timestamp);
        if (today > _lpDailyReset[lp]) {
            return dailyLimit;
        }
        if (used >= dailyLimit) return 0;
        return dailyLimit - used;
    }

    /// @inheritdoc IEscrowMaster
    function isUserOpIdUsed(bytes32 userOpId) external view returns (bool) {
        return _userOpIdUsed[userOpId];
    }

    /// @inheritdoc IEscrowMaster
    function tradeCount() external view returns (uint256) {
        return _tradeCount;
    }

    /// @inheritdoc IEscrowMaster
    function getTreasury() external view returns (address) {
        return treasury;
    }

    /// @notice Returns the EIP-712 domain separator
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // ============================================================
    //                     ADMIN FUNCTIONS
    // ============================================================

    /// @notice Pause the contract (emergency stop)
    function pause() external onlyRole(ARBITER_ROLE) {
        _pause();
    }

    /// @notice Unpause the contract
    function unpause() external onlyRole(ARBITER_ROLE) {
        _unpause();
    }

    /// @notice Update treasury address
    function setTreasury(address newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newTreasury == address(0)) revert InvalidAddress();
        address oldTreasury = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    // ============================================================
    //                     INTERNAL FUNCTIONS
    // ============================================================

    function _getTrade(uint256 tradeId) internal view returns (Trade storage) {
        if (tradeId >= _tradeCount) revert TradeNotFound();
        return _trades[tradeId];
    }

    /// @dev Find an LP with sufficient available balance
    /// @return lp The LP address, or address(0) if none found
    function _findLPWithBalance(uint256 amount) internal view returns (address lp) {
        uint256 memberCount = getRoleMemberCount(LP_ADMIN_ROLE);
        for (uint256 i = 0; i < memberCount; i++) {
            address candidate = getRoleMember(LP_ADMIN_ROLE, i);
            if (_lpBalances[candidate] >= amount) {
                return candidate;
            }
        }
        return address(0);
    }

    /// @dev Get the start of day (UTC) for a given timestamp
    function _getStartOfDay(uint256 timestamp) internal pure returns (uint256) {
        return (timestamp / 1 days) * 1 days;
    }

    /// @dev Generate the EIP-712 message hash for a release
    function _getReleaseMessageHash(
        uint256 tradeId,
        address user,
        uint256 amountUSDC,
        bytes32 userOpId
    ) internal view returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                "\x19\x01",
                _domainSeparatorV4(),
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
    }

    /// @notice Rescue ETH accidentally sent to the contract
    function rescueETH(address to) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (to == address(0)) revert InvalidAddress();
        uint256 balance = address(this).balance;
        if (balance == 0) return;
        (bool success, ) = to.call{value: balance}("");
        require(success, "ETH transfer failed");
    }

    // ============================================================
    //                    OFFRAMP FUNCTIONS
    // ============================================================

    /// @notice Lock user's USDC for offramp (user sells USDC for BOB)
    /// @param amount Amount of USDC to lock
    /// @param merchantAddress Address that will receive BOB payment
    function lockForOfframp(uint256 amount, address merchantAddress) external nonReentrant whenNotPaused returns (uint256 tradeId) {
        if (amount == 0) revert ZeroAmount();
        if (merchantAddress == address(0)) revert InvalidAddress();

        // Transfer USDC from user to contract
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        // Create trade record
        tradeId = _tradeCount++;
        _trades[tradeId] = Trade({
            user: msg.sender,
            lp: address(0), // No LP yet - will be assigned on release
            amountUSDC: amount,
            amountBOB: 0, // Will be set when BOB payment is confirmed
            rateP2P: 0,
            lpSpread: 0,
            platformFee: 0,
            createdAt: block.timestamp,
            status: TradeStatus.Locked,
            userOpId: keccak256(abi.encodePacked(msg.sender, tradeId))
        });

        emit TradeLocked(tradeId, msg.sender, address(0), amount, 0, _trades[tradeId].userOpId);
    }

    /// @notice Release USDC to LP after BOB payment confirmation (offramp)
    /// @param tradeId Trade ID to release
    /// @param lpAddress LP address that paid BOB
    /// @param amountBOB Amount of BOB paid to merchant
    function releaseOfframp(uint256 tradeId, address lpAddress, uint256 amountBOB) external onlyRole(OPERATOR_ROLE) nonReentrant whenNotPaused {
        Trade storage trade = _getTrade(tradeId);
        if (trade.status != TradeStatus.Locked) revert TradeNotLocked();
        if (trade.lp != address(0)) revert TradeAlreadyFinalized(); // LP already assigned

        trade.lp = lpAddress;
        trade.amountBOB = amountBOB;
        trade.status = TradeStatus.Released;

        // Transfer USDC to LP (minus platform fee)
        uint256 fee = (trade.amountUSDC * 100) / 10_000; // 1% platform fee
        uint256 lpAmount = trade.amountUSDC - fee;

        usdc.safeTransfer(lpAddress, lpAmount);
        if (fee > 0) {
            usdc.safeTransfer(treasury, fee);
        }

        emit TradeReleased(tradeId, lpAddress, lpAmount, fee);
    }
}
