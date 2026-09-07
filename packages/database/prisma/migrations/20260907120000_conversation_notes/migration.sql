-- ANOTAÇÕES INTERNAS DA CONVERSA (nunca são mensagens do WhatsApp).
-- Isoladas por business_id (multi-tenant).
CREATE TABLE "ConversationNote" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_by_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConversationNote_business_id_conversation_id_idx"
    ON "ConversationNote"("business_id", "conversation_id");

ALTER TABLE "ConversationNote"
  ADD CONSTRAINT "ConversationNote_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "Conversation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConversationNote"
  ADD CONSTRAINT "ConversationNote_business_id_fkey"
  FOREIGN KEY ("business_id") REFERENCES "Business"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
