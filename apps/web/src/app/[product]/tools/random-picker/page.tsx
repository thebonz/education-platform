import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { RandomStudentPicker } from '@/components/random-student-picker';
import { productContext } from '@/lib/page-context';

export const metadata: Metadata = {
  title: 'Classroom Student Picker – HappyClass',
  description: 'A local, privacy-minded classroom activity that chooses names randomly without uploading a student roster.',
};

export default async function RandomPickerPage({ params }: { params: Promise<{ product: string }> }) {
  const { product, base, me } = await productContext(params);
  const lang = product === 'english' ? 'en' : 'vi';
  const isVi = lang === 'vi';
  return (
    <main className={`product-page ${product}`}>
      <SiteHeader product={product} base={base} me={me} />
      <section className="library-hero picker-hero">
        <Link href={`${base}/games`} className="back-link">← {isVi ? 'Về thư viện trò chơi' : 'Back to game library'}</Link>
        <span className="eyebrow">{isVi ? 'CÔNG CỤ TƯƠNG TÁC CHO GIÁO VIÊN' : 'TEACHER CLASSROOM TOOL'}</span>
        <h1>{isVi ? 'Vòng quay gọi tên' : 'Random Student Picker'}</h1>
        <p>{isVi ? 'Chọn học sinh công bằng, vui vẻ và không lặp tên trong một lượt.' : 'Take turns fairly, without repeating a name until everyone has participated.'}</p>
      </section>
      <section className="library-section">
        <RandomStudentPicker lang={lang} />
      </section>
    </main>
  );
}
