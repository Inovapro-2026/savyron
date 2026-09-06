"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi, AdminUsageRow, AdminBusiness } from "@/lib/admin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function defaultMonth(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    from: `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`,
    to: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
  };
}

export default function AdminUsagePage() {
  const [rows, setRows] = useState<AdminUsageRow[]>([]);
  const [businesses, setBusinesses] = useState<AdminBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState("");
  const [range, setRange] = useState(() => defaultMonth());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from: range.from, to: range.to });
      if (businessId) params.set("businessId", businessId);
      const r = await adminApi<{ usage: AdminUsageRow[] }>(
        `/admin/usage?${params.toString()}`,
      );
      setRows(r.usage);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar uso");
    } finally {
      setLoading(false);
    }
  }, [businessId, range.from, range.to]);

  useEffect(() => {
    void load();
    adminApi<AdminBusiness[]>("/admin/businesses")
      .then(setBusinesses)
      .catch(() => {});
  }, [load]);

  const totals = rows.reduce(
    (acc, r) => ({
      messages_sent: acc.messages_sent + r.messages_sent,
      messages_received: acc.messages_received + r.messages_received,
      conversations: acc.conversations + r.conversations,
      ai_generations: acc.ai_generations + r.ai_generations,
      ai_input_tokens: acc.ai_input_tokens + r.ai_input_tokens,
      ai_output_tokens: acc.ai_output_tokens + r.ai_output_tokens,
      leads: acc.leads + r.leads_created,
      opt_outs: acc.opt_outs + r.opt_outs,
    }),
    {
      messages_sent: 0,
      messages_received: 0,
      conversations: 0,
      ai_generations: 0,
      ai_input_tokens: 0,
      ai_output_tokens: 0,
      leads: 0,
      opt_outs: 0,
    },
  );

  const totalsTokens = totals.ai_input_tokens + totals.ai_output_tokens;

  const metricCard = (label: string, value: number) => (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#080D18]/80 p-4 backdrop-blur-md transition-all duration-200 hover:border-[#008CFF]/40 hover:shadow-[0_0_20px_rgba(0,140,255,0.15)]">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-1.5 font-mono text-xl font-bold text-white">
        {value.toLocaleString("pt-BR")}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#008CFF]/10 border border-[#008CFF]/25 text-[11px] font-semibold text-[#00E5FF] mb-2 uppercase tracking-wider">
          Telemetria de Consumo
        </div>
        <h1 className="text-3xl font-black tracking-tight text-white">Consumo & Capacidade</h1>
        <p className="text-sm text-slate-400">
          Métricas agregadas de tráfego, mensagens enviadas/recebidas, tokens neurais e contatos criados.
        </p>
      </div>

      <Card className="border border-white/10 bg-[#080D18]/80 p-5 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
        <div className="grid gap-3.5 sm:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">Empresa</label>
            <select
              className="w-full rounded-xl border border-white/10 bg-[#020409]/70 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-[#008CFF]/60"
              value={businessId}
              onChange={(e) => setBusinessId(e.target.value)}
            >
              <option value="" className="bg-[#080D18]">Todas as empresas</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id} className="bg-[#080D18]">
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">De</label>
            <Input
              type="date"
              value={range.from}
              onChange={(e) => setRange({ ...range, from: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">Até</label>
            <Input
              type="date"
              value={range.to}
              onChange={(e) => setRange({ ...range, to: e.target.value })}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={() => void load()} className="w-full bg-gradient-to-r from-[#008CFF] to-[#00E5FF] text-black font-semibold">
              Aplicar Filtros
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-7">
        {metricCard("Mensagens enviadas", totals.messages_sent)}
        {metricCard("Mensagens recebidas", totals.messages_received)}
        {metricCard("Conversas", totals.conversations)}
        {metricCard("Gerações de IA", totals.ai_generations)}
        {metricCard("Tokens de IA", totalsTokens)}
        {metricCard("Contatos criados", totals.leads)}
        {metricCard("Opt-outs", totals.opt_outs)}
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
            Carregando telemetria de uso...
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#080D18]/80 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-5 py-3.5">Empresa</th>
                <th className="px-4 py-3.5 text-right">Enviadas</th>
                <th className="px-4 py-3.5 text-right">Recebidas</th>
                <th className="px-4 py-3.5 text-right">Conversas</th>
                <th className="px-4 py-3.5 text-right">IA (gerações)</th>
                <th className="px-4 py-3.5 text-right">Tokens</th>
                <th className="px-4 py-3.5 text-right">Contatos</th>
                <th className="px-4 py-3.5 text-right">Opt-outs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((r) => (
                <tr
                  key={r.business_id}
                  className="transition-colors hover:bg-white/[0.03]"
                >
                  <td className="px-5 py-3 text-slate-200 font-medium">
                    {r.business_name}
                    <span className="ml-2 font-mono text-[11px] text-[#00E5FF]">
                      {r.business_slug}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-200">
                    {r.messages_sent.toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-400">
                    {r.messages_received.toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-400">
                    {r.conversations.toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[#00E5FF]">
                    {r.ai_generations.toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[#7C3CFF]">
                    {(r.ai_input_tokens + r.ai_output_tokens).toLocaleString(
                      "pt-BR",
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[#00E5A0]">
                    {r.leads_created.toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-rose-400">
                    {r.opt_outs.toLocaleString("pt-BR")}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-8 text-center text-sm text-slate-500"
                  >
                    Nenhum consumo registrado no período selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
