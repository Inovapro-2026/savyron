/**
 * TESTES: detector de solicitação de atendimento humano (human-handoff).
 *
 * Cobre:
 * - Frases de ALTA confiança (pedido explícito).
 * - Variações: acentos, pontuação, abreviação "c/", maiúsculas.
 * - FALSOS POSITIVOS: perguntas sobre atendimento/horário NÃO transferem.
 * - Negações: "não quero falar com atendente".
 * - Normalização (normalizeHandoffText).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const {
  detectHumanHandoffRequest,
  normalizeHandoffText,
} = await import("../services/ai/src/human-handoff.ts");

// ─────────────────── Deve DETECTAR (alta confiança) ───────────────────

const POSITIVE_HIGH = [
  "quero falar com humano",
  "quero falar com uma pessoa",
  "quero falar com atendente",
  "quero falar com um atendente",
  "preciso de um atendente",
  "quero atendimento humano",
  "me transfere para um atendente",
  "me passe para uma pessoa",
  "quero falar com alguém",
  "posso falar com alguém?",
  "quero falar com o agente",
  "quero falar com uma pessoa real",
  "quero atendimento de uma pessoa",
  "quero falar com o proprietário",
  "quero falar com o dono",
  "me passa para o atendente",
  "transfere para uma pessoa",
  "preciso falar com alguém",
  "atendimento humano por favor",
];

for (const phrase of POSITIVE_HIGH) {
  test(`detecta (high): "${phrase}"`, () => {
    const r = detectHumanHandoffRequest(phrase);
    assert.equal(r.detected, true, `deveria detectar: ${phrase}`);
    assert.equal(r.confidence, "high");
    assert.ok(r.reason);
  });
}

// ─────────────────── Variações de escrita ───────────────────

test("detecta com abreviação e pontuação: 'quero falar c/ um atendente!!!'", () => {
  const r = detectHumanHandoffRequest("quero falar c/ um atendente!!!");
  assert.equal(r.detected, true);
});

test("detecta com acentos/maiúsculas: 'QUERO FALAR COM ATENDENTE'", () => {
  assert.equal(detectHumanHandoffRequest("QUERO FALAR COM ATENDENTE").detected, true);
});

test("detecta com acento: 'quero falar com atendênte' / 'alguém'", () => {
  assert.equal(detectHumanHandoffRequest("preciso falar com alguém da equipe").detected, true);
});

// ─────────────────── FALSOS POSITIVOS (não devem detectar) ───────────────────

const NEGATIVES = [
  "qual o horário de atendimento?",
  "vocês têm atendimento?",
  "vocês possuem atendimento?",
  "qual o canal de atendimento?",
  "o atendimento funciona sábado?",
  "qual o horário de atendimento ao público",
  "bom dia",
  "quanto custa o plano?",
  "como funciona a prospecção?",
];

for (const phrase of NEGATIVES) {
  test(`NÃO detecta: "${phrase}"`, () => {
    const r = detectHumanHandoffRequest(phrase);
    assert.equal(r.detected, false, `falso positivo: ${phrase}`);
  });
}

// ─────────────────── Negações ───────────────────

test("negação: 'não quero falar com atendente' não transfere", () => {
  const r = detectHumanHandoffRequest("não quero falar com atendente, só quero informações");
  assert.equal(r.detected, false);
});

// ─────────────────── Confiança média ───────────────────

test("confiança MÉDIA: 'quero atendimento' (sem 'humano')", () => {
  const r = detectHumanHandoffRequest("quero atendimento");
  assert.equal(r.detected, true);
  assert.equal(r.confidence, "medium");
});

// ─────────────────── Normalização ───────────────────

test("normalizeHandoffText: acentos, pontuação e 'c/'", () => {
  assert.equal(normalizeHandoffText("Olá! Quero falar c/ alguém."), "ola quero falar com alguem");
  assert.equal(normalizeHandoffText("ATENDENTE  "), "atendente");
});

test("texto vazio/curto não detecta", () => {
  assert.equal(detectHumanHandoffRequest("").detected, false);
  assert.equal(detectHumanHandoffRequest("oi").detected, false);
  assert.equal(detectHumanHandoffRequest("  ").detected, false);
});
