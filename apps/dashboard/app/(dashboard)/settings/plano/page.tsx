"use client";

import { useEffect, useState } from "react";
import {
  Crown,
  CreditCard,
  CalendarClock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/shell";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PixCheckout } from "@/components/billing/pix-checkout";
import { useToast } from "@/components/ui/toast";
import { useApi, request } from "@/hooks/use-api";

interface BillingStatus {
  business: {
    id: string;
    name: string;
    slug: string;
    status: string;
    suspension_reason?: string | null;
  };
  subscription: {
    status: string;
    plan_name: string | null;
    plan_price: number | null;
    expires_at: string | null;
    is_expired: boolean;
    cakto_checkout_url: string | null;
    abacatepay_checkout_id: string | null;
  } | null;
  requires_payment: boolean;
  is_expired: boolean;
  cakto_configured: boolean;
  abacatepay_configured: boolean;
}

function useCountdown(target: string | null): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);
  if (!target) return "";
  const diff = new Date(target).getTime() - now;
  if (diff <= 0) return "Expirado";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  return `Faltam ${days} dia${days === 1 ? "" : "s"} e ${hours}h para renovar`;
}

export default function PlanosPage() {
  const { success, error: toastError } = useToast();
  const status = useApi<BillingStatus>(["billing-status"], "billing/status");
  const [renewing, setRenewing] = useState(false);
  const [showPix, setShowPix] = useState(false);

  const data = status.data;
  const sub = data?.subscription ?? null;
  const expired = Boolean(data?.is_expired || sub?.is_expired);
  const active = Boolean(sub && sub.status === "ACTIVE" && !expired);
  const usePix = Boolean(data?.abacatepay_configured);

  const renew = async () => {
    setRenewing(true);
    try {
      const res = await request<{ url: string }>("billing/checkout", {
        method: "POST",
        body: {},
      });
      if (res?.url) {
        window.location.href = res.url;
      } else {
        toastError("Não foi possível gerar o link de pagamento.");
      }
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Falha ao gerar o pagamento");
    } finally {
      setRenewing(false);
    }
  };

  const countdown = useCountdown(sub?.expires_at ?? null);

  const formattedExpiry = sub?.expires_at
    ? new Date(sub.expires_at).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "—";

  return (
    <DashboardShell title="Planos">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#008CFF]/10 border border-[#008CFF]/30 text-[#00E5FF] shadow-[0_0_12px_rgba(0,140,255,0.2)]">
            <Crown className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Plano & Assinatura</h1>
            <p className="text-xs text-slate-400">
              Gerencie sua assinatura, créditos operacionais e renovações automáticas
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-xl">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#080D18]/90 backdrop-blur-xl shadow-2xl relative">
            <div className="h-1 bg-gradient-to-r from-[#008CFF] via-[#00E5FF] to-[#00E5A0]" />
            <div className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#008CFF]/20 to-[#00E5FF]/10 border border-[#00E5FF]/30 text-[#00E5FF] shadow-[0_0_15px_rgba(0,229,255,0.2)]">
                  <Crown className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Plano Ativo</div>
                  <div className="text-xl font-extrabold text-white tracking-tight">
                    {sub?.plan_name ?? "SAVYRON Enterprise AI"}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                {active ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#00E5A0]/30 bg-[#00E5A0]/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#00E5A0] shadow-[0_0_10px_rgba(0,229,160,0.2)]">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Assinatura Ativa
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FF3366]/30 bg-[#FF3366]/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#FF3366] shadow-[0_0_10px_rgba(255,51,102,0.2)]">
                    <XCircle className="h-3.5 w-3.5" /> Expirado
                  </span>
                )}
                {sub?.plan_price ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
                    R$ {sub.plan_price.toFixed(2).replace(".", ",")}
                    {sub.plan_name?.toLowerCase().includes("mensal")
                      ? ""
                      : "/mês"}
                  </span>
                ) : null}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4">
                  <CalendarClock className="h-5 w-5 shrink-0 text-[#00E5FF]" />
                  <div>
                    <div className="text-xs text-slate-400">Renovação em</div>
                    <div className="font-bold text-white text-sm">
                      {formattedExpiry}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4">
                  <CreditCard className="h-5 w-5 shrink-0 text-[#00E5A0]" />
                  <div>
                    <div className="text-xs text-slate-400">Status do ciclo</div>
                    <div
                      className={`font-bold text-sm ${expired ? "text-[#FF3366]" : "text-[#00E5A0]"}`}
                    >
                      {countdown || "—"}
                    </div>
                  </div>
                </div>
              </div>

              {expired ? (
                <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  Seu plano expirou. Para continuar usando o SAVYRON e não perder
                  suas campanhas e dados, renove sua assinatura agora.
                </div>
              ) : null}

              {expired && usePix ? (
                <div className="mt-5">
                  <PixCheckout
                    title="Renove via PIX"
                    onPaid={() => status.refetch()}
                  />
                </div>
              ) : !showPix ? (
                <>
                  <Button
                    onClick={() =>
                      usePix ? setShowPix(true) : void renew()
                    }
                    loading={renewing}
                    className="mt-5 w-full shadow-[0_0_15px_rgba(0,140,255,0.35)]"
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    {expired ? "Renovar Assinatura" : "Gerenciar Pagamento"}
                  </Button>
                  <p className="mt-2 text-center text-[11px] text-slate-400">
                    O pagamento é processado instantaneamente via PIX com segurança bancária.
                  </p>
                </>
              ) : (
                <div className="mt-5">
                  <PixCheckout
                    title="Pagamento via PIX"
                    onPaid={() => status.refetch()}
                  />
                </div>
              )}
            </div>
          </div>

          {!status.isLoading && !sub ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-[#080D18]/80 p-6 text-center text-sm text-slate-400 backdrop-blur-xl">
              Nenhuma assinatura ativa encontrada para esta empresa.
            </div>
          ) : null}
        </div>
      </div>
    </DashboardShell>
  );
}
