-- Giai đoạn 4: trạng thái duyệt nội dung của giáo viên. Chỉ thêm cột, không đổi dữ liệu cũ.
-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED');

-- AlterTable
ALTER TABLE "games" ADD COLUMN     "review_note" TEXT,
ADD COLUMN     "review_status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "reviewed_at" TIMESTAMP(3),
ADD COLUMN     "reviewed_by_id" UUID;

-- CreateIndex
CREATE INDEX "games_review_status_idx" ON "games"("review_status");
