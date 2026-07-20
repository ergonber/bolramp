import { ethers } from "ethers";
import { getEnv } from "../config/env.js";
import pino from "pino";

const logger = pino({ name: "escrow" });

const ESCROW_ABI = [
  "function lockTrade(address user, uint256 amountUSDT, uint256 amountBOB, uint256 rateP2P, uint256 lpSpread, uint256 platformFee, bytes32 userOpId) returns (uint256)",
  "function release(uint256 tradeId, bytes signature)",
  "function expireTrade(uint256 tradeId)",
  "function getTrade(uint256 tradeId) view returns (tuple(address user, address lp, uint256 amountUSDT, uint256 amountBOB, uint256 rateP2P, uint256 lpSpread, uint256 platformFee, uint256 createdAt, uint8 status, bytes32 userOpId))",
  "function getAvailableBalance(address lp) view returns (uint256)",
  "function getLockedBalance(address lp) view returns (uint256)",
  "function tradeCount() view returns (uint256)",
  "function DOMAIN_SEPARATOR() view returns (bytes32)",
  "function isUserOpIdUsed(bytes32) view returns (bool)",
];

export class EscrowService {
  private contract: ethers.Contract;
  private contractWithSigner: ethers.Contract;
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;

  constructor() {
    const env = getEnv();
    this.provider = new ethers.JsonRpcProvider(env.POLYGON_RPC_URL);
    this.wallet = new ethers.Wallet(env.OPERATOR_PRIVATE_KEY, this.provider);

    // Read-only contract
    this.contract = new ethers.Contract(
      env.ESCROW_CONTRACT_ADDRESS,
      ESCROW_ABI,
      this.provider,
    );

    // Contract with signer for write operations
    this.contractWithSigner = new ethers.Contract(
      env.ESCROW_CONTRACT_ADDRESS,
      ESCROW_ABI,
      this.wallet,
    );

    logger.info(
      { address: this.wallet.address, contract: env.ESCROW_CONTRACT_ADDRESS },
      "EscrowService initialized",
    );
  }

  // ==================== READ FUNCTIONS ====================

  async getTrade(tradeId: number) {
    const trade = await this.contract.getTrade(tradeId);
    return {
      user: trade.user,
      lp: trade.lp,
      amountUSDT: Number(trade.amountUSDT),
      amountBOB: Number(trade.amountBOB),
      rate: Number(trade.rateP2P),
      lpSpread: Number(trade.lpSpread),
      platformFee: Number(trade.platformFee),
      createdAt: Number(trade.createdAt),
      status: Number(trade.status),
      userOpId: trade.userOpId,
    };
  }

  async getAvailableBalance(lpAddress: string): Promise<number> {
    const balance = await this.contract.getAvailableBalance(lpAddress);
    return Number(balance);
  }

  async getLockedBalance(lpAddress: string): Promise<number> {
    const balance = await this.contract.getLockedBalance(lpAddress);
    return Number(balance);
  }

  async getTradeCount(): Promise<number> {
    const count = await this.contract.tradeCount();
    return Number(count);
  }

  async isUserOpIdUsed(userOpId: string): Promise<boolean> {
    return this.contract.isUserOpIdUsed(userOpId);
  }

  async getDomainSeparator(): Promise<string> {
    return this.contract.DOMAIN_SEPARATOR();
  }

  // ==================== WRITE FUNCTIONS ====================

  async lockTrade(
    user: string,
    amountUSDT: number,
    amountBOB: number,
    rateP2P: number,
    lpSpread: number,
    platformFee: number,
    userOpId: string,
  ): Promise<{ hash: string; tradeId: number }> {
    const tx = await this.contractWithSigner.lockTrade(
      user,
      amountUSDT,
      amountBOB,
      rateP2P,
      lpSpread,
      platformFee,
      userOpId,
    );

    logger.info({ txHash: tx.hash, user, amountUSDT }, "lockTrade submitted");

    const receipt = await tx.wait();

    // Extract tradeId from TradeLocked event
    const iface = this.contract.interface;
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
        if (parsed?.name === "TradeLocked") {
          const tradeId = Number(parsed.args.tradeId);
          logger.info({ tradeId, txHash: tx.hash }, "lockTrade confirmed");
          return { hash: tx.hash, tradeId };
        }
      } catch {
        // Not this event
      }
    }

    throw new Error("TradeLocked event not found in transaction receipt");
  }

  async release(tradeId: number, signature: string): Promise<{ hash: string }> {
    const tx = await this.contractWithSigner.release(tradeId, signature);

    logger.info({ txHash: tx.hash, tradeId }, "release submitted");

    const receipt = await tx.wait();

    logger.info({ tradeId, txHash: tx.hash }, "release confirmed");

    return { hash: tx.hash };
  }

  async expireTrade(tradeId: number): Promise<{ hash: string }> {
    const tx = await this.contractWithSigner.expireTrade(tradeId);

    logger.info({ txHash: tx.hash, tradeId }, "expireTrade submitted");

    const receipt = await tx.wait();

    logger.info({ tradeId, txHash: tx.hash }, "expireTrade confirmed");

    return { hash: tx.hash };
  }
}
