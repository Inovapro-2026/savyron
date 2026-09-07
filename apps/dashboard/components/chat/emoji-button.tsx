'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { Smile } from 'lucide-react';
import dynamic from 'next/dynamic';

const Picker = dynamic(() => import('@emoji-mart/react').then((m) => m.default), {
  ssr: false,
  loading: () => <div className="h-80 w-72 animate-pulse rounded-2xl bg-white/5" />,
});

// Dados de emojis — passados explicitamente (tema/locale pt)
const dataPromise = import('@emoji-mart/data');

interface EmojiPickerButtonProps {
  onSelect: (emoji: string) => void;
  disabled?: boolean;
}

/**
 * Botão de emoji com picker flutuante (lazy-loaded).
 * Funciona em desktop e mobile — fecha ao clicar fora.
 */
export function EmojiPickerButton({ onSelect, disabled = false }: EmojiPickerButtonProps) {
  const [open, setOpen] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [data, setData] = useState<any>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Carrega a base de emojis (lazy)
  useEffect(() => {
    let active = true;
    const load = async () => {
      const mod = await dataPromise;
      if (active) setData(mod.default ?? mod);
    };
    void load();
    return () => { active = false; };
  }, []);

  // Segue o tema do app (dark/light)
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.getAttribute('data-theme') !== 'light');
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  const handleSelect = useCallback(
    (data: { native: string }) => {
      onSelect(data.native);
      setOpen(false);
    },
    [onSelect],
  );

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Fecha com Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-label="Inserir emoji"
        title="Emoji"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#A8B3C7] transition-all hover:border-[#00E5FF]/40 hover:bg-[#0C1427] hover:text-[#00E5FF] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed dark:border-white/10 dark:bg-white/5 dark:text-[#A8B3C7]"
      >
        <Smile className="h-5 w-5" />
      </button>

      {open ? (
        <div className="absolute bottom-full left-0 z-50 mb-2 -translate-x-1/4 sm:translate-x-0">
          {data ? (
            <Picker
              data={data}
              onEmojiSelect={handleSelect}
              theme={isDark ? 'dark' : 'light'}
              locale="pt"
              previewPosition="none"
              skinTonePosition="search"
              maxFrequentRows={2}
              perLine={9}
            />
          ) : (
            <div className="h-80 w-72 animate-pulse rounded-2xl bg-white/5" />
          )}
        </div>
      ) : null}
    </div>
  );
}
