'use client';

import { useEffect } from 'react';
import { ChunkErrorBoundary, registerChunkErrorListener } from '@/components/chunk-error-boundary';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunkError =
    error.name === 'ChunkLoadError' ||
    /loading chunk \d+ failed|failed to fetch dynamically imported module|loading css chunk/i.test(
      error.message ?? ''
    );

  useEffect(() => {
    registerChunkErrorListener();
  }, []);

  const handleReload = () => {
    try {
      window.sessionStorage.setItem('savyron:chunk-retry', '99');
    } catch {
      /* armazenamento indisponível — ignora */
    }
    window.location.reload();
  };

  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="min-h-screen bg-[#020409] font-sans antialiased text-slate-100">
        <ChunkErrorBoundary>
          <div className="flex min-h-screen items-center justify-center p-6">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#080D18]/90 p-8 text-center backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.8)]">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#008CFF]/30 bg-[#008CFF]/15 text-xl font-bold text-[#00E5FF] shadow-[0_0_15px_rgba(0,140,255,0.2)]">
                !
              </div>
              <h1 className="text-xl font-extrabold text-white">
                {isChunkError ? 'Atualização do Sistema' : 'Algo Deu Errado'}
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                {isChunkError
                  ? 'Há uma nova versão do SAVYRON disponível. Recarregue para inicializar o novo build.'
                  : 'Ocorreu uma instabilidade inesperada. Tente novamente ou recarregue a página.'}
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleReload}
                  className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#008CFF] to-[#00E5FF] px-6 py-3 text-sm font-bold text-black shadow-[0_0_15px_rgba(0,140,255,0.25)] transition-all hover:brightness-110"
                >
                  Recarregar
                </button>
                {!isChunkError ? (
                  <button
                    type="button"
                    onClick={reset}
                    className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    Tentar Novamente
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </ChunkErrorBoundary>
      </body>
    </html>
  );
}
