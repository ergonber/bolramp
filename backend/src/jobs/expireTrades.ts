import { PrismaClient } from "@prisma/client";
import { getEnv } from "../config/env.js";
import pino from "pino";

const logger = pino({ name: "expire-trades" });

/**
 * Safety net: mark pending trades as expired once their QR window has passed,
 * even if the Stereum cancellation webhook never arrives. This prevents trades
 * from being stuck in `pending` forever.
 */
export function startExpireTradesJob(): void {
  const env = getEnv();
  const prisma = new PrismaClient();
  const intervalMs = 2 * 60 * 1000; // every 2 minutes
  const graceSeconds = 300; // extra grace before expiring locally

  const run = async () => {
    try {
      const cutoff = new Date(
        Date.now() - (env.TRADE_EXPIRY_SECONDS + graceSeconds) * 1000,
      );
      const result = await prisma.trade.updateMany({
        where: { status: "pending", createdAt: { lt: cutoff } },
        data: { status: "expired", expiredAt: new Date() },
      });
      if (result.count > 0) {
        logger.info({ count: result.count }, "Expired stale pending trades");
      }
    } catch (error) {
      logger.error({ error }, "Failed to expire stale trades");
    }
  };

  setInterval(() => {
    void run();
  }, intervalMs);

  logger.info({ intervalMs, graceSeconds }, "Trade expiry job started");
}
