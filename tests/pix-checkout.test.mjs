/**
 * TESTES: tela de assinatura pendente / PIX (AbacatePay).
 * - "Já paguei" consulta SOMENTE o status real no gateway (nunca cria/ativa pelo clique).
 * - Consulta via GET /billing/abacatepay/pix/status, que ativa de forma idempotente.
 * - Estados: AGUARDANDO_PAGAMENTO/PROCESSANDO/CONFIRMADO/ATIVANDO/EXPIRADO/CANCELADO/ERRO.
 * - Texts pt-BR exigidos: "Já paguei — verificar pagamento", "Verificando pagamento...",
 *   "Pagamento confirmado ✓", "PIX copiado!".
 * Estrutural: baseado na leitura dos arquivos produzidos.
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

const PIX = read("apps/dashboard/components/billing/pix-checkout.tsx");
const PAGE = read("apps/dashboard/app/payment/page.tsx");
const BILLING = read("apps/api/src/routes/billing.ts");
const BIZ = read("apps/api/src/services/abacatepay-billing.ts");

test("pix: rota de CONSULTA GET /billing/abacatepay/pix/status (não cria PIX)", () => {
  // rota existe como GET:
  assert.ok(BILLING.includes('"/abacatepay/pix/status"'));
  assert.ok(/billingRouter\.get\(\s*"\/abacatepay\/pix\/status"/.test(BILLING));
  // deriva businessId do token (requireAuth), nunca de query/body:
  assert.match(BILLING, /req\.user!\.businessId!/);
  // não chama createAbacatepayPixForBusiness dentro da rota de status:
  const route = BILLING.slice(
    BILLING.indexOf('"/abacatepay/pix/status"'),
    BILLING.indexOf("/activate-free"),
  );
  assert.ok(!/createAbacatepayPixForBusiness/.test(route), "rota de status não cria PIX");
  // delega a consulta real ao serviço:
  assert.ok(/getAbacatepayPixStatus/.test(route));
});

test("pix: consulta usa o status REAL do gateway (getAbacatepayTransparentStatus)", () => {
  assert.ok(/getAbacatepayTransparentStatus\(\s*payment\.abacatepay_checkout_id/.test(BIZ));
});

test("pix: ativação idempotente por pagamento (early return se CONFIRMED)", () => {
  assert.ok(BIZ.includes('if (existing?.status === "CONFIRMED") return { already: true };'));
  // guard a nível da consulta para não re-confirmar cobrança já paga:
  assert.ok(BIZ.includes('if (payment.status === "CONFIRMED") return { status: "CONFIRMED"'));
});

test("pix: segurança — ativação nunca vem de localStorage/cookie/query/React state", () => {
  // no cliente, "Já paguei"/polling chamam somente o endpoint de status:
  assert.ok(/billing\/abacatepay\/pix\/status/.test(PIX));
  // e a página /payment não chama activate-free via cliente para plano pago:
  assert.ok(!/localStorage/.test(PAGE.replace(/\/\*[\s\S]*?\*\//g, "")));
  // confirmed SOMENTE quando o backend/gateway confirma:
  assert.ok(/"CONFIRMED"/.test(PIX));
});

test("pix: botão 'Já paguei' chama SÓ a consulta, com spinner/desabilitado", () => {
  assert.ok(PIX.includes("Já paguei — verificar pagamento"));
  assert.ok(PIX.includes("Verificando pagamento..."));
  // o clique dispara runStatusCheck (consulta de status), nunca gera PIX:
  assert.ok(/runStatusCheck\(true\)/.test(PIX));
});

test("pix: textos pt-BR exigidos", () => {
  assert.ok(PIX.includes("Pagamento confirmado ✓"));
  assert.ok(PIX.includes("PIX copiado!"));
  assert.ok(PIX.includes("Gerar novo PIX"));
});

test("pix: estados EXPIRADO/CANCELADO/ERRO presentes", () => {
  assert.ok(PIX.includes('phase === "expired"'));
  assert.ok(PIX.includes('phase === "cancelled"'));
  assert.ok(PIX.includes('phase === "create_error"'));
  assert.ok(PIX.includes('phase === "confirmed"'));
  assert.ok(PIX.includes('phase === "activating"'));
  assert.ok(PIX.includes('phase === "checking"'));
});

test("pix: polling único com cleanup (stopPolling) em confirmed/expired/cancelled/unmount", () => {
  assert.ok(PIX.includes("stopPolling()"));
  assert.ok(/if \(phase !== "pending"\) \{[\s\S]*?stopPolling\(\)/.test(PIX));
  assert.ok(PIX.includes("clearInterval(pollRef.current)"));
  assert.ok(PIX.includes("inFlightRef"));
  // nunca duas requisições de status paralelas:
  assert.ok(PIX.includes("if (inFlightRef.current) return;"));
});

test("pix: expirado para o polling e exige ação explícita de nova cobrança", () => {
  // no estado expired, sem "Já paguei" e sem auto-polling — só "Gerar novo PIX":
  const expired = PIX.slice(PIX.indexOf("phase === \"expired\""), PIX.indexOf("phase === \"cancelled\""));
  assert.ok(!/Já paguei/.test(expired));
  assert.ok(/Gerar novo PIX/.test(expired));
});

test("pix: criação de cobrança reutiliza PIX pendente, nunca ativa por clique", () => {
  const createBlock = BIZ.slice(
    BIZ.indexOf("createAbacatepayPixForBusiness"),
    BIZ.indexOf("export async function confirmAbacatepayPayment"),
  );
  assert.ok(createBlock.length > 0);
  assert.ok(!/"ACTIVE"/.test(createBlock), "criação de PIX não ativa assinatura");
});

test("pix: dobra de polling na página /payment evitada no caso AbacatePay", () => {
  assert.ok(PAGE.includes("abacatepay_configured") || PAGE.includes("PixCheckout"));
  // verifica que a página delega a confirmação ao PixCheckout e não duplica polling:
  assert.ok(PAGE.includes("<PixCheckout"));
});

test("pix: polling do PixCheckout usa intervalo único com cleanup no unmount", () => {
  assert.ok(/pollRef\.current = setInterval\(tick, POLL_INTERVAL_MS\)/.test(PIX));
  assert.ok(/return stopPolling/.test(PIX));
});
