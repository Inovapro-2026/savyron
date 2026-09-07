/**
 * TESTES: edição do nome do contato (Inbox → Lead.name → contexto da IA).
 * Estrutural: valida escopo multi-tenant, alteração SOMENTE do name,
 * fallback "Novo contato" e propagação do nome para o contexto da IA.
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

const LEADS = read("apps/api/src/routes/leads.ts");
const INBOX_PAGE = read("apps/dashboard/app/(dashboard)/inbox/[id]/page.tsx");
const AI_PROC = read("apps/worker/src/jobs/ai-response.processor.ts");
const UTILS = read("packages/utils/src/misc.ts");
const SCHEMA = read("packages/database/prisma/schema.prisma");

test("nome: Lead.name é o campo oficial (nullable) — sem novo modelo", () => {
  assert.match(SCHEMA, /model Lead \{[\s\S]*?name\s+String\?/);
  // não criou campo duplicado:
  assert.ok(!SCHEMA.includes("customer_name"));
  assert.ok(!SCHEMA.includes("full_name String?"));
});

test("nome: PATCH /leads/:id/name altera SOMENTE name, escopo multi-tenant", () => {
  assert.ok(LEADS.includes("'/:id/name'"));
  const route = LEADS.slice(
    LEADS.indexOf("'/:id/name'"),
    LEADS.indexOf("POST /leads/import/preview"),
  );
  // busca com business_id do token (nunca só o id do front):
  assert.match(route, /findFirst\(\{\s*where: \{ id, business_id: businessId \}/);
  // update apenas do name:
  assert.match(route, /data: \{ name: trimmed\.length > 0 \? trimmed : null \}/);
  // o objeto update NÃO contém phone/business_id (só o select de leitura pode):
  const updateStmt = route.match(/prisma\.lead\.update\(\{[\s\S]*?\}\)\);/)?.[0] ?? "";
  assert.ok(updateStmt.includes("name: trimmed.length > 0 ? trimmed : null"));
  assert.ok(!/"phone"|phone: raw|business_id: raw/.test(updateStmt), "update altera apenas name");
  // validações:
  assert.match(route, /trim\(\)/);
  assert.match(route, /máximo 80 caracteres/);
  assert.match(route, /Lead não encontrado/);
});

test("nome: PATCH exige autenticação + business", () => {
  const route = LEADS.slice(
    LEADS.indexOf("'/:id/name'"),
    LEADS.indexOf("POST /leads/import/preview"),
  );
  assert.match(route, /requireAuth,?\s*\n\s*requireBusiness/);
});

test("nome: fallback único 'Novo contato' no Inbox (name null/vazio)", () => {
  const occurrences = INBOX_PAGE.match(/Novo contato/g) ?? [];
  assert.ok(occurrences.length >= 1, "fallback presente");
  assert.ok(INBOX_PAGE.includes("hasRealLeadName(data.lead.name)"));
  // nenhum outro fallback divergente no header:
  assert.ok(!INBOX_PAGE.includes("?? 'Contato'"), "fallback antigo 'Contato' removido do header");
});

test("nome: editor com ícone ✏️ discreto + salvar/cancelar + invalidação de queries", () => {
  assert.ok(INBOX_PAGE.includes('aria-label="Editar nome do contato"'));
  assert.ok(INBOX_PAGE.includes("Pencil"));
  assert.ok(INBOX_PAGE.includes("leads/${data.lead.id}/name"));
  assert.match(INBOX_PAGE, /method: 'PATCH'/);
  assert.ok(INBOX_PAGE.includes("invalidateQueries({ queryKey: ['conversation', id] })"));
  assert.ok(INBOX_PAGE.includes("invalidateQueries({ queryKey: ['conversations'] })"));
  assert.ok(INBOX_PAGE.includes("invalidateQueries({ queryKey: ['clients'] })"));
});

test("nome: contexto da IA usa lead.name real (hasRealLeadName) — sem inventar", () => {
  assert.ok(AI_PROC.includes("hasRealLeadName(lead.name) ? lead.name : null"));
  // placeholder "Novo contato" NÃO vai para a IA:
  assert.ok(UTILS.includes("PLACEHOLDER_LEAD_NAME_PATTERN"));
  assert.ok(UTILS.includes("novo contato"), "placeholder na lista");
});

test("nome: IA recebe o nome via contexto existente (leadName → prompt)", () => {
  const ASSEMBLER = read("services/ai/src/prompt-assembler.ts");
  assert.ok(ASSEMBLER.includes("Nome do contato: ${context.leadName}"));
});
