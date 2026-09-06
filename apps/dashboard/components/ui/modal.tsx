'use client';

import * as React from 'react';
import { X } from 'lucide-react';

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[rgba(0,153,255,0.28)] bg-[#050914] p-6 shadow-[0_16px_50px_rgba(0,0,0,0.8),0_0_25px_rgba(0,140,255,0.15)]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between border-b border-[rgba(0,153,255,0.15)] pb-3">
          <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
          <button onClick={onClose} className="rounded-xl p-1 text-[#A8B3C7] hover:bg-white/10 hover:text-white transition-colors" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="text-sm text-[#A8B3C7]">{children}</div>
        {footer ? <div className="mt-6 flex justify-end gap-2 border-t border-[rgba(0,153,255,0.15)] pt-4">{footer}</div> : null}
      </div>
    </div>
  );
}

