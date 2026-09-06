"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import type { OnboardingPlan } from "@/lib/onboarding";
import { fetchPlans } from "@/lib/onboarding";

/** Slug do plano que recebe o selo de recomendação. */
const HIGHLIGHTED_PLAN_SLUG = "enterprise";

/** Tradução de apresentação das chaves de feature — a lista real vem da API. */
const FEATURE_LABELS: Record<string, string> = {
  max_users: "Usuários",
  max_contacts: "Contatos",
  max_conversations: "Conversas/mês",
  max_messages: "Mensagens/mês",
  max_agents: "Agentes de IA",
  max_whatsapp_connections: "Conexões WhatsApp",
  max_automations: "Automações",
  max_knowledge_items: "Itens na base de conhecimento",
  max_storage: "Armazenamento",
  max_ai_usage: "Uso de IA",
  prospeccao_web: "Prospecção web",
};

function featureLabel(key: string): string {
  return (
    FEATURE_LABELS[key] ??
    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function formatLimit(limit: number | null): string {
  return limit !== null ? String(limit) : "Ilimitado";
}

function brl(price: number): string {
  return price.toFixed(2).replace(".", ",");
}

export function VitrinePlans() {
  const [plans, setPlans] = useState<OnboardingPlan[]>([]);

  useEffect(() => {
    void fetchPlans().then(setPlans);
  }, []);

  if (plans.length === 0) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-[#080D18]/80 p-8 text-center text-sm text-slate-400 backdrop-blur-md">
        <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border-2 border-[#008CFF] border-t-transparent" />
        Carregando planos neurais disponíveis...
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan) => {
        const highlighted = plan.slug === HIGHLIGHTED_PLAN_SLUG;
        return (
          <div
            key={plan.id}
            className={`relative flex flex-col rounded-2xl border p-7 backdrop-blur-xl transition-all duration-300 ${
              highlighted
                ? "border-[#008CFF] bg-[#080D18]/95 shadow-[0_0_35px_rgba(0,140,255,0.25)] ring-1 ring-[#008CFF]/40 scale-105 z-10"
                : "border-white/10 bg-[#080D18]/80 hover:border-white/20 shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
            }`}
          >
            {highlighted ? (
              <span className="absolute -top-3.5 left-7 rounded-full bg-gradient-to-r from-[#008CFF] to-[#00E5FF] px-3.5 py-1 text-[10px] font-black uppercase tracking-wider text-black shadow-[0_0_15px_rgba(0,140,255,0.5)]">
                Mais Recomendado
              </span>
            ) : null}

            <div className="text-xl font-black text-white">
              {plan.name}
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="font-mono text-3xl font-extrabold tracking-tight text-white">
                R$ {brl(plan.price)}
              </span>
              <span className="text-xs font-medium text-slate-400">/mês</span>
            </div>
            {plan.description ? (
              <div className="mt-2 text-xs text-slate-400 leading-relaxed">
                {plan.description}
              </div>
            ) : null}

            <div className="my-5 h-px bg-white/10" />

            <ul className="mb-7 flex-1 space-y-2.5">
              {plan.features.map((f) => {
                const limited = f.limit !== null;
                return (
                  <li
                    key={f.feature}
                    className={`flex items-center gap-2.5 text-xs ${
                      f.enabled ? "text-slate-300" : "text-slate-600 line-through"
                    }`}
                  >
                    <Check
                      className={`h-4 w-4 shrink-0 ${
                        f.enabled ? "text-[#00E5A0]" : "text-slate-600"
                      }`}
                      strokeWidth={2.5}
                    />
                    <span className="min-w-0 flex-1">
                      {featureLabel(f.feature)}
                    </span>
                    <span
                      className={`shrink-0 font-mono text-[11px] font-semibold ${
                        limited ? "text-[#00E5FF]" : "text-slate-400"
                      }`}
                    >
                      {formatLimit(f.limit)}
                    </span>
                  </li>
                );
              })}
            </ul>

            <Link
              href="/signup"
              className={`inline-flex w-full items-center justify-center rounded-xl px-6 py-3.5 text-xs font-bold uppercase tracking-wider transition-all ${
                highlighted
                  ? "bg-gradient-to-r from-[#008CFF] to-[#00E5FF] text-black shadow-[0_0_20px_rgba(0,140,255,0.3)] hover:brightness-110"
                  : "border border-white/10 bg-white/5 text-slate-200 hover:border-[#008CFF]/40 hover:bg-[#008CFF]/10 hover:text-white"
              }`}
            >
              Escolher {plan.name}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
