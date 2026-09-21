import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { PrismaClient } from "@prisma/client";
import pino from "pino";

const logger = pino({ name: "admin-route" });
const router = Router();

router.use(authMiddleware);

router.get("/status", async (_req: Request, res: Response) => {
  try {
    const prisma = new PrismaClient();

    const [totalTrades, releasedTrades, pendingTrades, expiredTrades] = await Promise.all([
      prisma.trade.count(),
      prisma.trade.count({ where: { status: "released" } }),
      prisma.trade.count({ where: { status: "pending" } }),
      prisma.trade.count({ where: { status: "expired" } }),
    ]);

    const recentTrades = await prisma.trade.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        userWallet: true,
        amountUSDC: true,
        amountBOB: true,
        status: true,
        createdAt: true,
        releasedAt: true,
      },
    });

    res.json({
      success: true,
      data: {
        totalTrades,
        releasedTrades,
        pendingTrades,
        expiredTrades,
        recentTrades,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error }, "Failed to get admin status");
    res.status(500).json({ success: false, error: "Failed to get status" });
  }
});

export default router;
