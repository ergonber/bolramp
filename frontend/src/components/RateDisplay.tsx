"use client";

interface RateDisplayProps {
  rate: number;
  lpSpread: number;
  platformFee: number;
  amountBOB: number;
  amountUSDT: number;
}

export function RateDisplay({
  rate,
  lpSpread,
  platformFee,
  amountBOB,
  amountUSDT,
}: RateDisplayProps) {
  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">Desglose</h3>
        <span className="text-xs text-emerald-400 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
          Tasa en vivo
        </span>
      </div>

      <div className="space-y-2.5">
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Tasa P2P</span>
          <span className="font-mono font-medium text-slate-200">{rate.toFixed(2)} BOB/USDT</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Spread LP</span>
          <span className="font-mono font-medium text-slate-200">{lpSpread / 100}%</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Fee plataforma</span>
          <span className="font-mono font-medium text-slate-200">{platformFee / 100}%</span>
        </div>

        <div className="border-t border-white/5 pt-3 mt-3 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-sm">Pagas</span>
            <span className="font-bold text-xl text-white">
              {amountBOB.toFixed(2)} <span className="text-sm font-normal text-slate-500">BOB</span>
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-sm">Recibes</span>
            <span className="font-bold text-xl text-emerald-400">
              {amountUSDT.toFixed(4)} <span className="text-sm font-normal text-slate-500">USDT</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
