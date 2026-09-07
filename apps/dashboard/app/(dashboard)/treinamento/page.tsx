'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { GraduationCap, Play, Search, TriangleAlert } from 'lucide-react';
import { DashboardShell } from '@/components/layout/shell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useApi } from '@/hooks/use-api';
import { youTubeEmbedUrl } from '@prospector/utils';

interface Training {
  id: string;
  title: string;
  description: string | null;
  youtube_url: string;
  youtube_video_id: string;
  thumbnail_url: string | null;
  sort_order: number;
  created_at: string;
}

/** Skeleton da biblioteca (mesmo padrão shimmer do inbox). */
function TrainingsSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      role="status"
      aria-label="Carregando treinamentos"
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="flex flex-col gap-3 rounded-2xl border border-[#E6E8F0] bg-white p-3 shadow-[0_4px_20px_rgba(15,23,42,0.04)] dark:border-[rgba(0,153,255,0.18)] dark:bg-[#080D18]/80"
        >
          <div className="inbox-shimmer aspect-video w-full rounded-xl" />
          <div className="inbox-shimmer h-4 w-3/4 rounded-md" />
          <div className="inbox-shimmer h-3 w-1/2 rounded-md" />
          <div className="inbox-shimmer h-8 w-full rounded-xl" />
        </div>
      ))}
      <span className="sr-only">Carregando…</span>
    </div>
  );
}

/** Player 16:9 responsivo (embed oficial, nocookie, lazy). */
function VideoPlayer({ videoId, title }: { videoId: string; title: string }) {
  return (
    <div className="aspect-video w-full overflow-hidden rounded-xl border border-[rgba(0,153,255,0.28)] bg-black/80">
      <iframe
        src={youTubeEmbedUrl(videoId)}
        title={title}
        loading="lazy"
        className="h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}

export default function TreinamentoPage() {
  const trainings = useApi<{ trainings: Training[] }>(
    ['trainings'],
    'trainings',
    { refetchInterval: 60000 },
  );
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<Training | null>(null);

  const list = trainings.data?.trainings ?? [];
  const term = query.trim().toLowerCase();

  /** Busca local por título/descrição (catálogo pequeno). */
  const filtered = useMemo(() => {
    if (!term) return list;
    return list.filter(
      (t) =>
        t.title.toLowerCase().includes(term) ||
        (t.description ?? '').toLowerCase().includes(term),
    );
  }, [list, term]);

  return (
    <DashboardShell title="Treinamento">
      <div className="space-y-4">
        {trainings.isLoading ? (
          <TrainingsSkeleton />
        ) : trainings.isError ? (
          <Card className="py-14 text-center">
            <TriangleAlert className="mx-auto mb-3 h-10 w-10 text-[#FF3366]/50" />
            <div className="text-sm font-semibold text-[#A8B3C7]">
              Não foi possível carregar os treinamentos.
            </div>
            <Button
              size="sm"
              variant="outline"
              className="mt-4"
              onClick={() => void trainings.refetch()}
            >
              Tentar novamente
            </Button>
          </Card>
        ) : list.length === 0 ? (
          <Card className="py-16 text-center">
            <GraduationCap className="mx-auto mb-3 h-12 w-12 text-[#008CFF]/40" />
            <div className="text-base font-bold text-white">
              Nenhum treinamento disponível
            </div>
            <p className="mt-1 text-sm text-[#A8B3C7]">
              Novos conteúdos serão adicionados em breve.
            </p>
          </Card>
        ) : (
          <>
            {/* Busca */}
            <div className="relative max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pesquisar treinamento..."
                className="h-10 w-full rounded-2xl border border-white/10 bg-[#080D18]/80 pl-9 pr-3 text-sm text-white placeholder:text-[#64748B] focus:border-[#008CFF]/50 focus:outline-none focus:ring-1 focus:ring-[#008CFF]/40"
              />
            </div>

            {filtered.length === 0 ? (
              <Card className="py-12 text-center text-sm text-[#A8B3C7]">
                Nenhum treinamento encontrado para “{query}”.
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {filtered.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActive(t)}
                    className="group overflow-hidden rounded-2xl border border-[rgba(0,153,255,0.18)] bg-[#080D18]/80 text-left shadow-[0_4px_20px_rgba(0,0,0,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#008CFF]/50 hover:shadow-[0_8px_30px_rgba(0,140,255,0.25)] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]/50"
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-[#020409]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={t.thumbnail_url ?? `https://img.youtube.com/vi/${t.youtube_video_id}/hqdefault.jpg`}
                        alt={t.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#008CFF]/90 shadow-[0_0_25px_rgba(0,140,255,0.55)] transition-transform duration-200 group-hover:scale-110">
                          <Play className="ml-0.5 h-5 w-5 fill-white text-white" />
                        </span>
                      </span>
                    </div>
                    <div className="space-y-2 p-4">
                      <div className="line-clamp-1 text-sm font-bold text-white">
                        {t.title}
                      </div>
                      {t.description ? (
                        <p className="line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed text-[#A8B3C7]">
                          {t.description}
                        </p>
                      ) : (
                        <p className="min-h-[2.5rem]" />
                      )}
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#00E5FF]">
                        Assistir
                        <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-1">→</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Player dentro da plataforma — nunca abre nova aba */}
      <Modal
        open={Boolean(active)}
        onClose={() => setActive(null)}
        title={active?.title ?? ''}
      >
        {active ? (
          <div className="space-y-4">
            <VideoPlayer videoId={active.youtube_video_id} title={active.title} />
            {active.description ? (
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Descrição
                </div>
                <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-[#A8B3C7]">
                  {active.description}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      {/* Acessibilidade: link direto para a página (não abre YouTube). */}
      <Link href="/treinamento" className="sr-only">
        Treinamento SAVYRON
      </Link>
    </DashboardShell>
  );
}
