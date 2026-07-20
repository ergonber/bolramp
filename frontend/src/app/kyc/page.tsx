"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { WalletStatus } from "@/components/WalletStatus";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const DEPARTMENTS = [
  { code: "BO_B", name: "Beni" },
  { code: "BO_C", name: "Cochabamba" },
  { code: "BO_H", name: "Chuquisaca" },
  { code: "BO_L", name: "La Paz" },
  { code: "BO_O", name: "Oruro" },
  { code: "BO_N", name: "Pando" },
  { code: "BO_P", name: "Potosi" },
  { code: "BO_S", name: "Santa Cruz" },
  { code: "BO_T", name: "Tarija" },
];

const INCOME_LEVELS = [
  "Menos de $500",
  "$500 - $1,000",
  "$1,000 - $2,000",
  "$2,000 - $5,000",
  "Mas de $5,000",
];

const ECONOMIC_ACTIVITIES = [
  "Comercio minorista",
  "Comercio mayorista",
  "Servicios profesionales",
  "Transporte y logistica",
  "Construccion",
  "Industria y manufactura",
  "Agricultura y ganaderia",
  "Educacion",
  "Salud",
  "Tecnologia y software",
  "Gastronomia",
  "Turismo",
  "Finanzas y seguros",
  "Otros",
];

interface KycStatus {
  kycStatus: string;
  hasCustomerId: boolean;
}

export default function KycPage() {
  const { isConnected, address } = useAccount();
  const [kycStatus, setKycStatus] = useState<KycStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    name: "",
    lastname: "",
    birthdate: "",
    documentType: "CI" as "CI" | "CE",
    documentNumber: "",
    complementNumber: "",
    stateOfResidence: "BO_S",
    economicActivity: "Tecnologia y software",
    sourceOfFunds: "Trabajo independiente",
    destinationOfFunds: "Ahorro e inversion",
    incomeLevel: "$1,000 - $2,000",
  });

  const fetchKycStatus = async () => {
    if (!address) return;
    setStatusLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/kyc/status/${address}`);
      const data = await res.json();
      if (data.success) {
        setKycStatus(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch KYC status:", err);
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && address) {
      fetchKycStatus();
    }
  }, [isConnected, address]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Step 1: Validate SEGIP
      const validateRes = await fetch(`${API_BASE}/api/kyc/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: address,
          name: form.name,
          lastname: form.lastname,
          birthdate: form.birthdate,
          documentType: form.documentType,
          documentNumber: form.documentNumber,
          complementNumber: form.complementNumber || null,
        }),
      });

      const validateData = await validateRes.json();

      if (!validateData.success) {
        throw new Error(validateData.error || "Error en validacion SEGIP");
      }

      if (validateData.data.status !== "VERIFIED") {
        throw new Error(
          `Validacion SEGIP: ${validateData.data.status}. Verifica que tus datos sean correctos.`
        );
      }

      // Step 2: Register customer in Stereum
      const registerRes = await fetch(`${API_BASE}/api/kyc/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: address,
          name: form.name,
          lastname: form.lastname,
          documentType: form.documentType,
          documentNumber: form.documentNumber,
          stateOfResidence: form.stateOfResidence,
          economicActivity: form.economicActivity,
          sourceOfFunds: form.sourceOfFunds,
          destinationOfFunds: form.destinationOfFunds,
          incomeLevel: form.incomeLevel,
        }),
      });

      const registerData = await registerRes.json();

      if (!registerData.success) {
        throw new Error(registerData.error || "Error al registrar cliente");
      }

      setSuccess(true);
      setKycStatus({ kycStatus: "verified", hasCustomerId: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error en el proceso KYC");
    } finally {
      setLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Verificacion de Identidad</h1>
          <p className="text-slate-500">Conecta tu wallet para iniciar el proceso KYC</p>
        </div>
      </div>
    );
  }

  if (kycStatus?.kycStatus === "verified") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="flex justify-end mb-6">
          <WalletStatus />
        </div>
        <div className="text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Identidad Verificada</h1>
          <p className="text-slate-500 mb-6">Tu cuenta esta verificada. Puedes proceder a comprar USDC.</p>
          <a
            href="/comprar"
            className="inline-block px-8 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            Comprar USDC
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
      <div className="flex justify-end mb-6">
        <WalletStatus />
      </div>

      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Verificacion de Identidad</h1>
        <p className="text-slate-500">
          Completa tus datos para cumplir con la normativa boliviana. Tus datos son validados via SEGIP.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl mb-6">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl mb-6">
          <p className="text-emerald-700 text-sm">KYC completado exitosamente. Ya puedes comprar USDC.</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-5">
        {/* Personal Info */}
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Datos Personales</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Nombre(s)</label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="JUAN"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Apellido(s)</label>
              <input
                type="text"
                name="lastname"
                value={form.lastname}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="PEREZ"
              />
            </div>
          </div>
        </div>

        {/* Document */}
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Documento de Identidad</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Tipo</label>
              <select
                name="documentType"
                value={form.documentType}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="CI">Cedula de Identidad</option>
                <option value="CE">Carnet de Extranjeria</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Numero</label>
              <input
                type="text"
                name="documentNumber"
                value={form.documentNumber}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="1234567"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Complemento</label>
              <input
                type="text"
                name="complementNumber"
                value={form.complementNumber}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="OP (opcional)"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-600 mb-1">Fecha de Nacimiento</label>
            <input
              type="text"
              name="birthdate"
              value={form.birthdate}
              onChange={handleChange}
              required
              className="w-full sm:w-48 px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="DD/MM/AAAA"
            />
            <p className="text-xs text-slate-400 mt-1">Formato: DD/MM/AAAA (ej: 15/03/1990)</p>
          </div>
        </div>

        {/* Residence */}
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Ubicacion y Perfil</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Departamento</label>
              <select
                name="stateOfResidence"
                value={form.stateOfResidence}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Nivel de Ingresos</label>
              <select
                name="incomeLevel"
                value={form.incomeLevel}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {INCOME_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-600 mb-1">Actividad Economica</label>
            <select
              name="economicActivity"
              value={form.economicActivity}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {ECONOMIC_ACTIVITIES.map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Origen de Fondos</label>
              <input
                type="text"
                name="sourceOfFunds"
                value={form.sourceOfFunds}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Destino de Fondos</label>
              <input
                type="text"
                name="destinationOfFunds"
                value={form.destinationOfFunds}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Validando con SEGIP...
            </span>
          ) : (
            "Verificar Identidad"
          )}
        </button>

        <p className="text-xs text-slate-400 text-center">
          Tus datos son validados directamente con el Registro Civil de Bolivia (SEGIP) via Stereum Pay.
          No almacenamos tu informacion personal en nuestros servidores.
        </p>
      </form>
    </div>
  );
}
