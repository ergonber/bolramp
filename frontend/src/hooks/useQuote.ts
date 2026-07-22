"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { getQuote, type Quote } from "@/lib/api";

export function useQuote(amount: number | null, walletOverride?: string) {
  const { address: wagmiAddress } = useAccount();
  const address = walletOverride || wagmiAddress;
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQuote = useCallback(async () => {
    if (!amount || amount <= 0 || !address) {
      setQuote(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getQuote(amount, address);
      setQuote(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch quote";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [amount, address]);

  useEffect(() => {
    fetchQuote();
    const interval = setInterval(fetchQuote, 30000);
    return () => clearInterval(interval);
  }, [fetchQuote]);

  return { quote, loading, error, refetch: fetchQuote };
}
