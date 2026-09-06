'use client';

import { useState } from 'react';
import { BarChart3, TrendingUp, Calendar, RefreshCw } from 'lucide-react';
import { DashboardShell } from '@/components/layout/shell';
import { Spinner } from '@/components/ui/button';
import { useApi } from '@/hooks/use-api';
import { BrasiliaClock } from '@/components/brasilia-clock';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

interface Report {
  period: { from: string; to: string };
  response_rate: number;
  interest_rate: number;
  conversion_rate: number;
  opt_out_rate: number;
  total_sent: number;
  total_responded: number;
  total_interested: number;
  total_opt_out: number;
  series: { date: string; sent: number; responded: number; interested: number }[];
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
function weekAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 13);
  return d.toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const [from, setFrom] = useState(weekAgo());
  const [to, setTo] = useState(today());

  const report = useApi<Report>(
    ['report', from, to],
    `reports?from=${from}&to=${to}`
  );

  const r = report.data;

  return (
    <DashboardShell title="Relatórios Analíticos">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#008CFF]/10 border border-[#008CFF]/30 text-[#00E5FF] shadow-[0_0_12px_rgba(0,140,255,0.2)]">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Relatórios & Performance</h1>
              <p className="text-xs text-slate-400">Inteligência de conversão, engajamento e métricas de campanhas ativas</p>
            </div>
          </div>
          <BrasiliaClock />
        </div>

        {/* Período */}
        <div className="rounded-2xl border border-white/10 bg-[#080D18]/80 p-5 backdrop-blur-xl shadow-lg">
          <div className="mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#00E5FF]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Filtrar por Período</h2>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">De</label>
              <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="rounded-xl border border-white/10 bg-[#020409]/70 px-3 py-2 text-xs font-semibold text-white focus:border-[#008CFF] focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Até</label>
              <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="rounded-xl border border-white/10 bg-[#020409]/70 px-3 py-2 text-xs font-semibold text-white focus:border-[#008CFF] focus:outline-none" />
            </div>
            <button onClick={() => report.refetch()} className="btn-primary flex items-center gap-2 text-xs px-4 py-2.5 shadow-[0_0_12px_rgba(0,140,255,0.3)]">
              <RefreshCw className="h-3.5 w-3.5" /> Atualizar métricas
            </button>
          </div>
        </div>

        {report.isLoading ? (
          <div className="flex justify-center py-20 text-slate-500">
            <div className="flex items-center gap-2">
              <span className="inline-block h-4 w-4 rounded-full border-2 border-[#008CFF] border-t-transparent animate-spin" />
              <span className="text-xs uppercase tracking-wider font-semibold">Calculando análises...</span>
            </div>
          </div>
        ) : r ? (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <RateCard label="Taxa de resposta" value={r.response_rate} tone="blue" />
              <RateCard label="Taxa de interesse" value={r.interest_rate} tone="cyan" />
              <RateCard label="Taxa de conversão" value={r.conversion_rate} tone="emerald" />
              <RateCard label="Taxa de opt-out" value={r.opt_out_rate} tone="red" />
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <CountCard label="Mensagens Enviadas" value={r.total_sent} tone="white" />
              <CountCard label="Respostas Recebidas" value={r.total_responded} tone="blue" />
              <CountCard label="Leads Interessados" value={r.total_interested} tone="emerald" />
              <CountCard label="Descadastros (Opt-outs)" value={r.total_opt_out} tone="red" />
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#080D18]/80 p-5 backdrop-blur-xl shadow-xl">
              <div className="mb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#00E5A0] shadow-[0_0_8px_#00E5A0]" />
                  Envios por Dia vs Respostas
                </h3>
                <p className="text-xs text-slate-400">Volume diário de disparos e retorno no período analisado</p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={r.series}>
                    <CartesianGrid stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: '#A8B3C7', fontSize: 11 }} stroke="rgba(255, 255, 255, 0.1)" />
                    <YAxis tick={{ fill: '#A8B3C7', fontSize: 11 }} stroke="rgba(255, 255, 255, 0.1)" />
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(8, 13, 24, 0.95)',
                        border: '1px solid rgba(0, 229, 255, 0.3)',
                        borderRadius: 12,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                        backdropFilter: 'blur(12px)',
                      }}
                      labelStyle={{ color: '#FFFFFF', fontWeight: 700 }}
                      itemStyle={{ color: '#00E5FF' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: '#A8B3C7' }} />
                    <Bar dataKey="sent" name="Enviadas" fill="#00E5A0" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="responded" name="Respostas" fill="#008CFF" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#080D18]/80 p-5 backdrop-blur-xl shadow-xl">
              <div className="mb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]" />
                  Interessados Acumulados
                </h3>
                <p className="text-xs text-slate-400">Evolução do engajamento qualificado gerado pelas automações</p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={r.series}>
                    <CartesianGrid stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: '#A8B3C7', fontSize: 11 }} stroke="rgba(255, 255, 255, 0.1)" />
                    <YAxis tick={{ fill: '#A8B3C7', fontSize: 11 }} stroke="rgba(255, 255, 255, 0.1)" />
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(8, 13, 24, 0.95)',
                        border: '1px solid rgba(0, 229, 255, 0.3)',
                        borderRadius: 12,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                        backdropFilter: 'blur(12px)',
                      }}
                      labelStyle={{ color: '#FFFFFF', fontWeight: 700 }}
                      itemStyle={{ color: '#00E5FF' }}
                    />
                    <Line type="monotone" dataKey="interested" name="Interessados" stroke="#00E5FF" strokeWidth={3} dot={{ r: 3, fill: '#00E5FF' }} activeDot={{ r: 5, fill: '#00E5FF', stroke: '#FFFFFF', strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#080D18]/80 p-4 text-xs text-slate-400 backdrop-blur-md">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00E5A0]/10 border border-[#00E5A0]/20 text-[#00E5A0] shrink-0">
                <TrendingUp className="h-4 w-4" />
              </div>
              <span>
                Nota: As taxas de conversão e resposta são calculadas exclusivamente sobre eventos reais confirmados pelo Baileys e pelos webhooks de e-mail.
              </span>
            </div>
          </>
        ) : null}
      </div>
    </DashboardShell>
  );
}

