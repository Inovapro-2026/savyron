'use client';

import { useState, useEffect } from 'react';
import { Bot, ShoppingCart, Headset, Handshake } from 'lucide-react';
import { DashboardShell } from '@/components/layout/shell';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { useApi, useApiMutationMethod, request } from '@/hooks/use-api';
import { useQueryClient } from '@tanstack/react-query';

interface AISettingsData {
  id: string;
  business_id: string;
  agent_id: string | null;
  tone: string;
  behaviors: Record<string, boolean>;
  message_config: Record<string, unknown>;
  custom_prompt: string | null;
  agent_mode: string;
  agent: { id: string; name: string; role: string | null; description: string | null; active: boolean } | null;
}

const AGENT_MODES = [
  {
    value: 'sales',
    label: 'Vendas',
    icon: ShoppingCart,
    title: 'Especialista em vendas',
    desc: 'Encontra oportunidades, apresenta soluções, trata objeções e conduz clientes até a conversão.',
  },
  {
    value: 'support',
    label: 'Suporte',
    icon: Headset,
    title: 'Especialista em atendimento',
    desc: 'Resolve dúvidas e problemas, orienta clientes e encaminha casos quando necessário.',
  },
  {
    value: 'sales_support',
    label: 'Vendas + Suporte',
    icon: Handshake,
    title: 'Atendimento completo',
    desc: 'Identifica automaticamente se o cliente precisa de suporte ou está pronto para comprar.',
  },
];

const TONES = [
  { value: 'PROFESSIONAL', label: 'Profissional' },
  { value: 'FRIENDLY', label: 'Amigável' },
  { value: 'CASUAL', label: 'Casual' },
  { value: 'RELAXED', label: 'Descontraído' },
  { value: 'PREMIUM', label: 'Premium' },
  { value: 'CONSULTATIVE', label: 'Consultivo' },
  { value: 'TECHNICAL', label: 'Técnico' },
];

const BEHAVIORS: { key: string; label: string }[] = [
  { key: 'natural', label: 'Ser natural' },
  { key: 'avoid_robotic', label: 'Evitar respostas robóticas' },
  { key: 'ask_questions', label: 'Fazer perguntas' },
  { key: 'identify_need', label: 'Identificar a necessidade do cliente' },
  { key: 'try_convert', label: 'Tentar converter' },
  { key: 'offer_products', label: 'Oferecer produtos/serviços' },
  { key: 'try_schedule', label: 'Tentar agendar' },
  { key: 'forward_to_human', label: 'Encaminhar para humano' },
  { key: 'use_emojis', label: 'Usar emojis' },
];

