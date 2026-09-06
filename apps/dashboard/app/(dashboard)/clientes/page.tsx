"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  MessageSquare,
  Send,
  Clock,
  Calendar,
  Activity,
  Search as SearchIcon,
  TrendingUp,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  Cell,
} from "recharts";
import { DashboardShell } from "@/components/layout/shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { StatusBadge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/components/inbox/inbox-card";
import { useApi, request } from "@/hooks/use-api";
import { InboxSkeletonCards } from "@/components/inbox/skeleton-cards";

const PAGE_SIZE = 24;

interface Client {
  id: string;
  name: string | null;
  phone: string | null;
  segment: string | null;
  business_name: string | null;
  status: string;
  message_count: number;
  last_activity: string | null;
  conversation: { id: string } | null;
}

interface ClientsResponse {
  total: number;
  page: number;
  pageSize: number;
  clients: Client[];
}

interface ClientMetrics {
  windowDays: number;
  totalClients: number;
  metrics: {
    totalResponses: number;
    totalSent: number;
    totalMessages: number;
    averageResponseTime: number;
  };
  peakDay: { key: string; label: string; count: number } | null;
  peakHour: { hour: number; label: string; count: number; percentage: number } | null;
  charts: {
    byDay: { key: string; label: string; count: number }[];
    byHour: { hour: number; label: string; count: number }[];
  };
}

