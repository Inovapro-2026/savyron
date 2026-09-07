import { prisma } from "@prospector/database";
import { createLogger } from "@prospector/logger";
import { detectHumanHandoffRequest } from "@prospector/ai";
import { getWhatsAppManager } from "@prospector/whatsapp";
import { formatPhone } from "@prospector/utils";
import { redis } from "./redis";
import { publishRealtime } from "./realtime";
import { createMessage, isUniqueConstraintError } from "./messages";

const logger = createLogger("worker.human-handoff");

/**
 * TRANSFERÊNCIA PARA ATENDIMENTO HUMANO (WhatsApp) — ORDEM CORRETA:
 *
 *   DETECTAR → BLOQUEAR NOVA IA (sem enfileirar AI_RESPONSE)
 *   → ENVIAR AVISO AO CLIENTE (com human_handled ainda FALSE)
 *   → CONFIRMAR ENVIO → registrar mensagem SENT no histórico
 *   → ATIVAR human_handled = true (IA pausada a partir daqui)
 *   → AVISAR PROPRIETÁRIO
 *
 * REGRA DE OURO: NUNCA ativar human_handled antes de o sender confirmar o
 * envio — modo manual ativo antes do envio pode bloquear o próprio aviso e o
 * cliente fica sem resposta (bug original).
 */

export { detectHumanHandoffRequest } from "@prospector/ai";

/** Mensagem de sistema enviada ao cliente (NUNCA gerada pela IA). */
export const HANDOFF_CUSTOMER_MESSAGE =
  "Claro! Vou transferir seu atendimento para um de nossos atendentes. Aguarde um momento, por favor.";

/** TTL do lock de concorrência (duas mensagens quase simultâneas). */
const HANDOFF_LOCK_TTL_SECONDS = 30;

/** Mascara o telefone para logs: +5511999****2222 */
export function maskPhoneForLog(phone: string | null | undefined): string {
  if (!phone) return "(não configurado)";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return "+****";
  return `+${digits.slice(0, digits.length - 8)}****${digits.slice(-4)}`;
}

export interface HumanHandoffInput {
  businessId: string;
  conversationId: string;
  leadId: string;
  content: string;
  from: string;
  remoteJid?: string;
  /** external_id da mensagem recebida — idempotência da resposta. */
  externalId?: string;
}

export interface HumanHandoffResult {
  transferred: boolean;
  alreadyHuman: boolean;
  customerNotified: boolean;
  ownerNotified: boolean;
  ownerPhoneConfigured: boolean;
}

interface SendResult {
  ok: boolean;
  messageId: string | null;
  error?: string;
}

/**
 * Envio pelo WhatsAppManager DA EMPRESA (registry por tenant).
 * O sender singleton legado não garante a sessão da empresa — a sessão
 * conectada vive em getWhatsAppManager(businessId) (mantida pelo runtime).
 */
