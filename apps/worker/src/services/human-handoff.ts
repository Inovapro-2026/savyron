import { prisma } from "@prospector/database";
import { createLogger } from "@prospector/logger";
import { detectHumanHandoffRequest } from "@prospector/ai";
import { trySendWhatsAppMessage, getWhatsAppManager } from "@prospector/whatsapp";
import { formatPhone } from "@prospector/utils";

const logger = createLogger("worker.human-handoff");

/**
 * TRANSFERÊNCIA PARA ATENDIMENTO HUMANO (WhatsApp).
 *
 * Fluxo: cliente pede humano → detector → IA pausada (human_handled=true) →
 * cliente recebe confirmação → proprietário recebe notificação pelo MESMO
 * WhatsApp conectado da empresa (nunca pelo número do proprietário).
 *
 * Reutiliza: Conversation.human_handled (mecanismo existente), LeadStatus
 * AGENT_ACTIVE, trySendWhatsAppMessage (sender existente), getWhatsAppManager.
 */

export { detectHumanHandoffRequest } from "@prospector/ai";

/** Mensagem enviada ao cliente quando a transferência acontece. */
export const HANDOFF_CUSTOMER_MESSAGE =
  "Claro! Vou transferir seu atendimento para um de nossos atendentes. Aguarde um momento, por favor.";

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
}

export interface HumanHandoffResult {
  transferred: boolean;
  /** true quando a conversa JÁ estava em modo humano (sem nova notificação). */
  alreadyHuman: boolean;
  ownerNotified: boolean;
  ownerPhoneConfigured: boolean;
}

/**
 * Executa a transferência da conversa para atendimento humano:
 *  1. Se já está human_handled → não refaz (sem notificação duplicada);
 *     apenas garante que o cliente saiba que será atendido por alguém.
 *  2. Marca human_handled=true + lead AGENT_ACTIVE (status existente).
 *  3. Envia confirmação ao cliente pelo WhatsApp conectado.
 *  4. Notifica o proprietário (se human_transfer_owner_phone configurado),
 *     com proteção de duplicidade via human_handoff_notified_at.
 */
export async function transferConversationToHuman(
  input: HumanHandoffInput,
): Promise<HumanHandoffResult> {
  const { businessId, conversationId, leadId, content, from, remoteJid } = input;
  const result: HumanHandoffResult = {
    transferred: false,
    alreadyHuman: false,
    ownerNotified: false,
    ownerPhoneConfigured: false,
  };

  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, business_id: businessId },
      include: { lead: true },
    });
    if (!conversation) {
      logger.warn("Handoff: conversa não encontrada", { conversationId, businessId });
      return result;
    }

    // ── 1) Conversa já em modo humano: apenas reforça a mensagem ao cliente
    //       e tenta completar a notificação do proprietário caso o envio
    //       anterior tenha falhado (1 tentativa por mensagem, sem loop infinito:
    //       quando notified_at fica preenchido, não tenta mais).
    if (conversation.human_handled) {
      result.alreadyHuman = true;
      logger.info("Handoff: conversa já em modo humano; reforçando confirmação ao cliente", {
        conversation_id: conversationId,
      });
      await sendCustomerConfirmation(leadId, remoteJid);
      const retryNotify = await notifyOwnerAboutHumanHandoff({
        businessId,
        conversationId,
        leadId,
        content,
        from,
      });
      result.ownerNotified = retryNotify.notified;
      result.ownerPhoneConfigured = retryNotify.configured;
      return result;
    }

    // ── 2) Transição atômica: human_handled=true + lead AGENT_ACTIVE.
    //       A atualização condicional evita race com takeover manual
    //       simultâneo (só escreve se ainda estiver false).
    const updated = await prisma.conversation.updateMany({
      where: { id: conversationId, human_handled: false },
      data: { human_handled: true, human_handoff_notified_at: null },
    });
    if (updated.count === 0) {
      // Outro processo (takeover/detector concorrente) venceu.
      result.alreadyHuman = true;
      logger.info("Handoff: conversa já transferida por processo concorrente", {
        conversation_id: conversationId,
      });
      return result;
    }
    await prisma.lead.update({
      where: { id: leadId },
      data: { status: "AGENT_ACTIVE" },
    });
    result.transferred = true;

    // Log estruturado do pedido (dados reais, sem PII sensível além do contato).
    logger.info("HUMAN_HANDOFF_REQUESTED", {
      business_id: businessId,
      conversation_id: conversationId,
      lead_id: leadId,
      cliente: conversation.lead.name?.trim() || "Novo contato",
      telefone: maskPhoneForLog(from),
      mensagem: content.slice(0, 160),
      timestamp: new Date().toISOString(),
    });

    // Confirmação imediata ao cliente pelo WhatsApp conectado.
    await sendCustomerConfirmation(leadId, remoteJid);

    // ── 3) Notificação do proprietário (best-effort, nunca quebra o fluxo).
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
    // Falha NUNCA desfaz a transferência nem quebra o processamento.
    logger.error("HUMAN_HANDOFF_ERROR", {
      business_id: businessId,
      conversation_id: conversationId,
      lead_id: leadId,
      error: error instanceof Error ? error.message : String(error),
    });
    return result;
  }
}

