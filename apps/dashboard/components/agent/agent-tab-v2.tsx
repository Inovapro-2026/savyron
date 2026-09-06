"use client";

import { useCallback, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { RotateCcw } from "lucide-react";

import { AgentStatus } from "./agent-status";
import { ConversationList } from "./conversation-bubble";
import { VoiceControls } from "./voice-controls";
import { ConnectionStatus } from "./connection-status";
import { LanguageSelector } from "./language-selector";
import { MicUnsupported } from "./mic-unsupported";
import { useAgentConversation } from "./use-agent-conversation";
import { mapVoiceStateToSavyron } from "./agent-visual-state";
import { SavyronAIBackground } from "./savyron";
import type { SavyronModuleId } from "./savyron";
import { AgentContextOverlay } from "./AgentContextOverlay";
import { SearchGlobe } from "./SearchGlobe";

/**
 * Agente visual V2 — núcleo holográfico SAVYRON dirigido pelo MOTOR REAL.
 * O fundo full-bleed (SavyronAIBackground) reage exclusivamente ao estado do
 * agente (mapVoiceStateToSavyron) e à amplitude real do microfone/TTS
 * (audioLevel). Nenhum estado, métrica ou módulo é simulado.
 *
 * MOBILE: composição fullscreen própria — núcleo centrado, status/controles
 * ancorados na base ACIMA da Bottom Navigation (via SavyronAIBackground),
 * sem scroll.
 */
export function AgentTabV2() {
  const {
    status,
    sessionActive,
    isMuted,
    audioLevel,
    micDiagnostic,
    transcript,
    history,
    lastAssistant,
    usingBrowserVoice,
    micDisabled,
    showErrorCard,
    errorInfo,
    intent,
    handlePress,
    handleRetry,
    stopSession,
    toggleMute,
    refresh,
  } = useAgentConversation();

  const savyronState = mapVoiceStateToSavyron(status);
  const [highlightedModule, setHighlightedModule] = useState<string | null>(null);

  const handleModuleHighlight = useCallback((label: string | null) => {
    setHighlightedModule(label);
  }, []);

  // Amplitude real (microfone ou TTS) alimenta boca/olhos/anéis do núcleo sem valores artificiais em repouso
  const amplitude =
    status === "agent-speaking"
      ? audioLevel
      : status === "user-speaking" || status === "listening"
        ? Math.min(0.85, audioLevel)
        : 0;

  return (
    <SavyronAIBackground
      state={savyronState}
      audioAmplitude={amplitude}
      showStatusPill={true}
      activeModule={(highlightedModule as SavyronModuleId) || undefined}
    >
      {/* Globo de pesquisa — quando a IA está pesquisando (tool real search_web) */}
      <AnimatePresence>
        {intent?.mode === "search" &&
        (status === "agent-thinking" ||
          status === "processing" ||
          status === "agent-speaking") ? (
          <SearchGlobe
            key="search-globe"
            active
            done={status === "agent-speaking"}
          />
        ) : null}
      </AnimatePresence>

      {/* Overlay de contexto: linha neon + card com dados reais do módulo */}
      <AgentContextOverlay
        intentMode={intent?.mode ?? "idle"}
        onModuleHighlight={handleModuleHighlight}
      />

      <div className="agent-voice-root relative z-30 w-full h-full lg:h-[100dvh] flex flex-col items-center justify-end pointer-events-none">
        <div className="agent-voice-stack pointer-events-auto w-full max-w-2xl mx-auto px-4 pb-1 flex flex-col items-center gap-1">
          {/* Estado da IA — imediatamente acima dos controles (mobile) */}
          <AgentStatus state={status} sessionActive={sessionActive} intentMode={intent?.mode} />

          {/* Modo consulta — SOMENTE LEITURA */}
          <div className="agent-readonly-badge mt-0.5 inline-flex max-w-[calc(100%-32px)] items-center gap-1.5 rounded-full agent-glass-card px-3 py-2 text-[11px] leading-tight font-medium text-cyan-300/90">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
            <span className="truncate">JARVIS · Modo consulta (somente leitura)</span>
          </div>

          {/* Fallback indicador: Voz do navegador */}
          {usingBrowserVoice && status !== "error" && (
            <div className="inline-flex max-w-[calc(100%-32px)] items-center gap-1.5 rounded-full agent-glass-card px-3 py-2 text-[11px] font-medium text-amber-300">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400 animate-pulse" />
              <span className="truncate">Voz do navegador (fallback)</span>
            </div>
          )}

          {/* Card de Erro Específico com Orientação */}
          {showErrorCard && errorInfo && (
            <div className="mt-2 w-full max-w-sm rounded-2xl border border-red-500/30 bg-red-950/40 p-4 text-center backdrop-blur-md shadow-xl">
              <div className="text-sm font-semibold text-red-300">
                {errorInfo.title}
              </div>
              <p className="mt-1 text-xs text-red-400">{errorInfo.message}</p>
              <div className="mt-3 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleRetry()}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 transition-colors cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {errorInfo.actionLabel}
                </button>
              </div>
            </div>
          )}

          {micDisabled && status !== "error" ? (
            <MicUnsupported
              diagnostic={micDiagnostic}
              onRetry={() => void refresh()}
            />
          ) : (
            <>
              {/* Controles de Voz (Microfone, Mute, Encerrar) */}
              <div className="w-full">
                <VoiceControls
                  state={status}
                  sessionActive={sessionActive}
                  isMuted={isMuted}
                  audioLevel={audioLevel}
                  onToggleMute={toggleMute}
                  onToggleMic={handlePress}
                  onEndCall={stopSession}
                  disabled={micDisabled}
                />
              </div>
            </>
          )}

          {/* Barra Inferior com Indicadores (Status de Conexão + Idioma) */}
          <div className="flex w-full items-center justify-between px-2 sm:px-8 py-1.5 border-t border-white/5 text-[11px]">
            <ConnectionStatus state={status} sessionActive={sessionActive} />
            <LanguageSelector />
          </div>
        </div>
      </div>
    </SavyronAIBackground>
  );
}
