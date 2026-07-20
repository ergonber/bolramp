// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IEscrowMaster — Interface for the onramp escrow contract
/// @notice Defines all external functions, events, and errors for the EscrowMaster
interface IEscrowMaster {
    // ============================================================
    //                          ENUMS
    // ============================================================

    enum TradeStatus {
        Pending,
        Locked,
        Released,
        Expired
    }

    // ============================================================
    //                         STRUCTS
    // ============================================================

    struct Trade {
        address user;
        address lp;
        uint256 amountUSDC;
        uint256 amountBOB;
        uint256 rateP2P;
        uint256 lpSpread;
        uint256 platformFee;
        uint256 createdAt;
        TradeStatus status;
        bytes32 userOpId;
    }

    // ============================================================
    //                          ERRORS
    // ============================================================

    error ZeroAmount();
    error InvalidAddress();
    error TradeNotFound();
    error TradeNotLocked();
    error TradeAlreadyFinalized();
    error TradeNotExpired();
    error TradeNotReadyToExpire();
    error InsufficientLPBalance();
    error DailyLimitExceeded();
    error InvalidSignature();
    error SignatureAlreadyUsed();
    error WithdrawalTimeLocked();
    error WithdrawalExceedsAvailable();
    error FeeExceedsMaximum();
    error InvalidUserOpId();
    error UserOpIdAlreadyUsed();
    error Unauthorized();
    error ContractPaused();
    error NotPausedError();

    // ============================================================
    //                         EVENTS
    // ============================================================

    event DepositLP(address indexed lp, uint256 amount, uint256 timestamp);
    event WithdrawLP(address indexed lp, uint256 amount, uint256 timestamp);
    event TradeLocked(
        uint256 indexed tradeId,
        address indexed user,
        address indexed lp,
        uint256 amountUSDC,
        uint256 amountBOB,
        bytes32 userOpId
    );
    event TradeReleased(
        uint256 indexed tradeId,
        address indexed user,
        uint256 amountUSDC,
        uint256 platformFee
    );
    event TradeExpired(uint256 indexed tradeId, address indexed lp, uint256 amountUSDC);
    event DailyLimitSet(address indexed lp, uint256 limit);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    // ============================================================
    //                      LP FUNCTIONS
    // ============================================================

    function depositUSDC(uint256 amount) external;
    function withdrawLP(uint256 amount) external;
    function setDailyLimit(uint256 limit) external;

    // ============================================================
    //                    OPERATOR FUNCTIONS
    // ============================================================

    function lockTrade(
        address user,
        uint256 amountUSDC,
        uint256 amountBOB,
        uint256 rateP2P,
        uint256 lpSpread,
        uint256 platformFee,
        bytes32 userOpId
    ) external returns (uint256 tradeId);

    function release(uint256 tradeId, bytes calldata signature) external;
    function expireTrade(uint256 tradeId) external;

    // ============================================================
    //                     VIEW FUNCTIONS
    // ============================================================

    function getTrade(uint256 tradeId) external view returns (Trade memory);
    function getAvailableBalance(address lp) external view returns (uint256);
    function getLockedBalance(address lp) external view returns (uint256);
    function getTotalBalance(address lp) external view returns (uint256);
    function getRemainingDailyLimit(address lp) external view returns (uint256);
    function DOMAIN_SEPARATOR() external view returns (bytes32);
    function isUserOpIdUsed(bytes32 userOpId) external view returns (bool);
    function tradeCount() external view returns (uint256);
    function getTreasury() external view returns (address);
}
