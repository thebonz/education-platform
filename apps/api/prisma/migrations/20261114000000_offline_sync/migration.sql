-- Đồng bộ kết quả chơi offline: thêm cột, không đổi dữ liệu cũ.
-- AlterTable
ALTER TABLE "game_sessions" ADD COLUMN     "client_id" UUID,
ADD COLUMN     "offline" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "game_sessions_client_id_key" ON "game_sessions"("client_id");
