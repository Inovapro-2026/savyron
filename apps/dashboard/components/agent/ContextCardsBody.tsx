"use client";

import { motion } from "framer-motion";
import {
  CalendarDays,
  Search,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { AgentContextCard } from "./AgentContextCard";
import { formatBRLParts, type AgentContextState } from "./use-agent-context";
import type { AgentIntentMode } from "./intent-visual-state";

const MODE_META: Record<
  Exclude<AgentIntentMode, "idle">,
  { type: string; title: string; icon: LucideIcon; color: string }
> = {
  agenda: { type: "AGENDA", title: "Próximos compromissos", icon: CalendarDays, color: "#00E5FF" },
  finance: { type: "FINANCEIRO", title: "Resumo do mês", icon: Wallet, color: "#00E5A0" },
  campaign: { type: "CAMPANHA", title: "Campanha", icon: TrendingUp, color: "#A855F7" },
  search: { type: "PESQUISA", title: "Consulta externa", icon: Search, color: "#008CFF" },
  leads: { type: "LEADS", title: "Leads", icon: TrendingUp, color: "#38BDF8" },
  reports: { type: "RELATÓRIOS", title: "Relatórios", icon: TrendingUp, color: "#818CF8" },
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "Em execução", color: "#00E5A0" },
  PAUSED: { label: "Pausada", color: "#FFB020" },
  FINISHED: { label: "Encerrada", color: "#64748B" },
  CONFIRMED: { label: "Confirmado", color: "#00E5A0" },
  SCHEDULED: { label: "Agendado", color: "#00E5FF" },
  COMPLETED: { label: "Concluído", color: "#00E5A0" },
  CANCELLED: { label: "Cancelado", color: "#FF3366" },
};

function formatEventTime(iso: string, allDay: boolean): string {
  const d = new Date(iso);
  if (allDay) return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatEventDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Hoje";
  if (sameDay(d, tomorrow)) return "Amanhã";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/** Skeleton de carregando (dados reais em trânsito). */
function CardSkeleton({ color }: { color: string }) {
  return (
    <div className="space-y-2.5">
      {[0, 1].map((i) => (
        <div key={i} className="h-8 animate-pulse rounded-lg bg-white/5" style={{ animationDelay: `${i * 120}ms` }}>
          <div className="flex h-full items-center px-3">
            <span className="text-[10.5px] text-slate-500">carregando…</span>
          </div>
        </div>
      ))}
      <div className="pt-0.5 text-[10.5px] text-slate-500" style={{ color: `${color}99` }}>
        consultando dados reais…
      </div>
    </div>
  );
}

/** Estado vazio — NUNCA inventa dados. */
function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-3 text-[12px] leading-relaxed text-slate-400">
      {message}
    </div>
  );
}

interface ContextCardsBodyProps {
  /** Último modo com contexto (mantém o card montado para animar a saída). */
  mode: Exclude<AgentIntentMode, "idle">;
  /** Card visível? (false → animação de retorno suave). */
  visible: boolean;
  context: AgentContextState;
  onClose: () => void;
}

/**
 * Corpo dos cards de contexto do agente, alimentado exclusivamente por dados
 * reais das APIs do SAVYRON (useAgentContext). Um card por vez.
 */
export function ContextCardsBody({ mode, visible, context, onClose }: ContextCardsBodyProps) {
  const meta = MODE_META[mode];
  const side: "left" | "right" = mode === "campaign" ? "right" : "left";

  return (
    <>
      {/* ─── FINANCEIRO ─── */}
      {mode === "finance" ? (
        <AgentContextCard
          type={meta.type}
          title={meta.title}
          icon={meta.icon}
          color={meta.color}
          side={side}
          visible={visible}
          onClose={onClose}
        >
          {context.loading ? (
            <CardSkeleton color={meta.color} />
          ) : !context.data || context.data.kind !== "finance" || !context.data.data ? (
            <EmptyState message="Não encontrei dados financeiros registrados para o período." />
          ) : (
            <FinanceBody
              balance={context.data.data.balance}
              income={context.data.data.income}
              expenses={context.data.data.expenses}
            />
          )}
        </AgentContextCard>
      ) : null}

      {/* ─── AGENDA ─── */}
      {mode === "agenda" ? (
        <AgentContextCard
          type={meta.type}
          title={meta.title}
          icon={meta.icon}
          color={meta.color}
          side={side}
          visible={visible}
          onClose={onClose}
        >
          {context.loading ? (
            <CardSkeleton color={meta.color} />
          ) : !context.data || context.data.kind !== "agenda" || !context.data.data || context.data.data.events.length === 0 ? (
            <EmptyState message="Não encontrei compromissos de agenda para os próximos dias." />
          ) : (
            <AgendaBody events={context.data.data.events} />
          )}
        </AgentContextCard>
      ) : null}

      {/* ─── CAMPANHA ─── */}
      {mode === "campaign" ? (
        <AgentContextCard
          type={meta.type}
          title={meta.title}
          icon={meta.icon}
          color={meta.color}
          side={side}
          visible={visible}
          onClose={onClose}
        >
          {context.loading ? (
            <CardSkeleton color={meta.color} />
          ) : !context.data || context.data.kind !== "campaign" || !context.data.data ? (
            <EmptyState message="Nenhuma campanha criada ainda. Crie uma campanha para ver o desempenho aqui." />
          ) : (
            <CampaignBody campaign={context.data.data} />
          )}
        </AgentContextCard>
      ) : null}
    </>
  );
}

