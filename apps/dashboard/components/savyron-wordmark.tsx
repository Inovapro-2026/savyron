/**
 * Wordmark SAVYRON — texto animado em neon leve (substitui a imagem
 * /logo.png no topo do menu). Glow em azul marinho, pulso sutil.
 * `compact` reduz o tamanho para o menu recolhido.
 */
export function SavyronWordmark({
  compact = false,
  className = "",
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`savyron-wordmark ${compact ? "savyron-wordmark--compact" : ""} ${className}`}
      aria-label="SAVYRON"
    >
      SAVYRON
    </span>
  );
}
