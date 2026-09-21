import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { getEnv } from "../config/env.js";

export interface AuthPayload {
  apiKey?: string;
  wallet?: string;
  role?: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
      rawBody?: Buffer;
    }
  }
}

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const env = getEnv();

  // Try JWT first
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.slice(7);
      const payload = verifyJWT(token, env.JWT_SECRET);
      req.auth = { wallet: payload.wallet, role: payload.role };
      return next();
    } catch {
      // Fall through to API key
    }
  }

  // Fallback to API key
  const apiKey = req.headers["x-api-key"];
  if (!apiKey || typeof apiKey !== "string" || !safeCompare(apiKey, env.API_KEY)) {
    res.status(401).json({
      success: false,
      error: "Invalid API key",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  req.auth = { apiKey };
  next();
}

function verifyJWT(token: string, secret: string): { wallet: string; role: string } {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");

  const [header, payload, signature] = parts;

  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");

  if (!safeCompare(signature, expectedSig)) throw new Error("Invalid JWT signature");

  const data = JSON.parse(Buffer.from(payload, "base64url").toString());

  if (data.exp && data.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("JWT expired");
  }

  return data;
}
