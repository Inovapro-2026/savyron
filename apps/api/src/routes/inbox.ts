import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '@prospector/config';
import { prisma } from '@prospector/database';
import { createLogger } from '@prospector/logger';
import { QUEUE_NAMES } from '@prospector/queues';
import { asyncHandler, ok } from '../lib/http';
import { requireAuth, requireBusiness, requireRole } from '../middleware/auth';
import { requireActiveSubscription } from '../middleware/active-subscription';
import { uploadImage } from '../middleware/upload';
import { getQueue } from '../services/queues';
import { realtimeService, buildEvent } from '../services/realtime';
import { listConversations, getConversationDetail, InboxFilter } from '../services/conversation-service';
import { deleteConversation, deleteAllConversations } from '../services/deletion-service';

const logger = createLogger('api.inbox');

/** Valida magic bytes de imagens (defesa em profundidade além do filtro multer). */
function validateImageMagicBytes(buf: Buffer, mime: string): boolean {
  if (buf.length < 12) return false;
  // JPEG e JFIF sempre começam com FF D8 FF
  if (mime.includes('jpeg') || mime.includes('pjpeg') || mime.includes('jfif') || (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)) {
    return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  }
  if (mime === 'image/png') return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  if (mime === 'image/gif') return buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46; // "GIF"
  if (mime === 'image/webp') return buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP';
  return true; // MIME desconhecido mas com extensão válida — deixa o Baileys cuidar
}

/** Middleware resiliente de upload: aceita qualquer campo ('file', 'image', 'attachment', 'media') */
const handleMediaUploadMiddleware = (req: Request, res: Response, next: NextFunction) => {
  uploadImage.any()(req, res, (err) => {
    if (err) {
      logger.error('MEDIA_UPLOAD_FAILED', {
        conversationId: req.params.id,
        error: err instanceof Error ? err.message : String(err),
      });
      const message = err instanceof Error ? err.message : 'Falha no processamento do arquivo';
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message },
      });
    }
    const files = (req.files as Express.Multer.File[]) || [];
    req.file = files.find((f) => ['file', 'image', 'attachment', 'media'].includes(f.fieldname)) || files[0];
    next();
  });
};

export const inboxRouter = Router();

inboxRouter.use(requireAuth, requireBusiness);

/** GET /conversations — lista conversas com filtros. */
inboxRouter.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const businessId = req.user!.businessId!;
    const filter = (req.query.filter as InboxFilter) || 'all';
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(100, Number(req.query.pageSize ?? 20));
    const result = await listConversations(filter, page, pageSize, businessId);
    return ok(res, result);
  })
);

/** GET /conversations/:id — detalhe com histórico completo. */
inboxRouter.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const businessId = req.user!.businessId!;
    const conversation = await getConversationDetail(String(req.params.id), businessId);
    if (!conversation) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Conversa não encontrada' } });
    return ok(res, conversation);
  })
);

/** POST /conversations/:id/takeover — humano assume o atendimento. */
inboxRouter.post(
  '/:id/takeover',
  asyncHandler(async (req: Request, res: Response) => {
    const businessId = req.user!.businessId!;
    const id = String(req.params.id);
    const conversation = await prisma.conversation.findFirst({ where: { id, business_id: businessId } });
    if (!conversation) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Conversa não encontrada' } });

    await prisma.$transaction([
      prisma.conversation.update({ where: { id }, data: { human_handled: true } }),
      prisma.lead.update({ where: { id: conversation.lead_id }, data: { status: 'AGENT_ACTIVE' } }),
    ]);

    realtimeService.emit(buildEvent('status_changed', id, conversation.lead_id, { lead_status: 'AGENT_ACTIVE', human_handled: true }, businessId));

    logger.info('Conversa assumida por humano', { conversation_id: id });
    return ok(res, { message: 'Conversa assumida. Você está no modo manual.' });
  })
);

/** POST /conversations/:id/release — devolve para a IA. */
inboxRouter.post(
  '/:id/release',
  asyncHandler(async (req: Request, res: Response) => {
    const businessId = req.user!.businessId!;
    const id = String(req.params.id);
    const conversation = await prisma.conversation.findFirst({ where: { id, business_id: businessId } });
    if (!conversation) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Conversa não encontrada' } });

    await prisma.$transaction([
      prisma.conversation.update({ where: { id }, data: { human_handled: false, human_handoff_notified_at: null } }),
      prisma.lead.update({ where: { id: conversation.lead_id }, data: { status: 'RESPONDED' } }),
    ]);

    realtimeService.emit(buildEvent('status_changed', id, conversation.lead_id, { lead_status: 'RESPONDED', human_handled: false }, businessId));

    logger.info('Conversa devolvida para a IA', { conversation_id: id });
    return ok(res, { message: 'Conversa devolvida para a IA' });
  })
);

