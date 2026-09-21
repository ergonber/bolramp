import express from "express";
import cors from "cors";
import helmet from "helmet";
import pino from "pino";
import { getEnv } from "./config/env.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { errorHandler } from "./middleware/errorHandler.js";
import quoteRouter from "./routes/quote.js";
import qrRouter from "./routes/qr.js";
import tradeRouter from "./routes/trade.js";
import offrampRouter from "./routes/offramp.js";
import stereumWebhookRouter from "./routes/stereumWebhook.js";
import kycRouter from "./routes/kyc.js";
import adminRouter from "./routes/admin.js";

const logger = pino({ name: "onramp-backend" });

async function main() {
  const env = getEnv();
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS.split(",") }));
  app.use(express.json({
    verify: (req, _res, buf) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (req as any).rawBody = buf;
    },
  }));

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "0.1.0",
    });
  });

  // Stereum webhook (no auth — Stereum validates via HMAC signature)
  app.use("/api/webhook/stereum", stereumWebhookRouter);

  app.use("/api/quote", quoteRouter);
  app.use("/api/qr", qrRouter);
  app.use("/api/trade", tradeRouter);
  app.use("/api/offramp", offrampRouter);
  app.use("/api/kyc", kycRouter);
  app.use("/api/admin", adminRouter);

  app.use(errorHandler);

  app.listen(env.PORT, () => {
    logger.info(`Onramp backend running on port ${env.PORT}`);

    // Keep-alive: ping self every 10 minutes to prevent Render free tier sleep
    if (env.NODE_ENV === "production") {
      const KEEP_ALIVE_MS = 10 * 60 * 1000; // 10 minutes
      setInterval(async () => {
        try {
          const res = await fetch(`http://localhost:${env.PORT}/health`);
          logger.debug({ status: res.status }, "Keep-alive ping");
        } catch {
          logger.warn("Keep-alive ping failed");
        }
      }, KEEP_ALIVE_MS);
      logger.info("Keep-alive scheduler started (every 10 min)");
    }
  });
}

main().catch((err) => {
  logger.error(err, "Failed to start server");
  process.exit(1);
});
