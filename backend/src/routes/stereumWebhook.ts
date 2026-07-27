import { Router, Request, Response } from "express";
import { StereumService, type StereumWebhookPayload } from "../services/stereum.js";
import { apiLimiter } from "../middleware/rateLimit.js";
import { PrismaClient } from "@prisma/client";
import pino from "pino";

const logger = pino({ name: "stereum-webhook" });
const router = Router();
const prisma = new PrismaClient();

const ONRAMP_FEE_BPS = 50; // Must match quote.ts

router.post("/", apiLimiter, async (req: Request, res: Response) => {
  try {
    const xSignature = req.headers["x-signature"] as string | undefined;
    const xTimestamp = req.headers["x-timestamp"] as string | undefined;

    if (!xSignature || !xTimestamp) {
      logger.warn("Missing webhook signature headers");
      res.status(401).json({ success: false, error: "Missing signature headers" });
      return;
    }

    const stereum = new StereumService();
    const body = JSON.stringify(req.body);

    // Validate HMAC signature from Stereum
    const isValidSignature = stereum.validateWebhookSignature(body, xSignature, xTimestamp);

    if (!isValidSignature) {
      logger.warn("Invalid webhook signature — checking if test notification");

      // For test notifications (URL validation), accept even with invalid signature
      // Stereum sends { notification_type: "test" } when validating the webhook URL
      const payload = req.body;
      if (payload.notification_type === "test") {
        logger.info("Test notification accepted (URL validation)");
        res.json({ success: true, message: "Test notification received" });
        return;
      }

      // For real order notifications, reject invalid signatures
      res.status(401).json({ success: false, error: "Invalid signature" });
      return;
    }

    // Validate timestamp (max 2 minutes old)
    if (!stereum.isWebhookTimestampValid(xTimestamp, 120)) {
      logger.warn("Webhook timestamp expired");
      res.status(401).json({ success: false, error: "Timestamp expired" });
      return;
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
        // Payment completed — Stereum sends USDC directly to user's wallet
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
            amountUSDC: order.output_amount,
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
    }

    res.json({ success: true, message: "Webhook processed" });
  } catch (error) {
    logger.error({ error }, "Webhook handler crashed");
    // Always return 200 to Stereum to avoid retries on processing errors
    res.json({ success: true, message: "Webhook acknowledged" });
  }
});

export default router;
