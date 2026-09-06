'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Clock, Play, Pause, CheckCircle2, Send } from 'lucide-react';

interface NextSendCountdownProps {
  targetAt: string | null | undefined;
  status?: 'ACTIVE' | 'PAUSED' | 'FINISHED' | string;
  running?: boolean;
  variant?: 'prominent' | 'compact';
  onZero?: () => void;
}

export function NextSendCountdown({
  targetAt,
  status = 'ACTIVE',
  running,
  variant = 'prominent',
  onZero,
}: NextSendCountdownProps) {
  const isRunning = running !== undefined ? running : status === 'ACTIVE';
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeData = useMemo(() => {
    if (!targetAt) return null;
    const target = new Date(targetAt).getTime();
    if (Number.isNaN(target)) return null;

    const diff = Math.max(0, target - now);
    const totalSeconds = Math.floor(diff / 1000);

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return {
      totalSeconds,
      hours: String(hours).padStart(2, '0'),
      minutes: String(minutes).padStart(2, '0'),
      seconds: String(seconds).padStart(2, '0'),
      isZero: totalSeconds === 0,
    };
  }, [targetAt, now]);

  // Quando o contador chega a zero, dispara onZero() e continua re-disparando
  // a cada 3s enquanto next_send_at nao avancou (o worker leva alguns segundos
  // para gravar o novo valor no Redis apos processar o pump).
  useEffect(() => {
    if (!timeData?.isZero || !isRunning) return;
    if (onZero) onZero();
    const retryTimer = setInterval(() => {
      if (onZero) onZero();
    }, 3000);
    return () => clearInterval(retryTimer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeData?.isZero, isRunning]);

  // Compact variant (para listas ou tabelas)
  if (variant === 'compact') {
    if (status === 'PAUSED') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
          <Pause className="h-3 w-3" /> Campanha pausada
        </span>
      );
    }

    if (status === 'FINISHED') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-[#A8B3C7]">
          <CheckCircle2 className="h-3 w-3" /> Campanha encerrada
        </span>
      );
    }

    if (!targetAt || !timeData) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-[#A8B3C7]">
          <Clock className="h-3 w-3" /> Aguardando disparo
        </span>
      );
    }

    if (timeData.isZero) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#00E5FF]/40 bg-[#00E5FF]/10 px-3 py-1 text-xs font-bold text-[#00E5FF] shadow-[0_0_15px_rgba(0,229,255,0.25)] animate-pulse">
          <Send className="h-3 w-3" /> Disparando agora...
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-[#008CFF]/30 bg-[#080D18]/90 px-3.5 py-1 text-xs font-bold text-white shadow-[0_0_15px_rgba(0,140,255,0.15)]">
        <Clock className="h-3.5 w-3.5 text-[#00E5FF]" />
        <span className="text-[#A8B3C7]">Próximo em</span>
        <span className="font-mono tracking-wider font-black text-[#00E5FF]">
          {timeData.hours}:{timeData.minutes}:{timeData.seconds}
        </span>
      </span>
    );
  }

  // Prominent variant (para a página de detalhes da campanha)
  if (status === 'PAUSED') {
    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-950/30 via-[#080D18]/80 to-amber-950/30 p-5 shadow-[0_0_20px_rgba(255,176,32,0.15)] backdrop-blur-xl">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/20 text-amber-400 shadow-[0_0_12px_rgba(255,176,32,0.3)]">
            <Pause className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Status do Envio</div>
            <div className="text-base font-bold text-white">Campanha Pausada</div>
          </div>
        </div>
        <p className="text-xs text-[#A8B3C7] text-center sm:text-right">
          Inicie a campanha para retomar o contador e a fila de envios.
        </p>
      </div>
    );
  }

  if (status === 'FINISHED') {
    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#080D18]/80 p-5 shadow-sm backdrop-blur-xl">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[#A8B3C7]">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Status do Envio</div>
            <div className="text-base font-bold text-white">Campanha Encerrada</div>
          </div>
        </div>
        <p className="text-xs text-[#A8B3C7] text-center sm:text-right">
          Todos os disparos programados foram finalizados.
        </p>
      </div>
    );
  }

  const isSendingNow = timeData?.isZero ?? false;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-[#008CFF]/30 bg-gradient-to-br from-[#080D18]/95 via-[#0A1226]/90 to-[#080D18]/95 p-5 shadow-[0_0_35px_rgba(0,140,255,0.15)] backdrop-blur-xl transition-all">
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#00E5FF]/10 blur-2xl" />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
        {/* Header com ícone e label */}
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#00E5FF]/30 bg-[#00E5FF]/10 text-[#00E5FF] shadow-[0_0_15px_rgba(0,229,255,0.25)]">
            <Clock className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#00E5FF]">
                Próximo Envio Automático
              </span>
              <span className="flex h-2 w-2 rounded-full bg-[#00E5A0] shadow-[0_0_8px_#00E5A0] animate-ping" />
            </div>
            <div className="text-xs font-medium text-[#A8B3C7] mt-0.5">
              {isSendingNow
                ? 'Processando disparo de mensagem...'
                : timeData
                ? 'Cadência neural ativa em tempo real'
                : 'Aguardando agendamento na fila'}
            </div>
          </div>
        </div>

        {/* Display do Contador Segmentado */}
        {timeData && !isSendingNow ? (
          <div className="flex items-center justify-center gap-2">
            {/* Horas */}
            <div className="flex flex-col items-center">
              <div className="flex h-13 min-w-13 items-center justify-center rounded-2xl border border-white/10 bg-[#050914] px-3.5 shadow-inner">
                <span className="font-mono text-2xl font-black tracking-tight text-white">
                  {timeData.hours}
                </span>
              </div>
              <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-[#64748B]">HORAS</span>
            </div>

            <span className="mb-4 text-xl font-bold text-[#00E5FF] animate-pulse">:</span>

            {/* Minutos */}
            <div className="flex flex-col items-center">
              <div className="flex h-13 min-w-13 items-center justify-center rounded-2xl border border-white/10 bg-[#050914] px-3.5 shadow-inner">
                <span className="font-mono text-2xl font-black tracking-tight text-white">
                  {timeData.minutes}
                </span>
              </div>
              <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-[#64748B]">MIN</span>
            </div>

            <span className="mb-4 text-xl font-bold text-[#00E5FF] animate-pulse">:</span>

            {/* Segundos */}
            <div className="flex flex-col items-center">
              <div className="flex h-13 min-w-13 items-center justify-center rounded-2xl border border-[#00E5FF]/50 bg-gradient-to-b from-[#008CFF]/20 to-[#00E5FF]/20 px-3.5 shadow-[0_0_20px_rgba(0,229,255,0.25)] ring-1 ring-[#00E5FF]/40">
                <span className="font-mono text-2xl font-black tracking-tight text-[#00E5FF]">
                  {timeData.seconds}
                </span>
              </div>
              <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-[#00E5FF]">SEG</span>
            </div>
          </div>
        ) : isSendingNow ? (
          <div className="flex items-center gap-2.5 rounded-2xl border border-[#00E5FF]/40 bg-[#00E5FF]/10 px-5 py-3 text-[#00E5FF] shadow-[0_0_20px_rgba(0,229,255,0.25)]">
            <Send className="h-5 w-5 animate-bounce" />
            <span className="text-sm font-black tracking-wide uppercase">Enviando agora...</span>
          </div>
        ) : (
          <div className="text-center sm:text-right">
            <span className="text-sm font-mono font-bold text-[#64748B]">— : — : —</span>
            <div className="text-[11px] text-[#64748B]">fila em espera</div>
          </div>
        )}
      </div>
    </div>
  );
}
