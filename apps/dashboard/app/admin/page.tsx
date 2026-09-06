"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { adminApi, AdminDashboard } from "@/lib/admin";
import { Card } from "@/components/ui/card";

const brl = (n: number) =>
  `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const TOOLTIP_STYLE = {
  backgroundColor: "rgba(8, 13, 24, 0.95)",
  border: "1px solid rgba(0, 140, 255, 0.3)",
  borderRadius: "12px",
  fontSize: "12px",
  color: "#fff",
  boxShadow: "0 0 20px rgba(0,0,0,0.8)",
  backdropFilter: "blur(12px)",
} as const;

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi<AdminDashboard>("/admin/dashboard")
      .then(setData)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Falha ao carregar"),
      );
  }, []);

  if (error)
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-400 backdrop-blur-md">
        {error}
      </div>
    );
  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#080D18]/80 px-5 py-3 text-sm text-slate-400 backdrop-blur-md">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#008CFF] border-t-transparent" />
          Carregando métricas da plataforma...
        </div>
      </div>
    );
  }

  const metrics = [
    { label: "MRR", value: brl(data.mrr_value), sub: `${data.mrr} assinaturas ativas`, highlight: true },
    { label: "ARR", value: brl(data.arr) },
    { label: "Receita do mês", value: brl(data.month_revenue) },
    { label: "Receita total", value: brl(data.total_revenue) },
    { label: "Empresas", value: String(data.businesses.total), sub: `${data.businesses.active} ativas` },
    { label: "Clientes Ativos", value: String(data.active_clients) },
    { label: "Período Trial", value: String(data.trial) },
    { label: "Canceladas", value: String(data.cancelled), sub: `Churn ${(data.churn * 100).toFixed(1)}%` },
    { label: "Assinaturas vencidas", value: String(data.overdue_subscriptions) },
    { label: "Pagamentos pendentes", value: String(data.pending_payments) },
  ];

  const tokenTotal = Math.max(1, data.ai_usage.tokens);

  return (
    <div className="space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#008CFF]/10 border border-[#008CFF]/25 text-[11px] font-semibold text-[#00E5FF] mb-3 uppercase tracking-wider shadow-[0_0_15px_rgba(0,140,255,0.15)]">
          <span className="h-2 w-2 rounded-full bg-[#00E5FF] animate-pulse" />
          SAVYRON Core Engine &bull; Telemetria Global
        </div>
        <h1 className="text-3xl font-black tracking-tight text-white">Visão Geral da Plataforma</h1>
        <p className="mt-1 text-sm text-slate-400">
          Métricas consolidadas de receita, infraestrutura, consumo neural e faturamento.
        </p>
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#080D18]/80 p-4 backdrop-blur-md transition-all duration-200 hover:border-[#008CFF]/40 hover:shadow-[0_0_25px_rgba(0,140,255,0.15)]"
          >
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{m.label}</div>
            <div className="mt-1.5 font-mono text-xl font-bold tracking-tight text-white">
              {m.value}
            </div>
            {m.sub ? (
              <div className="mt-1 text-[11px] font-medium text-[#00E5FF]">{m.sub}</div>
            ) : null}
          </div>
        ))}
      </div>

      {/* Gráficos de tendência */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#080D18]/80 p-6 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-wide text-white">
              Evolução de Faturamento <span className="text-xs font-normal text-slate-400">(Últimos 30 dias)</span>
            </h3>
            <span className="h-2 w-2 rounded-full bg-[#00E5A0] shadow-[0_0_8px_#00E5A0]" />
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data.revenue_trend} margin={{ top: 8, right: 8, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="adminRevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00E5A0" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#00E5A0" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#64748B" }} tickFormatter={(v) => v.slice(5)} interval={4} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [brl(v), "Receita"]} />
              <Area type="monotone" dataKey="value" stroke="#00E5A0" strokeWidth={2.5} fill="url(#adminRevGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#080D18]/80 p-6 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-wide text-white">
              Crescimento de Empresas <span className="text-xs font-normal text-slate-400">(Últimos 6 meses)</span>
            </h3>
            <span className="h-2 w-2 rounded-full bg-[#008CFF] shadow-[0_0_8px_#008CFF]" />
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.business_growth} margin={{ top: 8, right: 8, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: "rgba(0,140,255,0.06)" }} contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [v, "Empresas"]} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {data.business_growth.map((b, i) => (
                  <Cell key={b.month} fill={i === data.business_growth.length - 1 ? "#008CFF" : "#7C3CFF"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monitoramento da IA */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]" />
          Consumo & Telemetria Neural (IA)
        </h2>
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4 lg:grid-cols-6">
          {[
            { label: "Tokens Totais", value: tokenTotal.toLocaleString("pt-BR") },
            { label: "Input Tokens", value: data.ai_usage.input_tokens.toLocaleString("pt-BR") },
            { label: "Output Tokens", value: data.ai_usage.output_tokens.toLocaleString("pt-BR") },
            { label: "Gerações IA", value: String(data.ai_usage.generations) },
            { label: "Custo Estimado (Mês)", value: brl(data.ai_usage.estimated_cost_brl) },
            { label: "Contatos Impactados", value: String(data.ai_usage.contacts) },
          ].map((m) => (
            <div key={m.label} className="rounded-2xl border border-white/10 bg-[#080D18]/80 p-4 backdrop-blur-md">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{m.label}</div>
              <div className="mt-1.5 font-mono text-base font-bold text-slate-100">{m.value}</div>
            </div>
          ))}
        </div>
        {/* Proporção input/output */}
        <div className="mt-4 rounded-xl border border-white/10 bg-[#080D18]/60 p-4 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Proporção Input / Output Tokens</span>
            <span className="font-mono text-[#00E5FF]">{((data.ai_usage.input_tokens / tokenTotal) * 100).toFixed(1)}% / {(100 - (data.ai_usage.input_tokens / tokenTotal) * 100).toFixed(1)}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(data.ai_usage.input_tokens / tokenTotal) * 100}%`,
                background: "linear-gradient(90deg, #00E5A0, #008CFF, #7C3CFF)",
              }}
            />
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Distribuição de processamento neural (esmeralda/azul = input de contexto, violeta = output gerado).
          </p>
        </div>
      </div>

      {/* Monitoramento de mensagens */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#008CFF] shadow-[0_0_8px_#008CFF]" />
          Vazão de Mensagens & Interações
        </h2>
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          {[
            { label: "Mensagens Totais", value: String(data.messages.total) },
            { label: "Mensagens Recebidas", value: String(data.messages.inbound) },
            { label: "Mensagens Enviadas", value: String(data.messages.outbound) },
            { label: "Média por Cliente", value: String(data.messages.avg_per_client) },
          ].map((m) => (
            <div key={m.label} className="rounded-2xl border border-white/10 bg-[#080D18]/80 p-4 backdrop-blur-md">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{m.label}</div>
              <div className="mt-1.5 font-mono text-lg font-bold text-white">{m.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
