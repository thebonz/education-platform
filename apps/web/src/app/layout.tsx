import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Education Games – Learn by Playing',
  description: 'A shared learning games platform for English and Vietnamese.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
