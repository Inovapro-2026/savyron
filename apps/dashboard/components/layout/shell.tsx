"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Crown, CreditCard } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Topbar } from "@/components/layout/topbar";
import { OfflineBanner } from "@/components/realtime/offline-banner";
import { realtimeClient } from "@/lib/socket-client";
import { useApi, request } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";

interface BillingStatus {
  business: { status: string };
  is_expired: boolean;
  cakto_configured: boolean;
  abacatepay_configured: boolean;
}

/**
 * Bloqueio por VENCIMENTO: quando a assinatura expirou, exibe um modal em tela
 * cheia que impede o uso das funcionalidades — com exceção da rota "Planos"
 * (por onde o cliente renova). O backend também bloqueia ações (middleware).
 */
export function DashboardShell({
  title,
  children,
  hideHeader = false,
  fullBleed = false,
}: {
  title: string;
  children: React.ReactNode;
  hideHeader?: boolean;
  fullBleed?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const billing = useApi<BillingStatus>(["billing-status"], "billing/status", {
    refetchInterval: 60000,
  });
  const isPlanos = pathname?.startsWith("/settings/plano") ?? false;
  const expired = Boolean(billing.data?.is_expired) && !isPlanos;

  // Inicia a conexão Socket.IO (singleton) assim que o painel monta, em qualquer
  // rota. Sem isso, o banner "offline" ficaria visível em telas que não
  // assinam eventos (ex.: /prospect), mesmo com o tempo real funcionando.
  useEffect(() => {
    void realtimeClient.getSocket();
  }, []);

  const renew = async () => {
    // Com AbacatePay configurada, o PIX é gerado inline em /settings/plano.
    if (billing.data?.abacatepay_configured) {
      router.push("/settings/plano");
      return;
    }
    try {
      const res = await request<{ url: string }>("billing/checkout", {
        method: "POST",
        body: {},
      });
      if (res?.url) window.location.href = res.url;
    } catch {
      router.push("/settings/plano");
    }
  };

  return (
    <div className={`dashboard-wrapper ${fullBleed ? "!bg-[#020409]" : ""}`}>
      <Sidebar collapsed={collapsed} onToggleCollapsed={() => setCollapsed((v) => !v)} />
      <div className={`flex min-h-screen flex-col ${collapsed ? "lg:pl-20" : "lg:pl-64"} transition-[padding] duration-200`}>
        {!hideHeader && <Topbar title={title} />}
        <OfflineBanner />
        {fullBleed ? (
          <main className="flex-1 flex flex-col w-full min-h-screen p-0 pb-20 lg:pb-0 overflow-x-hidden">
            {children}
          </main>
        ) : (
          <main className="dashboard-dark-theme flex-1 pb-20 lg:pb-8">
            <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8">
              {children}
            </div>
          </main>
        )}
        <BottomNav />
      </div>

      {expired ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl border border-[#FF3366]/40 bg-[#050914] p-7 text-center shadow-[0_0_35px_rgba(255,51,102,0.25)]">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#FF3366]/15 border border-[#FF3366]/30 text-[#FF3366] shadow-[0_0_15px_rgba(255,51,102,0.2)]">
              <Crown className="h-7 w-7" />
            </div>
            <h2 className="mb-2 text-xl font-bold text-white tracking-tight">
              Seu plano expirou
            </h2>
            <p className="mb-6 text-sm text-[#A8B3C7]">
              Seu plano profissional expirou. Para continuar utilizando o
              SAVYRON e não perder suas campanhas e dados, realize a renovação
              agora.
            </p>
            <div className="space-y-2.5">
              <Button onClick={() => void renew()} className="w-full">
                <CreditCard className="mr-2 h-4 w-4" />
                Renovar Assinatura
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push("/settings/plano")}
              >
                Gerenciar meu plano
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
