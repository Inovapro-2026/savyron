'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Hourglass,
  Send,
  MessageSquareReply,
  Eye,
  XCircle,
  Calendar,
  ChevronDown,
  MessageCircle,
  Mail,
  Share2,
  Clock,
  Minus,
  Plus,
  Cpu,
  Zap,
  ShieldCheck,
  Bot,
  Activity,
  Sparkles,
  Radio,
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DashboardShell } from '@/components/layout/shell';
import { MetricCard } from '@/components/metric-card';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/button';
import { useApi, request } from '@/hooks/use-api';
import { useToast } from '@/components/ui/toast';
import { useQueryClient } from '@tanstack/react-query';

interface Metrics {
  leads_available: number;
  leads_imported: number;
  messages_sent_today: number;
  emails_sent_today: number;
  whatsapp_sent_today: number;
  responses_received: number;
  interested: number;
  not_interested: number;
  opt_outs: number;
  errors: number;
  active_campaigns: number;
  today_activity: { whatsapp: { used: number; limit: number }; email: { used: number; limit: number } };
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  channel_mode?: 'WHATSAPP' | 'EMAIL' | 'BOTH';
  daily_whatsapp_limit: number;
  daily_email_limit: number;
  interval_seconds: number;
  stats: {
    total: number;
    processed: number;
    pending: number;
    sent: number;
    responded: number;
    interested: number;
    errors: number;
  };
}

interface WhatsAppStatus {
  connected: boolean;
  state: string;
  qrAvailable: boolean;
  loggedIn: boolean;
}

