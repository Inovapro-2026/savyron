'use client';

import { useEffect, useState } from 'react';

const BRASILIA = 'America/Sao_Paulo';

function formatBrasilia(date: Date): { time: string; date: string } {
  const time = new Intl.DateTimeFormat('pt-BR', {
    timeZone: BRASILIA,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
  const dateStr = new Intl.DateTimeFormat('pt-BR', {
    timeZone: BRASILIA,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
  return { time, date: dateStr };
}

export function BrasiliaClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const { time, date } = formatBrasilia(now);

  return (
    <div className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-[#080D18]/80 px-4 py-2.5 backdrop-blur-md shadow-sm">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00E5A0] opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#00E5A0] shadow-[0_0_8px_#00E5A0]" />
      </span>
      <div className="font-mono text-base font-black tabular-nums text-white tracking-wider">{time}</div>
      <div className="border-l border-white/10 pl-3 text-[10px] font-bold uppercase tracking-wider text-[#A8B3C7]">
        {date} <span className="text-[#00E5FF]">· Brasília</span>
      </div>
    </div>
  );
}