/** POST /conversations/:id/message — envio manual (humano). */
inboxRouter.post(
  '/:id/message',
  requireActiveSubscription,
  asyncHandler(async (req: Request, res: Response) => {
    const businessId = req.user!.businessId!;
    const id = String(req.params.id);
    const content = String(req.body?.content ?? '').trim();
    if (!content) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Informe o conteúdo da mensagem' } });
    }

    const conversation = await prisma.conversation.findFirst({
      where: { id, business_id: businessId },
      include: { lead: true },
    });
    if (!conversation) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Conversa não encontrada' } });

    const lastOutbound = await prisma.message.findFirst({
      where: { lead_id: conversation.lead_id, business_id: businessId, direction: 'OUT' },
      orderBy: { created_at: 'desc' },
    });

    const channel = lastOutbound?.channel ?? (conversation.lead.phone ? 'WHATSAPP' : 'EMAIL');

    const message = await prisma.message.create({
      data: {
        business_id: businessId,
        lead_id: conversation.lead_id,
        channel,
        direction: 'OUT',
        content,
        status: 'QUEUED',
        provider: 'MANUAL',
      },
    });

    await prisma.$transaction([
      prisma.conversation.update({ where: { id }, data: { last_message_at: new Date() } }),
      prisma.lead.update({ where: { id: conversation.lead_id }, data: { status: 'AGENT_ACTIVE' } }),
    ]);

    realtimeService.emit(buildEvent('status_changed', id, conversation.lead_id, { lead_status: 'AGENT_ACTIVE', human_handled: false, content, direction: 'OUT' }, businessId));

    const queue = channel === 'WHATSAPP' ? QUEUE_NAMES.WHATSAPP_SEND : QUEUE_NAMES.EMAIL_SEND;
    await getQueue(queue).add('send', {
      campaignLeadId: undefined,
      leadId: conversation.lead_id,
      campaignId: undefined,
      phone: conversation.lead.phone ?? '',
      email: conversation.lead.email ?? '',
      message: content,
      subject: 'Re: SAVYRON',
      manual: true,
      messageId: message.id,
      businessId,
    });

    logger.info('Mensagem manual enfileirada', { conversation_id: id, channel, message_id: message.id });
    return ok(res, { message: 'Mensagem enviada', messageId: message.id }, 202);
  })
);

/** POST /conversations/:id/close — encerra conversa. */
inboxRouter.post(
  '/:id/close',
  asyncHandler(async (req: Request, res: Response) => {
    const businessId = req.user!.businessId!;
    const id = String(req.params.id);
    const conversation = await prisma.conversation.findFirst({ where: { id, business_id: businessId } });
    if (!conversation) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Conversa não encontrada' } });

    await prisma.conversation.update({ where: { id }, data: { status: 'CLOSED' } });
    realtimeService.emit(buildEvent('status_changed', id, conversation.lead_id, { lead_status: 'CLOSED' }, businessId));
    logger.info('Conversa encerrada', { conversation_id: id });
    return ok(res, { message: 'Conversa encerrada' });
  })
);

/**
 * POST /conversations/:id/media — envio de imagem (anexo).
 * Valida MIME + magic bytes, armazena no storage local seguro e como data URI, e enfileira para envio.
 * Tamanho máximo: 10MB (compatível com WhatsApp e Nginx).
 */
