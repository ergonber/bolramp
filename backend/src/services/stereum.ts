import { getEnv } from "../config/env.js";
import pino from "pino";
import crypto from "crypto";

const logger = pino({ name: "stereum" });

const BASE_URL = "https://api.stereum.tech";

interface StereumQuoteRequest {
  externalUserId: string;
  side: "BUY" | "SELL";
  inputAmount: number;
  inputCurrency: string;
  inputNetwork?: string;
  outputCurrency: string;
  outputNetwork?: string;
  country?: string;
}

export interface StereumQuoteResponse {
  id: string;
  pair: string;
  side: string;
  inputAmount: number;
  inputCurrency: string;
  outputAmount: number;
  outputCurrency: string;
  exchangeRate: number;
  serviceFee: number;
  feeDetails: string;
  feeCurrency: string;
  expireAt: number;
  expiresInSeconds: number;
}

interface StereumOrderRequest {
  idempotencyKey: string;
  quoteId: string;
  outputNetwork: string;
  outputAccountAddress: string;
}

export interface StereumOrderResponse {
  id: string;
  quoteId: string;
  side: string;
  status: string;
  outputAmount: number;
  outputCurrency: string;
  outputNetwork: string;
  paymentInstructions: {
    amount: number;
    currency: string;
    network: string;
    qrBase64: string;
    expiresAt: number;
    expiresInSeconds: number;
  };
  createdAt: number;
  transactionId: string;
  manual: boolean;
}

export interface StereumWebhookOrder {
  id: string;
  status: string;
  status_description: string;
  side: string;
  input_amount: number;
  input_currency: string;
  output_amount: number;
  output_currency: string;
  exchange_rate: number;
  pair: string;
  created_date: number;
}

export interface StereumWebhookPayload {
  notification_type: string;
  id: string;
  timestamp: number;
  order: StereumWebhookOrder;
}

export class StereumService {
  private apiKey: string;
  private webhookSecret: string;

  constructor() {
    const env = getEnv();
    this.apiKey = env.STEREUM_API_KEY;
    this.webhookSecret = env.STEREUM_WEBHOOK_SECRET || env.STEREUM_API_KEY;
    if (!env.STEREUM_WEBHOOK_SECRET) {
      logger.warn("STEREUM_WEBHOOK_SECRET not set — falling back to API_KEY for HMAC (INSECURE)");
    }
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${BASE_URL}${path}`;
    const headers: Record<string, string> = {
      "x-api-key": this.apiKey,
      "Content-Type": "application/json",
    };

    logger.info({ method, path }, "Stereum API request");

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });

    const responseText = await response.text();

    if (!response.ok) {
      logger.error({ status: response.status, body: responseText }, "Stereum API error");
      throw new Error(`Stereum API error: ${response.status} - ${responseText}`);
    }

    logger.info({ status: response.status }, "Stereum API success");
    return JSON.parse(responseText) as T;
  }

  // ==================== QUOTE ====================

  async createQuote(params: {
    userId: string;
    side: "BUY" | "SELL";
    inputAmount: number;
    inputCurrency: string;
    outputCurrency: string;
  }): Promise<StereumQuoteResponse> {
    const body: StereumQuoteRequest = {
      externalUserId: params.userId,
      side: params.side,
      inputAmount: params.inputAmount,
      inputCurrency: params.inputCurrency,
      inputNetwork: params.side === "BUY" ? "CSL" : "POLYGON",
      outputCurrency: params.outputCurrency,
      outputNetwork: params.side === "BUY" ? "POLYGON" : "CSL",
      country: "BO",
    };

    return this.request<StereumQuoteResponse>("POST", "/api/v1/otc/quotes", body);
  }

  // ==================== ORDER (CONFIRM QUOTE) ====================

  async confirmOrder(params: {
    quoteId: string;
    walletAddress: string;
    network?: string;
  }): Promise<StereumOrderResponse> {
    const body: StereumOrderRequest = {
      idempotencyKey: crypto.randomUUID(),
      quoteId: params.quoteId,
      outputNetwork: params.network || "POLYGON",
      outputAccountAddress: params.walletAddress,
    };

    return this.request<StereumOrderResponse>("POST", "/api/v1/otc/orders", body);
  }

  // ==================== BANKS ====================

  async getBanks(): Promise<Array<{ type: string; code: string; description: string; icon: string }>> {
    return this.request("GET", "/api/v1/banks?country=BO");
  }

  // ==================== WEBHOOK VALIDATION ====================

  /**
   * Validate webhook signature against raw body.
   * Tries two variants per manual ambiguity:
   *   a) HMAC(secret, rawBody)
   *   b) HMAC(secret, `${timestamp}.${rawBody}`)
   * Returns which variant matched (or null if none).
   */
  validateWebhookSignature(
    rawBody: Buffer,
    signature: string,
    timestamp: string | undefined,
  ): "body" | "timestamp.body" | null {
    const sigBuf = Buffer.from(signature, "hex");
    if (sigBuf.length !== 32) return null;

    // Variant a: HMAC(secret, rawBody)
    const hmacA = crypto.createHmac("sha256", this.webhookSecret).update(rawBody).digest();
    if (sigBuf.length === hmacA.length && crypto.timingSafeEqual(sigBuf, hmacA)) {
      logger.info("HMAC matched variant: rawBody");
      return "body";
    }

    // Variant b: HMAC(secret, `${timestamp}.${rawBody}`)
    if (timestamp) {
      const payload = Buffer.concat([Buffer.from(`${timestamp}.`, "utf8"), rawBody]);
      const hmacB = crypto.createHmac("sha256", this.webhookSecret).update(payload).digest();
      if (sigBuf.length === hmacB.length && crypto.timingSafeEqual(sigBuf, hmacB)) {
        logger.info("HMAC matched variant: timestamp.body");
        return "timestamp.body";
      }
    }

    logger.warn(
      {
        expectedPrefixA: hmacA.toString("hex").slice(0, 16) + "...",
        receivedPrefix: signature.slice(0, 16) + "...",
      },
      "HMAC mismatch — no variant matched",
    );
    return null;
  }

  isWebhookTimestampValid(timestamp: string, maxAgeSeconds = 120): boolean {
    const now = Math.floor(Date.now() / 1000);
    const webhookTime = parseInt(timestamp, 10);
    if (isNaN(webhookTime)) return false;
    return Math.abs(now - webhookTime) <= maxAgeSeconds;
  }
}
