export interface QuoteRequest {
  amountBOB: number;
}

export interface QuoteResponse {
  amountBOB: number;
  amountUSDT: number;
  rate: number;
  lpSpread: number;
  platformFee: number;
  expiresAt: string;
}

export interface QRRequest {
  userWallet: string;
  amountUSDT: number;
  quoteId: string;
}

export interface QRResponse {
  qrCode: string;
  qrData: string;
  tradeId: number;
  expiresAt: string;
}

export interface WebhookPayload {
  transactionId: string;
  amount: number;
  currency: string;
  status: string;
  timestamp: string;
  signature?: string;
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
  expiresAt: string;
}

export interface LPBalance {
  available: number;
  locked: number;
  total: number;
}

export interface LPDepositRequest {
  lpWallet: string;
  amountUSDT: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}
