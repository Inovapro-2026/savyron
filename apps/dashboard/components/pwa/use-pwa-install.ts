'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/* ==========================================================================
   Tipos
   ========================================================================== */

/** Evento beforeinstallprompt (não padronizado no TS). */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type PwaInstallState =
  | 'checking' // detectando standalone/manifest
  | 'installable' // beforeinstallprompt capturado (Chrome/Edge/Android)
  | 'manual' // sem prompt nativo (Safari/iOS) → "Como instalar"
  | 'installing'
  | 'installed'
  | 'unavailable'; // sem manifest/SW/https → não oferece

export type PwaInstallPlatform = 'android' | 'ios' | 'desktop';

/* ==========================================================================
   Helpers
   ========================================================================== */

function detectPlatform(): PwaInstallPlatform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ mascara como Mac, mas é touch
    (/Macintosh/.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document);
  if (isIOS) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

/** iOS standalone: display-mode não é confiável; usa heurística da Apple. */
function isStandaloneNow(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  if (window.matchMedia('(display-mode: minimal-ui)').matches) return true;
  // iOS Safari
  return Boolean(
    (window.navigator as Navigator & { standalone?: boolean }).standalone,
  );
}

/* ==========================================================================
   Hook central — toda a lógica de instalação PWA separada da UI
   ========================================================================== */

export interface UsePwaInstallResult {
  state: PwaInstallState;
  platform: PwaInstallPlatform;
  /** true quando roda dentro do app instalado (standalone). */
  isStandalone: boolean;
  install: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

/** Chave de UX apenas (dismiss) — NÃO fonte de verdade de instalação. */
export const PWA_DISMISS_KEY = 'savyron-install-dismissed';

const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

export function usePwaInstall(): UsePwaInstallResult {
  const [state, setState] = useState<PwaInstallState>('checking');
  const [platform] = useState<PwaInstallPlatform>(detectPlatform);
  const [isStandalone, setIsStandalone] = useState(false);
  // Refs (não re-render): prompt capturado + dismissed
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cancelled = false;

    const evaluate = () => {
      if (cancelled) return;
      // 1) Já rodando como app instalado → nada a oferecer.
      if (isStandaloneNow()) {
        setIsStandalone(true);
        setState('installed');
        return;
      }
      // 2) Prompt capturado → instalável (Android/Chrome/Edge).
      if (deferredPromptRef.current) {
        setState('installable');
        return;
      }
      // 3) iOS/sem prompt: ainda pode instalar manualmente se PWA válido
      //    (manifest + SW + https). Sem fallback de dismissed aqui — o
      //    "Como instalar" continua disponível.
      setState('manual');
    };

    // Captura do prompt nativo (Chrome/Edge/Android).
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredPromptRef.current = event as BeforeInstallPromptEvent;
      evaluate();
    };

    // Instalação concluída (qualquer navegador).
    const onAppInstalled = () => {
      deferredPromptRef.current = null;
      setIsStandalone(true);
      setState('installed');
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    // Detecção inicial: standalone pode já ser true (reabertura do app).
    if (isStandaloneNow()) {
      setIsStandalone(true);
      setState('installed');
    } else {
      // Dá um microtempo para o beforeinstallprompt chegar antes de cair em manual.
      const t = window.setTimeout(evaluate, 250);
      return () => {
        cancelled = true;
        window.clearTimeout(t);
        window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
        window.removeEventListener('appinstalled', onAppInstalled);
      };
    }

    return () => {
      cancelled = true;
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  // display-mode muda ao instalar e reabrir (desktop) — reage em tempo real.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(display-mode: standalone)');
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsStandalone(true);
        setState('installed');
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const install = useCallback(
    async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
      const prompt = deferredPromptRef.current;
      if (!prompt) return 'unavailable';
      setState('installing');
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        deferredPromptRef.current = null;
        if (choice.outcome === 'accepted') {
          setIsStandalone(true);
          setState('installed');
          return 'accepted';
        }
        setState('installable');
        return 'dismissed';
      } catch {
        deferredPromptRef.current = null;
        setState('manual');
        return 'unavailable';
      }
    },
    [],
  );

  return { state, platform, isStandalone, install };
}
