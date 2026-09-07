import { Router, Request, Response } from "express";
import { prisma } from "@prospector/database";
import { createLogger } from "@prospector/logger";
import {
  extractYouTubeVideoId,
  fetchYouTubeVideoMetadata,
} from "@prospector/utils";
import { asyncHandler, ok, ApiError } from "../lib/http";
import {
  requireAuth,
  requireBusiness,
  requirePlatformRole,
  requirePlatformAdmin,
} from "../middleware/auth";

const logger = createLogger("api.trainings");

/** Campos persistidos na criação/atualização a partir do link do YouTube. */
function resolveYouTubeFields(rawUrl: unknown): {
  youtube_url: string;
  youtube_video_id: string;
  thumbnail_url: string;
} {
  const videoId = extractYouTubeVideoId(String(rawUrl ?? ""));
  if (!videoId) {
    throw ApiError.badRequest("Insira um link válido do YouTube.");
  }
  return {
    youtube_url: `https://www.youtube.com/watch?v=${videoId}`,
    youtube_video_id: videoId,
    thumbnail_url: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  };
}

/** Trim básico + limites de tamanho para título/descrição. */
function resolveTextFields(
  title: unknown,
  description: unknown,
  { requireTitle }: { requireTitle: boolean },
): { title?: string; description?: string | null } {
  const out: { title?: string; description?: string | null } = {};
  if (title !== undefined) {
    const t = String(title ?? "").trim();
    if (!t && requireTitle) throw ApiError.badRequest("Informe o título.");
    out.title = t.slice(0, 200);
  }
  if (description !== undefined) {
    const d = String(description ?? "").trim();
    out.description = d ? d.slice(0, 2000) : null;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Rotas do usuário (empresa autenticada): apenas publicados, ordenados.
// ---------------------------------------------------------------------------

export const trainingsRouter = Router();
trainingsRouter.use(requireAuth, requireBusiness);

/** GET /trainings — lista publicados (ordem manual, depois mais recente). */
trainingsRouter.get(
  "/",
  asyncHandler(async (_req: Request, res: Response) => {
    const trainings = await prisma.training.findMany({
      where: { is_published: true },
      orderBy: [{ sort_order: "asc" }, { created_at: "desc" }],
      select: {
        id: true,
        title: true,
        description: true,
        youtube_url: true,
        youtube_video_id: true,
        thumbnail_url: true,
        sort_order: true,
        created_at: true,
      },
    });
    return ok(res, { trainings });
  }),
);

/** GET /trainings/:id — detalhe (somente publicados; rascunho é 404). */
trainingsRouter.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const training = await prisma.training.findFirst({
      where: { id: String(req.params.id), is_published: true },
      select: {
        id: true,
        title: true,
        description: true,
        youtube_url: true,
        youtube_video_id: true,
        thumbnail_url: true,
        sort_order: true,
        created_at: true,
      },
    });
    if (!training) throw ApiError.notFound("Treinamento não encontrado");
    return ok(res, { training });
  }),
);

// ---------------------------------------------------------------------------
// Rotas do Admin da plataforma (dado GLOBAL — sem business_id).
// Leitura: PLATFORM_ADMIN/STAFF. Escrita: apenas PLATFORM_ADMIN.
// ---------------------------------------------------------------------------

export const adminTrainingsRouter = Router();
adminTrainingsRouter.use(requireAuth, requirePlatformRole);

/**
 * GET /admin/trainings/metadata?url=... — busca título/descrição no próprio
 * YouTube (oEmbed + página). Rota ESTÁTICA declarada antes de /:id.
 * Usado pelo formulário do admin para preencher título/descrição automaticamente.
 */
adminTrainingsRouter.get(
  "/metadata",
  requirePlatformAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const url = String(req.query.url ?? "");
    if (!extractYouTubeVideoId(url)) {
      throw ApiError.badRequest("Insira um link válido do YouTube.");
    }
    const meta = await fetchYouTubeVideoMetadata(url);
    if (!meta) {
      throw ApiError.badRequest("Insira um link válido do YouTube.");
    }
    return ok(res, { metadata: meta });
  }),
);

/** GET /admin/trainings — lista todos (inclui rascunhos) + contagem. */
adminTrainingsRouter.get(
  "/",
  asyncHandler(async (_req: Request, res: Response) => {
    const [trainings, published] = await Promise.all([
      prisma.training.findMany({
        orderBy: [{ sort_order: "asc" }, { created_at: "desc" }],
      }),
      prisma.training.count({ where: { is_published: true } }),
    ]);
    return ok(res, { trainings, total: trainings.length, published });
  }),
);

