"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useAgentContext — busca dados REAIS do SAVYRON para os cards de contexto
 * do agente (/agent). NUNCA inventa valores: usa as APIs existentes.
 *
 * Fontes (todas já presentes no sistema):
 * - FINANCE  → GET /api/proxy/financial/summary
 * - AGENDA   → GET /api/proxy/calendar/events?start=agora (próximos 7 dias)
 * - CAMPAIGN → GET /api/proxy/campaigns (campanha ativa mais recente)
 * - SEARCH   → sem fetch (a resposta vem do próprio chat; o card mostra
 *              apenas o estado da pesquisa + resumo textual da resposta)
 */

export type AgentContextMode =
  | "idle"
  | "agenda"
  | "finance"
  | "campaign"
  | "search"
  | "leads"
  | "reports";

export interface FinanceContextData {
  balance: number;
  income: number;
  expenses: number;
  lastBalance: number | null;
}

export interface AgendaEventItem {
  id: string;
  title: string;
  start_date: string;
  all_day: boolean;
  status: string;
  priority?: string;
}

export interface AgendaContextData {
  events: AgendaEventItem[];
  total: number;
}

export interface CampaignContextData {
  id: string;
  name: string;
  status: string;
  total: number;
  processed: number;
  pending: number;
  responded: number;
  interested: number;
  errors: number;
}

export type AgentContextData =
  | { kind: "finance"; data: FinanceContextData | null }
  | { kind: "agenda"; data: AgendaContextData | null }
  | { kind: "campaign"; data: CampaignContextData | null }
  | { kind: "search"; data: { query: string } | null }
  | { kind: "leads"; data: null }
  | { kind: "reports"; data: null };

export interface AgentContextState {
  mode: AgentContextMode;
  loading: boolean;
  /** true quando a API respondeu ok mas não há dados (estado vazio real). */
  empty: boolean;
  data: AgentContextData | null;
  /** Timestamp da busca (para re-render animado). */
  fetchedAt: number;
}

const INITIAL: AgentContextState = {
  mode: "idle",
  loading: false,
  empty: false,
  data: null,
  fetchedAt: 0,
};

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/** Formata moeda em partes para exibição destacada no card. */
export function formatBRLParts(value: number): {
  currency: string;
  integer: string;
  decimals: string;
} {
  const formatted = formatBRL(value);
  const match = formatted.match(/^([^\d]*)([\d.,]+)$/);
  if (!match) return { currency: "R$", integer: formatted, decimals: "" };
  const intPart = match[2].split(",")[0];
  const decPart = match[2].split(",")[1];
  return { currency: match[1] || "R$", integer: intPart, decimals: decPart ? `,${decPart}` : "" };
}

export function useAgentContext() {
  const [state, setState] = useState<AgentContextState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);
  const modeRef = useRef<AgentContextMode>("idle");
  modeRef.current = state.mode;

  const clear = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(INITIAL);
  }, []);

  const load = useCallback(async (mode: AgentContextMode, query?: string) => {
    // SEARCH não precisa de fetch — o resultado chega pela resposta do chat.
    if (mode === "idle" || mode === "search" || mode === "leads" || mode === "reports") {
      setState({
        mode,
        loading: false,
        empty: false,
        data:
          mode === "search"
            ? { kind: "search", data: { query: query ?? "" } }
            : null,
        fetchedAt: Date.now(),
      });
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState((prev) => ({ ...prev, mode, loading: true, empty: false, data: null }));

    try {
      if (mode === "finance") {
        const res = await fetch("/api/proxy/financial/summary", {
          signal: controller.signal,
        });
        const json = await res.json();
        if (controller.signal.aborted || modeRef.current !== mode) return;
        if (res.ok && json.success) {
          const d = json.data;
          const data: FinanceContextData = {
            balance: Number(d?.current_month?.balance ?? 0),
            income: Number(d?.current_month?.income ?? 0),
            expenses: Number(d?.current_month?.expenses ?? 0),
            lastBalance:
              d?.last_month?.balance !== undefined
                ? Number(d.last_month.balance)
                : null,
          };
          setState({
            mode,
            loading: false,
            empty: false,
            data: { kind: "finance", data },
            fetchedAt: Date.now(),
          });
        } else {
          setState({ mode, loading: false, empty: true, data: { kind: "finance", data: null }, fetchedAt: Date.now() });
        }
        return;
      }

      if (mode === "agenda") {
        const start = new Date();
        const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
        const url = `/api/proxy/calendar/events?start=${start.toISOString()}&end=${end.toISOString()}`;
        const res = await fetch(url, { signal: controller.signal });
        const json = await res.json();
        if (controller.signal.aborted || modeRef.current !== mode) return;
        if (res.ok && json.success) {
          const events: AgendaEventItem[] = (json.data?.events ?? [])
            .slice(0, 3)
            .map((e: Record<string, unknown>) => ({
              id: String(e.id),
              title: String(e.title ?? "Evento"),
              start_date: String(e.start_date ?? new Date().toISOString()),
              all_day: Boolean(e.all_day),
              status: String(e.status ?? "SCHEDULED"),
              priority: e.priority ? String(e.priority) : undefined,
            }));
          setState({
            mode,
            loading: false,
            empty: events.length === 0,
            data: { kind: "agenda", data: { events, total: Number(json.data?.total ?? events.length) } },
            fetchedAt: Date.now(),
          });
        } else {
          setState({ mode, loading: false, empty: true, data: { kind: "agenda", data: null }, fetchedAt: Date.now() });
        }
        return;
      }

      if (mode === "campaign") {
        const res = await fetch("/api/proxy/campaigns", { signal: controller.signal });
        const json = await res.json();
        if (controller.signal.aborted || modeRef.current !== mode) return;
        if (res.ok && json.success) {
          // A API retorna o array direto em `data` (ok(res, withStats)).
          const campaigns: Array<Record<string, unknown>> = Array.isArray(json.data)
            ? json.data
            : Array.isArray(json.data?.campaigns)
              ? json.data.campaigns
              : [];
          const active =
            campaigns.find((c) => c.status === "ACTIVE") ??
            campaigns[0] ??
            null;
          if (!active) {
            setState({ mode, loading: false, empty: true, data: { kind: "campaign", data: null }, fetchedAt: Date.now() });
            return;
          }
          const stats = (active.stats ?? {}) as Record<string, number>;
          const data: CampaignContextData = {
            id: String(active.id),
            name: String(active.name ?? "Campanha"),
            status: String(active.status ?? "PAUSED"),
            total: Number(stats.total ?? 0),
            processed: Number(stats.processed ?? 0),
            pending: Number(stats.pending ?? 0),
            responded: Number(stats.responded ?? 0),
            interested: Number(stats.interested ?? 0),
            errors: Number(stats.errors ?? 0),
          };
          setState({
            mode,
            loading: false,
            empty: false,
            data: { kind: "campaign", data },
            fetchedAt: Date.now(),
          });
        } else {
          setState({ mode, loading: false, empty: true, data: { kind: "campaign", data: null }, fetchedAt: Date.now() });
        }
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      if (modeRef.current === mode) {
        setState({ mode, loading: false, empty: true, data: null, fetchedAt: Date.now() });
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return {
    context: state,
    loadContext: load,
    clearContext: clear,
  };
}
