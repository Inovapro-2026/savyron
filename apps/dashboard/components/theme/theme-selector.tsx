'use client';

import * as React from 'react';
import { Moon, Sun, Check } from 'lucide-react';

import { useTheme, type Theme } from '@/components/theme/theme-provider';

const OPTIONS: Array<{
  value: Theme;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hint: string;
}> = [
  { value: 'dark', label: 'Escuro', icon: Moon, hint: 'Preto + neon (atual)' },
  { value: 'light', label: 'Claro', icon: Sun, hint: 'Branco premium' },
];

/**
 * Seletor visual de tema (segmented control) para a seção APARÊNCIA em /settings.
 * Persistência via ThemeProvider (localStorage `savyron-theme`). Apenas visual.
 */
export function ThemeSelector() {
  const { theme, mounted, setTheme } = useTheme();
  // Pré-mount: nenhum estado selecionado (igual ao SSR) — evita mismatch.
  const activeTheme = mounted ? theme : null;

  return (
    <div
      className="rounded-2xl border border-white/10 bg-[#080D18]/80 p-6 backdrop-blur-xl shadow-xl"
      data-theme-section="aparencia"
    >
      <div className="mb-5 border-b border-white/5 pb-4">
        <h2 className="text-base font-bold text-white">Aparência</h2>
        <p className="mt-0.5 text-xs text-slate-400">
          Escolha como o SAVYRON deve aparecer para você.
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label="Tema da interface"
        className="inline-flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-[#020409]/60 p-1.5"
      >
        {OPTIONS.map(({ value, label, icon: Icon, hint }) => {
          const selected = activeTheme === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setTheme(value)}
              className={`group relative flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                selected
                  ? 'bg-gradient-to-tr from-[#008CFF] to-[#00E5FF] text-white shadow-[0_0_18px_rgba(0,140,255,0.35)]'
                  : 'text-[#A8B3C7] hover:bg-white/5 hover:text-white'
              }`}
              title={hint}
            >
              <Icon className="h-4 w-4" />
              {label}
              {selected ? <Check className="h-3.5 w-3.5" /> : null}
            </button>
          );
        })}
      </div>

      {/* Preview dos dois temas */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const selected = activeTheme === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              aria-pressed={selected}
              className={`overflow-hidden rounded-xl border text-left transition-all ${
                selected
                  ? 'border-[#00E5FF]/60 shadow-[0_0_14px_rgba(0,229,255,0.25)]'
                  : 'border-white/10 opacity-70 hover:opacity-100'
              }`}
            >
              {/* mini-preview */}
              <div
                aria-hidden="true"
                className="flex h-16 items-end gap-1.5 p-2.5"
                style={{
                  background:
                    value === 'dark'
                      ? 'linear-gradient(135deg, #020409, #050914)'
                      : 'linear-gradient(135deg, #F6F8FA, #FFFFFF)',
                }}
              >
                <div
                  className="h-3 w-3 rounded-full"
                  style={{
                    background: value === 'dark' ? '#00E5FF' : '#0969DA',
                    boxShadow:
                      value === 'dark'
                        ? '0 0 8px rgba(0,229,255,0.6)'
                        : '0 1px 4px rgba(9,105,218,0.35)',
                  }}
                />
                <div
                  className="h-2.5 flex-1 rounded-sm"
                  style={{ background: value === 'dark' ? 'rgba(0,140,255,0.25)' : '#D0D7DE' }}
                />
                <div
                  className="h-2.5 w-6 rounded-sm"
                  style={{ background: value === 'dark' ? 'rgba(0,229,160,0.4)' : '#1A7F3766' }}
                />
              </div>
              <div className="flex items-center justify-between border-t border-white/10 px-3 py-2">
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
                  <Icon className="h-3 w-3" />
                  {label}
                </span>
                {selected ? (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#00E5FF]">
                    Ativo
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500">Selecionar</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
