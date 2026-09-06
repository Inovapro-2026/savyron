import { createLogger } from "@prospector/logger";
import { resolveApiKey, markApiKeyExhausted } from "./api-keys";

const logger = createLogger("api.agent");

const GROQ_BASE = "https://api.groq.com/openai/v1";

// --- Detecção de erro de quota (para rotação/fallback) ---
function isQuotaError(status: number, body: string): boolean {
  if (status === 401 || status === 429) return true;
  return /quota|credit|limit|remaining|character|insufficient|rate/i.test(body);
}

/**
 * Executa `fn(key)` com rotação automática de chaves do provedor:
 * se a chave ativa falhar por quota, marca como esgotada e tenta a próxima.
 * Retorna { ok, value?, error?, quotaExhausted }.
 */
async function callWithKeyRotation<T>(
  provider: "groq" | "elevenlabs",
  fn: (key: string) => Promise<{ status: number; body: string; value: T }>,
  maxAttempts = 5,
): Promise<{
  ok: boolean;
  value?: T;
  error?: { status: number; body: string };
}> {
  let lastError: { status: number; body: string } | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const key = await resolveApiKey(provider);
    if (!key) {
      if (attempt > 0) break;
      return {
        ok: false,
        error: { status: 0, body: "Nenhuma chave configurada" },
      };
    }
    try {
      const result = await fn(key);
      if (result.status < 200 || result.status >= 300) {
        lastError = { status: result.status, body: result.body };
        const bodyLower = result.body.toLowerCase();
        if (bodyLower.includes("rate_limit") || bodyLower.includes("rate limit")) {
          await new Promise((r) => setTimeout(r, 2500));
          continue;
        }
        if (isQuotaError(result.status, result.body)) {
          await markApiKeyExhausted(provider, key, result.body.slice(0, 300));
          logger.warn("Chave esgotada na rotação do agente; tentando próxima", {
            provider,
            attempt: attempt + 1,
          });
          continue;
        }
        return { ok: false, error: lastError };
      }
      return { ok: true, value: result.value };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      lastError = { status: 0, body: message };
      // Erro de rede/timeout: não marca como esgotada, apenas falha.
      return { ok: false, error: lastError };
    }
  }
  return {
    ok: false,
    error: lastError ?? { status: 0, body: "Sem chaves disponíveis" },
  };
}

// --- STT via Groq Whisper ---
export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string,
): Promise<string> {
  const blob = new Blob([audioBuffer], { type: mimeType });
  const formData = new FormData();
  formData.append(
    "file",
    blob,
    `audio.${mimeType.includes("webm") ? "webm" : "mp3"}`,
  );
  formData.append("model", "whisper-large-v3");
  formData.append("language", "pt");

  const { ok, value } = await callWithKeyRotation<string>(
    "groq",
    async (key) => {
      const res = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        body: formData,
      });
      const body = await res.text().catch(() => "");
      const transcript = (() => {
        try {
          return (JSON.parse(body) as { text?: string }).text?.trim() ?? "";
        } catch {
          return "";
        }
      })();
      return { status: res.status, body, value: transcript };
    },
  );

  if (!ok) {
    logger.error("Falha no STT Groq", { error: value });
    return "";
  }
  return value ?? "";
}

// --- Main chat handler — JARVIS (cérebro de consulta, somente leitura) ---
export async function processChat(
  businessId: string,
  userId: string,
  transcript: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<{ text: string; pendingAction: boolean; toolsUsed: string[] }> {
  const { jarvisChat } = await import("./jarvis-service");
  return jarvisChat(businessId, userId, transcript, history);
}

// --- TTS via Kokoro (self-hosted, local) com fallback para voz do navegador ---
export interface TtsResult {
  ok: boolean;
  /** Áudio WAV (buffer) quando ok=true. */
  audio?: Buffer;
  /** true quando deve usar a voz nativa do navegador (quota/erro). */
  fallbackToBrowser: boolean;
  /** Motivo do fallback, para log no frontend. */
  fallbackReason?: "quota" | "error";
}

const KOKORO_URL = process.env.KOKORO_URL ?? "http://localhost:8000";
const KOKORO_VOICE = process.env.KOKORO_VOICE ?? "pm_alex";
const KOKORO_LANG = process.env.KOKORO_LANG ?? "p";
const KOKORO_SPEED = Number(process.env.KOKORO_SPEED ?? "1");
const KOKORO_TIMEOUT_MS = Number(process.env.KOKORO_TIMEOUT_MS ?? "30000");

export async function textToSpeech(text: string): Promise<TtsResult> {
  const { normalizeForTTS } = await import("./tts-normalizer");
  const ttsText = normalizeForTTS(text);
  logger.info("[DEBUG TTS] Texto normalizado enviado ao Kokoro", { ttsText });

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), KOKORO_TIMEOUT_MS);
    const response = await fetch(`${KOKORO_URL}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: ttsText,
        voice: KOKORO_VOICE,
        lang: KOKORO_LANG,
        speed: KOKORO_SPEED,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (response.ok) {
      const audio = Buffer.from(await response.arrayBuffer());
      if (audio.length > 0) {
        return { ok: true, audio, fallbackToBrowser: false };
      }
    }
    logger.warn("Kokoro TTS retornou resposta inválida", {
      status: response.status,
    });
    return {
      ok: false,
      fallbackToBrowser: true,
      fallbackReason: "error",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn("Kokoro TTS indisponível — agente usará voz do navegador", {
      fallback: "error",
      error: message,
    });
    return {
      ok: false,
      fallbackToBrowser: true,
      fallbackReason: "error",
    };
  }
}