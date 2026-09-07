'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AnimatePresence } from 'framer-motion';
import { ArrowLeft, Bot, User, Send, Pencil, X, Check } from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useApi, request } from '@/hooks/use-api';
import { useRealtime } from '@/hooks/use-realtime';
import { useQueryClient } from '@tanstack/react-query';
import { hasRealLeadName } from '@prospector/utils';
import { MessageBubble, ChatMessage } from '@/components/chat/message-bubble';
import { TypingIndicator } from '@/components/chat/typing-indicator';

interface ConversationDetail {
  id: string;
  lead: { id: string; name: string | null; phone: string | null; email: string | null; business_name: string | null; city: string | null; state: string | null; status: string };
  human_handled: boolean;
  ai_provider: string | null;
  status: string;
  messages: ChatMessage[];
}

export default function ConversationDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const prevLen = useRef(0);

  const conversation = useApi<ConversationDetail>(['conversation', id], `conversations/${id}`, { refetchInterval: 10000 });
  const data = conversation.data;

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['conversation', id] });
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
    queryClient.invalidateQueries({ queryKey: ['clients'] });
  }, [queryClient, id]);

  // Atualização em tempo real: invalida quando a conversa recebe evento.
  useRealtime({
    new_message_received: (event) => {
      if (event.conversationId === id || event.leadId === data?.lead.id) invalidate();
    },
    ai_response_generated: (event) => {
      if (event.conversationId === id || event.leadId === data?.lead.id) invalidate();
    },
    status_changed: (event) => {
      if (event.conversationId === id || event.leadId === data?.lead.id) invalidate();
    },
  });

  const lastMessage = data?.messages[data.messages.length - 1] ?? null;

  // Indicador de "digitando…": mostra quando a última mensagem é do lead e a
  // conversa está com a IA. Some quando a IA respondeu ou após 40s (seguro).
  useEffect(() => {
    if (!data) return;
    if (!data.human_handled && lastMessage && lastMessage.direction === 'IN') {
      setShowTyping(true);
      const t = window.setTimeout(() => setShowTyping(false), 40000);
      return () => window.clearTimeout(t);
    }
    setShowTyping(false);
  }, [data?.messages.length, data?.human_handled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll: rola até a última mensagem ao carregar ou ao chegar nova.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const first = prevLen.current === 0;
    prevLen.current = data?.messages.length ?? 0;
    el.scrollTo({ top: el.scrollHeight, behavior: first ? 'auto' : 'smooth' });
  }, [data?.messages.length]);

  useEffect(() => {
    if (showTyping) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [showTyping]);

  /** Edição do nome do contato (fonte oficial: Lead.name no banco). */
  const startEditName = () => {
    if (!data) return;
    const fallback = hasRealLeadName(data.lead.name) ? (data.lead.name ?? '') : '';
    setNameDraft(fallback);
    setEditingName(true);
  };

  const saveName = async () => {
    if (!data) return;
    setSavingName(true);
    try {
      await request(`leads/${data.lead.id}/name`, {
        method: 'PATCH',
        body: { name: nameDraft },
      });
      success('Nome atualizado');
      setEditingName(false);
      invalidate();
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Falha ao salvar nome');
    } finally {
      setSavingName(false);
    }
  };

  const takeover = async () => {
    try {
      await request(`conversations/${id}/takeover`, { method: 'POST', body: {} });
      success('Conversa assumida — modo manual');
      invalidate();
      window.setTimeout(() => inputRef.current?.focus(), 150);
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Falha');
    }
  };

  const release = async () => {
    try {
      await request(`conversations/${id}/release`, { method: 'POST', body: {} });
      success('Conversa devolvida para a IA');
      invalidate();
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Falha');
    }
  };

  const close = async () => {
    try {
      await request(`conversations/${id}/close`, { method: 'POST', body: {} });
      success('Conversa encerrada');
      invalidate();
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Falha');
    }
  };

  const send = async () => {
    const content = draft.trim();
    if (!content) return;
    setSending(true);
    try {
      await request(`conversations/${id}/message`, { method: 'POST', body: { content } });
      setDraft('');
      if (inputRef.current) inputRef.current.style.height = 'auto';
      invalidate();
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Falha no envio');
    } finally {
      setSending(false);
    }
  };

  const autoGrow = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  };

  const humanMode = Boolean(data && data.human_handled && data.status === 'OPEN');

  return (
    <div className="dashboard-wrapper">
      <Sidebar />
      {/* Direita: chat em altura total */}
      <div className="lg:pl-64">
        <div className="flex h-dvh flex-col bg-[#020409]">
          {/* Header fixo */}
          <header className="sticky top-0 z-10 border-b border-white/10 bg-[#080D18]/90 backdrop-blur-xl">
            <div className="flex items-center gap-2 px-3 py-3 sm:px-6">
              <Link
                href="/inbox"
                aria-label="Voltar às mensagens"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#0C1427]/70 text-[#A8B3C7] transition-all hover:border-[#00E5FF]/40 hover:bg-[#121B32] hover:text-white active:scale-95 shadow-sm"
              >
                <ArrowLeft className="h-4.5 w-4.5" />
              </Link>

              {conversation.isLoading ? (
                <div className="flex h-9 items-center pl-2">
                  <Spinner className="text-[#00E5FF]" />
                </div>
              ) : data ? (
                <>
                  {/* Identidade */}
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#00E5FF]/30 bg-gradient-to-tr from-[#008CFF] to-[#7C3CFF] text-sm font-black text-white shadow-[0_0_12px_rgba(0,140,255,0.3)]">
                      {(hasRealLeadName(data.lead.name) ? data.lead.name! : '?').slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      {editingName ? (
                        /* Popover inline de edição (discreto, cabe no mobile) */
                        <div className="flex flex-col gap-1.5 rounded-xl border border-[#008CFF]/30 bg-[#0C1427]/90 p-2 shadow-lg backdrop-blur-md max-sm:w-[calc(100vw-140px)]">
                          <label className="text-[10px] font-semibold uppercase tracking-wider text-[#A8B3C7]">
                            Nome do contato
                          </label>
                          <div className="flex items-center gap-1.5">
                            <input
                              autoFocus
                              value={nameDraft}
                              onChange={(e) => setNameDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') void saveName();
                                if (e.key === 'Escape') setEditingName(false);
                              }}
                              maxLength={80}
                              placeholder="Nome do contato"
                              aria-label="Nome do contato"
                              className="input !py-1.5 !px-2.5 text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => void saveName()}
                              disabled={savingName}
                              aria-label="Salvar nome"
                              title="Salvar"
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#00E5A0]/40 bg-[#00E5A0]/10 text-[#00E5A0] transition-colors hover:bg-[#00E5A0]/20 disabled:opacity-50"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingName(false)}
                              aria-label="Cancelar edição"
                              title="Cancelar"
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[#A8B3C7] transition-colors hover:bg-white/10"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-bold text-white">
                            {hasRealLeadName(data.lead.name) ? data.lead.name : 'Novo contato'}
                          </span>
                          <button
                            type="button"
                            onClick={startEditName}
                            aria-label="Editar nome do contato"
                            title="Editar nome"
                            className="shrink-0 rounded-lg p-1 text-[#94A3B8] opacity-70 transition-all hover:bg-white/10 hover:text-[#00E5FF] hover:opacity-100"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <Badge tone={data.human_handled ? 'blue' : 'violet'} className="px-2 py-0.5">
                            {data.human_handled ? <User className="mr-1 inline h-2.5 w-2.5" /> : <Bot className="mr-1 inline h-2.5 w-2.5" />}
                            {data.human_handled ? 'Manual' : 'IA SAVYRON'}
                          </Badge>
                          <Badge tone={data.status === 'OPEN' ? 'emerald' : 'zinc'} className="hidden px-2 py-0.5 sm:inline-flex">
                            {data.status === 'OPEN' ? 'Aberta' : 'Encerrada'}
                          </Badge>
                        </div>
                      )}
                      <div className="truncate text-xs text-[#A8B3C7]">
                        {data.lead.business_name ? `${data.lead.business_name} · ` : ''}
                        {data.lead.phone ?? data.lead.email ?? ''}
                        {data.lead.city ? ` · ${data.lead.city}/${data.lead.state ?? ''}` : ''}
                      </div>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex shrink-0 items-center gap-2">
                    {!data.human_handled ? (
                      <Button size="sm" onClick={() => void takeover()}>
                        <User className="h-4 w-4 mr-1.5" /> Assumir
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => void release()}>
                        <Bot className="h-4 w-4 mr-1.5" /> IA
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => void close()}>
                      Encerrar
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          </header>

          {/* Lista de mensagens (scroll própria) */}
          <main className="chat-scroll flex-1 overflow-y-auto" ref={scrollRef} aria-live="polite">
            <div className="mx-auto w-full max-w-3xl space-y-3 px-3 py-6 sm:px-4">
              {conversation.isLoading ? (
                <div className="flex justify-center py-16">
                  <Spinner className="text-[#00E5FF]" />
                </div>
              ) : data && data.messages.length === 0 ? (
                <div className="py-16 text-center text-sm text-[#A8B3C7]">Nenhuma mensagem ainda.</div>
              ) : (
                data?.messages.map((m) => <MessageBubble key={m.id} message={m} />)
              )}

              <AnimatePresence>{showTyping && !conversation.isLoading && <TypingIndicator />}</AnimatePresence>
            </div>
          </main>

          {/* Composer fixo no rodapé */}
          <footer className="sticky bottom-0 z-10 border-t border-white/10 bg-[#080D18]/90 px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur-xl sm:px-6">
            <div className="mx-auto w-full max-w-3xl">
              {data && !humanMode && (
                <p className="mb-2 text-center text-[11px] text-[#A8B3C7]">
                  {data.status === 'OPEN' ? 'A IA está de prontidão. Assuma a conversa para responder manualmente.' : 'Conversa encerrada.'}
                </p>
              )}
              <div className="flex items-end gap-2">
                <div className={`flex-1 transition-opacity duration-300 ${humanMode ? 'opacity-100' : 'opacity-50'}`}>
                  <textarea
                    ref={inputRef}
                    value={draft}
                    disabled={!humanMode}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      autoGrow();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    placeholder={humanMode ? 'Digite sua resposta manual…' : 'Modo manual: assuma a conversa para responder'}
                    rows={1}
                    className="min-h-[44px] w-full resize-none rounded-2xl border border-white/10 bg-[#050914] px-4 py-2.5 text-sm text-white placeholder-[#64748B] focus:border-[#00E5FF] focus:ring-2 focus:ring-[#00E5FF]/20 focus:shadow-[0_0_15px_rgba(0,229,255,0.2)] focus:outline-none disabled:cursor-not-allowed disabled:border-white/5 disabled:bg-[#03060C] disabled:text-[#64748B]"
                  />
                </div>
                <Button onClick={() => void send()} loading={sending} disabled={!humanMode || !draft.trim()} className="h-[44px] w-[44px] shrink-0 rounded-2xl !p-0 flex items-center justify-center shadow-xs" aria-label="Enviar mensagem">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}