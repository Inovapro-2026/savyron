"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PixCheckout } from "@/components/billing/pix-checkout";

interface BillingStatus {
  business: {
    id: string;
    name: string;
    status: string;
    suspension_reason?: string | null;
  };
  subscription: {
    id: string;
    status: string;
    plan_name: string | null;
    plan_price: number | null;
    current_period_end: string | null;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    cakto_checkout_url: string | null;
    abacatepay_checkout_id: string | null;
  } | null;
  last_payment: {
    id: string;
    method: string;
    status: string;
    value: number;
    stripe_payment_intent_id: string | null;
    cakto_order_id: string | null;
    abacatepay_checkout_id: string | null;
  } | null;
  requires_payment: boolean;
  stripe_configured: boolean;
  stripe_publishable_key: string | null;
  cakto_configured: boolean;
  abacatepay_configured: boolean;
}

interface StripeCheckout {
  url: string;
  paymentId: string;
  amount: number;
  priceId: string;
}

interface ApiInit {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
}

async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? "GET",
    headers:
      init.body !== undefined
        ? { "Content-Type": "application/json" }
        : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const data = (await res.json()) as {
    success?: boolean;
    data?: T;
    error?: { message?: string };
  };
  if (!res.ok || !data.success) {
    throw new Error(data?.error?.message ?? "Erro na requisição");
  }
  return data.data as T;
}

type Mode = "loading" | "pay" | "paid";

