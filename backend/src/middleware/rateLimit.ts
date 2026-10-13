import rateLimit from "express-rate-limit";
import crypto from "crypto";
import type { Request } from "express";
import { getEnv } from "../config/env.js";

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

// Server-to-server callers (CryptoLu) all share one IP, so keying by IP would
// let every end user share a single bucket. When the request carries our API
// key plus an X-Client-Id we limit per end client; otherwise we fall back to
// the IP (public/untrusted traffic).
function clientKeyGenerator(req: Request): string {
  const env = getEnv();
  const apiKey = req.headers["x-api-key"];
  const clientId = req.headers["x-client-id"];
  if (
    typeof apiKey === "string" &&
    safeCompare(apiKey, env.API_KEY) &&
    typeof clientId === "string" &&
    clientId.trim() !== ""
  ) {
    return `client:${clientId.trim()}`;
  }
  return req.ip ?? "unknown";
}

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  keyGenerator: clientKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many requests, please try again later",
    timestamp: new Date().toISOString(),
  },
});

export const quoteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: clientKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many quote requests",
    timestamp: new Date().toISOString(),
  },
});

export const qrLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: clientKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many QR generation requests",
    timestamp: new Date().toISOString(),
  },
});

export const confirmLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many confirm payment requests",
    timestamp: new Date().toISOString(),
  },
});

export const kycLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many KYC requests",
    timestamp: new Date().toISOString(),
  },
});

export const kycResetLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many KYC reset requests",
    timestamp: new Date().toISOString(),
  },
});


