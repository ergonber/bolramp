import { Router, Request, Response } from "express";
import { StereumService, type StereumWebhookPayload } from "../services/stereum.js";
import { PrismaClient } from "@prisma/client";
import pino from "pino";

const logger = pino({ name: "stereum-webhook" });
const router = Router();
const prisma = new PrismaClient();

const ONRAMP_FEE_BPS = 50; // Must match quote.ts

router.post("/", async (req: Request, res: Response) => {
  const xSignature = req.headers["x-signature"] as string | undefined;
  const xTimestamp = req.headers["x-timestamp"] as string | undefined;

  logger.info(
    {
      notification_type: req.body?.notification_type,
      hasSignature: !!xSignature,
      hasTimestamp: !!xTimestamp,
      bodyKeys: Object.keys(req.body || {}),
    },
    "Webhook received",
  );

  try {
    const payload = req.body;

    // === 1) TEST NOTIFICATION — Stereum URL validation ===
    if (payload.notification_type === "test") {
      logger.info("Test notification accepted (URL validation)");
      res.status(200).json({ success: true, message: "Test notification received" });
      return;
    }

    // === 2) HMAC VALIDATION (optional — only when headers are present) ===
    if (xSignature && xTimestamp) {
      const stereum = new StereumService();
      const body = JSON.stringify(req.body);

      const isValidSignature = stereum.validateWebhookSignature(body, xSignature, xTimestamp);

      if (!isValidSignature) {
        logger.warn({ receivedSig: xSignature?.slice(0, 8) + "..." }, "Invalid webhook signature — REJECTED");
        res.status(403).json({ success: false, error: "Invalid signature" });
        return;
      }

      logger.info("HMAC signature validated OK");

      // Validate timestamp only when header is present (max 5 minutes)
      if (!stereum.isWebhookTimestampValid(xTimestamp, 300)) {
        logger.warn({ xTimestamp }, "Webhook timestamp expired");
        res.status(403).json({ success: false, error: "Timestamp expired" });
        return;
      }
    } else {
      // No signature headers — accept anyway (testing/manual mode)
      logger.warn("No HMAC headers — processing without signature validation");
    }

    // === 3) HANDLE ORDER NOTIFICATION ===
    if (payload.notification_type === "order" && payload.order) {
      const order = payload.order;

      logger.info(
        {
          orderId: order.id,
          status: order.status,
          status_description: order.status_description,
          side: order.side,
          input_amount: order.input_amount,
          output_amount: order.output_amount,
          output_currency: order.output_currency,
          pair: order.pair,
        },
        "Order notification received — processing",
      );

      // Find the trade by Stereum order ID (stored in userOpId)
      const dbTrade = await prisma.trade.findFirst({
        where: { userOpId: order.id },
      });

      if (!dbTrade) {
        logger.warn({ orderId: order.id }, "Trade not found for this order — no DB update");
        res.status(200).json({ success: true, message: "Trade not found" });
        return;
      }

      if (order.status === "COMPLETADA" && order.side === "BUY") {
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
          },
          "Payment completed — trade released",
        );
      } else if (order.status === "CANCELADA") {
        await prisma.trade.update({
          where: { id: dbTrade.id },
          data: { status: "expired", expiredAt: new Date() },
        });

        logger.info({ orderId: order.id, dbTradeId: dbTrade.id }, "Order cancelled — trade expired");
      } else {
        logger.info({ orderId: order.id, status: order.status }, "Unhandled order status");
      }
    } else {
      logger.warn({ notification_type: payload?.notification_type }, "Unknown notification type");
    }

    res.status(200).json({ success: true, message: "Webhook processed" });
  } catch (error) {
    logger.error({ error }, "Webhook handler crashed");
    // Always return 200 to Stereum to avoid retries on processing errors
    res.status(200).json({ success: true, message: "Webhook acknowledged" });
  }
});

router.get("/", (_req: Request, res: Response) => {
  res.json({ success: true, message: "Stereum webhook endpoint is live" });
});

export default router;
