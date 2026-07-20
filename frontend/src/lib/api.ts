const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface Quote {
  quoteId: string;
  amountBOB: number;
  amountUSDT: number;
  rate: number;
  serviceFee: number;
  feeCurrency: string;
  expiresAt: string;
  expiresInSeconds: number;
}

export interface QRResponse {
  orderId: string;
  transactionId: string;
  tradeId: number | null;
  qrBase64: string;
  amountBOB: string;
  amountUSDT: string;
  currency: string;
  network: string;
  expiresAt: string;
  status: string;
}

export interface TradeStatus {
  tradeId: number;
  status: "pending" | "locked" | "released" | "expired";
  userWallet: string;
  lpAddress: string;
  amountUSDT: number;
  amountBOB: number;
  rate: number;
  createdAt: string;
}

export interface LPBalance {
  wallet: string;
  available: number;
  locked: number;
  total: number;
}

async function fetchApi<T>(
  path: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (process.env.NEXT_PUBLIC_API_KEY) {
    headers["x-api-key"] = process.env.NEXT_PUBLIC_API_KEY;
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getQuote(amount: number, wallet: string): Promise<Quote> {
  const result = await fetchApi<Quote>(`/api/quote?amount=${amount}&wallet=${wallet}`);
  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to get quote");
  }
  return result.data;
}

export async function generateQR(
  userWallet: string,
  quoteId: string,
): Promise<QRResponse> {
  const result = await fetchApi<QRResponse>("/api/qr", {
    method: "POST",
    body: JSON.stringify({ userWallet, quoteId }),
  });
  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to generate QR");
  }
  return result.data;
}

export async function getTrade(tradeId: number): Promise<TradeStatus> {
  const result = await fetchApi<TradeStatus>(`/api/trade/${tradeId}`);
  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to get trade");
  }
  return result.data;
}

export async function getLPBalance(wallet: string): Promise<LPBalance> {
  const result = await fetchApi<LPBalance>(`/api/lp/balance?wallet=${wallet}`);
  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to get LP balance");
  }
  return result.data;
}

export interface TradeHistoryItem {
  tradeId: number;
  status: string;
  userWallet: string;
  lpAddress: string;
  amountUSDT: number;
  amountBOB: number;
  rate: number;
  releaseTxHash: string | null;
  createdAt: string;
}

export interface TradeHistoryResponse {
  trades: TradeHistoryItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export async function getTradeHistory(
  wallet: string,
  page = 1,
  limit = 20,
): Promise<TradeHistoryResponse> {
  const result = await fetchApi<TradeHistoryResponse>(
    `/api/trade/history?wallet=${wallet}&page=${page}&limit=${limit}`,
  );
  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to get trade history");
  }
  return result.data;
}
