"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { adminApi, AuditLogEntry } from "@/lib/admin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  auditActionLabel,
  auditTone,
  describeAuditMeta,
  rawMetaText,
  AUDIT_ACTION_LABELS,
  AuditMetaDescription,
} from "@/lib/audit-labels";

const PAGE_SIZE = 50;

interface AuditLogResolved extends AuditLogEntry {
  actor_name?: string | null;
  entity_name?: string | null;
}

/**
 * Traduz o texto digitado no filtro: se bate com a frase legível de uma ação,
 * usa o código técnico dela; senão, busca por trecho do código (backend usa
 * contains). Assim "plano" encontra admin.subscription.plan_changed.
 */
function resolveFilter(input: string): string {
  const t = input.trim().toLowerCase();
  if (!t) return "";
  const byLabel = Object.entries(AUDIT_ACTION_LABELS).find(([, label]) =>
    label.toLowerCase().includes(t),
  );
  if (byLabel) return byLabel[0];
  return t;
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLogResolved[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [action, setAction] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const seenRef = useRef<Set<string>>(new Set());
  const [planNameById, setPlanNameById] = useState<Record<string, string>>({});

  useEffect(() => {
    void adminApi<{ plans: { id: string; name: string }[] }>("/admin/plans")
      .then((r) =>
        setPlanNameById(
          Object.fromEntries((r.plans ?? []).map((p) => [p.id, p.name])),
        ),
      )
      .catch(() => {});
  }, []);

  const load = async (page: number, replace: boolean) => {
    const q = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    const filtered = resolveFilter(action);
    if (filtered) q.set("action", filtered);
    const r = await adminApi<{ logs: AuditLogResolved[]; total: number }>(
      `/admin/audit?${q.toString()}`,
    );
    const fresh = r.logs.filter((l) => !seenRef.current.has(l.id));
    for (const l of fresh) seenRef.current.add(l.id);
    setLogs((prev) => (replace ? fresh : [...prev, ...fresh]));
    setTotal(r.total);
  };

  const reload = async (replace = true) => {
    setError(null);
    try {
      await load(1, replace);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar auditoria");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    seenRef.current = new Set();
    setLoading(true);
    void reload(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action]);

  const loadMore = async () => {
    const nextPage = Math.floor(logs.length / PAGE_SIZE) + 1;
    setLoadingMore(true);
    setError(null);
    try {
      await load(nextPage, false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar mais");
    } finally {
      setLoadingMore(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    await reload(true);
    setRefreshing(false);
  };

  const hasMore = logs.length < total;

  // Agrupa sessões de suporte: associa cada session_ended à session_started
  // anterior da mesma empresa para exibir a duração.
  const supportMeta = useMemo(() => {
    const map = new Map<string, { startedAt: number; line: AuditMetaDescription }>();
    for (const l of logs) {
      if (l.action === "support.session_started" && l.business_id) {
        map.set(l.business_id, {
          startedAt: new Date(l.created_at).getTime(),
          line: describeAuditMeta(l.action, l.metadata, { planNameById }),
        });
      }
    }
    return map;
  }, [logs, planNameById]);

  const renderSupportDuration = (l: AuditLogResolved): string | null => {
    if (l.action !== "support.session_ended" || !l.business_id) return null;
    const start = supportMeta.get(l.business_id);
    if (!start) return null;
    const ms = new Date(l.created_at).getTime() - start.startedAt;
    if (ms < 0 || ms > 24 * 60 * 60 * 1000) return null;
    const s = Math.round(ms / 1000);
    if (s < 60) return `Duração: ${s}s`;
    return `Duração: ${Math.floor(s / 60)}min ${s % 60}s`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#008CFF]/10 border border-[#008CFF]/25 text-[11px] font-semibold text-[#00E5FF] mb-2 uppercase tracking-wider">
            Auditoria & Segurança Global
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">Trilha de Auditoria</h1>
          <p className="text-sm text-slate-400">
            Registro imutável de eventos administrativos, acessos de suporte, cobrança e mutações na plataforma.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="Filtrar (ex.: pagamento, plano, suporte)..."
            className="w-72"
          />
          <Button
            variant="outline"
            className="border-white/10 text-slate-300 hover:bg-white/5"
            onClick={() => void refresh()}
            loading={refreshing}
          >
            Atualizar
          </Button>
        </div>
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
            Carregando eventos de auditoria...
          </div>
        </div>
      ) : (
        <Card className="flex max-h-[75vh] flex-col border border-white/10 bg-[#080D18]/80 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.4)] p-0 rounded-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5 bg-white/[0.02]">
            <span className="text-xs font-mono text-slate-400">
              Total: <strong className="text-[#00E5FF]">{total}</strong> eventos · Exibindo <strong className="text-white">{logs.length}</strong>
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="divide-y divide-white/5">
              {logs.map((l) => {
                const label = auditActionLabel(l.action);
                const tone = auditTone(l.action);
                const meta = describeAuditMeta(l.action, l.metadata, {
                  planNameById,
                });
                const duration = renderSupportDuration(l);
                return (
                  <div
                    key={l.id}
                    className="px-5 py-3.5 transition-colors hover:bg-white/[0.02]"
                    title={rawMetaText(l.metadata)}
                  >
                    <div className="flex flex-wrap items-center gap-2.5">
                      <code
                        className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tone}`}
                      >
                        {label}
                      </code>
                      <span className="text-xs font-mono text-slate-500">
                        {new Date(l.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-400">
                      {l.actor_name ? (
                        <span>
                          por <strong className="text-slate-200">{l.actor_name}</strong>
                        </span>
                      ) : l.actor ? (
                        <span title={`actor: ${l.actor}`}>
                          por <code className="font-mono text-slate-300">{l.actor.slice(0, 12)}…</code>
                        </span>
                      ) : null}
                      {l.entity_name ? (
                        <span>
                          <span className="text-slate-600">•</span>{" "}
                          alvo: <strong className="text-slate-200">{l.entity_name}</strong>
                        </span>
                      ) : l.entity ? (
                        <span title={`${l.entity}:${l.entity_id}`}>
                          <span className="text-slate-600">•</span>{" "}
                          <span className="font-mono text-slate-300">{l.entity}:{String(l.entity_id ?? "").slice(0, 12)}</span>
                        </span>
                      ) : null}
                      {l.business_id && !l.entity_name ? (
                        <span title={`business_id: ${l.business_id}`}>
                          <span className="text-slate-600">•</span> empresa{" "}
                          <code className="font-mono text-slate-400">{l.business_id.slice(0, 12)}…</code>
                        </span>
                      ) : null}
                    </div>

                    {meta.lines.length > 0 ? (
                      <div className="mt-1.5 space-y-0.5 rounded-lg border border-white/5 bg-[#020409]/60 px-3 py-2 text-xs font-mono text-slate-300">
                        {meta.lines.map((line, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <span className="text-[#00E5A0] font-bold">→</span> {line}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {duration ? (
                      <div className="mt-1 text-xs font-medium text-amber-300">{duration}</div>
                    ) : null}
                    {meta.warnings.length > 0 ? (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {meta.warnings.map((w, i) => (
                          <span
                            key={i}
                            className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.15)]"
                          >
                            ⚠ {w}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {logs.length === 0 && (
                <div className="px-5 py-10 text-center text-sm text-slate-500">
                  Nenhum registro de auditoria encontrado.
                </div>
              )}
            </div>
          </div>
          {hasMore && (
            <div className="border-t border-white/10 p-3 bg-white/[0.02]">
              <Button
                variant="outline"
                className="w-full border-white/10 text-slate-300 hover:bg-white/5 hover:text-white"
                onClick={() => void loadMore()}
                loading={loadingMore}
              >
                Carregar mais registros
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
