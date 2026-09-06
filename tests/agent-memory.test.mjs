/**
 * TESTES: memória do agente — regras puras (extração de preferências, recap).
 * Executado via: node --test tests/agent-memory.test.mjs (após transpile tsx
 * pelo loader do projeto: usa import direto do TS como os demais testes).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const {
  KEY_TRATAMENTO,
  KEY_EVITAR,
  RECAP_MAX_LINES,
  extractPreferenceFromText,
  sanitizeMemoryContent,
  mergeRecapLines,
  buildRecapLine,
} = await import("../apps/api/src/services/agent-memory-rules.ts");

// --------------------------- Tratamento preferido ---------------------------

test("memória: 'me chame de Primário' → PREFERENCE com key pref:tratamento", () => {
  const pref = extractPreferenceFromText("Me chame de Primário");
  assert.ok(pref);
  assert.equal(pref.key, KEY_TRATAMENTO);
  assert.equal(pref.category, "PREFERENCE");
  assert.ok(pref.content.includes("Primário"));
});

test("memória: variações de tratamento ('pode me chamar de chefe', 'quero ser chamado de Sr. Silva')", () => {
  for (const frase of [
    "Pode me chamar de chefe",
    "quero ser chamado de Sr. Silva",
    "Prefiro que me chamem de Doutor",
    "Me trata como Chef",
  ]) {
    const pref = extractPreferenceFromText(frase);
    assert.ok(pref, `deveria extrair de: ${frase}`);
    assert.equal(pref.key, KEY_TRATAMENTO);
  }
});

test("memória: 'não me chame de senhor' → INSTRUCTION evitar", () => {
  const pref = extractPreferenceFromText("Não me chame de senhor");
  assert.ok(pref);
  assert.equal(pref.key, KEY_EVITAR);
  assert.equal(pref.category, "INSTRUCTION");
  assert.ok(pref.content.includes("senhor"));
});

test("memória: negação vence — evitar não é sobrescrito por fala sem preferência", () => {
  assert.equal(extractPreferenceFromText("Qual o saldo?"), null);
});

test("memória: instruções de estilo ('seja mais curto', 'sem emojis')", () => {
  const a = extractPreferenceFromText("Seja mais curto nas respostas");
  assert.ok(a);
  assert.equal(a.category, "INSTRUCTION");
  const b = extractPreferenceFromText("Não use emojis");
  assert.ok(b);
});

test("memória: frases comuns NÃO geram memória", () => {
  for (const frase of [
    "Olá, bom dia",
    "Como está minha campanha?",
    "Qual é o saldo da minha conta?",
    "Pesquise empresas de tecnologia",
  ]) {
    assert.equal(extractPreferenceFromText(frase), null, `não deveria memorizar: ${frase}`);
  }
});

test("memória: tratamento longo demais (frase) é rejeitado", () => {
  assert.equal(
    extractPreferenceFromText("Me chame de o grande consultor comercial da empresa inteira"),
    null,
  );
});

// --------------------------- Sanitização ---------------------------

test("memória: sanitize remove <>, normaliza espaços e limita 200 chars", () => {
  assert.equal(sanitizeMemoryContent("<script>alert(1)</script>"), "scriptalert(1)/script");
  assert.equal(sanitizeMemoryContent("  a   b  "), "a b");
  const long = sanitizeMemoryContent("x".repeat(500));
  assert.equal(long.length, 200);
});

// --------------------------- Recap de conversas ---------------------------

test("memória: recap mantém no máximo RECAP_MAX_LINES linhas (mais recentes)", () => {
  const linhas = ["l1", "l2", "l3", "l4", "l5", "l6", "l7", "l8"];
  const merged = mergeRecapLines(linhas, "l9");
  assert.equal(merged.length, RECAP_MAX_LINES);
  assert.equal(merged[merged.length - 1], "l9");
  assert.equal(merged[0], "l4");
});

test("memória: recap line contém timestamp, usuário e agente", () => {
  const line = buildRecapLine("Qual meu saldo?", "Seu saldo é positivo.");
  assert.ok(line.includes("Você: Qual meu saldo?"));
  assert.ok(line.includes("Agente: Seu saldo é positivo."));
  assert.ok(line.startsWith("["));
});
