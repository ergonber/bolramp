"use client";

import { useState, useEffect } from "react";

interface QRDisplayProps {
  qrImage?: string;
  amountBOB?: string;
  bankName?: string;
  accountName?: string;
  timeLeft: number;
  status: string;
  tradeId?: number | null;
  txHash?: string | null;
  onConfirmPayment?: () => void;
}

export function QRDisplay({
  qrImage,
  amountBOB,
  bankName,
  accountName,
  timeLeft,
  status,
  tradeId,
  txHash,
  onConfirmPayment,
}: QRDisplayProps) {
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const totalSeconds = 300;
  const progress = (timeLeft / totalSeconds) * 100;

  const handleCopyAmount = async () => {
    if (!amountBOB) return;
    await navigator.clipboard.writeText(amountBOB);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirm = async () => {
    if (!tradeId || !onConfirmPayment) return;
    setConfirming(true);
    await onConfirmPayment();
    setConfirming(false);
  };

  if (status === "released") {
    return (
      <div className="flex flex-col items-center gap-6 animate-fadeIn">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
          <svg
            className="w-10 h-10 text-green-600 animate-checkmark"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <div className="text-center">
          <h3 className="text-xl font-bold text-green-600 mb-2">
            USDT enviado a tu wallet
          </h3>
          <p className="text-slate-500 text-sm">
            Tu compra se ha completado exitosamente
          </p>
        </div>
        {txHash && (
          <a
            href={`https://amoy.polygonscan.com/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Ver transacción en Polygonscan &#8599;
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 animate-fadeIn">
      {/* QR Code */}
      {qrImage && (
        <div className="relative">
          <div className="bg-white rounded-2xl p-4 shadow-lg border border-slate-100">
            <img
              src={qrImage}
              alt="QR Code BCP"
              className="w-56 h-56 sm:w-64 sm:h-64 object-contain"
            />
          </div>
          {/* Timer ring */}
          {status === "pending" && timeLeft > 0 && (
            <div className="absolute -top-2 -right-2 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center">
              <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="3"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke={timeLeft < 60 ? "#dc2626" : "#2563eb"}
                  strokeWidth="3"
                  strokeDasharray={`${progress} 100`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute text-xs font-bold text-slate-700">
                {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Amount */}
      {amountBOB && (
        <div className="w-full bg-gradient-to-r from-blue-50 to-slate-50 rounded-xl p-4 text-center">
          <p className="text-sm text-slate-500 mb-1">Monto a transferir</p>
          <div className="flex items-center justify-center gap-2">
            <p className="text-3xl font-bold text-slate-900">
              {amountBOB}
            </p>
            <span className="text-lg font-semibold text-slate-600">BOB</span>
            <button
              onClick={handleCopyAmount}
              className="p-1.5 rounded-lg hover:bg-white transition-colors"
              title="Copiar monto"
            >
              {copied ? (
                <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          </div>
          {bankName && accountName && (
            <p className="text-sm text-slate-500 mt-2">
              {bankName} &bull; {accountName}
            </p>
          )}
        </div>
      )}

      {/* Status */}
      <div className="w-full">
        {status === "pending" && (
          <div className="space-y-4">
            {/* Steps */}
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-sm font-medium text-slate-700 mb-3">Instrucciones:</p>
              <ol className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
                  <span>Abre la app de tu banco</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
                  <span>Escanea el QR o ingresa los datos</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
                  <span>Transfiere el monto exacto de <strong>{amountBOB} BOB</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">4</span>
                  <span>Vuelve aquí y confirma el pago</span>
                </li>
              </ol>
            </div>

            {/* Confirm button */}
            {tradeId && onConfirmPayment && (
              <button
                onClick={handleConfirm}
                disabled={confirming}
                className="w-full py-4 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-semibold text-lg hover:from-green-700 hover:to-green-800 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed transition-all shadow-lg shadow-green-600/20"
              >
                {confirming ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Procesando en blockchain...
                  </span>
                ) : (
                  "Ya transferí, confirmar pago"
                )}
              </button>
            )}

            <p className="text-center text-xs text-slate-400">
              El pago se verificará automáticamente en la blockchain
            </p>
          </div>
        )}

        {status === "locked" && (
          <div className="bg-blue-50 rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-blue-600">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="font-semibold">Procesando tu pago...</span>
            </div>
            <p className="text-sm text-blue-500 mt-2">
              Esperando confirmación en la blockchain
            </p>
          </div>
        )}

        {status === "expired" && (
          <div className="bg-red-50 rounded-xl p-4 text-center">
            <p className="text-red-600 font-semibold">QR expirado</p>
            <p className="text-sm text-red-500 mt-1">
              El tiempo de pago ha expirado. Por favor, inicia una nueva compra.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
