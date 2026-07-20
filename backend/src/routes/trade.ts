import { Router, Request, Response } from "express";
import { z } from "zod";
import { EscrowService } from "../services/escrow.js";
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
    const escrow = new EscrowService();
    const trade = await escrow.getTrade(id);

    const statusMap: Record<number, string> = {
      0: "pending",
      1: "locked",
      2: "released",
      3: "expired",
    };

    res.json({
      success: true,
      data: {
        tradeId: id,
        status: statusMap[trade.status] || "unknown",
        userWallet: trade.user,
        lpAddress: trade.lp,
        amountUSDT: trade.amountUSDT,
        amountBOB: trade.amountBOB,
        rate: trade.rate,
        createdAt: new Date(trade.createdAt * 1000).toISOString(),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error, tradeId: id }, "Failed to fetch trade");
    throw new AppError("Failed to fetch trade", 500);
  }
});

export default router;
