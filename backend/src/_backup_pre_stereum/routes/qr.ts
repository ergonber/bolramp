import { Router, Request, Response } from "express";
import { z } from "zod";
import { ethers } from "ethers";
import { getBinanceP2PRate } from "../services/pricing.js";
import { EscrowService } from "../services/escrow.js";
import { getEnv } from "../config/env.js";
import { qrLimiter } from "../middleware/rateLimit.js";
import { AppError } from "../middleware/errorHandler.js";
import { PrismaClient } from "@prisma/client";
import pino from "pino";

const logger = pino({ name: "qr-route" });
const router = Router();
const prisma = new PrismaClient();

const qrSchema = z.object({
  userWallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amountUSDT: z.number().positive(),
  quoteId: z.string(),
});

router.post("/", qrLimiter, async (req: Request, res: Response) => {
  const parsed = qrSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new AppError("Invalid request body", 400);
  }

  const { userWallet, amountUSDT, quoteId } = parsed.data;
  const env = getEnv();

  try {
    const escrow = new EscrowService();

    // Get current rate
    const p2pRate = await getBinanceP2PRate();
    const rateWithSpread = p2pRate * (1 + env.LP_SPREAD_BPS / 10_000);
    const amountBOB = Math.round(amountUSDT * rateWithSpread * 100) / 100;

    // Generate unique userOpId
    const userOpId = ethers.keccak256(
      ethers.toUtf8Bytes(`${quoteId}-${Date.now()}`),
    );

    // Check if userOpId is already used
    const isUsed = await escrow.isUserOpIdUsed(userOpId);
    if (isUsed) {
      throw new AppError("Quote already used, please request a new one", 400);
    }

    // Lock trade on-chain
    logger.info(
      { userWallet, amountUSDT, amountBOB, rate: p2pRate },
      "Locking trade on-chain",
    );

    const { hash: txHash, tradeId } = await escrow.lockTrade(
      userWallet,
      Math.round(amountUSDT * 1e6), // USDC has 6 decimals
      Math.round(amountBOB * 100),   // BOB has 2 decimals
      Math.round(rateWithSpread * 10000), // Rate scaled by 10000
      env.LP_SPREAD_BPS,
      env.PLATFORM_FEE_BPS,
      userOpId,
    );

    // Create trade in DB
    const dbTrade = await prisma.trade.create({
      data: {
        tradeId,
        userWallet,
        lpAddress: "pending", // Will be updated when we know the LP
        amountUSDT,
        amountBOB,
        rate: rateWithSpread,
        lpSpread: env.LP_SPREAD_BPS,
        platformFee: env.PLATFORM_FEE_BPS,
        userOpId,
        status: "locked",
        txHash,
        quoteId,
        rateAtQuote: p2pRate,
        lockedAt: new Date(),
      },
    });

    logger.info(
      { tradeId, txHash, userWallet, amountUSDT, amountBOB },
      "Trade locked successfully",
    );

    res.json({
      success: true,
      data: {
        tradeId,
        qrImage: "/qr_bcp.jpg",
        amountBOB: amountBOB.toFixed(2),
        rate: rateWithSpread,
        bankName: "BCP",
        accountName: "Ernesto",
        userOpId,
        txHash,
        expiresAt: new Date(Date.now() + env.TRADE_EXPIRY_SECONDS * 1000).toISOString(),
        instructions: "Escanea el QR con tu app bancaria y transfiere el monto exacto en BOB",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error, userWallet, amountUSDT }, "Failed to generate QR and lock trade");
    throw new AppError(
      error instanceof Error ? error.message : "Failed to generate QR",
      500,
    );
  }
});

export default router;
