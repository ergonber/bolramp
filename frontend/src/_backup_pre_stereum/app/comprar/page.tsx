"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { WalletStatus } from "@/components/WalletStatus";
import { QRDisplay } from "@/components/QRDisplay";
import { RateDisplay } from "@/components/RateDisplay";
import { StepIndicator } from "@/components/StepIndicator";
import { useQuote } from "@/hooks/useQuote";
import { useQR } from "@/hooks/useQR";

const STEPS = ["Conectar", "Cotizar", "Pagar", "Recibir"];

export default function ComprarPage() {
  const { isConnected, address } = useAccount();
  const [amount, setAmount] = useState<string>("");
  const { quote, loading: quoteLoading } = useQuote(amount ? parseFloat(amount) : null);
  const {
    qrData,
    trade,
    loading: qrLoading,
    error: qrError,
    timeLeft,
    generate,
    confirmPayment,
    reset,
    status,
  } = useQR();

  // Determine current step
  const getCurrentStep = () => {
    if (status === "released") return 4;
    if (qrData) return 3;
    if (isConnected && quote) return 2;
    if (isConnected) return 2;
    return 1;
  };

  const handleGenerateQR = async () => {
    if (!address || !quote) return;
    await generate(address, quote.amountUSDT);
  };

  const handleConfirmPayment = async () => {
    if (!qrData?.tradeId) return;
    await confirmPayment(qrData.tradeId);
  };

  const handleNewTrade = () => {
    reset();
    setAmount("");
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
      <div className="flex justify-end mb-6">
        <WalletStatus />
      </div>

      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Comprar USDT</h1>
        <p className="text-slate-500 mt-2">
          Convierte tus Bolivianos a USDT en menos de 60 segundos
        </p>
      </div>

      <StepIndicator currentStep={getCurrentStep()} steps={STEPS} />

      {!qrData ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6 animate-fadeIn">
          {/* Amount input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Monto en USDT
            </label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full text-3xl font-bold text-center py-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50"
                min="1"
                step="0.01"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">
                USDT
              </span>
            </div>
          </div>

          {/* Quote display */}
          {quote && (
            <RateDisplay
              rate={quote.rate}
              lpSpread={quote.lpSpread}
              platformFee={quote.platformFee}
              amountBOB={quote.amountBOB}
              amountUSDT={quote.amountUSDT}
            />
          )}

          {quoteLoading && (
            <div className="flex items-center justify-center gap-2 text-slate-500 py-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-sm">Cargando cotización...</span>
            </div>
          )}

          {/* Buy button */}
          <button
            onClick={handleGenerateQR}
            disabled={!isConnected || !quote || qrLoading || !amount}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold text-lg hover:from-blue-700 hover:to-blue-800 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-600/20"
          >
            {qrLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Bloqueando USDT en escrow...
              </span>
            ) : (
              "Comprar USDT"
            )}
          </button>

          {!isConnected && (
            <p className="text-center text-sm text-slate-500">
              Conecta tu wallet para continuar
            </p>
          )}

          {qrError && (
            <div className="p-3 bg-red-50 text-red-600 rounded-xl text-center text-sm animate-shake">
              {qrError}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 animate-fadeIn">
          <QRDisplay
            qrImage={qrData.qrImage}
            amountBOB={qrData.amountBOB}
            bankName={qrData.bankName}
            accountName={qrData.accountName}
            timeLeft={timeLeft}
            status={status}
            tradeId={qrData.tradeId}
            txHash={trade?.status === "released" ? (trade as any).releaseTxHash : null}
            onConfirmPayment={handleConfirmPayment}
          />

          {qrError && (
            <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-xl text-center text-sm animate-shake">
              {qrError}
            </div>
          )}

          {status === "released" && (
            <button
              onClick={handleNewTrade}
              className="mt-6 w-full py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
            >
              Nueva compra
            </button>
          )}

          {status === "expired" && (
            <button
              onClick={handleNewTrade}
              className="mt-6 w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
            >
              Intentar de nuevo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
