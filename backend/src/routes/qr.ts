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
const BASE_URL = "https://api.stereum.tech";

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
    let order: any;

    if (process.env.STEREUM_MOCK_KYC === "true") {
      // Fetch the original quote to get correct amounts
      const quoteRes = await fetch(
        `${BASE_URL}/v1/otc/quotes/${quoteId}`,
        { headers: { "x-api-key": process.env.STEREUM_API_KEY || "" } }
      ).catch(() => null);

      let amountBOB = 100;
      let amountUSDT = 8.55;

      if (quoteRes?.ok) {
        const q = await quoteRes.json();
        amountBOB = q.inputAmount || q.amount || 100;
        amountUSDT = q.outputAmount || 8.55;
      }

      logger.info({ userWallet, quoteId, amountBOB, amountUSDT }, "QR generation using MOCK mode");
      order = {
        id: `MOCK-ORDER-${Date.now()}`,
        quoteId,
        side: "BUY",
        status: "PENDING",
        outputAmount: amountUSDT,
        outputCurrency: "USDT",
        outputNetwork: "POLYGON",
        paymentInstructions: {
          amount: amountBOB,
          currency: "BOB",
          network: "POLYGON",
          qrBase64: "",
          expiresAt: Date.now() + 300000,
          expiresInSeconds: 300,
        },
        createdAt: Date.now(),
        transactionId: `MOCK-TX-${Date.now()}`,
        manual: false,
      };
    } else {
      const stereum = new StereumService();
      order = await stereum.confirmOrder({
        quoteId,
        walletAddress: userWallet,
        network: "POLYGON",
      });
    }

    // Create trade in DB
    let tradeId: number | null = null;
    let dbTradeId: number | null = null;

    if (process.env.STEREUM_MOCK_KYC === "true") {
      // Mock mode: create trade with negative tradeId to avoid conflicts
      const mockTradeId = -Math.floor(Date.now() / 1000);
      const trade = await prisma.trade.create({
        data: {
          tradeId: mockTradeId,
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
          qrData: "",
        },
      });
      tradeId = trade.tradeId;
      dbTradeId = trade.id;
    } else {
      const trade = await prisma.trade.create({
        data: {
          tradeId: 0,
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
      tradeId = trade.tradeId;
      dbTradeId = trade.id;
    }

    logger.info(
      { orderId: order.id, transactionId: order.transactionId, amountBOB: order.paymentInstructions.amount },
      "Stereum order confirmed",
    );

    res.json({
      success: true,
      data: {
        orderId: order.id,
        transactionId: order.transactionId,
        tradeId,
        dbTradeId,
        qrBase64: order.paymentInstructions.qrBase64 || null,
        amountBOB: order.paymentInstructions.amount.toFixed(2),
        amountUSDT: order.outputAmount.toFixed(2),
        currency: order.paymentInstructions.currency,
        network: order.paymentInstructions.network,
        expiresAt: new Date(order.paymentInstructions.expiresAt).toISOString(),
        status: order.status,
        instructions: process.env.STEREUM_MOCK_KYC === "true"
          ? `Orden confirmada. Transfiere ${order.paymentInstructions.amount.toFixed(2)} BOB a la cuenta indicada por Stereum Pay.`
          : "Escanea el QR con tu app bancaria y transfiere el monto exacto en BOB",
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
