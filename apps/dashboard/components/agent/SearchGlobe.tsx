"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

export type SearchPhase =
  | "PESQUISANDO"
  | "CONECTANDO"
  | "ANALISANDO"
  | "PROCESSANDO";

interface SearchGlobeProps {
  active: boolean;
  phase?: SearchPhase | null;
  /** true quando o chat já respondeu (globo se reduz e devolve a cena). */
  done?: boolean;
}

/**
 * SearchGlobe — representação visual da pesquisa (não é um navegador).
 *
 * Globo wireframe em SVG: meridianos + paralelos + nós luminosos + partículas
 * orbitando + rotação lenta contínua com glow cyan/blue. Cada fase troca o
 * rótulo e acelera a rotação. Respeita prefers-reduced-motion.
 */
export function SearchGlobe({ active, phase, done = false }: SearchGlobeProps) {
  const reduceMotion = useReducedMotion();
  const [phaseIndex, setPhaseIndex] = useState(0);
  const phases: SearchPhase[] = [
    "CONECTANDO",
    "PESQUISANDO",
    "ANALISANDO",
    "PROCESSANDO",
  ];

  useEffect(() => {
    if (!active || done) return;
    const timer = window.setInterval(() => {
      setPhaseIndex((i) => (i + 1) % phases.length);
    }, 1800);
    return () => window.clearInterval(timer);
  }, [active, done]);

  const label = done ? "CONCLUÍDO" : phase ?? phases[phaseIndex];
  const spinDuration = done ? "6s" : phase ? "4.5s" : reduceMotion ? "0s" : "9s";

  if (!active) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.55 }}
      animate={{ opacity: 1, scale: done ? 0.9 : 1 }}
      exit={{ opacity: 0, scale: 0.6 }}
      transition={
        reduceMotion
          ? { duration: 0.15 }
          : { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
      }
      className="pointer-events-none absolute left-[17%] top-[38%] z-30 -translate-x-1/2 -translate-y-1/2 max-lg:left-1/2 max-lg:top-[15%]"
      role="status"
      aria-label={`Pesquisa em andamento: ${label}`}
    >
      <div className="relative flex h-[280px] w-[280px] items-center justify-center">
        {/* Glow externo */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(0,140,255,0.16) 0%, rgba(0,229,255,0.07) 45%, transparent 70%)",
            filter: "blur(24px)",
          }}
        />

        {/* Globo wireframe */}
        <svg
          width="200"
          height="200"
          viewBox="0 0 200 200"
          className="relative overflow-visible"
          style={{ filter: "drop-shadow(0 0 18px rgba(0,160,255,0.35))" }}
        >
          <defs>
            <radialGradient id="globe-core-grad" cx="42%" cy="36%" r="70%">
              <stop offset="0%" stopColor="#0E2A4A" stopOpacity="0.95" />
              <stop offset="60%" stopColor="#071730" stopOpacity="0.97" />
              <stop offset="100%" stopColor="#030B18" stopOpacity="1" />
            </radialGradient>
          </defs>

          {/* Esfera base */}
          <circle cx="100" cy="100" r="78" fill="url(#globe-core-grad)" stroke="rgba(0,229,255,0.5)" strokeWidth="1.4" />

          {/* Grupo rotativo: meridianos + paralelos + nós */}
          <g
            style={{
              transformOrigin: "100px 100px",
              animation: reduceMotion
                ? undefined
                : `savGlobeSpin ${spinDuration} linear infinite`,
            }}
          >
            {/* Meridianos */}
            <ellipse cx="100" cy="100" rx="78" ry="78" fill="none" stroke="rgba(0,229,255,0.35)" strokeWidth="1" />
            <ellipse cx="100" cy="100" rx="56" ry="78" fill="none" stroke="rgba(0,229,255,0.28)" strokeWidth="0.9" />
            <ellipse cx="100" cy="100" rx="30" ry="78" fill="none" stroke="rgba(0,229,255,0.22)" strokeWidth="0.8" />
            <ellipse cx="100" cy="100" rx="78" ry="56" fill="none" stroke="rgba(56,189,248,0.28)" strokeWidth="0.9" />
            <ellipse cx="100" cy="100" rx="78" ry="30" fill="none" stroke="rgba(56,189,248,0.22)" strokeWidth="0.8" />
            {/* Equador */}
            <ellipse cx="100" cy="100" rx="78" ry="14" fill="none" stroke="rgba(0,229,255,0.45)" strokeWidth="1" />

            {/* Nós luminosos (pontos de dados) */}
            {[
              { x: 138, y: 66 },
              { x: 62, y: 84 },
              { x: 108, y: 132 },
              { x: 76, y: 148 },
              { x: 148, y: 108 },
            ].map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="3" fill="#00E5FF" style={{ filter: "drop-shadow(0 0 5px #00E5FF)" }} />
                <circle cx={p.x} cy={p.y} r="6.5" fill="none" stroke="#00E5FF" strokeOpacity="0.35" strokeWidth="0.8" />
              </g>
            ))}
          </g>

          {/* Anel orbital externo (contra-rotação) */}
          <g
            style={{
              transformOrigin: "100px 100px",
              animation: reduceMotion
                ? undefined
                : `savGlobeSpinRev ${spinDuration === "0s" ? "0s" : "14s"} linear infinite`,
            }}
          >
            <ellipse cx="100" cy="100" rx="92" ry="92" fill="none" stroke="rgba(0,140,255,0.3)" strokeWidth="0.8" strokeDasharray="6 10" />
            <circle cx="100" cy="8" r="3.2" fill="#008CFF" style={{ filter: "drop-shadow(0 0 6px #008CFF)" }} />
          </g>
        </svg>

        {/* Partículas orbitando (CSS) */}
        {!reduceMotion && (
          <>
            <div className="absolute inset-0 animate-sav-globe-orbit" aria-hidden="true">
              <span className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-cyan-300 shadow-[0_0_8px_#00E5FF]" />
            </div>
            <div
              className="absolute inset-6 animate-sav-globe-orbit"
              style={{ animationDuration: "7s", animationDirection: "reverse" }}
              aria-hidden="true"
            >
              <span className="absolute left-1/2 top-0 h-1 w-1 -translate-x-1/2 rounded-full bg-sky-400 shadow-[0_0_6px_#38BDF8]" />
            </div>
          </>
        )}

        {/* Rótulo de fase */}
        <AnimatePresence mode="wait">
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="absolute -bottom-2 left-1/2 -translate-x-1/2"
          >
            <div className="flex items-center gap-2 rounded-full border border-[#008CFF]/40 bg-[#030B18]/90 px-3.5 py-1.5 backdrop-blur-md">
              <span
                className={`h-1.5 w-1.5 rounded-full ${done ? "bg-[#00E5A0]" : "bg-cyan-400 animate-pulse"}`}
                style={{ boxShadow: done ? "0 0 8px #00E5A0" : "0 0 8px #00E5FF" }}
              />
              <span className="font-mono text-[10px] font-semibold tracking-[0.28em] text-cyan-200">
                {label}
              </span>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
