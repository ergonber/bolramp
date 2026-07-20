"use client";

import { StatusBadge } from "./StatusBadge";

interface TradeCardProps {
  tradeId: number;
  amountUSDT: number;
  amountBOB: number;
  rate: number;
  status: string;
  releaseTxHash?: string | null;
  createdAt: string;
}

export function TradeCard({
  tradeId,
  amountUSDT,
  amountBOB,
  rate,
  status,
  releaseTxHash,
  createdAt,
}: TradeCardProps) {
  const polygonscanUrl = releaseTxHash
    ? `https://amoy.polygonscan.com/tx/${releaseTxHash}`
    : null;

  const formattedDate = new Date(createdAt).toLocaleDateString("es-BO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-bold text-lg text-slate-900">{amountUSDT.toFixed(2)}</span>
            <span className="text-sm font-medium text-slate-500">USDT</span>
          </div>
          <p className="text-sm text-slate-500">{amountBOB.toFixed(2)} BOB</p>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="mt-3 flex justify-between items-center text-xs text-slate-400">
        <span>Tasa: {rate.toFixed(2)} BOB/USDT</span>
        <span>{formattedDate}</span>
      </div>

      {status === "released" && polygonscanUrl && (
        <a
          href={polygonscanUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center justify-center gap-1.5 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Ver transacción en Polygonscan
        </a>
      )}
    </div>
  );
}
