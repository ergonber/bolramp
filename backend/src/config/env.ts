import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3001),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),

  OPERATOR_PRIVATE_KEY: z.string().min(64),
  ESCROW_CONTRACT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  POLYGON_RPC_URL: z.string().url(),
  CHAIN_ID: z.coerce.number().default(80002),

  STEREUM_API_KEY: z.string().min(1),

  LP_SPREAD_BPS: z.coerce.number().default(50),
  PLATFORM_FEE_BPS: z.coerce.number().default(50),
  QUOTE_EXPIRY_SECONDS: z.coerce.number().default(120),
  TRADE_EXPIRY_SECONDS: z.coerce.number().default(300),

  API_KEY: z.string().min(1),
  JWT_SECRET: z.string().min(32).default("dev-jwt-secret-change-in-production"),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  SENTRY_DSN: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function getEnv(): Env {
  if (!_env) {
    _env = envSchema.parse(process.env);
  }
  return _env;
}
