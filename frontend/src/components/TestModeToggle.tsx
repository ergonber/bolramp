"use client";

import { useMockWallet } from "@/contexts/MockWalletContext";

export function TestModeToggle() {
  const { enabled, toggle } = useMockWallet();

  return (
    <button
      onClick={toggle}
      className={`fixed bottom-4 right-4 z-50 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200 shadow-lg ${
        enabled
          ? "bg-emerald-500 text-white shadow-emerald-500/30 hover:bg-emerald-400"
          : "bg-white/10 text-slate-400 border border-white/10 hover:bg-white/20 hover:text-white"
      }`}
    >
      {enabled ? "Wallet: Test (0xB141...8E9A6)" : "Activate Test Wallet"}
    </button>
  );
}
