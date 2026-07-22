"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

const MOCK_ADDRESS_KEY = "onramp-test-wallet";
const TEST_ADDRESS = "0xB141d6c0a380D852DE407fD5860646F4e488E9A6";

interface MockWalletCtx {
  enabled: boolean;
  address: string | undefined;
  toggle: () => void;
}

const Ctx = createContext<MockWalletCtx>({
  enabled: false,
  address: undefined,
  toggle: () => {},
});

export function useMockWallet() {
  return useContext(Ctx);
}

export function MockWalletProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(MOCK_ADDRESS_KEY) === "true") setEnabled(true);
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      next
        ? localStorage.setItem(MOCK_ADDRESS_KEY, "true")
        : localStorage.removeItem(MOCK_ADDRESS_KEY);
      return next;
    });
  }, []);

  return (
    <Ctx.Provider value={{ enabled, address: enabled ? TEST_ADDRESS : undefined, toggle }}>
      {children}
    </Ctx.Provider>
  );
}