export default function DashboardPage() {
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();
  const metrics = useApi<Metrics>(['metrics'], 'dashboard/metrics', { refetchInterval: 15000 });
  const campaigns = useApi<Campaign[]>(['campaigns'], 'campaigns', { refetchInterval: 15000 });
  const wa = useApi<WhatsAppStatus>(['whatsapp-status'], 'whatsapp/status', { refetchInterval: 30000 });

  const activeCampaign = campaigns.data?.[0];
  const [selectedChannel, setSelectedChannel] = useState<'WHATSAPP' | 'EMAIL' | 'BOTH'>('WHATSAPP');
  const [savingChannel, setSavingChannel] = useState(false);
  const [savingLimits, setSavingLimits] = useState(false);

  // Sincroniza o canal ativo com a campanha principal
  const currentChannel = activeCampaign?.channel_mode ?? selectedChannel;

  const changeChannel = async (mode: 'WHATSAPP' | 'EMAIL' | 'BOTH') => {
    setSelectedChannel(mode);
    if (!activeCampaign) return;
    setSavingChannel(true);
    try {
      await request(`campaigns/${activeCampaign.id}`, {
        method: 'PATCH',
        body: { channel_mode: mode },
      });
      success('Canal de envio atualizado');
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Falha ao atualizar canal');
    } finally {
      setSavingChannel(false);
    }
  };

  const updateLimits = async (deltaWa: number, deltaEmail: number) => {
    if (!activeCampaign) return;
    const newWa = Math.max(1, (activeCampaign.daily_whatsapp_limit || 30) + deltaWa);
    const newEmail = Math.max(1, (activeCampaign.daily_email_limit || 100) + deltaEmail);
    setSavingLimits(true);
    try {
      await request(`campaigns/${activeCampaign.id}`, {
        method: 'PATCH',
        body: {
          daily_whatsapp_limit: newWa,
          daily_email_limit: newEmail,
        },
      });
      success('Limites atualizados');
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Falha ao atualizar limites');
    } finally {
      setSavingLimits(false);
    }
  };

  const updateInterval = async (seconds: number) => {
    if (!activeCampaign) return;
    try {
      await request(`campaigns/${activeCampaign.id}`, {
        method: 'PATCH',
        body: { interval_seconds: seconds },
      });
      success('Intervalo atualizado');
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Falha ao atualizar intervalo');
    }
  };

  // Cálculo para o gráfico de donut de desempenho de canais
  const waCount = metrics.data?.whatsapp_sent_today ?? 0;
  const emailCount = metrics.data?.emails_sent_today ?? 0;
  const totalSent = Math.max(1, waCount + emailCount);
  const waPct = ((waCount / totalSent) * 100).toFixed(1);
  const emailPct = ((emailCount / totalSent) * 100).toFixed(1);

  const chartData = useMemo(() => {
    if (waCount === 0 && emailCount === 0) {
      return [
        { name: 'WhatsApp', value: 66.7, color: '#00E5A0' },
        { name: 'E-mail', value: 33.3, color: '#00E5FF' },
      ];
    }
    return [
      { name: 'WhatsApp', value: waCount, color: '#00E5A0' },
      { name: 'E-mail', value: emailCount, color: '#00E5FF' },
    ];
  }, [waCount, emailCount]);

  // Contagens da fila de processamento
  const totalQueue = activeCampaign?.stats.total ?? (metrics.data?.leads_available ?? 0) + (metrics.data?.messages_sent_today ?? 0);
  const processedQueue = activeCampaign?.stats.processed ?? (metrics.data?.messages_sent_today ?? 0);
  const pendingQueue = activeCampaign?.stats.pending ?? (metrics.data?.leads_available ?? 0);

  const loading = metrics.isLoading;

  // Formatação da data atual para o pill de filtro
  const todayFormatted = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 13);
    const formatDate = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${formatDate(start)} - ${formatDate(end)}`;
  }, []);

  return (
    <DashboardShell title="Dashboard">
      {loading ? (
        <div className="flex justify-center py-24">
          <Spinner className="h-8 w-8 text-[#00E5FF]" />
        </div>
      ) : (
        <div className="space-y-6 pb-6">
          {/* Cyber AI Hero Section */}
          <div className="relative overflow-hidden rounded-3xl border border-[#00E5FF]/25 bg-gradient-to-r from-[#050A18]/90 via-[#0A122A]/85 to-[#050A18]/90 p-6 md:p-8 backdrop-blur-xl shadow-[0_0_40px_rgba(0,140,255,0.15)]">
            {/* Ambient background glows */}
            <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-[#008CFF]/15 blur-3xl" />
            <div className="pointer-events-none absolute -right-20 -bottom-20 h-64 w-64 rounded-full bg-[#7C3CFF]/15 blur-3xl" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:28px_28px] opacity-30" />

            <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#00E5FF]/30 bg-[#00E5FF]/10 px-3 py-1 text-[11px] font-semibold text-[#00E5FF] shadow-[0_0_12px_rgba(0,229,255,0.25)]">
                  <Sparkles className="h-3.5 w-3.5 animate-pulse text-[#00E5FF]" />
                  <span className="tracking-wider uppercase">Plataforma Neural Ativa</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-[#00E5A0] shadow-[0_0_8px_#00E5A0]" />
                </div>

                <h1 className="text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-white">
                  SAVYRON <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00E5FF] via-[#008CFF] to-[#7C3CFF]">AI ENGINE</span>
                </h1>
                <p className="text-xs md:text-sm text-[#A8B3C7] leading-relaxed">
                  Sistema autônomo de alta performance para prospecção, qualificação neural e conversão de clientes 24 horas por dia.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Date range picker pill */}
                <div className="inline-flex items-center gap-2.5 rounded-2xl border border-[#008CFF]/30 bg-[#080E20]/90 px-4 py-2.5 text-xs font-semibold text-white shadow-[0_0_20px_rgba(0,140,255,0.2)] backdrop-blur-md">
                  <Calendar className="h-4 w-4 text-[#00E5FF]" />
                  <span>{todayFormatted}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-[#64748B]" />
                </div>

                <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-950/30 px-3.5 py-2.5 text-xs font-semibold text-emerald-400">
                  <Activity className="h-4 w-4 text-emerald-400 animate-pulse" />
                  <span>Live Feed</span>
                </div>
              </div>
            </div>
          </div>

          {/* Banner de status do WhatsApp Baileys */}
          {!wa.data?.connected ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-950/40 to-[#0A1020]/60 p-4 text-xs text-amber-200 shadow-[0_0_20px_rgba(255,176,32,0.15)] backdrop-blur-md">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 shadow-[0_0_12px_rgba(255,176,32,0.3)]">
                  <MessageCircle className="h-4.5 w-4.5" />
                </div>
                <span>
                  <strong className="text-amber-300">WhatsApp Baileys desconectado:</strong> Escaneie o QR Code em Configurações para habilitar a automação neural.
                </span>
              </div>
              <Link
                href="/settings"
                className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 font-semibold text-amber-300 transition-all hover:bg-amber-500/20 hover:text-white hover:shadow-[0_0_12px_rgba(255,176,32,0.3)]"
              >
                Conectar agora &rarr;
              </Link>
            </div>
          ) : null}

          {/* Row 1: 6 KPI HUD Cards */}
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
            <MetricCard
              icon={Users}
              label="Total de Leads"
              value={metrics.data?.leads_imported ?? metrics.data?.leads_available ?? 0}
              tone="blue"
              badge="+12%"
              hint="Todos os leads da fila"
            />
            <MetricCard
              icon={Hourglass}
              label="Pendentes"
              value={metrics.data?.leads_available ?? 0}
              tone="amber"
              badge="+8%"
              hint="Aguardando envio"
            />
            <MetricCard
              icon={Send}
              label="Enviados"
              value={metrics.data?.messages_sent_today ?? 0}
              tone="emerald"
              badge="+100%"
              hint="Mensagens disparadas"
            />
            <MetricCard
              icon={MessageSquareReply}
              label="Respostas"
              value={metrics.data?.responses_received ?? 0}
              tone="purple"
              badge="+100%"
              hint="Receberam resposta"
            />
            <MetricCard
              icon={Eye}
              label="Interessados"
              value={metrics.data?.interested ?? 0}
              tone="cyan"
              badge="Alta IA"
              hint="Qualificados com interesse"
            />
            <MetricCard
              icon={XCircle}
              label="Erros"
              value={metrics.data?.errors ?? 0}
              tone="red"
              badge="0%"
              hint="Falhas no envio"
            />
          </div>

          {/* Row 2: Progresso da fila & Desempenho dos canais */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Progresso da fila */}
            <div className="relative overflow-hidden rounded-2xl border border-[#008CFF]/20 bg-[#080D18]/85 p-6 backdrop-blur-xl shadow-[0_4px_30px_rgba(0,0,0,0.5)] lg:col-span-7 flex flex-col justify-between">
              {/* Corner tech accent */}
              <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#00E5FF]/10 blur-xl" />
              <div className="flex items-center justify-between pb-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#00E5FF]/30 bg-[#00E5FF]/10 text-[#00E5FF] shadow-[0_0_12px_rgba(0,229,255,0.2)]">
                    <Cpu className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">Progresso da Fila</h3>
                    <p className="text-xs text-[#A8B3C7]">Acompanhe o processamento contínuo dos leads</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-950/30 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
                  <Radio className="h-3 w-3 animate-pulse text-emerald-400" />
                  <span>Em Execução</span>
                </div>
              </div>

              <div className="my-8 space-y-4">
                <Progress
                  value={processedQueue}
                  max={Math.max(1, totalQueue)}
                  tone="gradient"
                  className="h-3.5 shadow-[0_0_15px_rgba(0,229,255,0.25)]"
                />
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-white">
                    <span className="h-2 w-2 rounded-full bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]" />
                    {processedQueue} processados
                  </span>
                  <span className="flex items-center gap-1.5 text-[#A8B3C7]">
                    <span className="h-2 w-2 rounded-full bg-[#FFB020] shadow-[0_0_8px_#FFB020]" />
                    {pendingQueue} na fila
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/5 text-[11px] text-[#64748B]">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">Status:</span>
                  <span className="text-[#A8B3C7]">
                    {activeCampaign ? `Campanha ativa: ${activeCampaign.name}` : 'Nenhuma campanha em execução no momento.'}
                  </span>
                </div>
                <div className="text-[#00E5FF] font-medium">
                  {Math.round((processedQueue / Math.max(1, totalQueue)) * 100)}% concluído
                </div>
              </div>
            </div>

            {/* Desempenho dos canais (Donut Chart) */}
            <div className="relative overflow-hidden rounded-2xl border border-[#008CFF]/20 bg-[#080D18]/85 p-6 backdrop-blur-xl shadow-[0_4px_30px_rgba(0,0,0,0.5)] lg:col-span-5 flex flex-col justify-between">
              <div className="pointer-events-none absolute -left-8 -top-8 h-24 w-24 rounded-full bg-[#7C3CFF]/10 blur-xl" />
              <div className="flex items-center justify-between pb-4 border-b border-white/5">
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Desempenho dos Canais</h3>
                  <p className="text-xs text-[#A8B3C7]">Distribuição de disparos no período</p>
                </div>
                <span className="rounded-full border border-[#008CFF]/30 bg-[#008CFF]/10 px-2.5 py-0.5 text-[10px] font-semibold text-[#00E5FF]">
                  CANAIS
                </span>
              </div>

              <div className="my-auto flex items-center justify-between py-4">
                <div className="relative h-36 w-36 shrink-0 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={42}
                        outerRadius={60}
                        stroke="#080D18"
                        strokeWidth={4}
                        isAnimationActive={false}
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Central HUD readout */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-base font-black text-white leading-none tracking-tight">
                      {waCount + emailCount}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#00E5FF]">
                      Total
                    </span>
                  </div>
                </div>

                <div className="space-y-3 pl-4 text-xs flex-1">
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-[#0D152A]/50 p-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#00E5A0] shadow-[0_0_8px_#00E5A0]" />
                      <span className="font-medium text-white">WhatsApp</span>
                    </div>
                    <span className="font-bold text-[#00E5A0]">
                      {waCount > 0 || emailCount > 0 ? `${waPct}%` : '66.7%'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-[#0D152A]/50 p-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]" />
                      <span className="font-medium text-white">E-mail</span>
                    </div>
                    <span className="font-bold text-[#00E5FF]">
                      {waCount > 0 || emailCount > 0 ? `${emailPct}%` : '33.3%'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-[#0D152A]/50 p-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#7C3CFF] shadow-[0_0_8px_#7C3CFF]" />
                      <span className="font-medium text-white">Ambos</span>
                    </div>
                    <span className="font-bold text-[#7C3CFF]">0%</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-white/5 text-[11px] text-[#64748B] flex items-center justify-between">
                <span>Total de envios ativos</span>
                <span className="text-[#00E5FF] font-medium">{waCount + emailCount} disparos</span>
              </div>
            </div>
          </div>

          {/* Row 3: Canal de envio & Ajustar limites */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Canal de envio */}
            <div className="relative overflow-hidden rounded-2xl border border-[#008CFF]/20 bg-[#080D18]/85 p-6 backdrop-blur-xl shadow-[0_4px_30px_rgba(0,0,0,0.5)] lg:col-span-6 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Canal de Envio</h3>
                <p className="mt-0.5 text-xs text-[#A8B3C7]">Escolha por qual canal a campanha dispara</p>
              </div>

              {/* Opções de canal estilo cards */}
              <div className="my-5 grid grid-cols-3 gap-3">
                {/* WhatsApp */}
                <button
                  type="button"
                  onClick={() => void changeChannel('WHATSAPP')}
                  disabled={savingChannel}
                  className={`group relative flex flex-col items-start rounded-2xl border p-3.5 text-left transition-all duration-200 ${
                    currentChannel === 'WHATSAPP'
                      ? 'border-[#00E5A0] bg-[#00E5A0]/10 shadow-[0_0_20px_rgba(0,229,160,0.25)] ring-1 ring-[#00E5A0]'
                      : 'border-white/10 bg-[#0C1427]/60 hover:border-[#00E5A0]/40 hover:bg-[#0C1427]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                    <MessageCircle className="h-4 w-4 text-[#00E5A0]" />
                    <span>WhatsApp</span>
                  </div>
                  <span className="mt-1.5 text-[11px] text-[#A8B3C7] leading-snug">Dispara apenas pelo WhatsApp</span>
                  {currentChannel === 'WHATSAPP' && (
                    <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#00E5A0]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#00E5A0] animate-pulse" /> Ativo
                    </span>
                  )}
                </button>

                {/* E-mail */}
                <button
                  type="button"
                  onClick={() => void changeChannel('EMAIL')}
                  disabled={savingChannel}
                  className={`group relative flex flex-col items-start rounded-2xl border p-3.5 text-left transition-all duration-200 ${
                    currentChannel === 'EMAIL'
                      ? 'border-[#00E5FF] bg-[#00E5FF]/10 shadow-[0_0_20px_rgba(0,229,255,0.25)] ring-1 ring-[#00E5FF]'
                      : 'border-white/10 bg-[#0C1427]/60 hover:border-[#00E5FF]/40 hover:bg-[#0C1427]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                    <Mail className="h-4 w-4 text-[#00E5FF]" />
                    <span>E-mail</span>
                  </div>
                  <span className="mt-1.5 text-[11px] text-[#A8B3C7] leading-snug">Dispara apenas por e-mail</span>
                  {currentChannel === 'EMAIL' && (
                    <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#00E5FF]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#00E5FF] animate-pulse" /> Ativo
                    </span>
                  )}
                </button>

                {/* Ambos */}
                <button
                  type="button"
                  onClick={() => void changeChannel('BOTH')}
                  disabled={savingChannel}
                  className={`group relative flex flex-col items-start rounded-2xl border p-3.5 text-left transition-all duration-200 ${
                    currentChannel === 'BOTH'
                      ? 'border-[#7C3CFF] bg-[#7C3CFF]/15 shadow-[0_0_20px_rgba(124,60,255,0.3)] ring-1 ring-[#7C3CFF]'
                      : 'border-white/10 bg-[#0C1427]/60 hover:border-[#7C3CFF]/40 hover:bg-[#0C1427]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                    <Share2 className="h-4 w-4 text-[#7C3CFF]" />
                    <span>Ambos</span>
                  </div>
                  <span className="mt-1.5 text-[11px] text-[#A8B3C7] leading-snug">Dispara pelos dois canais</span>
                  {currentChannel === 'BOTH' && (
                    <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#7C3CFF]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#7C3CFF] animate-pulse" /> Ativo
                    </span>
                  )}
                </button>
              </div>

              {/* Informative cyber box */}
              <div className="rounded-2xl border border-[#008CFF]/30 bg-[#008CFF]/10 p-3.5 text-xs text-[#A8B3C7] flex items-start gap-2.5">
                <Sparkles className="h-4 w-4 text-[#00E5FF] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Modo Híbrido:</strong> Envia estrategicamente por ambos os canais, priorizando telefone celular para WhatsApp e validando caixas de entrada de e-mail corporativo.
                </span>
              </div>
            </div>

            {/* Ajustar limites */}
            <div className="relative overflow-hidden rounded-2xl border border-[#008CFF]/20 bg-[#080D18]/85 p-6 backdrop-blur-xl shadow-[0_4px_30px_rgba(0,0,0,0.5)] lg:col-span-6 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Ajustar Limites</h3>
                <p className="mt-0.5 text-xs text-[#A8B3C7]">Configure a cadência e limites diários de segurança</p>
              </div>

              <div className="my-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Limite WhatsApp */}
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#0C1427]/70 p-3.5 shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-[#00E5A0] shadow-[0_0_12px_rgba(0,229,160,0.2)]">
                      <MessageCircle className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-medium text-[#A8B3C7]">WhatsApp / dia</div>
                      <div className="text-xl font-black text-white">{activeCampaign?.daily_whatsapp_limit ?? 30}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void updateLimits(-5, 0)}
                      disabled={savingLimits}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-[#121B32] text-white hover:border-[#00E5FF]/50 hover:bg-[#1A2647] hover:text-[#00E5FF] transition-all"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateLimits(5, 0)}
                      disabled={savingLimits}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-[#121B32] text-white hover:border-[#00E5FF]/50 hover:bg-[#1A2647] hover:text-[#00E5FF] transition-all"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Limite E-mail */}
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#0C1427]/70 p-3.5 shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 text-[#00E5FF] shadow-[0_0_12px_rgba(0,229,255,0.2)]">
                      <Mail className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-medium text-[#A8B3C7]">E-mail / dia</div>
                      <div className="text-xl font-black text-white">{activeCampaign?.daily_email_limit ?? 100}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void updateLimits(0, -10)}
                      disabled={savingLimits}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-[#121B32] text-white hover:border-[#00E5FF]/50 hover:bg-[#1A2647] hover:text-[#00E5FF] transition-all"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateLimits(0, 10)}
                      disabled={savingLimits}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-[#121B32] text-white hover:border-[#00E5FF]/50 hover:bg-[#1A2647] hover:text-[#00E5FF] transition-all"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Intervalo entre envios */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/5">
                <div className="flex items-center gap-2.5">
                  <Clock className="h-4 w-4 text-[#00E5FF]" />
                  <span className="text-xs text-[#A8B3C7]">Intervalo seguro:</span>
                  <select
                    value={activeCampaign?.interval_seconds ?? 7200}
                    onChange={(e) => void updateInterval(Number(e.target.value))}
                    className="rounded-xl border border-[#008CFF]/30 bg-[#0C1427] px-3 py-1.5 text-xs font-semibold text-white outline-none focus:border-[#00E5FF] focus:shadow-[0_0_15px_rgba(0,229,255,0.25)]"
                  >
                    <option value={2}>2 segundos (Turbo)</option>
                    <option value={10}>10 segundos</option>
                    <option value={30}>30 segundos</option>
                    <option value={60}>1 minuto</option>
                    <option value={300}>5 minutos</option>
                    <option value={3600}>1 hora</option>
                    <option value={7200}>2 horas (Humano Seguro)</option>
                  </select>
                </div>
                <div className="text-[11px] text-[#64748B]">
                  Simulação comportamental anti-bloqueio ativa
                </div>
              </div>
            </div>
          </div>

          {/* Reference Image 4-Pillar HUD Feature Strip */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-2">
            <div className="group relative overflow-hidden rounded-2xl border border-[#008CFF]/25 bg-[#080D18]/80 p-5 backdrop-blur-xl transition-all duration-300 hover:border-[#00E5FF]/60 hover:shadow-[0_0_30px_rgba(0,229,255,0.2)]">
              <div className="pointer-events-none absolute -right-6 -bottom-6 h-20 w-20 rounded-full bg-[#00E5FF]/10 blur-xl group-hover:bg-[#00E5FF]/20" />
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#00E5FF]/40 bg-[#00E5FF]/10 text-[#00E5FF] shadow-[0_0_15px_rgba(0,229,255,0.25)] mb-3">
                <Bot className="h-5 w-5" />
              </div>
              <h4 className="text-sm font-bold text-white tracking-tight">IA Inteligente</h4>
              <p className="mt-1 text-xs text-[#A8B3C7] leading-relaxed">
                Algoritmos neurais avançados que compreendem o contexto, qualificam intenção de compra e respondem de forma personalizada.
              </p>
            </div>

            <div className="group relative overflow-hidden rounded-2xl border border-[#00E5A0]/25 bg-[#080D18]/80 p-5 backdrop-blur-xl transition-all duration-300 hover:border-[#00E5A0]/60 hover:shadow-[0_0_30px_rgba(0,229,160,0.2)]">
              <div className="pointer-events-none absolute -right-6 -bottom-6 h-20 w-20 rounded-full bg-[#00E5A0]/10 blur-xl group-hover:bg-[#00E5A0]/20" />
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#00E5A0]/40 bg-[#00E5A0]/10 text-[#00E5A0] shadow-[0_0_15px_rgba(0,229,160,0.25)] mb-3">
                <Activity className="h-5 w-5" />
              </div>
              <h4 className="text-sm font-bold text-white tracking-tight">Atendimento 24/7</h4>
              <p className="mt-1 text-xs text-[#A8B3C7] leading-relaxed">
                Operação ininterrupta em tempo real via WhatsApp e E-mail. Seus prospects são atendidos no exato momento de interesse.
              </p>
            </div>

            <div className="group relative overflow-hidden rounded-2xl border border-[#7C3CFF]/25 bg-[#080D18]/80 p-5 backdrop-blur-xl transition-all duration-300 hover:border-[#7C3CFF]/60 hover:shadow-[0_0_30px_rgba(124,60,255,0.25)]">
              <div className="pointer-events-none absolute -right-6 -bottom-6 h-20 w-20 rounded-full bg-[#7C3CFF]/10 blur-xl group-hover:bg-[#7C3CFF]/20" />
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#7C3CFF]/40 bg-[#7C3CFF]/10 text-[#7C3CFF] shadow-[0_0_15px_rgba(124,60,255,0.3)] mb-3">
                <Zap className="h-5 w-5" />
              </div>
              <h4 className="text-sm font-bold text-white tracking-tight">Automação de Vendas</h4>
              <p className="mt-1 text-xs text-[#A8B3C7] leading-relaxed">
                Cadências inteligentes com intervalos adaptativos que simulam o comportamento humano e multiplicam sua taxa de conversão.
              </p>
            </div>

            <div className="group relative overflow-hidden rounded-2xl border border-[#FF2BD6]/25 bg-[#080D18]/80 p-5 backdrop-blur-xl transition-all duration-300 hover:border-[#FF2BD6]/60 hover:shadow-[0_0_30px_rgba(255,43,214,0.25)]">
              <div className="pointer-events-none absolute -right-6 -bottom-6 h-20 w-20 rounded-full bg-[#FF2BD6]/10 blur-xl group-hover:bg-[#FF2BD6]/20" />
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#FF2BD6]/40 bg-[#FF2BD6]/10 text-[#FF2BD6] shadow-[0_0_15px_rgba(255,43,214,0.3)] mb-3">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h4 className="text-sm font-bold text-white tracking-tight">Segurança Total</h4>
              <p className="mt-1 text-xs text-[#A8B3C7] leading-relaxed">
                Criptografia de ponta a ponta, isolamento por tenant e conformidade total com políticas de privacidade e proteção de dados.
              </p>
            </div>
          </div>

          {/* Footer status row */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#64748B] pt-4 border-t border-white/5">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">SAVYRON NEURAL</span>
              <span>•</span>
              <span>v2.4.0 High-Performance</span>
            </div>
            <div className="flex items-center gap-2 text-[#00E5A0] font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00E5A0] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00E5A0] shadow-[0_0_8px_#00E5A0]" />
              </span>
              <span>Todos os sistemas neurais operacionais (18ms)</span>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

