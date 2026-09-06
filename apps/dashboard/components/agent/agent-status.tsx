"use client";

import { useEffect, useState } from "react";

import { VoiceState } from "./agent-visual-state";
import type { AgentIntentMode } from "./intent-visual-state";

interface AgentStatusProps {
  state: VoiceState;
  sessionActive: boolean;
  /** Modo de contexto ativo (agenda/finance/campaign/search) — personaliza o texto. */
  intentMode?: AgentIntentMode;
}

const STATUS_TITLES: Record<VoiceState, string> = {
  idle: "Toque para falar",
  connecting: "Conectando...",
  listening: "Ouvindo...",
  "user-speaking": "Ouvindo...",
  "agent-thinking": "Analisando...",
  processing: "Consultando dados...",
  "agent-speaking": "Falando...",
  error: "Microfone indisponível",
};

/** Textos dinâmicos de THINKING por modo (sempre a sentença atual em rotação). */
const THINKING_BY_MODE: Partial<Record<AgentIntentMode, string[]>> = {
  agenda: ["Analisando...", "Consultando agenda...", "Verificando compromissos..."],
  finance: ["Analisando...", "Consultando dados financeiros...", "Calculando..."],
  campaign: ["Analisando...", "Consultando campanhas...", "Medindo desempenho..."],
  search: ["Conectando...", "Pesquisando...", "Analisando resultados...", "Processando..."],
};

const THINKING_DEFAULT = ["Analisando...", "Consultando dados...", "Processando..."];

export function AgentStatus({ state, sessionActive, intentMode }: AgentStatusProps) {
  const [thinkingStep, setThinkingStep] = useState(0);

  // Rotação dos textos de processamento (apenas durante thinking/processing).
  useEffect(() => {
    if (state !== "agent-thinking" && state !== "processing") {
      setThinkingStep(0);
      return;
    }
    const timer = window.setInterval(() => {
      setThinkingStep((s) => s + 1);
    }, 2400);
    return () => window.clearInterval(timer);
  }, [state]);

  const dynamicTitles =
    (intentMode && THINKING_BY_MODE[intentMode]) || THINKING_DEFAULT;
  const isThinkingPhase = state === "agent-thinking" || state === "processing";
  const title = isThinkingPhase
    ? dynamicTitles[thinkingStep % dynamicTitles.length]
    : STATUS_TITLES[state] || "Ouvindo...";

  const titleColorClass =
    state === "agent-speaking"
      ? "neon-text-purple text-[#C084FC]"
      : state === "user-speaking"
        ? "neon-text-cyan text-[#38BDF8]"
        : state === "agent-thinking"
          ? "neon-text-cyan text-[#A855F7]"
          : state === "listening"
            ? "neon-text-blue text-[#818CF8]"
            : state === "processing"
              ? "neon-text-cyan text-[#38BDF8]"
              : state === "error"
                ? "text-[#EF4444]"
                : "text-white/90";

  return (
    <div className="mt-1 sm:mt-8 text-center px-4">
      <h2
        key={title}
        className={`text-2xl sm:text-3xl font-bold tracking-tight transition-colors duration-200 agent-status-title ${titleColorClass}`}
      >
        {title}
      </h2>
    </div>
  );
}
