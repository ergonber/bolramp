import express from "express";
import cors from "cors";
import helmet from "helmet";
import pino from "pino";
import { getEnv } from "./config/env.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authMiddleware } from "./middleware/auth.js";
import quoteRouter from "./routes/quote.js";
import qrRouter from "./routes/qr.js";
import confirmRouter from "./routes/confirm.js";
import tradeRouter from "./routes/trade.js";
import lpRouter from "./routes/lp.js";
import offrampRouter from "./routes/offramp.js";

const logger = pino({ name: "onramp-backend" });

async function main() {
  const env = getEnv();
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS.split(",") }));
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "0.1.0",
    });
  });

  app.use("/api/quote", quoteRouter);
  app.use("/api/qr", qrRouter);
  app.use("/api/trade", tradeRouter);
  app.use("/api/trade", confirmRouter);
  app.use("/api/lp", authMiddleware, lpRouter);
  app.use("/api/offramp", offrampRouter);

  app.use(errorHandler);

  app.listen(env.PORT, () => {
    logger.info(`Onramp backend running on port ${env.PORT}`);
  });
}

main().catch((err) => {
  logger.error(err, "Failed to start server");
  process.exit(1);
});
