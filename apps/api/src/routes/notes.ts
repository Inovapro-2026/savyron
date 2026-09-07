import { Router, Request, Response } from "express";
import { prisma } from "@prospector/database";
import { createLogger } from "@prospector/logger";
import { asyncHandler, ok, ApiError } from "../lib/http";
import { requireAuth, requireBusiness } from "../middleware/auth";

const logger = createLogger("api.notes");

/**
 * ANOTAÇÕES INTERNAS DA CONVERSA (CRM).
 * Nunca são mensagens do WhatsApp — contexto interno para a equipe e para a IA.
 * Isolamento multi-tenant: toda consulta filtra business_id da sessão.
 */
export const notesRouter = Router();

notesRouter.use(requireAuth, requireBusiness);

const MAX_NOTE_LENGTH = 2000;

/** GET /notes/conversation/:id — lista as anotações da conversa. */
notesRouter.get(
  "/conversation/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const businessId = req.user!.businessId!;
    const conversationId = String(req.params.id);

    // valida que a conversa pertence ao tenant
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, business_id: businessId },
      select: { id: true },
    });
    if (!conversation) throw ApiError.notFound("Conversa não encontrada");

    const notes = await prisma.conversationNote.findMany({
      where: { business_id: businessId, conversation_id: conversationId },
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        content: true,
        created_by: true,
        created_by_name: true,
        created_at: true,
        updated_at: true,
      },
    });

    return ok(res, { notes, total: notes.length });
  }),
);

/** POST /notes/conversation/:id — cria uma anotação. */
notesRouter.post(
  "/conversation/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const businessId = req.user!.businessId!;
    const userId = req.user!.sub;
    const conversationId = String(req.params.id);
    const content = String(req.body?.content ?? "").trim();

    if (!content) throw ApiError.badRequest("Informe o conteúdo da anotação");
    if (content.length > MAX_NOTE_LENGTH) {
      throw ApiError.badRequest(`Anotação muito longa (máximo ${MAX_NOTE_LENGTH} caracteres)`);
    }

    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, business_id: businessId },
      select: { id: true },
    });
    if (!conversation) throw ApiError.notFound("Conversa não encontrada");

    // Nome real do autor (fonte: banco — o JWT não carrega name).
    const author = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    const note = await prisma.conversationNote.create({
      data: {
        business_id: businessId,
        conversation_id: conversationId,
        content,
        created_by: userId,
        created_by_name: author?.name ?? null,
      },
      select: {
        id: true,
        content: true,
        created_by: true,
        created_by_name: true,
        created_at: true,
        updated_at: true,
      },
    });

    logger.info("Nota interna criada", {
      business_id: businessId,
      conversation_id: conversationId,
      note_id: note.id,
    });

    return ok(res, { note }, 201);
  }),
);

/** DELETE /notes/:id — exclui uma anotação (autor ou admin do business). */
notesRouter.delete(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const businessId = req.user!.businessId!;
    const userId = req.user!.sub;
    const id = String(req.params.id);

    const note = await prisma.conversationNote.findFirst({
      where: { id, business_id: businessId },
      select: { id: true, created_by: true },
    });
    if (!note) throw ApiError.notFound("Anotação não encontrada");

    // Somente o autor pode excluir (isolamento duplo por tenant no where acima).
    if (note.created_by !== userId) {
      throw ApiError.forbidden("Somente o autor da anotação pode excluí-la");
    }

    await prisma.conversationNote.delete({ where: { id } });

    logger.info("Nota interna excluída", {
      business_id: businessId,
      note_id: id,
    });

    return ok(res, { message: "Anotação excluída" });
  }),
);
