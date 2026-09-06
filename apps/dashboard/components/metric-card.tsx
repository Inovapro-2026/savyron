'use client';

import { LucideIcon } from 'lucide-react';

export type MetricTone = 'blue' | 'amber' | 'emerald' | 'purple' | 'cyan' | 'red' | 'brand' | 'zinc' | 'whatsapp';

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone?: MetricTone;
  badge?: string;
  hint?: string;
  className?: string;
}

interface ToneConfig {
  border: string;
  borderHover: string;
  glow: string;
  cornerGlow: string;
  iconBg: string;
  iconColor: string;
  iconBorder: string;
  iconGlow: string;
  sparklineColor: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  badgeGlow: string;
}

const TONE_CONFIGS: Record<MetricTone, ToneConfig> = {
  blue: {
    border: 'border-[rgba(0,140,255,0.45)]',
    borderHover: 'hover:border-[rgba(0,229,255,0.8)]',
    glow: 'shadow-[0_0_15px_rgba(0,140,255,0.08)] hover:shadow-[0_0_22px_rgba(0,140,255,0.22)]',
    cornerGlow: '[background:radial-gradient(circle_at_90%_10%,rgba(0,140,255,0.10),transparent_45%)]',
    iconBg: 'bg-[rgba(0,140,255,0.12)]',
    iconColor: 'text-[#00E5FF]',
    iconBorder: 'border-[rgba(0,140,255,0.4)]',
    iconGlow: 'shadow-[0_0_15px_rgba(0,140,255,0.18)]',
    sparklineColor: '#008CFF',
    badgeBg: 'bg-[rgba(0,140,255,0.14)]',
    badgeText: 'text-[#00E5FF]',
    badgeBorder: 'border-[rgba(0,140,255,0.3)]',
    badgeGlow: 'shadow-[0_0_10px_rgba(0,140,255,0.12)]',
  },
  amber: {
    border: 'border-[rgba(255,176,32,0.45)]',
    borderHover: 'hover:border-[rgba(255,200,64,0.8)]',
    glow: 'shadow-[0_0_15px_rgba(255,176,32,0.08)] hover:shadow-[0_0_22px_rgba(255,176,32,0.22)]',
    cornerGlow: '[background:radial-gradient(circle_at_90%_10%,rgba(255,176,32,0.10),transparent_45%)]',
    iconBg: 'bg-[rgba(255,176,32,0.12)]',
    iconColor: 'text-[#FFB020]',
    iconBorder: 'border-[rgba(255,176,32,0.4)]',
    iconGlow: 'shadow-[0_0_15px_rgba(255,176,32,0.18)]',
    sparklineColor: '#FFB020',
    badgeBg: 'bg-[rgba(255,176,32,0.14)]',
    badgeText: 'text-[#FFB020]',
    badgeBorder: 'border-[rgba(255,176,32,0.3)]',
    badgeGlow: 'shadow-[0_0_10px_rgba(255,176,32,0.12)]',
  },
  emerald: {
    border: 'border-[rgba(0,229,160,0.45)]',
    borderHover: 'hover:border-[rgba(0,255,178,0.8)]',
    glow: 'shadow-[0_0_15px_rgba(0,229,160,0.08)] hover:shadow-[0_0_22px_rgba(0,229,160,0.22)]',
    cornerGlow: '[background:radial-gradient(circle_at_90%_10%,rgba(0,229,160,0.10),transparent_45%)]',
    iconBg: 'bg-[rgba(0,229,160,0.12)]',
    iconColor: 'text-[#00E5A0]',
    iconBorder: 'border-[rgba(0,229,160,0.4)]',
    iconGlow: 'shadow-[0_0_15px_rgba(0,229,160,0.18)]',
    sparklineColor: '#00E5A0',
    badgeBg: 'bg-[rgba(0,229,160,0.14)]',
    badgeText: 'text-[#00E5A0]',
    badgeBorder: 'border-[rgba(0,229,160,0.3)]',
    badgeGlow: 'shadow-[0_0_10px_rgba(0,229,160,0.12)]',
  },
  purple: {
    border: 'border-[rgba(124,60,255,0.45)]',
    borderHover: 'hover:border-[rgba(168,85,247,0.8)]',
    glow: 'shadow-[0_0_15px_rgba(124,60,255,0.08)] hover:shadow-[0_0_22px_rgba(124,60,255,0.22)]',
    cornerGlow: '[background:radial-gradient(circle_at_90%_10%,rgba(124,60,255,0.10),transparent_45%)]',
    iconBg: 'bg-[rgba(124,60,255,0.12)]',
    iconColor: 'text-[#C084FC]',
    iconBorder: 'border-[rgba(124,60,255,0.4)]',
    iconGlow: 'shadow-[0_0_15px_rgba(124,60,255,0.18)]',
    sparklineColor: '#7C3CFF',
    badgeBg: 'bg-[rgba(124,60,255,0.14)]',
    badgeText: 'text-[#C084FC]',
    badgeBorder: 'border-[rgba(124,60,255,0.3)]',
    badgeGlow: 'shadow-[0_0_10px_rgba(124,60,255,0.12)]',
  },
  cyan: {
    border: 'border-[rgba(0,229,255,0.45)]',
    borderHover: 'hover:border-[rgba(56,189,248,0.8)]',
    glow: 'shadow-[0_0_15px_rgba(0,229,255,0.08)] hover:shadow-[0_0_22px_rgba(0,229,255,0.22)]',
    cornerGlow: '[background:radial-gradient(circle_at_90%_10%,rgba(0,229,255,0.10),transparent_45%)]',
    iconBg: 'bg-[rgba(0,229,255,0.12)]',
    iconColor: 'text-[#00E5FF]',
    iconBorder: 'border-[rgba(0,229,255,0.4)]',
    iconGlow: 'shadow-[0_0_15px_rgba(0,229,255,0.18)]',
    sparklineColor: '#00E5FF',
    badgeBg: 'bg-[rgba(0,229,255,0.14)]',
    badgeText: 'text-[#00E5FF]',
    badgeBorder: 'border-[rgba(0,229,255,0.3)]',
    badgeGlow: 'shadow-[0_0_10px_rgba(0,229,255,0.12)]',
  },
  red: {
    border: 'border-[rgba(255,51,102,0.45)]',
    borderHover: 'hover:border-[rgba(255,43,214,0.8)]',
    glow: 'shadow-[0_0_15px_rgba(255,51,102,0.08)] hover:shadow-[0_0_22px_rgba(255,51,102,0.22)]',
    cornerGlow: '[background:radial-gradient(circle_at_90%_10%,rgba(255,51,102,0.10),transparent_45%)]',
    iconBg: 'bg-[rgba(255,51,102,0.12)]',
    iconColor: 'text-[#FF3366]',
    iconBorder: 'border-[rgba(255,51,102,0.4)]',
    iconGlow: 'shadow-[0_0_15px_rgba(255,51,102,0.18)]',
    sparklineColor: '#FF3366',
    badgeBg: 'bg-[rgba(255,51,102,0.14)]',
    badgeText: 'text-[#FF3366]',
    badgeBorder: 'border-[rgba(255,51,102,0.3)]',
    badgeGlow: 'shadow-[0_0_10px_rgba(255,51,102,0.12)]',
  },
  brand: {
    border: 'border-[rgba(0,140,255,0.45)]',
    borderHover: 'hover:border-[rgba(0,229,255,0.8)]',
    glow: 'shadow-[0_0_15px_rgba(0,140,255,0.08)] hover:shadow-[0_0_22px_rgba(0,140,255,0.22)]',
    cornerGlow: '[background:radial-gradient(circle_at_90%_10%,rgba(0,140,255,0.10),transparent_45%)]',
    iconBg: 'bg-[rgba(0,140,255,0.12)]',
    iconColor: 'text-[#00E5FF]',
    iconBorder: 'border-[rgba(0,140,255,0.4)]',
    iconGlow: 'shadow-[0_0_15px_rgba(0,140,255,0.18)]',
    sparklineColor: '#008CFF',
    badgeBg: 'bg-[rgba(0,140,255,0.14)]',
    badgeText: 'text-[#00E5FF]',
    badgeBorder: 'border-[rgba(0,140,255,0.3)]',
    badgeGlow: 'shadow-[0_0_10px_rgba(0,140,255,0.12)]',
  },
  whatsapp: {
    border: 'border-[rgba(0,229,160,0.45)]',
    borderHover: 'hover:border-[rgba(0,255,178,0.8)]',
    glow: 'shadow-[0_0_15px_rgba(0,229,160,0.08)] hover:shadow-[0_0_22px_rgba(0,229,160,0.22)]',
    cornerGlow: '[background:radial-gradient(circle_at_90%_10%,rgba(0,229,160,0.10),transparent_45%)]',
    iconBg: 'bg-[rgba(0,229,160,0.12)]',
    iconColor: 'text-[#00E5A0]',
    iconBorder: 'border-[rgba(0,229,160,0.4)]',
    iconGlow: 'shadow-[0_0_15px_rgba(0,229,160,0.18)]',
    sparklineColor: '#00E5A0',
    badgeBg: 'bg-[rgba(0,229,160,0.14)]',
    badgeText: 'text-[#00E5A0]',
    badgeBorder: 'border-[rgba(0,229,160,0.3)]',
    badgeGlow: 'shadow-[0_0_10px_rgba(0,229,160,0.12)]',
  },
  zinc: {
    border: 'border-[rgba(100,116,139,0.45)]',
    borderHover: 'hover:border-[rgba(148,163,184,0.8)]',
    glow: 'shadow-[0_0_15px_rgba(100,116,139,0.08)] hover:shadow-[0_0_22px_rgba(100,116,139,0.22)]',
    cornerGlow: '[background:radial-gradient(circle_at_90%_10%,rgba(100,116,139,0.08),transparent_45%)]',
    iconBg: 'bg-[rgba(100,116,139,0.12)]',
    iconColor: 'text-[#A8B3C7]',
    iconBorder: 'border-[rgba(100,116,139,0.4)]',
    iconGlow: 'shadow-[0_0_15px_rgba(100,116,139,0.18)]',
    sparklineColor: '#64748B',
    badgeBg: 'bg-[rgba(100,116,139,0.14)]',
    badgeText: 'text-[#A8B3C7]',
    badgeBorder: 'border-[rgba(100,116,139,0.3)]',
    badgeGlow: 'shadow-[0_0_10px_rgba(100,116,139,0.12)]',
  },
};

