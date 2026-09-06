'use client';

import { motion } from 'framer-motion';
import { PhoneCall, Mail, Check } from 'lucide-react';

export interface ChatMessage {
  id: string;
  channel: 'WHATSAPP' | 'EMAIL';
  direction: 'IN' | 'OUT';
  content: string;
  status: string;
  created_at: string;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/**
 * Bolha de mensagem estilo WhatsApp/Telegram.
 * - Agente (OUT): verde escuro, entra deslizando da direita.
 * - Lead (IN):    cinza, entra deslizando da esquerda.
 */
export function MessageBubble({ message: m }: { message: ChatMessage }) {
  const isOut = m.direction === 'OUT';

  return (
    <motion.div
      initial={{ opacity: 0, x: isOut ? 28 : -28, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: 0.32, ease: 'easeOut' }}
      layout="position"
      className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm backdrop-blur-md transition-all sm:max-w-[75%] ${
          isOut
            ? 'rounded-br-sm border border-[#00E5A0]/40 bg-gradient-to-r from-emerald-950/70 to-[#0A261E]/80 text-white shadow-[0_0_18px_rgba(0,229,160,0.15)]'
            : 'rounded-bl-sm border border-white/10 bg-[#0C1427]/85 text-white shadow-sm'
        }`}
      >
        <div className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</div>
        <div className={`mt-1.5 flex items-center justify-end gap-1.5 text-[10px] ${isOut ? 'text-[#00E5A0]/90' : 'text-[#A8B3C7]'}`}>
          {m.channel === 'WHATSAPP' ? <PhoneCall className="h-3 w-3 opacity-80" /> : <Mail className="h-3 w-3 opacity-80" />}
          <span>{formatTime(m.created_at)}</span>
          {isOut && m.status === 'SENT' && <Check className="h-3 w-3 text-[#00E5A0]" />}
        </div>
      </div>
    </motion.div>
  );
}