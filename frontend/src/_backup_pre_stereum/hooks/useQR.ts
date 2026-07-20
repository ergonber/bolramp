"use client";

import { useState, useEffect, useRef } from "react";
import { getTrade, type TradeStatus } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface QRData {
  tradeId?: number | null;
  qrImage?: string;
  amountBOB?: string;
  rate?: number;
  bankName?: string;
  accountName?: string;
  userOpId?: string;
  txHash?: string;
  expiresAt: string;
  instructions?: string;
}

export function useQR() {
  const [qrData, setQRData] = useState<QRData | null>(null);
  const [trade, setTrade] = useState<TradeStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const generate = async (userWallet: string, amountUSDT: number) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/qr`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.NEXT_PUBLIC_API_KEY || "",
        },
        body: JSON.stringify({
          userWallet,
          amountUSDT,
          quoteId: crypto.randomUUID(),
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to generate QR");
      }

      setQRData(result.data);

      const expiryTime = new Date(result.data.expiresAt).getTime();
      setTimeLeft(Math.max(0, Math.floor((expiryTime - Date.now()) / 1000)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate QR");
    } finally {
      setLoading(false);
    }
  };

  // Timer countdown
  useEffect(() => {
    if (!qrData) return;

    intervalRef.current = setInterval(() => {
      const expiryTime = new Date(qrData.expiresAt).getTime();
      const remaining = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
      setTimeLeft(remaining);

      if (remaining <= 0 && intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [qrData]);

  // Poll trade status after QR generation
  useEffect(() => {
    if (!qrData?.tradeId) return;

    const pollTradeStatus = async () => {
      try {
        const status = await getTrade(qrData.tradeId!);
        setTrade(status);

        if (status.status === "released" || status.status === "expired") {
          if (pollRef.current) {
            clearInterval(pollRef.current);
          }
        }
      } catch {
        // Silently retry
      }
    };

    // Initial fetch
    pollTradeStatus();

    // Poll every 3 seconds
    pollRef.current = setInterval(pollTradeStatus, 3000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [qrData?.tradeId]);

  const confirmPayment = async (tradeId: number) => {
    try {
      const response = await fetch(`${API_BASE}/api/trade/confirm-payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.NEXT_PUBLIC_API_KEY || "",
        },
        body: JSON.stringify({ tradeId }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to confirm payment");
      }

      setTrade({
        tradeId,
        status: "released",
        userWallet: "",
        lpAddress: "",
        amountUSDT: 0,
        amountBOB: parseFloat(qrData?.amountBOB || "0"),
        rate: qrData?.rate || 0,
        createdAt: new Date().toISOString(),
      });

      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm payment");
      throw err;
    }
  };

  const reset = () => {
    setQRData(null);
    setTrade(null);
    setError(null);
    setTimeLeft(0);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
    }
  };

  return {
    qrData,
    trade,
    loading,
    error,
    timeLeft,
    generate,
    confirmPayment,
    reset,
    status: trade?.status || "pending",
  };
}
