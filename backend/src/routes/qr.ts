import { Router, Request, Response } from "express";
import { z } from "zod";
import { StereumService } from "../services/stereum.js";
import { SignerService } from "../services/signer.js";
import { qrLimiter } from "../middleware/rateLimit.js";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
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

    let order;
    let isMock = false;

    try {
      order = await stereum.confirmOrder({
        quoteId,
        walletAddress: userWallet,
        network: "POLYGON",
      });
    } catch (stereumError) {
      // Stereum sandbox failed — fall back to mock mode
      logger.warn({ error: stereumError, quoteId }, "Stereum order failed, using mock mode");

      isMock = true;
      const signer = new SignerService();

      // Get the quote to use real amounts
      const { getEnv } = await import("../config/env.js");
      const env = getEnv();

      // Parse quote data from quoteId to get amounts
      const quoteRecord = await prisma.rateSnapshot.findFirst({
        where: { source: quoteId },
      });

      // Use fallback amounts based on typical exchange rate
      const mockAmountBOB = 200;
      const mockAmountUSDC = mockAmountBOB / 11.73;
      const mockOrderId = `MOCK-${crypto.randomUUID()}`;
      const mockExpiresAt = Date.now() + 300_000; // 5 minutes

      order = {
        id: mockOrderId,
        quoteId,
        side: "BUY",
        status: "PENDIENTE",
        outputAmount: mockAmountUSDC,
        outputCurrency: "USDC",
        outputNetwork: "POLYGON",
        paymentInstructions: {
          amount: mockAmountBOB,
          currency: "BOB",
          network: "CSL",
          qrBase64: "", // No real QR in mock mode
          expiresAt: mockExpiresAt,
          expiresInSeconds: 300,
        },
        createdAt: Date.now(),
        transactionId: `MOCK-TX-${Date.now()}`,
        manual: false,
      };
    }

    // Store trade record
    const signer = new SignerService();
    const lpAddress = signer.getAddress();

    const trade = await prisma.trade.create({
      data: {
        tradeId: null, // Null for mock/Stereum trades (no on-chain trade)
        userWallet,
        lpAddress,
        amountUSDT: order.outputAmount,
        amountBOB: order.paymentInstructions.amount,
        rate: order.paymentInstructions.amount / order.outputAmount,
        lpSpread: 0,
        platformFee: 0,
        userOpId: order.id,
        status: "pending",
        quoteId,
        qrData: order.paymentInstructions.qrBase64 || "",
      },
    });

    logger.info(
      { orderId: order.id, amountBOB: order.paymentInstructions.amount, dbTradeId: trade.id, isMock },
      isMock ? "Mock order created — ready for simulated payment" : "Stereum order confirmed — QR generated",
    );

    res.json({
      success: true,
      data: {
        orderId: order.id,
        transactionId: order.transactionId,
        dbTradeId: trade.id,
        lpAddress,
        qrBase64: order.paymentInstructions.qrBase64 || null,
        amountBOB: order.paymentInstructions.amount.toFixed(2),
        amountUSDT: order.outputAmount.toFixed(2),
        currency: order.paymentInstructions.currency || "BOB",
        network: order.paymentInstructions.network || "CSL",
        expiresAt: new Date(order.paymentInstructions.expiresAt).toISOString(),
        status: order.status,
        isMock,
        instructions: isMock
          ? "MODO TEST: Presiona 'Simular Pago' para completar la transaccion"
          : "Escanea el QR con tu app bancaria y transfiere el monto exacto en BOB",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error, userWallet, quoteId }, "Failed to create order");
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate QR",
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
