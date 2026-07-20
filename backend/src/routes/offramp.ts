import { Router, Request, Response } from "express";
import { z } from "zod";
import { getBinanceP2PRate } from "../services/pricing.js";
import { getEnv } from "../config/env.js";
import { quoteLimiter } from "../middleware/rateLimit.js";
import { AppError } from "../middleware/errorHandler.js";
import pino from "pino";

const logger = pino({ name: "offramp-route" });
const router = Router();

const offrampQuoteSchema = z.object({
  amountUSDC: z.coerce.number().positive().max(100_000),
});

router.get("/quote", quoteLimiter, async (req: Request, res: Response) => {
  const parsed = offrampQuoteSchema.safeParse(req.query);

  if (!parsed.success) {
    throw new AppError("Invalid amountUSDC parameter", 400);
  }

  const { amountUSDC } = parsed.data;
  const env = getEnv();

  try {
    const p2pRate = await getBinanceP2PRate();

    const lpSpreadBps = env.LP_SPREAD_BPS;
    const platformFeeBps = env.PLATFORM_FEE_BPS;

    const rateWithSpread = p2pRate * (1 - lpSpreadBps / 10_000);
    const amountBOB = amountUSDC * rateWithSpread;
    const feeAmount = amountBOB * (platformFeeBps / 10_000);
    const finalBOB = amountBOB - feeAmount;

    const expiresAt = new Date(Date.now() + env.QUOTE_EXPIRY_SECONDS * 1000);

    logger.info({ amountUSDC, rate: rateWithSpread, amountBOB: finalBOB }, "Offramp quote generated");

    res.json({
      success: true,
      data: {
        amountUSDC,
        amountBOB: finalBOB,
        rate: rateWithSpread,
        lpSpread: lpSpreadBps,
        platformFee: platformFeeBps,
        expiresAt: expiresAt.toISOString(),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error }, "Failed to generate offramp quote");
    throw new AppError("Failed to generate offramp quote", 500);
  }
});

export default router;
