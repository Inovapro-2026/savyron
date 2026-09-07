'use client';

import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, Bot, User, Pencil, X, Check, Info, Handshake, MoreVertical, ArrowDown, Phone, CheckCircle2, MessageSquare,
  PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { useSidebarCollapse } from '@/hooks/use-sidebar';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useApi, request } from '@/hooks/use-api';
import { useRealtime } from '@/hooks/use-realtime';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/hooks/use-session';
import { hasRealLeadName } from '@prospector/utils';
import { MessageBubble, ChatMessage, groupByDate } from '@/components/chat/message-bubble';
import { TypingIndicator } from '@/components/chat/typing-indicator';
import { MessageComposer } from '@/components/chat/message-composer';
import { ConversationBackground } from '@/components/chat/conversation-background';
import { ConversationInfoPanel } from '@/components/inbox/conversation-info-panel';
import { ConversationList } from '@/components/inbox/conversation-list';
import { mergeMessages } from '@/components/inbox/messages-util';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { formatDisplayPhone, type Conversation } from '@/components/inbox/inbox-card';
import type { RealtimeEventMessage } from '@/lib/realtime';

interface ConversationDetail {
  id: string;
  lead: {
    id: string; name: string | null; phone: string | null; email: string | null;
    business_name: string | null; city: string | null; state: string | null; status: string;
  };
  human_handled: boolean;
  human_handoff_notified_at: string | null;
  status: string;
  messages: ChatMessage[];
}

type StatusView = 'ai' | 'human' | 'transferring' | 'closed';

function statusViewOf(data: ConversationDetail | undefined): StatusView {
  if (!data) return 'ai';
  if (data.status === 'CLOSED') return 'closed';
  if (data.human_handled) return 'human';
  if (data.human_handoff_notified_at) return 'transferring';
  return 'ai';
}

function initials(name: string | null | undefined): string {
  const n = (hasRealLeadName(name) ? name! : '').trim();
  if (!n) return '?';
  return n.slice(0, 1).toUpperCase();
}

