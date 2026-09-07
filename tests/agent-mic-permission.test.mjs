/**
 * TESTES: microfone "bloqueado" no Agente mesmo com permissão concedida.
 *
 * Causa raiz corrigida:
 * 1. Permission API reportava 'denied' para o dispositivo PADRÃO mesmo com
 *    permissão concedida a outro (Chrome armazena permissão POR DISPOSITIVO —
 *    caso da captura com 4 microfones) → agora 'denied' é confirmado com
 *    captura REAL (probe) antes de mostrar "bloqueado".
 * 2. Dupla captura getUserMedia em beginListening (requestPermission parava
 *    as tracks e o agente pedia de novo) → 2ª captura podia falhar com
 *    NotAllowed/NotReadable transitório → agora UMA captura com stream reutilizado.
 * 3. Catch de beginListening tratava erros com mapeamento manual incompleto
 *    (3 nomes) → agora usa diagnoseMicError (todos os tipos diferenciados).
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

const MIC_HOOK = read("apps/dashboard/hooks/use-microphone.ts");
const AGENT_HOOK = read("apps/dashboard/components/agent/use-agent-conversation.ts");

test("mic: 'denied' da Permission API é confirmado com captura real (probe) antes de bloquear", () => {
  // O ramo denied da query agora consulta o estado REAL via getUserMedia:
  const deniedBranch = MIC_HOOK.slice(
    MIC_HOOK.indexOf('if (state === "denied")'),
    MIC_HOOK.indexOf('permission: "prompt"'),
  );
  assert.ok(
    MIC_HOOK.includes("QUIRK DO CHROME"),
    "comenta o quirk de permissão por dispositivo",
  );
  assert.ok(
    deniedBranch.includes("probeMicrophoneCapture()"),
    "denied é verificado com captura real",
  );
  assert.ok(
    deniedBranch.includes("if (probe.available) return probe;"),
    "probe com sucesso sobrescreve o 'denied' mentiroso",
  );
});

test("mic: probeMicrophoneCapture captura de verdade e mede RMS (silêncio total detectável)", () => {
  assert.ok(MIC_HOOK.includes("export async function probeMicrophoneCapture"));
  assert.ok(
    /getUserMedia\(\{\s*audio: constraints \?\? true/.test(MIC_HOOK),
    "probe usa o dispositivo padrão (sem deviceId fixo)",
  );
  assert.ok(MIC_HOOK.includes("silent: rms < 1e-5"), "detecta mic mudo no SO");
  assert.ok(
    /finally\s*\{[\s\S]*?getTracks\(\)\.forEach\(\(t\) => t\.stop\(\)\)/.test(
      MIC_HOOK,
    ),
    "probe libera o stream capturado",
  );
});

test("mic: requestPermission aceita keepStream e devolve o stream vivo", () => {
  assert.ok(
    MIC_HOOK.includes("options?: { keepStream?: boolean }"),
    "aceita keepStream",
  );
  assert.ok(
    /if \(!keepStream\) \{\s*stream\.getTracks\(\)\.forEach\(\(t\) => t\.stop\(\)\);\s*\}/.test(
      MIC_HOOK,
    ),
    "só para as tracks quando NÃO é keepStream",
  );
  assert.ok(
    /\.\.\.\(keepStream \? \{ stream \} : \{\}\)/.test(MIC_HOOK),
    "retorna o stream quando keepStream",
  );
});

test("mic: beginListening faz CAPTURA ÚNICA reutilizando o stream (sem 2ª getUserMedia)", () => {
  assert.ok(
    AGENT_HOOK.includes("requestPermission({ keepStream: true })"),
    "pede permissão mantendo o stream vivo",
  );
  // O getUserMedia restante é apenas fallback defensivo atrás de `if (!stream)`:
  const begin = AGENT_HOOK.slice(
    AGENT_HOOK.indexOf("CAPTURA ÚNICA"),
    AGENT_HOOK.indexOf("await resumeAudioContext()"),
  );
  assert.ok(begin.includes("let stream = diag.stream;"), "reutiliza o stream");
  const gum = begin.match(/stream = await navigator\.mediaDevices\.getUserMedia/);
  assert.ok(gum, "fallback defensivo existe");
  assert.ok(
    /if \(!stream\) \{\s*stream = await navigator\.mediaDevices\.getUserMedia/.test(
      begin,
    ),
    "getUserMedia só roda quando o stream não veio (fallback)",
  );
  // Guard de sessão para as tracks do stream reutilizado:
  assert.ok(
    begin.includes("diag.stream?.getTracks().forEach((t) => t.stop());"),
    "tracks paradas se a sessão ficou obsoleta",
  );
});

test("mic: catch de beginListening usa diagnoseMicError (todos os tipos diferenciados)", () => {
  const catchBlock = AGENT_HOOK.slice(
    AGENT_HOOK.lastIndexOf("} catch (error) {"),
    AGENT_HOOK.lastIndexOf("stopStream();"),
  );
  assert.ok(
    catchBlock.includes("diagnoseMicError(error)"),
    "usa o diagnóstico completo do erro",
  );
  assert.ok(
    !catchBlock.includes("micErrorAction(micDiagnostic"),
    "não reusa diagnóstico antigo cacheado",
  );
  // diagnoseMicError diferencia TODOS os nomes de erro relevantes:
  for (const errName of [
    "NotAllowedError",
    "NotFoundError",
    "NotReadableError",
    "OverconstrainedError",
    "SecurityError",
    "AbortError",
  ]) {
    assert.ok(
      MIC_HOOK.includes(errName),
      `erro ${errName} tem mensagem específica`,
    );
  }
});

test("mic: 'bloqueado' só para erro real de permissão (NOT_ALLOWED)", () => {
  // O título "Microfone bloqueado" existe apenas no caso NOT_ALLOWED:
  const action = MIC_HOOK.slice(
    MIC_HOOK.indexOf("export function micErrorAction"),
    MIC_HOOK.indexOf("export interface UseMicrophoneResult"),
  );
  // Extrai do `case "X":` (incluindo fall-throughs) até o fim do return dele:
  const seg = (code) => {
    const start = action.indexOf(`case "${code}"`);
    assert.ok(start > -1, `case ${code} existe`);
    const end = action.indexOf("};", action.indexOf("return {", start));
    return action.slice(start, end);
  };
  assert.ok(
    seg("NOT_ALLOWED").includes('"Microfone bloqueado"'),
    "bloqueio → título NOT_ALLOWED",
  );
  // NOT_READABLE (mic em uso) NÃO usa título de bloqueio:
  const readableSeg = seg("NOT_READABLE");
  assert.ok(
    readableSeg.includes('"Microfone indisponível"'),
    "mic em uso → 'indisponível'",
  );
  assert.ok(
    !readableSeg.includes('"Microfone bloqueado"'),
    "mic em uso nunca diz 'bloqueado'",
  );
  // NotFound → título próprio:
  assert.ok(
    seg("NOT_FOUND").includes('"Microfone não encontrado"'),
    "sem microfone → título próprio",
  );
  // diagnoseMicError: título genérico NUNCA menciona bloqueio:
  const generic = MIC_HOOK.slice(
    MIC_HOOK.indexOf("default:"),
    MIC_HOOK.indexOf("/** Mensagem de orientação por erro"),
  );
  assert.ok(
    !generic.includes("bloqueado"),
    "erro genérico não diz 'bloqueado'",
  );
});

test("mic: Tentar novamente reavalia o estado atual (nova captura, sem cache)", () => {
  // handleRetry → beginListening → requestPermission (captura nova):
  const retry = AGENT_HOOK.slice(
    AGENT_HOOK.indexOf("const handleRetry"),
    AGENT_HOOK.indexOf("// Tratamento de erros de microfone"),
  );
  assert.ok(retry.includes("beginListening"));
  // beginListening sempre parte de streamRef null em falha (stopStream no catch
  // e no estado denied) — a próxima tentativa captura de novo de verdade:
  const begin = AGENT_HOOK.slice(
    AGENT_HOOK.indexOf("CAPTURA ÚNICA"),
    AGENT_HOOK.indexOf("await resumeAudioContext()"),
  );
  assert.ok(
    begin.includes("diag.stream?.getTracks().forEach((t) => t.stop());"),
    "falha não deixa stream órfão — retry recomeça do zero",
  );
});

test("mic: permissão concedida inicia escuta sem pedir de novo (sem prompt redundante)", () => {
  // Com permissão já concedida, a ÚNICA captura resolve sem prompt:
  assert.ok(
    AGENT_HOOK.includes("requestPermission({ keepStream: true })") &&
      AGENT_HOOK.includes("streamRef.current = stream"),
    "fluxo granted → listening com stream reutilizado",
  );
  assert.ok(AGENT_HOOK.includes('setStatus("listening")'));
});
