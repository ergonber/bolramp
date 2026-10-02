"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useBalance,
  useChainId,
  useConnect,
  useDisconnect,
} from "wagmi";

export function WalletStatus() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return <WalletStatusInner />;
}

function WalletStatusInner() {
  const { address, isConnected } = useAccount();
  const { data: polBalance } = useBalance({ address });
  const chainId = useChainId();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);

  const getChainName = () => {
    switch (chainId) {
      case 80002:
        return { name: "Amoy", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" };
      case 137:
        return { name: "Polygon", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" };
      case 31337:
        return { name: "Local", color: "bg-slate-500/10 text-slate-400 border-slate-500/20" };
      default:
        return { name: "Unknown", color: "bg-slate-500/10 text-slate-400 border-slate-500/20" };
    }
  };

  const chain = getChainName();

  if (!isConnected) {
    return (
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-500 hover:to-blue-400 transition-all"
        >
          Conectar wallet
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-56 glass-card rounded-2xl p-2 z-50 border border-white/10">
            {connectors.length === 0 && (
              <p className="px-3 py-2 text-xs text-slate-400">
                No se detectaron wallets. Instala MetaMask o Rabby.
              </p>
            )}
            {connectors.map((connector) => (
              <button
                key={connector.uid}
                disabled={isPending}
                onClick={() => {
                  connect({ connector });
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-200 hover:bg-white/10 disabled:opacity-50"
              >
                {connector.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
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
      <button
        onClick={() => disconnect()}
        className="px-4 py-2 rounded-xl text-sm font-semibold bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white transition-all"
      >
        Desconectar
      </button>
    </div>
  );
}
