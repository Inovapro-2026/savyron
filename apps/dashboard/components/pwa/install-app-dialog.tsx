'use client';

import { Smartphone, Share2, MonitorSmartphone, X } from 'lucide-react';

import type { PwaInstallPlatform } from './use-pwa-install';

/**
 * Modal "Como instalar" — instruções específicas por dispositivo quando o
 * prompt nativo (beforeinstallprompt) não está disponível (ex.: iOS Safari).
 */
export function InstallAppDialog({
  platform,
  onClose,
}: {
  platform: PwaInstallPlatform;
  onClose: () => void;
}) {
  const steps: { icon: React.ReactNode; text: string }[] =
    platform === 'ios'
      ? [
          { icon: <Share2 className="h-4 w-4" />, text: 'Toque no botão Compartilhar na barra do Safari.' },
          { icon: <Smartphone className="h-4 w-4" />, text: 'Escolha "Adicionar à Tela de Início".' },
          { icon: <MonitorSmartphone className="h-4 w-4" />, text: 'Confirme tocando em "Adicionar".' },
        ]
      : platform === 'android'
        ? [
            { icon: <Smartphone className="h-4 w-4" />, text: 'Abra o menu do Chrome (⋮) no canto superior.' },
            { icon: <Smartphone className="h-4 w-4" />, text: 'Toque em "Instalar aplicativo" ou "Adicionar à tela inicial".' },
          ]
        : [
            {
              icon: <MonitorSmartphone className="h-4 w-4" />,
              text: 'Use o ícone de instalação na barra de endereço do Chrome/Edge.',
            },
            { icon: <MonitorSmartphone className="h-4 w-4" />, text: 'Confirme em "Instalar".' },
          ];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Instalar SAVYRON"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-sm p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#00E5FF]/30 bg-[#00E5FF]/10 text-[#00E5FF]">
              <Smartphone className="h-5 w-5" />
            </div>
            <h2 className="text-base font-bold text-white tracking-tight">Instalar SAVYRON</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <ol className="space-y-3">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#008CFF]/30 bg-[#008CFF]/10 text-[#00E5FF]">
                {step.icon}
              </span>
              <p className="pt-1 text-sm text-slate-300">{step.text}</p>
            </li>
          ))}
        </ol>

        <p className="mt-5 rounded-xl border border-white/5 bg-white/[0.03] p-3 text-[11px] leading-relaxed text-slate-400">
          O SAVYRON será instalado como aplicativo (PWA) e abrirá em tela cheia,
          com acesso rápido pela tela inicial do seu dispositivo.
        </p>
      </div>
    </div>
  );
}
