import { Router, Request, Response } from "express";
import { z } from "zod";
import { StereumService } from "../services/stereum.js";
import { quoteLimiter } from "../middleware/rateLimit.js";
import { PrismaClient } from "@prisma/client";
import pino from "pino";

const logger = pino({ name: "quote-route" });
const router = Router();
const prisma = new PrismaClient();

const quoteSchema = z.object({
  amount: z.coerce.number().positive().max(100_000),
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

router.get("/", quoteLimiter, async (req: Request, res: Response) => {
  const parsed = quoteSchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: "Invalid parameters. Required: amount (number) and wallet (0x...)",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const { amount, wallet } = parsed.data;

  // === KYC CHECK ===
  const customer = await prisma.customer.findUnique({
    where: { wallet },
    select: { kycStatus: true, stereumCustomerId: true },
  });

  if (!customer || customer.kycStatus !== "verified" || !customer.stereumCustomerId) {
    res.status(403).json({
      success: false,
      error: "KYC no verificado. Completa la verificacion de identidad antes de cotizar.",
      code: "KYC_REQUIRED",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  try {
    const stereum = new StereumService();

    const quote = await stereum.createQuote({
      userId: customer.stereumCustomerId,
      side: "BUY",
      inputAmount: amount,
      inputCurrency: "BOB",
      outputCurrency: "USDC",
    });

    logger.info({ amount, rate: quote.exchangeRate, amountUSDC: quote.outputAmount, wallet }, "Quote generated");

    res.json({
      success: true,
      data: {
        quoteId: quote.id,
        amountBOB: quote.inputAmount,
        amountUSDC: quote.outputAmount,
        rate: quote.exchangeRate,
        serviceFee: quote.serviceFee,
        feeCurrency: quote.feeCurrency,
        expiresAt: new Date(quote.expireAt).toISOString(),
        expiresInSeconds: quote.expiresInSeconds,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error }, "Failed to generate quote from Stereum");
    res.status(500).json({
      success: false,
      error: "Failed to generate quote from Stereum",
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
