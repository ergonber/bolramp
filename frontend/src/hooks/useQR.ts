"use client";

import { useState, useEffect, useRef } from "react";
import { getTrade, type TradeStatus } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface QRData {
  orderId?: string;
  transactionId?: string;
  tradeId?: number | null;
  qrBase64?: string;
  amountBOB?: string;
  amountUSDT?: string;
  currency?: string;
  network?: string;
  expiresAt: string;
  instructions?: string;
  status?: string;
}

export function useQR() {
  const [qrData, setQRData] = useState<QRData | null>(null);
  const [trade, setTrade] = useState<TradeStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const generate = async (userWallet: string, quoteId: string) => {
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
          quoteId,
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

  // Poll trade status (for on-chain release after webhook)
  useEffect(() => {
    if (!qrData?.tradeId || qrData.tradeId <= 0) return;

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

    pollTradeStatus();
    pollRef.current = setInterval(pollTradeStatus, 3000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [qrData?.tradeId]);

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
    reset,
    status: qrData?.status === "PENDIENTE" ? "pending" : trade?.status || "pending",
  };
}