export default function ConversationDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { collapsed: sidebarCollapsed, toggleCollapsed: toggleSidebar } = useSidebarCollapse();
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [listOpenMobile, setListOpenMobile] = useState(false);
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [closing, setClosing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [newMsgNotice, setNewMsgNotice] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLen = useRef(0);
  const atBottomRef = useRef(true);

  const conversation = useApi<ConversationDetail>(
    ['conversation', id],
    `conversations/${id}`,
    { refetchInterval: 10000 },
  );
  const data = conversation.data;

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['conversation', id] });
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
    queryClient.invalidateQueries({ queryKey: ['clients'] });
  }, [queryClient, id]);

  // ── Estado derivado ──
  const view = statusViewOf(data);
  const humanMode = view === 'human';
  const closed = view === 'closed';

  // ── Deduplicação por ID real (external_id + id) ──
  const messages = useMemo(() => {
    if (!data) return [];
    // A API pode devolver duplicatas por external_id (falhas antigas de persistência).
    // mergeMessages preserva o primeiro e mantém ordem cronológica.
    return mergeMessages<ChatMessage>([], data.messages);
  }, [data]);

  // ── Scroll: detecta se o usuário está no final ──
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    atBottomRef.current = distanceToBottom < 80;
    if (atBottomRef.current) {
      setNewMsgNotice(false);
    }
  }, []);

  /** Rola suavemente até o fim (usado pelo botão "nova mensagem" e auto-scroll). */
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  // Auto-scroll apenas quando o usuário já está no final.
  useEffect(() => {
    if (!atBottomRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const first = prevLen.current === 0;
    prevLen.current = messages.length;
    rAF(() => el.scrollTo({ top: el.scrollHeight, behavior: first ? 'auto' : 'smooth' }));
  }, [messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Realtime: atualiza sem recarregar; não duplica. ──
  const onRealtime = useCallback(
    (event: RealtimeEventMessage) => {
      if (event.conversationId !== id && event.leadId !== data?.lead.id) return;
      invalidate();
      // Se não estava no final e a mensagem é do lead, mostra o aviso.
      if (event.payload?.direction === 'IN' && !atBottomRef.current) setNewMsgNotice(true);
    },
    [invalidate, id, data?.lead.id],
  );

  useRealtime({
    new_message_received: onRealtime,
    ai_response_generated: onRealtime,
    status_changed: onRealtime,
  });

  // Marca leitura ao abrir.
  useEffect(() => { scrollToBottom('auto'); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Digitando (indicador da IA) ──
  useEffect(() => {
    if (!data) return;
    if (!data.human_handled && lastMsg && lastMsg.direction === 'IN') {
      setShowTyping(true);
      const t = window.setTimeout(() => setShowTyping(false), 40000);
      return () => window.clearTimeout(t);
    }
    setShowTyping(false);
  }, [messages.length, data?.human_handled]); // eslint-disable-line react-hooks/exhaustive-deps

  const lastMsg = messages[messages.length - 1] ?? null;

  // Fecha painéis e o drawer de lista ao trocar de conversa (mobile e desktop).
  useEffect(() => { setInfoOpen(false); setListOpenMobile(false); setNewMsgNotice(false); }, [id]);

  // ── Ações ──
  const startEditName = () => {
    if (!data) return;
    const fallback = hasRealLeadName(data.lead.name) ? (data.lead.name ?? '') : '';
    setNameDraft(fallback);
    setEditingName(true);
  };

  const saveName = async (overrideName?: string) => {
    if (!data) return;
    const finalName = (overrideName !== undefined ? overrideName : nameDraft).trim();
    setSavingName(true);
    try {
      await request(`leads/${data.lead.id}/name`, { method: 'PATCH', body: { name: finalName } });
      success('Nome atualizado');
      setEditingName(false);
      // Atualiza cache otimista imediatamente sem reload
      queryClient.setQueryData<ConversationDetail>(['conversation', id], (old) => {
        if (!old) return old;
        return { ...old, lead: { ...old.lead, name: finalName } };
      });
      queryClient.setQueriesData<{ total: number; conversations: Conversation[] }>(
        { queryKey: ['conversations'] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            conversations: old.conversations.map((c) =>
              c.lead_id === data.lead.id || c.id === id ? { ...c, lead_name: finalName } : c
            ),
          };
        }
      );
      invalidate();
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Falha ao salvar nome');
      throw e;
    } finally {
      setSavingName(false);
    }
  };

  const takeover = async () => {
    try {
      await request(`conversations/${id}/takeover`, { method: 'POST', body: {} });
      success('Você está atendendo — modo manual ativado');
      invalidate();
      atBottomRef.current = true;
      window.setTimeout(() => scrollToBottom('auto'), 100);
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Falha ao assumir');
      throw e;
    }
  };

  const release = async () => {
    try {
      await request(`conversations/${id}/release`, { method: 'POST', body: {} });
      success('Conversa devolvida para a IA');
      invalidate();
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Falha ao devolver para a IA');
      throw e;
    }
  };

  const closeConv = async () => {
    setClosing(true);
    try {
      await request(`conversations/${id}/close`, { method: 'POST', body: {} });
      success('Conversa encerrada');
      setCloseConfirm(false);
      invalidate();
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Falha ao encerrar');
    } finally {
      setClosing(false);
    }
  };

  const openConversation = useCallback((cid: string) => {
    if (cid === id) return;
    setInfoOpen(false);
    router.push(`/inbox/${cid}`);
  }, [router, id]);

  // ── Render ──
  const displayName = data ? (hasRealLeadName(data.lead.name) ? data.lead.name! : 'Novo contato') : '';
  const displayedPhone = data ? formatDisplayPhone(data.lead.phone) ?? data.lead.phone ?? '' : '';

  const groups = useMemo(() => (data ? groupByDate(messages) : []), [messages, data]);

  return (
    <div className="dashboard-wrapper fixed inset-0 h-[100dvh] max-h-[100dvh] w-full overflow-hidden">
      <Sidebar collapsed={sidebarCollapsed} onToggleCollapsed={toggleSidebar} />
      <div className={`flex h-[100dvh] max-h-[100dvh] min-h-0 w-full overflow-hidden ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'} transition-[padding] duration-200`}>
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#020409]">
          {/* ── HEADER FIXO (Limpo: sem botões Assumir e Encerrar) ── */}
          <header className="z-20 flex h-14 shrink-0 items-center gap-2 border-b border-white/10 bg-[#080D18]/90 px-2.5 backdrop-blur-xl sm:px-3">
            {/* Voltar */}
            <Link
              href="/inbox"
              aria-label="Voltar às mensagens"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#0C1427]/70 text-[#A8B3C7] transition-all hover:border-[#00E5FF]/40 hover:bg-[#121B32] hover:text-white active:scale-95"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
            </Link>

            {/* Alternar menu lateral principal (desktop) */}
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
              title={sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
              className="hidden lg:flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#0C1427]/70 text-[#A8B3C7] transition-all hover:border-[#00E5FF]/40 hover:text-[#00E5FF] active:scale-95"
            >
              {sidebarCollapsed ? <PanelLeftOpen className="h-4.5 w-4.5" /> : <PanelLeftClose className="h-4.5 w-4.5" />}
            </button>

            {/* Abrir lista (mobile) */}
            <button
              type="button"
              onClick={() => setListOpenMobile(true)}
              aria-label="Mostrar lista de conversas"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#0C1427]/70 text-[#A8B3C7] transition-colors hover:border-[#00E5FF]/40 hover:text-[#00E5FF] lg:hidden"
            >
              <MessageSquare className="h-4 w-4" />
            </button>

            {/* Identidade do contato */}
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#008CFF] to-[#7C3CFF] text-sm font-black text-white shadow-[0_0_12px_rgba(0,140,255,0.3)]">
                {initials(data?.lead.name)}
              </div>
              <div className="min-w-0">
                {editingName && data ? (
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
                      className="input !py-1 !px-2 text-xs max-w-[160px]"
                    />
                    <button type="button" onClick={() => void saveName()} disabled={savingName} aria-label="Salvar nome" title="Salvar"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#00E5A0]/40 bg-[#00E5A0]/10 text-[#00E5A0] transition-colors hover:bg-[#00E5A0]/20 disabled:opacity-50">
                      {savingName ? <Spinner className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                    </button>
                    <button type="button" onClick={() => setEditingName(false)} aria-label="Cancelar edição" title="Cancelar"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[#A8B3C7] transition-colors hover:bg-white/10">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className="inbox-contact-name truncate text-sm font-bold text-foreground">{displayName || '…'}</span>
                      {data && (
                        <button onClick={startEditName} aria-label="Editar nome do contato" title="Alterar nome"
                          className="shrink-0 rounded-lg p-0.5 text-muted-foreground opacity-60 transition-all hover:bg-black/10 dark:hover:bg-white/10 hover:text-[#00E5FF] hover:opacity-100">
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Phone className="h-3 w-3 text-[#00E5A0]" />
                      <span className="truncate">{displayedPhone || data?.lead.email || ''}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Status badge */}
            <div className="hidden shrink-0 items-center sm:flex">
              <StatusBadge view={view} />
            </div>

            {/* Ações do header: Info e mais opções */}
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => setInfoOpen((v) => !v)}
                aria-label={infoOpen ? 'Fechar painel de informações' : 'Abrir painel de informações'}
                title="Informações do contato"
                className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all active:scale-95 ${
                  infoOpen ? 'border-[#00E5FF]/50 bg-[#00E5FF]/15 text-[#00E5FF]'
                    : 'border-white/10 bg-[#0C1427]/70 text-[#A8B3C7] hover:border-[#00E5FF]/40 hover:text-[#00E5FF]'
                }`}
              >
                <Info className="h-4 w-4" />
              </button>

              {/* Menu ⋮ */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-label="Mais ações da conversa"
                  aria-expanded={menuOpen}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-[#0C1427]/70 text-[#A8B3C7] transition-all hover:border-[#FF3366]/40 hover:text-[#FF3366] active:scale-95"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
                {menuOpen ? (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} aria-hidden="true" />
                    <div className="absolute right-0 top-10 z-30 w-52 overflow-hidden rounded-2xl border border-white/10 bg-[#0C1427] py-1 shadow-2xl">
                      {view === 'human' ? (
                        <MenuItem icon={<Bot className="h-4 w-4" />} label="Devolver para a IA" onClick={() => { setMenuOpen(false); void release(); }} />
                      ) : view === 'ai' ? (
                        <MenuItem icon={<User className="h-4 w-4" />} label="Assumir conversa" onClick={() => { setMenuOpen(false); void takeover(); }} />
                      ) : null}
                      <MenuItem icon={<Pencil className="h-4 w-4" />} label="Alterar nome" onClick={() => { setMenuOpen(false); startEditName(); }} />
                      <MenuItem icon={<CheckCircle2 className="h-4 w-4" />} label="Encerrar conversa" danger
                        onClick={() => { setMenuOpen(false); setCloseConfirm(true); }} />
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </header>

          {/* ── CORPO: 3 colunas ── */}
          <div className="flex flex-1 min-h-0 w-full overflow-hidden">
            {/* Coluna 1: lista de conversas (desktop fixa com scroll próprio; mobile drawer) */}
            <div className="hidden h-full min-h-0 shrink-0 lg:block">
              <ConversationList conversationId={id} onNavigate={openConversation} />
            </div>

            {/* Mobile: drawer da lista */}
            <AnimatePresence>
              {listOpenMobile ? (
                <motion.div
                  key="mobile-list"
                  initial={{ x: -280 }}
                  animate={{ x: 0 }}
                  exit={{ x: -280 }}
                  transition={{ type: 'tween', duration: 0.2 }}
                  className="fixed inset-y-0 left-0 z-40 w-[min(85vw,300px)] lg:hidden"
                >
                  <div className="flex h-full w-full flex-col bg-[#080D18]">
                    <div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5">
                      <span className="text-xs font-bold text-white">Conversas</span>
                      <button onClick={() => setListOpenMobile(false)} aria-label="Fechar lista" className="flex h-7 w-7 items-center justify-center rounded-lg text-[#A8B3C7] hover:bg-white/10">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <ConversationList conversationId={id} onNavigate={(cid) => { setListOpenMobile(false); openConversation(cid); }} />
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* Coluna 2: conversa (mensagens com scroll + composer fixo no rodapé da conversa) */}
            <main className="relative flex flex-1 min-h-0 min-w-0 flex-col overflow-hidden">
              <div className="relative flex-1 min-h-0 w-full overflow-hidden">
                <ConversationBackground>
                  <div
                    ref={scrollRef}
                    onScroll={onScroll}
                    className="chat-scroll h-full min-h-0 overflow-y-auto"
                    aria-live="polite"
                  >
                    <div className="mx-auto w-full max-w-3xl space-y-2.5 px-3 py-6 sm:px-4">
                      {conversation.isLoading ? (
                        <div className="flex justify-center py-16"><Spinner className="text-[#00E5FF]" /></div>
                      ) : data && messages.length === 0 ? (
                        <div className="py-16 text-center text-sm text-[#A8B3C7]">Nenhuma mensagem ainda.</div>
                      ) : (
                        groups.map((g, gi) => (
                          <div key={g.label || gi} className="space-y-2.5">
                            <div className="flex justify-center py-1.5">
                              <span className="rounded-full bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#A8B3C7]">
                                {g.label}
                              </span>
                            </div>
                            {g.messages.map((m) => (
                              <MessageBubble key={m.id} message={m} />
                            ))}
                          </div>
                        ))
                      )}

                      <AnimatePresence>{showTyping && !conversation.isLoading && <TypingIndicator />}</AnimatePresence>
                    </div>
                  </div>
                </ConversationBackground>

                {/* Indicador "nova mensagem" (clicável para descer) */}
                <AnimatePresence>
                  {newMsgNotice ? (
                    <motion.button
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      onClick={() => { setNewMsgNotice(false); scrollToBottom('smooth'); }}
                      className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-[#00E5FF]/40 bg-[#0C1427] px-3 py-1.5 text-[11px] font-bold text-[#00E5FF] shadow-lg transition-colors hover:bg-[#121B32]"
                    >
                      <ArrowDown className="h-3 w-3" /> Nova mensagem
                    </motion.button>
                  ) : null}
                </AnimatePresence>
              </div>

              {/* ── COMPOSER FIXO NA PARTE INFERIOR DA CONVERSA ── */}
              <footer className="z-20 shrink-0 border-t border-white/10 bg-[#080D18]/90 px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-3 backdrop-blur-xl sm:px-6">
                <MessageComposer
                  conversationId={id}
                  disabled={!humanMode}
                  aiActive={view === 'ai'}
                  transferring={view === 'transferring'}
                  closed={closed}
                  placeholder={humanMode ? 'Digite sua resposta manual…' : 'Modo manual: assuma a conversa para responder'}
                  onTakeover={() => void takeover()}
                  onSent={() => {
                    invalidate();
                    atBottomRef.current = true;
                    rAF(() => scrollToBottom('smooth'));
                  }}
                />
              </footer>
            </main>

            {/* Coluna 3: painel lateral de informações e ações do contato */}
            {data ? (
              <ConversationInfoPanel
                conversationId={id}
                lead={data.lead}
                humanHandled={data.human_handled}
                status={data.status}
                currentUserId={user?.sub ?? ''}
                open={infoOpen}
                onClose={() => setInfoOpen(false)}
                onTakeover={takeover}
                onRelease={release}
                onCloseConversation={() => setCloseConfirm(true)}
                onSaveName={saveName}
              />
            ) : null}
          </div>
        </div>
      </div>

      {/* Modal de encerrar */}
      <ConfirmModal
        open={closeConfirm}
        title="Encerrar conversa?"
        confirmLabel="Encerrar conversa"
        loading={closing}
        onCancel={() => setCloseConfirm(false)}
        onConfirm={() => void closeConv()}
        message={
          <span>Esta conversa será marcada como <strong className="text-white">encerrada</strong>. O cliente não receberá aviso. Você pode reabrir assumindo novamente.</span>
        }
      />
    </div>
  );
}

function StatusBadge({ view }: { view: StatusView }) {
  if (view === 'human') {
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-[#008CFF]/40 bg-[#008CFF]/15 px-2.5 py-1 text-[10px] font-bold text-[#00E5FF]">
        <User className="h-3 w-3" /> Atendimento humano
      </span>
    );
  }
  if (view === 'transferring') {
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-[#FFB020]/40 bg-[#FFB020]/15 px-2.5 py-1 text-[10px] font-bold text-[#FFB020]">
        <Handshake className="h-3 w-3" /> Transferindo
      </span>
    );
  }
  if (view === 'closed') {
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-bold text-[#A8B3C7]">
        <CheckCircle2 className="h-3 w-3" /> Encerrada
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-[#7C3CFF]/40 bg-[#7C3CFF]/15 px-2.5 py-1 text-[10px] font-bold text-[#C084FC]">
      <Bot className="h-3 w-3" /> IA SAVYRON · automático
    </span>
  );
}

function MenuItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold transition-colors ${danger ? 'text-[#FF3366] hover:bg-red-500/10' : 'text-white hover:bg-white/5'}`}
    >
      {icon} {label}
    </button>
  );
}

// rAF helper
function rAF(cb: () => void) {
  if (typeof window === 'undefined') return;
  window.requestAnimationFrame(() => window.requestAnimationFrame(cb));
}