/** POST /admin/trainings — cria treinamento (PLATFORM_ADMIN). */
adminTrainingsRouter.post(
  "/",
  requirePlatformAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const yt = resolveYouTubeFields(req.body?.youtube_url);
    let text = resolveTextFields(req.body?.title, req.body?.description, {
      requireTitle: false,
    });

    // Auto-import: título/descrição ausentes → busca os metadados públicos
    // do próprio YouTube (oEmbed + página). Nunca inventa dados: o que não
    // vier do YouTube fica vazio (edição manual continua possível).
    const needTitle = !text.title?.trim();
    const needDescription = text.description === undefined || !text.description?.trim();
    if (needTitle || needDescription) {
      const meta = await fetchYouTubeVideoMetadata(yt.youtube_url).catch(() => null);
      if (meta) {
        if (needTitle && meta.title) text.title = meta.title.slice(0, 200);
        if (needDescription && meta.description) text.description = meta.description.slice(0, 2000);
      }
    }
    if (!text.title?.trim()) throw ApiError.badRequest("Informe o título.");
    // Reaplica trim/limites nos valores importados.
    text = resolveTextFields(text.title, text.description, { requireTitle: false });

    const maxOrder = await prisma.training.aggregate({
      _max: { sort_order: true },
    });
    const training = await prisma.training.create({
      data: {
        title: text.title!,
        description: text.description ?? null,
        ...yt,
        is_published: req.body?.is_published === true,
        sort_order:
          Number.isFinite(Number(req.body?.sort_order)) && req.body?.sort_order !== null
            ? Number(req.body.sort_order)
            : (maxOrder._max.sort_order ?? 0) + 1,
      },
    });

    logger.info("Treinamento criado pelo admin", {
      training_id: training.id,
      auto_title: needTitle,
      auto_description: needDescription,
      actor: req.user!.sub,
    });
    return ok(res, { training }, 201);
  }),
);

/** PATCH /admin/trainings/:id — edita (recalcula YouTube/thumbnail se o link mudar). */
adminTrainingsRouter.patch(
  "/:id",
  requirePlatformAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const existing = await prisma.training.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound("Treinamento não encontrado");

    const data: Record<string, unknown> = {};

    if (req.body?.title !== undefined || req.body?.description !== undefined) {
      const text = resolveTextFields(
        req.body?.title ?? existing.title,
        req.body?.description,
        { requireTitle: true },
      );
      if (text.title !== undefined) data.title = text.title;
      if (text.description !== undefined) data.description = text.description;
    }

    // Link alterado → recalcula Video ID + thumbnail (nunca confia nos campos prontos).
    if (req.body?.youtube_url !== undefined) {
      Object.assign(data, resolveYouTubeFields(req.body.youtube_url));

      // Trocou o vídeo e NÃO enviou título/descrição explícitos? Busca os
      // metadados do novo vídeo para os campos ausentes (valores enviados
      // explicitamente no body sempre vencem — nunca apaga edição manual).
      const missingTitle = req.body?.title === undefined;
      const missingDescription = req.body?.description === undefined;
      if (missingTitle || missingDescription) {
        const meta = await fetchYouTubeVideoMetadata(
          String(data.youtube_url),
        ).catch(() => null);
        if (meta) {
          if (missingTitle && meta.title) data.title = meta.title.slice(0, 200);
          if (missingDescription && meta.description) {
            data.description = meta.description.slice(0, 2000);
          }
        }
      }
    }

    if (req.body?.is_published !== undefined) {
      data.is_published = req.body.is_published === true;
    }
    if (req.body?.sort_order !== undefined) {
      const n = Number(req.body.sort_order);
      if (!Number.isFinite(n)) throw ApiError.badRequest("Ordem inválida.");
      data.sort_order = Math.trunc(n);
    }

    const training = await prisma.training.update({ where: { id }, data });
    logger.info("Treinamento atualizado pelo admin", {
      training_id: id,
      fields: Object.keys(data),
      actor: req.user!.sub,
    });
    return ok(res, { training });
  }),
);

/** DELETE /admin/trainings/:id — exclui (PLATFORM_ADMIN). */
adminTrainingsRouter.delete(
  "/:id",
  requirePlatformAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const existing = await prisma.training.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound("Treinamento não encontrado");

    await prisma.training.delete({ where: { id } });
    logger.warn("Treinamento excluído pelo admin", {
      training_id: id,
      title: existing.title,
      actor: req.user!.sub,
    });
    return ok(res, { deleted: true });
  }),
);
