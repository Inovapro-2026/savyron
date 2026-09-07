/**
 * TESTES: integração da transferência para atendimento humano.
 * Valida estruturalmente (fonte) os pontos críticos do fluxo:
 *  1. Detecção ANTES do enqueue de AI_RESPONSE (message-received).
 *  2. IA verificada antes de GERAR e antes de ENVIAR (race protection).
 *  3. Proteção de duplicidade de notificação (human_handoff_notified_at).
 *  4. Isolamento multi-tenant (business_id em todas as buscas).
 *  5. Reuso do sender existente (sem segunda conexão WhatsApp).
 *  6. API de configurações valida/normaliza o número do proprietário.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function read(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

const MSG_RECEIVED = read("apps/worker/src/jobs/message-received.processor.ts");
const AI_RESPONSE = read("apps/worker/src/jobs/ai-response.processor.ts");
const HANDOFF_SVC = read("apps/worker/src/services/human-handoff.ts");
const BUSINESS_ROUTE = read("apps/api/src/routes/business.ts");
const SETTINGS_SVC = read("apps/api/src/services/settings.ts");
const SCHEMA = read("packages/database/prisma/schema.prisma");
const MIGRATION = read(
  "packages/database/prisma/migrations/20260906210000_human_handoff/migration.sql",
);
const INBOX_ROUTE = read("apps/api/src/routes/inbox.ts");
const WA_SENDER = read("services/whatsapp/src/sender/sender.ts");

test("handoff: detector roda ANTES do enqueue de AI_RESPONSE no message-received", () => {
  const detectIdx = MSG_RECEIVED.indexOf("detectHumanHandoffRequest(content)");
  const aiQueueIdx = MSG_RECEIVED.indexOf("QUEUE_NAMES.AI_RESPONSE).add(");
  assert.ok(detectIdx > 0, "detector presente no processor");
  assert.ok(aiQueueIdx > detectIdx, "detecção deve vir antes do enqueue da IA");
  // Ao detectar, NÃO enfileira IA (return antes do add):
  const handoffBlock = MSG_RECEIVED.slice(
    detectIdx,
    MSG_RECEIVED.indexOf("  // 8) Aciona o agente de IA"),
  );
  assert.ok(handoffBlock.includes("return;"), "bloco de handoff termina com return");
  assert.ok(handoffBlock.includes("transferConversationToHuman("));
});

test("handoff: IA revalida human_handled ANTES de gerar e ANTES de enviar (race)", () => {
  // antes de gerar (checagem existente, mantida)
  assert.match(AI_RESPONSE, /if \(conversation\.human_handled\)/);
  // cancelamento com log explícito antes de ENVIAR:
  assert.ok(AI_RESPONSE.includes("AI_RESPONSE_CANCELLED_HUMAN_HANDOFF (antes de enviar)"));
  // a revalidação usa leitura fresca da conversa:
  const raceBlock = AI_RESPONSE.slice(
    AI_RESPONSE.indexOf("PROTEÇÃO CONTRA RACE"),
    AI_RESPONSE.indexOf("AI_RESPONSE_CANCELLED_HUMAN_HANDOFF (antes de enviar)"),
  );
  assert.ok(raceBlock.includes("prisma.conversation.findUnique"));
  assert.ok(raceBlock.includes("human_handled"));
  // e protege também a 2ª mensagem:
  assert.ok(AI_RESPONSE.includes("AI_RESPONSE_CANCELLED_HUMAN_HANDOFF (antes de enviar 2ª mensagem)"));
});

test("handoff: proteção de duplicidade de notificação (human_handoff_notified_at)", () => {
  assert.ok(SCHEMA.includes("human_handoff_notified_at"));
  assert.ok(HANDOFF_SVC.includes("human_handoff_notified_at"));
  // só notifica quando human_handled E sem notificação anterior:
  const notifyBlock = HANDOFF_SVC.slice(
    HANDOFF_SVC.indexOf("Proteção de duplicidade"),
    HANDOFF_SVC.indexOf("Dados REAIS do banco"),
  );
  assert.ok(notifyBlock.includes("human_handoff_notified_at"));
});

test("handoff: multi-tenant — business_id em todas as buscas do serviço", () => {
  // conversa buscada com business_id
  assert.match(
    HANDOFF_SVC,
    /findFirst\(\{\s*where: \{ id: conversationId, business_id: businessId \}/,
  );
  // settings buscadas por business_id
  assert.match(HANDOFF_SVC, /businessSettings\.findUnique\(\s*\{\s*where: \{ business_id: businessId \}/);
  // business buscado por business_id
  assert.match(HANDOFF_SVC, /business\.findUnique\(\s*\{\s*where: \{ id: businessId \}/);
});

test("handoff: reutiliza o sender existente (sem nova conexão WhatsApp)", () => {
  assert.ok(HANDOFF_SVC.includes("trySendWhatsAppMessage"));
  assert.ok(!HANDOFF_SVC.includes("new Baileys") && !HANDOFF_SVC.includes("makeWASocket"));
  assert.ok(WA_SENDER.includes("whatsappManager.sendText"), "sender existente intacto");
});

test("handoff: falha na notificação NÃO desfaz a transferência", () => {
  assert.ok(HANDOFF_SVC.includes("HUMAN_HANDOFF_OWNER_NOTIFICATION_FAILED"));
  // a transição é condicional e anterior à notificação:
  const transitionIdx = HANDOFF_SVC.indexOf("updateMany");
  const notifyIdx = HANDOFF_SVC.indexOf("const notify = await notifyOwnerAboutHumanHandoff({");
  assert.ok(transitionIdx > 0 && notifyIdx > transitionIdx);
});

test("handoff: ORDEM CORRETA — envio ao cliente ANTES de human_handled=true", () => {
  const sendIdx = HANDOFF_SVC.indexOf("trySendWhatsAppMessage(customerPhone");
  const activateIdx = HANDOFF_SVC.indexOf("human_handled: true, human_handoff_notified_at: null");
  assert.ok(sendIdx > 0 && activateIdx > sendIdx,
    "mensagem ao cliente DEVE ser enviada antes de ativar o modo manual");
  // falha no envio NÃO ativa modo manual:
  const failBlock = HANDOFF_SVC.slice(
    HANDOFF_SVC.indexOf("if (!send.ok)"),
    HANDOFF_SVC.indexOf("HUMAN_HANDOFF_CUSTOMER_MESSAGE_SENT"),
  );
  assert.ok(failBlock.includes("return result"), "falha de envio retorna sem ativar modo");
  assert.ok(!failBlock.includes("human_handled: true"), "falha de envio não ativa modo manual");
});

test("handoff: concorrência — lock Redis (uma transferência por conversa)", () => {
  assert.ok(HANDOFF_SVC.includes("handoff:lock:"));
  assert.ok(HANDOFF_SVC.includes('"NX"'));
  assert.ok(HANDOFF_SVC.includes("HUMAN_HANDOFF_PENDING"));
});

test("handoff: já em modo humano → NENHUMA ação automática (sem 2ª msg, sem 2ª notificação)", () => {
  const alreadyBlock = HANDOFF_SVC.slice(
    HANDOFF_SVC.indexOf("if (conversation.human_handled)"),
    HANDOFF_SVC.indexOf("const customerPhone"),
  );
  assert.ok(alreadyBlock.includes("result.alreadyHuman = true"));
  assert.ok(alreadyBlock.includes("return result"));
  assert.ok(!alreadyBlock.includes("trySendWhatsAppMessage"));
});

test("handoff: mensagem de transferência registrada como SENT com idempotência", () => {
  assert.ok(HANDOFF_SVC.includes('status: "SENT"'));
  assert.ok(HANDOFF_SVC.includes("handoff:reply:"));
  assert.ok(HANDOFF_SVC.includes("isUniqueConstraintError"));
});

test("handoff: logs estruturados completos", () => {
  for (const ev of [
    "HUMAN_HANDOFF_CUSTOMER_MESSAGE_SENDING",
    "HUMAN_HANDOFF_CUSTOMER_MESSAGE_SENT",
    "HUMAN_HANDOFF_CUSTOMER_NOTIFICATION_FAILED",
    "HUMAN_HANDOFF_ACTIVATED",
    "HUMAN_HANDOFF_OWNER_NOTIFICATION_SENDING",
    "HUMAN_HANDOFF_OWNER_NOTIFICATION_SENT",
    "HUMAN_HANDOFF_OWNER_NOTIFICATION_FAILED",
    "HUMAN_HANDOFF_FAILED",
  ]) {
    assert.ok(HANDOFF_SVC.includes(ev), `faltou log ${ev}`);
  }
});

test("handoff: release (Devolver para IA) reseta notified_at", () => {
  assert.ok(INBOX_ROUTE.includes("human_handoff_notified_at: null"));
});

test("handoff: número do proprietário não configurado NÃO quebra o fluxo", () => {
  assert.ok(HANDOFF_SVC.includes("número do proprietário não configurado"));
  // sem throw no caminho de ausência:
  const noPhoneStart = HANDOFF_SVC.indexOf("if (!ownerPhone)");
  const noPhoneBlock = HANDOFF_SVC.slice(noPhoneStart, HANDOFF_SVC.indexOf("return { notified: false, configured: false }", noPhoneStart) + 50);
  assert.ok(noPhoneBlock.includes("return { notified: false, configured: false }"));
  assert.ok(!noPhoneBlock.includes("throw"));
});

test("handoff: telefone mascarado nos logs", () => {
  assert.ok(HANDOFF_SVC.includes("maskPhoneForLog"));
});

test("handoff: prompts proíbem divulgar número interno ao cliente", () => {
  const JARVIS = read("apps/api/src/services/jarvis-service.ts");
  assert.ok(JARVIS.includes("NUNCA informe números de WhatsApp internos"));
  const ENGINE = read("services/ai/src/commercial-engine.ts");
  assert.ok(ENGINE.includes("NUNCA divulgue números de WhatsApp/telefone internos"));
});

test("handoff: schema — campos por empresa (BusinessSettings) e por conversa", () => {
  assert.match(SCHEMA, /human_transfer_owner_phone\s+String\?/);
  assert.match(SCHEMA, /human_handoff_notified_at\s+DateTime\?/);
  // migration aplica os dois:
  assert.ok(MIGRATION.includes('ADD COLUMN "human_transfer_owner_phone"'));
  assert.ok(MIGRATION.includes('ADD COLUMN "human_handoff_notified_at"'));
});

test("handoff: API — GET retorna o campo; PATCH valida e normaliza", () => {
  assert.ok(BUSINESS_ROUTE.includes("human_transfer_owner_phone: settings?.human_transfer_owner_phone"));
  assert.ok(BUSINESS_ROUTE.includes("normalizePhone"));
  assert.ok(BUSINESS_ROUTE.includes("Número do proprietário inválido"));
  // settings service persiste o campo:
  assert.match(SETTINGS_SVC, /human_transfer_owner_phone\?/);
});

test("handoff: PATCH exige OWNER/BUSINESS_ADMIN (rota existente)", () => {
  const patchRoute = BUSINESS_ROUTE.slice(
    BUSINESS_ROUTE.indexOf('"/settings"'),
    BUSINESS_ROUTE.indexOf("/** GET /business/ai-config-status"),
  );
  assert.ok(patchRoute.includes('requireRole(["OWNER", "BUSINESS_ADMIN"])'));
});

test("handoff: devolver para IA já existe (release) e reseta o fluxo", () => {
  assert.ok(INBOX_ROUTE.includes("human_handled: false"));
  assert.ok(INBOX_ROUTE.includes("/release"));
});

test("handoff: cliente recebe confirmação pelo WhatsApp conectado", () => {
  assert.ok(
    HANDOFF_SVC.includes("Vou transferir seu atendimento para um de nossos atendentes"),
  );
});
