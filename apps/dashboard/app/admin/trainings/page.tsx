"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GraduationCap, Eye, EyeOff, Pencil, Plus, Trash2, Loader2 } from "lucide-react";
import { adminApi } from "@/lib/admin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { extractYouTubeVideoId } from "@prospector/utils";

interface AdminTraining {
  id: string;
  title: string;
  description: string | null;
  youtube_url: string;
  youtube_video_id: string;
  thumbnail_url: string | null;
  is_published: boolean;
  sort_order: number;
  created_at: string;
}

interface TrainingForm {
  title: string;
  description: string;
  youtube_url: string;
  is_published: boolean;
}

interface YouTubeMetadata {
  videoId: string;
  title: string | null;
  description: string | null;
  thumbnailUrl: string;
}

const emptyForm = (): TrainingForm => ({
  title: "",
  description: "",
  youtube_url: "",
  is_published: false,
});

/** Estado do formulário + rastreio de edições manuais (não sobrescrever digitação). */
interface FormState {
  form: TrainingForm;
  /** Título/descrição vieram do YouTube e ainda não foram editados à mão. */
  titleImported: boolean;
  descriptionImported: boolean;
}

const emptyState = (): FormState => ({
  form: emptyForm(),
  titleImported: false,
  descriptionImported: false,
});

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