export default function PaymentPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("loading");
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startingCheckout, setStartingCheckout] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [checkingNow, setCheckingNow] = useState(false);
  const [fromCheckout, setFromCheckout] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("from") === "checkout") setFromCheckout(true);
  }, []);

  const checkNow = async () => {
    setCheckingNow(true);
    setError(null);
    try {
      await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao verificar pagamento");
    } finally {
      setCheckingNow(false);
    }
  };

  const isPaid = useCallback((s: BillingStatus | null) => {
    return Boolean(
      s &&
      (s.business.status === "ACTIVE" ||
        s.subscription?.status === "ACTIVE" ||
        s.last_payment?.status === "RECEIVED"),
    );
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const s = await api<BillingStatus>("/api/proxy/billing/status");
      setStatus(s);
      // Suspensão por vencimento de assinatura leva direto ao fluxo de renovação.
      const suspendedExpired =
        s.business.status === "SUSPENDED" &&
        s.business.suspension_reason === "subscription_expired";
      if (s.business.status === "SUSPENDED" && !suspendedExpired) {
        setError("Sua conta está suspensa. Fale com o suporte.");
        setMode("pay");
        return;
      }
      if (s.business.status === "CANCELLED") {
        setError("Sua conta foi cancelada. Fale com o suporte.");
        setMode("pay");
        return;
      }
      if (isPaid(s)) {
        setMode("paid");
        if (pollRef.current) clearInterval(pollRef.current);
        setTimeout(() => {
          router.push("/dashboard");
          router.refresh();
        }, 2500);
        return;
      }
      setMode("pay");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar status");
      setMode("pay");
    }
  }, [isPaid, router]);

  useEffect(() => {
    void loadStatus();
    // Polling da página apenas quando o usuário saiu para o checkout
    // externo (Stripe/Cakto). No caso AbacatePay o PixCheckout já faz o
    // polling único de confirmação ("Já paguei"/auto) e chama onPaid -> loadStatus,
    // evitando polling duplicado sobre o mesmo recurso.
    if (status?.abacatepay_configured) return undefined;
    pollRef.current = setInterval(() => {
      void api<BillingStatus>("/api/proxy/billing/status")
        .then((s) => {
          if (isPaid(s)) {
            setStatus(s);
            setMode("paid");
            if (pollRef.current) clearInterval(pollRef.current);
            setTimeout(() => {
              router.push("/dashboard");
              router.refresh();
            }, 2500);
          } else {
            setStatus(s);
          }
        })
        .catch(() => {});
    }, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isPaid, loadStatus, router, status?.abacatepay_configured]);

  /** Cria a Checkout Session Stripe e redireciona para o pagamento hospedado. */
  const startCheckout = async () => {
    setStartingCheckout(true);
    setError(null);
    try {
      const result = await api<StripeCheckout>("/api/proxy/billing/checkout", {
        method: "POST",
        body: {},
      });
      window.location.href = result.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao iniciar o pagamento");
      setStartingCheckout(false);
    }
  };

  return (
    <div className="auth-shell relative flex min-h-screen flex-col items-center justify-center bg-[#020409] px-4 py-12">
      {/* Glows ambientais */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-[#008CFF]/15 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-[#00E5FF]/10 blur-[120px]" />

      <div className="relative z-10 mb-8">
        <Logo />
      </div>
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#008CFF]/10 border border-[#008CFF]/25 text-[11px] font-semibold text-[#00E5FF] mb-3 uppercase tracking-wider shadow-[0_0_15px_rgba(0,140,255,0.15)]">
            Faturamento Seguro &bull; Ativação
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            {status?.business.status === "SUSPENDED" &&
            status.business.suspension_reason === "subscription_expired"
              ? "Assinatura Vencida"
              : "Assinatura Pendente"}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {status
              ? status.business.status === "SUSPENDED"
                ? `A assinatura de ${status.business.name} encerrou seu ciclo. Efetue o pagamento para reativar o acesso total.`
                : `A instância corporativa ${status.business.name} aguarda confirmação para liberação instantânea.`
              : "Verificando dados de subscrição..."}
          </p>
        </div>

        {error ? (
          <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-3.5 text-sm text-rose-400 backdrop-blur-md">
            {error}
          </div>
        ) : null}

        {mode === "loading" && (
          <Card className="border border-white/10 bg-[#080D18]/90 p-8 text-center backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
            <div className="flex items-center justify-center gap-3 text-sm text-slate-400">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#008CFF] border-t-transparent" />
              Carregando dados da assinatura...
            </div>
          </Card>
        )}

        {mode === "paid" && (
          <Card className="border border-[#00E5A0]/40 bg-[#080D18]/90 p-8 text-center backdrop-blur-xl shadow-[0_0_30px_rgba(0,229,160,0.2)]">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#00E5A0]/50 bg-[#00E5A0]/20 text-3xl text-[#00E5A0] shadow-[0_0_20px_rgba(0,229,160,0.3)]">
              ✓
            </div>
            <p className="text-lg font-bold text-white">Pagamento Confirmado!</p>
            <p className="mt-1 text-sm text-slate-400">
              Inicializando seu ambiente neural... Redirecionando para o painel.
            </p>
          </Card>
        )}

        {mode === "pay" && status && (
          <Card className="border border-white/10 bg-[#080D18]/90 p-6 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
            <div className="mb-5 rounded-xl border border-white/10 bg-[#020409]/70 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Plano Selecionado</span>
                <span className="font-bold text-white">
                  {status.subscription?.plan_name ?? "—"}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-slate-400">Valor do Período</span>
                <span className="font-mono text-lg font-bold text-[#00E5FF]">
                  R${" "}
                  {(status.subscription?.plan_price ?? 0)
                    .toFixed(2)
                    .replace(".", ",")}
                </span>
              </div>
            </div>

            {(status.subscription?.plan_price ?? 0) === 0 ? (
              <div className="rounded-xl border border-[#00E5A0]/30 bg-[#00E5A0]/10 p-4 text-sm text-emerald-300">
                Seu plano é gratuito — nenhuma cobrança financeira será efetuada.
                <Button
                  className="mt-4 w-full bg-gradient-to-r from-[#008CFF] to-[#00E5FF] text-black font-bold"
                  onClick={async () => {
                    try {
                      await api("/api/proxy/billing/activate-free", {
                        method: "POST",
                        body: {},
                      });
                    } catch {
                      /* noop */
                    }
                    await loadStatus();
                  }}
                >
                  Ativar Acesso Imediato
                </Button>
              </div>
            ) : status.abacatepay_configured ? (
              <PixCheckout
                onPaid={() => {
                  void loadStatus();
                }}
              />
            ) : (
              <div className="space-y-3.5">
                <div className="rounded-xl border border-white/10 bg-[#020409]/60 p-4 text-xs text-slate-300 leading-relaxed">
                  Você será redirecionado para o ambiente de checkout seguro da Stripe (PIX recorrente ou Cartão). O retorno para este portal ativará sua licença em tempo real.
                </div>
                <Button
                  onClick={() => void startCheckout()}
                  className="w-full bg-gradient-to-r from-[#008CFF] to-[#00E5FF] text-black font-bold shadow-[0_0_20px_rgba(0,140,255,0.3)] hover:brightness-110"
                  loading={startingCheckout}
                >
                  Continuar para Pagamento Seguro
                </Button>
                {fromCheckout ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300">
                    {checkingNow
                      ? "Confirmando seu pagamento com a instituição financeira..."
                      : "Aguardando webhook bancário de confirmação — isso costuma levar poucos segundos."}
                  </div>
                ) : null}
                <Button
                  variant="outline"
                  className="w-full border-white/10 text-slate-300 hover:bg-white/5"
                  onClick={() => void checkNow()}
                  loading={checkingNow}
                >
                  Já Paguei — Verificar Status Agora
                </Button>
                <p className="text-center text-[11px] text-slate-500">
                  Criptografia ponta a ponta. Dados de pagamento protegidos pela infraestrutura Stripe.
                </p>
              </div>
            )}
          </Card>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          <button
            onClick={() => {
              void fetch("/api/auth/session/clear", { method: "POST" }).then(
                () => {
                  router.push("/login");
                  router.refresh();
                },
              );
            }}
            className="text-slate-400 hover:text-white transition-colors"
          >
            Sair da conta
          </button>
        </p>
      </div>
    </div>
  );
}
