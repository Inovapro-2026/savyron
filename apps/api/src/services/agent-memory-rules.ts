/**
 * REGRAS PURAS da memória do agente (sem dependências de banco).
 * Isoladas para testes unitários (tests/agent-memory.test.mjs).
 */

/** Chave estável de preferência de tratamento ("como chamar o usuário"). */
export const KEY_TRATAMENTO = "pref:tratamento";
/** Chave estável de tratamentos a evitar ("não me chame de X"). */
export const KEY_EVITAR = "pref:evitar";
/** Chave estável do recap de conversas recentes. */
export const KEY_RECAP = "conv:recent";

/** Máximo de linhas no recap. */
export const RECAP_MAX_LINES = 6;
const RECAP_LINE_MAX = 140;

export interface ExtractedPreference {
  /** Chave estável de upsert (substitui preferência anterior da mesma chave). */
  key: string;
  category: "PREFERENCE" | "INSTRUCTION";
  importance: number;
  /** Texto legível que será lembrado pelo agente. */
  content: string;
}

function cleanCapture(raw: string): string {
  return sanitizeMemoryContent(
    raw
      .replace(/^(apenas|somente|só|apenas\s+como|somente\s+como|como)\s+/i, "")
      .trim(),
  ).replace(/^["'“”]+|["'“”]+$/g, "");
}

export function sanitizeMemoryContent(text: string): string {
  return text
    .replace(/[<>`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

export function extractPreferenceFromText(text: string): ExtractedPreference | null {
  const t = String(text ?? "").trim();
  if (!t || t.length > 400) return null;

  // 1) EVITAR tratamento (negação tem prioridade para não sobrescrever por engano)
  const evitar =
    t.match(/n[ãa]o\s+me\s+cham(?:e|a|as|am|em|ando|ar|arem)\s+de\s+([^.,!?;\n]+)/i) ??
    t.match(/n[ãa]o\s+me\s+trate\s+como\s+([^.,!?;\n]+)/i) ??
    t.match(/nunca\s+me\s+cham(?:e|a|as|am|em|ando|ar|arem)\s+de\s+([^.,!?;\n]+)/i);
  if (evitar?.[1]) {
    const alvo = cleanCapture(evitar[1]);
    if (alvo.length >= 2 && alvo.length <= 60) {
      return {
        key: KEY_EVITAR,
        category: "INSTRUCTION",
        importance: 4,
        content: `Não chamar o usuário de "${alvo}".`,
      };
    }
  }

  // 2) TRATAMENTO preferido
  const positivo =
    t.match(/me\s+cham(?:e|a|as|am|em|ando|ar|arem)\s+de\s+([^.,!?;\n]+)/i) ??
    t.match(/me\s+cham(?:ar|arme)?\s+de\s+([^.,!?;\n]+)/i) ??
    t.match(/pode\s+me\s+chamar\s+de\s+([^.,!?;\n]+)/i) ??
    t.match(/quero\s+ser\s+chamad[oa]\s+de\s+([^.,!?;\n]+)/i) ??
    t.match(/prefiro\s+ser\s+chamad[oa]\s+de\s+([^.,!?;\n]+)/i) ??
    t.match(/prefiro\s+que\s+me\s+chame(?:m)?\s+de\s+([^.,!?;\n]+)/i) ??
    t.match(/me\s+trat[ae]\s+como\s+([^.,!?;\n]+)/i) ??
    t.match(/pode\s+me\s+tratar\s+por\s+([^.,!?;\n]+)/i);
  if (positivo?.[1]) {
    const alvo = cleanCapture(positivo[1]);
    // Tratamento precisa ser curto ("Primário", "Chefe", "Sr. Silva") — não frases.
    if (alvo.length >= 2 && alvo.split(" ").length <= 4) {
      return {
        key: KEY_TRATAMENTO,
        category: "PREFERENCE",
        importance: 5,
        content: `Tratamento preferido: chamar o usuário de "${alvo}".`,
      };
    }
  }

  // 3) INSTRUÇÕES de comportamento (tom/estilo)
  const tom =
    t.match(/\bseja\s+mais\s+(formal|informal|curto|direto|objetivo|did[áa]tico|t[ée]cnico|descontra[íi]do)\b/i) ??
    t.match(/\bresponda?\s+(mais\s+)?(curto|direto|r[áa]pido|formal)\b/i) ??
    t.match(/\bsem\s+(emojis?|g[íi]rias)\b/i) ??
    t.match(/n[ãa]o\s+use\s+(emojis?|g[íi]rias)\b/i);
  if (tom) {
    return {
      key: "pref:estilo",
      category: "INSTRUCTION",
      importance: 3,
      content: `Preferência de estilo registrada a partir de: "${sanitizeMemoryContent(t).slice(0, 120)}".`,
    };
  }

  return null;
}

export function buildRecapLine(userText: string, assistantText: string): string {
  const u = sanitizeMemoryContent(userText).slice(0, RECAP_LINE_MAX);
  const a = sanitizeMemoryContent(assistantText).slice(0, RECAP_LINE_MAX);
  const ts = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return `[${ts}] Você: ${u} → Agente: ${a}`;
}

export function mergeRecapLines(existingLines: string[], newLine: string): string[] {
  const clean = existingLines
    .filter((l) => typeof l === "string" && l.trim().length > 0)
    .slice(-Math.max(0, RECAP_MAX_LINES - 1));
  return [...clean, newLine].slice(-RECAP_MAX_LINES);
}
