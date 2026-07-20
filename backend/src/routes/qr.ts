import { Router, Request, Response } from "express";
import { z } from "zod";
import { StereumService } from "../services/stereum.js";
import { qrLimiter } from "../middleware/rateLimit.js";
import { AppError } from "../middleware/errorHandler.js";
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

    // Confirm order with Stereum — this returns the QR for payment
    const order = await stereum.confirmOrder({
      quoteId,
      walletAddress: userWallet,
      network: "POLYGON",
    });

    // Create trade in DB
    await prisma.trade.create({
      data: {
        tradeId: 0, // Will be set when on-chain trade is locked
        userWallet,
        lpAddress: "stereum",
        amountUSDT: order.outputAmount,
        amountBOB: order.paymentInstructions.amount,
        rate: order.paymentInstructions.amount / order.outputAmount,
        lpSpread: 0,
        platformFee: 0,
        userOpId: order.id,
        status: "pending",
        quoteId,
        qrData: order.paymentInstructions.qrBase64,
      },
    });

    logger.info(
      { orderId: order.id, transactionId: order.transactionId, amountBOB: order.paymentInstructions.amount },
      "Stereum order confirmed, QR generated",
    );

    res.json({
      success: true,
      data: {
        orderId: order.id,
        transactionId: order.transactionId,
        tradeId: null,
        qrBase64: order.paymentInstructions.qrBase64,
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
