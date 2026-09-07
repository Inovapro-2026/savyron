-- Transferência para atendimento humano:
-- 1) Número do proprietário que recebe notificações de handoff (por empresa).
ALTER TABLE "BusinessSettings" ADD COLUMN "human_transfer_owner_phone" TEXT;

-- 2) Timestamp da última notificação de handoff enviada ao proprietário da
--    conversa — protege contra notificações duplicadas (1 transferência ativa
--    = 1 notificação). Resetado quando a conversa volta para a IA.
ALTER TABLE "Conversation" ADD COLUMN "human_handoff_notified_at" TIMESTAMP(3);
