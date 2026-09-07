'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { Check, CheckCheck, Bot, User, Handshake } from 'lucide-react';

export interface ChatMessage {
  id: string;
  channel: 'WHATSAPP' | 'EMAIL';
  direction: 'IN' | 'OUT';
  content: string;
  status: string;
  created_at: string;
  /** Origem do envio: 'ai' = IA SAVYRON, 'MANUAL' = atendente humano, restante = sistema/campanha. */
  provider?: string | null;
  external_id?: string | null;
  /** Nome do remetente (lead) para o avatar na entrada. */
  sender_name?: string | null;
  /** Evento de sistema (transferência humana, encerramento...) — NÃO é mensagem real. */
  system_event?: 'human_handoff_requested' | 'conversation_closed' | null;
}

/** Formata data ISO para HH:MM. */
function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** Verifica se a string contém uma imagem (data URI ou URL markdown). */
function extractImage(content: string): { text: string; image?: string } {
  if (!content) return { text: '' };
  const match = content.match(/!\[.*?\]\(((?:data:image\/[^)]+)|(?:https?:\/\/[^\s)]+)|\/(?:api\/[^\s)]+))\)/i);
  if (match) {
    return {
      text: content.replace(/!\[.*?\]\(((?:data:image\/[^)]+)|(?:https?:\/\/[^\s)]+)|\/(?:api\/[^\s)]+))\)/i, '').trim(),
      image: match[1],
    };
  }
  if (content.startsWith('data:image/')) return { text: '', image: content };
  return { text: content };
}

/** Separa as mensagens por data (HOJE / ONTEM / dd/mm). */
export function groupByDate<T extends { created_at: string }>(messages: T[]): Array<{ label: string; messages: T[] }> {
  const groups: Array<{ label: string; messages: T[] }> = [];
  let lastKey = '';
  for (const m of messages) {
    const d = new Date(m.created_at);
    if (Number.isNaN(d.getTime())) {
      const g = groups[groups.length - 1];
      if (!g || g.messages.length === 0) groups.push({ label: '', messages: [m] });
      else g.messages.push(m);
      continue;
    }
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const key = d.toDateString();
    const label =
      d.toDateString() === today.toDateString()
        ? 'Hoje'
        : d.toDateString() === yesterday.toDateString()
          ? 'Ontem'
          : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    if (key !== lastKey) {
      groups.push({ label, messages: [m] });
      lastKey = key;
    } else {
      groups[groups.length - 1].messages.push(m);
    }
  }
  return groups;
}

