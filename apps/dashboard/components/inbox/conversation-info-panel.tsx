'use client';

import { useCallback, useState } from 'react';
import {
  X, Info, Phone, Mail, MapPin, Building, StickyNote, Loader2, CheckCheck, Trash2, User, Bot, Lock, Clock, CheckCircle2, Pencil, Check,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useApi, request } from '@/hooks/use-api';
import { useToast } from '@/components/ui/toast';
import { hasRealLeadName } from '@prospector/utils';

export interface ConversationNote {
  id: string;
  content: string;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface InfoPanelLead {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  business_name: string | null;
  city: string | null;
  state: string | null;
  status: string;
  segment?: string | null;
  lead_score?: number | null;
}

interface ConversationInfoPanelProps {
  conversationId: string;
  lead: InfoPanelLead;
  humanHandled: boolean;
  status?: string;
  currentUserId: string;
  open: boolean;
  onClose: () => void;
  onTakeover: () => Promise<void>;
  onRelease: () => Promise<void>;
  onCloseConversation: () => void;
  onSaveName: (newName: string) => Promise<void>;
}

type Tab = 'info' | 'notes';

const MAX_NOTE = 2000;

function formatNoteTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatLastActivity(iso: string | null): string {
  if (!iso) return 'Não informado';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Não informado';
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return `Hoje, ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/**
 * Painel lateral do contato: Info | Notas | Dados do contato | Ações.
 * Desktop: coluna lateral retrátil (fechada por padrão ao selecionar contato).
 * Mobile: gaveta (drawer) com backdrop.
 */
export function ConversationInfoPanel({
  conversationId,
  lead,
  humanHandled,
  status = 'OPEN',
  currentUserId,
  open,
  onClose,
  onTakeover,
  onRelease,
  onCloseConversation,
  onSaveName,
}: ConversationInfoPanelProps) {
  const { success, error: toastError } = useToast();
  const [tab, setTab] = useState<Tab>('info');
  const [noteDraft, setNoteDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Estado para alteração de nome dentro da seção Ações
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const notes = useApi<{ notes: ConversationNote[]; total: number }>(
    ['notes', conversationId],
    `notes/conversation/${conversationId}`,
    { refetchInterval: 20000 },
  );

  const noteList = notes.data?.notes ?? [];

  const createNote = useCallback(async () => {
    const content = noteDraft.trim();
    if (!content) return;
    setSaving(true);
    try {
      await request(`notes/conversation/${conversationId}`, { method: 'POST', body: { content } });
      setNoteDraft('');
      success('Anotação salva');
      notes.refetch();
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Falha ao salvar');
    } finally {
      setSaving(false);
    }
  }, [noteDraft, conversationId, notes, success, toastError]);

  const deleteNote = useCallback(async (id: string) => {
    setDeletingId(id);
    try {
      await request(`notes/${id}`, { method: 'DELETE' });
      success('Anotação excluída');
      notes.refetch();
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Falha ao excluir');
    } finally {
      setDeletingId(null);
    }
  }, [notes, success, toastError]);

  const handleSaveName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    setSavingName(true);
    try {
      await onSaveName(trimmed);
      setEditingName(false);
    } catch {
      // Erro tratado pelo handler principal
    } finally {
      setSavingName(false);
    }
  };

  const initials = (hasRealLeadName(lead.name) ? lead.name! : '?').slice(0, 1).toUpperCase();
  const displayName = hasRealLeadName(lead.name) ? lead.name : 'Novo contato';

  if (!open) {
    return null;
  }

  return (
    <>
      {/* Backdrop no mobile */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className="fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-white/10 bg-[#080D18] shadow-2xl backdrop-blur-xl sm:max-w-md lg:relative lg:z-auto lg:h-full lg:min-h-0 lg:w-[320px] lg:shrink-0">
        {/* Header do Painel */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex flex-1 gap-1 rounded-xl bg-white/5 p-1">
            <button
              onClick={() => setTab('info')}
              aria-pressed={tab === 'info'}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold transition-colors ${
                tab === 'info' ? 'bg-[#00E5FF]/20 text-[#00E5FF]' : 'text-[#A8B3C7] hover:text-white'
              }`}
            >
              <Info className="h-3.5 w-3.5" /> Info
            </button>
            <button
              onClick={() => setTab('notes')}
              aria-pressed={tab === 'notes'}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold transition-colors ${
                tab === 'notes' ? 'bg-[#00E5FF]/20 text-[#00E5FF]' : 'text-[#A8B3C7] hover:text-white'
              }`}
            >
              <StickyNote className="h-3.5 w-3.5" /> Notas
              {noteList.length > 0 ? (
                <span className="rounded-full bg-[#00E5FF]/20 px-1.5 text-[9px] text-[#00E5FF]">{noteList.length}</span>
              ) : null}
            </button>
          </div>
          <button
            onClick={onClose}
            className="ml-2 flex h-8 w-8 items-center justify-center rounded-xl text-[#A8B3C7] transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Fechar painel"
            title="Fechar painel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {tab === 'notes' ? (
          /* ───── NOTAS INTERNAS ───── */
          <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
            <div className="flex-1 min-h-0 space-y-3 overflow-y-auto px-4 py-4">
              {notes.isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-[#00E5FF]" /></div>
              ) : noteList.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#64748B]">Nenhuma anotação ainda.</div>
              ) : (
                noteList.map((n) => (
                  <div key={n.id} className="group rounded-xl border border-white/5 bg-[#0C1427]/60 p-3 transition-colors hover:border-white/10">
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">{n.content}</p>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-[#64748B]">
                      <span>{n.created_by_name ?? 'Usuário'} · {formatNoteTime(n.created_at)}</span>
                      {n.created_by === currentUserId ? (
                        <button
                          onClick={() => void deleteNote(n.id)}
                          disabled={deletingId === n.id}
                          className="flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[#FF3366] opacity-0 transition-all group-hover:opacity-100 hover:bg-[#FF3366]/10 disabled:opacity-50"
                          aria-label="Excluir anotação"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
            {/* Composer de notas */}
            <div className="shrink-0 border-t border-white/10 px-4 py-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
                <Lock className="h-3 w-3 text-[#00E5A0]" /> Nota interna · nunca enviada ao cliente
              </div>
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value.slice(0, MAX_NOTE))}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void createNote(); } }}
                placeholder="Adicionar uma nota…"
                rows={3}
                aria-label="Nova nota interna"
                className="w-full resize-none rounded-xl border border-white/10 bg-[#F6F8FA] px-3 py-2.5 text-sm text-[#1F2328] placeholder-[#64748B] focus:border-[#00E5FF] focus:ring-1 focus:ring-[#00E5FF]/20 focus:outline-none dark:bg-[#050914] dark:text-white"
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] text-[#64748B]">{noteDraft.length}/{MAX_NOTE}</span>
                <button
                  onClick={() => void createNote()}
                  disabled={saving || !noteDraft.trim()}
                  className="flex items-center gap-1.5 rounded-xl bg-[#00E5FF]/20 px-3 py-1.5 text-xs font-bold text-[#00E5FF] transition-all hover:bg-[#00E5FF]/30 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <StickyNote className="h-3 w-3" />} Salvar
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ───── INFO ───── */
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="flex flex-col items-center gap-3 border-b border-white/10 px-4 py-6">
              <div className="relative">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#00E5FF]/30 bg-gradient-to-tr from-[#008CFF] to-[#7C3CFF] text-xl font-black text-white shadow-[0_0_20px_rgba(0,140,255,0.3)]">
                  {initials}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-[#080D18] text-[#00E5FF]">
                  {humanHandled ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                </span>
              </div>
              <div className="text-center">
                <div className="inbox-contact-name text-sm font-bold text-foreground">{displayName}</div>
                <Badge tone={humanHandled ? 'blue' : 'violet'} className="mt-1 px-2 py-0.5 text-[10px]">
                  {humanHandled ? <><User className="mr-1 inline h-2.5 w-2.5" />Atendimento humano</> : 'IA SAVYRON · automático'}
                </Badge>
              </div>
            </div>

            <div className="px-4 py-3">
              <SectionTitle>Última atividade</SectionTitle>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>{formatLastActivity(null)}</span>
              </div>
            </div>

            <div className="px-4 pb-3">
              <SectionTitle>Contato</SectionTitle>
              {lead.phone ? <InfoRow icon={<Phone className="h-4 w-4 text-[#00E5A0]" />} label="Telefone" value={lead.phone} /> : null}
              {lead.email ? <InfoRow icon={<Mail className="h-4 w-4 text-[#008CFF]" />} label="E-mail" value={lead.email} /> : null}
              {lead.business_name ? <InfoRow icon={<Building className="h-4 w-4 text-[#7C3CFF]" />} label="Empresa" value={lead.business_name} /> : null}
              {lead.city ? <InfoRow icon={<MapPin className="h-4 w-4 text-[#FF3366]" />} label="Local" value={`${lead.city}/${lead.state ?? ''}`} /> : null}
              {!lead.phone && !lead.email && !lead.business_name && !lead.city ? (
                <p className="py-3 text-center text-xs text-[#64748B]">Nenhuma informação adicional.</p>
              ) : null}
            </div>

            {/* ── SEÇÃO AÇÕES (Assumir, Encerrar, Alterar nome) ── */}
            <div className="border-t border-white/10 px-4 py-3.5">
              <SectionTitle>Ações</SectionTitle>
              <div className="mt-2 space-y-2">
                {!humanHandled ? (
                  <button
                    type="button"
                    onClick={async () => {
                      setActionLoading(true);
                      try { await onTakeover(); } finally { setActionLoading(false); }
                    }}
                    disabled={actionLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#008CFF]/35 bg-[#008CFF]/15 px-3 py-2.5 text-xs font-bold text-[#00E5FF] shadow-[0_0_12px_rgba(0,140,255,0.15)] transition-all hover:border-[#00E5FF]/50 hover:bg-[#008CFF]/25 active:scale-[0.99] disabled:opacity-50"
                  >
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <User className="h-4 w-4" />}
                    Assumir conversa
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      setActionLoading(true);
                      try { await onRelease(); } finally { setActionLoading(false); }
                    }}
                    disabled={actionLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#7C3CFF]/35 bg-[#7C3CFF]/15 px-3 py-2.5 text-xs font-bold text-[#C084FC] transition-all hover:border-[#7C3CFF]/50 hover:bg-[#7C3CFF]/25 active:scale-[0.99] disabled:opacity-50"
                  >
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                    Devolver para a IA
                  </button>
                )}

                {status !== 'CLOSED' ? (
                  <button
                    type="button"
                    onClick={onCloseConversation}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs font-bold text-[#FF3366] transition-colors hover:border-red-500/50 hover:bg-red-500/20 active:scale-[0.99]"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Encerrar conversa
                  </button>
                ) : null}

                {editingName ? (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 dark:bg-[#0C1427]/70">
                    <label className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">
                      Alterar nome
                    </label>
                    <input
                      autoFocus
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleSaveName();
                        if (e.key === 'Escape') setEditingName(false);
                      }}
                      maxLength={80}
                      placeholder="Nome do contato"
                      className="input !px-3 !py-1.5 text-xs"
                    />
                    <div className="mt-2.5 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingName(false)}
                        disabled={savingName}
                        className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-muted-foreground hover:bg-white/10"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSaveName()}
                        disabled={savingName || !nameDraft.trim()}
                        className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#008CFF] to-[#00E5FF] px-3 py-1 text-xs font-bold text-white shadow-sm hover:brightness-110 disabled:opacity-50"
                      >
                        {savingName ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        Salvar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setNameDraft(hasRealLeadName(lead.name) ? (lead.name ?? '') : '');
                      setEditingName(true);
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-semibold text-foreground transition-all hover:border-[#00E5FF]/40 hover:bg-white/10 hover:text-[#00E5FF] active:scale-[0.99]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Alterar nome
                  </button>
                )}
              </div>
            </div>

            <div className="px-4 pb-6">
              <SectionTitle>Dados comerciais</SectionTitle>
              <InfoRow icon={<CheckCheck className="h-4 w-4 text-[#A8B3C7]" />} label="Status" value={lead.status?.replace(/_/g, ' ') ?? 'Não informado'} />
              <InfoRow icon={<Building className="h-4 w-4 text-[#A8B3C7]" />} label="Segmento" value={lead.segment || 'Não informado'} />
              {lead.lead_score != null ? (
                <InfoRow icon={<span className="text-[#FFB020]">★</span>} label="Prioridade" value={`${lead.lead_score} pontos`} />
              ) : null}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">{children}</div>;
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      {icon}
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">{label}</div>
        <div className="truncate text-xs font-medium text-foreground">{value}</div>
      </div>
    </div>
  );
}