export default function AISettingsPage() {
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useApi<AISettingsData>(['ai-settings'], 'ai/settings');

  const [agentName, setAgentName] = useState('');
  const [agentRole, setAgentRole] = useState('');
  const [agentDesc, setAgentDesc] = useState('');
  const [agentId, setAgentId] = useState<string | null>(null);
  const [tone, setTone] = useState('FRIENDLY');
  const [behaviors, setBehaviors] = useState<Record<string, boolean>>({});
  const [msgLength, setMsgLength] = useState('');
  const [msgSentences, setMsgSentences] = useState('');
  const [msgPerReply, setMsgPerReply] = useState('');
  const [maxEmojis, setMaxEmojis] = useState('');
  const [agentMode, setAgentMode] = useState('sales_support');

  useEffect(() => {
    if (!settings) return;
    setAgentId(settings.agent?.id ?? null);
    setAgentName(settings.agent?.name ?? '');
    setAgentRole(settings.agent?.role ?? '');
    setAgentDesc(settings.agent?.description ?? '');
    setTone(settings.tone);
    setBehaviors(settings.behaviors ?? {});
    setMsgLength(String((settings.message_config as any)?.max_length ?? ''));
    setMsgSentences(String((settings.message_config as any)?.max_sentences ?? ''));
    setMsgPerReply(String((settings.message_config as any)?.max_messages_per_reply ?? ''));
    setMaxEmojis(String((settings.message_config as any)?.max_emojis ?? ''));
    setAgentMode(settings.agent_mode ?? 'sales_support');
  }, [settings]);

  const saveMutation = useApiMutationMethod({
    onSuccess: () => {
      success('Configuração de IA salva');
      queryClient.invalidateQueries({ queryKey: ['ai-settings'] });
    },
    onError: (err) => toastError(err.message),
  });

  const toggleBehavior = (key: string) => setBehaviors((b) => ({ ...b, [key]: !b[key] }));

  const save = async () => {
    const message_config: Record<string, unknown> = {};
    if (msgLength) message_config.max_length = Number(msgLength);
    if (msgSentences) message_config.max_sentences = Number(msgSentences);
    if (msgPerReply) message_config.max_messages_per_reply = Number(msgPerReply);
    if (maxEmojis) message_config.max_emojis = Number(maxEmojis);

    await saveMutation.mutateAsync({
      _method: 'PATCH',
      _path: 'ai/settings',
      tone,
      behaviors,
      message_config,
      agent_mode: agentMode,
    });

    // Atualiza/cria o agente de identidade e o vincula às configurações
    if (agentName.trim()) {
      const currentId = agentId ?? settings?.agent?.id ?? null;
      if (currentId) {
        await saveMutation.mutateAsync({
          _method: 'PATCH',
          _path: `ai/agents/${currentId}`,
          name: agentName,
          role: agentRole,
          description: agentDesc,
        });
      } else {
        const created = await saveMutation.mutateAsync({
          _method: 'POST',
          _path: 'ai/agents',
          name: agentName,
          role: agentRole,
          description: agentDesc,
        });
        const newId = (created as { id?: string } | null)?.id ?? null;
        if (newId) {
          setAgentId(newId);
          await saveMutation.mutateAsync({
            _method: 'PATCH',
            _path: 'ai/settings',
            agent_id: newId,
          });
        }
      }
    }
    void request('ai/settings');
  };

  if (isLoading) {
    return (
      <DashboardShell title="Configurar IA">
        <div className="flex h-64 items-center justify-center">
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#080D18]/80 px-4 py-3 text-sm text-slate-400 backdrop-blur-md">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#008CFF] border-t-transparent" />
            Carregando configurações neurais...
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Configurar IA">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#008CFF]/10 border border-[#008CFF]/25 text-[11px] font-semibold text-[#00E5FF] mb-3 uppercase tracking-wider shadow-[0_0_15px_rgba(0,140,255,0.15)]">
          <Bot className="h-3.5 w-3.5 animate-pulse text-[#00E5FF]" />
          Motor Cognitivo Neural &bull; Parâmetros de Comportamento
        </div>
        <h1 className="text-3xl font-black tracking-tight text-white">Configurar IA</h1>
        <p className="mt-1 text-sm text-slate-400">
          Defina a identidade do agente, tom de voz, persona de atuação e regras comportamentais autônomas.
        </p>
      </div>

      <div className="space-y-6">
        <Card className="border border-white/10 bg-[#080D18]/80 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
          <CardHeader title="Identidade do Agente" subtitle="Nome, cargo e persona exibidos nos atendimentos aos clientes" />
          <div className="space-y-4 p-6">
            <Input label="Nome do agente" value={agentName} onChange={(e) => setAgentName(e.target.value)} placeholder="Ex.: Atendente Virtual, Sophia, Alex" />
            <Input label="Função / Cargo" value={agentRole} onChange={(e) => setAgentRole(e.target.value)} placeholder="Ex.: Especialista Comercial, Consultor de Vendas" />
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">Diretriz da Postura & Descrição</label>
              <textarea
                value={agentDesc}
                onChange={(e) => setAgentDesc(e.target.value)}
                rows={3}
                placeholder="Descreva o papel, valores, restrições e a postura executiva que o agente deve adotar nas conversas..."
                className="w-full rounded-xl border border-white/10 bg-[#020409]/70 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition-all duration-200 focus:border-[#008CFF]/60 focus:ring-1 focus:ring-[#008CFF]/30"
              />
            </div>
          </div>
        </Card>

        <Card className="border border-white/10 bg-[#080D18]/80 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
          <CardHeader title="Tom de Voz" subtitle="Selecione a frequência e nuance de comunicação utilizada nas respostas" />
          <div className="p-6">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {TONES.map((t) => {
                const active = tone === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTone(t.value)}
                    className={`rounded-xl border px-4 py-3 text-sm font-medium transition-all duration-200 ${
                      active
                        ? 'border-[#008CFF] bg-[#008CFF]/15 text-[#00E5FF] shadow-[0_0_15px_rgba(0,140,255,0.25)] ring-1 ring-[#008CFF]/40'
                        : 'border-white/10 bg-[#020409]/50 text-slate-400 hover:border-white/20 hover:text-slate-200 hover:bg-[#020409]/80'
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        <Card className="border border-white/10 bg-[#080D18]/80 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
          <CardHeader title="Objetivo do Agente" subtitle="Defina a orientação primordial da IA ao interagir em tempo real" />
          <div className="p-6">
            <div className="grid gap-4 sm:grid-cols-3">
              {AGENT_MODES.map((m) => {
                const Icon = m.icon;
                const active = agentMode === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setAgentMode(m.value)}
                    aria-pressed={active}
                    className={`flex flex-col items-start gap-2.5 rounded-2xl border p-5 text-left transition-all duration-200 ${
                      active
                        ? 'border-[#008CFF] bg-gradient-to-b from-[#008CFF]/15 to-transparent text-white shadow-[0_0_20px_rgba(0,140,255,0.2)] ring-1 ring-[#008CFF]/40'
                        : 'border-white/10 bg-[#020409]/50 text-slate-400 hover:border-white/20 hover:bg-[#020409]/80'
                    }`}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                      active
                        ? 'border-[#008CFF]/40 bg-[#008CFF]/20 text-[#00E5FF] shadow-[0_0_10px_rgba(0,140,255,0.3)]'
                        : 'border-white/10 bg-white/5 text-slate-400'
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className={`text-base font-bold ${active ? 'text-white' : 'text-slate-200'}`}>{m.label}</span>
                    <span className={`text-xs font-semibold ${active ? 'text-[#00E5FF]' : 'text-slate-400'}`}>{m.title}</span>
                    <span className="text-xs leading-relaxed text-slate-400">{m.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        <Card className="border border-white/10 bg-[#080D18]/80 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
          <CardHeader title="Diretrizes de Comportamento" subtitle="Ative ou desative habilidades cognitivas específicas" />
          <div className="grid gap-3 p-6 sm:grid-cols-2 lg:grid-cols-3">
            {BEHAVIORS.map((b) => {
              const active = Boolean(behaviors[b.key]);
              return (
                <label
                  key={b.key}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 transition-all duration-200 ${
                    active
                      ? 'border-[#00E5A0]/40 bg-[#00E5A0]/10 text-emerald-300 shadow-[0_0_12px_rgba(0,229,160,0.12)]'
                      : 'border-white/10 bg-[#020409]/50 text-slate-400 hover:border-white/20 hover:text-slate-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleBehavior(b.key)}
                    className="h-4 w-4 rounded border-white/20 bg-[#020409] text-[#00E5A0] accent-[#00E5A0] focus:ring-0"
                  />
                  <span className="text-xs font-medium leading-snug">{b.label}</span>
                </label>
              );
            })}
          </div>
        </Card>

        <Card className="border border-white/10 bg-[#080D18]/80 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
          <CardHeader title="Cadência & Limites de Mensagens" subtitle="Controle volumétrico do fluxo de saída do agente" />
          <div className="grid gap-5 p-6 sm:grid-cols-2">
            <Input label="Tamanho máximo (caracteres)" type="number" value={msgLength} onChange={(e) => setMsgLength(e.target.value)} placeholder="ex.: 250" />
            <Input label="Máximo de frases por mensagem" type="number" value={msgSentences} onChange={(e) => setMsgSentences(e.target.value)} placeholder="ex.: 3" />
            <Input label="Mensagens enviadas por resposta" type="number" value={msgPerReply} onChange={(e) => setMsgPerReply(e.target.value)} placeholder="ex.: 1" />
            <Input label="Máximo de emojis por mensagem" type="number" value={maxEmojis} onChange={(e) => setMaxEmojis(e.target.value)} placeholder="ex.: 1" />
          </div>
        </Card>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => { void request('ai/settings'); }} className="border-white/10 bg-transparent text-slate-300 hover:bg-white/5 hover:text-white">
            Recarregar
          </Button>
          <Button
            onClick={() => void save()}
            loading={saveMutation.isPending}
            className="bg-gradient-to-r from-[#008CFF] to-[#00E5FF] text-black font-bold shadow-[0_0_20px_rgba(0,140,255,0.3)] hover:brightness-110"
          >
            <Bot className="mr-2 h-4 w-4" />
            Salvar Configuração Neural
          </Button>
        </div>
      </div>
    </DashboardShell>
  );
}