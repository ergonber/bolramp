import { Router, Request, Response } from "express";
import { z } from "zod";
import { getBinanceP2PRate, calculateQuote } from "../services/pricing.js";
import { getEnv } from "../config/env.js";
import { quoteLimiter } from "../middleware/rateLimit.js";
import { AppError } from "../middleware/errorHandler.js";
import pino from "pino";

const logger = pino({ name: "quote-route" });
const router = Router();

const quoteSchema = z.object({
  amount: z.coerce.number().positive().max(100_000),
});

router.get("/", quoteLimiter, async (req: Request, res: Response) => {
  const parsed = quoteSchema.safeParse(req.query);

  if (!parsed.success) {
    throw new AppError("Invalid amount parameter", 400);
  }

  const { amount } = parsed.data;
  const env = getEnv();

  try {
    const p2pRate = await getBinanceP2PRate();
    const quote = calculateQuote(amount, p2pRate, env.LP_SPREAD_BPS, env.PLATFORM_FEE_BPS);

    const expiresAt = new Date(Date.now() + env.QUOTE_EXPIRY_SECONDS * 1000);

    logger.info({ amount, rate: quote.rate, amountUSDT: quote.amountUSDT }, "Quote generated");

    res.json({
      success: true,
      data: {
        amountBOB: amount,
        amountUSDT: quote.amountUSDT,
        rate: quote.rate,
        lpSpread: quote.lpSpread,
        platformFee: quote.platformFee,
        expiresAt: expiresAt.toISOString(),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error }, "Failed to generate quote");
    throw new AppError("Failed to generate quote", 500);
  }
});

export default router;
