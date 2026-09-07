'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Bot, User, Search, MessageSquare, CheckCircle2 } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { useRealtime } from '@/hooks/use-realtime';
import { Conversation } from './inbox-card';
import type { RealtimeEventMessage } from '@/lib/realtime';

const FILTERS = [
  { key: 'responded', label: 'Todas' },
  { key: 'manual', label: 'Humano' },
  { key: 'closed', label: 'Encerradas' },
];

function timeLabel(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const sameDay = today.toDateString() === d.toDateString();
  if (sameDay) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 48 * 3600 * 1000) return 'ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function initials(name: string | null | undefined): string {
  const n = (name ?? '').trim();
  if (!n) return '?';
  return n.slice(0, 1).toUpperCase();
}

interface ConversationListProps {
  conversationId?: string;
  /** Callback executado ao mudar a conversa ativa (navigate). */
  onNavigate?: (id: string) => void;
}

/**
 * Lista lateral de conversas (coluna esquerda do Inbox). Responsiva:
 * no mobile renderiza uma lista de altura fixa acima do chat; no desktop
 * vira uma coluna independente com scroll próprio.
 */
export function ConversationList({ conversationId, onNavigate }: ConversationListProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState(FILTERS[0].key);
  const [search, setSearch] = useState('');

  const conversations = useApi<{ total: number; conversations: Conversation[] }>(
    ['conversations', filter],
    `conversations?filter=${filter}&pageSize=100`,
    { refetchInterval: 15000 }
  );

  const list = useMemo(() => conversations.data?.conversations ?? [], [conversations.data]);

  const term = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!term) return list;
    return list.filter((c) => {
      const name = (c.lead_name ?? '').toLowerCase();
      const phone = (c.lead_phone ?? '').toLowerCase();
      const biz = (c.business_name ?? '').toLowerCase();
      return name.includes(term) || phone.replace(/\D/g, '').includes(term.replace(/\D/g, '')) || biz.includes(term);
    });
  }, [list, term]);

  // Atualiza a lista ao receber eventos em tempo real.
  const applyEvent = useCallback(
    (event: RealtimeEventMessage) => {
      if (!event.conversationId || !event.leadId) return;
      const key = ['conversations', filter];
      const cached = queryClient.getQueryData<{ total: number; conversations: Conversation[] }>(key);
      if (!cached) return;
      const ts = event.timestamp || new Date().toISOString();
      const next = cached.conversations.map((c) => {
        if (c.id !== event.conversationId && c.lead_id !== event.leadId) return c;
        const u: Conversation = { ...c, last_message_at: ts };
        if (event.payload?.content) {
          u.last_message_preview = event.payload.content.slice(0, 120);
          u.last_message = { direction: event.payload.direction ?? 'IN', content: event.payload.content, created_at: ts };
        }
        if (event.payload?.lead_status) u.lead_status = event.payload.lead_status;
        if (typeof event.payload?.human_handled === 'boolean') u.human_handled = event.payload.human_handled;
        return u;
      });
      next.sort((a, b) => String(b.last_message_at ?? '').localeCompare(String(a.last_message_at ?? '')));
      queryClient.setQueryData(key, { ...cached, conversations: next });
    },
    [queryClient, filter]
  );

  useRealtime({
    new_message_received: applyEvent,
    ai_response_generated: applyEvent,
    status_changed: applyEvent,
  });

  const open = useCallback(
    (c: Conversation) => {
      if (onNavigate) { onNavigate(c.id); return; }
      router.push(`/inbox/${c.id}`);
    },
    [router, onNavigate]
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden border-r border-white/10 bg-[#080D18]/80 lg:w-[300px] lg:shrink-0 lg:bg-[#080D18]/60">
      {/* Busca */}
      <div className="px-3 pt-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A8B3C7]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar conversa…"
            aria-label="Buscar conversas"
            className="h-9 w-full rounded-xl border border-white/10 bg-[#0C1427]/70 pl-9 pr-3 text-sm text-white placeholder-[#64748B] transition-all focus:border-[#00E5FF] focus:ring-2 focus:ring-[#00E5FF]/20 focus:outline-none"
          />
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-1.5 px-3 py-2.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold transition-all ${
              filter === f.key
                ? 'bg-[#00E5FF]/20 text-[#00E5FF] ring-1 ring-[#00E5FF]/40'
                : 'bg-white/5 text-[#A8B3C7] hover:bg-white/10 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2">
        {conversations.isLoading ? (
          <div className="space-y-2.5 p-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5 rounded-xl p-2">
                <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-[#0C1427]" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-2/3 animate-pulse rounded bg-[#0C1427]" />
                  <div className="h-2.5 w-full animate-pulse rounded bg-[#0C1427]" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <MessageSquare className="h-8 w-8 text-[#008CFF]/40" />
            <p className="text-xs font-semibold text-[#A8B3C7]">Nenhuma conversa encontrada.</p>
          </div>
        ) : (
          filtered.map((c) => {
            const active = c.id === conversationId;
            const human = c.human_handled;
            const lastMsg = c.last_message?.content ?? c.last_message_preview ?? 'Sem mensagens';
            return (
              <button
                key={c.id}
                onClick={() => open(c)}
                aria-current={active ? 'page' : undefined}
                className={`group flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition-colors ${
                  active
                    ? 'bg-[#008CFF]/15 dark:bg-[#00E5FF]/12 ring-1 ring-[#008CFF]/30 dark:ring-[#00E5FF]/30'
                    : 'hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-black text-white ${
                    active
                      ? 'bg-gradient-to-br from-[#008CFF] to-[#7C3CFF]'
                      : 'bg-[#0C1427] text-[#00E5FF] ring-1 ring-[#00E5FF]/25'
                  }`}>
                    {initials(c.lead_name)}
                  </div>
                </div>
                {/* Conteúdo */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inbox-contact-name truncate text-[13px] font-bold text-foreground">
                      {c.lead_name ?? 'Contato'}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {timeLabel(c.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] text-muted-foreground">{lastMsg}</span>
                    <span className="flex shrink-0 items-center gap-1 text-[10px] font-semibold">
                      {human ? (
                        <span className="flex items-center gap-0.5 text-purple-300">
                          <User className="h-3 w-3" /> humano
                        </span>
                      ) : c.lead_status === 'NOT_INTERESTED' || c.lead_status === 'OPT_OUT' ? (
                        <span className="flex items-center gap-0.5 text-[#64748B]">
                          <CheckCircle2 className="h-3 w-3" />
                        </span>
                      ) : (
                        <span className="flex items-center gap-0.5 text-[#00E5FF]">
                          <Bot className="h-3 w-3" /> IA
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
