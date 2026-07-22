import { useState } from "react";
import { useAccount } from "wagmi";
import { useMockWallet } from "@/contexts/MockWalletContext";
import { WalletStatus } from "@/components/WalletStatus";
import { QRDisplay } from "@/components/QRDisplay";
import { RateDisplay } from "@/components/RateDisplay";
import { StepIndicator } from "@/components/StepIndicator";
import { useQuote } from "@/hooks/useQuote";
import { useQR } from "@/hooks/useQR";

const STEPS = ["Conectar", "Cotizar", "Pagar", "Recibir"];
const QUICK_AMOUNTS = [50, 100, 200, 500];

export default function ComprarContent() {
  const { isConnected, address: wagmiAddress } = useAccount();
  const { address: mockAddress, enabled: mockEnabled } = useMockWallet();
  const address = mockEnabled ? mockAddress : wagmiAddress;
  const isConnectedOrMock = isConnected || mockEnabled;
  const [amount, setAmount] = useState<string>("");
  const { quote, loading: quoteLoading, error: quoteError } = useQuote(amount ? parseFloat(amount) : null, mockEnabled ? mockAddress : undefined);
  const {
    qrData,
    trade,
    loading: qrLoading,
    error: qrError,
    timeLeft,
    generate,
    reset,
    refreshTrade,
    status,
  } = useQR();

  const getCurrentStep = () => {
    if (status === "released") return 4;
    if (qrData) return 3;
    if (isConnectedOrMock && quote) return 2;
    if (isConnectedOrMock) return 2;
    return 1;
  };

  const handleGenerateQR = async () => {
    if (!address || !quote) return;
    await generate(address, quote.quoteId);
  };

  const handleNewTrade = () => {
    reset();
    setAmount("");
  };

  const handleQuickAmount = (val: number) => {
    setAmount(String(val));
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
      <div className="flex justify-end mb-6 animate-fadeIn gap-2">
        {mockEnabled && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-emerald-400">Test: 0xB141...8E9A6</span>
          </div>
        )}
        <WalletStatus />
      </div>

      <div className="text-center mb-8 animate-slideUp">
        <h1 className="text-4xl sm:text-5xl font-bold mb-3">
          <span className="text-gradient">Comprar USDT</span>
        </h1>
        <p className="text-slate-400 text-base sm:text-lg">
          Convierte tus Bolivianos a USDT en menos de 60 segundos
        </p>
      </div>

      <StepIndicator currentStep={getCurrentStep()} steps={STEPS} />

      {!qrData ? (
        <div className="glass-card rounded-3xl p-6 sm:p-8 space-y-6 animate-scaleIn">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-3">
              Monto en BOB
            </label>
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
              <div className="relative flex items-center bg-white/5 border border-white/10 rounded-2xl overflow-hidden focus-within:border-blue-500/50 transition-colors duration-300">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full text-4xl sm:text-5xl font-bold text-center py-5 bg-transparent text-white placeholder-slate-600 focus:outline-none"
                  min="1"
                  step="0.01"
                />
                <span className="absolute right-5 text-lg font-semibold text-slate-500">
                  BOB
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 sm:gap-3">
            {QUICK_AMOUNTS.map((val) => (
              <button
                key={val}
                onClick={() => handleQuickAmount(val)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  amount === String(val)
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    : "bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10 hover:text-white hover:border-white/10"
                }`}
              >
                {val}
              </button>
            ))}
          </div>

          {quote && (
            <div className="animate-fadeIn">
              <RateDisplay
                rate={quote.rate}
                lpSpread={0}
                platformFee={quote.serviceFee}
                amountBOB={quote.amountBOB}
                amountUSDT={quote.amountUSDC}
              />
            </div>
          )}

          {quoteLoading && amount && (
            <div className="flex items-center justify-center gap-3 text-slate-400 py-3 animate-fadeIn">
              <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              <span className="text-sm">Obteniendo cotizacion en vivo...</span>
            </div>
          )}

          {quoteError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-center text-sm animate-shake">
              {quoteError}
            </div>
          )}

          <button
            onClick={handleGenerateQR}
            disabled={!isConnectedOrMock || !quote || qrLoading || !amount}
            className="btn-glow w-full py-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-2xl font-semibold text-lg hover:from-blue-500 hover:to-blue-400 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 active:scale-[0.98]"
          >
            {qrLoading ? (
              <span className="flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generando QR de pago...
              </span>
            ) : (
              "Comprar USDT"
            )}
          </button>

          {!isConnectedOrMock && (
            <p className="text-center text-sm text-slate-500 animate-pulse">
              Conecta tu wallet para continuar
            </p>
          )}

          {qrError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-center text-sm animate-shake">
              {qrError}
            </div>
          )}
        </div>
      ) : (
        <div className="glass-card rounded-3xl p-6 sm:p-8 animate-scaleIn">
          <QRDisplay
            qrImage={qrData.qrBase64 ? `data:image/png;base64,${qrData.qrBase64}` : undefined}
            amountBOB={qrData.amountBOB}
            bankName={(qrData as any).bankName}
            accountName={(qrData as any).accountName}
            accountNumber={(qrData as any).accountNumber}
            instructions={(qrData as any).instructions}
            timeLeft={timeLeft}
            status={status}
            tradeId={qrData.tradeId}
            dbTradeId={qrData.dbTradeId}
            txHash={trade?.status === "released" ? (trade as any).releaseTxHash : null}
            onPaymentSimulated={refreshTrade}
          />

          {qrError && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-center text-sm animate-shake">
              {qrError}
            </div>
          )}

          {(status === "released" || status === "expired") && (
            <button
              onClick={handleNewTrade}
              className="mt-6 w-full py-3.5 bg-white/5 border border-white/10 text-slate-300 rounded-2xl font-semibold hover:bg-white/10 hover:text-white transition-all duration-200"
            >
              Nueva compra
            </button>
          )}
        </div>
      )}
    </div>
  );
}