const bubbleMotion = {
  initial: { opacity: 0, y: 8, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { duration: 0.22, ease: 'easeOut' as const },
};

function SenderAvatar({ kind, name }: { kind: 'in' | 'ai' | 'human'; name: string }) {
  if (kind === 'in') {
    return (
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#008CFF] to-[#7C3CFF] text-[10px] font-black text-white shadow-[0_0_8px_rgba(0,140,255,0.3)]">
        {name.slice(0, 1).toUpperCase()}
      </div>
    );
  }
  if (kind === 'human') {
    return (
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#00E5FF]/20 text-[#00E5FF] ring-1 ring-[#00E5FF]/40">
        <User className="h-3 w-3" />
      </div>
    );
  }
  return (
    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#7C3CFF]/25 text-[#C084FC] ring-1 ring-[#7C3CFF]/40">
      <Bot className="h-3 w-3" />
    </div>
  );
}

/**
 * Bolha de mensagem profissional (central de atendimento).
 * - Cliente (IN):  branco/cinza, avatar, à esquerda.
 * - IA SAVYRON (OUT/ai): detalhe violeta/cyan, à direita, sem avatar.
 * - Atendente (OUT/MANUAL): azul/cyan destacado, à direita, sem avatar.
 * - Sistema (campanha/OUT): verde claro, texto branco, à direita.
 * - Evento de sistema (transferência/encerramento): cartão centralizado.
 */
export const MessageBubble = memo(function MessageBubble({ message: m }: { message: ChatMessage }) {
  const isOut = m.direction === 'OUT';
  const isAI = isOut && m.provider === 'ai';
  const isHuman = isOut && m.provider === 'MANUAL';
  const isSystemOut = isOut && !isAI && !isHuman;
  const isEvent = m.system_event != null;

  const { text, image } = extractImage(m.content);

  // Evento de sistema (transferência humana / encerramento)
  if (isEvent) {
    const title = m.system_event === 'human_handoff_requested' ? 'Atendimento humano solicitado' : 'Conversa encerrada';
    const icon = m.system_event === 'human_handoff_requested' ? <Handshake className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />;
    return (
      <motion.div {...bubbleMotion} className="flex justify-center">
        <div className="max-w-[88%] rounded-full border border-[#7C3CFF]/30 bg-[#7C3CFF]/10 px-3.5 py-1.5 text-center shadow-[0_0_12px_rgba(124,60,255,0.12)]">
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#C084FC]">
            {icon}
            {title}
          </div>
          <div className="mt-0.5 text-[10px] text-[#A8B3C7]">{formatTime(m.created_at)}</div>
        </div>
      </motion.div>
    );
  }

  const bubbleClass = isOut
    ? isAI
      ? 'bg-[#1A1036] dark:bg-[#1A1036] rounded-br-sm ring-1 ring-[#7C3CFF]/30'
      : isHuman
        ? 'bg-[#042A4A] dark:bg-[#042A4A] rounded-br-sm ring-1 ring-[#00E5FF]/30'
        : 'bg-[#D9FDD3] dark:bg-emerald-900/80 rounded-br-sm'
    : 'bg-white dark:bg-[#0C1427] rounded-bl-sm border border-gray-100 dark:border-white/10';

  const textClass = isOut
    ? isAI || isHuman
      ? 'text-white'
      : 'text-gray-900 dark:text-white'
    : 'text-gray-900 dark:text-white';

  return (
    <motion.div
      {...bubbleMotion}
      layout="position"
      className={`flex ${isOut ? 'justify-end' : 'justify-start'} gap-1.5`}
    >
      {!isOut ? <SenderAvatar kind="in" name={m.sender_name ?? 'Lead'} /> : null}
      <div className={`relative max-w-[78%] px-3 py-2 shadow-sm sm:max-w-[65%] ${bubbleClass}`}>
        {image ? (
          <div className="mb-1.5 overflow-hidden rounded-lg bg-black/20">
            <img
              src={image}
              alt="Imagem"
              className="max-h-72 w-full rounded-lg object-contain cursor-pointer transition-opacity hover:opacity-90"
              loading="lazy"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.open(image, '_blank');
                }
              }}
            />
          </div>
        ) : null}

        {text ? (
          <div className={`whitespace-pre-wrap break-words text-sm leading-relaxed ${textClass}`}>{text}</div>
        ) : null}

        <div className={`mt-1 flex items-center justify-end gap-1 ${
          isOut ? (isAI || isHuman ? 'text-white/70' : 'text-gray-400 dark:text-[#64748B]') : 'text-gray-400 dark:text-[#64748B]'
        }`}>
          <span className="text-[11px] leading-none">{formatTime(m.created_at)}</span>
          {isOut && m.status === 'SENT' && <Check className="h-3.5 w-3.5" />}
          {isOut && m.status === 'DELIVERED' && <CheckCheck className="h-3.5 w-3.5" />}
          {isOut && m.status === 'READ' && <CheckCheck className="h-3.5 w-3.5 text-blue-500" />}
        </div>
      </div>
    </motion.div>
  );
});

/** Nome do remetente para exibição como rótulo acima da bolha (opcional). */
export interface DisplaySender {
  id: string;
  name: string;
  kind: 'in' | 'ai' | 'human' | 'system';
}