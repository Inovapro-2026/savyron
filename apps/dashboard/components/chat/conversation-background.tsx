'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Palette, Upload, X } from 'lucide-react';

const BG_KEY = 'acp_inbg_v1';
const OVERLAY_KEY = 'acp_inbg_overlay_v1';

/** Pattern padrão de pontilhado (estilo WhatsApp). */
const DEFAULT_PATTERN = `radial-gradient(circle, rgba(0,0,0,0.07) 1px, transparent 1px)`;
const DARK_PATTERN = `radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)`;

interface ConversationBackgroundProps {
  children: React.ReactNode;
}

/**
 * Fundo da conversa com pattern pontilhado padrão + suporte a imagem
 * customizada salva em localStorage + slider de opacidade do overlay.
 */
export function ConversationBackground({ children }: ConversationBackgroundProps) {
  const [customBg, setCustomBg] = useState<string | null>(null);
  const [overlayOpacity, setOverlayOpacity] = useState(0.85);
  const [showSettings, setShowSettings] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Detecta tema
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.getAttribute('data-theme') !== 'light');
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  // Carrega do localStorage
  useEffect(() => {
    try {
      const bg = localStorage.getItem(BG_KEY);
      const ov = localStorage.getItem(OVERLAY_KEY);
      if (bg) setCustomBg(bg);
      if (ov) setOverlayOpacity(parseFloat(ov));
    } catch { /* SSR */ }
  }, []);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) return; // 5MB max
    const reader = new FileReader();
    reader.onload = () => {
      const dataUri = reader.result as string;
      setCustomBg(dataUri);
      try { localStorage.setItem(BG_KEY, dataUri); } catch { /* quota */ }
    };
    reader.readAsDataURL(file);
  }, []);

  const clearBg = useCallback(() => {
    setCustomBg(null);
    try {
      localStorage.removeItem(BG_KEY);
    } catch { /* ignore */ }
  }, []);

  const handleOverlayChange = useCallback((v: number) => {
    setOverlayOpacity(v);
    try { localStorage.setItem(OVERLAY_KEY, String(v)); } catch { /* ignore */ }
  }, []);

  const pattern = isDark ? DARK_PATTERN : DEFAULT_PATTERN;

  return (
    <div className="relative flex-1 min-h-0 h-full w-full overflow-hidden">
      {/* Camada de fundo */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundSize: customBg ? 'cover' : '20px 20px' }}
      >
        {/* Pattern base */}
        <div className="absolute inset-0" style={{ backgroundImage: pattern, backgroundSize: '20px 20px' }} />

        {/* Imagem customizada */}
        {customBg ? (
          <>
            <img
              src={customBg}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover"
            />
            {/* Overlay escuro com opacidade ajustável */}
            <div
              className="absolute inset-0 bg-black"
              style={{ opacity: overlayOpacity }}
            />
          </>
        ) : null}
      </div>

      {/* Botão de configurações (canto inferior direito) */}
      <button
        type="button"
        onClick={() => setShowSettings((v) => !v)}
        aria-label="Personalizar fundo da conversa"
        title="Fundo da conversa"
        className="absolute bottom-4 right-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-[#0C1427]/80 text-[#A8B3C7] shadow-lg backdrop-blur-sm transition-all hover:border-[#00E5FF]/40 hover:text-[#00E5FF] active:scale-95"
      >
        <Palette className="h-4 w-4" />
      </button>

      {/* Painel de configurações do fundo */}
      {showSettings ? (
        <div className="absolute bottom-16 right-4 z-30 w-64 overflow-hidden rounded-2xl border border-white/10 bg-[#080D18]/95 p-4 shadow-2xl backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-bold text-white">Fundo da conversa</span>
            <button
              onClick={() => setShowSettings(false)}
              className="flex h-6 w-6 items-center justify-center rounded-lg text-[#A8B3C7] hover:bg-white/10 hover:text-white"
              aria-label="Fechar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Upload de imagem */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
          />
          <div className="flex gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-semibold text-[#A8B3C7] transition-colors hover:border-[#00E5FF]/40 hover:text-[#00E5FF]"
            >
              <Upload className="h-3.5 w-3.5" /> Imagem
            </button>
            {customBg ? (
              <button
                onClick={clearBg}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#FF3366]/30 bg-[#FF3366]/10 py-2 text-xs font-semibold text-[#FF3366] transition-colors hover:bg-[#FF3366]/20"
              >
                <X className="h-3.5 w-3.5" /> Remover
              </button>
            ) : null}
          </div>

          {/* Slider de opacidade do overlay */}
          {customBg ? (
            <div className="mt-3">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[#A8B3C7]">
                Opacidade do overlay
              </label>
              <input
                type="range"
                min="0.5"
                max="0.95"
                step="0.05"
                value={overlayOpacity}
                onChange={(e) => handleOverlayChange(parseFloat(e.target.value))}
                className="w-full accent-[#00E5FF]"
              />
              <div className="flex justify-between text-[10px] text-[#64748B]">
                <span>Claro</span>
                <span>Escuro</span>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Conteúdo da conversa */}
      <div className="relative z-10 flex h-full min-h-0 w-full flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
