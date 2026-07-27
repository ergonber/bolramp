import { Router, Request, Response } from "express";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { AppError } from "../middleware/errorHandler.js";
import pino from "pino";

const logger = pino({ name: "trade-route" });
const router = Router();
const prisma = new PrismaClient();

const tradeIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const historySchema = z.object({
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

router.get("/history", async (req: Request, res: Response) => {
  const parsed = historySchema.safeParse(req.query);

  if (!parsed.success) {
    throw new AppError("Invalid parameters", 400);
  }

  const { wallet, page, limit } = parsed.data;
  const skip = (page - 1) * limit;

  try {
    const [trades, total] = await Promise.all([
      prisma.trade.findMany({
        where: {
          OR: [{ userWallet: wallet }, { lpAddress: wallet }],
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.trade.count({
        where: {
          OR: [{ userWallet: wallet }, { lpAddress: wallet }],
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        trades: trades.map((t: any) => ({
          tradeId: t.tradeId,
          status: t.status,
          userWallet: t.userWallet,
          lpAddress: t.lpAddress,
          amountUSDT: Number(t.amountUSDT),
          amountBOB: Number(t.amountBOB),
          rate: Number(t.rate),
          releaseTxHash: t.releaseTxHash,
          createdAt: t.createdAt.toISOString(),
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error, wallet }, "Failed to fetch trade history");
    throw new AppError("Failed to fetch trade history", 500);
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  const parsed = tradeIdSchema.safeParse(req.params);

  if (!parsed.success) {
    throw new AppError("Invalid trade ID", 400);
  }

  const { id } = parsed.data;

  try {
    const trade = await prisma.trade.findFirst({
      where: { id },
    });

    if (!trade) {
      throw new AppError("Trade not found", 404);
    }

    res.json({
      success: true,
      data: {
        dbTradeId: trade.id,
        tradeId: trade.tradeId,
        status: trade.status,
        userWallet: trade.userWallet,
        lpAddress: trade.lpAddress,
        amountUSDT: trade.amountUSDT,
        amountBOB: trade.amountBOB,
        rate: trade.rate,
        releaseTxHash: trade.releaseTxHash,
        createdAt: trade.createdAt.toISOString(),
        releasedAt: trade.releasedAt?.toISOString() || null,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error, tradeId: id }, "Failed to fetch trade");
    throw new AppError("Failed to fetch trade", 500);
  }
});

// ==================== SIMULATE PAYMENT (TEST ONLY) ====================

router.post("/:id/simulate-payment", async (req: Request, res: Response) => {
  const parsed = tradeIdSchema.safeParse(req.params);

  if (!parsed.success) {
    throw new AppError("Invalid trade ID", 400);
  }

  const { id } = parsed.data;

  const trade = await prisma.trade.findFirst({
    where: { id },
  });

  if (!trade) {
    throw new AppError("Trade not found", 404);
  }

  if (trade.status === "released") {
    res.json({ success: true, message: "Trade already released", timestamp: new Date().toISOString() });
    return;
  }

  // Simulate: Stereum confirms BOB payment → USDC sent to user
  await prisma.trade.update({
    where: { id },
    data: {
      status: "released",
      releasedAt: new Date(),
    },
  });

  logger.info({ dbTradeId: trade.id, userOpId: trade.userOpId }, "Payment simulated — trade released");

  res.json({
    success: true,
    data: {
      dbTradeId: trade.id,
      status: "released",
      userWallet: trade.userWallet,
      amountUSDT: trade.amountUSDT,
    },
    message: "Pago simulado exitosamente. Stereum envia USDT al usuario.",
    timestamp: new Date().toISOString(),
  });
});

export default router;
