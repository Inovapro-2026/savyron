'use client';

import * as React from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  toast: (kind: ToastKind, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const toast = React.useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  const value = React.useMemo<ToastContextValue>(
    () => ({ toast, success: (m) => toast('success', m), error: (m) => toast('error', m) }),
    [toast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed left-1/2 top-4 z-[100] flex w-[92%] max-w-md -translate-x-1/2 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm backdrop-blur-md transition-all ${
              t.kind === 'success'
                ? 'border-[#00E5A0]/45 bg-[#050914]/95 text-[#00E5A0] shadow-[0_0_20px_rgba(0,229,160,0.25)]'
                : t.kind === 'error'
                  ? 'border-[#FF3366]/45 bg-[#050914]/95 text-[#FF3366] shadow-[0_0_20px_rgba(255,51,102,0.25)]'
                  : 'border-[#00E5FF]/45 bg-[#050914]/95 text-[#00E5FF] shadow-[0_0_20px_rgba(0,229,255,0.25)]'
            }`}
          >
            {t.kind === 'success' ? <CheckCircle2 className="h-4.5 w-4.5 shrink-0" /> : t.kind === 'error' ? <AlertCircle className="h-4.5 w-4.5 shrink-0" /> : <Info className="h-4.5 w-4.5 shrink-0" />}
            <span className="font-medium text-white">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast deve ser usado dentro de ToastProvider');
  return ctx;
}
