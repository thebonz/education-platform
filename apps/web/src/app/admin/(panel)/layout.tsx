import Link from 'next/link';
import { LogoutButton } from '@/components/logout-button';
import { adminContext } from '@/lib/admin-context';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { base, me, can } = await adminContext();
  if (!can('admin.access')) {
    return (
      <main className="admin-shell"><section className="admin-main"><div className="panel" data-testid="admin-forbidden">
        <h1>Không có quyền truy cập</h1>
        <p>Tài khoản {me.email} chưa được cấp quyền quản trị.</p>
        <LogoutButton label="Đăng xuất" redirectTo={`${base}/login`} />
      </div></section></main>
    );
  }
  return (
    <main className="admin-shell">
      <aside className="admin-nav">
        <div className="admin-brand">HappyClass <small>Admin</small></div>
        <Link href={base || '/'}>Tổng quan</Link>
        {can('users.read') && <Link href={`${base}/users`}>Người dùng</Link>}
        {can('products.read') && <Link href={`${base}/products`}>Sản phẩm & tên miền</Link>}
        {can('audit.read') && <Link href={`${base}/audit`}>Nhật ký thao tác</Link>}
        <div className="admin-me"><span>{me.displayName}</span><small>{me.roles.join(', ')}</small><LogoutButton label="Đăng xuất" redirectTo={`${base}/login`} /></div>
      </aside>
      <section className="admin-main">{children}</section>
    </main>
  );
}
