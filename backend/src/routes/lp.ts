import { Router, Request, Response } from "express";
import { z } from "zod";
import { EscrowService } from "../services/escrow.js";
import { apiLimiter } from "../middleware/rateLimit.js";
import { AppError } from "../middleware/errorHandler.js";
import pino from "pino";

const logger = pino({ name: "lp-route" });
const router = Router();

const balanceQuerySchema = z.object({
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

router.get("/balance", apiLimiter, async (req: Request, res: Response) => {
  const parsed = balanceQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    throw new AppError("Invalid wallet address", 400);
  }

  const { wallet } = parsed.data;

  try {
    const escrow = new EscrowService();

    const [available, locked] = await Promise.all([
      escrow.getAvailableBalance(wallet),
      escrow.getLockedBalance(wallet),
    ]);

    res.json({
      success: true,
      data: {
        wallet,
        available,
        locked,
        total: available + locked,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error, wallet }, "Failed to fetch LP balance");
    throw new AppError("Failed to fetch LP balance", 500);
  }
});

router.post("/deposit", apiLimiter, async (req: Request, res: Response) => {
  const depositSchema = z.object({
    wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    amountUSDT: z.number().positive(),
  });

  const parsed = depositSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new AppError("Invalid deposit request", 400);
  }

  const { wallet, amountUSDT } = parsed.data;

  logger.info({ wallet, amountUSDT }, "LP deposit request received");

  res.json({
    success: true,
    data: {
      wallet,
      amountUSDT,
      message: "Deposit transaction should be submitted from the LP's wallet",
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
