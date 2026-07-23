"use client";

import { useState } from "react";
import { simulatePayment } from "@/lib/api";

interface QRDisplayProps {
  qrImage?: string;
  amountBOB?: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  instructions?: string;
  timeLeft: number;
  status: string;
  tradeId?: number | null;
  dbTradeId?: number | null;
  txHash?: string | null;
  onPaymentSimulated?: () => void;
}

export function QRDisplay({
  qrImage,
  amountBOB,
  bankName,
  accountName,
  accountNumber,
  instructions,
  timeLeft,
  status,
  tradeId,
  dbTradeId,
  txHash,
  onPaymentSimulated,
}: QRDisplayProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const totalSeconds = 300;
  const progress = (timeLeft / totalSeconds) * 100;

  const handleCopy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (status === "released") {
    return (
      <div className="flex flex-col items-center gap-6 animate-scaleIn">
        <div className="w-24 h-24 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center glow-green">
          <svg
            className="w-12 h-12 text-emerald-400 animate-success-bounce"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <div className="text-center animate-slideUp">
          <h3 className="text-2xl font-bold text-white mb-2">
            USDT enviado a tu wallet
          </h3>
          <p className="text-slate-400 text-sm">
            Tu compra se ha completado exitosamente
          </p>
        </div>
        {txHash && (
          <a
            href={`https://amoy.polygonscan.com/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/5 border border-white/10 text-blue-400 hover:bg-white/10 hover:text-blue-300 rounded-xl text-sm font-medium transition-all duration-200"
          >
            Ver en Polygonscan
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 animate-fadeIn">
      {/* QR Code + Timer */}
      {!qrImage && status === "pending" && (
        <div className="w-full glass-card rounded-2xl p-6 text-center animate-fadeIn">
          <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Orden Confirmada</h3>
          <p className="text-sm text-slate-400">
            {instructions || "Esperando confirmacion de pago via Stereum Pay"}
          </p>
        </div>
      )}
      {qrImage && (
        <div className="relative">
          <div className="bg-white rounded-2xl p-4 shadow-2xl shadow-black/30">
            <img
              src={qrImage}
              alt="QR Code de pago"
              className="w-52 h-52 sm:w-60 sm:h-60 object-contain"
            />
          </div>
          {status === "pending" && timeLeft > 0 && (
            <div className="absolute -top-3 -right-3 w-14 h-14 bg-[#0a0f1a] border border-white/10 rounded-full shadow-xl flex items-center justify-center">
              <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke={timeLeft < 60 ? "#ef4444" : "#3b82f6"}
                  strokeWidth="3"
                  strokeDasharray={`${progress} 100`}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
              </svg>
              <span className="absolute text-xs font-bold text-white">
                {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Amount Card */}
      {amountBOB && (
        <div className="w-full glass-card rounded-2xl p-4">
          <p className="text-xs text-slate-500 mb-1.5 text-center uppercase tracking-wider">Monto a transferir</p>
          <div className="flex items-center justify-center gap-2">
            <p className="text-3xl font-bold text-white">{amountBOB}</p>
            <span className="text-lg font-semibold text-slate-500">BOB</span>
            <button
              onClick={() => handleCopy(amountBOB, "amount")}
              className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
              title="Copiar monto"
            >
              {copiedField === "amount" ? (
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Bank Info */}
      {bankName && (
        <div className="w-full glass-card rounded-2xl p-4">
          <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider">Datos de la cuenta</p>
          <div className="space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-400">Banco</span>
              <span className="text-sm font-semibold text-white">{bankName}</span>
            </div>
            {accountName && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">Nombre</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-white truncate max-w-[180px]">{accountName}</span>
                  <button
                    onClick={() => handleCopy(accountName, "name")}
                    className="p-1 rounded hover:bg-white/5 transition-colors"
                  >
                    {copiedField === "name" ? (
                      <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}
            {accountNumber && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">Cuenta</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-mono font-medium text-white">{accountNumber}</span>
                  <button
                    onClick={() => handleCopy(accountNumber, "account")}
                    className="p-1 rounded hover:bg-white/5 transition-colors"
                  >
                    {copiedField === "account" ? (
                      <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status */}
      <div className="w-full">
        {status === "pending" && (
          <div className="space-y-3 animate-fadeIn">
            <div className="glass-card rounded-2xl p-4">
              <p className="text-sm font-medium text-slate-300 mb-3">Instrucciones:</p>
              <ol className="space-y-3 text-sm text-slate-400">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-blue-500/10 text-blue-400 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                  <span>Abre la app de tu banco</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-blue-500/10 text-blue-400 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                  <span>Escanea el QR o transfiere a la cuenta</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-blue-500/10 text-blue-400 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                  <span>Envia exactamente <strong className="text-white">{amountBOB} BOB</strong></span>
                </li>
              </ol>
            </div>

            <div className="glass-card rounded-2xl p-4 text-center animate-glow-pulse">
              <div className="flex items-center justify-center gap-2 text-blue-400">
                <div className="w-2.5 h-2.5 bg-blue-400 rounded-full animate-pulse" />
                <span className="text-sm font-semibold">Esperando tu pago...</span>
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                Verificacion automatica via Stereum Pay
              </p>
            </div>

            <button
              onClick={async () => {
                if (!dbTradeId) return;
                setSimulating(true);
                try {
                  await simulatePayment(dbTradeId);
                  onPaymentSimulated?.();
                } catch (err) {
                  console.error("Failed to simulate:", err);
                } finally {
                  setSimulating(false);
                }
              }}
              disabled={simulating}
              className="w-full py-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm font-semibold hover:bg-emerald-500/20 transition-all duration-200 disabled:opacity-50"
            >
              {simulating ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                  Simulando pago...
                </span>
              ) : (
                "Simular Pago Recibido (Test)"
              )}
            </button>
          </div>
        )}

        {status === "locked" && (
          <div className="glass-card rounded-2xl p-5 text-center animate-fadeIn">
            <div className="flex items-center justify-center gap-3 text-blue-400 mb-2">
              <div className="w-6 h-6 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
              <span className="font-semibold text-lg">Procesando pago...</span>
            </div>
            <p className="text-sm text-slate-500">
              Confirmando en la blockchain
            </p>
          </div>
        )}

        {status === "expired" && (
          <div className="glass-card rounded-2xl p-5 text-center glow-red animate-fadeIn">
            <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-red-400 font-semibold text-lg">QR expirado</p>
            <p className="text-sm text-slate-500 mt-1">
              El tiempo de pago ha expirado. Inicia una nueva compra.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
