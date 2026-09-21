#!/usr/bin/env tsx
/**
 * Test script for Stereum webhook endpoint.
 *
 * Usage:
 *   npx tsx scripts/test-webhook.ts [notification_type]
 *
 * notification_type: "test" (default), "order", "transaction"
 *
 * Loads STEREUM_WEBHOOK_SECRET (or STEREUM_API_KEY) from backend/.env
 * and sends a signed POST to the local webhook endpoint.
 */

import crypto from "crypto";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const API_BASE =
  process.env.WEBHOOK_BASE_URL ||
  `http://localhost:${process.env.PORT || 3001}`;
const WEBHOOK_URL = `${API_BASE}/api/webhook/stereum`;

const notificationType = (process.argv[2] as string) || "test";

function getSecret(): string {
  // Confirmed: Stereum signs with the API KEY as the HMAC key.
  const secret = process.env.STEREUM_API_KEY || process.env.STEREUM_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("Set STEREUM_API_KEY (or STEREUM_WEBHOOK_SECRET) in .env");
  }
  return secret;
}

function buildPayload(type: string): string {
  if (type === "test") {
    return JSON.stringify({
      notification_type: "test",
      hello: "world",
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    });
  }

  if (type === "order") {
    return JSON.stringify({
      notification_type: "order",
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      order: {
        id: crypto.randomUUID(),
        status: "COMPLETADA",
        status_description: "Completada",
        side: "BUY",
        input_amount: 100,
        input_currency: "BOB",
        output_amount: 8.43,
        output_currency: "USDC",
        exchange_rate: 11.65,
        pair: "BOB_USDC",
        created_date: Date.now(),
      },
    });
  }

  if (type === "transaction") {
    return JSON.stringify({
      notification_type: "transaction",
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      transaction: {
        id: crypto.randomUUID(),
        status: "COMPLETED",
        amount: 8.43,
        currency: "USDC",
      },
    });
  }

  throw new Error(`Unknown notification_type: ${type}`);
}

async function main() {
  const secret = getSecret();
  const rawBody = buildPayload(notificationType);
  const timestamp = Math.floor(Date.now() / 1000).toString();

  // Compute both HMAC variants
  const hmacBody = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const hmacTimestampBody = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  console.log("=== Stereum Webhook Test ===");
  console.log(`URL:            ${WEBHOOK_URL}`);
  console.log(`Notification:   ${notificationType}`);
  console.log(`Timestamp:      ${timestamp}`);
  console.log(`Payload length: ${rawBody.length} bytes`);
  console.log();
  console.log("Payload:");
  console.log(rawBody);
  console.log();
  console.log("HMAC (rawBody):         ", hmacBody.slice(0, 32) + "...");
  console.log("HMAC (timestamp.body):  ", hmacTimestampBody.slice(0, 32) + "...");
  console.log();

  // Confirmed format: HMAC(API_KEY, rawBody) — variant A
  const signature = hmacBody;

  console.log(`Sending with x-signature: ${signature.slice(0, 32)}...`);
  console.log(`Sending with x-timestamp: ${timestamp}`);
  console.log();

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-signature": signature,
        "x-timestamp": timestamp,
      },
      body: rawBody,
    });

    const result = await response.json();
    console.log(`Response: ${response.status}`);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Request failed:", err);
    process.exit(1);
  }
}

main();
