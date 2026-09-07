'use client';

import { useCallback, useEffect, useState } from 'react';
import { Smartphone, Download, CheckCircle2, HelpCircle, Loader2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  usePwaInstall,
  PWA_DISMISS_KEY,
  type PwaInstallState,
} from './use-pwa-install';
import { InstallAppDialog } from './install-app-dialog';

const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

function wasDismissed(): boolean {
  try {
    const raw = localStorage.getItem(PWA_DISMISS_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

/** CTA do card conforme estado da instalação. */
function ctaFor(state: PwaInstallState): {
  label: string;
  icon: React.ReactNode;
  disabled: boolean;
} {
  switch (state) {
    case 'installable':
      return {
        label: 'Instalar aplicativo',
        icon: <Download className="h-4 w-4" />,
        disabled: false,
      };
    case 'installing':
      return {
        label: 'Instalando...',
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
        disabled: true,
      };
    case 'installed':
      return {
        label: 'Aplicativo instalado',
        icon: <CheckCircle2 className="h-4 w-4" />,
        disabled: true,
      };
    case 'manual':
      return {
        label: 'Como instalar',
        icon: <HelpCircle className="h-4 w-4" />,
        disabled: false,
      };
    default:
      return {
        label: 'Verificando...',
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
        disabled: true,
      };
  }
}

/**
 * Card compacto de instalação do app SAVYRON (PWA real — sem APK/EXE).
 * Estados: instalável (prompt nativo), manual ("Como instalar"),
 * instalado (standalone detectado) e dismissed (localStorage UX).
 */
export function InstallAppCard({ onDismiss }: { onDismiss?: () => void }) {
  const { state, platform, install } = usePwaInstall();
  const [dismissed, setDismissed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    setDismissed(wasDismissed());
  }, []);

  const handleDismiss = useCallback(() => {
    try {
      localStorage.setItem(PWA_DISMISS_KEY, String(Date.now()));
    } catch {
      /* localStorage indisponível — só some nesta sessão */
    }
    setDismissed(true);
    onDismiss?.();
  }, [onDismiss]);

  // Já instalado: o card NÃO insiste — some da página.
  if (state === 'installed' || dismissed || state === 'unavailable') {
    return null;
  }

  const cta = ctaFor(state);
  const isManual = state === 'manual';

  const handleMainAction = () => {
    if (isManual) {
      setDialogOpen(true);
      return;
    }
    if (state === 'installable') {
      void install();
    }
  };

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-[#008CFF]/25 bg-[#080D18]/85 p-4 md:p-5 backdrop-blur-xl shadow-[0_0_24px_rgba(0,140,255,0.08)] transition-colors hover:border-[#00E5FF]/40">
        <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#00E5FF]/10 blur-2xl" />
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dispensar"
          title="Dispensar"
          className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/5 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 pr-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#00E5FF]/30 bg-[#00E5FF]/10 text-[#00E5FF] shadow-[0_0_12px_rgba(0,229,255,0.15)]">
              <Smartphone className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white tracking-tight">
                SAVYRON no seu dispositivo
              </h3>
              <p className="mt-0.5 text-xs text-[#A8B3C7] leading-snug">
                Instale o SAVYRON como aplicativo e tenha acesso rápido à sua
                operação comercial.
              </p>
            </div>
          </div>

          <Button
            onClick={handleMainAction}
            disabled={cta.disabled}
            variant={isManual ? 'outline' : 'primary'}
            className={
              isManual
                ? 'shrink-0 border-[#008CFF]/40 text-[#00E5FF] hover:bg-[#008CFF]/10 w-full sm:w-auto'
                : 'shrink-0 bg-gradient-to-r from-[#008CFF] to-[#00E5FF] text-black font-bold shadow-[0_0_15px_rgba(0,140,255,0.3)] hover:brightness-110 w-full sm:w-auto'
            }
          >
            {cta.icon}
            {cta.label}
          </Button>
        </div>
      </div>

      {dialogOpen ? (
        <InstallAppDialog platform={platform} onClose={() => setDialogOpen(false)} />
      ) : null}
    </>
  );
}