/** Formata segundos em "3,2 min" / "45s" / "1h". */
function formatDuration(seconds: number): string {
  if (seconds <= 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${(seconds / 60).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} min`;
  return `${(seconds / 3600).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h`;
}

const CHART_TOOLTIP_STYLE = {
  backgroundColor: "#080D18",
  border: "1px solid rgba(0, 229, 255, 0.3)",
  borderRadius: "12px",
  fontSize: "12px",
  color: "#FFFFFF",
  boxShadow: "0 0 20px rgba(0, 229, 255, 0.2)",
} as const;

function MetricCard({
  icon,
  label,
  value,
  hint,
  iconClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  hint?: string;
  iconClass: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${iconClass}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="truncate text-xl font-black leading-tight text-white">{value}</div>
          <div className="truncate text-xs font-semibold text-[#A8B3C7] mt-0.5">{label}</div>
        </div>
      </div>
      {hint ? <p className="mt-2 text-[11px] text-[#64748B]">{hint}</p> : null}
    </Card>
  );
}

/**
 * Aba "Clientes" — lista otimizada com métricas avançadas de atendimento:
 * contadores de respostas/mensagens, tempo médio de resposta e análise de
 * demanda (dia/horário de pico + gráficos) dos últimos 30 dias.
 */
export default function ClientesPage() {
  const router = useRouter();
  const { error: toastError } = useToast();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(true);

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    if (search.trim()) params.set("search", search.trim());
    return params.toString();
  }, [search, page]);

  const clientsQuery = useApi<ClientsResponse>(
    ["clients", search, String(page)],
    `clients?${query}`,
  );
  const metricsQuery = useApi<ClientMetrics>(["clients-metrics"], "clients/metrics");

  const clients = clientsQuery.data?.clients ?? [];
  const total = clientsQuery.data?.total ?? clients.length;
  const metrics = metricsQuery.data;

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const openConversation = async (client: Client) => {
    setOpeningId(client.id);
    try {
      const res = await request<{ conversationId: string }>(
        `clients/${client.id}/conversation`,
      );
      if (res?.conversationId) {
        router.push(`/inbox/${res.conversationId}`);
      } else {
        toastError("Nenhuma conversa vinculada a este cliente.");
      }
    } catch {
      toastError("Nenhuma conversa vinculada a este cliente.");
    } finally {
      setOpeningId(null);
    }
  };

  const maxDayCount = Math.max(1, ...(metrics?.charts.byDay.map((d) => d.count) ?? []));

  return (
    <DashboardShell title="Clientes">
      <div className="space-y-5">
        {/* Busca */}
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#00E5FF]" />
          <input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar cliente por nome, telefone ou segmento..."
            className="w-full rounded-2xl border border-white/10 bg-[#080D18]/80 py-2.5 pl-10 pr-4 text-xs font-semibold text-white placeholder-[#64748B] outline-none focus:border-[#00E5FF] focus:ring-2 focus:ring-[#00E5FF]/20 shadow-sm"
          />
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          <MetricCard
            icon={<Users className="h-5 w-5 text-[#00E5FF]" />}
            iconClass="bg-cyan-500/15 border border-[#00E5FF]/30 shadow-[0_0_12px_rgba(0,229,255,0.2)]"
            label="Total de clientes"
            value={metrics?.totalClients ?? total}
            hint="com conversa vinculada"
          />
          <MetricCard
            icon={<MessageSquare className="h-5 w-5 text-[#00E5A0]" />}
            iconClass="bg-emerald-500/15 border border-[#00E5A0]/30 shadow-[0_0_12px_rgba(0,229,160,0.2)]"
            label="Respostas recebidas"
            value={metrics ? metrics.metrics.totalResponses : "—"}
            hint={`últimos ${metrics?.windowDays ?? 30} dias`}
          />
          <MetricCard
            icon={<Send className="h-5 w-5 text-[#7C3CFF]" />}
            iconClass="bg-purple-500/15 border border-[#7C3CFF]/30 shadow-[0_0_12px_rgba(124,60,255,0.2)]"
            label="Mensagens enviadas"
            value={metrics ? metrics.metrics.totalSent : "—"}
            hint={`últimos ${metrics?.windowDays ?? 30} dias`}
          />
          <MetricCard
            icon={<Clock className="h-5 w-5 text-[#FFB020]" />}
            iconClass="bg-amber-500/15 border border-[#FFB020]/30 shadow-[0_0_12px_rgba(255,176,32,0.2)]"
            label="Tempo médio de resposta"
            value={metrics ? formatDuration(metrics.metrics.averageResponseTime) : "—"}
            hint="da mensagem do cliente à resposta"
          />
        </div>

        {/* Análise de demanda */}
        {metrics && metrics.metrics.totalMessages > 0 ? (
          <Card className="overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAnalytics((v) => !v)}
              className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-white/5"
            >
              <div className="flex items-center gap-2.5">
                <TrendingUp className="h-4 w-4 text-[#00E5FF]" />
                <span className="text-sm font-bold text-white">Análise de Demanda</span>
                <span className="text-[11px] text-[#A8B3C7]">últimos {metrics.windowDays} dias</span>
              </div>
              <ChevronDown className={`h-4 w-4 text-[#64748B] transition-transform ${showAnalytics ? "rotate-180" : ""}`} />
            </button>

            {showAnalytics ? (
              <div className="border-t border-white/5 px-5 py-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {/* Pico por dia */}
                  <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#0C1427]/70 p-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/15 text-[#00E5FF]">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#A8B3C7]">Dia com mais mensagens</div>
                      <div className="truncate text-lg font-bold text-white">
                        {metrics.peakDay?.label}
                      </div>
                      <div className="text-xs text-[#00E5FF] font-medium">{metrics.peakDay?.count} mensagens</div>
                    </div>
                  </div>

                  {/* Pico por horário */}
                  <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#0C1427]/70 p-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-[#FFB020]">
                      <Activity className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#A8B3C7]">Horário de pico</div>
                      <div className="truncate text-lg font-bold text-white">
                        {metrics.peakHour?.label} · {metrics.peakHour?.percentage}% das mensagens
                      </div>
                      <div className="text-xs text-[#FFB020] font-medium">{metrics.peakHour?.count} mensagens</div>
                    </div>
                  </div>

                  {/* Gráfico por dia da semana */}
                  <div className="rounded-2xl border border-white/10 bg-[#080D18]/80 p-4">
                    <div className="mb-3 text-xs font-bold text-white">
                      Mensagens por dia da semana
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={metrics.charts.byDay} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="key" tick={{ fontSize: 11, fill: "#A8B3C7" }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#A8B3C7" }} axisLine={false} tickLine={false} />
                        <Tooltip
                          cursor={{ fill: "rgba(0,229,255,0.08)" }}
                          contentStyle={CHART_TOOLTIP_STYLE}
                          formatter={(value: number) => [value, "mensagens"]}
                          labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ""}
                        />
                        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                          {metrics.charts.byDay.map((d) => (
                            <Cell key={d.key} fill={d.count === maxDayCount && d.count > 0 ? "#00E5FF" : "rgba(0,140,255,0.35)"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Gráfico por horário */}
                  <div className="rounded-2xl border border-white/10 bg-[#080D18]/80 p-4">
                    <div className="mb-3 text-xs font-bold text-white">Mensagens por horário</div>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={metrics.charts.byHour} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10, fill: "#64748B" }}
                          interval={3}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#A8B3C7" }} axisLine={false} tickLine={false} />
                        <Tooltip
                          cursor={{ stroke: "rgba(0,229,255,0.3)" }}
                          contentStyle={CHART_TOOLTIP_STYLE}
                          formatter={(value: number) => [value, "mensagens"]}
                          labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ""}
                        />
                        <Line
                          type="monotone"
                          dataKey="count"
                          stroke="#00E5FF"
                          strokeWidth={2.5}
                          dot={false}
                          activeDot={{ r: 4, fill: "#00E5FF" }}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                    <div className="mt-1 text-[11px] text-[#A8B3C7]">
                      Pico: {metrics.peakHour?.label} ({metrics.peakHour?.count} msgs)
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </Card>
        ) : null}

        {/* Lista de clientes */}
        {clientsQuery.isLoading ? (
          <InboxSkeletonCards count={8} />
        ) : clients.length > 0 ? (
          <>
            <p className="text-xs font-semibold text-[#A8B3C7]">
              {total} cliente{total === 1 ? "" : "s"}
            </p>
            <Card className="overflow-hidden">
              <div className="hidden grid-cols-12 items-center gap-4 border-b border-white/10 bg-[#0D152A] px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-[#A8B3C7] md:grid">
                <div className="col-span-4">Cliente</div>
                <div className="col-span-2">Segmento</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Mensagens</div>
                <div className="col-span-2">Última atividade</div>
              </div>

              <ul className="divide-y divide-white/5">
                {clients.map((client) => {
                  const initials = (client.name?.trim()[0] ?? "?").toUpperCase();
                  return (
                    <li key={client.id}>
                      <button
                        type="button"
                        onClick={() => void openConversation(client)}
                        disabled={openingId === client.id}
                        aria-label={`Abrir conversa com ${client.name ?? "cliente"}`}
                        className="group grid w-full grid-cols-2 items-center gap-2 px-5 py-3.5 text-left transition-colors hover:bg-[#0E1A33]/50 focus:outline-none focus-visible:bg-[#0E1A33] disabled:opacity-60 md:grid-cols-12 md:gap-4"
                      >
                        {/* Cliente */}
                        <div className="col-span-2 flex min-w-0 items-center gap-3 md:col-span-4">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[#00E5FF]/30 bg-gradient-to-tr from-[#008CFF] to-[#7C3CFF] text-xs font-black text-white shadow-[0_0_10px_rgba(0,140,255,0.3)]">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-bold text-white">
                              {client.name ?? "Contato"}
                            </div>
                            <div className="truncate text-xs text-[#A8B3C7]">
                              {client.phone ?? client.business_name ?? "—"}
                            </div>
                          </div>
                        </div>

                        {/* Segmento */}
                        <div className="hidden min-w-0 truncate text-xs text-[#A8B3C7] md:col-span-2 md:block">
                          {client.segment ?? client.business_name ?? "—"}
                        </div>

                        {/* Status */}
                        <div className="hidden md:col-span-2 md:block">
                          <StatusBadge status={client.status} />
                        </div>

                        {/* Mensagens */}
                        <div className="hidden text-xs font-semibold text-white md:col-span-2 md:block">
                          {client.message_count} msg{client.message_count === 1 ? "" : "s"}
                        </div>

                        {/* Última atividade */}
                        <div className="hidden items-center justify-between gap-2 md:col-span-2 md:flex">
                          <span className="truncate text-xs text-[#A8B3C7]">
                            {formatRelativeTime(client.last_activity)}
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-[#64748B] transition-colors group-hover:text-[#00E5FF]" />
                        </div>

                        {/* Linha inferior mobile */}
                        <div className="col-span-2 flex items-center gap-2 pt-0.5 md:hidden">
                          <StatusBadge status={client.status} />
                          <span className="text-xs text-white">
                            {client.message_count} msg
                          </span>
                          <span className="ml-auto text-xs text-[#A8B3C7]">
                            {formatRelativeTime(client.last_activity)}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>

            {clients.length < total ? (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  onClick={() => setPage((p) => p + 1)}
                  loading={clientsQuery.isFetching}
                >
                  Carregar mais
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <Card className="py-16 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-[#008CFF]/40 animate-pulse" />
            <div className="text-sm font-semibold text-[#A8B3C7]">
              {search.trim()
                ? "Nenhum cliente encontrado para esta busca."
                : "Nenhum cliente cadastrado ainda."}
            </div>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}