function FinanceBody({ balance, income, expenses }: { balance: number; income: number; expenses: number }) {
  const parts = formatBRLParts(balance);
  const positive = balance >= 0;
  return (
    <div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-sm font-semibold" style={{ color: "#00E5A0" }}>
          {parts.currency}
        </span>
        <span className="text-[28px] font-extrabold leading-none tracking-tight text-white">
          {parts.integer}
        </span>
        <span className="text-sm font-bold text-slate-400">{parts.decimals}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-[#00E5A0]/20 bg-[#00E5A0]/[0.06] px-3 py-2">
          <div className="text-[9.5px] font-semibold uppercase tracking-wider text-slate-500">Receitas</div>
          <div className="mt-0.5 text-[13px] font-bold text-[#00E5A0]">
            {formatBRLParts(income).integer}
            <span className="text-[10px] text-[#00E5A0]/70">{formatBRLParts(income).decimals}</span>
          </div>
        </div>
        <div className="rounded-lg border border-[#FF3366]/20 bg-[#FF3366]/[0.06] px-3 py-2">
          <div className="text-[9.5px] font-semibold uppercase tracking-wider text-slate-500">Despesas</div>
          <div className="mt-0.5 text-[13px] font-bold text-[#FF3366]">
            {formatBRLParts(expenses).integer}
            <span className="text-[10px] text-[#FF3366]/70">{formatBRLParts(expenses).decimals}</span>
          </div>
        </div>
      </div>
      <div className="mt-2 text-[10.5px] text-slate-500">
        Saldo {positive ? "positivo" : "negativo"} no mês corrente · dados reais do Financeiro
      </div>
    </div>
  );
}

function AgendaBody({ events }: { events: Array<{ id: string; title: string; start_date: string; all_day: boolean; status: string }> }) {
  return (
    <div className="space-y-2">
      {events.map((e) => {
        const status = STATUS_LABEL[e.status] ?? STATUS_LABEL.SCHEDULED;
        return (
          <motion.div
            key={e.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2"
          >
            <div className="w-12 shrink-0 text-center">
              <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                {formatEventDay(e.start_date)}
              </div>
              <div className="text-[13px] font-bold text-cyan-300">
                {formatEventTime(e.start_date, e.all_day)}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-semibold text-white">{e.title}</div>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full" style={{ background: status.color }} />
                <span className="text-[10.5px] text-slate-400">{status.label}</span>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function CampaignBody({ campaign }: { campaign: { name: string; status: string; total: number; processed: number; pending: number; responded: number; interested: number; errors: number } }) {
  const status = STATUS_LABEL[campaign.status] ?? { label: campaign.status, color: "#64748B" };
  const pct = campaign.total > 0 ? Math.round((campaign.processed / campaign.total) * 100) : 0;
  return (
    <div>
      <div className="truncate text-[13.5px] font-bold text-white">{campaign.name}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-[26px] font-extrabold leading-none text-white">
          {campaign.total.toLocaleString("pt-BR")}
        </span>
        <span className="text-[11px] font-medium text-slate-400">leads</span>
      </div>
      {/* Barra de progresso real */}
      <div className="mt-3">
        <div className="h-2 overflow-hidden rounded-full bg-white/5">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: "linear-gradient(90deg, #7C3CFF, #A855F7)",
              boxShadow: "0 0 10px rgba(168,85,247,0.45)",
            }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[10.5px]">
          <span className="font-semibold text-purple-300">{pct}% processado</span>
          <span className="text-slate-500">{campaign.pending} na fila</span>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded-lg border border-white/5 bg-white/[0.03] px-1 py-1.5">
          <div className="text-[12px] font-bold text-white">{campaign.responded}</div>
          <div className="text-[9px] text-slate-500">respostas</div>
        </div>
        <div className="rounded-lg border border-[#00E5A0]/20 bg-[#00E5A0]/[0.05] px-1 py-1.5">
          <div className="text-[12px] font-bold text-[#00E5A0]">{campaign.interested}</div>
          <div className="text-[9px] text-slate-500">interes.</div>
        </div>
        <div className="rounded-lg border border-[#FF3366]/20 bg-[#FF3366]/[0.05] px-1 py-1.5">
          <div className="text-[12px] font-bold text-[#FF3366]">{campaign.errors}</div>
          <div className="text-[9px] text-slate-500">erros</div>
        </div>
      </div>
      <div className="mt-2 text-[10.5px] text-slate-500">
        Dados reais da campanha {campaign.status === "ACTIVE" ? "ativa" : "selecionada"}
      </div>
    </div>
  );
}
