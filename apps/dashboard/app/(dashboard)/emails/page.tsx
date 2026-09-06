'use client';

import { useState } from 'react';
import { Mail, Inbox, RefreshCw } from 'lucide-react';
import { DashboardShell } from '@/components/layout/shell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApi } from '@/hooks/use-api';

interface EmailLog {
  id: string;
  to: string;
  subject: string;
  status: 'SENT' | 'FAILED' | 'BOUNCED';
  provider: string;
  provider_message_id: string | null;
  related_campaign_id: string | null;
  error: string | null;
  sent_at: string;
}

interface EmailsResponse {
  total: number;
  page: number;
  pageSize: number;
  emails: EmailLog[];
}

const STATUS_FILTERS = [
  { key: '', label: 'Todos os status' },
  { key: 'SENT', label: 'Enviados com sucesso' },
  { key: 'FAILED', label: 'Falhas de entrega' },
  { key: 'BOUNCED', label: 'Devolvidos (Bounce)' },
];

const STATUS_BADGE: Record<EmailLog['status'], { tone: 'emerald' | 'red' | 'amber'; label: string }> = {
  SENT: { tone: 'emerald', label: 'Enviado' },
  FAILED: { tone: 'red', label: 'Falhou' },
  BOUNCED: { tone: 'amber', label: 'Devolvido' },
};

function today() {
  return new Date().toISOString().slice(0, 10);
}
function weekAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 13);
  return d.toISOString().slice(0, 10);
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' · ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function EmailsPage() {
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState(weekAgo());
  const [to, setTo] = useState(today());

  const query = `emails?pageSize=100&status=${status}&from=${from}&to=${to}`;
  const emails = useApi<EmailsResponse>(['emails', status, from, to], query, { refetchInterval: 20000 });

  const list = emails.data?.emails ?? [];

  return (
    <DashboardShell title="E-mails Enviados">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#008CFF]/10 border border-[#008CFF]/30 text-[#00E5FF] shadow-[0_0_12px_rgba(0,140,255,0.2)]">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Disparos de E-mail</h1>
              <p className="text-xs text-slate-400">Auditoria, logs de entrega e rastreamento de campanhas em tempo real</p>
            </div>
          </div>
          <button onClick={() => emails.refetch()} className="btn-outline flex items-center gap-2 text-xs">
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar logs
          </button>
        </div>

        {/* Filtros */}
        <div className="rounded-2xl border border-white/10 bg-[#080D18]/80 p-5 backdrop-blur-xl flex flex-wrap items-end gap-4 shadow-lg">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-white/10 bg-[#020409]/70 px-3 py-2 text-xs font-semibold text-white focus:border-[#008CFF] focus:outline-none">
              {STATUS_FILTERS.map((f) => (
                <option key={f.key} value={f.key} className="bg-[#080D18]">
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">De</label>
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="rounded-xl border border-white/10 bg-[#020409]/70 px-3 py-2 text-xs font-semibold text-white focus:border-[#008CFF] focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Até</label>
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="rounded-xl border border-white/10 bg-[#020409]/70 px-3 py-2 text-xs font-semibold text-white focus:border-[#008CFF] focus:outline-none" />
          </div>
          <button onClick={() => emails.refetch()} className="btn-primary text-xs px-4 py-2.5 shadow-[0_0_12px_rgba(0,140,255,0.3)]">
            Filtrar
          </button>
        </div>

        {emails.isLoading ? (
          <div className="flex justify-center py-20 text-slate-500">
            <div className="flex items-center gap-2">
              <span className="inline-block h-4 w-4 rounded-full border-2 border-[#008CFF] border-t-transparent animate-spin" />
              <span className="text-xs uppercase tracking-wider font-semibold">Buscando histórico de e-mails...</span>
            </div>
          </div>
        ) : list.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Total registrado: <span className="text-[#00E5FF] font-bold">{emails.data?.total ?? list.length}</span> e-mail{list.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#080D18]/80 backdrop-blur-xl shadow-xl">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/[0.02] text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-white/10">
                  <tr>
                    <th className="px-5 py-4">Destinatário</th>
                    <th className="hidden px-5 py-4 sm:table-cell">Assunto</th>
                    <th className="px-5 py-4">Data/hora</th>
                    <th className="px-5 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {list.map((e) => (
                    <tr key={e.id} className="transition-colors hover:bg-white/[0.03]">
                      <td className="max-w-[220px] truncate px-5 py-3.5 font-semibold text-white">{e.to}</td>
                      <td className="hidden max-w-[320px] truncate px-5 py-3.5 text-slate-300 sm:table-cell" title={e.error ?? ''}>
                        {e.subject}
                        {e.error ? <span className="ml-1.5 text-xs font-medium text-[#FF3366]">({e.error})</span> : null}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-xs text-slate-400">{formatDateTime(e.sent_at)}</td>
                      <td className="px-5 py-3.5">
                        <Badge tone={STATUS_BADGE[e.status]?.tone ?? 'zinc'}>{STATUS_BADGE[e.status]?.label ?? e.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-[#080D18]/80 py-20 text-center backdrop-blur-xl">
            <Inbox className="mx-auto mb-3 h-12 w-12 text-slate-600" />
            <div className="text-base font-semibold text-white">Nenhum e-mail enviado no período</div>
            <p className="text-xs text-slate-400 mt-1">Ajuste os filtros de data ou crie uma nova campanha de disparo.</p>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

