/**
 * TESTES: Anotações internas da conversa (Inbox → ConversationNote).
 * Estrutural: valida modelo multi-tenant, rota protegida, isolação por
 * business_id, deleção restrita ao autor e injeção no contexto da IA com
 * regras de sigilo (nunca revelar ao cliente).
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

const SCHEMA = read("packages/database/prisma/schema.prisma");
const NOTES = read("apps/api/src/routes/notes.ts");
const APP = read("apps/api/src/app.ts");
const ASSEMBLER = read("services/ai/src/prompt-assembler.ts");
const AI_PROC = read("apps/worker/src/jobs/ai-response.processor.ts");
const AI_TYPES = read("packages/types/src/ai.ts");

test("notas: modelo ConversationNote existe no schema (multi-tenant + cascade)", () => {
  const m = SCHEMA.slice(SCHEMA.indexOf("model ConversationNote"));
  assert.match(m, /model ConversationNote \{/);
  assert.match(m, /business_id\s+String/);
  assert.match(m, /conversation_id\s+String/);
  assert.match(m, /content\s+String/);
  assert.match(m, /created_by\s+String/);
  assert.match(m, /created_by_name\s+String\?/);
  assert.match(m, /conversation Conversation @relation\(fields: \[conversation_id\], references: \[id\], onDelete: Cascade\)/);
  assert.match(m, /@@index\(\[business_id, conversation_id\]\)/);
});

test("notas: rota exige auth + business (isolamento multi-tenant)", () => {
  assert.match(NOTES, /notesRouter\.use\(requireAuth, requireBusiness\)/);
});

test("notas: consultas filtram business_id do token (nunca do body)", () => {
  assert.match(NOTES, /where: \{ id: conversationId, business_id: businessId \}/);
  assert.match(NOTES, /where: \{ business_id: businessId, conversation_id: conversationId \}/);
});

test("notas: POST valida conteúdo (não vazio, limite de tamanho)", () => {
  assert.match(NOTES, /Informe o conteúdo da anotação/);
  assert.match(NOTES, /máximo \$\{MAX_NOTE_LENGTH\} caracteres/);
});

test("notas: DELETE restrito ao autor (double tenant check)", () => {
  assert.match(NOTES, /where: \{ id, business_id: businessId \}/);
  assert.match(NOTES, /note\.created_by !== userId/);
  assert.match(NOTES, /Somente o autor da anotação pode excluí-la/);
});

test("notas: rota registrada no app", () => {
  assert.match(APP, /import \{ notesRouter \} from "\.\/routes\/notes"/);
  assert.match(APP, /app\.use\("\/notes", notesRouter\)/);
});

test("notas: contexto da IA carrega anotações (5 mais recentes, multi-tenant)", () => {
  assert.match(AI_PROC, /conversationNote\.findMany/);
  assert.match(AI_PROC, /where: \{ business_id: resolvedBusinessId, conversation_id: conversationId \}/);
  assert.match(AI_PROC, /take: 5/);
});

test("notas: AgentContext recebe internalNotes", () => {
  assert.match(AI_PROC, /internalNotes,/);
  assert.match(AI_TYPES, /internalNotes\?: string\[\]/);
});

test("notas: sigilo absoluto — prompt proíbe revelar anotações ao cliente", () => {
  // Seção de anotações injetada no contexto
  assert.match(ASSEMBLER, /ANOTAÇÕES INTERNAS DA EQUIPE/);
  // Regras de sigilo obrigatórias
  assert.match(ASSEMBLER, /CONFIDENCIAL/);
  assert.match(ASSEMBLER, /JAMAIS revelar ao cliente|NÃO REVELAR AO CLIENTE|NUNCA REVELAR AO CLIENTE/i);
  // Não pode instruir a IA a exibir o conteúdo
  assert.match(ASSEMBLER, /deixe transparecer a existência/);
  assert.ok(
    /não tem acesso a informações internas/.test(ASSEMBLER),
    "instrução de negação quando o cliente pergunta sobre anotações",
  );
});
