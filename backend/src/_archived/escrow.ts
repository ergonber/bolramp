import { ethers } from "ethers";
import { getEnv } from "../config/env.js";
import pino from "pino";

const logger = pino({ name: "escrow" });

const USDC_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
];

const ESCROW_ABI = [
  "function lockTrade(address user, uint256 amountUSDC, uint256 amountBOB, uint256 rateP2P, uint256 lpSpread, uint256 platformFee, bytes32 userOpId) returns (uint256)",
  "function release(uint256 tradeId, bytes signature)",
  "function expireTrade(uint256 tradeId)",
  "function depositUSDC(uint256 amount)",
  "function getTrade(uint256 tradeId) view returns (tuple(address user, address lp, uint256 amountUSDC, uint256 amountBOB, uint256 rateP2P, uint256 lpSpread, uint256 platformFee, uint256 createdAt, uint8 status, bytes32 userOpId))",
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

  // Polygon Amoy USDC address
  private static readonly USDC_ADDRESS = "0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582";

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
      amountUSDC: Number(trade.amountUSDC),
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
    amountUSDC: number,
    amountBOB: number,
    rateP2P: number,
    lpSpread: number,
    platformFee: number,
    userOpId: string,
  ): Promise<{ hash: string; tradeId: number }> {
    const tx = await this.contractWithSigner.lockTrade(
      user,
      amountUSDC,
      amountBOB,
      rateP2P,
      lpSpread,
      platformFee,
      userOpId,
    );

    logger.info({ txHash: tx.hash, user, amountUSDC }, "lockTrade submitted");

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

  // ==================== SETUP FUNCTIONS ====================

  async approveUSDC(amount: number): Promise<{ hash: string }> {
    const usdc = new ethers.Contract(EscrowService.USDC_ADDRESS, USDC_ABI, this.wallet);
    const amountWei = BigInt(Math.round(amount * 1e6));

    const tx = await usdc.approve(this.contract.target, amountWei);
    logger.info({ txHash: tx.hash, amount, amountWei: amountWei.toString() }, "USDC approve submitted");

    const receipt = await tx.wait();
    logger.info({ txHash: tx.hash }, "USDC approve confirmed");

    return { hash: tx.hash };
  }

  async depositUSDC(amount: number): Promise<{ hash: string }> {
    const amountWei = BigInt(Math.round(amount * 1e6));

    const tx = await this.contractWithSigner.depositUSDC(amountWei);
    logger.info({ txHash: tx.hash, amount, amountWei: amountWei.toString() }, "depositUSDC submitted");

    const receipt = await tx.wait();
    logger.info({ txHash: tx.hash }, "depositUSDC confirmed");

    return { hash: tx.hash };
  }

  async getUSDCBalance(): Promise<number> {
    const usdc = new ethers.Contract(EscrowService.USDC_ADDRESS, USDC_ABI, this.provider);
    const balance = await usdc.balanceOf(this.wallet.address);
    return Number(balance) / 1e6;
  }

  async getAllowance(): Promise<number> {
    const usdc = new ethers.Contract(EscrowService.USDC_ADDRESS, USDC_ABI, this.provider);
    const allowance = await usdc.allowance(this.wallet.address, this.contract.target);
    return Number(allowance) / 1e6;
  }
}
