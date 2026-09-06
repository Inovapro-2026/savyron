export function Progress({
  value,
  max = 100,
  tone = 'gradient',
  className = '',
}: {
  value: number;
  max?: number;
  tone?: 'emerald' | 'red' | 'whatsapp' | 'brand' | 'gradient';
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const fillColor =
    tone === 'gradient'
      ? 'bg-gradient-to-r from-[#008CFF] via-[#00E5FF] to-[#146BFF] shadow-[0_0_12px_rgba(0,229,255,0.6)]'
      : tone === 'brand'
      ? 'bg-gradient-to-r from-[#008CFF] to-[#00E5FF] shadow-[0_0_12px_rgba(0,140,255,0.6)]'
      : tone === 'whatsapp' || tone === 'emerald'
      ? 'bg-gradient-to-r from-[#00E5A0] to-[#00FFB2] shadow-[0_0_12px_rgba(0,229,160,0.6)]'
      : tone === 'red'
      ? 'bg-gradient-to-r from-[#FF3366] to-[#FF2BD6] shadow-[0_0_12px_rgba(255,51,102,0.6)]'
      : pct >= 100
      ? 'bg-gradient-to-r from-[#FF3366] to-[#FF2BD6] shadow-[0_0_12px_rgba(255,51,102,0.6)]'
      : 'bg-gradient-to-r from-[#00E5A0] to-[#00FFB2] shadow-[0_0_12px_rgba(0,229,160,0.6)]';

  return (
    <div className={`h-2.5 w-full rounded-full bg-[#050914] border border-[rgba(0,153,255,0.22)] overflow-hidden shadow-[inset_0_1px_4px_rgba(0,0,0,0.8)] ${className}`}>
      <div
        className={`h-full rounded-full ${fillColor} transition-all duration-500 ease-out`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