export default function AdminTrainingsPage() {
  const [trainings, setTrainings] = useState<AdminTraining[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [state, setState] = useState<FormState>(emptyState);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  /** Prévia de metadados do YouTube (busca automática ao colar a URL). */
  const [meta, setMeta] = useState<YouTubeMetadata | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);
  const metaSeq = useRef(0);

  const { form } = state;

  const [deleteTarget, setDeleteTarget] = useState<AdminTraining | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi<{ trainings: AdminTraining[] }>(
        "/admin/trainings",
      );
      setTrainings(data.trainings);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Falha ao carregar treinamentos",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setState(emptyState());
    setMeta(null);
    setMetaError(null);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (t: AdminTraining) => {
    setEditingId(t.id);
    setState({
      form: {
        title: t.title,
        description: t.description ?? "",
        youtube_url: t.youtube_url,
        is_published: t.is_published,
      },
      // Valores atuais já persistidos — tratados como importados até edição manual.
      titleImported: true,
      descriptionImported: Boolean(t.description),
    });
    setMeta(null);
    setMetaError(null);
    setFormError(null);
    setFormOpen(true);
  };

  /** Validação local do link (a API valida de novo). */
  const youTubeId = extractYouTubeVideoId(form.youtube_url);
  const linkInvalid = form.youtube_url.trim() !== "" && !youTubeId;

  /**
   * Busca os metadados públicos do vídeo no YouTube quando a URL muda
   * (debounce 500ms). Preenche título/descrição APENAS se o campo ainda
   * não foi editado manualmente — nunca apaga digitação do administrador.
   */
  useEffect(() => {
    if (!youTubeId) {
      setMeta(null);
      setMetaError(null);
      setMetaLoading(false);
      return;
    }
    const seq = ++metaSeq.current;
    const timer = window.setTimeout(async () => {
      setMetaLoading(true);
      setMetaError(null);
      try {
        const data = await adminApi<{ metadata: YouTubeMetadata }>(
          `/admin/trainings/metadata?url=${encodeURIComponent(form.youtube_url.trim())}`,
        );
        if (seq !== metaSeq.current) return; // resposta antiga — ignore
        const m = data.metadata;
        setMeta(m);
        if (!m.title && !m.description) {
          setMetaError("Não foi possível encontrar as informações desse vídeo.");
        }
        setState((prev) => ({
          ...prev,
          form: {
            ...prev.form,
            title:
              m.title && (!prev.form.title.trim() || prev.titleImported)
                ? m.title
                : prev.form.title,
            description:
              m.description && (!prev.form.description.trim() || prev.descriptionImported)
                ? m.description
                : prev.form.description,
          },
          titleImported: m.title ? Boolean(m.title) : prev.titleImported,
          descriptionImported: m.description ? true : prev.descriptionImported,
        }));
      } catch {
        if (seq !== metaSeq.current) return;
        setMeta(null);
        setMetaError("Não foi possível encontrar as informações desse vídeo.");
      } finally {
        if (seq === metaSeq.current) setMetaLoading(false);
      }
    }, 500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [youTubeId]);

  /** Marca edição manual — impede que a importação sobrescreva a digitação. */
  const patchForm = (patch: Partial<TrainingForm>) => {
    setState((prev) => ({
      form: { ...prev.form, ...patch },
      titleImported:
        patch.title === undefined ? prev.titleImported : false,
      descriptionImported:
        patch.description === undefined ? prev.descriptionImported : false,
    }));
  };

  const submit = async () => {
    if (!form.title.trim()) {
      setFormError("Informe o título.");
      return;
    }
    if (!youTubeId) {
      setFormError("Insira um link válido do YouTube.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        youtube_url: form.youtube_url.trim(),
        is_published: form.is_published,
      };
      if (editingId) {
        await adminApi(`/admin/trainings/${editingId}`, "PATCH", payload);
      } else {
        await adminApi("/admin/trainings", "POST", payload);
      }
      setFormOpen(false);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (t: AdminTraining) => {
    setTogglingId(t.id);
    try {
      await adminApi(`/admin/trainings/${t.id}`, "PATCH", {
        is_published: !t.is_published,
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao atualizar status");
    } finally {
      setTogglingId(null);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminApi(`/admin/trainings/${deleteTarget.id}`, "DELETE");
      setDeleteTarget(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao excluir");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-white">
            <GraduationCap className="h-5 w-5 text-[#00E5FF]" />
            Treinamentos
          </h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Vídeos de treinamento exibidos no painel dos usuários.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          Adicionar treinamento
        </Button>
      </div>

      {error ? (
        <Card className="border-[#FF3366]/40 bg-[#FF3366]/10 py-4 text-center text-sm text-[#FF8FA9]">
          {error}
          <Button
            size="sm"
            variant="outline"
            className="ml-3"
            onClick={() => void load()}
          >
            Tentar novamente
          </Button>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-xl bg-white/5"
              />
            ))}
          </div>
        ) : trainings.length === 0 ? (
          <div className="py-14 text-center">
            <GraduationCap className="mx-auto mb-3 h-10 w-10 text-[#008CFF]/40" />
            <div className="text-sm font-semibold text-white">
              Nenhum treinamento cadastrado
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Clique em “Adicionar treinamento” para cadastrar o primeiro vídeo.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3 font-semibold">Treinamento</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Criado em</th>
                  <th className="px-4 py-3 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {trainings.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-white/5 transition-colors last:border-0 hover:bg-white/[0.03]"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={
                            t.thumbnail_url ??
                            `https://img.youtube.com/vi/${t.youtube_video_id}/hqdefault.jpg`
                          }
                          alt=""
                          loading="lazy"
                          className="h-10 w-[72px] shrink-0 rounded-lg border border-white/10 object-cover"
                        />
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-white">
                            {t.title}
                          </div>
                          <div className="truncate text-xs text-slate-500">
                            {t.description || t.youtube_url}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {t.is_published ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          Publicado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-xs font-bold text-slate-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                          Rascunho
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {fmtDate(t.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => void togglePublish(t)}
                          disabled={togglingId === t.id}
                          title={t.is_published ? "Despublicar" : "Publicar"}
                          className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
                        >
                          {t.is_published ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(t)}
                          title="Editar"
                          className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(t)}
                          title="Excluir"
                          className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-[#FF3366]/15 hover:text-[#FF3366]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Formulário (criar/editar) */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? "Editar treinamento" : "Adicionar treinamento"}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={() => void submit()} loading={saving}>
              {editingId ? "Salvar alterações" : "Adicionar treinamento"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Título"
            value={form.title}
            onChange={(e) => patchForm({ title: e.target.value })}
            placeholder="Como começar no SAVYRON"
            maxLength={200}
          />
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-300">
              Descrição
            </label>
            <textarea
              value={form.description}
              onChange={(e) => patchForm({ description: e.target.value })}
              placeholder="Aprenda os primeiros passos para configurar sua conta e começar a prospectar clientes."
              rows={3}
              maxLength={2000}
              className="w-full rounded-xl border border-white/10 bg-[#050914] px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-[#008CFF]/50 focus:outline-none focus:ring-1 focus:ring-[#008CFF]/40"
            />
          </div>
          <Input
            label="URL do YouTube"
            value={form.youtube_url}
            onChange={(e) => patchForm({ youtube_url: e.target.value })}
            placeholder="https://www.youtube.com/watch?v=XXXXXXXXXXX"
            error={linkInvalid ? "Insira um link válido do YouTube." : undefined}
          />
          {youTubeId ? (
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              {metaLoading ? (
                <div className="flex h-12 w-[86px] shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                  <Loader2 className="h-4 w-4 animate-spin text-[#00E5FF]" />
                </div>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={
                    meta?.thumbnailUrl ??
                    `https://img.youtube.com/vi/${youTubeId}/hqdefault.jpg`
                  }
                  alt=""
                  loading="lazy"
                  className="h-12 w-[86px] shrink-0 rounded-lg border border-white/10 object-cover"
                />
              )}
              <div className="min-w-0 text-xs text-slate-400">
                {metaLoading ? (
                  <div className="flex items-center gap-1.5 font-semibold text-slate-300">
                    <Loader2 className="h-3 w-3 animate-spin text-[#00E5FF]" />
                    Buscando informações do vídeo...
                  </div>
                ) : metaError ? (
                  <div className="font-semibold text-[#FF8FA9]">{metaError}</div>
                ) : (
                  <>
                    <div className="truncate font-semibold text-slate-200">
                      {meta?.title ?? "Prévia da thumbnail"}
                    </div>
                    <div>
                      Video ID: {youTubeId}
                      {meta?.title && !meta?.description ? " · descrição não encontrada no vídeo (edite manualmente)" : ""}
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : null}
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={(e) => patchForm({ is_published: e.target.checked })}
              className="h-4 w-4 rounded border-white/20 bg-[#050914] accent-[#008CFF]"
            />
            Publicar imediatamente (visível para os usuários)
          </label>
          {formError ? (
            <div className="rounded-xl border border-[#FF3366]/40 bg-[#FF3366]/10 px-3 py-2 text-xs font-semibold text-[#FF8FA9]">
              {formError}
            </div>
          ) : null}
        </div>
      </Modal>

      {/* Exclusão com confirmação */}
      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Excluir treinamento"
        message={
          <>
            Tem certeza que deseja excluir este treinamento?
            {deleteTarget ? (
              <div className="mt-2 text-sm font-bold text-white">
                “{deleteTarget.title}”
              </div>
            ) : null}
            <div className="mt-1 text-xs">Esta ação não pode ser desfeita.</div>
          </>
        }
        confirmLabel="Excluir"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
