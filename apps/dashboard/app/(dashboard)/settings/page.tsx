'use client';

import { useState } from 'react';
import { MessageCircle, AlertOctagon, Save, Eraser, Palette } from 'lucide-react';
import { DashboardShell } from '@/components/layout/shell';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { ThemeSelector } from '@/components/theme/theme-selector';
import { HumanHandoffCard } from '@/components/settings/human-handoff-card';
import { useApi, request } from '@/hooks/use-api';
import { useQueryClient } from '@tanstack/react-query';
import { useSession, isBusinessOwnerOrAdmin } from '@/hooks/use-session';

interface WaStatus {
  connected: boolean;
  state: string;
  qrAvailable: boolean;
  qr: string | null;
  qrDataUrl: string | null;
  loggedIn: boolean;
  phone: string | null;
}

interface Settings {
  whatsapp_daily_limit: number;
  email_daily_limit: number;
  interval_seconds: number;
  test_mode_max_leads: number;
}

export default function SettingsPage() {
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();
  const [waLimit, setWaLimit] = useState('');
  const [emailLimit, setEmailLimit] = useState('');
  const [interval, setInterval] = useState('');
  const [saving, setSaving] = useState(false);
  const [waBusy, setWaBusy] = useState(false);
  const [clearSessionOpen, setClearSessionOpen] = useState(false);
  const [clearingSession, setClearingSession] = useState(false);

  const wa = useApi<WaStatus>(['whatsapp-status'], 'whatsapp/status', { refetchInterval: 5000 });
  const settings = useApi<Settings>(['settings'], 'dashboard/settings');
  const { user } = useSession();
  const canAdmin = isBusinessOwnerOrAdmin(user?.businessRole);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['metrics'] });
    queryClient.invalidateQueries({ queryKey: ['settings'] });
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await request('dashboard/settings', {
        method: 'PUT',
        body: {
          ...(waLimit ? { whatsapp_daily_limit: Number(waLimit) } : {}),
          ...(emailLimit ? { email_daily_limit: Number(emailLimit) } : {}),
          ...(interval ? { interval_seconds: Number(interval) } : {}),
        },
      });
      success('Configurações salvas');
      setWaLimit('');
      setEmailLimit('');
      setInterval('');
      invalidate();
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Falha ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const waConnect = async () => {
    setWaBusy(true);
    try {
      await request('whatsapp/connect', { method: 'POST', body: {} });
      success('Conexão solicitada. Escaneie o QR code abaixo.');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-status'] });
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Falha ao conectar WhatsApp');
    } finally {
      setWaBusy(false);
    }
  };

  const waDisconnect = async () => {
    setWaBusy(true);
    try {
      await request('whatsapp/disconnect', { method: 'POST', body: {} });
      success('Sessão encerrada');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-status'] });
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Falha ao desconectar');
    } finally {
      setWaBusy(false);
    }
  };

  const waClearSession = async () => {
    setClearingSession(true);
    try {
      await request('whatsapp/clear-session', { method: 'POST', body: {} });
      success('Sessão limpa. Conecte novamente para gerar um QR novo.');
      setClearSessionOpen(false);
      queryClient.invalidateQueries({ queryKey: ['whatsapp-status'] });
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Falha ao limpar sessão');
    } finally {
      setClearingSession(false);
    }
  };

  const pauseAll = async () => {
    try {
      await request('campaigns/pause-all', { method: 'POST', body: {} });
      success('Todas as campanhas pausadas');
      invalidate();
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Falha ao pausar');
    }
  };

  return (
    <DashboardShell title="Configurações">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#008CFF]/10 border border-[#008CFF]/30 text-[#00E5FF] shadow-[0_0_12px_rgba(0,140,255,0.2)]">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Configurações de Canais & Sistema</h1>
            <p className="text-xs text-slate-400">Instância WhatsApp Baileys, limites operacionais, aparência e parada de emergência</p>
          </div>
        </div>

        {/* APARÊNCIA — seletor de tema dark/light (persistência local) */}
        <ThemeSelector />

        {/* ATENDIMENTO HUMANO — pausa a IA e notifica o proprietário */}
        <HumanHandoffCard
          whatsappConnected={Boolean(wa.data?.connected)}
          waPhone={wa.data?.phone ?? null}
        />

        <div className="rounded-2xl border border-white/10 bg-[#080D18]/80 p-6 backdrop-blur-xl shadow-xl">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${wa.data?.connected ? 'bg-[#00E5A0] shadow-[0_0_8px_#00E5A0]' : wa.data?.qrAvailable ? 'bg-[#FFB020] shadow-[0_0_8px_#FFB020]' : 'bg-slate-500'}`} />
                WhatsApp (Baileys Multi-Device)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Sessão criptografada ponta a ponta persistente no servidor — escaneie para parear</p>
            </div>
            <Badge tone={wa.data?.connected ? 'emerald' : wa.data?.qrAvailable ? 'amber' : 'zinc'}>
              {wa.data?.connected ? 'Instância Conectada' : wa.data?.qrAvailable ? 'Aguardando Leitura do QR' : 'Desconectado'}
            </Badge>
          </div>

          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            {wa.data?.qrDataUrl && !wa.data.connected ? (
              <div className="relative group">
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-[#008CFF] to-[#00E5FF] opacity-50 blur-lg group-hover:opacity-75 transition duration-500" />
                <div className="relative rounded-2xl border-2 border-[#00E5FF]/50 bg-white p-3 shadow-2xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={wa.data.qrDataUrl} alt="QR code do WhatsApp" className="h-64 w-64 rounded-lg" />
                </div>
              </div>
            ) : (
              <div className="flex h-64 w-64 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#020409]/60 p-6 text-center shadow-inner">
                <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-xl ${wa.data?.connected ? 'bg-[#00E5A0]/10 border border-[#00E5A0]/30 text-[#00E5A0] shadow-[0_0_12px_rgba(0,229,160,0.2)]' : 'bg-white/5 text-slate-500'}`}>
                  <MessageCircle className="h-6 w-6" />
                </div>
                <div className="text-sm font-semibold text-slate-300">
                  {wa.data?.connected ? `Conectado como ${wa.data.phone ?? ''}` : wa.data?.state === 'connecting' ? 'Estabelecendo conexão…' : 'Nenhuma sessão ativa'}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {wa.data?.connected ? 'Aparelho online e pronto para envios' : 'Clique no botão ao lado para inicializar'}
                </p>
              </div>
            )}
            <div className="flex flex-col gap-3 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                {!wa.data?.connected ? (
                  <Button onClick={() => void waConnect()} loading={waBusy} disabled={wa.data?.state === 'connecting'} className="shadow-[0_0_15px_rgba(0,140,255,0.35)]">
                    Conectar WhatsApp
                  </Button>
                ) : (
                  <Button variant="danger" onClick={() => void waDisconnect()} loading={waBusy} className="shadow-[0_0_12px_rgba(255,51,102,0.25)]">
                    Desconectar Instância
                  </Button>
                )}
                {canAdmin ? (
                  <Button variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/50" onClick={() => setClearSessionOpen(true)} disabled={clearingSession}>
                    <Eraser className="h-4 w-4" /> Limpar sessão
                  </Button>
                ) : null}
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-xs text-slate-400 space-y-1.5 mt-2">
                <p className="font-semibold text-slate-300">Instruções de Pareamento:</p>
                <p>1. Abra o WhatsApp no celular principal.</p>
                <p>2. Toque em <span className="text-white font-medium">Configurações / Opções → Aparelhos Conectados</span>.</p>
                <p>3. Toque em <span className="text-[#00E5FF] font-medium">Conectar um aparelho</span> e aponte a câmera para o QR Code.</p>
                <p className="text-[11px] text-slate-400 pt-1">
                  Sessão persistente armazenada com chave de criptografia de ponta a ponta.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#080D18]/80 p-6 backdrop-blur-xl shadow-xl">
          <div className="mb-5 border-b border-white/5 pb-4">
            <h2 className="text-base font-bold text-white">Limites Operacionais e Cadência</h2>
            <p className="text-xs text-slate-400 mt-0.5">Defina a cadência segura de disparos para proteger seus números contra restrições</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="Limite WhatsApp/dia"
              type="number"
              value={waLimit}
              onChange={(e) => setWaLimit(e.target.value)}
              placeholder={String(settings.data?.whatsapp_daily_limit ?? 30)}
            />
            <Input
              label="Limite E-mail/dia"
              type="number"
              value={emailLimit}
              onChange={(e) => setEmailLimit(e.target.value)}
              placeholder={String(settings.data?.email_daily_limit ?? 100)}
            />
            <Input
              label="Intervalo entre envios (s)"
              type="number"
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
              placeholder={String(settings.data?.interval_seconds ?? 7200)}
            />
          </div>
          <div className="mt-5 flex justify-end">
            <Button onClick={() => void saveSettings()} loading={saving} className="shadow-[0_0_15px_rgba(0,140,255,0.35)]">
              <Save className="h-4 w-4" /> Salvar alterações
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-[#FF3366]/20 bg-[#080D18]/80 p-6 backdrop-blur-xl shadow-xl">
          <div className="mb-4">
            <h2 className="text-base font-bold text-[#FF3366] flex items-center gap-2">
              <AlertOctagon className="h-5 w-5" />
              Parada de Emergência
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Interrompe instantaneamente o envio de todas as mensagens e campanhas em execução</p>
          </div>
          <Button variant="danger" onClick={() => void pauseAll()} className="shadow-[0_0_15px_rgba(255,51,102,0.3)]">
            <AlertOctagon className="h-4 w-4" /> Pausar todas as campanhas ativas
          </Button>
        </div>
      </div>

      <ConfirmModal
        open={clearSessionOpen}
        title="Limpar sessão do WhatsApp"
        confirmText="EXCLUIR"
        confirmLabel="Limpar sessão"
        loading={clearingSession}
        onCancel={() => setClearSessionOpen(false)}
        onConfirm={() => void waClearSession()}
        message={
          <span>
            Todos os dados da sessão do WhatsApp desta empresa serão{' '}
            <strong className="text-red-400 font-bold">apagados permanentemente do servidor</strong>. O aparelho atualmente pareado será
            deslogado e você precisará escanear um QR code novo. Digite{' '}
            <strong className="text-white font-mono bg-white/10 px-1.5 py-0.5 rounded">EXCLUIR</strong> para confirmar.
          </span>
        }
      />
    </DashboardShell>
  );
}
