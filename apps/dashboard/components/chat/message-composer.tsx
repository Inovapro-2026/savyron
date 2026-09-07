'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { Send, Paperclip, X, Loader2, Bot, Handshake, CheckCircle2, Crown } from 'lucide-react';
import { request } from '@/hooks/use-api';
import { useToast } from '@/components/ui/toast';
import { EmojiPickerButton } from './emoji-button';

interface MessageComposerProps {
  conversationId: string;
  /** Modo manual (humano ativo): habilita digitação. */
  disabled?: boolean;
  /** IA está atendendo automaticamente. */
  aiActive?: boolean;
  /** Houve solicitação de transferência para humano. */
  transferring?: boolean;
  /** Conversa encerrada. */
  closed?: boolean;
  placeholder?: string;
  /** Callback de "Assumir" (quando IA ativa). */
  onTakeover?: () => void;
  onSent?: () => void;
}

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_MIMES = [
  'image/jpeg',
  'image/pjpeg',
  'image/jfif',
  'image/png',
  'image/webp',
  'image/gif',
];
const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.jfif', '.png', '.webp', '.gif'];

/**
 * Composer profissional:
 * - IA ativa: painel informativo "A IA está atendendo" + botão "Assumir conversa".
 * - Transferindo: painel informativo amarelo/violeta.
 * - Conversa encerrada: painel informativo neutro.
 * - Humano ativo: textarea habilitado + emoji + anexo + enviar.
 */
