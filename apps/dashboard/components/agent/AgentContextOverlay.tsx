"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  INTENT_MODE_COLOR,
  INTENT_MODULE_MAP,
  type AgentIntentMode,
} from "./intent-visual-state";
import { useAgentContext } from "./use-agent-context";
import { ContextCardsBody } from "./ContextCardsBody";
import { NeonConnectionLine } from "./savyron/NeonConnectionLine";

/**
 * AgentContextOverlay — orquestra a camada "núcleo acessando módulos do SAVYRON":
 *
 * 1. recebe a intenção (fonte: transcrição do usuário + ferramentas reais da IA);
 * 2. busca os dados REAIS do módulo correspondente;
 * 3. acende a linha neon do núcleo ao card;
 * 4. exibe o card de contexto (dados reais, nunca inventados);
 * 5. acende o módulo orbital correspondente (via onModuleHighlight).
 */
export function AgentContextOverlay({
  intentMode,
  onModuleHighlight,
}: {
  intentMode: AgentIntentMode;
  /** Retorna o ID do módulo orbital a acender (ou null). */
  onModuleHighlight?: (moduleId: string | null) => void;
}) {
  const { context, loadContext } = useAgentContext();
  const prevModeRef = useRef<AgentIntentMode>("idle");
  // Último modo com contexto — mantém o card montado para animar a saída.
  const [lastMode, setLastMode] = useState<AgentIntentMode>("idle");

  // Reage à mudança de intenção: dispara a busca de dados reais.
  useEffect(() => {
    if (intentMode === "idle") {
      prevModeRef.current = "idle";
      onModuleHighlight?.(null);
      return;
    }
    if (intentMode !== prevModeRef.current) {
      prevModeRef.current = intentMode;
      setLastMode(intentMode);
      loadContext(intentMode);
    }
  }, [intentMode, loadContext, onModuleHighlight]);

  // Acende o módulo orbital correspondente (planeja/analisa/executa/pesquisa).
  useEffect(() => {
    if (intentMode === "idle") {
      onModuleHighlight?.(null);
      return;
    }
    onModuleHighlight?.(INTENT_MODULE_MAP[intentMode] ?? null);
  }, [intentMode, onModuleHighlight]);

  const color = INTENT_MODE_COLOR[intentMode === "idle" ? lastMode : intentMode] ?? "#00E5FF";
  const hasContext =
    intentMode === "finance" ||
    intentMode === "agenda" ||
    intentMode === "campaign" ||
    lastMode === "finance" ||
    lastMode === "agenda" ||
    lastMode === "campaign";

  // Ângulo/comprimento da linha: esquerda ou direita (desktop). No mobile a
  // linha é oculta (o card surge abaixo do núcleo) — ver CSS responsivo.
  const lineAngle = intentMode === "campaign" ? 18 : -18;
  const lineLength = 190;

  const lines = useMemo(
    () =>
      hasContext ? (
        <>
          <NeonConnectionLine
            color={color}
            connected={intentMode !== "idle"}
            pulse={context.loading}
            angle={lineAngle}
            length={lineLength}
          />
          <NeonConnectionLine
            color={color}
            connected={intentMode !== "idle"}
            pulse={context.loading}
            angle={-lineAngle}
            length={lineLength}
          />
        </>
      ) : null,
    [hasContext, color, intentMode, context.loading, lineAngle, lineLength],
  );

  return (
    <>
      {/* Linhas neon nas duas laterais do núcleo (desktop ≥ 1024px) */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-30 hidden -translate-x-1/2 -translate-y-1/2 lg:block">
        {lines}
      </div>

      {/* Cards de contexto — laterais no desktop, abaixo do núcleo no mobile.
          Ficam montados enquanto `lastMode` existir; `visible` anima a saída. */}
      <div className="pointer-events-none absolute inset-0 z-40">
        <div
          className="absolute left-4 top-1/2 -translate-y-1/2 max-lg:left-1/2 max-lg:top-auto max-lg:bottom-[24vh] max-lg:-translate-x-1/2 max-lg:translate-y-0"
        >
          <ContextCardsBody
            mode={lastMode === "idle" ? "reports" : lastMode}
            visible={intentMode !== "idle"}
            context={context}
            onClose={() => void 0}
          />
        </div>
      </div>
    </>
  );
}
