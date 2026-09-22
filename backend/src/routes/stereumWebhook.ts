import { Router, Request, Response } from "express";
import { StereumService } from "../services/stereum.js";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middleware/auth.js";
import pino from "pino";

const logger = pino({ name: "stereum-webhook" });
const router = Router();
const prisma = new PrismaClient();

const ONRAMP_FEE_BPS = 50; // Must match quote.ts

// ==================== POST / — Stereum webhook receiver ====================

router.post("/", async (req: Request, res: Response) => {
  const xSignature = req.headers["x-signature"] as string | undefined;
  const xTimestamp = req.headers["x-timestamp"] as string | undefined;
  const rawBody = req.rawBody;
  const notificationType = req.body?.notification_type as string | undefined;

  logger.info(
    {
      notification_type: notificationType,
      hasSignature: !!xSignature,
      hasTimestamp: !!xTimestamp,
      hasRawBody: !!rawBody,
      rawBodyLength: rawBody?.length,
      bodyKeys: Object.keys(req.body || {}),
    },
    "Webhook received",
  );

  // === 1) TEST NOTIFICATION — respond 200 IMMEDIATELY ===
  // Stereum sends this to validate the URL before saving it.
  // Must respond 200 regardless of signature validity.
  if (notificationType === "test") {
    logger.info("Test notification accepted — URL validation OK");

    await logWebhook(prisma, {
      source: "stereum",
      payload: JSON.stringify(req.body),
      signature: xSignature ?? null,
      processed: true,
      notificationType: "test",
      stereumOrderId: null,
    });

    res.status(200).json({ success: true, message: "Test notification received" });
    return;
  }

  // === 2) HMAC VALIDATION (required for order/transaction notifications) ===
  // SANDBOX ONLY: STEREUM_WEBHOOK_INSECURE=true accepts notifications without
  // verifying the signature. NEVER enable in production.
  const insecure = process.env.STEREUM_WEBHOOK_INSECURE === "true";

  if (insecure) {
    logger.warn("STEREUM_WEBHOOK_INSECURE=true — skipping signature validation (SANDBOX ONLY)");
    await logWebhook(prisma, {
      source: "stereum",
      payload: JSON.stringify(req.body),
      signature: xSignature ?? null,
      processed: true,
      notificationType: notificationType ?? "unknown",
      stereumOrderId: req.body?.order?.id ?? null,
      error: "insecure-mode: signature not verified",
    });
  } else {
    if (!rawBody) {
      logger.error("No rawBody captured — cannot validate HMAC");
      await logWebhook(prisma, {
        source: "stereum",
        payload: JSON.stringify(req.body),
        signature: xSignature ?? null,
        processed: false,
        notificationType: notificationType ?? "unknown",
        stereumOrderId: req.body?.order?.id ?? null,
        error: "No rawBody captured",
      });
      res.status(400).json({ success: false, error: "Missing raw body" });
      return;
    }

    if (!xSignature || !xTimestamp) {
      logger.warn("Missing HMAC headers — rejecting");
      await logWebhook(prisma, {
        source: "stereum",
        payload: JSON.stringify(req.body),
        signature: null,
        processed: false,
        notificationType: notificationType ?? "unknown",
        stereumOrderId: req.body?.order?.id ?? null,
        error: "Missing x-signature or x-timestamp header",
      });
      res.status(403).json({ success: false, error: "Missing signature headers" });
      return;
    }

    const stereum = new StereumService();

    // Freshness check.
    // Stereum's `x-timestamp` header is consistently 4 hours behind real UTC
    // (it uses the local Bolivia clock). The notification body carries its own
    // `timestamp` in ms (and is covered by the HMAC), so prefer it. Fall back
    // to the header with a tolerant window when the body timestamp is absent.
    const bodyTs =
      typeof req.body?.timestamp === "number"
        ? Math.floor(req.body.timestamp / 1000)
        : null;
    const nowSec = Math.floor(Date.now() / 1000);
    const fresh =
      bodyTs !== null
        ? Math.abs(nowSec - bodyTs) <= 300
        : stereum.isWebhookTimestampValid(xTimestamp, 6 * 3600);

    if (!fresh) {
      logger.warn({ xTimestamp, bodyTs, nowSec }, "Webhook timestamp too old");
      await logWebhook(prisma, {
        source: "stereum",
        payload: JSON.stringify(req.body),
        signature: xSignature,
        processed: false,
        notificationType: notificationType ?? "unknown",
        stereumOrderId: req.body?.order?.id ?? null,
        error: `Timestamp expired: header=${xTimestamp} body=${bodyTs}`,
      });
      res.status(403).json({ success: false, error: "Timestamp expired" });
      return;
    }

    // Validate HMAC (tries API key / secret, body / timestamp.body)
    const matchVariant = stereum.validateWebhookSignature(rawBody, xSignature, xTimestamp);

    if (!matchVariant) {
      logger.warn(
        { receivedSig: xSignature.slice(0, 16) + "...", xTimestamp },
        "HMAC validation FAILED — REJECTED",
      );
      await logWebhook(prisma, {
        source: "stereum",
        payload: JSON.stringify(req.body),
        signature: xSignature,
        processed: false,
        notificationType: notificationType ?? "unknown",
        stereumOrderId: req.body?.order?.id ?? null,
        error: "HMAC mismatch",
      });
      res.status(403).json({ success: false, error: "Invalid signature" });
      return;
    }

    logger.info({ variant: matchVariant }, "HMAC validation OK");
  }

  // === 3) HANDLE NOTIFICATIONS ===
  try {
    if (notificationType === "order" && req.body.order) {
      await handleOrderNotification(prisma, req.body);
    } else if (notificationType === "transaction") {
      logger.info({ payload: req.body }, "Transaction notification received — logged only");
    } else {
      logger.warn({ notification_type: notificationType }, "Unknown notification type");
    }

    res.status(200).json({ success: true, message: "Webhook processed" });
  } catch (error) {
    logger.error({ error }, "Webhook handler crashed");
    // Always return 200 to Stereum to avoid retries on processing errors
    res.status(200).json({ success: true, message: "Webhook acknowledged" });
  }
});

