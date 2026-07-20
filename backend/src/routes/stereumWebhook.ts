import { Router, Request, Response } from "express";
import { StereumService, type StereumWebhookPayload } from "../services/stereum.js";
import { SignerService } from "../services/signer.js";
import { EscrowService } from "../services/escrow.js";
import { apiLimiter } from "../middleware/rateLimit.js";
import { AppError } from "../middleware/errorHandler.js";
import { PrismaClient } from "@prisma/client";
import pino from "pino";

const logger = pino({ name: "stereum-webhook" });
const router = Router();
const prisma = new PrismaClient();

router.post("/", apiLimiter, async (req: Request, res: Response) => {
  const xSignature = req.headers["x-signature"] as string | undefined;
  const xTimestamp = req.headers["x-timestamp"] as string | undefined;

  if (!xSignature || !xTimestamp) {
    throw new AppError("Missing webhook signature headers", 401);
  }

  const stereum = new StereumService();
  const body = JSON.stringify(req.body);

  // Validate signature
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

  // Handle test notification
  if (payload.notification_type === "test") {
    res.json({ success: true, message: "Test notification received" });
    return;
  }

  // Handle order notification
  if (payload.notification_type === "order" && payload.order) {
    const order = payload.order;

    try {
      // Find the trade by Stereum order ID
      const dbTrade = await prisma.trade.findFirst({
        where: { userOpId: order.id },
      });

      if (!dbTrade) {
        logger.warn({ orderId: order.id }, "Trade not found for order");
        res.json({ success: true, message: "Trade not found" });
        return;
      }

      if (order.status === "COMPLETADA" && order.side === "BUY") {
        // Payment completed — Stereum will send USDT to the user's wallet
        // We need to lock trade on-chain and release
        if (dbTrade.tradeId && dbTrade.tradeId > 0) {
          const escrow = new EscrowService();
          const signer = new SignerService();

          const onChainTrade = await escrow.getTrade(dbTrade.tradeId);

          if (onChainTrade.status === 1) {
            // Locked — sign and release
            const signature = await signer.signRelease(
              dbTrade.tradeId,
              onChainTrade.user,
              onChainTrade.amountUSDT,
              onChainTrade.userOpId,
            );

            const releaseTx = await escrow.release(dbTrade.tradeId, signature);

            await prisma.trade.update({
              where: { id: dbTrade.id },
              data: {
                status: "released",
                releaseTxHash: releaseTx.hash,
                releasedAt: new Date(),
              },
            });

            logger.info({ tradeId: dbTrade.tradeId, txHash: releaseTx.hash }, "Trade released via Stereum webhook");
          }
        } else {
          // No on-chain trade yet — just update DB status
          await prisma.trade.update({
            where: { id: dbTrade.id },
            data: {
              status: "released",
              releasedAt: new Date(),
            },
          });

          logger.info({ orderId: order.id }, "Order completed (off-chain)");
        }
      } else if (order.status === "CANCELADA") {
        await prisma.trade.update({
          where: { id: dbTrade.id },
          data: { status: "expired" },
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