export function MetricCard({
  icon: Icon,
  label,
  value,
  tone = 'brand',
  badge,
  hint,
  className = '',
}: MetricCardProps) {
  const config = TONE_CONFIGS[tone] ?? TONE_CONFIGS.brand;

  return (
    <div
      className={`relative flex min-h-[150px] flex-col overflow-hidden rounded-2xl border p-[18px] box-border transition-all duration-200 ease-out hover:-translate-y-0.5 [background:linear-gradient(145deg,rgba(10,18,32,0.95),rgba(3,7,15,0.98))] ${config.border} ${config.borderHover} ${config.glow} ${className}`}
    >
      {/* Glow radial discreto no canto superior direito (cor do KPI) */}
      <div aria-hidden="true" className={`pointer-events-none absolute inset-0 ${config.cornerGlow}`} />

      {/* Header: ícone neon + micro sparkline decorativa */}
      <div className="relative flex items-center justify-between">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${config.iconBg} ${config.iconColor} ${config.iconBorder} ${config.iconGlow}`}
        >
          <Icon className="h-5 w-5" />
        </div>

        {/* Micro sparkline — apenas detalhe visual */}
        <div className="h-[22px] w-[60px] opacity-70" aria-hidden="true">
          <svg viewBox="0 0 60 22" fill="none" className="h-full w-full overflow-visible">
            <path
              d="M2 16 L15 11 L28 14.5 L42 5.5 L58 2"
              stroke={config.sparklineColor}
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="58" cy="2" r="2" fill={config.sparklineColor} />
          </svg>
        </div>
      </div>

      {/* Título */}
      <div className="relative mt-3.5 overflow-hidden">
        <span className="block truncate text-[13.5px] font-medium leading-snug text-[#A8B3C7]">
          {label}
        </span>
      </div>

      {/* Valor + badge de variação */}
      <div className="relative mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-3xl font-extrabold leading-[1.1] tracking-tight text-white">
          {value}
        </span>
        {badge ? (
          <span
            className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-1 text-[11px] font-semibold leading-none ${config.badgeBg} ${config.badgeText} ${config.badgeBorder} ${config.badgeGlow}`}
          >
            {badge}
          </span>
        ) : null}
      </div>

      {/* Descrição */}
      {hint ? (
        <div className="relative mt-2 overflow-hidden text-ellipsis whitespace-nowrap text-[11.5px] font-medium text-[#64748B]">
          {hint}
        </div>
      ) : null}
    </div>
  );
}
