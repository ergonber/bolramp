import { Router, Request, Response } from "express";
import { z } from "zod";
import { StereumService } from "../services/stereum.js";
import { qrLimiter } from "../middleware/rateLimit.js";
import { PrismaClient } from "@prisma/client";
import pino from "pino";

const logger = pino({ name: "qr-route" });
const router = Router();
const prisma = new PrismaClient();

const qrSchema = z.object({
  userWallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  quoteId: z.string().min(1),
});

router.post("/", qrLimiter, async (req: Request, res: Response) => {
  const parsed = qrSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: "Invalid request body",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const { userWallet, quoteId } = parsed.data;

  try {
    const stereum = new StereumService();

    // Confirm order with Stereum — they generate the QR and handle the payment
    const order = await stereum.confirmOrder({
      quoteId,
      walletAddress: userWallet,
      network: "POLYGON",
    });

    // Store minimal trade record for tracking (Stereum is the LP, not us)
    const trade = await prisma.trade.create({
      data: {
        tradeId: 0, // No on-chain trade — Stereum handles liquidity
        userWallet,
        lpAddress: "stereum", // Stereum is the LP
        amountUSDT: order.outputAmount,
        amountBOB: order.paymentInstructions.amount,
        rate: order.paymentInstructions.amount / order.outputAmount,
        lpSpread: 0,
        platformFee: 0,
        userOpId: order.id, // Stereum's order ID for webhook matching
        status: "pending",
        quoteId,
        qrData: order.paymentInstructions.qrBase64 || "",
      },
    });

    logger.info(
      { orderId: order.id, transactionId: order.transactionId, amountBOB: order.paymentInstructions.amount, dbTradeId: trade.id },
      "Stereum order confirmed — QR generated",
    );

    res.json({
      success: true,
      data: {
        orderId: order.id,
        transactionId: order.transactionId,
        tradeId: 0, // No on-chain trade
        dbTradeId: trade.id,
        qrBase64: order.paymentInstructions.qrBase64 || null,
        amountBOB: order.paymentInstructions.amount.toFixed(2),
        amountUSDT: order.outputAmount.toFixed(2),
        currency: order.paymentInstructions.currency,
        network: order.paymentInstructions.network,
        expiresAt: new Date(order.paymentInstructions.expiresAt).toISOString(),
        status: order.status,
        instructions: "Escanea el QR con tu app bancaria y transfiere el monto exacto en BOB",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error, userWallet, quoteId }, "Failed to confirm Stereum order");
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate QR",
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
