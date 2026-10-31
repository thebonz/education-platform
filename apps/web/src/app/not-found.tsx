import Link from 'next/link';
export default function NotFound() {
  return <main className="not-found"><div>404</div><h1>Không tìm thấy trang này</h1><p>Đường dẫn có thể không tồn tại hoặc nội dung đã được chuyển.</p><Link href="/" className="primary-button">Về trang chủ</Link></main>;
}
