"use client";

import { useState, useEffect, useCallback } from "react";

const MOCK_ADDRESS_KEY = "onramp-test-wallet";
const TEST_ADDRESS = "0xB141d6c0a380D852DE407fD5860646F4e488E9A6";

export function useMockWallet() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(MOCK_ADDRESS_KEY);
    if (stored === "true") setEnabled(true);
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      if (next) {
        localStorage.setItem(MOCK_ADDRESS_KEY, "true");
      } else {
        localStorage.removeItem(MOCK_ADDRESS_KEY);
      }
      return next;
    });
  }, []);

  return {
    enabled,
    address: enabled ? TEST_ADDRESS : undefined,
    toggle,
  };
}
