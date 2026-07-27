import { Router, Request, Response } from "express";
import { StereumService, type StereumWebhookPayload } from "../services/stereum.js";
import { apiLimiter } from "../middleware/rateLimit.js";
import { AppError } from "../middleware/errorHandler.js";
import { PrismaClient } from "@prisma/client";
import pino from "pino";

const logger = pino({ name: "stereum-webhook" });
const router = Router();
const prisma = new PrismaClient();

const ONRAMP_FEE_BPS = 50; // Must match quote.ts

router.post("/", apiLimiter, async (req: Request, res: Response) => {
  const xSignature = req.headers["x-signature"] as string | undefined;
  const xTimestamp = req.headers["x-timestamp"] as string | undefined;

  if (!xSignature || !xTimestamp) {
    throw new AppError("Missing webhook signature headers", 401);
  }

  const stereum = new StereumService();
  const body = JSON.stringify(req.body);

  // Validate HMAC signature from Stereum
  if (!stereum.validateWebhookSignature(body, xSignature, xTimestamp)) {
    logger.warn("Invalid webhook signature");
    throw new AppError("Invalid signature", 401);
  }

  // Validate timestamp (max 2 minutes old)
  if (!stereum.isWebhookTimestampValid(xTimestamp, 120)) {
    logger.warn("Webhook timestamp expired");
    throw new AppError("Timestamp expired", 401);
  }

  const payload: StereumWebhookPayload = req.body;

  logger.info({ notificationType: payload.notification_type, orderId: payload.order?.id }, "Webhook received");

  // Handle test notification (Stereum validates webhook URL)
  if (payload.notification_type === "test") {
    res.json({ success: true, message: "Test notification received" });
    return;
  }

  // Handle order notification
  if (payload.notification_type === "order" && payload.order) {
    const order = payload.order;

    try {
      // Find the trade by Stereum order ID (stored in userOpId)
      const dbTrade = await prisma.trade.findFirst({
        where: { userOpId: order.id },
      });

      if (!dbTrade) {
        logger.warn({ orderId: order.id }, "Trade not found for order");
        res.json({ success: true, message: "Trade not found" });
        return;
      }

      if (order.status === "COMPLETADA" && order.side === "BUY") {
        // Payment completed — Stereum sends USDT directly to user's wallet
        // We just track it + calculate Onramp fee earned
        const onrampFee = dbTrade.amountUSDT * (ONRAMP_FEE_BPS / 10_000);

        await prisma.trade.update({
          where: { id: dbTrade.id },
          data: {
            status: "released",
            releasedAt: new Date(),
            platformFee: ONRAMP_FEE_BPS,
          },
        });

        logger.info(
          {
            orderId: order.id,
            dbTradeId: dbTrade.id,
            userWallet: dbTrade.userWallet,
            amountUSDT: order.output_amount,
            onrampFee,
          },
          "Payment completed — Onramp fee earned",
        );
      } else if (order.status === "CANCELADA") {
        await prisma.trade.update({
          where: { id: dbTrade.id },
          data: { status: "expired", expiredAt: new Date() },
        });

        logger.info({ orderId: order.id }, "Order cancelled");
      }
    } catch (error) {
      logger.error({ error, orderId: order.id }, "Failed to process webhook");
    }
  }

  res.json({ success: true, message: "Webhook processed" });
});

export default router;