// ==================== GET / — Health check ====================

router.get("/", (_req: Request, res: Response) => {
  res.json({ success: true, message: "Stereum webhook endpoint is live" });
});

// ==================== GET /logs — Webhook logs (auth required) ====================

router.get("/logs", authMiddleware, async (_req: Request, res: Response) => {
  try {
    const logs = await prisma.webhookLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    res.json({
      success: true,
      data: logs.map((log) => {
        let payload: unknown = null;
        try {
          payload = JSON.parse(log.payload);
        } catch {
          payload = log.payload;
        }

        const notificationType =
          payload && typeof payload === "object" && "notification_type" in payload
            ? (payload as { notification_type?: string }).notification_type ?? null
            : null;

        return {
          id: log.id,
          source: log.source,
          notificationType,
          payload,
          signature: log.signature ? log.signature.slice(0, 16) + "..." : null,
          processed: log.processed,
          tradeId: log.tradeId,
          error: log.error,
          createdAt: log.createdAt.toISOString(),
        };
      }),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error }, "Failed to fetch webhook logs");
    res.status(500).json({ success: false, error: "Failed to fetch logs" });
  }
});

// ==================== HELPERS ====================

async function handleOrderNotification(
  prisma: PrismaClient,
  body: { order: { id: string; status: string; side: string; output_amount: number; status_description?: string } },
) {
  const order = body.order;

  logger.info(
    {
      orderId: order.id,
      status: order.status,
      status_description: order.status_description,
      side: order.side,
      output_amount: order.output_amount,
    },
    "Order notification — processing",
  );

  // Find the trade by Stereum order ID (stored in userOpId)
  const dbTrade = await prisma.trade.findFirst({
    where: { userOpId: order.id },
  });

  if (!dbTrade) {
    logger.warn({ orderId: order.id }, "Trade not found for this order — no DB update");
    return;
  }

  // Idempotency: skip if already finalised
  if (dbTrade.status === "released" || dbTrade.status === "expired") {
    logger.info(
      { orderId: order.id, dbTradeId: dbTrade.id, currentStatus: dbTrade.status },
      "Trade already finalised — skipping",
    );
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
  } else if (order.status === "ERROR") {
    logger.error(
      { orderId: order.id, dbTradeId: dbTrade.id, status_description: order.status_description },
      "Order error — trade unchanged",
    );
  } else {
    logger.info({ orderId: order.id, status: order.status }, "Unhandled order status");
  }
}

async function logWebhook(
  prisma: PrismaClient,
  opts: {
    source: string;
    payload: string;
    signature: string | null;
    processed: boolean;
    notificationType: string;
    stereumOrderId: string | null;
    error?: string;
  },
) {
  try {
    await prisma.webhookLog.create({
      data: {
        source: opts.source,
        payload: opts.payload,
        signature: opts.signature,
        processed: opts.processed,
        tradeId: null,
        error: opts.error ?? null,
      },
    });
  } catch (err) {
    logger.error({ err }, "Failed to write webhook log");
  }
}

export default router;
