"use client";

import { useEffect, useState } from "react";
import {
  adminApi,
  AdminSubscription,
  AdminSubscriptionDetail,
  AdminPlan,
} from "@/lib/admin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/admin/status-badge";

const brl = (n: number | null) =>
  n != null
    ? `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
    : "—";

export default function AdminSubscriptionsPage() {
  const [subs, setSubs] = useState<AdminSubscription[]>([]);
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminSubscription | null>(null);
  const [detail, setDetail] = useState<AdminSubscriptionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [newPlanId, setNewPlanId] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const subsResult = await adminApi<AdminSubscription[]>(
        "/admin/subscriptions",
      );
      setSubs(subsResult);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Falha ao carregar assinaturas",
      );
    } finally {
      setLoading(false);
    }
  };

  const loadPlans = async () => {
    try {
      const r = await adminApi<{ plans: AdminPlan[] }>("/admin/plans");
      setPlans(r.plans);
    } catch {
      /* não bloqueia */
    }
  };

  useEffect(() => {
    void load();
    void loadPlans();
  }, []);

  const openDetail = async (s: AdminSubscription) => {
    setSelected(s);
    setDetail(null);
    setDetailLoading(true);
    setError(null);
    setNewPlanId("");
    try {
      const d = await adminApi<AdminSubscriptionDetail>(
        `/admin/subscriptions/${s.id}`,
      );
      setDetail(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar detalhe");
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshDetail = async () => {
    if (!selected) return;
    try {
      const d = await adminApi<AdminSubscriptionDetail>(
        `/admin/subscriptions/${selected.id}`,
      );
      setDetail(d);
    } catch {
      /* noop */
    }
    await load();
  };

  const changePlan = async () => {
    if (!selected || !newPlanId) return;
    setActing(true);
    setError(null);
    try {
      await adminApi(
        `/admin/subscriptions/${selected.id}/change-plan`,
        "POST",
        { plan_id: newPlanId },
      );
      await refreshDetail();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao mudar plano");
    } finally {
      setActing(false);
    }
  };

  const cancelSub = async () => {
    if (!selected) return;
    if (
      !window.confirm(
        "Cancelar esta assinatura? A cobrança também é cancelada no Stripe.",
      )
    )
      return;
    setActing(true);
    setError(null);
    try {
      await adminApi(`/admin/subscriptions/${selected.id}/cancel`, "POST", {});
      await refreshDetail();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao cancelar");
    } finally {
      setActing(false);
    }
  };

  const reactivateSub = async () => {
    if (!selected) return;
    if (!window.confirm("Reativar esta assinatura?")) return;
    setActing(true);
    setError(null);
    try {
      await adminApi(
        `/admin/subscriptions/${selected.id}/reactivate`,
        "POST",
        {},
      );
      await refreshDetail();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao reativar");
    } finally {
      setActing(false);
    }
  };

  const canCancel = detail && detail.status !== "CANCELLED";
  const canReactivate =
    detail && (detail.status === "CANCELLED" || detail.status === "EXPIRED");

  return (
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#008CFF]/10 border border-[#008CFF]/25 text-[11px] font-semibold text-[#00E5FF] mb-2 uppercase tracking-wider">
          Faturamento & Licenças
        </div>
        <h1 className="text-3xl font-black tracking-tight text-white">Assinaturas Ativas</h1>
        <p className="text-sm text-slate-400">
          Supervisão de planos contratados, ciclos de cobrança e gateways de pagamento da plataforma.
        </p>
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
            Carregando assinaturas...
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {subs.map((s) => (
            <button
              key={s.id}
              onClick={() => void openDetail(s)}
              className="block w-full text-left transition-transform hover:-translate-y-0.5"
            >
              <Card className="flex flex-col gap-3 border border-white/10 bg-[#080D18]/80 p-5 backdrop-blur-md transition-all hover:border-[#008CFF]/30 sm:flex-row sm:items-center sm:justify-between shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-base font-bold text-white">
                      {s.business?.name ?? s.business_id}
                    </span>
                    <StatusBadge status={s.status} />
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    <span className="font-semibold text-slate-200">{s.plan_name ?? "—"}</span> · <span className="font-mono text-[#00E5FF]">{brl(s.plan_price)}</span>
                    {s.current_period_end
                      ? ` · ciclo até ${new Date(s.current_period_end).toLocaleDateString("pt-BR")}`
                      : ""}
                    {s._count?.payments
                      ? ` · ${s._count.payments} transações`
                      : ""}
                  </div>
                </div>
                <div className="text-xs text-slate-500 font-mono">
                  {s.stripe_subscription_id
                    ? `Stripe: ${s.stripe_subscription_id}`
                    : "Sem assinatura Stripe"}
                </div>
              </Card>
            </button>
          ))}
          {subs.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-[#080D18]/80 p-8 text-center text-sm text-slate-500 backdrop-blur-md">
              Nenhuma assinatura cadastrada na plataforma.
            </div>
          )}
        </div>
      )}

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={
          selected
            ? `Assinatura — ${selected.business?.name ?? selected.id}`
            : "Assinatura"
        }
        footer={
          <div className="flex flex-wrap gap-2">
            {canCancel ? (
              <Button
                variant="danger"
                onClick={() => void cancelSub()}
                loading={acting}
              >
                Cancelar Assinatura
              </Button>
            ) : null}
            {canReactivate ? (
              <Button
                className="bg-[#00E5A0] text-black font-semibold hover:bg-[#00c98c]"
                onClick={() => void reactivateSub()}
                loading={acting}
              >
                Reativar Assinatura
              </Button>
            ) : null}
            <Button variant="outline" className="border-white/10 text-slate-300" onClick={() => setSelected(null)}>
              Fechar
            </Button>
          </div>
        }
      >
        {detailLoading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-slate-400">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#008CFF] border-t-transparent" />
              Carregando detalhes...
            </div>
          </div>
        ) : detail ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-white/10 bg-[#020409]/60 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Empresa</div>
                <div className="mt-1 font-bold text-white">
                  {detail.business?.name ?? "—"}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                  <span>{detail.business?.slug}</span>
                  <StatusBadge status={detail.business?.status ?? ""} />
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#020409]/60 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Plano Contratado</div>
                <div className="mt-1 font-bold text-white">
                  {detail.plan?.name ?? detail.plan_name ?? "—"} · <span className="font-mono text-[#00E5FF]">{brl(detail.plan_price)}</span>
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {detail.plan?.description ?? ""}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-white/10 bg-[#020409]/60 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Status</div>
                <StatusBadge status={detail.status} />
              </div>
              <div className="rounded-xl border border-white/10 bg-[#020409]/60 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Período Atual</div>
                <div className="mt-1 font-mono text-xs text-slate-200">
                  {detail.current_period_start
                    ? new Date(detail.current_period_start).toLocaleDateString(
                        "pt-BR",
                      )
                    : "—"}{" "}
                  →{" "}
                  {detail.current_period_end
                    ? new Date(detail.current_period_end).toLocaleDateString(
                        "pt-BR",
                      )
                    : "—"}
                </div>
              </div>
            </div>

            <div className="space-y-1.5 rounded-xl border border-white/10 bg-[#020409]/80 p-3.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Stripe Customer ID</span>
                <code className="font-mono text-[#00E5FF]">
                  {detail.stripe_customer_id ?? "—"}
                </code>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Stripe Subscription ID</span>
                <code className="font-mono text-[#00E5FF]">
                  {detail.stripe_subscription_id ?? "—"}
                </code>
              </div>
              {detail.stripe_price_id ? (
                <div className="flex justify-between">
                  <span className="text-slate-400">Stripe Price ID</span>
                  <code className="font-mono text-slate-300">
                    {detail.stripe_price_id}
                  </code>
                </div>
              ) : null}
              {detail.trial_ends_at ? (
                <div className="flex justify-between">
                  <span className="text-slate-400">Trial até</span>
                  <code className="font-mono text-amber-300">
                    {new Date(detail.trial_ends_at).toLocaleDateString("pt-BR")}
                  </code>
                </div>
              ) : null}
              {detail.cancelled_at ? (
                <div className="flex justify-between">
                  <span className="text-slate-400">Cancelada em</span>
                  <code className="font-mono text-rose-400">
                    {new Date(detail.cancelled_at).toLocaleDateString("pt-BR")}
                  </code>
                </div>
              ) : null}
            </div>

            {canCancel || canReactivate ? (
              <div className="flex items-end gap-2.5 rounded-xl border border-white/10 bg-[#020409]/60 p-3.5">
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">Migrar para outro Plano</label>
                  <select
                    className="w-full rounded-xl border border-white/10 bg-[#080D18] px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#008CFF]/60"
                    value={newPlanId}
                    onChange={(e) => setNewPlanId(e.target.value)}
                  >
                    <option value="" className="bg-[#080D18]">Manter plano atual</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id} className="bg-[#080D18]">
                        {p.name} — {brl(p.price)}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  variant="outline"
                  className="border-[#008CFF]/40 text-[#00E5FF] hover:bg-[#008CFF]/15"
                  onClick={() => void changePlan()}
                  loading={acting}
                  disabled={!newPlanId}
                >
                  Aplicar
                </Button>
              </div>
            ) : null}

            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
                Histórico de Transações & Faturas
              </div>
              {detail.payments.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-[#020409]/50 p-4 text-center text-xs text-slate-500">
                  Nenhum pagamento registrado no período.
                </div>
              ) : (
                <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                  {detail.payments.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-[#020409]/60 px-3.5 py-2"
                    >
                      <div className="flex items-center gap-2 text-xs">
                        <StatusBadge status={p.status} />
                        <span className="font-medium text-white">
                          {p.method} · <span className="font-mono text-[#00E5A0]">{brl(p.value)}</span>
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {new Date(p.created_at).toLocaleDateString("pt-BR")}
                        {p.stripe_payment_intent_id
                          ? ` · ${p.stripe_payment_intent_id.slice(-8)}`
                          : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
