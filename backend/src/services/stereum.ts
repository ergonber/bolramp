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
  private webhookSecrets: Array<string | Buffer>;

  constructor() {
    const env = getEnv();
    this.apiKey = env.STEREUM_API_KEY;

    // Empirically verified (ST-SIS-0008 test webhook): URL validation signs
    // with HMAC-SHA256(API_KEY, rawBody). Real order notifications use a
    // different key (the Secret), so we try every plausible candidate:
    // the API key, the secret as text, and the secret decoded from hex.
    this.webhookSecrets = [env.STEREUM_API_KEY];

    const secret = env.STEREUM_WEBHOOK_SECRET;
    if (secret && secret !== env.STEREUM_API_KEY) {
      this.webhookSecrets.push(secret);
      if (/^[0-9a-fA-F]+$/.test(secret) && secret.length % 2 === 0) {
        this.webhookSecrets.push(Buffer.from(secret, "hex"));
      }
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
   * Validate webhook signature against the raw body.
   *
   * Verified format: HMAC-SHA256(API_KEY, rawBody). We still try the
   * documented `timestamp.body` variant and any STEREUM_WEBHOOK_SECRET for
   * forward compatibility. Raw bytes are used (never a re-serialized JSON).
   *
   * @returns the matching variant name, or null if none matched.
   */
  validateWebhookSignature(
    rawBody: Buffer,
    signature: string,
    timestamp: string | undefined,
  ): "body" | "timestamp.body" | null {
    const sigBuf = Buffer.from(signature, "hex");
    if (sigBuf.length !== 32) return null;

    const variants: Array<{ name: "body" | "timestamp.body"; payload: Buffer }> = [
      { name: "body", payload: rawBody },
    ];
    if (timestamp) {
      variants.push({
        name: "timestamp.body",
        payload: Buffer.concat([Buffer.from(`${timestamp}.`, "utf8"), rawBody]),
      });
    }

    for (const secret of this.webhookSecrets) {
      for (const variant of variants) {
        const hmac = crypto.createHmac("sha256", secret).update(variant.payload).digest();
        if (hmac.length === sigBuf.length && crypto.timingSafeEqual(sigBuf, hmac)) {
          logger.info({ variant: variant.name }, "HMAC matched");
          return variant.name;
        }
      }
    }

    logger.warn(
      { receivedPrefix: signature.slice(0, 16) + "..." },
      "HMAC mismatch — no variant/key matched",
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
