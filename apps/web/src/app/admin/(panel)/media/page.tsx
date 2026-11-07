import { MediaLibrary } from '@/components/builder/media-library';
import { adminContext } from '@/lib/admin-context';

export default async function MediaPage() {
  const { can } = await adminContext();
  if (!can('games.read_all')) return <p className="form-error">Không có quyền xem thư viện.</p>;
  return (
    <>
      <h1>Thư viện media</h1>
      <p className="muted">
        Ảnh và âm thanh dùng trong game. File được nhận dạng theo nội dung (không theo đuôi file); file trùng nội dung được dùng lại.
        Đánh dấu “Do AI tạo” cho ảnh/âm thanh sinh bằng AI.
      </p>
      <MediaLibrary canUpload={can('media.upload')} />
    </>
  );
}
