'use client';

import { motion } from 'framer-motion';

/** "Pulso de 3 pontinhos" exibido enquanto a IA está pensando. */
export function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="float-left mr-auto flex w-fit items-center gap-2 rounded-2xl rounded-bl-sm border border-[#00E5FF]/30 bg-[#0C1427]/85 px-4 py-3 shadow-[0_0_15px_rgba(0,229,255,0.15)] backdrop-blur-md"
      aria-label="A IA está digitando…"
    >
      <span className="typing-dot h-2 w-2 rounded-full bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]" />
      <span className="typing-dot h-2 w-2 rounded-full bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]" />
      <span className="typing-dot h-2 w-2 rounded-full bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]" />
    </motion.div>
  );
}