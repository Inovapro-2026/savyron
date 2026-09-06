"use client";

const STATUS_STYLES: Record<string, string> = {
  // Empresa
  PENDING_PAYMENT: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  TRIAL: "bg-cyan-500/15 text-[#00E5FF] border-cyan-500/30 shadow-[0_0_8px_rgba(0,229,255,0.15)]",
  ACTIVE: "bg-emerald-500/15 text-[#00E5A0] border-emerald-500/30 shadow-[0_0_8px_rgba(0,229,160,0.15)]",
  PAST_DUE: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  SUSPENDED: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  CANCELLED: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  // Assinatura
  TRIALING: "bg-cyan-500/15 text-[#00E5FF] border-cyan-500/30 shadow-[0_0_8px_rgba(0,229,255,0.15)]",
  EXPIRED: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  // Pagamento
  PENDING: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  CONFIRMED: "bg-cyan-500/15 text-[#00E5FF] border-cyan-500/30",
  RECEIVED: "bg-emerald-500/15 text-[#00E5A0] border-emerald-500/30 shadow-[0_0_8px_rgba(0,229,160,0.15)]",
  OVERDUE: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  REFUNDED: "bg-purple-500/15 text-[#A78BFA] border-purple-500/30",
  // Usuário
  PLATFORM_ADMIN: "bg-purple-500/15 text-purple-300 border-purple-500/30 shadow-[0_0_8px_rgba(124,60,255,0.2)]",
  PLATFORM_STAFF: "bg-cyan-500/15 text-[#00E5FF] border-cyan-500/30",
  NONE: "bg-white/5 text-slate-400 border-white/10",
};

export function StatusBadge({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATUS_STYLES[status] ?? "bg-white/5 text-slate-400 border-white/10"}`}
    >
      {label ?? status}
    </span>
  );
}
