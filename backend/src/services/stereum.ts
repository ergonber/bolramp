import { getEnv } from "../config/env.js";
import pino from "pino";

const logger = pino({ name: "stereum" });

const BASE_URL = "https://api.stereum.tech";

interface StereumQuoteRequest {
  externalUserId: string;
  side: "BUY" | "SELL";
  inputAmount: number;
  inputCurrency: string;
  outputCurrency: string;
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

  constructor() {
    const env = getEnv();
    this.apiKey = env.STEREUM_API_KEY;
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
      outputCurrency: params.outputCurrency,
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

  validateWebhookSignature(payload: string, signature: string, timestamp: string): boolean {
    const crypto = require("crypto");
    const expectedSignature = crypto
      .createHmac("sha256", this.apiKey)
      .update(`${timestamp}.${payload}`)
      .digest("hex");

    return signature === expectedSignature;
  }

  isWebhookTimestampValid(timestamp: string, maxAgeSeconds = 120): boolean {
    const now = Math.floor(Date.now() / 1000);
    const webhookTime = parseInt(timestamp, 10);
    return Math.abs(now - webhookTime) <= maxAgeSeconds;
  }
}