export function MessageComposer({
  conversationId,
  disabled = false,
  aiActive = false,
  transferring = false,
  closed = false,
  placeholder,
  onTakeover,
  onSent,
}: MessageComposerProps) {
  const { success, error: toastError } = useToast();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<'idle' | 'uploading' | 'sending' | 'sent' | 'failed'>('idle');
  const [pendingFile, setPendingFile] = useState<{
    file: File;
    previewUrl: string;
    name: string;
    size: number;
  } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const disabled_ = disabled || sending;

  const autoGrow = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, []);

  useEffect(() => {
    if (!disabled) textareaRef.current?.focus();
  }, [disabled]);

  const removePendingFile = useCallback(() => {
    setPendingFile((current) => {
      if (current?.previewUrl) {
        URL.revokeObjectURL(current.previewUrl);
      }
      return null;
    });
    setSendStatus('idle');
  }, []);

  useEffect(() => {
    return () => {
      if (pendingFile?.previewUrl) {
        URL.revokeObjectURL(pendingFile.previewUrl);
      }
    };
  }, [pendingFile?.previewUrl]);

  const sendText = async () => {
    const content = draft.trim();
    if (!content) return;
    setSending(true);
    try {
      await request(`conversations/${conversationId}/message`, { method: 'POST', body: { content } });
      setDraft('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      onSent?.();
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Falha no envio');
    } finally {
      setSending(false);
    }
  };

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reseta o valor do input para permitir selecionar novamente o mesmo arquivo se removido
    e.target.value = '';

    const ext = (file.name || '').toLowerCase().replace(/.*(\.[a-z0-9]+)$/i, '$1');
    const isAcceptedExt = ACCEPTED_EXTENSIONS.includes(ext);
    const isAcceptedMime = file.type ? (file.type.startsWith('image/') || ACCEPTED_MIMES.includes(file.type)) : true;

    if (!isAcceptedExt && !isAcceptedMime) {
      toastError('Formato de imagem não suportado. Use JPG, PNG, WEBP ou GIF.');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      toastError('Imagem muito grande. Escolha uma imagem menor que 10MB.');
      return;
    }

    // Limpa preview anterior se existir
    if (pendingFile?.previewUrl) {
      URL.revokeObjectURL(pendingFile.previewUrl);
    }

    const previewUrl = URL.createObjectURL(file);
    setPendingFile({ file, previewUrl, name: file.name, size: file.size });
    setSendStatus('idle');
  }, [pendingFile, toastError]);

  const sendImage = async () => {
    if (!pendingFile || sending) return;
    setSending(true);
    setSendStatus('uploading');
    try {
      const formData = new FormData();
      formData.append('file', pendingFile.file);
      const caption = draft.trim();
      if (caption) {
        formData.append('caption', caption);
      }

      setSendStatus('sending');
      const res = await fetch(`/api/proxy/conversations/${conversationId}/media`, {
        method: 'POST',
        body: formData,
      });

      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: { message?: string } } | null;
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message ?? `Falha no upload (${res.status})`);
      }

      setSendStatus('sent');
      removePendingFile();
      setDraft('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      success('Imagem enviada');
      onSent?.();
    } catch (e) {
      setSendStatus('failed');
      toastError(e instanceof Error ? e.message : 'Não foi possível enviar a imagem pelo WhatsApp.');
    } finally {
      setSending(false);
      setTimeout(() => setSendStatus('idle'), 3000);
    }
  };

  // Painéis informativos conforme o estado da conversa.
  if (aiActive && !closed) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-[#7C3CFF]/25 bg-[#0C1427]/70 p-3.5 backdrop-blur-sm sm:flex-row">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#7C3CFF]/20 text-[#C084FC]">
              <Bot className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#C084FC]">A IA está atendendo automaticamente.</p>
              <p className="mt-0.5 text-[11px] text-[#A8B3C7]">
                Assuma a conversa para responder manualmente e receber as novas mensagens.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onTakeover}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#008CFF] to-[#00E5FF] px-4 py-2 text-xs font-bold text-white shadow-[0_0_15px_rgba(0,229,255,0.25)] transition-all hover:brightness-110 active:scale-95"
          >
            <Crown className="h-3.5 w-3.5" /> Assumir conversa
          </button>
        </div>
      </div>
    );
  }

  if (transferring && !closed) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-center gap-3 rounded-2xl border border-[#FFB020]/30 bg-[#FFB020]/10 p-3.5 backdrop-blur-sm">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFB020]/20 text-[#FFB020]">
            <Handshake className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-[#FFB020]">Atendimento humano solicitado</p>
            <p className="mt-0.5 text-[11px] text-[#A8B3C7]">
              O cliente pediu para falar com um atendente. Assuma a conversa quando estiver pronto.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (closed) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#0C1427]/70 p-3 text-[11px] font-semibold text-[#A8B3C7]">
          <CheckCircle2 className="h-4 w-4 text-[#00E5A0]" /> Conversa encerrada
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      {pendingFile ? (
        <div className="mb-2 flex items-center gap-3 rounded-xl border border-white/10 bg-[#0C1427]/90 p-2.5 backdrop-blur-sm">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-black/40">
            <img src={pendingFile.previewUrl} alt="Preview" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white">{pendingFile.name}</p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#64748B]">{(pendingFile.size / 1024).toFixed(0)} KB</span>
              {sendStatus === 'uploading' && <span className="text-[10px] font-medium text-[#00E5FF] animate-pulse">Enviando arquivo...</span>}
              {sendStatus === 'sending' && <span className="text-[10px] font-medium text-[#00E5FF] animate-pulse">Enviando imagem...</span>}
              {sendStatus === 'sent' && <span className="text-[10px] font-medium text-[#00E5A0]">Enviado ✓</span>}
              {sendStatus === 'failed' && <span className="text-[10px] font-medium text-[#FF3366]">Falha ao enviar</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={removePendingFile}
            disabled={sending}
            aria-label="Remover imagem"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#A8B3C7] hover:bg-white/10 hover:text-white disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        <EmojiPickerButton
          disabled={disabled_}
          onSelect={(emoji) => {
            setDraft((d) => d + emoji);
            requestAnimationFrame(autoGrow);
            textareaRef.current?.focus();
          }}
        />

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled_}
          aria-label="Anexar imagem"
          title="Anexar imagem"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#A8B3C7] transition-all hover:border-[#00E5FF]/40 hover:bg-[#0C1427] hover:text-[#00E5FF] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Paperclip className="h-5 w-5" />
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />

        <div className={`flex-1 transition-opacity duration-300 ${disabled ? 'opacity-50' : 'opacity-100'}`}>
          <textarea
            ref={textareaRef}
            value={draft}
            disabled={disabled_}
            onChange={(e) => { setDraft(e.target.value); autoGrow(); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (pendingFile) void sendImage();
                else void sendText();
              }
            }}
            placeholder={pendingFile ? 'Adicionar legenda (opcional)…' : (placeholder ?? 'Digite sua resposta…')}
            rows={1}
            aria-label="Mensagem para o cliente"
            className="min-h-[44px] w-full resize-none rounded-2xl border border-white/10 bg-[#FFFFFF] px-3 py-2.5 text-sm text-[#1F2328] placeholder-[#64748B] focus:border-[#00E5FF] focus:ring-2 focus:ring-[#00E5FF]/20 focus:outline-none disabled:cursor-not-allowed disabled:border-white/5 disabled:bg-[#F6F8FA] disabled:text-[#64748B] dark:bg-[#050914] dark:text-white dark:disabled:bg-[#03060C]"
          />
        </div>

        <button
          type="button"
          onClick={() => (pendingFile ? void sendImage() : void sendText())}
          disabled={disabled_ || (!draft.trim() && !pendingFile)}
          aria-label={pendingFile ? 'Enviar imagem' : 'Enviar mensagem'}
          title={pendingFile ? 'Enviar imagem' : 'Enviar mensagem'}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#008CFF] to-[#00E5FF] text-white shadow-[0_0_15px_rgba(0,229,255,0.3)] transition-all hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}