/** Envia a confirmação ao cliente (reutiliza o sender existente). */
async function sendCustomerConfirmation(leadId: string, remoteJid?: string): Promise<void> {
  try {
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { phone: true } });
    if (!lead?.phone) {
      logger.warn("Handoff: lead sem telefone para confirmação", { lead_id: leadId });
      return;
    }
    const send = await trySendWhatsAppMessage(lead.phone, HANDOFF_CUSTOMER_MESSAGE, remoteJid);
    if (!send.ok) {
      logger.warn("Handoff: falha ao enviar confirmação ao cliente", {
        lead_id: leadId,
        error: send.error,
      });
    }
  } catch (error) {
    logger.warn("Handoff: erro ao enviar confirmação ao cliente", {
      lead_id: leadId,
      error: error instanceof Error ? error.message : String(error),
    });
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
 * Notifica o proprietário (human_transfer_owner_phone) sobre o handoff.
 * - Proteção de duplicidade: só notifica 1× por transferência
 *   (human_handoff_notified_at). Reset ao devolver para a IA.
 * - Falha de envio não desfaz nada: registra HUMAN_HANDOFF_NOTIFICATION_FAILED.
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
    "🚨 *NOVA SOLICITAÇÃO DE ATENDIMENTO HUMANO*",
    "",
    "Um cliente solicitou falar com um atendente.",
    "",
    `👤 Cliente: ${clienteNome}`,
    `📱 WhatsApp: ${clienteTelefone}`,
    "",
    "💬 Mensagem:",
    `"${content.slice(0, 300)}"`,
    "",
    "A IA foi pausada nesta conversa.",
    "",
    "Acesse o SAVYRON para continuar o atendimento.",
    "",
    `Empresa: ${empresaNome}`,
    `Horário: ${horario}`,
  ].join("\n");

  // Envia DO WhatsApp conectado da empresa PARA o proprietário (destinatário).
  const send = await trySendWhatsAppMessage(ownerPhone, message);

  if (send.ok) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { human_handoff_notified_at: new Date() },
    });
    logger.info("HUMAN_HANDOFF_NOTIFIED", {
      business_id: businessId,
      conversation_id: conversationId,
      owner_phone: maskPhoneForLog(ownerPhone),
    });
    return { notified: true, configured: true };
  }

  // Falha no envio: NÃO desfaz a transferência; registra e segue.
  logger.error("HUMAN_HANDOFF_NOTIFICATION_FAILED", {
    business_id: businessId,
    conversation_id: conversationId,
    owner_phone: maskPhoneForLog(ownerPhone),
    error: send.error ?? "desconhecido",
  });
  return { notified: false, configured: true };
}
