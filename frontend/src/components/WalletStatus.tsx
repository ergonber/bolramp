"use client";

import { useState, useEffect } from "react";
import { useAccount, useBalance, useChainId } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export function WalletStatus() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <ConnectButton />;

  return <WalletStatusInner />;
}

function WalletStatusInner() {
  const { address, isConnected } = useAccount();
  const { data: polBalance } = useBalance({ address });
  const chainId = useChainId();

  const getChainName = () => {
    switch (chainId) {
      case 80002: return { name: "Amoy", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" };
      case 137: return { name: "Polygon", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" };
      case 31337: return { name: "Local", color: "bg-slate-500/10 text-slate-400 border-slate-500/20" };
      default: return { name: "Unknown", color: "bg-slate-500/10 text-slate-400 border-slate-500/20" };
    }
  };

  const chain = getChainName();

  if (!isConnected) {
    return <ConnectButton />;
  }

  return (
    <div className="flex items-center gap-3">
      <div className="text-right hidden sm:block">
        <div className="flex items-center gap-2">
          <p className="font-mono text-xs text-slate-400">
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </p>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${chain.color}`}>
            {chain.name}
          </span>
        </div>
        {polBalance && (
          <p className="text-xs text-slate-500 mt-0.5">
            {parseFloat(polBalance.formatted).toFixed(3)} POL
          </p>
        )}
      </div>
      <ConnectButton />
    </div>
  );
}
