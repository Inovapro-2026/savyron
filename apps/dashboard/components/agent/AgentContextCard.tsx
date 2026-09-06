"use client";

import { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { LucideIcon } from "lucide-react";

export type ContextCardSide = "left" | "right" | "bottom";

export interface AgentContextCardProps {
  /** Tipo/módulo de origem (agenda | finance | campaign | search | leads | reports). */
  type: string;
  title: string;
  icon: LucideIcon;
  /** Cor neon (hex) da barra lateral e borda. */
  color: string;
  /** Conteúdo com dados REAIS (nunca valores inventados). */
  children: ReactNode;
  /** Estado opcional (ex.: "Confirmado", "Em execução"). */
  status?: { label: string; color: string } | null;
  /** Posição relativa ao núcleo. */
  side?: ContextCardSide;
  /** Visível? */
  visible: boolean;
  /** Botão opcional de fechar. */
  onClose?: () => void;
}

/**
 * AgentContextCard — card de contexto genérico conectado ao núcleo SAVYRON.
 *
 * Visual: dark glass (rgba(4,8,18,.92)) + blur(18px) + borda neon da cor do
 * módulo + glow suave + barra neon lateral. Animado com Framer Motion
 * (entrada: scale .75→1 + fade + translate do lado do núcleo; saída suave).
 * Respeita prefers-reduced-motion.
 */
export function AgentContextCard({
  type,
  title,
  icon: Icon,
  color,
  children,
  status = null,
  side = "right",
  visible,
  onClose,
}: AgentContextCardProps) {
  const reduceMotion = useReducedMotion();

  // Offset inicial: card "nasce" do lado do núcleo e desliza até a posição.
  const enterOffset =
    side === "left" ? { x: 40, y: 0 } : side === "right" ? { x: -40, y: 0 } : { x: 0, y: -36 };

  return (
    <motion.div
      data-context-card={type}
      role="region"
      aria-label={`Contexto: ${title}`}
      initial={{ opacity: 0, scale: 0.75, x: enterOffset.x, y: enterOffset.y }}
      animate={
        visible
          ? { opacity: 1, scale: 1, x: 0, y: 0 }
          : { opacity: 0, scale: 0.92, x: enterOffset.x, y: enterOffset.y }
      }
      transition={
        reduceMotion
          ? { duration: 0.15, ease: "easeOut" }
          : { duration: 0.65, ease: [0.22, 1, 0.36, 1] }
      }
      className="pointer-events-auto relative z-40 w-[min(340px,calc(100vw-32px))]"
      style={{ display: visible ? undefined : "none" }}
    >
      <div
        className="relative overflow-hidden rounded-[18px] border backdrop-blur-md"
        style={{
          background: "rgba(4, 8, 18, 0.92)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          borderColor: `${color}59`,
          boxShadow: `0 0 30px ${color}2e, inset 0 1px 0 rgba(255,255,255,0.04)`,
        }}
      >
        {/* Barra neon lateral */}
        <div
          aria-hidden="true"
          className="absolute left-0 top-0 bottom-0 w-[3px]"
          style={{
            background: `linear-gradient(180deg, ${color}, ${color}33)`,
            boxShadow: `0 0 12px ${color}88`,
          }}
        />

        {/* Glow radial discreto no topo */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(circle at 85% 0%, ${color}1a, transparent 42%)`,
          }}
        />

        {/* Header */}
        <div className="relative flex items-center justify-between gap-2 pl-5 pr-3 pt-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border"
              style={{
                background: `${color}1f`,
                borderColor: `${color}52`,
                boxShadow: `0 0 15px ${color}2e`,
              }}
            >
              <Icon className="h-4.5 w-4.5" style={{ color }} />
            </div>
            <div className="min-w-0">
              <div
                className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.22em]"
                style={{ color: `${color}cc` }}
              >
                {type}
              </div>
              <div className="truncate text-[13px] font-semibold text-white">
                {title}
              </div>
            </div>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar contexto"
              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-300"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          ) : null}
        </div>

        {/* Conteúdo (dados reais) — mobile: altura limitada com scroll interno */}
        <div className="relative px-5 pb-4 pt-3 max-lg:max-h-[30dvh] max-lg:overflow-y-auto">
          {children}
        </div>

        {/* Status footer */}
        {status ? (
          <div
            className="relative flex items-center gap-2 border-t px-5 py-2.5"
            style={{ borderColor: "rgba(255,255,255,0.05)" }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: status.color, boxShadow: `0 0 8px ${status.color}` }}
            />
            <span className="text-[11px] font-medium text-slate-400">
              {status.label}
            </span>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
