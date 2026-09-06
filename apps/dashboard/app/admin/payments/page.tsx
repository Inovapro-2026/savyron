"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi, AdminPayment } from "@/lib/admin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/admin/status-badge";

const brl = (n: number) =>
  `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reconciling, setReconciling] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (q.trim()) params.set("q", q.trim());
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const qs = params.toString();
      const r = await adminApi<{ payments: AdminPayment[]; total: number }>(
        `/admin/payments${qs ? `?${qs}` : ""}`,
      );
      setPayments(r.payments);
      setTotal(r.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar pagamentos");
    } finally {
      setLoading(false);
    }
  }, [status, q, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const reconcile = async (id: string) => {
    setReconciling(id);
    setError(null);
    try {
      const r = await adminApi<{
        payment: AdminPayment | null;
        gateway_status: string;
      }>(`/admin/payments/${id}/reconcile`, "POST", {});
      await load();
      const s = r?.payment?.status ?? "";
      window.alert(`Gateway: ${r.gateway_status} → local: ${s}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao reconciliar");
    } finally {
      setReconciling(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#008CFF]/10 border border-[#008CFF]/25 text-[11px] font-semibold text-[#00E5FF] mb-2 uppercase tracking-wider">
            Gateways & Liquidações
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">Transações & Pagamentos</h1>
          <p className="text-sm text-slate-400">
            Registro de faturamento, liquidações via Stripe e reconciliação financeira da plataforma.
          </p>
        </div>
        <Card className="border border-white/10 bg-[#080D18]/80 p-5 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-6">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">Status</label>
              <select
                className="w-full rounded-xl border border-white/10 bg-[#020409]/70 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-[#008CFF]/60"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="" className="bg-[#080D18]">Todos os status</option>
                <option value="PENDING" className="bg-[#080D18]">PENDING</option>
                <option value="CONFIRMED" className="bg-[#080D18]">CONFIRMED</option>
                <option value="RECEIVED" className="bg-[#080D18]">RECEIVED</option>
                <option value="OVERDUE" className="bg-[#080D18]">OVERDUE</option>
                <option value="CANCELLED" className="bg-[#080D18]">CANCELLED</option>
                <option value="REFUNDED" className="bg-[#080D18]">REFUNDED</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">Empresa</label>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="nome ou slug"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">De</label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">Até</label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2 lg:col-span-2">
              <Button onClick={() => void load()} className="bg-gradient-to-r from-[#008CFF] to-[#00E5FF] text-black font-semibold">
                Filtrar
              </Button>
              <Button
                variant="outline"
                className="border-white/10 text-slate-300 hover:bg-white/5"
                onClick={() => {
                  setStatus("");
                  setQ("");
                  setFrom("");
                  setTo("");
                }}
              >
                Limpar
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-3 text-sm text-rose-400 backdrop-blur-md">
          {error}
        </div>
      ) : null}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#080D18]/80 px-5 py-3 text-sm text-slate-400 backdrop-blur-md">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#008CFF] border-t-transparent" />
            Carregando pagamentos...
          </div>
        </div>
      ) : (
        <>
          <div className="text-xs font-medium text-slate-400">
            Total filtrado: <span className="font-mono text-[#00E5FF]">{total}</span> transaç{total === 1 ? "ão" : "ões"}
          </div>
          <div className="space-y-3">
            {payments.map((p) => (
              <Card
                key={p.id}
                className="flex flex-col gap-3 border border-white/10 bg-[#080D18]/80 p-5 backdrop-blur-md transition-all hover:border-white/20 sm:flex-row sm:items-center sm:justify-between shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
              >
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-base font-bold text-white">
                      {p.business?.name ?? "—"}
                    </span>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    <span className="text-slate-300 font-medium">{p.method}</span> · <span className="font-mono text-base font-bold text-[#00E5A0]">{brl(p.value)}</span> ·{" "}
                    {new Date(p.created_at).toLocaleString("pt-BR")}
                    {p.paid_at
                      ? ` · liquidado em ${new Date(p.paid_at).toLocaleDateString("pt-BR")}`
                      : ""}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500 font-mono">
                    {p.subscription?.plan_name
                      ? `Plano: ${p.subscription.plan_name} · `
                      : ""}
                    {p.stripe_payment_intent_id
                      ? `Stripe PI: ${p.stripe_payment_intent_id}`
                      : p.stripe_checkout_session_id
                        ? `Stripe Session: ${p.stripe_checkout_session_id}`
                        : "Sem gateway integrado"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {p.stripe_payment_intent_id ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-[#008CFF]/30 bg-[#008CFF]/10 text-[#00E5FF] hover:bg-[#008CFF]/20"
                      onClick={() => void reconcile(p.id)}
                      loading={reconciling === p.id}
                    >
                      Reconciliar Gateway
                    </Button>
                  ) : null}
                </div>
              </Card>
            ))}
            {payments.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-[#080D18]/80 p-8 text-center text-sm text-slate-500 backdrop-blur-md">
                Nenhum pagamento registrado com os filtros aplicados.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
