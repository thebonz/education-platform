-- Giai đoạn 8: người dùng tự xoá tài khoản (đánh dấu thời điểm xoá). Chỉ thêm cột, không đổi dữ liệu cũ.
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deleted_at" TIMESTAMP(3);
