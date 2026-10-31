import { DomainEditor, ProductEditor } from '@/components/admin-actions';
import { adminContext } from '@/lib/admin-context';
import { apiGet } from '@/lib/server-api';

type Product = {
  id: string; slug: string; name: string; description: string | null; isActive: boolean;
  theme: { accent: string; accentSoft: string; background: string } | null;
  domains: { id: string; hostname: string; isPrimary: boolean }[]; _count: { games: number };
};

export default async function ProductsPage() {
  const { can } = await adminContext();
  if (!can('products.read')) return <p className="form-error">Không có quyền.</p>;
  const res = await apiGet<Product[]>('/admin/products');
  if (!res.ok) return <p className="form-error">Không tải được sản phẩm.</p>;
  return (
    <>
      <h1>Sản phẩm & tên miền</h1>
      {res.data.map((p) => (
        <div key={p.id} className="account-grid">
          {can('products.update') ? <ProductEditor product={p} /> : <div className="panel"><h2>{p.name}</h2></div>}
          {can('products.update') && <DomainEditor productId={p.id} domains={p.domains} />}
        </div>
      ))}
    </>
  );
}
