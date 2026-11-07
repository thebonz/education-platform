-- Giai đoạn 5: Game Builder (người tạo + ghi chú phiên bản) và thư viện media. Chỉ thêm, không đổi dữ liệu cũ.
-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'AUDIO');

-- AlterTable
ALTER TABLE "game_versions" ADD COLUMN     "created_by_id" UUID,
ADD COLUMN     "note" TEXT;

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "mime_type" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "original_name" TEXT NOT NULL,
    "alt" TEXT,
    "source" TEXT NOT NULL DEFAULT 'upload',
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_sha256_key" ON "media_assets"("sha256");

-- CreateIndex
CREATE INDEX "media_assets_kind_created_at_idx" ON "media_assets"("kind", "created_at");
