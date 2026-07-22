import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { WalletStatus } from "@/components/WalletStatus";
import { getLPBalance, type LPBalance } from "@/lib/api";

const ESCROW_ADDRESS = process.env.NEXT_PUBLIC_ESCROW_ADDRESS || "0x0000000000000000000000000000000000000000";
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS || "0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582";

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

const ESCROW_ABI = [
  "function depositUSDT(uint256 amount)",
  "function withdrawLP(uint256 amount)",
  "function getAvailableBalance(address lp) view returns (uint256)",
  "function getLockedBalance(address lp) view returns (uint256)",
  "function setDailyLimit(uint256 limit)",
];

function BalanceSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="flex justify-between">
        <div className="h-4 w-24 bg-slate-200 rounded" />
        <div className="h-4 w-20 bg-slate-200 rounded" />
      </div>
      <div className="flex justify-between">
        <div className="h-4 w-20 bg-slate-200 rounded" />
        <div className="h-4 w-16 bg-slate-200 rounded" />
      </div>
      <div className="border-t pt-3 flex justify-between">
        <div className="h-5 w-12 bg-slate-200 rounded" />
        <div className="h-5 w-24 bg-slate-200 rounded" />
      </div>
    </div>
  );
}

export default function LPContent() {
  const { isConnected, address } = useAccount();
  const [balance, setBalance] = useState<LPBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [actionLoading, setActionLoading] = useState<"deposit" | "withdraw" | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { writeContractAsync } = useWriteContract();
  const { isLoading: txPending } = useWaitForTransactionReceipt({ hash: txHash as `0x${string}` | undefined });

  const fetchBalance = async () => {
    if (!address) return;
    setBalanceLoading(true);
    try {
      const data = await getLPBalance(address);
      setBalance(data);
    } catch (err) {
      console.error("Failed to fetch balance:", err);
    } finally {
      setBalanceLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && address) fetchBalance();
  }, [isConnected, address]);

  useEffect(() => {
    if (txHash && !txPending) {
      setActionLoading(null);
      setTxHash(null);
      fetchBalance();
    }
  }, [txPending, txHash]);

  const handleDeposit = async () => {
    if (!address || !depositAmount) return;
    setError(null);
    setActionLoading("deposit");
    try {
      const amount = BigInt(Math.floor(parseFloat(depositAmount) * 1e6));
      await writeContractAsync({
        address: USDC_ADDRESS as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [ESCROW_ADDRESS as `0x${string}`, amount],
      });
      const hash = await writeContractAsync({
        address: ESCROW_ADDRESS as `0x${string}`,
        abi: ESCROW_ABI,
        functionName: "depositUSDT",
        args: [amount],
      });
      setTxHash(hash);
      setDepositAmount("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Depósito fallido");
      setActionLoading(null);
    }
  };

  const handleWithdraw = async () => {
    if (!address || !withdrawAmount) return;
    setError(null);
    setActionLoading("withdraw");
    try {
      const hash = await writeContractAsync({
        address: ESCROW_ADDRESS as `0x${string}`,
        abi: ESCROW_ABI,
        functionName: "withdrawLP",
        args: [BigInt(Math.floor(parseFloat(withdrawAmount) * 1e6))],
      });
      setTxHash(hash);
      setWithdrawAmount("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retiro fallido");
      setActionLoading(null);
    }
  };

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Panel LP</h1>
          <p className="text-slate-500">Conecta tu wallet de proveedor de liquidez</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Panel LP</h1>
          <p className="text-slate-500 text-sm mt-1">Gestiona tu liquidez en USDC</p>
        </div>
        <WalletStatus />
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl mb-6">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Tu Balance</h2>
          <button
            onClick={fetchBalance}
            disabled={balanceLoading}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            title="Actualizar"
          >
            <svg className={`w-4 h-4 text-slate-400 ${balanceLoading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {balanceLoading && !balance ? (
          <BalanceSkeleton />
        ) : balance ? (
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-500">Disponible</span>
              <span className="font-semibold text-slate-800">{balance.available.toFixed(2)} USDC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Bloqueado en trades</span>
              <span className="font-semibold text-slate-800">{balance.locked.toFixed(2)} USDC</span>
            </div>
            <div className="border-t border-slate-200 pt-3 flex justify-between">
              <span className="text-slate-500 font-medium">Total</span>
              <span className="font-bold text-lg text-slate-900">{balance.total.toFixed(2)} USDC</span>
            </div>
          </div>
        ) : (
          <button
            onClick={fetchBalance}
            className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-medium hover:bg-slate-200 transition-colors"
          >
            Cargar balance
          </button>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-800">Depositar</h2>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            Agrega USDC al pool para ganar fees de las transacciones.
          </p>
          <div className="relative mb-3">
            <input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="0.00"
              className="w-full text-xl font-bold text-center py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50"
              min="0"
              step="0.01"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">
              USDC
            </span>
          </div>
          <button
            onClick={handleDeposit}
            disabled={!depositAmount || parseFloat(depositAmount) <= 0 || actionLoading === "deposit"}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all"
          >
            {actionLoading === "deposit" ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Procesando...
              </span>
            ) : (
              "Depositar USDC"
            )}
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-800">Retirar</h2>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            Retira tu USDC disponible. Time-lock de 24h tras cada retiro.
          </p>
          <div className="relative mb-3">
            <input
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="0.00"
              className="w-full text-xl font-bold text-center py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-slate-50"
              min="0"
              step="0.01"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">
              USDC
            </span>
          </div>
          <button
            onClick={handleWithdraw}
            disabled={!withdrawAmount || parseFloat(withdrawAmount) <= 0 || actionLoading === "withdraw"}
            className="w-full py-3 bg-orange-600 text-white rounded-xl font-semibold hover:bg-orange-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all"
          >
            {actionLoading === "withdraw" ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Procesando...
              </span>
            ) : (
              "Retirar USDC"
            )}
          </button>
        </div>
      </div>

      <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-slate-600">
            <p className="font-medium mb-1">Cómo funciona</p>
            <ul className="space-y-1 text-slate-500">
              <li>• Depositas USDC al pool de liquidez</li>
              <li>• Cuando un usuario compra USDT, tu liquidez se usa automáticamente</li>
              <li>• Ganas un spread por cada transacción completada</li>
              <li>• Puedes retirar tu balance disponible en cualquier momento</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
