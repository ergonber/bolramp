import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { WalletStatus } from "@/components/WalletStatus";
import { TradeCard } from "@/components/TradeCard";
import { getTradeHistory, TradeHistoryItem } from "@/lib/api";

function TradeSkeleton() {
  return (
    <div className="bg-white rounded-xl border p-4 animate-pulse">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="h-6 w-24 bg-slate-200 rounded" />
          <div className="h-4 w-20 bg-slate-100 rounded" />
        </div>
        <div className="h-5 w-16 bg-slate-200 rounded-full" />
      </div>
      <div className="mt-3 flex justify-between">
        <div className="h-3 w-16 bg-slate-100 rounded" />
        <div className="h-3 w-20 bg-slate-100 rounded" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-300">
      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-slate-700 mb-1">Sin trades aún</h3>
      <p className="text-sm text-slate-500 mb-6 max-w-xs mx-auto">
        Cuando realices tu primera compra de USDT, aparecerá aquí tu historial.
      </p>
      <a
        href="/comprar"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Comprar USDT
      </a>
    </div>
  );
}

export default function DashboardContent() {
  const { isConnected, address } = useAccount();
  const [trades, setTrades] = useState<TradeHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected || !address) return;

    setLoading(true);
    setError(null);

    getTradeHistory(address)
      .then((res) => setTrades(res.trades))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [isConnected, address]);

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Historial</h1>
          <p className="text-slate-500">Conecta tu wallet para ver tus transacciones</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Historial</h1>
          <p className="text-slate-500 text-sm mt-1">Tus compras de USDT</p>
        </div>
        <WalletStatus />
      </div>

      {loading && (
        <div className="space-y-3">
          <TradeSkeleton />
          <TradeSkeleton />
          <TradeSkeleton />
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl mb-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-3">
          {trades.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <p className="text-xs text-slate-400 mb-2">
                {trades.length} transaccion{trades.length !== 1 ? "es" : ""}
              </p>
              {trades.map((trade) => (
                <TradeCard
                  key={trade.tradeId}
                  tradeId={trade.tradeId}
                  amountUSDT={trade.amountUSDT}
                  amountBOB={trade.amountBOB}
                  rate={trade.rate}
                  status={trade.status}
                  releaseTxHash={trade.releaseTxHash}
                  createdAt={trade.createdAt}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
