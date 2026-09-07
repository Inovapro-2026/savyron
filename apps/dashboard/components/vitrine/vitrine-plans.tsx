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
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600 shadow-sm">
        <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border-2 border-[#0052FF] border-t-transparent" />
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
            className={`relative flex flex-col rounded-2xl border p-7 transition-all duration-300 ${
              highlighted
                ? "border-2 border-[#0052FF] bg-white shadow-xl ring-2 ring-[#0052FF]/15 scale-105 z-10"
                : "border-slate-200 bg-white shadow-sm hover:border-slate-300 hover:shadow-md"
            }`}
          >
            {highlighted ? (
              <span className="absolute -top-3.5 left-7 rounded-full bg-[#0052FF] px-3.5 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-md">
                Mais Recomendado
              </span>
            ) : null}

            <div className="text-xl font-black text-slate-900">
              {plan.name}
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="font-mono text-3xl font-extrabold tracking-tight text-slate-900">
                R$ {brl(plan.price)}
              </span>
              <span className="text-xs font-semibold text-slate-500">/mês</span>
            </div>
            {plan.description ? (
              <div className="mt-2 text-xs text-slate-600 leading-relaxed">
                {plan.description}
              </div>
            ) : null}

            <div className="my-5 h-px bg-slate-200" />

            <ul className="mb-7 flex-1 space-y-2.5">
              {plan.features.map((f) => {
                const limited = f.limit !== null;
                return (
                  <li
                    key={f.feature}
                    className={`flex items-center gap-2.5 text-xs ${
                      f.enabled ? "text-slate-700" : "text-slate-400 line-through"
                    }`}
                  >
                    <Check
                      className={`h-4 w-4 shrink-0 ${
                        f.enabled ? "text-[#0052FF]" : "text-slate-300"
                      }`}
                      strokeWidth={2.5}
                    />
                    <span className="min-w-0 flex-1">
                      {featureLabel(f.feature)}
                    </span>
                    <span
                      className={`shrink-0 font-mono text-[11px] font-bold ${
                        limited ? "text-[#0052FF]" : "text-slate-500"
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
                  ? "bg-[#0052FF] text-white shadow-[0_4px_14px_rgba(0,82,255,0.3)] hover:bg-[#0040D9]"
                  : "border border-slate-300 bg-white text-slate-700 hover:border-[#0052FF] hover:bg-[#0052FF]/5 hover:text-[#0052FF]"
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
