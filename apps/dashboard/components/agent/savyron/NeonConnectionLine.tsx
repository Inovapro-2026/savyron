"use client";

import { useEffect, useState } from "react";

interface NeonConnectionLineProps {
  /** Cor neon da linha (hex). */
  color: string;
  /** true quando a conexão está estabelecida (linha completa). */
  connected: boolean;
  /** true quando um pulso deve viajar do núcleo até o destino. */
  pulse?: boolean;
  /** Rotação do vetor (graus) — direção do núcleo para o card. */
  angle?: number;
  /** Comprimento da linha em px. */
  length?: number;
  /** Linha vertical (núcleo → card abaixo, mobile). */
  vertical?: boolean;
}

/**
 * NeonConnectionLine — conexão neural entre o núcleo SAVYRON e um card de contexto.
 *
 * Linha fina (1.5px) com:
 * - traço que cresce da origem até o destino (scaleX animado);
 * - glow suave;
 * - pulso luminoso viajando pela linha;
 * - partículas (dots) seguindo o caminho.
 *
 * Renderiza um SVG absoluto de `length` × 12px rotacionado em `angle`.
 * Consumidor posiciona via wrapper (left/top do núcleo).
 */
export function NeonConnectionLine({
  color,
  connected,
  pulse = false,
  angle = 0,
  length = 140,
  vertical = false,
}: NeonConnectionLineProps) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  if (!connected) return null;

  // Vertical (mobile): linha descendo do núcleo, origin no topo.
  const wrapperStyle: React.CSSProperties = vertical
    ? { width: 12, height: length, transform: "rotate(0deg)", transformOrigin: "top center" }
    : { width: length, height: 12, transform: `rotate(${angle}deg)`, transformOrigin: "left center" };

  return (
    <div aria-hidden="true" className="pointer-events-none absolute" style={wrapperStyle}>
      <svg
        width={vertical ? 12 : length}
        height={vertical ? length : 12}
        viewBox={vertical ? `0 0 12 ${length}` : `0 0 ${length} 12`}
        className="overflow-visible"
      >
        <defs>
          <linearGradient
            id={`neon-line-grad-${color.replace("#", "")}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0%" stopColor={color} stopOpacity="0.05" />
            <stop offset="30%" stopColor={color} stopOpacity="0.75" />
            <stop offset="100%" stopColor={color} stopOpacity="0.95" />
          </linearGradient>
        </defs>

        {/* Linha principal — cresce da origem */}
        <line
          x1={vertical ? 6 : 0}
          y1={vertical ? 0 : 6}
          x2={vertical ? 6 : length}
          y2={vertical ? length : 6}
          stroke={`url(#neon-line-grad-${color.replace("#", "")})`}
          strokeWidth="1.5"
          strokeLinecap="round"
          className="savyron-neon-line-grow"
          style={{ filter: `drop-shadow(0 0 4px ${color}66)` }}
        />

        {/* Pulso luminoso viajando pela linha */}
        {pulse && !reducedMotion && (
          <>
            <circle r="2.5" cy={vertical ? undefined : 6} cx={vertical ? 6 : undefined} fill={color} opacity="0.9">
              <animate attributeName={vertical ? "cy" : "cx"} from="0" to={length} dur="1.1s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;0.9;0" dur="1.1s" repeatCount="indefinite" />
            </circle>
            {/* Partículas menores seguindo */}
            <circle r="1.4" cy={vertical ? undefined : 6} cx={vertical ? 6 : undefined} fill={color} opacity="0.55">
              <animate attributeName={vertical ? "cy" : "cx"} from="0" to={length} dur="1.1s" begin="0.35s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;0.55;0" dur="1.1s" begin="0.35s" repeatCount="indefinite" />
            </circle>
            <circle r="1.2" cy={vertical ? undefined : 6} cx={vertical ? 6 : undefined} fill="#ffffff" opacity="0.4">
              <animate attributeName={vertical ? "cy" : "cx"} from="0" to={length} dur="1.1s" begin="0.65s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;0.4;0" dur="1.1s" begin="0.65s" repeatCount="indefinite" />
            </circle>
          </>
        )}

        {/* Ponto de conexão no destino */}
        <circle
          cx={vertical ? 6 : length}
          cy={vertical ? length : 6}
          r="2.2"
          fill={color}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
          className="animate-pulse"
        />
      </svg>
    </div>
  );
}
