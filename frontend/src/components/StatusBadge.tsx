"use client";

interface StatusBadgeProps {
  status: string;
}

const statusStyles: Record<string, { label: string; color: string; dot?: boolean }> = {
  pending: { label: "Pendiente", color: "bg-amber-500/10 text-amber-400 border border-amber-500/20", dot: true },
  locked: { label: "En escrow", color: "bg-blue-500/10 text-blue-400 border border-blue-500/20", dot: true },
  released: { label: "Completado", color: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" },
  expired: { label: "Expirado", color: "bg-red-500/10 text-red-400 border border-red-500/20" },
  release_pending: { label: "Procesando", color: "bg-purple-500/10 text-purple-400 border border-purple-500/20", dot: true },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusStyles[status] || { label: status, color: "bg-slate-500/10 text-slate-400 border border-slate-500/20" };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}
    >
      {config.dot && (
        <span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" />
      )}
      {config.label}
    </span>
  );
}
