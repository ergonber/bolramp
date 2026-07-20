import { Router, Request, Response } from "express";
import { z } from "zod";
import { SignerService } from "../services/signer.js";
import { EscrowService } from "../services/escrow.js";
import { authMiddleware } from "../middleware/auth.js";
import { confirmLimiter } from "../middleware/rateLimit.js";
import { AppError } from "../middleware/errorHandler.js";
import { PrismaClient } from "@prisma/client";
import pino from "pino";

const logger = pino({ name: "trade-confirm" });
const router = Router();
const prisma = new PrismaClient();

const confirmSchema = z.object({
  tradeId: z.number().int().positive(),
});

router.post("/confirm-payment", confirmLimiter, authMiddleware, async (req: Request, res: Response) => {
  const parsed = confirmSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new AppError("Invalid tradeId", 400);
  }

  const { tradeId } = parsed.data;

  try {
    const escrow = new EscrowService();
    const signer = new SignerService();

    // Get trade from DB
    const dbTrade = await prisma.trade.findFirst({
      where: { tradeId },
    });

    if (!dbTrade) {
      throw new AppError("Trade not found", 404);
    }

    if (dbTrade.status !== "locked") {
      throw new AppError(`Trade is not locked (status: ${dbTrade.status})`, 400);
    }

    // Verify on-chain status
    const onChainTrade = await escrow.getTrade(tradeId);

    if (onChainTrade.status !== 1) {
      // 1 = Locked
      throw new AppError("Trade is not locked on-chain", 400);
    }

    // Sign release
    const signature = await signer.signRelease(
      tradeId,
      onChainTrade.user,
      onChainTrade.amountUSDT,
      onChainTrade.userOpId,
    );

    // Submit release transaction on-chain
    const releaseTx = await escrow.release(tradeId, signature);

    // Update DB
    await prisma.trade.update({
      where: { id: dbTrade.id },
      data: {
        status: "released",
        releaseTxHash: releaseTx.hash,
        releasedAt: new Date(),
      },
    });

    logger.info(
      { tradeId, releaseTxHash: releaseTx.hash },
      "Payment confirmed and USDT released",
    );

    res.json({
      success: true,
      data: {
        tradeId,
        releaseTxHash: releaseTx.hash,
        status: "released",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error, tradeId }, "Failed to confirm payment");
    throw new AppError(
      error instanceof Error ? error.message : "Failed to confirm payment",
      500,
    );
  }
});

export default router;