inboxRouter.post(
  '/:id/media',
  requireActiveSubscription,
  handleMediaUploadMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const businessId = req.user!.businessId!;
    const id = String(req.params.id);
    let file = req.file;

    // Fallback: se não veio via multipart, aceita data URI base64 via JSON body
    if (!file && req.body?.image && typeof req.body.image === 'string' && req.body.image.startsWith('data:image/')) {
      const match = req.body.image.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (match) {
        const mime = match[1].toLowerCase();
        const buf = Buffer.from(match[2], 'base64');
        file = {
          buffer: buf,
          mimetype: mime,
          size: buf.length,
          originalname: `upload_${Date.now()}.${mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg'}`,
          fieldname: 'image',
          encoding: '7bit',
        } as Express.Multer.File;
        req.file = file;
      }
    }

    if (!file) {
      logger.warn('MEDIA_UPLOAD_FAILED', { businessId, conversationId: id, reason: 'Nenhum arquivo enviado' });
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Nenhum arquivo enviado' } });
    }

    logger.info('MEDIA_UPLOAD_STARTED', {
      businessId,
      conversationId: id,
      fileName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    });

    // Normaliza mimetype (ex.: .jfif ou image/jfif / image/pjpeg -> image/jpeg)
    let normalizedMime = file.mimetype.toLowerCase();
    const origExt = path.extname(file.originalname || '').toLowerCase();
    if (normalizedMime.includes('jfif') || normalizedMime.includes('pjpeg') || origExt === '.jfif') {
      normalizedMime = 'image/jpeg';
    }

    // Validação defensiva de magic bytes (além do multer filter)
    const magicOk = validateImageMagicBytes(file.buffer, normalizedMime);
    if (!magicOk) {
      logger.error('MEDIA_UPLOAD_FAILED', { businessId, conversationId: id, reason: 'Magic bytes inconsistentes' });
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Arquivo de imagem inválido (magic bytes inconsistentes)' } });
    }

    const conversation = await prisma.conversation.findFirst({
      where: { id, business_id: businessId },
      include: { lead: true },
    });
    if (!conversation) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Conversa não encontrada' } });
    }

    // Storage seguro em disco: uploads/media/:businessId/:conversationId/:uuid:ext
    const storageDir = path.join(config.rootDir, 'uploads', 'media', businessId, id);
    await fs.promises.mkdir(storageDir, { recursive: true });
    const ext = origExt || (normalizedMime === 'image/png' ? '.png' : normalizedMime === 'image/webp' ? '.webp' : '.jpg');
    const safeFileName = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(storageDir, safeFileName);
    await fs.promises.writeFile(filePath, file.buffer);

    const mediaUrl = `/api/proxy/conversations/${id}/media/${safeFileName}`;

    const caption = String(req.body?.caption ?? '').trim().slice(0, 1024);
    const dataUri = `data:${normalizedMime};base64,${file.buffer.toString('base64')}`;
    const content = caption ? `![imagem](${dataUri})\n${caption}` : `![imagem](${dataUri})`;

    const lastOutbound = await prisma.message.findFirst({
      where: { lead_id: conversation.lead_id, business_id: businessId, direction: 'OUT' },
      orderBy: { created_at: 'desc' },
    });
    const channel = lastOutbound?.channel ?? (conversation.lead.phone ? 'WHATSAPP' : 'EMAIL');

    const message = await prisma.message.create({
      data: {
        business_id: businessId,
        lead_id: conversation.lead_id,
        channel,
        direction: 'OUT',
        content,
        status: 'QUEUED',
        provider: 'MANUAL',
      },
    });

    await prisma.$transaction([
      prisma.conversation.update({ where: { id }, data: { last_message_at: new Date() } }),
      prisma.lead.update({ where: { id: conversation.lead_id }, data: { status: 'AGENT_ACTIVE' } }),
    ]);

    realtimeService.emit(buildEvent('status_changed', id, conversation.lead_id, {
      lead_status: 'AGENT_ACTIVE', human_handled: false, content: caption || '[Imagem]', direction: 'OUT',
    }, businessId));

    // Enfileira para envio via WhatsApp
    const queue = channel === 'WHATSAPP' ? QUEUE_NAMES.WHATSAPP_SEND : QUEUE_NAMES.EMAIL_SEND;
    await getQueue(queue).add('send', {
      campaignLeadId: undefined,
      leadId: conversation.lead_id,
      campaignId: undefined,
      phone: conversation.lead.phone ?? '',
      email: conversation.lead.email ?? '',
      message: content,
      subject: 'Re: SAVYRON',
      manual: true,
      messageId: message.id,
      businessId,
    });

    logger.info('MEDIA_UPLOAD_SUCCESS', {
      businessId,
      conversationId: id,
      messageId: message.id,
      mimeType: normalizedMime,
      size: file.size,
      mediaUrl,
    });

    return ok(res, {
      message: 'Imagem enviada',
      messageId: message.id,
      url: mediaUrl,
      mimeType: normalizedMime,
      size: file.size,
    }, 202);
  })
);

/**
 * GET /conversations/:id/media/:filename — serve imagem do storage local com validação de tenant.
 */
inboxRouter.get(
  '/:id/media/:filename',
  asyncHandler(async (req: Request, res: Response) => {
    const businessId = req.user!.businessId!;
    const id = String(req.params.id);
    const filename = path.basename(String(req.params.filename));

    const conv = await prisma.conversation.findFirst({
      where: { id, business_id: businessId },
      select: { id: true },
    });
    if (!conv) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Conversa não encontrada' } });
    }

    const filePath = path.join(config.rootDir, 'uploads', 'media', businessId, id, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Arquivo não encontrado' } });
    }

    res.sendFile(filePath);
  })
);

/**
 * DELETE /conversations — apaga TODAS as conversas da empresa atual.
 * Ação destrutiva de alto risco: restrita a OWNER/BUSINESS_ADMIN, com
 * confirmação reforçada na UI e registro em AuditLog.
 */
inboxRouter.delete(
  '/',
  requireRole(['OWNER', 'BUSINESS_ADMIN']),
  asyncHandler(async (req: Request, res: Response) => {
    const businessId = req.user!.businessId!;
    const result = await deleteAllConversations(businessId, { sub: req.user!.sub });
    logger.warn('Todas as conversas foram apagadas', {
      business_id: businessId,
      ...result,
    });
    return ok(res, result);
  })
);

/**
 * DELETE /conversations/:id — apaga UMA conversa (e histórico de mensagens do lead).
 * Qualquer membro com acesso à empresa pode excluir conversas individuais.
 */
inboxRouter.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const businessId = req.user!.businessId!;
    const id = String(req.params.id);
    const result = await deleteConversation(businessId, id, { sub: req.user!.sub });
    logger.info('Conversa excluída', { conversation_id: id });
    return ok(res, result);
  })
);
