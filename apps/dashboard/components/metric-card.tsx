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
  iconBg: string;
  iconColor: string;
  iconBorder: string;
  sparklineColor: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}

const TONE_CONFIGS: Record<MetricTone, ToneConfig> = {
  blue: {
    border: 'border-[#008CFF]/50',
    borderHover: 'hover:border-[#00E5FF]',
    glow: 'shadow-[0_0_16px_rgba(0,140,255,0.22)] hover:shadow-[0_0_24px_rgba(0,140,255,0.4)]',
    iconBg: 'bg-[#008CFF]/15',
    iconColor: 'text-[#00E5FF]',
    iconBorder: 'border-[#008CFF]/40',
    sparklineColor: '#008CFF',
    badgeBg: 'bg-[#00E5A0]/15',
    badgeText: 'text-[#00E5A0]',
    badgeBorder: 'border-[#00E5A0]/30',
  },
  amber: {
    border: 'border-[#FFB020]/50',
    borderHover: 'hover:border-[#FFC840]',
    glow: 'shadow-[0_0_16px_rgba(255,176,32,0.22)] hover:shadow-[0_0_24px_rgba(255,176,32,0.4)]',
    iconBg: 'bg-[#FFB020]/15',
    iconColor: 'text-[#FFB020]',
    iconBorder: 'border-[#FFB020]/40',
    sparklineColor: '#FFB020',
    badgeBg: 'bg-[#FFB020]/15',
    badgeText: 'text-[#FFB020]',
    badgeBorder: 'border-[#FFB020]/30',
  },
  emerald: {
    border: 'border-[#00E5A0]/50',
    borderHover: 'hover:border-[#00FFB2]',
    glow: 'shadow-[0_0_16px_rgba(0,229,160,0.22)] hover:shadow-[0_0_24px_rgba(0,229,160,0.4)]',
    iconBg: 'bg-[#00E5A0]/15',
    iconColor: 'text-[#00E5A0]',
    iconBorder: 'border-[#00E5A0]/40',
    sparklineColor: '#00E5A0',
    badgeBg: 'bg-[#00E5A0]/15',
    badgeText: 'text-[#00E5A0]',
    badgeBorder: 'border-[#00E5A0]/30',
  },
  purple: {
    border: 'border-[#7C3CFF]/50',
    borderHover: 'hover:border-[#A855F7]',
    glow: 'shadow-[0_0_16px_rgba(124,60,255,0.22)] hover:shadow-[0_0_24px_rgba(124,60,255,0.4)]',
    iconBg: 'bg-[#7C3CFF]/15',
    iconColor: 'text-[#C084FC]',
    iconBorder: 'border-[#7C3CFF]/40',
    sparklineColor: '#7C3CFF',
    badgeBg: 'bg-[#7C3CFF]/15',
    badgeText: 'text-[#C084FC]',
    badgeBorder: 'border-[#7C3CFF]/30',
  },
  cyan: {
    border: 'border-[#00E5FF]/50',
    borderHover: 'hover:border-[#38BDF8]',
    glow: 'shadow-[0_0_16px_rgba(0,229,255,0.22)] hover:shadow-[0_0_24px_rgba(0,229,255,0.4)]',
    iconBg: 'bg-[#00E5FF]/15',
    iconColor: 'text-[#00E5FF]',
    iconBorder: 'border-[#00E5FF]/40',
    sparklineColor: '#00E5FF',
    badgeBg: 'bg-[#008CFF]/15',
    badgeText: 'text-[#00E5FF]',
    badgeBorder: 'border-[#00E5FF]/30',
  },
  red: {
    border: 'border-[#FF3366]/50',
    borderHover: 'hover:border-[#FF2BD6]',
    glow: 'shadow-[0_0_16px_rgba(255,51,102,0.22)] hover:shadow-[0_0_24px_rgba(255,51,102,0.4)]',
    iconBg: 'bg-[#FF3366]/15',
    iconColor: 'text-[#FF3366]',
    iconBorder: 'border-[#FF3366]/40',
    sparklineColor: '#FF3366',
    badgeBg: 'bg-[#FF3366]/15',
    badgeText: 'text-[#FF3366]',
    badgeBorder: 'border-[#FF3366]/30',
  },
  brand: {
    border: 'border-[#008CFF]/50',
    borderHover: 'hover:border-[#00E5FF]',
    glow: 'shadow-[0_0_16px_rgba(0,140,255,0.22)] hover:shadow-[0_0_24px_rgba(0,140,255,0.4)]',
    iconBg: 'bg-[#008CFF]/15',
    iconColor: 'text-[#00E5FF]',
    iconBorder: 'border-[#008CFF]/40',
    sparklineColor: '#008CFF',
    badgeBg: 'bg-[#008CFF]/15',
    badgeText: 'text-[#00E5FF]',
    badgeBorder: 'border-[#008CFF]/30',
  },
  whatsapp: {
    border: 'border-[#00E5A0]/50',
    borderHover: 'hover:border-[#00FFB2]',
    glow: 'shadow-[0_0_16px_rgba(0,229,160,0.22)] hover:shadow-[0_0_24px_rgba(0,229,160,0.4)]',
    iconBg: 'bg-[#00E5A0]/15',
    iconColor: 'text-[#00E5A0]',
    iconBorder: 'border-[#00E5A0]/40',
    sparklineColor: '#00E5A0',
    badgeBg: 'bg-[#00E5A0]/15',
    badgeText: 'text-[#00E5A0]',
    badgeBorder: 'border-[#00E5A0]/30',
  },
  zinc: {
    border: 'border-[rgba(0,153,255,0.25)]',
    borderHover: 'hover:border-[rgba(0,229,255,0.5)]',
    glow: 'shadow-[0_0_12px_rgba(0,140,255,0.12)]',
    iconBg: 'bg-[#050914]',
    iconColor: 'text-[#A8B3C7]',
    iconBorder: 'border-[rgba(0,153,255,0.25)]',
    sparklineColor: '#64748B',
    badgeBg: 'bg-[#050914]',
    badgeText: 'text-[#A8B3C7]',
    badgeBorder: 'border-[#64748B]/30',
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
      className={`relative flex flex-col justify-between rounded-2xl border bg-[#080D18]/85 backdrop-blur-md p-4.5 transition-all duration-200 hover:-translate-y-1 ${config.border} ${config.borderHover} ${config.glow} ${className}`}
    >
      {/* Top row: Icon badge + Micro Sparkline */}
      <div className="flex items-center justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${config.iconBg} ${config.iconColor} ${config.iconBorder}`}>
          <Icon className="h-5 w-5" />
        </div>

        {/* Micro sparkline gráfico decorativo */}
        <div className="h-6 w-16 opacity-80" aria-hidden="true">
          <svg viewBox="0 0 64 24" fill="none" className="h-full w-full overflow-visible">
            <path
              d="M2 18 L16 12 L30 16 L44 6 L62 2"
              stroke={config.sparklineColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="62" cy="2" r="2.5" fill={config.sparklineColor} />
          </svg>
        </div>
      </div>

      {/* Label */}
      <div className="mt-3">
        <span className="text-xs font-semibold text-[#A8B3C7] tracking-wide">{label}</span>
      </div>

      {/* Value + Trend Badge */}
      <div className="mt-1 flex items-baseline gap-2">
        <div className="text-2xl font-black tracking-tight text-white sm:text-3xl drop-shadow-[0_0_8px_rgba(255,255,255,0.25)]">
          {value}
        </div>
        {badge ? (
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${config.badgeBg} ${config.badgeText} ${config.badgeBorder}`}
          >
            {badge}
          </span>
        ) : null}
      </div>

      {/* Bottom hint / description */}
      {hint ? (
        <div className="mt-2 text-[11px] text-[#64748B] font-medium truncate">{hint}</div>
      ) : null}
    </div>
  );
}

