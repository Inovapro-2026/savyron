/**
 * DETECTOR DE SOLICITAÇÃO DE ATENDIMENTO HUMANO (WhatsApp → transferência).
 *
 * Função PURA (sem I/O) — usada pelo message-received.processor ANTES de
 * enfileirar a resposta da IA. Objetivo: detectar pedidos claros de falar
 * com um humano ("quero falar com um atendente") SEM falso positivo em
 * perguntas comuns ("qual o horário de atendimento?").
 *
 * Estratégia:
 *  1. Normalização: lowercase, sem acentos, pontuação vira espaço, abreviações
 *     comuns expandidas ("c/" → "com"), espaços colapsados.
 *  2. Padrões de ALTA confiança: verbo de solicitação + alvo humano no mesmo
 *     enunciado (ex.: "quero falar com atendente", "me transfere para alguém").
 *  3. Padrões de MÉDIA confiança: "atendimento humano" explícito e frases
 *     curtas sem ambiguidade.
 *  4. Guarda de negação: "não quero falar com atendente" NÃO é handoff.
 */

export interface HumanHandoffMatch {
  detected: boolean;
  confidence: "high" | "medium";
  reason?: string;
}

/** Normaliza texto para matching: minúsculas, sem acentos/pontuação. */
export function normalizeHandoffText(input: string): string {
  return String(input ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(?:c|C)\s*\/\s*/g, " com ")
    .replace(/[^a-z0-9\s@+]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Verbos/alvos de solicitação.
const WANT = "(quero|queria|preciso|gostaria|posso|pode|poderia|consegue|consigo|quero saber se)";
const SPEAK = "(falar|conversar|atender|atendimento|ser atendido|ser atendida)";
const HUMAN_TARGET =
  "(humano|humana|atendente|atendentes|pessoa|pessoa real|pessoas|alguem|algu[eé]m|agente|o agente|dono|proprietario|proprietária|responsavel|suporte humano|atendimento humano)";

const HIGH_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  { re: new RegExp(`${WANT}\\s+(?:a|o|de|de um|de uma|um|uma|com o|com a|com)?\\s*${SPEAK}[^.]{0,40}?${HUMAN_TARGET}`), reason: "solicitação explícita de falar/conversar com humano" },
  { re: new RegExp(`${WANT}\\s+(?:falar|conversar)\\s+com\\s+(?:alguem|algu[eé]m)`), reason: "solicitação para falar com alguém" },
  { re: new RegExp(`\\bme\\s+(?:transfere|transferir|passe|passa|coloca|coloque|chama|chame|encaminh[ae])\\b[^.]{0,40}?(?:para|pro|com)?\\s*(?:um|uma|o|a)?\\s*(?:atendente|humano|pessoa|alguem|suporte)`), reason: "pedido de transferência" },
  { re: new RegExp(`\\b(?:transfere|transfira|encaminh[ae])\\s+(?:para|pro)\\s+(?:um|uma|o|a)?\\s*(?:atendente|humano|pessoa|alguem)`), reason: "pedido de transferência direto" },
  { re: new RegExp(`\\bfalar\\s+com\\s+(?:o|a|um|uma)?\\s*(?:dono|proprietario|proprietária|responsavel|atendente|atendentes|humano|pessoa real|agente)`), reason: "falar com dono/atendente/agente" },
  { re: new RegExp(`\\b(?:quero|preciso|posso|pode|gostaria)\\b[^.]{0,30}?\\batendimento\\s+humano\\b`), reason: "pedido de atendimento humano" },
  { re: new RegExp(`\\batendimento\\s+humano\\b`), reason: "expressão explícita de atendimento humano" },
  { re: new RegExp(`\\bpreciso\\s+(?:de\\s+)?(?:um|uma)?\\s*(?:atendente|humano|pessoa)\\b`), reason: "preciso de um atendente" },
  { re: new RegExp(`\\b(?:atendente|humano|pessoa)\\s*(?:por favor|pfv|porfavor|agora|urgente)\\b`), reason: "palavra humana com pedido direto" },
  { re: new RegExp(`${WANT}\\s+(?:um|uma)?\\s*(?:atendente|humano|pessoa real)\\b`), reason: "quero/preciso de um atendente" },
];

// MÉDIA: frases curtas sem ambiguidade ("quero atendimento", "falar com alguém")
const MEDIUM_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  { re: new RegExp(`\\b(?:quero|preciso|gostaria de|posso|pode)\\s+(?:um|uma)?\\s*atendimento\\b(?!\\s+(?:online|digital|automat|telefônico|telefonico))`), reason: "quero atendimento (sem contexto automatizado)" },
  { re: new RegExp(`\\b(?:falar|conversar)\\s+com\\s+alguem\\b`), reason: "falar com alguém" },
  { re: new RegExp(`\\b(?:quero|preciso)\\s+(?:falar\\s+)?com\\s+(?:um|uma)?\\s*(?:humano|atendente|pessoa)\\b`), reason: "quero falar com humano/pessoa" },
];

// Negação: "não quero falar com atendente" etc. — NÃO é handoff.
const NEGATION_PATTERN =
  /\b(?:nao|nunca|jamais)\s+(?:quero|preciso|posso|quero\s+mais|posso\s+mais)?\s*(?:falar|conversar|atender|ser\s+atendid)/;

/** Detecta solicitação de atendimento humano. */
export function detectHumanHandoffRequest(text: string): HumanHandoffMatch {
  const normalized = normalizeHandoffText(text);
  if (!normalized || normalized.length < 4) {
    return { detected: false, confidence: "high" };
  }

  // Guarda de negação: recorta trechos negados antes de casar.
  let haystack = normalized;
  const negationSpans: Array<[number, number]> = [];
  const negRe = /\b(?:nao|nunca|jamais)\b[^.]{0,60}/g;
  let negMatch: RegExpExecArray | null;
  while ((negMatch = negRe.exec(normalized)) !== null) {
    negationSpans.push([negMatch.index, negMatch.index + negMatch[0].length]);
  }
  if (negationSpans.length > 0) {
    // Remove trechos negados do haystack (mantém o resto da frase).
    for (let i = negationSpans.length - 1; i >= 0; i--) {
      const [s, e] = negationSpans[i];
      haystack = haystack.slice(0, s) + " " + haystack.slice(e);
    }
  }

  for (const { re, reason } of HIGH_PATTERNS) {
    if (re.test(haystack)) {
      return { detected: true, confidence: "high", reason };
    }
  }
  for (const { re, reason } of MEDIUM_PATTERNS) {
    if (re.test(haystack)) {
      return { detected: true, confidence: "medium", reason };
    }
  }
  return { detected: false, confidence: "high" };
}