async function trySendForBusiness(
  businessId: string,
  phoneE164: string,
  text: string,
  remoteJid?: string,
): Promise<SendResult> {
  try {
    const manager = getWhatsAppManager(businessId);
    const id = await manager.sendText(phoneE164, text, remoteJid);
    return { ok: true, messageId: id };
  } catch (error) {
    return {
      ok: false,
      messageId: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Confere e libera o lock de transferência em andamento. */
async function acquireHandoffLock(businessId: string, conversationId: string): Promise<boolean> {
  const key = `handoff:lock:${businessId}:${conversationId}`;
  const acquired = await redis.set(key, "1", "EX", HANDOFF_LOCK_TTL_SECONDS, "NX");
  return acquired === "OK";
}

async function releaseHandoffLock(businessId: string, conversationId: string): Promise<void> {
  await redis.del(`handoff:lock:${businessId}:${conversationId}`).catch(() => undefined);
}

/**
 * Executa a transferência na ORDEM CORRETA (ver doc do módulo).
 * Nunca lança — falhas são registradas e o worker segue íntegro.
 */
export async function transferConversationToHuman(
  input: HumanHandoffInput,
): Promise<HumanHandoffResult> {
  const { businessId, conversationId, leadId, content, from, remoteJid, externalId } = input;
  const result: HumanHandoffResult = {
    transferred: false,
    alreadyHuman: false,
    customerNotified: false,
    ownerNotified: false,
    ownerPhoneConfigured: false,
  };

  // ── 0) Proteção de concorrência: apenas UMA transferência por conversa.
  const locked = await acquireHandoffLock(businessId, conversationId);
  if (!locked) {
    logger.info("HUMAN_HANDOFF_PENDING (outro processo transferindo; ignorando duplicata)", {
      business_id: businessId,
      conversation_id: conversationId,
    });
    return result;
  }

  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, business_id: businessId },
      include: { lead: true },
    });
    if (!conversation) {
      logger.warn("Handoff: conversa não encontrada", { conversationId, businessId });
      return result;
    }

    // ── A) Já em modo humano: NÃO responder automaticamente (nem reforçar
    //       mensagem, nem renotificar) — spec: 1 mensagem, 1 notificação.
    if (conversation.human_handled) {
      result.alreadyHuman = true;
      logger.info("HUMAN_HANDOFF_PENDING (conversa já em modo humano; nenhuma ação automática)", {
        business_id: businessId,
        conversation_id: conversationId,
      });
      return result;
    }

    const customerPhone = conversation.lead.phone || from;

    // ── B/C/D/E) ENVIA a mensagem de sistema ao cliente ANTES de qualquer
    //     mudança de modo. human_handled continua FALSE aqui.
    logger.info("HUMAN_HANDOFF_CUSTOMER_MESSAGE_SENDING", {
      business_id: businessId,
      conversation_id: conversationId,
      customer_phone: maskPhoneForLog(customerPhone),
    });

    const send = await trySendForBusiness(businessId, customerPhone, HANDOFF_CUSTOMER_MESSAGE, remoteJid);

    if (!send.ok) {
      // ── F) Envio falhou: NÃO ativar modo manual como se tivesse funcionado.
      logger.error("HUMAN_HANDOFF_CUSTOMER_NOTIFICATION_FAILED", {
        business_id: businessId,
        conversation_id: conversationId,
        lead_id: leadId,
        customer_phone: maskPhoneForLog(customerPhone),
        error: send.error ?? "desconhecido",
      });
      return result;
    }

    logger.info("HUMAN_HANDOFF_CUSTOMER_MESSAGE_SENT", {
      business_id: businessId,
      conversation_id: conversationId,
      customer_phone: maskPhoneForLog(customerPhone),
      message_id: send.messageId ?? undefined,
    });
    result.customerNotified = true;

    // ── G) Registra a mensagem enviada no histórico (idempotente).
    const handoffExternalId = externalId
      ? `handoff:reply:${externalId}`
      : `handoff:reply:${conversationId}:${Date.now()}`;
    try {
      const handoffMessage = await createMessage({
        leadId,
        businessId,
        channel: "WHATSAPP",
        direction: "OUT",
        content: HANDOFF_CUSTOMER_MESSAGE,
        status: "SENT",
        provider: "whatsapp",
        externalId: handoffExternalId,
      });
      publishRealtime({
        type: "ai_response_generated",
        conversationId,
        leadId,
        businessId,
        timestamp: new Date().toISOString(),
        payload: {
          content: HANDOFF_CUSTOMER_MESSAGE,
          direction: "OUT",
          system_message: true,
          message_id: send.messageId ?? handoffMessage.id,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        // Job reprocessado: mensagem já registrada — segue para ativar modo.
        logger.info("Handoff: mensagem de transferência já registrada (idempotente)", {
          conversation_id: conversationId,
        });
      } else {
        throw error;
      }
    }

    // ── H) SOMENTE AGORA ativa o modo manual (IA pausada a partir daqui).
    //    Condicional: se outro processo vencer, já está transferido.
    const updated = await prisma.conversation.updateMany({
      where: { id: conversationId, human_handled: false },
      data: { human_handled: true, human_handoff_notified_at: null },
    });
    if (updated.count === 0) {
      result.alreadyHuman = true;
      logger.info("HUMAN_HANDOFF_PENDING (já transferido por processo concorrente)", {
        conversation_id: conversationId,
      });
      return result;
    }
    await prisma.lead.update({
      where: { id: leadId },
      data: { status: "AGENT_ACTIVE" },
    });
    result.transferred = true;

    logger.info("HUMAN_HANDOFF_ACTIVATED", {
      business_id: businessId,
      conversation_id: conversationId,
      lead_id: leadId,
      cliente: conversation.lead.name?.trim() || "Novo contato",
      telefone: maskPhoneForLog(customerPhone),
      mensagem: content.slice(0, 160),
      timestamp: new Date().toISOString(),
    });

    publishRealtime({
      type: "status_changed",
      conversationId,
      leadId,
      businessId,
      timestamp: new Date().toISOString(),
      payload: { lead_status: "AGENT_ACTIVE", human_handled: true },
    });

    // ── I) Notifica o proprietário (best-effort; falha NÃO desfaz nada).
    const notify = await notifyOwnerAboutHumanHandoff({
      businessId,
      conversationId,
      leadId,
      content,
      from,
    });
    result.ownerNotified = notify.notified;
    result.ownerPhoneConfigured = notify.configured;
    return result;
  } catch (error) {
    logger.error("HUMAN_HANDOFF_FAILED", {
      business_id: businessId,
      conversation_id: conversationId,
      lead_id: leadId,
      error: error instanceof Error ? error.message : String(error),
    });
    return result;
  } finally {
    await releaseHandoffLock(businessId, conversationId);
  }
}

export interface NotifyOwnerInput {
  businessId: string;
  conversationId: string;
  leadId: string;
  content: string;
  from: string;
}

/**
 * Notifica o proprietário (human_transfer_owner_phone) — DESTINATÁRIO da
 * notificação, enviada DO WhatsApp conectado da empresa. NUNCA é enviada ao
 * cliente e NUNCA vira conversa/lead no CRM.
 */
export async function notifyOwnerAboutHumanHandoff(
  input: NotifyOwnerInput,
): Promise<{ notified: boolean; configured: boolean }> {
  const { businessId, conversationId, leadId, content, from } = input;

  const settings = await prisma.businessSettings.findUnique({
    where: { business_id: businessId },
    select: { human_transfer_owner_phone: true },
  });
  const ownerPhone = settings?.human_transfer_owner_phone?.trim();

  if (!ownerPhone) {
    logger.warn(
      "Human handoff solicitado, mas número do proprietário não configurado.",
      { business_id: businessId, conversation_id: conversationId },
    );
    return { notified: false, configured: false };
  }

  // Proteção de duplicidade: 1 transferência ativa = 1 notificação.
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, business_id: businessId },
    select: { human_handoff_notified_at: true, human_handled: true },
  });
  if (!conversation?.human_handled || conversation.human_handoff_notified_at) {
    logger.info("Handoff: notificação já enviada ou conversa fora do modo humano", {
      conversation_id: conversationId,
    });
    return { notified: false, configured: true };
  }

  // Dados REAIS do banco (nunca inventar nome).
  const [lead, business] = await Promise.all([
    prisma.lead.findUnique({
      where: { id: leadId },
      select: { name: true, phone: true, business_name: true },
    }),
    prisma.business.findUnique({ where: { id: businessId }, select: { name: true } }),
  ]);

  const clienteNome = lead?.name?.trim() || "Novo contato";
  const clienteTelefone = formatPhone(from) || from;
  const empresaNome = business?.name?.trim() || "SAVYRON";
  const horario = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const message = [
    "🚨 *SOLICITAÇÃO DE ATENDIMENTO HUMANO*",
    "",
    "Um cliente solicitou falar com um atendente.",
    "",
    `👤 Cliente: ${clienteNome}`,
    `📱 WhatsApp: ${clienteTelefone}`,
    "",
    "💬 Mensagem:",
    `"${content.slice(0, 300)}"`,
    "",
    "🤖 A IA foi pausada automaticamente.",
    "",
    "Acesse o SAVYRON para assumir a conversa.",
    "",
    `Empresa: ${empresaNome}`,
    `Horário: ${horario}`,
  ].join("\n");

  logger.info("HUMAN_HANDOFF_OWNER_NOTIFICATION_SENDING", {
    business_id: businessId,
    conversation_id: conversationId,
    owner_phone: maskPhoneForLog(ownerPhone),
  });

  // FROM: WhatsApp conectado da empresa → TO: proprietário.
  const send = await trySendForBusiness(businessId, ownerPhone, message);

  if (send.ok) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { human_handoff_notified_at: new Date() },
    });
    logger.info("HUMAN_HANDOFF_OWNER_NOTIFICATION_SENT", {
      business_id: businessId,
      conversation_id: conversationId,
      owner_phone: maskPhoneForLog(ownerPhone),
    });
    return { notified: true, configured: true };
  }

  // Falha no envio: NÃO desfaz a transferência; registra e segue.
  logger.error("HUMAN_HANDOFF_OWNER_NOTIFICATION_FAILED", {
    business_id: businessId,
    conversation_id: conversationId,
    lead_id: leadId,
    owner_phone: maskPhoneForLog(ownerPhone),
    error: send.error ?? "desconhecido",
  });
  return { notified: false, configured: true };
}
