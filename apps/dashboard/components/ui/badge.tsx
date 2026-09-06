import * as React from 'react';

type BadgeTone =
  | 'zinc'
  | 'emerald'
  | 'amber'
  | 'blue'
  | 'red'
  | 'sky'
  | 'violet'
  | 'whatsapp'
  | 'brand';

const TONE_CLASSES: Record<BadgeTone, string> = {
  zinc: 'bg-[#080D18] text-[#A8B3C7] border border-[rgba(0,153,255,0.2)]',
  emerald: 'bg-[#00E5A0]/15 text-[#00E5A0] border border-[#00E5A0]/35 shadow-[0_0_10px_rgba(0,229,160,0.15)]',
  amber: 'bg-[#FFB020]/15 text-[#FFB020] border border-[#FFB020]/35 shadow-[0_0_10px_rgba(255,176,32,0.15)]',
  blue: 'bg-[#008CFF]/15 text-[#00E5FF] border border-[#008CFF]/35 shadow-[0_0_10px_rgba(0,140,255,0.15)]',
  sky: 'bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/35 shadow-[0_0_10px_rgba(0,229,255,0.15)]',
  red: 'bg-[#FF3366]/15 text-[#FF3366] border border-[#FF3366]/35 shadow-[0_0_10px_rgba(255,51,102,0.15)]',
  violet: 'bg-[#7C3CFF]/15 text-[#C084FC] border border-[#7C3CFF]/35 shadow-[0_0_10px_rgba(124,60,255,0.15)]',
  whatsapp: 'bg-[#00E5A0]/15 text-[#00E5A0] border border-[#00E5A0]/35 shadow-[0_0_10px_rgba(0,229,160,0.15)]',
  brand: 'bg-[#008CFF]/15 text-[#00E5FF] border border-[#008CFF]/35 shadow-[0_0_10px_rgba(0,140,255,0.15)]',
};

export function Badge({ tone = 'zinc', children, className = '' }: { tone?: BadgeTone; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${TONE_CLASSES[tone]} ${className}`}>
      {children}
    </span>
  );
}


const LEAD_STATUS_TONE: Record<string, BadgeTone> = {
  PENDING: 'amber',
  PROCESSING: 'blue',
  SENT: 'emerald',
  RESPONDED: 'sky',
  AGENT_ACTIVE: 'violet',
  INTERESTED: 'brand',
  NOT_INTERESTED: 'red',
  OPT_OUT: 'zinc',
  ERROR: 'red',
};

const LEAD_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  PROCESSING: 'Processando',
  SENT: 'Enviado',
  RESPONDED: 'Respondeu',
  AGENT_ACTIVE: 'Em atendimento',
  INTERESTED: 'Interessado',
  NOT_INTERESTED: 'Não interessado',
  OPT_OUT: 'Opt-out',
  ERROR: 'Erro',
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={LEAD_STATUS_TONE[status] ?? 'zinc'}>{LEAD_STATUS_LABEL[status] ?? status}</Badge>;
}