function RateCard({ label, value, tone }: { label: string; value: number; tone?: 'blue' | 'cyan' | 'emerald' | 'red' }) {
  const color = tone === 'emerald' ? 'text-[#00E5A0]' : tone === 'red' ? 'text-[#FF3366]' : tone === 'cyan' ? 'text-[#00E5FF]' : 'text-[#008CFF]';
  const border = tone === 'emerald' ? 'border-[#00E5A0]/20' : tone === 'red' ? 'border-[#FF3366]/20' : tone === 'cyan' ? 'border-[#00E5FF]/20' : 'border-[#008CFF]/20';
  return (
    <div className={`rounded-2xl border ${border} bg-[#080D18]/80 p-5 shadow-lg backdrop-blur-md transition-all hover:border-white/20`}>
      <div className={`text-3xl font-black tracking-tight ${color}`}>{value}%</div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</div>
    </div>
  );
}

function CountCard({ label, value, tone }: { label: string; value: number; tone?: 'blue' | 'emerald' | 'white' | 'red' }) {
  const color = tone === 'emerald' ? 'text-[#00E5A0]' : tone === 'blue' ? 'text-[#008CFF]' : tone === 'red' ? 'text-[#FF3366]' : 'text-white';
  return (
    <div className="rounded-2xl border border-white/10 bg-[#080D18]/80 p-5 shadow-lg backdrop-blur-md transition-all hover:border-white/20">
      <div className={`text-3xl font-black tracking-tight ${color}`}>{value}</div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</div>
    </div>
  );
}

