import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const API_BASE = __ENV.API_BASE || "http://localhost:3001";
const API_KEY = __ENV.API_KEY || "dev-key-change-in-production";

const successRate = new Rate("success_rate");
const quoteDuration = new Trend("quote_duration");
const qrDuration = new Trend("qr_duration");

export const options = {
  scenarios: {
    quote_load: {
      executor: "constant-arrival-rate",
      rate: 50,
      duration: "30s",
      preAllocatedVUs: 100,
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<2000"],
    success_rate: ["rate>0.9"],
  },
};

const TEST_WALLET = "0x742d35Cc6634C0532925a3b844Bc9e7595f8bE20";

export default function () {
  const headers = {
    "Content-Type": "application/json",
    "x-api-key": API_KEY,
  };

  const amounts = [10, 25, 50, 100, 200];
  const amount = amounts[Math.floor(Math.random() * amounts.length)];

  const quoteRes = http.get(`${API_BASE}/api/quote?amount=${amount}`, {
    headers,
  });

  const quoteOk = check(quoteRes, {
    "quote status 200": (r) => r.status === 200,
    "quote has data": (r) => {
      try {
        return JSON.parse(r.body as string).success === true;
      } catch {
        return false;
      }
    },
  });

  successRate.add(quoteOk);
  quoteDuration.add(quoteRes.timings.duration);

  if (!quoteOk) return;

  let quoteData;
  try {
    quoteData = JSON.parse(quoteRes.body as string).data;
  } catch {
    return;
  }

  const qrRes = http.post(
    `${API_BASE}/api/qr`,
    JSON.stringify({
      userWallet: TEST_WALLET,
      amountUSDT: quoteData.amountUSDT,
      quoteId: "load-test",
    }),
    { headers },
  );

  const qrOk = check(qrRes, {
    "qr status 200": (r) => r.status === 200,
  });

  successRate.add(qrOk);
  qrDuration.add(qrRes.timings.duration);

  sleep(0.1);
}

export function handleSummary(data: any) {
  return {
    stdout: JSON.stringify(
      {
        total_requests: data.metrics.http_reqs?.values.count || 0,
        avg_duration: data.metrics.http_req_duration?.values.avg || 0,
        p95_duration: data.metrics.http_req_duration?.values["p(95)"] || 0,
        success_rate: data.metrics.success_rate?.values.rate || 0,
      },
      null,
      2,
    ),
  };
}
