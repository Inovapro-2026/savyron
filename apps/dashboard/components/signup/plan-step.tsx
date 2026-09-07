"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OnboardingPlan } from "@/lib/onboarding";

/** Slug do plano que recebe o selo "Mais popular". */
const HIGHLIGHTED_PLAN_SLUG = "professional";

/** Quantas features exibir resumidamente no card (o resto fica no modal). */
const CARD_MAX_FEATURES = 5;

/**
 * Rótulos de exibição para as chaves de recurso do PlanFeature.
 * Tradução de apresentação — a lista real de features/limites vem da API.
 */
const FEATURE_LABELS: Record<string, string> = {
  max_users: "Usuários",
  max_contacts: "Contatos",
  max_conversations: "Conversas/mês",
  max_messages: "Mensagens/mês",
  max_agents: "Agentes de IA",
  max_whatsapp_connections: "Conexões WhatsApp",
  max_automations: "Automações",
  max_knowledge_items: "Base de conhecimento",
  max_storage: "Armazenamento",
  max_ai_usage: "Uso de IA",
  prospeccao_web: "Prospecção web",
  whatsapp_group_extraction: "Extração de grupos WA",
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

function formatPrice(price: number): string {
  return price.toFixed(2).replace(".", ",");
}

/* ─────────────────────────────────────────────────────────────
   PlanDetailsModal
   ───────────────────────────────────────────────────────────── */
interface ModalProps {
  plan: OnboardingPlan;
  onClose: () => void;
  onSelect: (id: string) => void;
  isSelected: boolean;
}

function PlanDetailsModal({ plan, onClose, onSelect, isSelected }: ModalProps) {
  // Fecha com ESC
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Trava scroll do body enquanto modal aberto
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handleSelect = () => {
    onSelect(plan.id);
    onClose();
  };

  const enabledFeatures = plan.features.filter((f) => f.enabled);
  const disabledFeatures = plan.features.filter((f) => !f.enabled);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Detalhes do plano ${plan.name}`}
    >
      <div
        className="relative flex flex-col rounded-2xl border border-white/10 overflow-hidden"
        style={{
          width: "calc(100% - 24px)",
          maxWidth: "520px",
          maxHeight: "85vh",
          background: "rgba(6,10,20,0.98)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.85), 0 0 40px rgba(0,140,255,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-5 sm:p-6 border-b border-white/10 shrink-0">
          <div className="min-w-0">
            <div className="font-display text-xl font-bold text-white truncate">{plan.name}</div>
            <div className="mt-1.5 flex items-baseline gap-1">
              <span className="text-3xl font-black text-white">
                R$ {formatPrice(plan.price)}
              </span>
              <span className="text-sm text-slate-400">/mês</span>
            </div>
            {plan.description && (
              <p className="mt-1.5 text-sm text-slate-400 leading-snug">{plan.description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="mt-0.5 shrink-0 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-slate-400 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00E5FF]/50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Feature list — scrollable */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Recursos incluídos
          </p>
          <ul className="space-y-3">
            {enabledFeatures.map((f) => (
              <li
                key={f.feature}
                className="flex items-center gap-3 text-sm text-slate-200"
              >
                <Check
                  className="h-4 w-4 shrink-0 text-[#00E5A0]"
                  strokeWidth={3}
                />
                <span className="flex-1 min-w-0">{featureLabel(f.feature)}</span>
                <span className="shrink-0 font-semibold tabular-nums text-white">
                  {formatLimit(f.limit)}
                </span>
              </li>
            ))}
          </ul>
          {disabledFeatures.length > 0 && (
            <>
              <p className="mt-5 mb-3 text-xs font-semibold uppercase tracking-widest text-slate-600">
                Não incluído neste plano
              </p>
              <ul className="space-y-2.5">
                {disabledFeatures.map((f) => (
                  <li
                    key={f.feature}
                    className="flex items-center gap-3 text-sm text-slate-600"
                  >
                    <X className="h-4 w-4 shrink-0 text-slate-700" strokeWidth={2.5} />
                    <span className="flex-1 min-w-0 line-through">{featureLabel(f.feature)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 sm:p-6 border-t border-white/10 shrink-0">
          <Button
            type="button"
            onClick={handleSelect}
            className="w-full shadow-[0_0_20px_rgba(0,140,255,0.3)]"
          >
            {isSelected ? "✓ Plano selecionado" : "Selecionar plano"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   PlanCard
   ───────────────────────────────────────────────────────────── */
interface CardProps {
  plan: OnboardingPlan;
  isSelected: boolean;
  isHighlighted: boolean;
  isPromo: boolean;
  onSelect: (id: string) => void;
  onOpenModal: (plan: OnboardingPlan) => void;
}

function PlanCard({ plan, isSelected, isHighlighted, isPromo, onSelect, onOpenModal }: CardProps) {
  const enabledFeatures = plan.features.filter((f) => f.enabled);
  const summaryFeatures = enabledFeatures.slice(0, CARD_MAX_FEATURES);
  const extraCount = enabledFeatures.length - CARD_MAX_FEATURES;

  return (
    <div
      className={`relative flex flex-col rounded-2xl border-2 transition-all duration-200 ${
        isSelected
          ? "border-[#00E5FF]/70 shadow-[0_0_28px_rgba(0,229,255,0.18),0_0_0_1px_rgba(0,229,255,0.1)]"
          : "border-white/10 hover:border-white/20"
      }`}
      style={{
        background: isSelected
          ? "linear-gradient(145deg, rgba(0,229,255,0.06) 0%, rgba(8,13,24,0.92) 100%)"
          : "rgba(8,13,24,0.85)",
      }}
    >
      {/* Badge Promoção */}
      {isPromo && (
        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-[#00E5A0] to-[#00B4D8] px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black shadow-[0_0_14px_rgba(0,229,160,0.5)]">
          ✦ PROMOÇÃO
        </span>
      )}

      {/* Badge Mais Popular */}
      {isHighlighted && !isPromo && (
        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-[#008CFF] to-[#7C3CFF] px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-[0_0_12px_rgba(0,140,255,0.4)]">
          ★ Mais popular
        </span>
      )}

      {/* Check badge quando selecionado */}
      {isSelected && (
        <span className="absolute right-3.5 top-3.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#00E5A0] text-black shadow-[0_0_10px_rgba(0,229,160,0.5)]">
          <Check className="h-4 w-4 stroke-[3]" />
        </span>
      )}

      {/* Conteúdo interno com padding */}
      <div className="flex flex-col flex-1 p-5">
        {/* Nome + Preço */}
        <div className="pr-8">
          <div className="font-display text-base font-bold text-white tracking-tight">{plan.name}</div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black tracking-tight text-white">
              R$ {formatPrice(plan.price)}
            </span>
            <span className="text-xs font-medium text-slate-400">/mês</span>
          </div>
          {plan.description && (
            <div className="mt-1.5 text-xs text-slate-400 leading-snug">{plan.description}</div>
          )}
        </div>

        {/* Divider */}
        <div className="my-4 h-px bg-white/10" />

        {/* Features resumidas */}
        <ul className="space-y-2 flex-1">
          {summaryFeatures.map((f) => (
            <li key={f.feature} className="flex items-center gap-2 text-xs text-slate-300">
              <Check className="h-3 w-3 shrink-0 text-[#00E5A0]" strokeWidth={3} />
              <span className="flex-1 min-w-0 truncate">{featureLabel(f.feature)}</span>
              <span className="shrink-0 font-semibold text-white tabular-nums text-xs">
                {formatLimit(f.limit)}
              </span>
            </li>
          ))}
          {extraCount > 0 && (
            <li className="text-xs text-slate-600 pl-5">
              + {extraCount} recurso{extraCount > 1 ? "s" : ""} adicionais
            </li>
          )}
        </ul>

        {/* Botões */}
        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={() => onOpenModal(plan)}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 transition hover:border-[#00E5FF]/30 hover:text-[#00E5FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00E5FF]/50"
            aria-label={`Ver detalhes do plano ${plan.name}`}
          >
            <ChevronRight className="h-3.5 w-3.5" />
            Ler mais
          </button>
          <Button
            type="button"
            onClick={() => onSelect(plan.id)}
            className={`w-full text-sm py-2 ${
              isSelected
                ? "shadow-[0_0_20px_rgba(0,229,255,0.25)]"
                : "shadow-[0_0_12px_rgba(0,140,255,0.2)]"
            }`}
          >
            {isSelected ? "✓ Selecionado" : "Selecionar plano"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   PlanStep (exportado)
   ───────────────────────────────────────────────────────────── */
export function PlanStep({
  plans,
  selectedPlan,
  onSelect,
  onContinue,
  loading,
  error,
}: {
  plans: OnboardingPlan[];
  selectedPlan: string;
  onSelect: (id: string) => void;
  onContinue: () => void;
  loading: boolean;
  error?: string | null;
}) {
  const [modalPlan, setModalPlan] = useState<OnboardingPlan | null>(null);

  const closeModal = useCallback(() => setModalPlan(null), []);

  if (plans.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-[#080D18]/80 p-6 text-center text-sm text-slate-400">
        Carregando planos disponíveis...
      </div>
    );
  }

  return (
    <>
      {/* Modal de detalhes do plano */}
      {modalPlan && (
        <PlanDetailsModal
          plan={modalPlan}
          onClose={closeModal}
          onSelect={onSelect}
          isSelected={selectedPlan === modalPlan.id}
        />
      )}

      <div className="space-y-5">
        {/* Grid: 1 coluna no mobile, 3 no desktop (md = 768px+) */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isSelected={selectedPlan === plan.id}
              isHighlighted={plan.slug === HIGHLIGHTED_PLAN_SLUG}
              isPromo={plan.slug === "initial"}
              onSelect={onSelect}
              onOpenModal={setModalPlan}
            />
          ))}
        </div>

        {/* Botão principal */}
        <Button
          type="button"
          onClick={onContinue}
          className="w-full shadow-[0_0_20px_rgba(0,140,255,0.3)]"
          loading={loading}
          disabled={!selectedPlan || loading}
        >
          Criar conta e ir para o pagamento
        </Button>
        <p className="text-center text-xs text-slate-500">
          Pagamento seguro via PIX · Cancele quando quiser
        </p>

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
            {error}
          </div>
        )}
      </div>
    </>
  );
}
