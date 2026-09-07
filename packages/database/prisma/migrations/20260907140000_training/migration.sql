-- Treinamentos (vídeos do YouTube) — globais da plataforma (sem business_id).
-- Admin cria/edita/publica; usuários veem apenas is_published = true.
CREATE TABLE "Training" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "youtube_url" TEXT NOT NULL,
    "youtube_video_id" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Training_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Training_is_published_sort_order_idx"
    ON "Training"("is_published", "sort_order");

CREATE INDEX "Training_sort_order_created_at_idx"
    ON "Training"("sort_order", "created_at");
